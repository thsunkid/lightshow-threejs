/**
 * StyleLearner - Learns lighting styles by correlating audio features with visual states
 *
 * This class analyzes the relationship between audio events and lighting changes
 * to extract style rules and patterns that can be applied to new music.
 */

import type {
  AudioFrame,
  LightingState,
  StyleProfile,
  StyleRule,
  RGB,
  SongSection
} from '../shared/types';

/**
 * Learns style profiles from paired audio and lighting data
 */
export class StyleLearner {
  private readonly CORRELATION_THRESHOLD = 0.6; // Minimum correlation for rule creation

  constructor() {
    // Initialize learner
  }

  /**
   * Learn a style profile from paired audio and lighting data
   * @param audioFrames - Analyzed audio frames
   * @param lightingStates - Corresponding lighting states
   * @returns Complete style profile
   */
  learn(audioFrames: AudioFrame[], lightingStates: LightingState[]): StyleProfile {
    if (audioFrames.length !== lightingStates.length) {
      throw new Error('Audio frames and lighting states must have equal length');
    }

    const rules = this.extractRules(audioFrames, lightingStates);
    const palette = this.extractPalette(lightingStates);
    const stats = this.calculateStatistics(lightingStates);

    return {
      name: 'learned-style',
      source: 'video-analysis',
      createdAt: new Date(),
      palette,
      rules,
      avgBrightness: stats.avgBrightness,
      brightnessVariance: stats.brightnessVariance,
      colorChangeRate: stats.colorChangeRate,
      strobeRate: stats.strobeRate,
      modelType: 'rules-only'
    };
  }

  /**
   * Extract style rules by finding correlations between audio and lighting
   * @param audioFrames - Audio analysis data
   * @param lightingStates - Lighting state data
   * @returns Array of extracted rules
   */
  extractRules(audioFrames: AudioFrame[], lightingStates: LightingState[]): StyleRule[] {
    const rules: StyleRule[] = [];
    const patterns = this.findPatterns(audioFrames, lightingStates);

    // Rule 1: Beat → Strobe correlation
    const beatStrobeCorr = this.calculateBeatStrobeCorrelation(audioFrames, lightingStates);
    if (beatStrobeCorr.correlation > this.CORRELATION_THRESHOLD) {
      rules.push({
        id: 'beat-strobe',
        name: 'Beat Strobe',
        trigger: { onBeat: true },
        action: {
          type: 'strobe',
          targets: ['strobe'],
          color: beatStrobeCorr.strobeColor,
          intensity: 1.0,
          durationMs: 50
        },
        probability: Math.min(0.5, beatStrobeCorr.correlation),
        priority: 10
      });
    }

    // Rule 2: Downbeat → Color Change
    const downbeatColorCorr = this.calculateDownbeatColorChangeCorrelation(audioFrames, lightingStates);
    if (downbeatColorCorr.correlation > this.CORRELATION_THRESHOLD) {
      rules.push({
        id: 'downbeat-color',
        name: 'Downbeat Color Change',
        trigger: { onDownbeat: true },
        action: {
          type: 'color_change',
          targets: ['wash', 'moving_head'],
          color: 'random_from_palette',
          durationMs: 200
        },
        probability: downbeatColorCorr.correlation,
        priority: 8
      });
    }

    // Rule 3: High Energy → Intensity
    const energyIntensityCorr = this.calculateEnergyIntensityCorrelation(audioFrames, lightingStates);
    if (energyIntensityCorr.correlation > this.CORRELATION_THRESHOLD) {
      rules.push({
        id: 'energy-intensity',
        name: 'Energy Intensity',
        trigger: { energyThreshold: energyIntensityCorr.threshold },
        action: {
          type: 'intensity_pulse',
          targets: ['moving_head', 'wash'],
          intensity: 'from_energy',
          durationMs: 100
        },
        probability: 1.0,
        priority: 5
      });
    }

    // Rule 4: Bass Hit → Color Wash
    const bassColorCorr = this.calculateBassColorCorrelation(audioFrames, lightingStates, patterns.bassColors);
    if (bassColorCorr.correlation > this.CORRELATION_THRESHOLD) {
      rules.push({
        id: 'bass-wash',
        name: 'Bass Color Wash',
        trigger: {
          frequencyBand: 'low',
          energyThreshold: 0.7
        },
        action: {
          type: 'color_change',
          targets: ['wash'],
          color: bassColorCorr.dominantColor,
          intensity: 0.9,
          durationMs: 150
        },
        probability: 0.8,
        priority: 7
      });
    }

    // Rule 5: Drop Section → All On
    const dropRules = this.extractSectionRules(audioFrames, lightingStates, 'drop');
    if (dropRules.allOnCorrelation > this.CORRELATION_THRESHOLD) {
      rules.push({
        id: 'drop-all-on',
        name: 'Drop All Lights On',
        trigger: {
          sections: ['drop'],
          onDownbeat: true
        },
        action: {
          type: 'all_on',
          targets: ['moving_head', 'wash', 'strobe'],
          intensity: 1.0,
          durationMs: 500
        },
        probability: 0.9,
        priority: 15
      });
    }

    // Rule 6: Breakdown → Slow Movement
    const breakdownRules = this.extractSectionRules(audioFrames, lightingStates, 'breakdown');
    if (breakdownRules.movementCorrelation > this.CORRELATION_THRESHOLD) {
      rules.push({
        id: 'breakdown-movement',
        name: 'Breakdown Slow Sweep',
        trigger: {
          sections: ['breakdown', 'bridge']
        },
        action: {
          type: 'movement',
          targets: ['moving_head'],
          movement: {
            pan: 'random',
            tilt: 0.3,
            speed: 0.2
          },
          color: { r: 0.2, g: 0.3, b: 0.8 },
          durationMs: 2000
        },
        probability: 0.7,
        priority: 6
      });
    }

    // Rule 7: Spectral Flux → Movement
    const fluxMovementCorr = this.calculateFluxMovementCorrelation(audioFrames, lightingStates);
    if (fluxMovementCorr.correlation > this.CORRELATION_THRESHOLD) {
      rules.push({
        id: 'flux-movement',
        name: 'Spectral Movement',
        trigger: {
          fluxThreshold: fluxMovementCorr.threshold
        },
        action: {
          type: 'movement',
          targets: ['moving_head', 'laser'],
          movement: {
            pan: 'random',
            tilt: 'random',
            speed: 0.7
          },
          durationMs: 300
        },
        probability: 0.6,
        priority: 4
      });
    }

    return rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Extract color palette from lighting states
   * @param states - Array of lighting states
   * @returns Categorized color palette
   */
  extractPalette(states: LightingState[]): StyleProfile['palette'] {
    const allColors: RGB[] = [];
    const strobeColors: RGB[] = [];

    // Collect all colors
    for (const state of states) {
      allColors.push(...state.dominantColors);

      if (state.isStrobe && state.dominantColors[0]) {
        strobeColors.push(state.dominantColors[0]);
      }
    }

    // Cluster colors to find primary and accent palettes
    const clusteredColors = this.clusterColors(allColors);
    const primaryColors = clusteredColors.slice(0, 3);
    const accentColors = clusteredColors.slice(3, 6);

    // Find most common strobe color
    const strobeColor = strobeColors.length > 0
      ? this.findMostCommonColor(strobeColors)
      : { r: 1, g: 1, b: 1 }; // Default white strobe

    return {
      primary: primaryColors,
      accent: accentColors,
      strobeColor
    };
  }

  /**
   * Calculate statistical patterns from lighting states
   * @param states - Array of lighting states
   * @returns Statistical metrics
   */
  calculateStatistics(states: LightingState[]): {
    avgBrightness: number;
    brightnessVariance: number;
    colorChangeRate: number;
    strobeRate: number;
  } {
    // Average brightness
    const brightnesses = states.map(s => s.overallBrightness);
    const avgBrightness = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;

    // Brightness variance
    const variance = brightnesses.reduce((sum, b) => sum + Math.pow(b - avgBrightness, 2), 0) / brightnesses.length;
    const brightnessVariance = Math.sqrt(variance);

    // Color change rate (changes per second)
    let colorChanges = 0;
    for (let i = 1; i < states.length; i++) {
      if (states[i].isColorChange) colorChanges++;
    }
    const durationSeconds = (states[states.length - 1].timestamp - states[0].timestamp) / 1000;
    const colorChangeRate = colorChanges / Math.max(1, durationSeconds);

    // Strobe rate (strobes per second)
    const strobeCount = states.filter(s => s.isStrobe).length;
    const strobeRate = strobeCount / Math.max(1, durationSeconds);

    return {
      avgBrightness,
      brightnessVariance,
      colorChangeRate,
      strobeRate
    };
  }

  // === Private Helper Methods ===

  private findPatterns(audioFrames: AudioFrame[], lightingStates: LightingState[]) {
    const bassColors: RGB[] = [];
    const beatTimings: number[] = [];
    const strobeTimings: number[] = [];

    for (let i = 0; i < audioFrames.length; i++) {
      const audio = audioFrames[i];
      const lighting = lightingStates[i];

      if (audio.isBeat) {
        beatTimings.push(audio.timestamp);
      }

      if (lighting.isStrobe) {
        strobeTimings.push(lighting.timestamp);
      }

      if (audio.lowEnergy > 0.7 && lighting.dominantColors[0]) {
        bassColors.push(lighting.dominantColors[0]);
      }
    }

    return { bassColors, beatTimings, strobeTimings };
  }

  private calculateBeatStrobeCorrelation(audioFrames: AudioFrame[], lightingStates: LightingState[]) {
    let beatStrobeCount = 0;
    let totalBeats = 0;
    const strobeColors: RGB[] = [];

    for (let i = 0; i < audioFrames.length; i++) {
      if (audioFrames[i].isBeat) {
        totalBeats++;
        if (lightingStates[i].isStrobe) {
          beatStrobeCount++;
          if (lightingStates[i].dominantColors[0]) {
            strobeColors.push(lightingStates[i].dominantColors[0]);
          }
        }
      }
    }

    const correlation = totalBeats > 0 ? beatStrobeCount / totalBeats : 0;
    const strobeColor = strobeColors.length > 0
      ? this.findMostCommonColor(strobeColors)
      : { r: 1, g: 1, b: 1 };

    return { correlation, strobeColor };
  }

  private calculateDownbeatColorChangeCorrelation(audioFrames: AudioFrame[], lightingStates: LightingState[]) {
    let downbeatColorCount = 0;
    let totalDownbeats = 0;

    for (let i = 0; i < audioFrames.length; i++) {
      if (audioFrames[i].isDownbeat) {
        totalDownbeats++;
        if (lightingStates[i].isColorChange) {
          downbeatColorCount++;
        }
      }
    }

    const correlation = totalDownbeats > 0 ? downbeatColorCount / totalDownbeats : 0;
    return { correlation };
  }

  private calculateEnergyIntensityCorrelation(audioFrames: AudioFrame[], lightingStates: LightingState[]) {
    const energyBrightnesssPairs: Array<{ energy: number; brightness: number }> = [];

    for (let i = 0; i < audioFrames.length; i++) {
      energyBrightnesssPairs.push({
        energy: audioFrames[i].energy,
        brightness: lightingStates[i].overallBrightness
      });
    }

    // Calculate Pearson correlation
    const correlation = this.pearsonCorrelation(
      energyBrightnesssPairs.map(p => p.energy),
      energyBrightnesssPairs.map(p => p.brightness)
    );

    // Find threshold where high energy correlates with high brightness
    const highEnergyStates = energyBrightnesssPairs.filter(p => p.energy > 0.7);
    const avgHighBrightness = highEnergyStates.reduce((sum, p) => sum + p.brightness, 0) / Math.max(1, highEnergyStates.length);

    return {
      correlation: Math.abs(correlation),
      threshold: 0.7,
      avgBrightness: avgHighBrightness
    };
  }

  private calculateBassColorCorrelation(audioFrames: AudioFrame[], lightingStates: LightingState[], bassColors: RGB[]) {
    let bassColorMatches = 0;
    let totalBassHits = 0;

    for (let i = 0; i < audioFrames.length; i++) {
      if (audioFrames[i].lowEnergy > 0.7) {
        totalBassHits++;
        if (lightingStates[i].isColorChange) {
          bassColorMatches++;
        }
      }
    }

    const correlation = totalBassHits > 0 ? bassColorMatches / totalBassHits : 0;
    const dominantColor = bassColors.length > 0
      ? this.findMostCommonColor(bassColors)
      : { r: 0.8, g: 0.2, b: 0.5 }; // Default magenta

    return { correlation, dominantColor };
  }

  private calculateFluxMovementCorrelation(audioFrames: AudioFrame[], lightingStates: LightingState[]) {
    let fluxMovementCount = 0;
    let highFluxCount = 0;
    const fluxThreshold = 0.5;

    for (let i = 0; i < audioFrames.length; i++) {
      if (audioFrames[i].spectralFlux > fluxThreshold) {
        highFluxCount++;
        if (lightingStates[i].hasMovement) {
          fluxMovementCount++;
        }
      }
    }

    const correlation = highFluxCount > 0 ? fluxMovementCount / highFluxCount : 0;
    return { correlation, threshold: fluxThreshold };
  }

  private extractSectionRules(audioFrames: AudioFrame[], lightingStates: LightingState[], section: SongSection) {
    const sectionFrames: number[] = [];
    let allOnCount = 0;
    let movementCount = 0;

    for (let i = 0; i < audioFrames.length; i++) {
      if (audioFrames[i].section === section) {
        sectionFrames.push(i);
        if (lightingStates[i].overallBrightness > 0.9) {
          allOnCount++;
        }
        if (lightingStates[i].hasMovement) {
          movementCount++;
        }
      }
    }

    const allOnCorrelation = sectionFrames.length > 0 ? allOnCount / sectionFrames.length : 0;
    const movementCorrelation = sectionFrames.length > 0 ? movementCount / sectionFrames.length : 0;

    return { allOnCorrelation, movementCorrelation };
  }

  private clusterColors(colors: RGB[]): RGB[] {
    if (colors.length === 0) return [];

    // Simple k-means clustering for colors
    const k = Math.min(6, colors.length);
    let clusters = this.initializeColorClusters(colors, k);

    for (let iter = 0; iter < 10; iter++) {
      const assignments = this.assignColorsToClusters(colors, clusters);
      clusters = this.updateColorClusters(colors, assignments, k);
    }

    // Sort by frequency (cluster size)
    const clusterSizes = new Array(k).fill(0);
    const assignments = this.assignColorsToClusters(colors, clusters);
    assignments.forEach(a => clusterSizes[a]++);

    const sortedClusters = clusters
      .map((cluster, idx) => ({ cluster, size: clusterSizes[idx] }))
      .sort((a, b) => b.size - a.size)
      .map(item => item.cluster);

    return sortedClusters;
  }

  private initializeColorClusters(colors: RGB[], k: number): RGB[] {
    const clusters: RGB[] = [];
    const used = new Set<number>();

    while (clusters.length < k && clusters.length < colors.length) {
      const idx = Math.floor(Math.random() * colors.length);
      if (!used.has(idx)) {
        used.add(idx);
        clusters.push({ ...colors[idx] });
      }
    }

    return clusters;
  }

  private assignColorsToClusters(colors: RGB[], clusters: RGB[]): number[] {
    return colors.map(color => {
      let minDist = Infinity;
      let bestCluster = 0;

      clusters.forEach((cluster, idx) => {
        const dist = this.colorDistance(color, cluster);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = idx;
        }
      });

      return bestCluster;
    });
  }

  private updateColorClusters(colors: RGB[], assignments: number[], k: number): RGB[] {
    const newClusters: Array<{ r: number; g: number; b: number; count: number }> =
      Array(k).fill(null).map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

    colors.forEach((color, idx) => {
      const cluster = newClusters[assignments[idx]];
      cluster.r += color.r;
      cluster.g += color.g;
      cluster.b += color.b;
      cluster.count++;
    });

    return newClusters.map(cluster => ({
      r: cluster.count > 0 ? cluster.r / cluster.count : 0.5,
      g: cluster.count > 0 ? cluster.g / cluster.count : 0.5,
      b: cluster.count > 0 ? cluster.b / cluster.count : 0.5
    }));
  }

  private findMostCommonColor(colors: RGB[]): RGB {
    if (colors.length === 0) return { r: 0.5, g: 0.5, b: 0.5 };

    // Average all colors (simple approach)
    const sum = colors.reduce(
      (acc, color) => ({
        r: acc.r + color.r,
        g: acc.g + color.g,
        b: acc.b + color.b
      }),
      { r: 0, g: 0, b: 0 }
    );

    return {
      r: sum.r / colors.length,
      g: sum.g / colors.length,
      b: sum.b / colors.length
    };
  }

  private colorDistance(c1: RGB, c2: RGB): number {
    return Math.sqrt(
      Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2)
    );
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }
}