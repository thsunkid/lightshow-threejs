/**
 * StyleProfileManager - Manages style profiles including presets and persistence
 *
 * This class handles creating, loading, saving, and merging style profiles.
 * Includes built-in presets for popular lighting styles.
 */

import type { StyleProfile, StyleRule, RGB } from '../shared/types';

/**
 * Manages style profiles with built-in presets and persistence
 */
export class StyleProfileManager {
  /**
   * Built-in style presets
   */
  static readonly PRESETS: { [name: string]: StyleProfile } = {
    'justice-style': {
      name: 'justice-style',
      source: 'Justice Live Performance Style',
      createdAt: new Date('2024-01-01'),
      palette: {
        primary: [
          { r: 1.0, g: 0.0, b: 0.3 },   // Intense red
          { r: 1.0, g: 0.0, b: 0.8 },   // Magenta
          { r: 0.0, g: 0.5, b: 1.0 }    // Electric blue
        ],
        accent: [
          { r: 1.0, g: 0.5, b: 0.0 },   // Orange
          { r: 0.5, g: 0.0, b: 1.0 },   // Purple
          { r: 0.0, g: 1.0, b: 0.5 }    // Cyan
        ],
        strobeColor: { r: 1.0, g: 1.0, b: 1.0 } // White strobe
      },
      rules: [
        // Drop section → White strobe burst then color explosion
        {
          id: 'justice-drop-explosion',
          name: 'Drop Explosion',
          trigger: {
            sections: ['drop'],
            onDownbeat: true
          },
          action: {
            type: 'all_on',
            targets: ['strobe', 'moving_head', 'wash'],
            color: { r: 1.0, g: 1.0, b: 1.0 },
            intensity: 1.0,
            durationMs: 200
          },
          probability: 0.95,
          priority: 20
        },
        // Intense bass → Red/Magenta wash
        {
          id: 'justice-bass-wash',
          name: 'Bass Magenta Wash',
          trigger: {
            frequencyBand: 'low',
            energyThreshold: 0.75
          },
          action: {
            type: 'color_change',
            targets: ['wash'],
            color: { r: 1.0, g: 0.0, b: 0.8 },
            intensity: 0.9,
            durationMs: 150
          },
          probability: 0.8,
          priority: 12
        },
        // Beat → Strobe flash (30% probability)
        {
          id: 'justice-beat-strobe',
          name: 'Beat Strobe',
          trigger: {
            onBeat: true
          },
          action: {
            type: 'strobe',
            targets: ['strobe'],
            color: { r: 1.0, g: 1.0, b: 1.0 },
            intensity: 1.0,
            durationMs: 40
          },
          probability: 0.3,
          priority: 10
        },
        // Downbeat → Color change
        {
          id: 'justice-downbeat-color',
          name: 'Downbeat Color Shift',
          trigger: {
            onDownbeat: true
          },
          action: {
            type: 'color_change',
            targets: ['moving_head', 'wash'],
            color: 'random_from_palette',
            durationMs: 200
          },
          probability: 0.7,
          priority: 9
        },
        // High energy → All moving heads point forward
        {
          id: 'justice-energy-focus',
          name: 'High Energy Focus',
          trigger: {
            energyThreshold: 0.85
          },
          action: {
            type: 'movement',
            targets: ['moving_head'],
            movement: {
              pan: 0.5,  // Center
              tilt: 0.3, // Slightly down toward audience
              speed: 0.8
            },
            intensity: 1.0,
            durationMs: 300
          },
          probability: 0.9,
          priority: 11
        },
        // Breakdown → Slow blue/purple sweep
        {
          id: 'justice-breakdown-sweep',
          name: 'Breakdown Purple Sweep',
          trigger: {
            sections: ['breakdown', 'bridge']
          },
          action: {
            type: 'movement',
            targets: ['moving_head'],
            movement: {
              pan: 'random',
              tilt: 0.4,
              speed: 0.15
            },
            color: { r: 0.3, g: 0.0, b: 0.9 },
            intensity: 0.6,
            durationMs: 3000
          },
          probability: 0.8,
          priority: 7
        },
        // Spectral flux → Rapid color changes
        {
          id: 'justice-flux-colors',
          name: 'Flux Color Burst',
          trigger: {
            fluxThreshold: 0.6
          },
          action: {
            type: 'color_change',
            targets: ['moving_head'],
            color: 'random_from_palette',
            durationMs: 100
          },
          probability: 0.5,
          priority: 6
        },
        // Buildup → Increasing intensity
        {
          id: 'justice-buildup-intensity',
          name: 'Buildup Intensity Ramp',
          trigger: {
            sections: ['buildup']
          },
          action: {
            type: 'intensity_pulse',
            targets: ['moving_head', 'wash'],
            intensity: 'from_energy',
            durationMs: 500
          },
          probability: 1.0,
          priority: 8
        }
      ],
      avgBrightness: 0.65,
      brightnessVariance: 0.3,
      colorChangeRate: 2.5,
      strobeRate: 0.8,
      modelType: 'rules-only'
    },

    'minimal-techno': {
      name: 'minimal-techno',
      source: 'Minimal Techno Style',
      createdAt: new Date('2024-01-01'),
      palette: {
        primary: [
          { r: 1.0, g: 1.0, b: 1.0 },   // White
          { r: 0.0, g: 0.0, b: 0.0 },   // Black (for blackouts)
          { r: 0.5, g: 0.5, b: 0.5 }    // Gray
        ],
        accent: [
          { r: 1.0, g: 0.0, b: 0.0 },   // Pure red
          { r: 0.0, g: 0.0, b: 1.0 },   // Pure blue
          { r: 1.0, g: 0.5, b: 0.0 }    // Amber
        ],
        strobeColor: { r: 1.0, g: 1.0, b: 1.0 }
      },
      rules: [
        {
          id: 'minimal-kick-pulse',
          name: 'Kick Drum Pulse',
          trigger: {
            onBeat: true,
            frequencyBand: 'low'
          },
          action: {
            type: 'intensity_pulse',
            targets: ['wash'],
            intensity: 0.8,
            durationMs: 80
          },
          probability: 0.9,
          priority: 10
        },
        {
          id: 'minimal-blackout',
          name: 'Pattern Blackout',
          trigger: {
            onDownbeat: true
          },
          action: {
            type: 'blackout',
            targets: ['wash', 'moving_head'],
            durationMs: 50
          },
          probability: 0.1,
          priority: 12
        },
        {
          id: 'minimal-strobe-pattern',
          name: 'Minimal Strobe',
          trigger: {
            sections: ['drop'],
            onBeat: true
          },
          action: {
            type: 'strobe',
            targets: ['strobe'],
            color: { r: 1.0, g: 1.0, b: 1.0 },
            intensity: 0.7,
            durationMs: 30
          },
          probability: 0.2,
          priority: 8
        }
      ],
      avgBrightness: 0.4,
      brightnessVariance: 0.2,
      colorChangeRate: 0.5,
      strobeRate: 0.3,
      modelType: 'rules-only'
    },

    'edm-festival': {
      name: 'edm-festival',
      source: 'EDM Festival Style',
      createdAt: new Date('2024-01-01'),
      palette: {
        primary: [
          { r: 0.0, g: 1.0, b: 1.0 },   // Cyan
          { r: 1.0, g: 0.0, b: 1.0 },   // Magenta
          { r: 1.0, g: 1.0, b: 0.0 }    // Yellow
        ],
        accent: [
          { r: 0.0, g: 1.0, b: 0.0 },   // Green
          { r: 1.0, g: 0.5, b: 0.0 },   // Orange
          { r: 0.5, g: 0.0, b: 1.0 }    // Violet
        ],
        strobeColor: { r: 1.0, g: 1.0, b: 1.0 }
      },
      rules: [
        {
          id: 'edm-drop-madness',
          name: 'Festival Drop',
          trigger: {
            sections: ['drop'],
            onBeat: true
          },
          action: {
            type: 'all_on',
            targets: ['moving_head', 'strobe', 'wash', 'laser'],
            color: 'random_from_palette',
            intensity: 1.0,
            durationMs: 100
          },
          probability: 0.8,
          priority: 15
        },
        {
          id: 'edm-laser-sweep',
          name: 'Laser Sweep',
          trigger: {
            energyThreshold: 0.7,
            sections: ['drop', 'chorus']
          },
          action: {
            type: 'movement',
            targets: ['laser'],
            movement: {
              pan: 'random',
              speed: 0.9
            },
            color: { r: 0.0, g: 1.0, b: 0.0 },
            durationMs: 200
          },
          probability: 0.6,
          priority: 10
        },
        {
          id: 'edm-color-wave',
          name: 'Rainbow Wave',
          trigger: {
            onDownbeat: true
          },
          action: {
            type: 'color_change',
            targets: ['moving_head', 'wash'],
            color: 'random_from_palette',
            durationMs: 300
          },
          probability: 0.9,
          priority: 8
        }
      ],
      avgBrightness: 0.8,
      brightnessVariance: 0.35,
      colorChangeRate: 4.0,
      strobeRate: 1.2,
      modelType: 'rules-only'
    }
  };

  /**
   * Create a new empty style profile
   * @param name - Profile name
   * @param source - Source description
   * @returns New style profile
   */
  static create(name: string, source: string): StyleProfile {
    return {
      name,
      source,
      createdAt: new Date(),
      palette: {
        primary: [
          { r: 1.0, g: 1.0, b: 1.0 },
          { r: 0.5, g: 0.5, b: 0.5 },
          { r: 0.0, g: 0.0, b: 0.0 }
        ],
        accent: [
          { r: 1.0, g: 0.0, b: 0.0 },
          { r: 0.0, g: 1.0, b: 0.0 },
          { r: 0.0, g: 0.0, b: 1.0 }
        ],
        strobeColor: { r: 1.0, g: 1.0, b: 1.0 }
      },
      rules: [],
      avgBrightness: 0.5,
      brightnessVariance: 0.2,
      colorChangeRate: 1.0,
      strobeRate: 0.5,
      modelType: 'rules-only'
    };
  }

  /**
   * Serialize a style profile to JSON
   * @param profile - Style profile to serialize
   * @returns JSON string
   */
  static toJSON(profile: StyleProfile): string {
    // Convert ArrayBuffer to base64 if present
    const serializable = {
      ...profile,
      createdAt: profile.createdAt.toISOString(),
      modelWeights: profile.modelWeights
        ? this.arrayBufferToBase64(profile.modelWeights)
        : undefined
    };

    return JSON.stringify(serializable, null, 2);
  }

  /**
   * Deserialize a style profile from JSON
   * @param json - JSON string
   * @returns Style profile
   */
  static fromJSON(json: string): StyleProfile {
    const parsed = JSON.parse(json);

    // Convert base64 back to ArrayBuffer if present
    const profile: StyleProfile = {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      modelWeights: parsed.modelWeights
        ? this.base64ToArrayBuffer(parsed.modelWeights)
        : undefined
    };

    return profile;
  }

  /**
   * Save a style profile to localStorage
   * @param profile - Profile to save
   */
  static save(profile: StyleProfile): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('localStorage not available');
      return;
    }

    const key = `lightshow-style-${profile.name}`;
    const json = this.toJSON(profile);
    localStorage.setItem(key, json);

    // Update index
    const index = this.getStorageIndex();
    if (!index.includes(profile.name)) {
      index.push(profile.name);
      localStorage.setItem('lightshow-style-index', JSON.stringify(index));
    }
  }

  /**
   * Load a style profile from localStorage
   * @param name - Profile name
   * @returns Style profile or null if not found
   */
  static load(name: string): StyleProfile | null {
    // Check presets first
    if (this.PRESETS[name]) {
      return { ...this.PRESETS[name] };
    }

    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('localStorage not available');
      return null;
    }

    const key = `lightshow-style-${name}`;
    const json = localStorage.getItem(key);

    if (!json) {
      return null;
    }

    try {
      return this.fromJSON(json);
    } catch (error) {
      console.error(`Failed to load style profile ${name}:`, error);
      return null;
    }
  }

  /**
   * List all available style profiles
   * @returns Array of profile names
   */
  static list(): string[] {
    const presetNames = Object.keys(this.PRESETS);

    if (typeof window === 'undefined' || !window.localStorage) {
      return presetNames;
    }

    const storedNames = this.getStorageIndex();
    return [...new Set([...presetNames, ...storedNames])];
  }

  /**
   * Merge multiple style profiles with optional weights
   * @param profiles - Profiles to merge
   * @param weights - Optional weights for each profile (must sum to 1)
   * @returns Merged style profile
   */
  static merge(profiles: StyleProfile[], weights?: number[]): StyleProfile {
    if (profiles.length === 0) {
      throw new Error('Cannot merge zero profiles');
    }

    if (profiles.length === 1) {
      return { ...profiles[0] };
    }

    // Normalize weights
    const normalizedWeights = weights || new Array(profiles.length).fill(1 / profiles.length);
    const weightSum = normalizedWeights.reduce((a, b) => a + b, 0);
    const finalWeights = normalizedWeights.map(w => w / weightSum);

    // Merge basic properties (weighted average)
    const avgBrightness = profiles.reduce(
      (sum, p, i) => sum + p.avgBrightness * finalWeights[i],
      0
    );
    const brightnessVariance = profiles.reduce(
      (sum, p, i) => sum + p.brightnessVariance * finalWeights[i],
      0
    );
    const colorChangeRate = profiles.reduce(
      (sum, p, i) => sum + p.colorChangeRate * finalWeights[i],
      0
    );
    const strobeRate = profiles.reduce(
      (sum, p, i) => sum + p.strobeRate * finalWeights[i],
      0
    );

    // Merge palettes (take colors from all profiles)
    const primaryColors: RGB[] = [];
    const accentColors: RGB[] = [];
    profiles.forEach(p => {
      primaryColors.push(...p.palette.primary);
      accentColors.push(...p.palette.accent);
    });

    // Deduplicate colors
    const uniquePrimary = this.deduplicateColors(primaryColors).slice(0, 5);
    const uniqueAccent = this.deduplicateColors(accentColors).slice(0, 5);

    // Average strobe colors
    const strobeColor = this.averageColors(profiles.map(p => p.palette.strobeColor));

    // Merge rules (combine all, adjust probabilities by weight)
    const mergedRules: StyleRule[] = [];
    profiles.forEach((profile, profileIdx) => {
      profile.rules.forEach(rule => {
        const adjustedRule = {
          ...rule,
          id: `${rule.id}-${profileIdx}`,
          probability: rule.probability * finalWeights[profileIdx]
        };
        mergedRules.push(adjustedRule);
      });
    });

    // Sort by priority
    mergedRules.sort((a, b) => b.priority - a.priority);

    return {
      name: 'merged-profile',
      source: `Merged from ${profiles.map(p => p.name).join(', ')}`,
      createdAt: new Date(),
      palette: {
        primary: uniquePrimary,
        accent: uniqueAccent,
        strobeColor
      },
      rules: mergedRules,
      avgBrightness,
      brightnessVariance,
      colorChangeRate,
      strobeRate,
      modelType: 'rules-only'
    };
  }

  // === Private Helper Methods ===

  private static getStorageIndex(): string[] {
    const indexJson = localStorage.getItem('lightshow-style-index');
    if (!indexJson) return [];

    try {
      return JSON.parse(indexJson);
    } catch {
      return [];
    }
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private static deduplicateColors(colors: RGB[]): RGB[] {
    const unique: RGB[] = [];
    const threshold = 0.1; // Color similarity threshold

    for (const color of colors) {
      const isDuplicate = unique.some(c =>
        Math.abs(c.r - color.r) < threshold &&
        Math.abs(c.g - color.g) < threshold &&
        Math.abs(c.b - color.b) < threshold
      );

      if (!isDuplicate) {
        unique.push(color);
      }
    }

    return unique;
  }

  private static averageColors(colors: RGB[]): RGB {
    if (colors.length === 0) {
      return { r: 1, g: 1, b: 1 };
    }

    const sum = colors.reduce(
      (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
      { r: 0, g: 0, b: 0 }
    );

    return {
      r: sum.r / colors.length,
      g: sum.g / colors.length,
      b: sum.b / colors.length
    };
  }
}

// Export the class as default and named export for flexibility
export default StyleProfileManager;
export { StyleProfileManager as StyleProfile };