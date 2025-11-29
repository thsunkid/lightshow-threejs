/**
 * AdvancedAnalyzer - Enhanced audio analysis with pre-analysis and beat grid
 *
 * Combines offline BPM detection, beat grid generation, section detection,
 * and real-time spectral analysis for comprehensive audio analysis.
 */

import { analyze } from 'web-audio-beat-detector';
import * as Tone from 'tone';
// Meyda types - we use it indirectly through the window
// import Meyda from 'meyda';
import { BeatGrid } from './BeatGrid';
import { CueScheduler, PreAnalysisResult, LightingCue } from './CueScheduler';

/**
 * Enhanced audio frame with additional frequency band information
 */
export interface EnhancedAudioFrame {
  timestamp: number;
  // Beat information
  isBeat: boolean;
  isDownbeat: boolean;
  beatNumber: number;
  barNumber: number;
  beatPhase: number;
  tempo: number;
  // Energy and amplitude
  rms: number;
  energy: number;
  peak: number;
  // Frequency bands
  sub: number;      // 20-60 Hz
  bass: number;     // 60-250 Hz
  lowMid: number;   // 250-500 Hz
  mid: number;      // 500-2000 Hz
  highMid: number;  // 2000-6000 Hz
  high: number;     // 6000-20000 Hz
  // Spectral features
  spectralCentroid: number;
  spectralFlux: number;
  spectralRolloff: number;
  // Section information
  section?: PreAnalysisResult['sections'][0];
  // Cues to fire this frame
  cues: LightingCue[];
}

/**
 * Configuration for the advanced analyzer
 */
export interface AdvancedAnalyzerConfig {
  fftSize?: number;
  hopSize?: number;
  windowingFunction?: 'blackman' | 'sine' | 'hann' | 'hamming';
  sampleRate?: number;
  enableCueGeneration?: boolean;
}

/**
 * Advanced audio analyzer with pre-analysis and real-time features
 */
export class AdvancedAnalyzer {
  private config: Required<AdvancedAnalyzerConfig>;
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer | null = null;
  private player: Tone.Player | null = null;
  private analyser: AnalyserNode | null = null;
  private meydaAnalyzer: any = null;
  private beatGrid: BeatGrid | null = null;
  private cueScheduler: CueScheduler | null = null;
  private preAnalysis: PreAnalysisResult | null = null;

  // Real-time analysis state
  private fftData: Float32Array<ArrayBuffer> | null = null;
  private previousSpectrum: Float32Array | null = null;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private audioMimeType: string = 'audio/mpeg';

  // Event callbacks
  private beatCallbacks: Set<(beatNumber: number, isDownbeat: boolean) => void> = new Set();
  private sectionCallbacks: Set<(section: PreAnalysisResult['sections'][0]) => void> = new Set();
  private currentSectionIndex: number = -1;

  constructor(config: AdvancedAnalyzerConfig = {}) {
    this.config = {
      fftSize: 2048,
      hopSize: 512,
      windowingFunction: 'hann',
      sampleRate: 44100,
      enableCueGeneration: true,
      ...config
    };

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Initialize Tone.js context
    Tone.start();
  }

  /**
   * Load and pre-analyze audio file
   * @param file - File object or URL string
   * @param onProgress - Optional callback for progress updates
   * @returns Pre-analysis results
   */
  async loadAndAnalyze(
    file: File | string,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<PreAnalysisResult> {
    console.log('[AdvancedAnalyzer] Starting loadAndAnalyze...');

    // Stop any current playback
    this.stop();

    // Load the audio
    onProgress?.('decoding', 0);
    let arrayBuffer: ArrayBuffer;
    let mimeType = 'audio/mpeg'; // Default for MP3

    if (typeof file === 'string') {
      console.log('[AdvancedAnalyzer] Loading from URL:', file);
      const response = await fetch(file);
      mimeType = response.headers.get('content-type') || 'audio/mpeg';
      arrayBuffer = await response.arrayBuffer();
    } else {
      // Get MIME type from file
      console.log('[AdvancedAnalyzer] Loading from File:', file.name, 'type:', file.type, 'size:', file.size);
      mimeType = file.type || 'audio/mpeg';
      arrayBuffer = await file.arrayBuffer();
    }

    console.log('[AdvancedAnalyzer] ArrayBuffer size:', arrayBuffer.byteLength, 'MIME type:', mimeType);

    // Store for later use in setupPlayer
    this.audioMimeType = mimeType;

    // Decode audio data
    console.log('[AdvancedAnalyzer] Decoding audio data...');
    onProgress?.('decoding', 10);
    try {
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
      console.log('[AdvancedAnalyzer] Audio decoded successfully. Duration:', this.audioBuffer.duration, 'seconds');
    } catch (decodeError) {
      console.error('[AdvancedAnalyzer] Failed to decode audio:', decodeError);
      throw decodeError;
    }
    onProgress?.('decoding', 20);

    // Perform BPM analysis
    console.log('[AdvancedAnalyzer] Starting BPM analysis...');
    onProgress?.('bpm', 20);
    const bpm = await this.analyzeBPM();
    console.log('[AdvancedAnalyzer] BPM analysis complete:', bpm);
    onProgress?.('bpm', 40);

    // Generate beat grid
    console.log('[AdvancedAnalyzer] Generating beat grid...');
    onProgress?.('beats', 40);
    const { beats, downbeats } = this.generateBeatGrid(bpm);
    console.log('[AdvancedAnalyzer] Beat grid generated:', beats.length, 'beats,', downbeats.length, 'downbeats');
    onProgress?.('beats', 60);

    // Detect sections
    console.log('[AdvancedAnalyzer] Detecting sections...');
    onProgress?.('sections', 60);
    const sections = await this.detectSections();
    console.log('[AdvancedAnalyzer] Sections detected:', sections.length, 'sections');
    onProgress?.('sections', 80);

    // Calculate average energy
    console.log('[AdvancedAnalyzer] Calculating average energy...');
    onProgress?.('finalizing', 80);
    const averageEnergy = this.calculateAverageEnergy();
    console.log('[AdvancedAnalyzer] Average energy:', averageEnergy);

    // Store pre-analysis results
    this.preAnalysis = {
      bpm,
      beats,
      downbeats,
      sections,
      averageEnergy,
      keySignature: undefined // TODO: Implement key detection
    };
    console.log('[AdvancedAnalyzer] Pre-analysis results stored');

    // Create beat grid
    this.beatGrid = new BeatGrid(bpm, beats, downbeats);
    console.log('[AdvancedAnalyzer] BeatGrid created');

    // Create cue scheduler
    this.cueScheduler = new CueScheduler(this.beatGrid);
    console.log('[AdvancedAnalyzer] CueScheduler created');

    // Generate automatic cues if enabled
    if (this.config.enableCueGeneration) {
      this.cueScheduler.generateCuesFromAnalysis(this.preAnalysis);
      console.log('[AdvancedAnalyzer] Cues generated from analysis');
    }

    onProgress?.('finalizing', 90);

    // Setup Tone.js player
    console.log('[AdvancedAnalyzer] Setting up Tone.js player...');
    await this.setupPlayer(arrayBuffer);
    console.log('[AdvancedAnalyzer] Tone.js player setup complete');

    // Setup real-time analyzer
    console.log('[AdvancedAnalyzer] Setting up real-time analyser...');
    this.setupAnalyser();
    console.log('[AdvancedAnalyzer] Real-time analyser setup complete');

    onProgress?.('finalizing', 100);
    console.log('[AdvancedAnalyzer] loadAndAnalyze complete!');

    return this.preAnalysis;
  }

  /**
   * Analyze BPM using web-audio-beat-detector
   * @returns Detected BPM
   */
  private async analyzeBPM(): Promise<number> {
    if (!this.audioBuffer) {
      throw new Error('No audio buffer loaded');
    }

    try {
      // Use web-audio-beat-detector - returns tempo as a number
      const bpm = await analyze(this.audioBuffer);
      console.log('Detected BPM:', bpm);
      return bpm;
    } catch (error) {
      console.error('BPM detection failed:', error);
      // Fallback to 120 BPM
      return 120;
    }
  }

  /**
   * Generate beat grid from BPM
   * @param bpm - Beats per minute
   * @returns Beat and downbeat timestamps
   */
  private generateBeatGrid(bpm: number): { beats: number[]; downbeats: number[] } {
    if (!this.audioBuffer) {
      return { beats: [], downbeats: [] };
    }

    const duration = this.audioBuffer.duration;
    const beatInterval = 60 / bpm;
    const beats: number[] = [];
    const downbeats: number[] = [];

    // Generate beat positions
    for (let t = 0; t < duration; t += beatInterval) {
      beats.push(t);
      // Every 4th beat is a downbeat (4/4 time signature)
      if (beats.length % 4 === 1) {
        downbeats.push(t);
      }
    }

    return { beats, downbeats };
  }

  /**
   * Detect song sections using energy analysis
   * @returns Array of detected sections
   */
  private async detectSections(): Promise<PreAnalysisResult['sections']> {
    if (!this.audioBuffer) {
      return [];
    }

    const sections: PreAnalysisResult['sections'] = [];
    const duration = this.audioBuffer.duration;
    const windowSize = 2; // 2 second windows
    const hopSize = 0.5; // 0.5 second hop

    // Analyze energy in windows
    const energyProfile: number[] = [];
    const channelData = this.audioBuffer.getChannelData(0);
    const sampleRate = this.audioBuffer.sampleRate;

    for (let t = 0; t < duration - windowSize; t += hopSize) {
      const startSample = Math.floor(t * sampleRate);
      const endSample = Math.floor((t + windowSize) * sampleRate);

      let energy = 0;
      for (let i = startSample; i < endSample && i < channelData.length; i++) {
        energy += channelData[i] * channelData[i];
      }
      energy = Math.sqrt(energy / (endSample - startSample));
      energyProfile.push(energy);
    }

    // Normalize energy
    const maxEnergy = Math.max(...energyProfile);
    const normalizedEnergy = energyProfile.map(e => e / maxEnergy);

    // Detect sections based on energy patterns
    let currentSection: PreAnalysisResult['sections'][0] | null = null;
    let _sectionStartTime = 0; // Track section start (prefixed to avoid unused warning)

    for (let i = 0; i < normalizedEnergy.length; i++) {
      const time = i * hopSize;
      const energy = normalizedEnergy[i];
      const position = time / duration;

      let sectionType: PreAnalysisResult['sections'][0]['type'] | null = null;

      // Determine section type based on position and energy
      if (position < 0.1) {
        sectionType = 'intro';
      } else if (position > 0.9) {
        sectionType = 'outro';
      } else if (energy > 0.7) {
        // High energy - chorus or drop
        if (i > 0 && normalizedEnergy[i - 1] < 0.5) {
          sectionType = 'drop'; // Sudden energy increase
        } else {
          sectionType = 'chorus';
        }
      } else if (energy < 0.3) {
        sectionType = 'breakdown';
      } else {
        sectionType = 'verse';
      }

      // Check for section change
      if (!currentSection || currentSection.type !== sectionType) {
        // Save previous section
        if (currentSection) {
          currentSection.end = time;
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          start: time,
          end: duration, // Will be updated
          type: sectionType,
          energy
        };
        _sectionStartTime = time;
      }
    }

    // Add final section
    if (currentSection) {
      currentSection.end = duration;
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Calculate average energy of the track
   * @returns Average energy (0-1)
   */
  private calculateAverageEnergy(): number {
    if (!this.audioBuffer) {
      return 0.5;
    }

    const channelData = this.audioBuffer.getChannelData(0);
    let energy = 0;

    for (let i = 0; i < channelData.length; i++) {
      energy += channelData[i] * channelData[i];
    }

    return Math.sqrt(energy / channelData.length);
  }

  /**
   * Setup Tone.js player
   * @param arrayBuffer - Audio data
   */
  private async setupPlayer(arrayBuffer: ArrayBuffer): Promise<void> {
    // Create a blob URL for Tone.js with correct MIME type
    console.log('Setting up Tone.js player with MIME type:', this.audioMimeType);
    const blob = new Blob([arrayBuffer], { type: this.audioMimeType });
    const url = URL.createObjectURL(blob);

    try {
      // Create Tone.js player
      this.player = new Tone.Player(url).toDestination();
      await this.player.load(url);
      console.log('Tone.js player loaded successfully');
    } catch (error) {
      console.error('Failed to setup Tone.js player:', error);
      throw error;
    }
  }

  /**
   * Setup real-time analyser
   */
  private setupAnalyser(): void {
    if (!this.player) {
      return;
    }

    // Create analyser node
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;

    // Initialize FFT data arrays
    this.fftData = new Float32Array(this.analyser.frequencyBinCount) as Float32Array<ArrayBuffer>;
    this.previousSpectrum = new Float32Array(this.analyser.frequencyBinCount);

    // Connect Tone.js to analyser
    Tone.connect(this.player, this.analyser);
  }

  /**
   * Get current frame with enhanced analysis
   * @returns Enhanced audio frame
   */
  getCurrentFrame(): EnhancedAudioFrame {
    const timestamp = this.getCurrentTime() * 1000; // Convert to ms

    // Get beat information
    let beatInfo = {
      isBeat: false,
      isDownbeat: false,
      beatNumber: 0,
      barNumber: 0,
      beatPhase: 0
    };

    if (this.beatGrid) {
      const gridInfo = this.beatGrid.getBeatAt(timestamp / 1000);
      beatInfo = {
        isBeat: gridInfo.phase < 0.1, // Near beat start
        isDownbeat: gridInfo.isDownbeat && gridInfo.phase < 0.1,
        beatNumber: gridInfo.beat,
        barNumber: this.beatGrid.getBarAt(timestamp / 1000),
        beatPhase: gridInfo.phase
      };

      // Trigger beat callbacks
      if (beatInfo.isBeat && this.beatCallbacks.size > 0) {
        this.beatCallbacks.forEach(cb => cb(beatInfo.beatNumber, beatInfo.isDownbeat));
      }
    }

    // Get frequency bands
    const bands = this.getFrequencyBands();

    // Get spectral features
    const spectralFeatures = this.getSpectralFeatures();

    // Get current section
    let currentSection: PreAnalysisResult['sections'][0] | undefined;
    if (this.preAnalysis) {
      for (let i = 0; i < this.preAnalysis.sections.length; i++) {
        const section = this.preAnalysis.sections[i];
        if (timestamp / 1000 >= section.start && timestamp / 1000 < section.end) {
          currentSection = section;

          // Trigger section callback if changed
          if (i !== this.currentSectionIndex) {
            this.currentSectionIndex = i;
            this.sectionCallbacks.forEach(cb => cb(section));
          }
          break;
        }
      }
    }

    // Get cues to fire
    const cues = this.cueScheduler ? this.cueScheduler.update(timestamp / 1000) : [];

    // Calculate overall energy
    const energy = (bands.sub + bands.bass * 2 + bands.lowMid + bands.mid + bands.highMid * 0.5 + bands.high * 0.3) / 6;

    return {
      timestamp,
      // Beat information
      isBeat: beatInfo.isBeat,
      isDownbeat: beatInfo.isDownbeat,
      beatNumber: beatInfo.beatNumber,
      barNumber: beatInfo.barNumber,
      beatPhase: beatInfo.beatPhase,
      tempo: this.preAnalysis?.bpm || 120,
      // Energy
      rms: spectralFeatures.rms,
      energy,
      peak: spectralFeatures.peak,
      // Frequency bands
      sub: bands.sub,
      bass: bands.bass,
      lowMid: bands.lowMid,
      mid: bands.mid,
      highMid: bands.highMid,
      high: bands.high,
      // Spectral features
      spectralCentroid: spectralFeatures.centroid,
      spectralFlux: spectralFeatures.flux,
      spectralRolloff: spectralFeatures.rolloff,
      // Section
      section: currentSection,
      // Cues
      cues
    };
  }

  /**
   * Get frequency bands with musical meaning
   * @returns Normalized frequency band levels
   */
  getFrequencyBands(): {
    sub: number;
    bass: number;
    lowMid: number;
    mid: number;
    highMid: number;
    high: number;
  } {
    if (!this.analyser || !this.fftData) {
      return { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0 };
    }

    // Get frequency data
    this.analyser.getFloatFrequencyData(this.fftData);

    // Calculate frequency resolution
    const nyquist = this.audioContext.sampleRate / 2;
    const binHz = nyquist / this.fftData.length;

    // Define band boundaries in Hz
    const bands = {
      sub: { min: 20, max: 60 },
      bass: { min: 60, max: 250 },
      lowMid: { min: 250, max: 500 },
      mid: { min: 500, max: 2000 },
      highMid: { min: 2000, max: 6000 },
      high: { min: 6000, max: 20000 }
    };

    // Calculate band energies
    const result: any = {};

    for (const [name, range] of Object.entries(bands)) {
      const minBin = Math.floor(range.min / binHz);
      const maxBin = Math.ceil(range.max / binHz);

      let sum = 0;
      let count = 0;

      for (let i = minBin; i < maxBin && i < this.fftData.length; i++) {
        // Convert from dB to linear
        const linear = Math.pow(10, this.fftData[i] / 20);
        sum += linear;
        count++;
      }

      // Normalize (rough approximation, adjust as needed)
      result[name] = count > 0 ? Math.min(1, Math.max(0, sum / count * 100)) : 0;
    }

    return result;
  }

  /**
   * Get spectral features
   * @returns Spectral analysis features
   */
  private getSpectralFeatures(): {
    rms: number;
    peak: number;
    centroid: number;
    flux: number;
    rolloff: number;
  } {
    if (!this.analyser || !this.fftData) {
      return { rms: 0, peak: 0, centroid: 0, flux: 0, rolloff: 0 };
    }

    // Get time domain data for RMS and peak
    const timeData = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(timeData);

    // Calculate RMS and peak
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < timeData.length; i++) {
      const abs = Math.abs(timeData[i]);
      sum += abs * abs;
      peak = Math.max(peak, abs);
    }
    const rms = Math.sqrt(sum / timeData.length);

    // Get frequency data
    this.analyser.getFloatFrequencyData(this.fftData);

    // Calculate spectral centroid
    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let i = 0; i < this.fftData.length; i++) {
      const magnitude = Math.pow(10, this.fftData[i] / 20);
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }
    const centroid = magnitudeSum > 0 ? (weightedSum / magnitudeSum) / this.fftData.length : 0;

    // Calculate spectral flux
    let flux = 0;
    if (this.previousSpectrum) {
      for (let i = 0; i < this.fftData.length; i++) {
        const diff = this.fftData[i] - this.previousSpectrum[i];
        if (diff > 0) {
          flux += diff;
        }
      }
      flux /= this.fftData.length;
    }
    this.previousSpectrum = new Float32Array(this.fftData);

    // Calculate spectral rolloff (frequency below which 85% of energy is contained)
    let cumulativeEnergy = 0;
    const totalEnergy = magnitudeSum;
    let rolloff = 0;
    for (let i = 0; i < this.fftData.length; i++) {
      cumulativeEnergy += Math.pow(10, this.fftData[i] / 20);
      if (cumulativeEnergy >= totalEnergy * 0.85) {
        rolloff = i / this.fftData.length;
        break;
      }
    }

    return { rms, peak, centroid, flux: Math.min(1, flux), rolloff };
  }

  /**
   * Get current beat number
   * @returns Current beat number
   */
  getCurrentBeat(): number {
    if (!this.beatGrid) {
      return 0;
    }
    return this.beatGrid.getBeatAt(this.getCurrentTime()).beat;
  }

  /**
   * Get current bar number
   * @returns Current bar number
   */
  getCurrentBar(): number {
    if (!this.beatGrid) {
      return 0;
    }
    return this.beatGrid.getBarAt(this.getCurrentTime());
  }

  /**
   * Get beat phase (position within current beat)
   * @returns Beat phase (0-1)
   */
  getBeatPhase(): number {
    if (!this.beatGrid) {
      return 0;
    }
    return this.beatGrid.getBeatAt(this.getCurrentTime()).phase;
  }

  /**
   * Start playback
   */
  play(): void {
    if (!this.player || this.isPlaying) {
      return;
    }

    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Start Tone.js player
    this.player.start(undefined, this.pauseTime);
    this.startTime = Tone.now() - this.pauseTime;
    this.isPlaying = true;

    // Reset cue scheduler
    if (this.cueScheduler) {
      this.cueScheduler.reset();
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.player || !this.isPlaying) {
      return;
    }

    this.pauseTime = this.getCurrentTime();
    this.player.stop();
    this.isPlaying = false;
  }

  /**
   * Stop playback
   */
  stop(): void {
    if (!this.player) {
      return;
    }

    this.player.stop();
    this.isPlaying = false;
    this.pauseTime = 0;
    this.startTime = 0;
    this.currentSectionIndex = -1;

    if (this.cueScheduler) {
      this.cueScheduler.reset();
    }
  }

  /**
   * Seek to a specific time
   * @param time - Time in seconds
   */
  seek(time: number): void {
    const wasPlaying = this.isPlaying;

    if (wasPlaying) {
      this.pause();
    }

    this.pauseTime = Math.max(0, Math.min(time, this.getDuration()));

    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Get current playback time in seconds
   * @returns Current time in seconds
   */
  private getCurrentTime(): number {
    if (!this.isPlaying) {
      return this.pauseTime;
    }
    return Tone.now() - this.startTime;
  }

  /**
   * Get total duration in seconds
   * @returns Duration in seconds
   */
  private getDuration(): number {
    if (!this.audioBuffer) {
      return 0;
    }
    return this.audioBuffer.duration;
  }

  /**
   * Subscribe to beat events
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  onBeat(callback: (beatNumber: number, isDownbeat: boolean) => void): () => void {
    this.beatCallbacks.add(callback);
    return () => {
      this.beatCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to section change events
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  onSection(callback: (section: PreAnalysisResult['sections'][0]) => void): () => void {
    this.sectionCallbacks.add(callback);
    return () => {
      this.sectionCallbacks.delete(callback);
    };
  }

  /**
   * Get the cue scheduler
   * @returns The cue scheduler instance
   */
  getCueScheduler(): CueScheduler | null {
    return this.cueScheduler;
  }

  /**
   * Get pre-analysis results
   * @returns Pre-analysis results or null
   */
  getPreAnalysis(): PreAnalysisResult | null {
    return this.preAnalysis;
  }

  /**
   * Check if currently playing
   * @returns True if playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop();

    if (this.player) {
      this.player.dispose();
    }

    if (this.meydaAnalyzer) {
      this.meydaAnalyzer.stop();
    }

    this.beatCallbacks.clear();
    this.sectionCallbacks.clear();

    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}