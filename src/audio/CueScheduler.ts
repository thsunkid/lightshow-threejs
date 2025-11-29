/**
 * CueScheduler - Manages beat-synced lighting cues
 *
 * Schedules and triggers lighting events at specific beat positions,
 * with support for repeating patterns and auto-generation from analysis.
 */

import { BeatGrid } from './BeatGrid';

/**
 * Lighting cue action types
 */
export type CueAction =
  | 'strobe'
  | 'color_change'
  | 'intensity_pulse'
  | 'movement'
  | 'blackout'
  | 'all_on'
  | 'sweep'
  | 'flash'
  | 'fade';

/**
 * Represents a lighting cue to be triggered at a specific beat
 */
export interface LightingCue {
  /** Beat number to fire at (can be fractional like 4.5 for off-beat) */
  atBeat: number;
  /** Type of lighting action */
  action: CueAction;
  /** Fixture IDs or types to target */
  targets: string[];
  /** Parameters for the action */
  params: Record<string, any>;
  /** Repeat every N beats (0 = once, undefined = once) */
  repeat?: number;
  /** Optional cue name/description */
  name?: string;
}

/**
 * Internal cue representation with additional tracking
 */
interface InternalCue extends LightingCue {
  id: string;
  lastFiredBeat: number;
  nextFireBeat: number;
}

/**
 * Pre-analysis result for auto-generation
 */
export interface PreAnalysisResult {
  bpm: number;
  beats: number[];
  downbeats: number[];
  sections: {
    start: number;
    end: number;
    type: 'intro' | 'verse' | 'chorus' | 'drop' | 'breakdown' | 'outro';
    energy: number;
  }[];
  keySignature?: string;
  averageEnergy: number;
}

/**
 * Manages scheduling and triggering of beat-synced lighting cues
 */
export class CueScheduler {
  private beatGrid: BeatGrid;
  private cues: Map<string, InternalCue> = new Map();
  private cueIdCounter: number = 0;
  private lastProcessedBeat: number = -1;
  private enabled: boolean = true;

  /**
   * Create a new cue scheduler
   * @param beatGrid - The beat grid for timing calculations
   */
  constructor(beatGrid: BeatGrid) {
    this.beatGrid = beatGrid;
  }

  /**
   * Add a lighting cue
   * @param cue - The cue to add
   * @returns The ID of the added cue
   */
  addCue(cue: LightingCue): string {
    const id = `cue_${this.cueIdCounter++}`;

    const internalCue: InternalCue = {
      ...cue,
      id,
      lastFiredBeat: -1,
      nextFireBeat: cue.atBeat
    };

    this.cues.set(id, internalCue);
    return id;
  }

  /**
   * Remove a cue by ID
   * @param cueId - The ID of the cue to remove
   */
  removeCue(cueId: string): void {
    this.cues.delete(cueId);
  }

  /**
   * Update each frame - returns cues that should fire now
   * @param currentTimeSeconds - Current playback time in seconds
   * @returns Array of cues that should fire
   */
  update(currentTimeSeconds: number): LightingCue[] {
    if (!this.enabled) {
      return [];
    }

    const beatInfo = this.beatGrid.getBeatAt(currentTimeSeconds);
    const currentBeat = beatInfo.beat + beatInfo.phase;
    const cuesToFire: LightingCue[] = [];

    // Process each cue
    for (const internalCue of this.cues.values()) {
      // Check if this cue should fire
      if (this.shouldFireCue(internalCue, currentBeat, this.lastProcessedBeat)) {
        cuesToFire.push({
          atBeat: internalCue.atBeat,
          action: internalCue.action,
          targets: [...internalCue.targets],
          params: { ...internalCue.params },
          repeat: internalCue.repeat,
          name: internalCue.name
        });

        // Update tracking
        internalCue.lastFiredBeat = currentBeat;

        // Calculate next fire beat if repeating
        if (internalCue.repeat && internalCue.repeat > 0) {
          internalCue.nextFireBeat = internalCue.atBeat +
            Math.ceil((currentBeat - internalCue.atBeat) / internalCue.repeat) * internalCue.repeat;
        }
      }
    }

    this.lastProcessedBeat = currentBeat;
    return cuesToFire;
  }

  /**
   * Check if a cue should fire
   * @param cue - The cue to check
   * @param currentBeat - Current beat position
   * @param lastBeat - Last processed beat position
   * @returns True if the cue should fire
   */
  private shouldFireCue(cue: InternalCue, currentBeat: number, lastBeat: number): boolean {
    // For non-repeating cues
    if (!cue.repeat || cue.repeat === 0) {
      // Fire if we've crossed the cue beat and haven't fired yet
      return currentBeat >= cue.atBeat &&
             lastBeat < cue.atBeat &&
             cue.lastFiredBeat < cue.atBeat;
    }

    // For repeating cues
    const beatsSinceStart = currentBeat - cue.atBeat;
    if (beatsSinceStart < 0) {
      return false; // Haven't reached first trigger yet
    }

    // Check if we've crossed a repeat boundary
    const currentRepeatIndex = Math.floor(beatsSinceStart / cue.repeat);
    const lastRepeatIndex = Math.floor((lastBeat - cue.atBeat) / cue.repeat);

    // Fire if we've moved to a new repeat cycle
    return currentRepeatIndex > lastRepeatIndex && currentRepeatIndex >= 0;
  }

  /**
   * Generate cues automatically from pre-analysis
   * @param analysis - The pre-analysis result
   */
  generateCuesFromAnalysis(analysis: PreAnalysisResult): void {
    // Clear existing auto-generated cues (keep manually added ones)
    for (const [id, cue] of this.cues.entries()) {
      if (cue.name?.startsWith('auto_')) {
        this.cues.delete(id);
      }
    }

    // Process each section
    for (const section of analysis.sections) {
      const startBeat = this.beatGrid.getBeatAt(section.start).beat;
      const endBeat = this.beatGrid.getBeatAt(section.end).beat;

      switch (section.type) {
        case 'intro':
          // Gentle fade-ins
          this.addCue({
            atBeat: startBeat,
            action: 'fade',
            targets: ['wash'],
            params: { intensity: 0.3, duration: 2000, color: { r: 0.5, g: 0.5, b: 0.7 } },
            name: 'auto_intro_fade'
          });
          break;

        case 'verse':
          // Subtle pulsing on beats
          this.addCue({
            atBeat: startBeat,
            action: 'intensity_pulse',
            targets: ['wash', 'par'],
            params: { intensity: 0.4, pulseTime: 100 },
            repeat: 4, // Every bar
            name: 'auto_verse_pulse'
          });
          break;

        case 'chorus':
          // More energetic lighting
          this.addCue({
            atBeat: startBeat,
            action: 'color_change',
            targets: ['all'],
            params: { color: { r: 1, g: 0.3, b: 0.3 }, transition: 200 },
            name: 'auto_chorus_color'
          });

          // Flash on downbeats
          this.addCue({
            atBeat: startBeat,
            action: 'flash',
            targets: ['strobe'],
            params: { intensity: 0.8, duration: 50 },
            repeat: 4, // Every bar
            name: 'auto_chorus_flash'
          });

          // Moving heads sweep
          this.addCue({
            atBeat: startBeat,
            action: 'sweep',
            targets: ['moving_head'],
            params: {
              fromPan: 0.2,
              toPan: 0.8,
              fromTilt: 0.3,
              toTilt: 0.5,
              duration: 8 // 8 beats
            },
            repeat: 8,
            name: 'auto_chorus_sweep'
          });
          break;

        case 'drop':
          // Intense strobe and movement
          this.addCue({
            atBeat: startBeat,
            action: 'all_on',
            targets: ['all'],
            params: { intensity: 1, color: { r: 1, g: 1, b: 1 } },
            name: 'auto_drop_all_on'
          });

          // Strobe on every beat
          this.addCue({
            atBeat: startBeat + 0.5,
            action: 'strobe',
            targets: ['strobe'],
            params: { frequency: 10, intensity: 1 },
            repeat: 1,
            name: 'auto_drop_strobe'
          });

          // Rapid movement
          this.addCue({
            atBeat: startBeat,
            action: 'movement',
            targets: ['moving_head'],
            params: {
              pattern: 'figure8',
              speed: 0.8,
              size: 0.7
            },
            repeat: 4,
            name: 'auto_drop_movement'
          });
          break;

        case 'breakdown':
          // Minimal, atmospheric
          this.addCue({
            atBeat: startBeat,
            action: 'blackout',
            targets: ['strobe', 'moving_head'],
            params: { fadeTime: 1000 },
            name: 'auto_breakdown_blackout'
          });

          // Slow color transitions
          this.addCue({
            atBeat: startBeat,
            action: 'color_change',
            targets: ['wash'],
            params: {
              color: { r: 0.2, g: 0.2, b: 0.8 },
              transition: 4000
            },
            repeat: 8,
            name: 'auto_breakdown_color'
          });
          break;

        case 'outro':
          // Fade out
          this.addCue({
            atBeat: startBeat,
            action: 'fade',
            targets: ['all'],
            params: {
              intensity: 0,
              duration: (endBeat - startBeat) * (60 / analysis.bpm) * 1000
            },
            name: 'auto_outro_fade'
          });
          break;
      }

      // Add energy-based modulation
      if (section.energy > 0.7) {
        // High energy - add extra accents
        this.addCue({
          atBeat: startBeat + 0.25, // Off-beat accents
          action: 'flash',
          targets: ['par'],
          params: { intensity: 0.6, duration: 30 },
          repeat: 2,
          name: `auto_${section.type}_accent`
        });
      }
    }

    // Add global cues based on average energy
    if (analysis.averageEnergy > 0.6) {
      // High energy track - add regular strobes
      this.addCue({
        atBeat: 0,
        action: 'strobe',
        targets: ['strobe'],
        params: { frequency: 5, intensity: 0.3, duration: 100 },
        repeat: 16, // Every 4 bars
        name: 'auto_global_strobe'
      });
    }
  }

  /**
   * Clear all cues
   */
  clear(): void {
    this.cues.clear();
    this.lastProcessedBeat = -1;
  }

  /**
   * Get all current cues
   * @returns Array of all cues
   */
  getCues(): LightingCue[] {
    return Array.from(this.cues.values()).map(cue => ({
      atBeat: cue.atBeat,
      action: cue.action,
      targets: [...cue.targets],
      params: { ...cue.params },
      repeat: cue.repeat,
      name: cue.name
    }));
  }

  /**
   * Enable or disable the scheduler
   * @param enabled - Whether to enable the scheduler
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if the scheduler is enabled
   * @returns True if enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Reset the scheduler state (keeps cues but resets tracking)
   */
  reset(): void {
    this.lastProcessedBeat = -1;
    for (const cue of this.cues.values()) {
      cue.lastFiredBeat = -1;
      cue.nextFireBeat = cue.atBeat;
    }
  }
}