/**
 * ShowPlanner - Creates intelligent lighting show plans based on song structure
 *
 * Analyzes pre-analysis results and generates a comprehensive show plan with:
 * - Dramatic scene changes based on song sections
 * - Predefined lighting looks with variation
 * - Contextual feature usage (flakes, strobes, movement patterns)
 */

import { PreAnalysisResult } from '../audio/CueScheduler';
import { RGB } from '../shared/types';

export type SongSection = 'intro' | 'verse' | 'chorus' | 'drop' | 'breakdown' | 'buildup' | 'bridge' | 'outro';

export interface ShowPlan {
  scenes: Scene[];
  transitions: Transition[];
  globalTheme: LightingTheme;
}

export interface Scene {
  startTime: number;
  endTime: number;
  sectionType: SongSection;
  look: LightingLook;
  intensity: 'low' | 'medium' | 'high' | 'extreme';
  palette: RGB[];
  features: {
    useFlakes: boolean;
    flakeIntensity: number;
    useStrobes: boolean;
    movingHeadPattern: 'slow' | 'medium' | 'fast' | 'sweep' | 'random';
    washPattern: 'static' | 'pulse' | 'chase';
  };
}

export interface LightingLook {
  name: string;
  baseColor: RGB;
  accentColor: RGB;
  movingHeadPositions: { pan: number; tilt: number }[];
}

export interface Transition {
  fromSceneIndex: number;
  toSceneIndex: number;
  startTime: number;
  durationMs: number;
  type: 'cut' | 'fade' | 'build' | 'explosion';
}

export interface LightingTheme {
  name: string;
  primaryColors: RGB[];
  accentColors: RGB[];
  preferredLooks: string[];
}

/**
 * Predefined lighting looks for different moods and sections
 */
const PREDEFINED_LOOKS: Record<string, LightingLook> = {
  'deep-blue': {
    name: 'Deep Blue',
    baseColor: { r: 0.1, g: 0.3, b: 0.9 },
    accentColor: { r: 0.3, g: 0.8, b: 1.0 },
    movingHeadPositions: [
      { pan: 0.3, tilt: 0.4 },
      { pan: 0.7, tilt: 0.4 },
      { pan: 0.4, tilt: 0.5 },
      { pan: 0.6, tilt: 0.5 },
    ],
  },
  'fire': {
    name: 'Fire',
    baseColor: { r: 1.0, g: 0.2, b: 0.0 },
    accentColor: { r: 1.0, g: 0.6, b: 0.0 },
    movingHeadPositions: [
      { pan: 0.1, tilt: 0.6 },
      { pan: 0.9, tilt: 0.6 },
      { pan: 0.2, tilt: 0.7 },
      { pan: 0.8, tilt: 0.7 },
    ],
  },
  'minimal': {
    name: 'Minimal',
    baseColor: { r: 0.8, g: 0.8, b: 0.9 },
    accentColor: { r: 1.0, g: 1.0, b: 1.0 },
    movingHeadPositions: [
      { pan: 0.5, tilt: 0.3 },
      { pan: 0.5, tilt: 0.3 },
    ],
  },
  'rave': {
    name: 'Rave',
    baseColor: { r: 1.0, g: 0.0, b: 1.0 },
    accentColor: { r: 0.0, g: 1.0, b: 0.0 },
    movingHeadPositions: [
      { pan: 0.0, tilt: 0.8 },
      { pan: 1.0, tilt: 0.8 },
      { pan: 0.25, tilt: 0.6 },
      { pan: 0.75, tilt: 0.6 },
      { pan: 0.5, tilt: 0.9 },
    ],
  },
  'ethereal': {
    name: 'Ethereal',
    baseColor: { r: 0.9, g: 0.9, b: 1.0 },
    accentColor: { r: 0.7, g: 0.5, b: 1.0 },
    movingHeadPositions: [
      { pan: 0.35, tilt: 0.35 },
      { pan: 0.65, tilt: 0.35 },
      { pan: 0.4, tilt: 0.4 },
      { pan: 0.6, tilt: 0.4 },
    ],
  },
  'electric-teal': {
    name: 'Electric Teal',
    baseColor: { r: 0.0, g: 0.8, b: 0.7 },
    accentColor: { r: 0.0, g: 1.0, b: 0.9 },
    movingHeadPositions: [
      { pan: 0.2, tilt: 0.5 },
      { pan: 0.8, tilt: 0.5 },
      { pan: 0.3, tilt: 0.6 },
      { pan: 0.7, tilt: 0.6 },
    ],
  },
  'sunset': {
    name: 'Sunset',
    baseColor: { r: 1.0, g: 0.4, b: 0.2 },
    accentColor: { r: 1.0, g: 0.7, b: 0.3 },
    movingHeadPositions: [
      { pan: 0.25, tilt: 0.45 },
      { pan: 0.75, tilt: 0.45 },
      { pan: 0.4, tilt: 0.55 },
      { pan: 0.6, tilt: 0.55 },
    ],
  },
  'purple-haze': {
    name: 'Purple Haze',
    baseColor: { r: 0.6, g: 0.2, b: 0.9 },
    accentColor: { r: 0.8, g: 0.4, b: 1.0 },
    movingHeadPositions: [
      { pan: 0.3, tilt: 0.4 },
      { pan: 0.7, tilt: 0.4 },
      { pan: 0.5, tilt: 0.5 },
    ],
  },
};

/**
 * Look templates for each section type
 */
const SECTION_LOOK_TEMPLATES: Record<SongSection, string[]> = {
  intro: ['deep-blue', 'minimal', 'ethereal', 'purple-haze'],
  verse: ['deep-blue', 'minimal', 'electric-teal', 'sunset'],
  chorus: ['fire', 'rave', 'electric-teal', 'sunset'],
  drop: ['fire', 'rave', 'ethereal'],
  breakdown: ['minimal', 'deep-blue', 'ethereal'],
  buildup: ['electric-teal', 'purple-haze', 'sunset'],
  bridge: ['minimal', 'purple-haze', 'deep-blue'],
  outro: ['minimal', 'ethereal', 'deep-blue'],
};

/**
 * Main show planner class
 */
export class ShowPlanner {
  private currentPlan: ShowPlan | null = null;

  /**
   * Creates a show plan from pre-analysis results
   */
  createPlan(analysis: PreAnalysisResult): ShowPlan {
    // Determine global theme based on average energy
    const globalTheme = this.selectGlobalTheme(analysis);

    // Create scenes from sections
    const scenes: Scene[] = [];
    for (let i = 0; i < analysis.sections.length; i++) {
      const section = analysis.sections[i];
      const scene = this.createSceneFromSection(section, i, analysis.bpm);
      scenes.push(scene);
    }

    // Create transitions between scenes
    const transitions: Transition[] = [];
    for (let i = 0; i < scenes.length - 1; i++) {
      const transition = this.createTransition(scenes[i], scenes[i + 1], i, i + 1);
      transitions.push(transition);
    }

    this.currentPlan = {
      scenes,
      transitions,
      globalTheme,
    };

    return this.currentPlan;
  }

  /**
   * Gets the scene at a specific time
   */
  getSceneAt(time: number): Scene | null {
    if (!this.currentPlan) {
      return null;
    }

    for (const scene of this.currentPlan.scenes) {
      if (time >= scene.startTime && time < scene.endTime) {
        return scene;
      }
    }

    // Return last scene if we're past the end
    if (this.currentPlan.scenes.length > 0) {
      const lastScene = this.currentPlan.scenes[this.currentPlan.scenes.length - 1];
      if (time >= lastScene.endTime) {
        return lastScene;
      }
    }

    return null;
  }

  /**
   * Gets the current plan
   */
  getCurrentPlan(): ShowPlan | null {
    return this.currentPlan;
  }

  /**
   * Selects a global theme based on analysis
   */
  private selectGlobalTheme(analysis: PreAnalysisResult): LightingTheme {
    const avgEnergy = analysis.averageEnergy;

    if (avgEnergy > 0.7) {
      // High energy - vibrant colors
      return {
        name: 'High Energy',
        primaryColors: [
          { r: 1.0, g: 0.0, b: 0.0 }, // Red
          { r: 1.0, g: 0.0, b: 1.0 }, // Magenta
          { r: 0.0, g: 1.0, b: 0.0 }, // Green
          { r: 1.0, g: 0.5, b: 0.0 }, // Orange
        ],
        accentColors: [
          { r: 1.0, g: 1.0, b: 1.0 }, // White
          { r: 0.0, g: 1.0, b: 1.0 }, // Cyan
        ],
        preferredLooks: ['fire', 'rave', 'electric-teal'],
      };
    } else if (avgEnergy > 0.4) {
      // Medium energy - balanced
      return {
        name: 'Balanced',
        primaryColors: [
          { r: 0.1, g: 0.3, b: 0.9 }, // Blue
          { r: 0.6, g: 0.2, b: 0.9 }, // Purple
          { r: 0.0, g: 0.8, b: 0.7 }, // Teal
          { r: 1.0, g: 0.4, b: 0.2 }, // Sunset
        ],
        accentColors: [
          { r: 0.9, g: 0.9, b: 1.0 }, // Soft white
          { r: 1.0, g: 0.7, b: 0.3 }, // Gold
        ],
        preferredLooks: ['deep-blue', 'electric-teal', 'purple-haze', 'sunset'],
      };
    } else {
      // Low energy - atmospheric
      return {
        name: 'Atmospheric',
        primaryColors: [
          { r: 0.1, g: 0.3, b: 0.9 }, // Deep blue
          { r: 0.6, g: 0.2, b: 0.9 }, // Purple
          { r: 0.8, g: 0.8, b: 0.9 }, // Soft white
        ],
        accentColors: [
          { r: 0.3, g: 0.8, b: 1.0 }, // Light blue
          { r: 0.7, g: 0.5, b: 1.0 }, // Lavender
        ],
        preferredLooks: ['minimal', 'ethereal', 'deep-blue'],
      };
    }
  }

  /**
   * Creates a scene from a section
   */
  private createSceneFromSection(
    section: PreAnalysisResult['sections'][0],
    index: number,
    bpm: number
  ): Scene {
    // Select random look from section templates
    const lookTemplates = SECTION_LOOK_TEMPLATES[section.type] || ['minimal'];
    const lookName = lookTemplates[Math.floor(Math.random() * lookTemplates.length)];
    const look = PREDEFINED_LOOKS[lookName];

    // Determine intensity based on section type and energy
    const intensity = this.determineIntensity(section.type, section.energy);

    // Create palette with some variation
    const palette = this.generatePalette(look.baseColor, look.accentColor);

    // Determine features based on section type
    const features = this.determineFeatures(section.type, section.energy, bpm);

    return {
      startTime: section.start,
      endTime: section.end,
      sectionType: section.type,
      look,
      intensity,
      palette,
      features,
    };
  }

  /**
   * Determines intensity level for a section
   */
  private determineIntensity(
    sectionType: SongSection,
    energy: number
  ): 'low' | 'medium' | 'high' | 'extreme' {
    // Section type base intensity
    const baseIntensity: Record<SongSection, number> = {
      intro: 0.2,
      verse: 0.4,
      chorus: 0.75,
      drop: 1.0,
      breakdown: 0.15,
      buildup: 0.6,
      bridge: 0.5,
      outro: 0.3,
    };

    const base = baseIntensity[sectionType] || 0.5;
    const combined = base * 0.7 + energy * 0.3; // Weight toward section type

    if (combined < 0.3) return 'low';
    if (combined < 0.6) return 'medium';
    if (combined < 0.85) return 'high';
    return 'extreme';
  }

  /**
   * Generates a palette with variations
   */
  private generatePalette(baseColor: RGB, accentColor: RGB): RGB[] {
    const palette: RGB[] = [baseColor, accentColor];

    // Add variations
    palette.push(this.colorVariation(baseColor, 0.15));
    palette.push(this.colorVariation(accentColor, 0.15));

    // Add complementary
    palette.push({
      r: 1.0 - baseColor.r,
      g: 1.0 - baseColor.g,
      b: 1.0 - baseColor.b,
    });

    return palette;
  }

  /**
   * Creates a color variation
   */
  private colorVariation(color: RGB, amount: number): RGB {
    return {
      r: Math.max(0, Math.min(1, color.r + (Math.random() - 0.5) * amount)),
      g: Math.max(0, Math.min(1, color.g + (Math.random() - 0.5) * amount)),
      b: Math.max(0, Math.min(1, color.b + (Math.random() - 0.5) * amount)),
    };
  }

  /**
   * Determines features for a section
   */
  private determineFeatures(
    sectionType: SongSection,
    energy: number,
    bpm: number
  ): Scene['features'] {
    const isFastTempo = bpm > 140;

    // Feature templates by section type
    const templates: Record<
      SongSection,
      Partial<Scene['features']>
    > = {
      intro: {
        useFlakes: false,
        flakeIntensity: 0,
        useStrobes: false,
        movingHeadPattern: 'slow',
        washPattern: 'static',
      },
      verse: {
        useFlakes: false,
        flakeIntensity: 0,
        useStrobes: false,
        movingHeadPattern: 'slow',
        washPattern: 'pulse',
      },
      chorus: {
        useFlakes: true,
        flakeIntensity: 0.6,
        useStrobes: energy > 0.6,
        movingHeadPattern: isFastTempo ? 'fast' : 'medium',
        washPattern: 'pulse',
      },
      drop: {
        useFlakes: true,
        flakeIntensity: 1.0,
        useStrobes: true,
        movingHeadPattern: 'fast',
        washPattern: 'chase',
      },
      breakdown: {
        useFlakes: false,
        flakeIntensity: 0,
        useStrobes: false,
        movingHeadPattern: 'slow',
        washPattern: 'static',
      },
      buildup: {
        useFlakes: energy > 0.5,
        flakeIntensity: energy * 0.7,
        useStrobes: false,
        movingHeadPattern: 'medium',
        washPattern: 'pulse',
      },
      bridge: {
        useFlakes: false,
        flakeIntensity: 0,
        useStrobes: false,
        movingHeadPattern: 'slow',
        washPattern: 'pulse',
      },
      outro: {
        useFlakes: energy > 0.5,
        flakeIntensity: energy * 0.4,
        useStrobes: false,
        movingHeadPattern: 'slow',
        washPattern: 'static',
      },
    };

    const template = templates[sectionType] || templates.verse;

    return {
      useFlakes: template.useFlakes ?? false,
      flakeIntensity: template.flakeIntensity ?? 0,
      useStrobes: template.useStrobes ?? false,
      movingHeadPattern: template.movingHeadPattern ?? 'medium',
      washPattern: template.washPattern ?? 'static',
    };
  }

  /**
   * Creates a transition between scenes
   */
  private createTransition(
    fromScene: Scene,
    toScene: Scene,
    fromIndex: number,
    toIndex: number
  ): Transition {
    const startTime = fromScene.endTime;

    // Determine transition type and duration based on section changes
    let type: Transition['type'] = 'fade';
    let durationMs = 500;

    // Breakdown to drop = explosion
    if (fromScene.sectionType === 'breakdown' && toScene.sectionType === 'drop') {
      type = 'explosion';
      durationMs = 100;
    }
    // Buildup to anything = build
    else if (fromScene.sectionType === 'buildup') {
      type = 'build';
      durationMs = 300;
    }
    // To breakdown = cut
    else if (toScene.sectionType === 'breakdown') {
      type = 'cut';
      durationMs = 50;
    }
    // Low to high intensity = build
    else if (
      (fromScene.intensity === 'low' || fromScene.intensity === 'medium') &&
      (toScene.intensity === 'high' || toScene.intensity === 'extreme')
    ) {
      type = 'build';
      durationMs = 400;
    }
    // High to low intensity = fade
    else if (
      (fromScene.intensity === 'high' || fromScene.intensity === 'extreme') &&
      (toScene.intensity === 'low' || toScene.intensity === 'medium')
    ) {
      type = 'fade';
      durationMs = 800;
    }

    return {
      fromSceneIndex: fromIndex,
      toSceneIndex: toIndex,
      startTime,
      durationMs,
      type,
    };
  }
}
