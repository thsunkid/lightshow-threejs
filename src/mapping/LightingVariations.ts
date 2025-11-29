/**
 * LightingVariations - Provides multiple response options for the same audio features
 *
 * Instead of always responding the same way to a beat or energy spike,
 * this system provides weighted variations that maintain musical intentionality
 * while adding visual diversity.
 */

import { AudioFrame, LightingCommand, RGB, EasingType } from '../shared/types';
import { Scene } from './ShowPlanner';

export interface LightingVariation {
  name: string;
  weight: number; // Probability weight (higher = more likely)
  respond: (frame: AudioFrame, scene: Scene) => Partial<LightingCommand>[];
}

/**
 * Selects a variation based on weights
 */
function selectVariation(variations: LightingVariation[]): LightingVariation {
  const totalWeight = variations.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;

  for (const variation of variations) {
    random -= variation.weight;
    if (random <= 0) {
      return variation;
    }
  }

  return variations[variations.length - 1]; // Fallback
}

/**
 * Beat response variations - different ways to react to a beat
 */
export const BEAT_VARIATIONS: LightingVariation[] = [
  {
    name: 'intensity-pulse',
    weight: 3.0,
    respond: (frame, scene) => {
      const baseIntensity = scene.intensity === 'low' ? 0.3 :
                            scene.intensity === 'medium' ? 0.6 :
                            scene.intensity === 'high' ? 0.8 : 1.0;

      return [
        {
          targetId: 'all',
          updates: { intensity: Math.min(1.0, baseIntensity + 0.3) },
          transitionMs: 50,
          easing: 'easeOut' as EasingType,
        },
        {
          targetId: 'all',
          updates: { intensity: baseIntensity },
          transitionMs: 200,
          easing: 'easeIn' as EasingType,
        },
      ];
    },
  },
  {
    name: 'flash-all',
    weight: 1.5,
    respond: (frame, scene) => {
      const color = scene.palette[0] || { r: 1, g: 1, b: 1 };
      return [
        {
          targetId: 'all',
          updates: {
            intensity: 1.0,
            color,
          },
          transitionMs: 30,
          easing: 'snap' as EasingType,
        },
        {
          targetId: 'all',
          updates: { intensity: 0.5 },
          transitionMs: 150,
          easing: 'easeOut' as EasingType,
        },
      ];
    },
  },
  {
    name: 'color-shift',
    weight: 2.0,
    respond: (frame, scene) => {
      const colorIndex = Math.floor(Math.random() * scene.palette.length);
      const color = scene.palette[colorIndex];

      return [
        {
          targetId: 'wash',
          updates: { color },
          transitionMs: 150,
          easing: 'easeInOut' as EasingType,
        },
      ];
    },
  },
  {
    name: 'moving-head-snap',
    weight: 2.5,
    respond: (frame, scene) => {
      const positions = scene.look.movingHeadPositions;
      const posIndex = Math.floor(Math.random() * positions.length);
      const pos = positions[posIndex];

      return [
        {
          targetId: 'moving_head',
          updates: {
            pan: pos.pan + (Math.random() - 0.5) * 0.1,
            tilt: pos.tilt + (Math.random() - 0.5) * 0.1,
          },
          transitionMs: 100,
          easing: 'easeOut' as EasingType,
        },
      ];
    },
  },
  {
    name: 'strobe-accent',
    weight: 1.0,
    respond: (frame, scene) => {
      if (!scene.features.useStrobes) {
        return [];
      }

      return [
        {
          targetId: 'strobe',
          updates: {
            intensity: 1.0,
            rate: 10,
          },
          transitionMs: 0,
          easing: 'snap' as EasingType,
        },
        {
          targetId: 'strobe',
          updates: { intensity: 0 },
          transitionMs: 0,
          easing: 'snap' as EasingType,
        },
      ];
    },
  },
];

/**
 * Energy response variations - different ways to react to energy changes
 */
export const ENERGY_VARIATIONS: LightingVariation[] = [
  {
    name: 'brightness-scale',
    weight: 4.0,
    respond: (frame, scene) => {
      const baseIntensity = scene.intensity === 'low' ? 0.3 :
                            scene.intensity === 'medium' ? 0.6 :
                            scene.intensity === 'high' ? 0.8 : 1.0;
      const targetIntensity = baseIntensity * (0.5 + frame.energy * 0.5);

      return [
        {
          targetId: 'all',
          updates: { intensity: targetIntensity },
          transitionMs: 200,
          easing: 'linear' as EasingType,
        },
      ];
    },
  },
  {
    name: 'beam-spread',
    weight: 2.5,
    respond: (frame, scene) => {
      return [
        {
          targetId: 'moving_head',
          updates: {
            beamWidth: 0.1 + frame.energy * 0.6,
          },
          transitionMs: 300,
          easing: 'easeInOut' as EasingType,
        },
      ];
    },
  },
  {
    name: 'color-warmth',
    weight: 2.0,
    respond: (frame, scene) => {
      // Low energy = cool colors, high energy = warm colors
      const warmColor: RGB = {
        r: 0.8 + frame.energy * 0.2,
        g: 0.4 + frame.energy * 0.3,
        b: 0.1,
      };
      const coolColor: RGB = {
        r: 0.2,
        g: 0.4 + frame.energy * 0.3,
        b: 0.8 + frame.energy * 0.2,
      };

      const color = frame.energy > 0.5 ? warmColor : coolColor;

      return [
        {
          targetId: 'wash',
          updates: { color },
          transitionMs: 400,
          easing: 'easeInOut' as EasingType,
        },
      ];
    },
  },
  {
    name: 'movement-speed',
    weight: 3.0,
    respond: (frame, scene) => {
      const speed = 0.2 + frame.energy * 0.6;

      return [
        {
          targetId: 'moving_head',
          updates: { speed },
          transitionMs: 500,
          easing: 'easeOut' as EasingType,
        },
      ];
    },
  },
];

/**
 * Spectral response variations - different ways to react to frequency content
 */
export const SPECTRAL_VARIATIONS: LightingVariation[] = [
  {
    name: 'frequency-color-map',
    weight: 3.0,
    respond: (frame, scene) => {
      // Map spectral centroid to hue
      const hue = frame.spectralCentroid;
      const color: RGB = hslToRgb(hue, 0.8, 0.5);

      return [
        {
          targetId: 'moving_head',
          updates: { color },
          transitionMs: 250,
          easing: 'linear' as EasingType,
        },
      ];
    },
  },
  {
    name: 'bass-intensity',
    weight: 2.5,
    respond: (frame, scene) => {
      const bassIntensity = frame.lowEnergy * 0.8;

      return [
        {
          targetId: 'wash',
          updates: { intensity: bassIntensity },
          transitionMs: 100,
          easing: 'linear' as EasingType,
        },
      ];
    },
  },
  {
    name: 'treble-movement',
    weight: 2.0,
    respond: (frame, scene) => {
      const positions = scene.look.movingHeadPositions;
      if (positions.length === 0) return [];

      const posIndex = Math.floor(frame.highEnergy * positions.length);
      const pos = positions[Math.min(posIndex, positions.length - 1)];

      return [
        {
          targetId: 'moving_head',
          updates: {
            pan: pos.pan,
            tilt: pos.tilt + frame.highEnergy * 0.2,
          },
          transitionMs: 200,
          easing: 'easeOut' as EasingType,
        },
      ];
    },
  },
  {
    name: 'spectral-flux-strobe',
    weight: 1.5,
    respond: (frame, scene) => {
      if (frame.spectralFlux < 0.6 || !scene.features.useStrobes) {
        return [];
      }

      return [
        {
          targetId: 'strobe',
          updates: {
            intensity: frame.spectralFlux,
            rate: 5 + frame.spectralFlux * 15,
          },
          transitionMs: 50,
          easing: 'snap' as EasingType,
        },
      ];
    },
  },
];

/**
 * Section-specific variations - behaviors that depend on song section
 */
export const SECTION_VARIATIONS: LightingVariation[] = [
  {
    name: 'breakdown-minimal',
    weight: 5.0,
    respond: (frame, scene) => {
      if (scene.sectionType !== 'breakdown') return [];

      return [
        {
          targetId: 'strobe',
          updates: { intensity: 0 },
          transitionMs: 500,
          easing: 'easeOut' as EasingType,
        },
        {
          targetId: 'moving_head',
          updates: { intensity: 0.2 },
          transitionMs: 500,
          easing: 'easeOut' as EasingType,
        },
      ];
    },
  },
  {
    name: 'drop-explosion',
    weight: 5.0,
    respond: (frame, scene) => {
      if (scene.sectionType !== 'drop') return [];

      return [
        {
          targetId: 'all',
          updates: {
            intensity: 1.0,
            color: { r: 1, g: 1, b: 1 },
          },
          transitionMs: 50,
          easing: 'snap' as EasingType,
        },
      ];
    },
  },
  {
    name: 'buildup-crescendo',
    weight: 5.0,
    respond: (frame, scene) => {
      if (scene.sectionType !== 'buildup') return [];

      const progress = (frame.timestamp - scene.startTime) / (scene.endTime - scene.startTime);
      const intensity = 0.3 + progress * 0.7;

      return [
        {
          targetId: 'all',
          updates: { intensity },
          transitionMs: 300,
          easing: 'linear' as EasingType,
        },
      ];
    },
  },
];

/**
 * Helper function to convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): RGB {
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

/**
 * Main variation selector that combines all variation types
 */
export class VariationSelector {
  private lastBeatVariation: string = '';
  private lastEnergyVariation: string = '';
  private beatCounter: number = 0;

  /**
   * Get beat response with variation
   */
  getBeatResponse(frame: AudioFrame, scene: Scene): Partial<LightingCommand>[] {
    if (!frame.isBeat) {
      return [];
    }

    this.beatCounter++;

    // Don't use the same variation twice in a row
    const availableVariations = BEAT_VARIATIONS.filter(
      v => v.name !== this.lastBeatVariation
    );

    const variation = selectVariation(availableVariations);
    this.lastBeatVariation = variation.name;

    return variation.respond(frame, scene);
  }

  /**
   * Get energy response with variation
   */
  getEnergyResponse(frame: AudioFrame, scene: Scene): Partial<LightingCommand>[] {
    // Only trigger energy variations every few frames to avoid overwhelming
    if (this.beatCounter % 2 !== 0) {
      return [];
    }

    const availableVariations = ENERGY_VARIATIONS.filter(
      v => v.name !== this.lastEnergyVariation
    );

    const variation = selectVariation(availableVariations);
    this.lastEnergyVariation = variation.name;

    return variation.respond(frame, scene);
  }

  /**
   * Get spectral response with variation
   */
  getSpectralResponse(frame: AudioFrame, scene: Scene): Partial<LightingCommand>[] {
    // Spectral responses trigger based on spectral flux
    if (frame.spectralFlux < 0.4) {
      return [];
    }

    const variation = selectVariation(SPECTRAL_VARIATIONS);
    return variation.respond(frame, scene);
  }

  /**
   * Get section-specific response
   */
  getSectionResponse(frame: AudioFrame, scene: Scene): Partial<LightingCommand>[] {
    // Section variations are evaluated but less frequently
    if (this.beatCounter % 4 !== 0) {
      return [];
    }

    const variation = selectVariation(SECTION_VARIATIONS);
    return variation.respond(frame, scene);
  }

  /**
   * Reset the selector state
   */
  reset(): void {
    this.lastBeatVariation = '';
    this.lastEnergyVariation = '';
    this.beatCounter = 0;
  }
}
