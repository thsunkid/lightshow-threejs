/**
 * Rule evaluator for processing style rules and generating lighting commands.
 * This component handles the evaluation of trigger conditions and execution of actions.
 */

import {
  StyleRule,
  StyleAction,
  AudioFrame,
  Fixture,
  LightingCommand,
  RGB,
  FixtureType,
  EasingType,
} from '../../shared/types';

/**
 * Evaluates style rules against audio frames and generates lighting commands
 */
export class RuleEvaluator {
  private palette: RGB[];
  private lastTriggerTimes: Map<string, number> = new Map();

  constructor(palette?: RGB[]) {
    // Default palette if none provided
    this.palette = palette || [
      { r: 1, g: 0, b: 0 },       // Red
      { r: 0, g: 0, b: 1 },       // Blue
      { r: 0, g: 1, b: 0 },       // Green
      { r: 1, g: 1, b: 0 },       // Yellow
      { r: 1, g: 0, b: 1 },       // Magenta
      { r: 0, g: 1, b: 1 },       // Cyan
      { r: 1, g: 0.5, b: 0 },     // Orange
      { r: 0.5, g: 0, b: 1 },     // Purple
    ];
  }

  /**
   * Check if a rule's trigger conditions are met
   */
  evaluate(rule: StyleRule, frame: AudioFrame, _previousFrame?: AudioFrame): boolean {
    const trigger = rule.trigger;

    // Check beat conditions
    if (trigger.onBeat !== undefined && trigger.onBeat !== frame.isBeat) {
      return false;
    }

    if (trigger.onDownbeat !== undefined && trigger.onDownbeat !== frame.isDownbeat) {
      return false;
    }

    // Check energy threshold
    if (trigger.energyThreshold !== undefined && frame.energy < trigger.energyThreshold) {
      return false;
    }

    // Check spectral flux threshold
    if (trigger.fluxThreshold !== undefined && frame.spectralFlux < trigger.fluxThreshold) {
      return false;
    }

    // Check song sections
    if (trigger.sections && trigger.sections.length > 0) {
      if (!frame.section || !trigger.sections.includes(frame.section)) {
        return false;
      }
    }

    // Check frequency band energy
    if (trigger.frequencyBand) {
      const bandEnergy = this.getBandEnergy(frame, trigger.frequencyBand);
      // Use a reasonable threshold for band detection
      if (bandEnergy < 0.5) {
        return false;
      }
    }

    // Check custom condition (if implemented)
    if (trigger.customCondition) {
      // For now, we'll skip custom conditions
      // In a full implementation, this could use a safe expression evaluator
      return false;
    }

    // Rate limiting: prevent the same rule from triggering too frequently
    const now = Date.now();
    const lastTrigger = this.lastTriggerTimes.get(rule.id) || 0;
    const minInterval = 50; // Minimum 50ms between same rule triggers

    if (now - lastTrigger < minInterval) {
      return false;
    }

    // All conditions met
    this.lastTriggerTimes.set(rule.id, now);
    return true;
  }

  /**
   * Execute an action and return commands
   */
  executeAction(
    action: StyleAction,
    frame: AudioFrame,
    fixtures: Fixture[]
  ): LightingCommand[] {
    const commands: LightingCommand[] = [];

    // Determine target fixtures
    const targetFixtures = this.resolveTargets(action.targets, fixtures);

    // Generate commands based on action type
    switch (action.type) {
      case 'strobe':
        commands.push(...this.executeStrobe(action, targetFixtures, frame));
        break;

      case 'color_change':
        commands.push(...this.executeColorChange(action, targetFixtures, frame));
        break;

      case 'intensity_pulse':
        commands.push(...this.executeIntensityPulse(action, targetFixtures, frame));
        break;

      case 'movement':
        commands.push(...this.executeMovement(action, targetFixtures, frame));
        break;

      case 'blackout':
        commands.push(...this.executeBlackout(action, targetFixtures));
        break;

      case 'all_on':
        commands.push(...this.executeAllOn(action, targetFixtures, frame));
        break;
    }

    return commands;
  }

  /**
   * Helper: pick a color from palette or generate
   */
  resolveColor(colorSpec: RGB | 'random_from_palette' | undefined): RGB {
    if (!colorSpec) {
      return { r: 1, g: 1, b: 1 }; // Default white
    }

    if (colorSpec === 'random_from_palette') {
      const index = Math.floor(Math.random() * this.palette.length);
      return this.palette[index];
    }

    return colorSpec;
  }

  /**
   * Helper: resolve intensity value
   */
  resolveIntensity(spec: number | 'from_energy' | undefined, frame: AudioFrame): number {
    if (spec === undefined) {
      return 0.8; // Default intensity
    }

    if (spec === 'from_energy') {
      return Math.max(0.2, Math.min(1, frame.energy));
    }

    return Math.max(0, Math.min(1, spec));
  }

  /**
   * Get energy for a specific frequency band
   */
  private getBandEnergy(frame: AudioFrame, band: 'low' | 'mid' | 'high'): number {
    switch (band) {
      case 'low':
        return frame.lowEnergy;
      case 'mid':
        return frame.midEnergy;
      case 'high':
        return frame.highEnergy;
      default:
        return frame.energy;
    }
  }

  /**
   * Resolve target fixtures from action targets
   */
  private resolveTargets(
    targets: FixtureType[] | string[],
    fixtures: Fixture[]
  ): Fixture[] {
    if (targets.length === 0) {
      return fixtures; // All fixtures
    }

    // Check if targets are fixture types or IDs
    const firstTarget = targets[0];

    // If it's a fixture type
    if (['moving_head', 'strobe', 'wash', 'laser', 'par'].includes(firstTarget)) {
      const types = targets as FixtureType[];
      return fixtures.filter(f => types.includes(f.type));
    }

    // Otherwise, treat as fixture IDs
    const ids = targets as string[];
    return fixtures.filter(f => ids.includes(f.id));
  }

  /**
   * Execute strobe action
   */
  private executeStrobe(
    action: StyleAction,
    fixtures: Fixture[],
    frame: AudioFrame
  ): LightingCommand[] {
    const color = this.resolveColor(action.color);
    const intensity = this.resolveIntensity(action.intensity, frame);

    // Generate strobe commands
    const commands: LightingCommand[] = [];

    // Strobe on
    fixtures.forEach(fixture => {
      if (fixture.type === 'strobe') {
        commands.push({
          targetId: fixture.id,
          updates: {
            intensity,
            color,
            rate: 15 + frame.energy * 15, // 15-30 Hz based on energy
          } as any, // Type assertion needed for union type
          transitionMs: 0,
          easing: 'snap',
        });
      } else {
        // For non-strobe fixtures, flash to full intensity
        commands.push({
          targetId: fixture.id,
          updates: {
            intensity,
            color,
          },
          transitionMs: 0,
          easing: 'snap',
        });
      }
    });

    // Note: In real implementation, strobe off would be scheduled after duration
    // For now, return the strobe on commands

    return commands;
  }

  /**
   * Execute color change action
   */
  private executeColorChange(
    action: StyleAction,
    fixtures: Fixture[],
    _frame: AudioFrame
  ): LightingCommand[] {
    const color = this.resolveColor(action.color);

    return fixtures.map(fixture => ({
      targetId: fixture.id,
      updates: {
        color,
      },
      transitionMs: action.durationMs,
      easing: 'easeInOut' as EasingType,
    }));
  }

  /**
   * Execute intensity pulse action
   */
  private executeIntensityPulse(
    action: StyleAction,
    fixtures: Fixture[],
    frame: AudioFrame
  ): LightingCommand[] {
    const intensity = this.resolveIntensity(action.intensity, frame);
    const color = action.color ? this.resolveColor(action.color) : undefined;

    const commands: LightingCommand[] = [];

    // Pulse up
    fixtures.forEach(fixture => {
      const updates: any = { intensity };
      if (color) {
        updates.color = color;
      }

      commands.push({
        targetId: fixture.id,
        updates,
        transitionMs: action.durationMs * 0.3,
        easing: 'easeOut',
      });
    });

    return commands;
  }

  /**
   * Execute movement action (for moving heads)
   */
  private executeMovement(
    action: StyleAction,
    fixtures: Fixture[],
    _frame: AudioFrame
  ): LightingCommand[] {
    if (!action.movement) {
      return [];
    }

    const commands: LightingCommand[] = [];
    const movement = action.movement;

    fixtures.forEach(fixture => {
      if (fixture.type === 'moving_head') {
        const updates: any = {};

        if (movement.pan !== undefined) {
          updates.pan = movement.pan === 'random'
            ? Math.random()
            : movement.pan;
        }

        if (movement.tilt !== undefined) {
          updates.tilt = movement.tilt === 'random'
            ? Math.random()
            : movement.tilt;
        }

        if (movement.speed !== undefined) {
          updates.speed = movement.speed;
        }

        commands.push({
          targetId: fixture.id,
          updates,
          transitionMs: action.durationMs,
          easing: 'easeInOut',
        });
      }
    });

    return commands;
  }

  /**
   * Execute blackout action
   */
  private executeBlackout(
    action: StyleAction,
    fixtures: Fixture[]
  ): LightingCommand[] {
    return fixtures.map(fixture => ({
      targetId: fixture.id,
      updates: {
        intensity: 0,
      },
      transitionMs: Math.min(action.durationMs, 100),
      easing: 'snap' as EasingType,
    }));
  }

  /**
   * Execute all on action
   */
  private executeAllOn(
    action: StyleAction,
    fixtures: Fixture[],
    frame: AudioFrame
  ): LightingCommand[] {
    const intensity = this.resolveIntensity(action.intensity || 1, frame);
    const color = this.resolveColor(action.color || { r: 1, g: 1, b: 1 });

    return fixtures.map(fixture => ({
      targetId: fixture.id,
      updates: {
        intensity,
        color,
      },
      transitionMs: action.durationMs,
      easing: 'easeOut' as EasingType,
    }));
  }

  /**
   * Update the color palette
   */
  setPalette(palette: RGB[]): void {
    this.palette = palette;
  }

  /**
   * Get current palette
   */
  getPalette(): RGB[] {
    return this.palette;
  }
}