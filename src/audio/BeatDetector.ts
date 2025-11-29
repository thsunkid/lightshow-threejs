/**
 * Beat detection and tempo tracking
 * Uses energy-based onset detection and interval analysis
 */

/**
 * Configuration for beat detection
 */
export interface BeatDetectorConfig {
  /** Minimum tempo to detect (BPM) */
  minTempo: number;
  /** Maximum tempo to detect (BPM) */
  maxTempo: number;
  /** Energy threshold multiplier for beat detection */
  beatThreshold: number;
  /** Number of frames to use for energy history */
  historySize: number;
  /** Minimum time between beats (ms) */
  minBeatInterval: number;
  /** Downbeat detection interval (beats per bar) */
  beatsPerBar: number;
}

/**
 * Beat detection result
 */
export interface BeatInfo {
  /** Is this frame a beat */
  isBeat: boolean;
  /** Is this frame a downbeat */
  isDownbeat: boolean;
  /** Current tempo estimate (BPM) */
  tempo: number;
  /** Position within current beat (0-1) */
  beatPhase: number;
  /** Current beat number */
  beatNumber: number;
}

/**
 * Detects beats and tracks tempo from audio features
 */
export class BeatDetector {
  private config: BeatDetectorConfig;
  private energyHistory: number[] = [];
  private beatTimes: number[] = [];
  private lastBeatTime: number = 0;
  private beatNumber: number = 0;
  private currentTempo: number = 120; // Default BPM
  private beatInterval: number = 500; // ms between beats at 120 BPM
  private lastFrameTime: number = 0;
  private phaseAccumulator: number = 0;

  constructor(config?: Partial<BeatDetectorConfig>) {
    this.config = {
      minTempo: 60,
      maxTempo: 200,
      beatThreshold: 1.3,
      historySize: 43, // ~1 second at 60fps
      minBeatInterval: 200, // ms
      beatsPerBar: 4,
      ...config
    };

    // Calculate initial beat interval from default tempo
    this.beatInterval = 60000 / this.currentTempo;
  }

  /**
   * Process a frame and detect beats
   */
  detectBeat(
    energy: number,
    spectralFlux: number,
    timestamp: number
  ): BeatInfo {
    // Add energy to history
    this.energyHistory.push(energy);
    if (this.energyHistory.length > this.config.historySize) {
      this.energyHistory.shift();
    }

    // Calculate average energy
    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;

    // Detect beat using energy and spectral flux
    const energyRatio = energy / (avgEnergy + 0.0001);
    const combinedOnset = energyRatio * 0.7 + spectralFlux * 0.3;

    // Check if this is a beat
    const timeSinceLastBeat = timestamp - this.lastBeatTime;
    const isBeat =
      combinedOnset > this.config.beatThreshold &&
      timeSinceLastBeat > this.config.minBeatInterval &&
      this.energyHistory.length >= 10; // Need some history

    if (isBeat) {
      this.registerBeat(timestamp);
    }

    // Update tempo estimate
    this.updateTempo();

    // Calculate beat phase (position within current beat)
    const deltaTime = timestamp - this.lastFrameTime;
    this.phaseAccumulator += deltaTime / this.beatInterval;

    if (this.phaseAccumulator >= 1) {
      // We've passed a beat boundary (even if not detected)
      this.phaseAccumulator -= Math.floor(this.phaseAccumulator);
    }

    const beatPhase = this.phaseAccumulator;

    // Check for downbeat
    const isDownbeat = isBeat && (this.beatNumber % this.config.beatsPerBar === 0);

    this.lastFrameTime = timestamp;

    return {
      isBeat,
      isDownbeat,
      tempo: this.currentTempo,
      beatPhase,
      beatNumber: this.beatNumber
    };
  }

  /**
   * Register a detected beat
   */
  private registerBeat(timestamp: number): void {
    this.lastBeatTime = timestamp;
    this.beatTimes.push(timestamp);
    this.beatNumber++;
    this.phaseAccumulator = 0; // Reset phase on actual beat

    // Keep only recent beat times
    const maxBeatHistory = 32;
    if (this.beatTimes.length > maxBeatHistory) {
      this.beatTimes.shift();
    }
  }

  /**
   * Update tempo estimate based on beat intervals
   */
  private updateTempo(): void {
    if (this.beatTimes.length < 4) {
      return; // Not enough data
    }

    // Calculate intervals between recent beats
    const intervals: number[] = [];
    for (let i = 1; i < this.beatTimes.length; i++) {
      const interval = this.beatTimes[i] - this.beatTimes[i - 1];
      intervals.push(interval);
    }

    // Find the most common interval (mode)
    const intervalCounts = new Map<number, number>();
    const quantizationMs = 10; // Quantize to 10ms buckets

    for (const interval of intervals) {
      const quantized = Math.round(interval / quantizationMs) * quantizationMs;
      intervalCounts.set(quantized, (intervalCounts.get(quantized) || 0) + 1);
    }

    // Find mode
    let modeInterval = this.beatInterval;
    let maxCount = 0;

    intervalCounts.forEach((count, interval) => {
      if (count > maxCount) {
        maxCount = count;
        modeInterval = interval;
      }
    });

    // Convert interval to BPM
    const bpm = 60000 / modeInterval;

    // Clamp to valid range
    if (bpm >= this.config.minTempo && bpm <= this.config.maxTempo) {
      // Smooth tempo changes
      this.currentTempo = this.currentTempo * 0.9 + bpm * 0.1;
      this.beatInterval = 60000 / this.currentTempo;
    }
  }

  /**
   * Force a specific tempo (useful for manual override)
   */
  setTempo(bpm: number): void {
    if (bpm >= this.config.minTempo && bpm <= this.config.maxTempo) {
      this.currentTempo = bpm;
      this.beatInterval = 60000 / bpm;
    }
  }

  /**
   * Reset beat tracking
   */
  reset(): void {
    this.energyHistory = [];
    this.beatTimes = [];
    this.lastBeatTime = 0;
    this.beatNumber = 0;
    this.phaseAccumulator = 0;
    this.lastFrameTime = 0;
  }

  /**
   * Get current tempo
   */
  getTempo(): number {
    return this.currentTempo;
  }
}