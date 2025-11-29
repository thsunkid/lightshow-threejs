/**
 * Default mapping rules for generating lighting effects from audio.
 * These provide sensible defaults when no style profile is loaded.
 */

import { StyleRule, RGB } from '../../shared/types';

/**
 * Default color palettes for different moods/genres
 */
export const DEFAULT_PALETTES = {
  electronic: [
    { r: 0, g: 0.5, b: 1 },     // Electric blue
    { r: 1, g: 0, b: 1 },       // Magenta
    { r: 0, g: 1, b: 1 },       // Cyan
    { r: 0.5, g: 0, b: 1 },     // Purple
    { r: 0, g: 1, b: 0.5 },     // Teal
  ],
  rock: [
    { r: 1, g: 0, b: 0 },       // Red
    { r: 1, g: 0.5, b: 0 },     // Orange
    { r: 1, g: 1, b: 0 },       // Yellow
    { r: 1, g: 1, b: 1 },       // White
    { r: 0.5, g: 0.5, b: 0.5 }, // Gray
  ],
  ambient: [
    { r: 0, g: 0.2, b: 0.5 },   // Deep blue
    { r: 0.2, g: 0, b: 0.4 },   // Deep purple
    { r: 0, g: 0.3, b: 0.3 },   // Teal
    { r: 0.3, g: 0.2, b: 0.5 }, // Indigo
    { r: 0.1, g: 0.1, b: 0.3 }, // Dark blue
  ],
  party: [
    { r: 1, g: 0, b: 0.5 },     // Hot pink
    { r: 0, g: 1, b: 0 },       // Lime
    { r: 1, g: 1, b: 0 },       // Yellow
    { r: 0, g: 0.5, b: 1 },     // Sky blue
    { r: 1, g: 0.5, b: 0 },     // Orange
  ],
};

/**
 * Get default rules for basic audio-reactive lighting
 */
export function getDefaultRules(): StyleRule[] {
  return [
    // High priority rules (100+)
    {
      id: 'drop-strobe',
      name: 'Drop Section Strobe',
      trigger: {
        onBeat: true,
        sections: ['drop'],
        energyThreshold: 0.8,
      },
      action: {
        type: 'strobe',
        targets: ['strobe', 'moving_head'],
        color: 'random_from_palette',
        intensity: 1.0,
        durationMs: 100,
      },
      probability: 0.6,
      priority: 150,
    },
    {
      id: 'buildup-blackout',
      name: 'Buildup Blackout',
      trigger: {
        sections: ['buildup'],
        energyThreshold: 0.2,
        fluxThreshold: 0.1,
      },
      action: {
        type: 'blackout',
        targets: [],
        durationMs: 200,
      },
      probability: 0.3,
      priority: 140,
    },

    // Medium priority rules (50-99)
    {
      id: 'downbeat-color',
      name: 'Downbeat Color Change',
      trigger: {
        onDownbeat: true,
      },
      action: {
        type: 'color_change',
        targets: [],
        color: 'random_from_palette',
        durationMs: 500,
      },
      probability: 0.7,
      priority: 90,
    },
    {
      id: 'beat-pulse',
      name: 'Beat Intensity Pulse',
      trigger: {
        onBeat: true,
        energyThreshold: 0.5,
      },
      action: {
        type: 'intensity_pulse',
        targets: ['wash', 'par'],
        intensity: 'from_energy',
        durationMs: 100,
      },
      probability: 0.8,
      priority: 80,
    },
    {
      id: 'bass-movement',
      name: 'Bass-driven Movement',
      trigger: {
        frequencyBand: 'low',
        energyThreshold: 0.6,
      },
      action: {
        type: 'movement',
        targets: ['moving_head'],
        movement: {
          tilt: 'random',
          speed: 0.6,
        },
        durationMs: 800,
      },
      probability: 0.5,
      priority: 70,
    },
    {
      id: 'high-freq-sparkle',
      name: 'High Frequency Sparkle',
      trigger: {
        frequencyBand: 'high',
        fluxThreshold: 0.6,
      },
      action: {
        type: 'strobe',
        targets: ['strobe'],
        color: { r: 1, g: 1, b: 1 },
        intensity: 0.7,
        durationMs: 50,
      },
      probability: 0.4,
      priority: 60,
    },

    // Low priority rules (0-49)
    {
      id: 'chorus-sweep',
      name: 'Chorus Pan Sweep',
      trigger: {
        sections: ['chorus'],
        onBeat: true,
      },
      action: {
        type: 'movement',
        targets: ['moving_head'],
        movement: {
          pan: 'random',
          speed: 0.4,
        },
        durationMs: 1000,
      },
      probability: 0.3,
      priority: 40,
    },
    {
      id: 'verse-calm',
      name: 'Verse Calm Lighting',
      trigger: {
        sections: ['verse'],
      },
      action: {
        type: 'intensity_pulse',
        targets: [],
        intensity: 0.4,
        color: { r: 0.3, g: 0.3, b: 0.6 },
        durationMs: 2000,
      },
      probability: 0.5,
      priority: 30,
    },
    {
      id: 'breakdown-minimal',
      name: 'Breakdown Minimal',
      trigger: {
        sections: ['breakdown'],
      },
      action: {
        type: 'color_change',
        targets: [],
        color: { r: 0.2, g: 0.2, b: 0.4 },
        durationMs: 1000,
      },
      probability: 0.6,
      priority: 20,
    },
    {
      id: 'intro-fade-in',
      name: 'Intro Fade In',
      trigger: {
        sections: ['intro'],
      },
      action: {
        type: 'all_on',
        targets: [],
        intensity: 0.3,
        color: { r: 0.5, g: 0.5, b: 0.7 },
        durationMs: 3000,
      },
      probability: 0.8,
      priority: 10,
    },
    {
      id: 'outro-fade-out',
      name: 'Outro Fade Out',
      trigger: {
        sections: ['outro'],
      },
      action: {
        type: 'intensity_pulse',
        targets: [],
        intensity: 0.1,
        durationMs: 5000,
      },
      probability: 0.9,
      priority: 10,
    },
  ];
}

/**
 * Get genre-specific default rules
 */
export function getGenreRules(genre: 'electronic' | 'rock' | 'ambient' | 'party'): StyleRule[] {
  const baseRules = getDefaultRules();

  // Modify rules based on genre
  switch (genre) {
    case 'electronic':
      // More strobes, faster movements
      return baseRules.map(rule => {
        if (rule.id === 'drop-strobe') {
          return { ...rule, probability: 0.9 };
        }
        if (rule.action.type === 'movement' && rule.action.movement) {
          return {
            ...rule,
            action: {
              ...rule.action,
              movement: {
                ...rule.action.movement,
                speed: (rule.action.movement.speed || 0.5) * 1.5,
              },
            },
          };
        }
        return rule;
      });

    case 'rock':
      // More intensity pulses, warmer colors
      return baseRules.map(rule => {
        if (rule.id === 'beat-pulse') {
          return { ...rule, probability: 0.95 };
        }
        return rule;
      });

    case 'ambient':
      // Slower transitions, lower intensities
      return baseRules.map(rule => ({
        ...rule,
        action: {
          ...rule.action,
          durationMs: rule.action.durationMs * 2,
          intensity: typeof rule.action.intensity === 'number'
            ? rule.action.intensity * 0.6
            : rule.action.intensity,
        },
      }));

    case 'party':
      // High energy, frequent changes
      return baseRules.map(rule => ({
        ...rule,
        probability: Math.min(1, rule.probability * 1.3),
      }));

    default:
      return baseRules;
  }
}

/**
 * Create a custom rule from parameters
 */
export function createCustomRule(
  id: string,
  name: string,
  triggerType: 'beat' | 'energy' | 'section',
  actionType: 'strobe' | 'color_change' | 'intensity_pulse' | 'movement',
  options?: {
    energyThreshold?: number;
    section?: string;
    color?: RGB;
    intensity?: number;
    probability?: number;
    priority?: number;
  }
): StyleRule {
  const trigger: any = {};

  switch (triggerType) {
    case 'beat':
      trigger.onBeat = true;
      break;
    case 'energy':
      trigger.energyThreshold = options?.energyThreshold || 0.7;
      break;
    case 'section':
      trigger.sections = options?.section ? [options.section as any] : ['chorus'];
      break;
  }

  const action: any = {
    type: actionType,
    targets: [],
    durationMs: 500,
  };

  if (options?.color) {
    action.color = options.color;
  }

  if (options?.intensity !== undefined) {
    action.intensity = options.intensity;
  }

  return {
    id,
    name,
    trigger,
    action,
    probability: options?.probability || 0.5,
    priority: options?.priority || 50,
  };
}

/**
 * Validate a style rule
 */
export function validateRule(rule: StyleRule): boolean {
  // Check required fields
  if (!rule.id || !rule.name || !rule.trigger || !rule.action) {
    return false;
  }

  // Check probability range
  if (rule.probability < 0 || rule.probability > 1) {
    return false;
  }

  // Check action type
  const validActionTypes = ['strobe', 'color_change', 'intensity_pulse', 'movement', 'blackout', 'all_on'];
  if (!validActionTypes.includes(rule.action.type)) {
    return false;
  }

  // Check duration
  if (rule.action.durationMs <= 0) {
    return false;
  }

  return true;
}

/**
 * Merge multiple rule sets with conflict resolution
 */
export function mergeRuleSets(
  primary: StyleRule[],
  secondary: StyleRule[],
  conflictResolution: 'keep_primary' | 'keep_secondary' | 'merge' = 'keep_primary'
): StyleRule[] {
  const merged = new Map<string, StyleRule>();

  // Add primary rules
  primary.forEach(rule => {
    merged.set(rule.id, rule);
  });

  // Handle secondary rules based on conflict resolution
  secondary.forEach(rule => {
    if (merged.has(rule.id)) {
      switch (conflictResolution) {
        case 'keep_primary':
          // Do nothing, keep primary
          break;
        case 'keep_secondary':
          merged.set(rule.id, rule);
          break;
        case 'merge':
          // Merge properties, secondary overrides
          const existing = merged.get(rule.id)!;
          merged.set(rule.id, {
            ...existing,
            ...rule,
            trigger: { ...existing.trigger, ...rule.trigger },
            action: { ...existing.action, ...rule.action },
          });
          break;
      }
    } else {
      merged.set(rule.id, rule);
    }
  });

  return Array.from(merged.values());
}