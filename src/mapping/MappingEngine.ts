/**
 * Main mapping engine that processes audio frames and generates lighting commands.
 * This is the core component that bridges audio analysis to stage lighting.
 */

import {
  AudioFrame,
  LightingCommand,
  MappingConfig,
  IMappingEngine,
  MappingState,
  StyleProfile,
  Fixture,
  RGB,
  EasingType,
} from '../shared/types';
import { RuleEvaluator } from './rules/RuleEvaluator';
import { ShowPlanner, ShowPlan, Scene } from './ShowPlanner';
import { VariationSelector } from './LightingVariations';

// Utility functions for smoothing and color conversion
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function easeIn(t: number): number {
  return t * t;
}

export function easeOut(t: number): number {
  return t * (2 - t);
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h = Math.max(0, Math.min(1, h));
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r, g, b };
}

export function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
}

/**
 * Main mapping engine implementation
 */
export class MappingEngine implements IMappingEngine {
  private config: MappingConfig;
  private fixtures: Fixture[] = [];
  private ruleEvaluator: RuleEvaluator;
  private lastFrame: AudioFrame | null = null;
  private commandHistory: { timestamp: number; count: number }[] = [];
  private lastStrobeTime: number = 0;
  private currentColorIndex: number = 0;
  private smoothedIntensity: number = 0;
  private smoothedPan: number = 0.5;
  private smoothedTilt: number = 0.5;
  private baseColor: RGB = { r: 0, g: 0.5, b: 1 };
  private lastBeatNumber: number = 0;

  // Show planning system
  private showPlanner: ShowPlanner;
  private currentPlan: ShowPlan | null = null;
  private variationSelector: VariationSelector;

  constructor(config?: Partial<MappingConfig>) {
    this.config = {
      intensityScale: 1.0,
      reactivity: 0.7,
      beatSync: true,
      strobeMinInterval: 100,
      ...config,
    };

    const defaultPalette: RGB[] = [
      { r: 1, g: 0, b: 0 },       // Red
      { r: 0, g: 0.5, b: 1 },     // Blue
      { r: 1, g: 0.5, b: 0 },     // Orange
      { r: 0.5, g: 0, b: 1 },     // Purple
      { r: 0, g: 1, b: 0.5 },     // Teal
      { r: 1, g: 0, b: 0.5 },     // Magenta
    ];

    this.ruleEvaluator = new RuleEvaluator(
      this.config.styleProfile?.palette.primary || defaultPalette
    );

    // Initialize show planning system
    this.showPlanner = new ShowPlanner();
    this.variationSelector = new VariationSelector();
  }

  /**
   * Process an audio frame and generate lighting commands
   */
  process(frame: AudioFrame): LightingCommand[] {
    const commands: LightingCommand[] = [];
    const now = Date.now();

    // Update command history for rate calculation
    this.commandHistory.push({ timestamp: now, count: 0 });
    this.commandHistory = this.commandHistory.filter(h => now - h.timestamp < 1000);

    // If we have a show plan, use intelligent planning system
    if (this.currentPlan) {
      commands.push(...this.processWithShowPlan(frame));
    }
    // If we have a style profile, process rules
    else if (this.config.styleProfile) {
      commands.push(...this.processStyleRules(frame));
    }
    // Use default mapping behavior
    else {
      commands.push(...this.processDefaultMapping(frame));
    }

    // Update state
    this.lastFrame = frame;
    this.commandHistory[this.commandHistory.length - 1].count = commands.length;

    return commands;
  }

  /**
   * Process frame using show plan and variations
   */
  private processWithShowPlan(frame: AudioFrame): LightingCommand[] {
    const commands: LightingCommand[] = [];

    // Get current scene
    const scene = this.showPlanner.getSceneAt(frame.timestamp / 1000);
    if (!scene) {
      return commands;
    }

    // Apply scene-based base state
    commands.push(...this.applySceneBase(scene, frame));

    // Add variation responses
    commands.push(...this.applyVariations(frame, scene));

    return commands;
  }

  /**
   * Applies base scene lighting state
   */
  private applySceneBase(scene: Scene, frame: AudioFrame): LightingCommand[] {
    const commands: LightingCommand[] = [];

    // Set base colors from scene palette
    const baseColor = scene.look.baseColor;
    const accentColor = scene.look.accentColor;

    // Set wash lights to base color
    commands.push({
      targetId: 'wash',
      updates: {
        color: baseColor,
        intensity: this.getSceneIntensity(scene),
      },
      transitionMs: 300,
      easing: 'easeInOut',
    });

    // Set moving heads to accent color with scene positions
    const positions = scene.look.movingHeadPositions;
    if (positions.length > 0) {
      const posIndex = frame.beatNumber % positions.length;
      const pos = positions[posIndex];

      commands.push({
        targetId: 'moving_head',
        updates: {
          color: accentColor,
          pan: pos.pan,
          tilt: pos.tilt,
        },
        transitionMs: 500,
        easing: 'easeInOut',
      });
    }

    // Strobe control based on scene
    if (!scene.features.useStrobes) {
      commands.push({
        targetId: 'strobe',
        updates: { intensity: 0 },
        transitionMs: 200,
        easing: 'easeOut',
      });
    }

    return commands;
  }

  /**
   * Gets intensity value based on scene intensity level
   */
  private getSceneIntensity(scene: Scene): number {
    switch (scene.intensity) {
      case 'low': return 0.3;
      case 'medium': return 0.6;
      case 'high': return 0.85;
      case 'extreme': return 1.0;
      default: return 0.5;
    }
  }

  /**
   * Applies variation responses
   */
  private applyVariations(frame: AudioFrame, scene: Scene): LightingCommand[] {
    const commands: LightingCommand[] = [];

    // Get beat variations
    const beatResponses = this.variationSelector.getBeatResponse(frame, scene);
    commands.push(...this.convertPartialCommands(beatResponses));

    // Get energy variations
    const energyResponses = this.variationSelector.getEnergyResponse(frame, scene);
    commands.push(...this.convertPartialCommands(energyResponses));

    // Get spectral variations
    const spectralResponses = this.variationSelector.getSpectralResponse(frame, scene);
    commands.push(...this.convertPartialCommands(spectralResponses));

    // Get section variations
    const sectionResponses = this.variationSelector.getSectionResponse(frame, scene);
    commands.push(...this.convertPartialCommands(sectionResponses));

    return commands;
  }

  /**
   * Converts partial commands to full commands
   */
  private convertPartialCommands(partials: Partial<LightingCommand>[]): LightingCommand[] {
    return partials.map(partial => ({
      targetId: partial.targetId || 'all',
      updates: partial.updates || {},
      transitionMs: partial.transitionMs ?? 100,
      easing: partial.easing || 'linear',
    }));
  }

  /**
   * Load a show plan
   */
  loadShowPlan(plan: ShowPlan): void {
    this.currentPlan = plan;
    this.variationSelector.reset();
  }

  /**
   * Clear the loaded show plan
   */
  clearShowPlan(): void {
    this.currentPlan = null;
    this.variationSelector.reset();
  }

  /**
   * Get the show planner instance
   */
  getShowPlanner(): ShowPlanner {
    return this.showPlanner;
  }

  /**
   * Process frame using loaded style rules
   */
  private processStyleRules(frame: AudioFrame): LightingCommand[] {
    const commands: LightingCommand[] = [];

    if (!this.config.styleProfile) {
      return commands;
    }

    // Sort rules by priority (higher first)
    const sortedRules = [...this.config.styleProfile.rules].sort(
      (a, b) => b.priority - a.priority
    );

    // Evaluate each rule
    for (const rule of sortedRules) {
      if (this.ruleEvaluator.evaluate(rule, frame, this.lastFrame || undefined)) {
        // Check probability
        if (Math.random() <= rule.probability) {
          // Execute action
          const ruleCommands = this.ruleEvaluator.executeAction(
            rule.action,
            frame,
            this.fixtures
          );
          commands.push(...ruleCommands);
        }
      }
    }

    return commands;
  }

  /**
   * Default mapping behavior when no style is loaded
   */
  private processDefaultMapping(frame: AudioFrame): LightingCommand[] {
    const commands: LightingCommand[] = [];
    const smoothingFactor = this.config.reactivity;

    // 1. Base intensity follows RMS with smoothing
    const targetIntensity = frame.rms * this.config.intensityScale;
    this.smoothedIntensity = lerp(this.smoothedIntensity, targetIntensity, smoothingFactor);

    // 2. Color follows spectral centroid
    const hue = frame.spectralCentroid * 0.7; // 0-0.7 range (red to blue-purple)
    const newColor = hslToRgb(hue, 0.8, 0.5);
    this.baseColor = lerpColor(this.baseColor, newColor, smoothingFactor * 0.5);

    // 3. Beat triggers brief intensity pulse
    if (frame.isBeat && this.config.beatSync) {
      // Pulse to full intensity
      commands.push({
        targetId: 'all',
        updates: {
          intensity: 1.0,
          color: this.baseColor,
        },
        transitionMs: 50,
        easing: 'easeOut',
      });

      // Return to smoothed intensity
      commands.push({
        targetId: 'all',
        updates: {
          intensity: this.smoothedIntensity,
        },
        transitionMs: 150,
        easing: 'easeIn',
      });
    } else {
      // Regular intensity update
      commands.push({
        targetId: 'all',
        updates: {
          intensity: this.smoothedIntensity,
          color: this.baseColor,
        },
        transitionMs: 100,
        easing: 'linear',
      });
    }

    // 4. Bass energy drives moving head tilt
    const targetTilt = 0.3 + frame.lowEnergy * 0.4; // Range: 0.3 to 0.7
    this.smoothedTilt = lerp(this.smoothedTilt, targetTilt, smoothingFactor * 0.3);

    // 5. High energy = wider beam spread
    const beamWidth = frame.energy * 0.5 + 0.2;

    // Apply to moving heads specifically
    const movingHeadCommands = this.fixtures
      .filter(f => f.type === 'moving_head')
      .map(fixture => ({
        targetId: fixture.id,
        updates: {
          tilt: this.smoothedTilt,
          beamWidth: beamWidth,
        } as any, // Type assertion needed for union type
        transitionMs: 200,
        easing: 'easeInOut' as EasingType,
      }));

    commands.push(...movingHeadCommands);

    // 6. Downbeat = shift all colors
    if (frame.isDownbeat) {
      this.currentColorIndex = (this.currentColorIndex + 1) % 6;
      const palette = [
        { r: 1, g: 0, b: 0 },
        { r: 0, g: 0.5, b: 1 },
        { r: 1, g: 0.5, b: 0 },
        { r: 0.5, g: 0, b: 1 },
        { r: 0, g: 1, b: 0.5 },
        { r: 1, g: 0, b: 0.5 },
      ];

      const newBaseColor = palette[this.currentColorIndex];
      commands.push({
        targetId: 'all',
        updates: {
          color: newBaseColor,
        },
        transitionMs: 300,
        easing: 'easeInOut',
      });
    }

    // 7. Add strobe on high spectral flux (with rate limiting)
    const now = Date.now();
    if (
      frame.spectralFlux > 0.7 &&
      now - this.lastStrobeTime > this.config.strobeMinInterval
    ) {
      const strobeCommands = this.fixtures
        .filter(f => f.type === 'strobe')
        .map(fixture => ({
          targetId: fixture.id,
          updates: {
            intensity: 1.0,
            rate: 10 + frame.spectralFlux * 20, // 10-30 Hz
          } as any, // Type assertion needed for union type
          transitionMs: 0,
          easing: 'snap' as EasingType,
        }));

      commands.push(...strobeCommands);
      this.lastStrobeTime = now;

      // Turn off strobe after brief duration
      setTimeout(() => {
        // Note: In real implementation, strobe off commands would be queued
        // For now, this is a placeholder for the strobe off logic
        this.fixtures
          .filter(f => f.type === 'strobe')
          .forEach(_fixture => {
            // Strobe off logic would go here
          });
      }, 100);
    }

    // 8. Add movement patterns for moving heads based on section
    if (frame.section && frame.beatNumber !== this.lastBeatNumber) {
      this.lastBeatNumber = frame.beatNumber;

      switch (frame.section) {
        case 'drop':
        case 'chorus':
          // Fast, wide movements
          this.smoothedPan = 0.5 + Math.sin(frame.beatNumber * 0.5) * 0.4;
          break;
        case 'buildup':
          // Gradually increasing movement
          this.smoothedPan = 0.5 + Math.sin(frame.beatNumber * 0.2) * (frame.energy * 0.3);
          break;
        case 'breakdown':
        case 'verse':
          // Slow, subtle movements
          this.smoothedPan = 0.5 + Math.sin(frame.beatNumber * 0.1) * 0.2;
          break;
        default:
          // Center position
          this.smoothedPan = lerp(this.smoothedPan, 0.5, 0.1);
      }

      const panCommands = this.fixtures
        .filter(f => f.type === 'moving_head')
        .map(fixture => ({
          targetId: fixture.id,
          updates: {
            pan: this.smoothedPan,
            speed: frame.energy * 0.5 + 0.2,
          } as any, // Type assertion needed for union type
          transitionMs: 500,
          easing: 'easeInOut' as EasingType,
        }));

      commands.push(...panCommands);
    }

    return commands;
  }

  /**
   * Load a style profile
   */
  loadStyle(profile: StyleProfile): void {
    this.config.styleProfile = profile;
    this.ruleEvaluator = new RuleEvaluator(profile.palette.primary);
  }

  /**
   * Clear the loaded style profile
   */
  clearStyle(): void {
    this.config.styleProfile = undefined;
    const defaultPalette: RGB[] = [
      { r: 1, g: 0, b: 0 },
      { r: 0, g: 0.5, b: 1 },
      { r: 1, g: 0.5, b: 0 },
      { r: 0.5, g: 0, b: 1 },
      { r: 0, g: 1, b: 0.5 },
      { r: 1, g: 0, b: 0.5 },
    ];
    this.ruleEvaluator = new RuleEvaluator(defaultPalette);
  }

  /**
   * Update configuration
   */
  configure(config: Partial<MappingConfig>): void {
    this.config = { ...this.config, ...config };

    // Update rule evaluator palette if style profile changed
    if (config.styleProfile) {
      this.ruleEvaluator = new RuleEvaluator(config.styleProfile.palette.primary);
    }
  }

  /**
   * Get current state
   */
  getState(): MappingState {
    const totalCommands = this.commandHistory.reduce((sum, h) => sum + h.count, 0);
    const commandsPerSecond = this.commandHistory.length > 0 ? totalCommands : 0;

    return {
      activeStyle: this.config.styleProfile?.name || null,
      config: this.config,
      lastFrame: this.lastFrame,
      commandsPerSecond,
    };
  }

  /**
   * Register fixtures so the engine knows what fixtures exist
   */
  registerFixtures(fixtures: Fixture[]): void {
    this.fixtures = fixtures;
  }
}