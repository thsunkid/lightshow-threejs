/**
 * BeatGrid - Manages beat timing and grid calculations for audio tracks
 *
 * Provides beat quantization, phase calculations, and bar tracking
 * based on pre-analyzed beat positions.
 */

/**
 * Beat information at a specific time
 */
export interface BeatInfo {
  /** The beat number (0-indexed) */
  beat: number;
  /** Phase within the current beat (0-1) */
  phase: number;
  /** Whether this beat is a downbeat (first beat of bar) */
  isDownbeat: boolean;
}

/**
 * Manages beat grid calculations and timing
 */
export class BeatGrid {
  private bpm: number;
  private beats: number[];
  private downbeats: number[];
  private beatsPerBar: number;

  /**
   * Create a new beat grid
   * @param bpm - Beats per minute
   * @param beats - Array of beat timestamps in seconds
   * @param downbeats - Array of downbeat timestamps in seconds
   * @param beatsPerBar - Number of beats per bar (default: 4)
   */
  constructor(
    bpm: number,
    beats: number[],
    downbeats: number[],
    beatsPerBar: number = 4
  ) {
    this.bpm = bpm;
    this.beats = [...beats].sort((a, b) => a - b);
    this.downbeats = [...downbeats].sort((a, b) => a - b);
    this.beatsPerBar = beatsPerBar;
  }

  /**
   * Get beat information at a given time
   * @param timeSeconds - Time in seconds
   * @returns Beat information including number, phase, and downbeat status
   */
  getBeatAt(timeSeconds: number): BeatInfo {
    // Handle time before first beat
    if (timeSeconds < this.beats[0]) {
      const phase = Math.max(0, timeSeconds / this.beats[0]);
      return {
        beat: 0,
        phase,
        isDownbeat: this.isDownbeatIndex(0)
      };
    }

    // Find current beat index
    let beatIndex = 0;
    for (let i = 0; i < this.beats.length - 1; i++) {
      if (timeSeconds >= this.beats[i] && timeSeconds < this.beats[i + 1]) {
        beatIndex = i;
        break;
      }
    }

    // Handle time after last beat
    if (timeSeconds >= this.beats[this.beats.length - 1]) {
      beatIndex = this.beats.length - 1;
      const beatInterval = 60 / this.bpm;
      const timeSinceLastBeat = timeSeconds - this.beats[beatIndex];
      const extraBeats = Math.floor(timeSinceLastBeat / beatInterval);
      const phase = (timeSinceLastBeat % beatInterval) / beatInterval;

      return {
        beat: beatIndex + extraBeats,
        phase,
        isDownbeat: (beatIndex + extraBeats) % this.beatsPerBar === 0
      };
    }

    // Calculate phase within current beat
    const currentBeatTime = this.beats[beatIndex];
    const nextBeatTime = beatIndex < this.beats.length - 1
      ? this.beats[beatIndex + 1]
      : currentBeatTime + (60 / this.bpm);

    const phase = (timeSeconds - currentBeatTime) / (nextBeatTime - currentBeatTime);

    return {
      beat: beatIndex,
      phase: Math.max(0, Math.min(1, phase)),
      isDownbeat: this.isDownbeatIndex(beatIndex)
    };
  }

  /**
   * Get all beats within a time range
   * @param startTime - Start time in seconds
   * @param endTime - End time in seconds
   * @returns Array of beat timestamps in the range
   */
  getBeatsInRange(startTime: number, endTime: number): number[] {
    const result: number[] = [];

    for (const beat of this.beats) {
      if (beat >= startTime && beat <= endTime) {
        result.push(beat);
      }
      if (beat > endTime) {
        break;
      }
    }

    // If range extends beyond analyzed beats, extrapolate
    if (this.beats.length > 0 && endTime > this.beats[this.beats.length - 1]) {
      const beatInterval = 60 / this.bpm;
      let nextBeat = this.beats[this.beats.length - 1] + beatInterval;

      while (nextBeat <= endTime) {
        if (nextBeat >= startTime) {
          result.push(nextBeat);
        }
        nextBeat += beatInterval;
      }
    }

    return result;
  }

  /**
   * Quantize a time to the nearest beat
   * @param timeSeconds - Time to quantize in seconds
   * @param threshold - Snap threshold (0-0.5, default 0.5 = always snap)
   * @returns Quantized time in seconds
   */
  quantize(timeSeconds: number, threshold: number = 0.5): number {
    if (this.beats.length === 0) {
      return timeSeconds;
    }

    // Find nearest beat
    let nearestBeat = this.beats[0];
    let minDistance = Math.abs(timeSeconds - nearestBeat);

    for (const beat of this.beats) {
      const distance = Math.abs(timeSeconds - beat);
      if (distance < minDistance) {
        minDistance = distance;
        nearestBeat = beat;
      }
    }

    // Check if beyond last beat
    if (timeSeconds > this.beats[this.beats.length - 1]) {
      const beatInterval = 60 / this.bpm;
      const lastBeat = this.beats[this.beats.length - 1];
      const beatsSinceLast = Math.round((timeSeconds - lastBeat) / beatInterval);
      const extrapolatedBeat = lastBeat + (beatsSinceLast * beatInterval);
      const distance = Math.abs(timeSeconds - extrapolatedBeat);

      if (distance < minDistance) {
        minDistance = distance;
        nearestBeat = extrapolatedBeat;
      }
    }

    // Apply threshold
    const beatInterval = 60 / this.bpm;
    const maxSnapDistance = beatInterval * threshold;

    if (minDistance <= maxSnapDistance) {
      return nearestBeat;
    }

    return timeSeconds;
  }

  /**
   * Get the bar number at a given time
   * @param timeSeconds - Time in seconds
   * @returns Bar number (0-indexed)
   */
  getBarAt(timeSeconds: number): number {
    const beatInfo = this.getBeatAt(timeSeconds);
    return Math.floor(beatInfo.beat / this.beatsPerBar);
  }

  /**
   * Check if a beat index corresponds to a downbeat
   * @param beatIndex - Index of the beat
   * @returns True if the beat is a downbeat
   */
  private isDownbeatIndex(beatIndex: number): boolean {
    if (this.downbeats.length === 0) {
      // Fallback: assume every Nth beat is a downbeat
      return beatIndex % this.beatsPerBar === 0;
    }

    const beatTime = this.beats[beatIndex];
    const tolerance = 0.05; // 50ms tolerance

    return this.downbeats.some(downbeat =>
      Math.abs(downbeat - beatTime) < tolerance
    );
  }

  /**
   * Get the BPM
   * @returns Beats per minute
   */
  getBPM(): number {
    return this.bpm;
  }

  /**
   * Get all beat timestamps
   * @returns Array of beat times in seconds
   */
  getBeats(): number[] {
    return [...this.beats];
  }

  /**
   * Get all downbeat timestamps
   * @returns Array of downbeat times in seconds
   */
  getDownbeats(): number[] {
    return [...this.downbeats];
  }

  /**
   * Get the total number of analyzed beats
   * @returns Number of beats
   */
  getBeatCount(): number {
    return this.beats.length;
  }

  /**
   * Get the duration covered by analyzed beats
   * @returns Duration in seconds
   */
  getDuration(): number {
    if (this.beats.length === 0) {
      return 0;
    }
    return this.beats[this.beats.length - 1];
  }
}