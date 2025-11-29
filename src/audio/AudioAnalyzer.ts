/**
 * Main audio analyzer class that orchestrates audio analysis
 * Combines feature extraction and beat detection to produce AudioFrame objects
 */

import { AudioFrame, AudioAnalyzerConfig, SongSection } from '../shared/types';
import { FeatureExtractor } from './FeatureExtractor';
import { BeatDetector } from './BeatDetector';

/**
 * Frame callback function type
 */
type FrameCallback = (frame: AudioFrame) => void;

/**
 * Main audio analyzer that produces AudioFrame objects for the mapping engine
 */
export class AudioAnalyzer {
  private config: AudioAnalyzerConfig;
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private playing: boolean = false;
  private featureExtractor: FeatureExtractor;
  private beatDetector: BeatDetector;
  private frameCallbacks: Set<FrameCallback> = new Set();
  private animationFrameId: number | null = null;
  private currentSection: SongSection = 'intro';
  private sectionStartTime: number = 0;

  constructor(config?: Partial<AudioAnalyzerConfig>) {
    this.config = {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      minTempo: 60,
      maxTempo: 200,
      detectBeats: true,
      detectSections: true,
      ...config
    };

    // Create audio context
    this.audioContext = new AudioContext();

    // Initialize feature extractor
    this.featureExtractor = new FeatureExtractor(this.audioContext, {
      fftSize: this.config.fftSize,
      sampleRate: this.audioContext.sampleRate
    });

    // Initialize beat detector
    this.beatDetector = new BeatDetector({
      minTempo: this.config.minTempo,
      maxTempo: this.config.maxTempo
    });
  }

  /**
   * Load audio from a File object
   */
  async loadFile(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    await this.loadArrayBuffer(arrayBuffer);
  }

  /**
   * Load audio from a URL
   */
  async loadUrl(url: string): Promise<void> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    await this.loadArrayBuffer(arrayBuffer);
  }

  /**
   * Load audio from an ArrayBuffer
   */
  private async loadArrayBuffer(arrayBuffer: ArrayBuffer): Promise<void> {
    // Stop any current playback
    this.stop();

    // Decode audio data
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Start playback
   */
  play(): void {
    if (!this.audioBuffer) {
      console.error('No audio loaded');
      return;
    }

    if (this.playing) {
      return;
    }

    // Create source node
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;

    // Connect to feature extractor
    this.featureExtractor.initialize(this.sourceNode);

    // Connect to destination (speakers)
    this.sourceNode.connect(this.audioContext.destination);
    this.sourceNode.connect(this.featureExtractor.getAnalyserNode());

    // Start playback
    const offset = this.pauseTime / 1000;
    this.sourceNode.start(0, offset);
    this.startTime = this.audioContext.currentTime - offset;
    this.playing = true;

    // Start animation loop
    this.startAnimationLoop();

    // Handle end of playback
    this.sourceNode.onended = () => {
      if (this.playing) {
        this.stop();
      }
    };
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.playing || !this.sourceNode) {
      return;
    }

    this.pauseTime = this.getCurrentTime();
    this.sourceNode.stop();
    this.sourceNode.disconnect();
    this.sourceNode = null;
    this.playing = false;

    // Stop animation loop
    this.stopAnimationLoop();
  }

  /**
   * Stop playback
   */
  stop(): void {
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    this.playing = false;
    this.pauseTime = 0;
    this.startTime = 0;
    this.beatDetector.reset();

    // Stop animation loop
    this.stopAnimationLoop();
  }

  /**
   * Seek to a specific time
   */
  seek(timeMs: number): void {
    const wasPlaying = this.playing;

    if (wasPlaying) {
      this.pause();
    }

    this.pauseTime = Math.max(0, Math.min(timeMs, this.getDuration()));

    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Get current analysis frame
   */
  getCurrentFrame(): AudioFrame {
    const timestamp = this.getCurrentTime();

    // Extract features
    const features = this.featureExtractor.extractFeatures();

    // Detect beats
    const beatInfo = this.config.detectBeats
      ? this.beatDetector.detectBeat(
          features.energy,
          features.spectralFlux,
          timestamp
        )
      : {
          isBeat: false,
          isDownbeat: false,
          tempo: 120,
          beatPhase: 0,
          beatNumber: 0
        };

    // Detect sections (simplified - based on energy and time)
    let section = this.currentSection;
    let sectionConfidence = 0.5;

    if (this.config.detectSections) {
      const result = this.detectSection(timestamp, features.energy);
      section = result.section;
      sectionConfidence = result.confidence;
    }

    // Build AudioFrame
    const frame: AudioFrame = {
      timestamp,
      isBeat: beatInfo.isBeat,
      isDownbeat: beatInfo.isDownbeat,
      tempo: beatInfo.tempo,
      beatPhase: beatInfo.beatPhase,
      beatNumber: beatInfo.beatNumber,
      rms: features.rms,
      energy: features.energy,
      peak: features.peak,
      spectralCentroid: features.spectralCentroid,
      spectralFlux: features.spectralFlux,
      lowEnergy: features.lowEnergy,
      midEnergy: features.midEnergy,
      highEnergy: features.highEnergy,
      section,
      sectionConfidence
    };

    return frame;
  }

  /**
   * Simple section detection based on energy and time
   */
  private detectSection(
    timestamp: number,
    energy: number
  ): { section: SongSection; confidence: number } {
    const duration = this.getDuration();
    const position = timestamp / duration;
    const timeSinceSection = timestamp - this.sectionStartTime;

    // Simple heuristic-based section detection
    let newSection = this.currentSection;
    let confidence = 0.5;

    if (position < 0.1) {
      newSection = 'intro';
      confidence = 0.8;
    } else if (position > 0.9) {
      newSection = 'outro';
      confidence = 0.8;
    } else if (energy > 0.8 && timeSinceSection > 8000) {
      // High energy suggests chorus or drop
      if (this.currentSection === 'buildup') {
        newSection = 'drop';
        confidence = 0.9;
      } else {
        newSection = 'chorus';
        confidence = 0.7;
      }
    } else if (energy < 0.3 && timeSinceSection > 8000) {
      // Low energy suggests breakdown or verse
      if (this.currentSection === 'drop' || this.currentSection === 'chorus') {
        newSection = 'breakdown';
        confidence = 0.7;
      } else {
        newSection = 'verse';
        confidence = 0.6;
      }
    } else if (energy > 0.5 && energy < 0.7 && this.currentSection === 'verse') {
      // Building energy from verse
      newSection = 'buildup';
      confidence = 0.6;
    }

    // Update section if changed
    if (newSection !== this.currentSection) {
      this.currentSection = newSection;
      this.sectionStartTime = timestamp;
    }

    return { section: newSection, confidence };
  }

  /**
   * Subscribe to frame events
   */
  onFrame(callback: FrameCallback): () => void {
    this.frameCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.frameCallbacks.delete(callback);
    };
  }

  /**
   * Animation loop for continuous analysis
   */
  private startAnimationLoop(): void {
    const analyze = () => {
      if (!this.playing) {
        return;
      }

      const frame = this.getCurrentFrame();

      // Notify all callbacks
      this.frameCallbacks.forEach(callback => {
        callback(frame);
      });

      this.animationFrameId = requestAnimationFrame(analyze);
    };

    analyze();
  }

  /**
   * Stop animation loop
   */
  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Check if currently playing
   */
  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Get total duration in milliseconds
   */
  getDuration(): number {
    if (!this.audioBuffer) {
      return 0;
    }
    return this.audioBuffer.duration * 1000;
  }

  /**
   * Get current playback time in milliseconds
   */
  getCurrentTime(): number {
    if (!this.playing) {
      return this.pauseTime;
    }

    if (!this.sourceNode) {
      return 0;
    }

    return (this.audioContext.currentTime - this.startTime) * 1000;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    this.frameCallbacks.clear();
    this.featureExtractor.dispose();

    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}