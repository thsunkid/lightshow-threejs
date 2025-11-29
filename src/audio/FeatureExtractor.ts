/**
 * Feature extraction using Meyda.js
 * Extracts spectral features from audio data
 */

import Meyda from 'meyda';

/**
 * Configuration for feature extraction
 */
export interface FeatureExtractorConfig {
  /** FFT size for analysis (must be power of 2) */
  fftSize: number;
  /** Audio sample rate */
  sampleRate: number;
  /** Buffer size for analysis */
  bufferSize: number;
  /** Number of FFT bins for low frequencies */
  lowFreqBins: number;
  /** Number of FFT bins for mid frequencies */
  midFreqBins: number;
}

/**
 * Extracted audio features from a single frame
 */
export interface ExtractedFeatures {
  /** Root mean square amplitude, 0-1 */
  rms: number;
  /** Perceived energy level, 0-1 */
  energy: number;
  /** Peak amplitude in frame, 0-1 */
  peak: number;
  /** Spectral centroid (brightness), normalized 0-1 */
  spectralCentroid: number;
  /** Rate of spectral change, 0-1 */
  spectralFlux: number;
  /** Low frequency energy (bass), 0-1 */
  lowEnergy: number;
  /** Mid frequency energy, 0-1 */
  midEnergy: number;
  /** High frequency energy (treble), 0-1 */
  highEnergy: number;
  /** Raw spectral data for further processing */
  spectrum: Float32Array;
}

/**
 * Wraps Meyda.js for audio feature extraction
 */
export class FeatureExtractor {
  private config: FeatureExtractorConfig;
  private meydaAnalyzer: any | null = null; // Meyda analyzer instance
  private audioContext: AudioContext;
  private analyserNode: AnalyserNode;
  private previousSpectrum: Float32Array;
  private smoothedEnergy: number = 0;
  private maxEnergy: number = 0.001; // Avoid division by zero

  constructor(
    audioContext: AudioContext,
    config?: Partial<FeatureExtractorConfig>
  ) {
    this.audioContext = audioContext;
    this.config = {
      fftSize: 2048,
      sampleRate: audioContext.sampleRate,
      bufferSize: 512,
      lowFreqBins: 4,  // ~0-250 Hz at 44.1kHz
      midFreqBins: 8,  // ~250-2000 Hz
      ...config
    };

    // Create analyser node
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = this.config.fftSize;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Initialize previous spectrum for flux calculation
    this.previousSpectrum = new Float32Array(this.config.fftSize / 2);
  }

  /**
   * Initialize Meyda analyzer with audio source
   */
  initialize(sourceNode: AudioNode): void {
    // Connect source to analyser
    sourceNode.connect(this.analyserNode);

    // Create Meyda analyzer
    this.meydaAnalyzer = Meyda.createMeydaAnalyzer({
      audioContext: this.audioContext,
      source: sourceNode,
      bufferSize: this.config.bufferSize,
      featureExtractors: [
        'rms',
        'energy',
        'spectralCentroid',
        'amplitudeSpectrum',
        'powerSpectrum'
      ],
      callback: undefined // We'll pull features manually
    });
  }

  /**
   * Extract features from current audio frame
   */
  extractFeatures(): ExtractedFeatures {
    // Get frequency data
    const frequencyData = new Float32Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getFloatFrequencyData(frequencyData);

    // Get time domain data for peak detection
    const timeDomainData = new Float32Array(this.analyserNode.fftSize);
    this.analyserNode.getFloatTimeDomainData(timeDomainData);

    // Calculate peak
    let peak = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      const abs = Math.abs(timeDomainData[i]);
      if (abs > peak) peak = abs;
    }

    // Get Meyda features if analyzer is initialized
    let rms = 0;
    let energy = 0;
    let spectralCentroid = 0;

    if (this.meydaAnalyzer) {
      const features = this.meydaAnalyzer.get([
        'rms',
        'energy',
        'spectralCentroid'
      ]) as any;

      // Check if features is null (can happen before audio data is ready)
      if (features) {
        rms = features.rms || 0;
        energy = features.energy || 0;

        // Normalize spectral centroid (typically in Hz, normalize to 0-1)
        const rawCentroid = features.spectralCentroid || 0;
        spectralCentroid = Math.min(1, rawCentroid / (this.config.sampleRate / 2));
      }
    }

    // Calculate spectral flux (difference from previous spectrum)
    let spectralFlux = 0;
    const spectrum = new Float32Array(frequencyData.length);

    for (let i = 0; i < frequencyData.length; i++) {
      // Convert from dB to linear
      const linear = Math.pow(10, frequencyData[i] / 20);
      spectrum[i] = linear;

      // Calculate flux (only positive differences)
      const diff = linear - this.previousSpectrum[i];
      if (diff > 0) {
        spectralFlux += diff;
      }
    }

    // Normalize spectral flux
    spectralFlux = Math.min(1, spectralFlux / spectrum.length);

    // Store current spectrum for next frame
    this.previousSpectrum.set(spectrum);

    // Calculate frequency band energies
    const { lowEnergy, midEnergy, highEnergy } = this.calculateBandEnergies(spectrum);

    // Smooth energy for better perceptual result
    this.smoothedEnergy = 0.9 * this.smoothedEnergy + 0.1 * energy;

    // Track max values for normalization
    if (energy > this.maxEnergy) {
      this.maxEnergy = energy;
    }

    // Normalize energy
    const normalizedEnergy = Math.min(1, this.smoothedEnergy / this.maxEnergy);

    return {
      rms: Math.min(1, rms),
      energy: normalizedEnergy,
      peak: Math.min(1, peak),
      spectralCentroid,
      spectralFlux,
      lowEnergy,
      midEnergy,
      highEnergy,
      spectrum
    };
  }

  /**
   * Calculate energy in frequency bands
   */
  private calculateBandEnergies(spectrum: Float32Array): {
    lowEnergy: number;
    midEnergy: number;
    highEnergy: number;
  } {
    const binCount = spectrum.length;
    const lowEndBin = this.config.lowFreqBins;
    const midEndBin = lowEndBin + this.config.midFreqBins;

    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;

    // Sum energy in each band
    for (let i = 0; i < binCount; i++) {
      const energy = spectrum[i] * spectrum[i];

      if (i < lowEndBin) {
        lowEnergy += energy;
      } else if (i < midEndBin) {
        midEnergy += energy;
      } else {
        highEnergy += energy;
      }
    }

    // Normalize by number of bins in each band
    lowEnergy /= lowEndBin;
    midEnergy /= this.config.midFreqBins;
    highEnergy /= (binCount - midEndBin);

    // Apply logarithmic scaling for better perceptual representation
    lowEnergy = Math.log10(1 + lowEnergy * 9);
    midEnergy = Math.log10(1 + midEnergy * 9);
    highEnergy = Math.log10(1 + highEnergy * 9);

    return {
      lowEnergy: Math.min(1, lowEnergy),
      midEnergy: Math.min(1, midEnergy),
      highEnergy: Math.min(1, highEnergy)
    };
  }

  /**
   * Get the analyser node for connection
   */
  getAnalyserNode(): AnalyserNode {
    return this.analyserNode;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.meydaAnalyzer) {
      // Meyda doesn't have a dispose method, but we can null the reference
      this.meydaAnalyzer = null;
    }
    this.analyserNode.disconnect();
  }
}