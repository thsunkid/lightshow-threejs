/**
 * Lightshow Generator - Main Entry Point
 *
 * This file wires together all workstreams:
 * - Audio Analysis (Workstream A)
 * - Stage/Lighting (Workstream B)
 * - Style Learning (Workstream C)
 * - Mapping Engine (Workstream D)
 */

// Import from each workstream
import { AdvancedAnalyzer, EnhancedAudioFrame } from '@audio/AdvancedAnalyzer';
import { AnalysisCache } from '@audio/AnalysisCache';
import { Stage } from '@stage/Stage';
// import { StyleLearner } from '@style/StyleLearner';
import { MappingEngine } from '@mapping/MappingEngine';

import type { LightingCommand } from '@shared/types';

console.log('Lightshow Generator initializing...');

/**
 * Track metadata interface
 */
interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  artwork: string | null;
  duration: number;
}

/**
 * Main application class
 */
class LightshowApp {
  private advancedAnalyzer: AdvancedAnalyzer | null = null;
  private analysisCache: AnalysisCache;
  private stage!: Stage;
  private mappingEngine!: MappingEngine;
  private isPlaying = false;
  private progressInterval: number | null = null;
  private isDragging = false;
  private animationFrameId: number | null = null;

  // UI Elements
  private playPauseBtn!: HTMLButtonElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private currentTimeEl!: HTMLElement;
  private totalTimeEl!: HTMLElement;
  private progressBar!: HTMLElement;
  private progressHandle!: HTMLElement;
  private progressBg!: HTMLElement;
  private trackTitleEl!: HTMLElement;
  private trackArtistEl!: HTMLElement;
  private albumArtEl!: HTMLElement;
  private volumeBar!: HTMLElement;
  private volumeSlider!: HTMLElement;
  private dropZone!: HTMLElement;
  private loadingOverlay!: HTMLElement;
  private loadingStage!: HTMLElement;
  private loadingProgress!: HTMLElement;
  private loadingPercent!: HTMLElement;

  constructor() {
    this.analysisCache = new AnalysisCache();
    this.setupStage();
    this.setupMappingEngine();
    this.setupUI();
    this.setupDragAndDrop();
    console.log('Lightshow app ready. Drop an audio file to begin.');
  }

  private setupStage(): void {
    const container = document.getElementById('canvas-container');
    if (!container) {
      console.error('Canvas container not found');
      return;
    }

    this.stage = new Stage(container, {
      hazeDensity: 0.3,
      ambientLight: 0.05,
    });
    this.stage.init();
    this.stage.start();

    // Make stage available globally for debugging
    (window as any).stage = this.stage;
  }

  private setupMappingEngine(): void {
    this.mappingEngine = new MappingEngine({
      intensityScale: 1.0,
      reactivity: 0.7,
      beatSync: true,
      strobeMinInterval: 100,
    });

    // Register fixtures with the mapping engine
    const fixtures = this.stage.getAllFixtures();
    this.mappingEngine.registerFixtures(fixtures);
  }

  private setupUI(): void {
    // Get UI elements
    this.playPauseBtn = document.getElementById('play-pause-btn') as HTMLButtonElement;
    this.prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
    this.nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
    this.currentTimeEl = document.getElementById('current-time')!;
    this.totalTimeEl = document.getElementById('total-time')!;
    this.progressBar = document.getElementById('progress-bar')!;
    this.progressHandle = document.getElementById('progress-handle')!;
    this.progressBg = document.getElementById('progress-bar-bg')!;
    this.trackTitleEl = document.getElementById('track-title')!;
    this.trackArtistEl = document.getElementById('track-artist')!;
    this.albumArtEl = document.getElementById('album-art')!;
    this.volumeBar = document.getElementById('volume-bar')!;
    this.volumeSlider = document.getElementById('volume-slider')!;
    this.dropZone = document.getElementById('drop-zone')!;
    this.loadingOverlay = document.getElementById('loading-overlay')!;
    this.loadingStage = document.getElementById('loading-stage')!;
    this.loadingProgress = document.getElementById('loading-progress')!;
    this.loadingPercent = document.getElementById('loading-percent')!;

    // Setup button handlers
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.prevBtn.addEventListener('click', () => this.previous());
    this.nextBtn.addEventListener('click', () => this.next());

    // Setup progress bar click to seek
    this.progressBg.addEventListener('click', (e) => this.handleProgressClick(e));

    // Setup progress bar drag
    this.progressBg.addEventListener('mousedown', (e) => this.startDrag(e));

    // Setup volume control
    this.volumeSlider.addEventListener('click', (e) => this.handleVolumeClick(e));
  }

  private setupDragAndDrop(): void {
    const audioInput = document.getElementById('audio-input') as HTMLInputElement;

    if (!this.dropZone || !audioInput) return;

    this.dropZone.addEventListener('click', () => audioInput.click());

    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('dragging');
    });

    this.dropZone.addEventListener('dragleave', () => {
      this.dropZone.classList.remove('dragging');
    });

    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('dragging');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.loadAudio(files[0]);
      }
    });

    audioInput.addEventListener('change', () => {
      if (audioInput.files && audioInput.files.length > 0) {
        this.loadAudio(audioInput.files[0]);
      }
    });
  }

  /**
   * Extract metadata from audio file using jsmediatags
   */
  private extractMetadata(file: File): Promise<TrackMetadata> {
    return new Promise((resolve) => {
      // Check if jsmediatags is available
      const jsmediatags = (window as any).jsmediatags;

      if (!jsmediatags) {
        console.warn('jsmediatags not loaded, using fallback');
        resolve({
          title: file.name.replace(/\.[^/.]+$/, ''),
          artist: 'Unknown Artist',
          album: '',
          artwork: null,
          duration: 0
        });
        return;
      }

      jsmediatags.read(file, {
        onSuccess: (tag: any) => {
          const { title, artist, album, picture } = tag.tags;

          let artwork = null;
          if (picture) {
            // Convert picture data to base64 data URL
            const base64String = btoa(
              picture.data.reduce((data: string, byte: number) => data + String.fromCharCode(byte), '')
            );
            artwork = `data:${picture.format};base64,${base64String}`;
          }

          resolve({
            title: title || file.name.replace(/\.[^/.]+$/, ''),
            artist: artist || 'Unknown Artist',
            album: album || '',
            artwork,
            duration: 0
          });
        },
        onError: (error: any) => {
          console.warn('Error reading tags:', error);
          resolve({
            title: file.name.replace(/\.[^/.]+$/, ''),
            artist: 'Unknown Artist',
            album: '',
            artwork: null,
            duration: 0
          });
        }
      });
    });
  }

  private async loadAudio(file: File): Promise<void> {
    console.log(`Loading audio file: ${file.name}`);

    // Extract metadata first
    const metadata = await this.extractMetadata(file);

    // Update UI with metadata
    this.updateTrackInfo(metadata);

    // Hide drop zone, show loading overlay
    this.dropZone.classList.add('hidden');
    this.showLoadingOverlay();

    try {
      // Initialize AdvancedAnalyzer if not already created
      if (!this.advancedAnalyzer) {
        this.advancedAnalyzer = new AdvancedAnalyzer({
          fftSize: 2048,
          enableCueGeneration: true,
        });
      }

      // Check cache first
      console.log('Checking analysis cache...');
      let preAnalysis = await this.analysisCache.get(file);

      if (preAnalysis) {
        console.log('Using cached analysis!');
        // Load audio without analysis (just for playback)
        await this.advancedAnalyzer.loadAndAnalyze(file, (stage, progress) => {
          this.updateLoadingProgress(stage, progress);
        });
      } else {
        console.log('No cache found, performing full analysis...');
        // Perform full analysis with progress updates
        preAnalysis = await this.advancedAnalyzer.loadAndAnalyze(file, (stage, progress) => {
          this.updateLoadingProgress(stage, progress);
        });

        // Cache the results
        console.log('Saving analysis to cache...');
        await this.analysisCache.set(file, preAnalysis);
      }

      console.log('Pre-analysis complete:', {
        bpm: preAnalysis.bpm,
        beats: preAnalysis.beats.length,
        sections: preAnalysis.sections.length
      });

      // Update duration
      const duration = this.advancedAnalyzer.getPreAnalysis()?.beats[preAnalysis.beats.length - 1] || 0;
      this.totalTimeEl.textContent = this.formatTime(duration);

      // Hide loading overlay
      this.hideLoadingOverlay();

      // Start animation loop for frame updates
      this.startAnimationLoop();

      // Update display
      this.updateProgress();

    } catch (error) {
      console.error('Failed to load audio file:', error);
      alert('Failed to load audio file. Please try another file.');
      this.dropZone.classList.remove('hidden');
      this.hideLoadingOverlay();
    }
  }

  /**
   * Show loading overlay
   */
  private showLoadingOverlay(): void {
    this.loadingOverlay.classList.remove('hidden');
    this.updateLoadingProgress('loading', 0);
  }

  /**
   * Hide loading overlay
   */
  private hideLoadingOverlay(): void {
    this.loadingOverlay.classList.add('hidden');
  }

  /**
   * Update loading progress
   */
  private updateLoadingProgress(stage: string, progress: number): void {
    // Map stage names to user-friendly text
    const stageNames: Record<string, string> = {
      'decoding': 'Decoding audio',
      'bpm': 'Detecting tempo',
      'beats': 'Analyzing beats',
      'sections': 'Detecting sections',
      'finalizing': 'Finalizing',
      'loading': 'Loading'
    };

    this.loadingStage.textContent = stageNames[stage] || 'Analyzing audio';
    this.loadingProgress.style.width = `${progress}%`;
    this.loadingPercent.textContent = `${Math.round(progress)}%`;
  }

  /**
   * Start animation loop for frame updates
   */
  private startAnimationLoop(): void {
    if (!this.advancedAnalyzer) return;

    let frameCount = 0;
    const updateFrame = () => {
      if (!this.advancedAnalyzer || !this.advancedAnalyzer.getIsPlaying()) {
        return;
      }

      frameCount++;

      // Get enhanced audio frame
      const frame: EnhancedAudioFrame = this.advancedAnalyzer.getCurrentFrame();

      // Debug: Log every 60th frame (~1 per second at 60fps)
      if (frameCount % 60 === 0) {
        console.log('Enhanced Audio Frame:', {
          rms: frame.rms.toFixed(3),
          energy: frame.energy.toFixed(3),
          isBeat: frame.isBeat,
          isDownbeat: frame.isDownbeat,
          beatNumber: frame.beatNumber,
          tempo: frame.tempo,
          bass: frame.bass.toFixed(3),
          mid: frame.mid.toFixed(3),
          high: frame.high.toFixed(3),
          section: frame.section?.type,
          cues: frame.cues.length
        });
      }

      // Convert EnhancedAudioFrame to AudioFrame for mapping engine
      // (Mapping engine expects the old AudioFrame format)
      const legacyFrame = {
        timestamp: frame.timestamp,
        isBeat: frame.isBeat,
        isDownbeat: frame.isDownbeat,
        tempo: frame.tempo,
        beatPhase: frame.beatPhase,
        beatNumber: frame.beatNumber,
        rms: frame.rms,
        energy: frame.energy,
        peak: frame.peak,
        spectralCentroid: frame.spectralCentroid,
        spectralFlux: frame.spectralFlux,
        lowEnergy: frame.bass,
        midEnergy: frame.mid,
        highEnergy: frame.high,
        section: frame.section?.type || 'verse',
        sectionConfidence: 0.8
      };

      // Process audio frame through mapping engine
      const commands: LightingCommand[] = this.mappingEngine.process(legacyFrame as any);

      // Debug: Log commands on beats
      if (frame.isBeat && commands.length > 0) {
        console.log(`BEAT ${frame.beatNumber}! Generated ${commands.length} commands`);
      }

      // Debug: Log cues
      if (frame.cues.length > 0) {
        console.log(`Firing ${frame.cues.length} cues:`, frame.cues.map(c => c.action));
      }

      // Execute commands on stage
      if (commands.length > 0) {
        this.stage.executeCommands(commands);
      }

      // Update flake lights based on audio
      this.stage.updateFlakeLights(legacyFrame as any);

      this.animationFrameId = requestAnimationFrame(updateFrame);
    };

    updateFrame();
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
   * Update track info in UI
   */
  private updateTrackInfo(metadata: TrackMetadata): void {
    this.trackTitleEl.textContent = metadata.title;
    this.trackArtistEl.textContent = metadata.artist || '';

    if (metadata.artwork) {
      this.albumArtEl.innerHTML = `<img src="${metadata.artwork}" alt="Album Art" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">`;
      this.albumArtEl.classList.remove('placeholder');
    } else {
      this.albumArtEl.innerHTML = '';
      this.albumArtEl.classList.add('placeholder');
    }
  }

  /**
   * Format time from seconds to MM:SS
   */
  private formatTime(seconds: number): string {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Update progress display (called once to set initial state)
   */
  private updateProgress(): void {
    if (!this.advancedAnalyzer) return;

    const preAnalysis = this.advancedAnalyzer.getPreAnalysis();
    if (!preAnalysis) return;

    const currentTime = 0; // Start at 0
    const duration = preAnalysis.beats[preAnalysis.beats.length - 1];

    this.updateProgressUI(currentTime, duration);
  }

  /**
   * Start continuous progress updates using setInterval (more reliable than RAF)
   */
  private startProgressUpdates(): void {
    // Clear any existing interval
    this.stopProgressUpdates();

    // Update every 50ms for smooth progress
    this.progressInterval = window.setInterval(() => {
      if (!this.advancedAnalyzer || this.isDragging) return;

      const preAnalysis = this.advancedAnalyzer.getPreAnalysis();
      if (!preAnalysis) return;

      const currentFrame = this.advancedAnalyzer.getCurrentFrame();
      const currentTime = currentFrame.timestamp / 1000;
      const duration = preAnalysis.beats[preAnalysis.beats.length - 1];

      this.updateProgressUI(currentTime, duration);
    }, 50);
  }

  /**
   * Stop progress updates
   */
  private stopProgressUpdates(): void {
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Update progress UI elements
   */
  private updateProgressUI(currentTimeSeconds: number, durationSeconds: number): void {
    // Update time displays
    this.currentTimeEl.textContent = this.formatTime(currentTimeSeconds);
    this.totalTimeEl.textContent = this.formatTime(durationSeconds);

    // Update progress bar
    if (durationSeconds > 0 && !this.isDragging) {
      const progress = (currentTimeSeconds / durationSeconds) * 100;
      this.progressBar.style.width = `${progress}%`;
      this.progressHandle.style.left = `${progress}%`;
    }
  }

  /**
   * Handle progress bar click to seek
   */
  private handleProgressClick(e: MouseEvent): void {
    if (!this.advancedAnalyzer) return;

    const preAnalysis = this.advancedAnalyzer.getPreAnalysis();
    if (!preAnalysis) return;

    const rect = this.progressBg.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const duration = preAnalysis.beats[preAnalysis.beats.length - 1];
    const seekTime = percent * duration;

    this.advancedAnalyzer.seek(seekTime);
    this.updateProgress();
  }

  /**
   * Handle dragging on progress bar
   */
  private startDrag(_e: MouseEvent): void {
    if (!this.advancedAnalyzer) return;

    const preAnalysis = this.advancedAnalyzer.getPreAnalysis();
    if (!preAnalysis) return;

    this.isDragging = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;

      const rect = this.progressBg.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

      // Update visual position immediately
      this.progressBar.style.width = `${percent * 100}%`;
      this.progressHandle.style.left = `${percent * 100}%`;

      // Update time display
      const duration = preAnalysis!.beats[preAnalysis!.beats.length - 1];
      this.currentTimeEl.textContent = this.formatTime(percent * duration);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      // Perform the actual seek
      const rect = this.progressBg.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const duration = preAnalysis!.beats[preAnalysis!.beats.length - 1];
      const seekTime = percent * duration;

      this.advancedAnalyzer!.seek(seekTime);

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * Handle volume slider click
   */
  private handleVolumeClick(e: MouseEvent): void {
    const rect = this.volumeSlider.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const volume = Math.max(0, Math.min(1, percent));

    this.volumeBar.style.width = `${volume * 100}%`;

    // TODO: Actually set volume on audio context
    // if (this.audioAnalyzer) {
    //   this.audioAnalyzer.setVolume(volume);
    // }
  }

  /**
   * Toggle play/pause
   */
  private togglePlayPause(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  private async play(): Promise<void> {
    if (!this.advancedAnalyzer) {
      console.warn('No audio loaded. Please load an audio file first.');
      return;
    }

    if (this.isPlaying) return;

    this.isPlaying = true;
    this.playPauseBtn.innerHTML = '❚❚';

    // Start audio playback
    this.advancedAnalyzer.play();

    // Start continuous progress updates
    this.startProgressUpdates();

    // Start animation loop
    this.startAnimationLoop();
  }

  private pause(): void {
    if (!this.advancedAnalyzer) return;

    this.isPlaying = false;
    this.playPauseBtn.innerHTML = '▶';
    console.log('Paused');

    // Pause audio
    this.advancedAnalyzer.pause();

    // Stop progress updates
    this.stopProgressUpdates();

    // Stop animation loop
    this.stopAnimationLoop();

    // Update progress one more time to show paused position
    this.updateProgress();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private stop(): void {
    if (!this.advancedAnalyzer) return;

    this.isPlaying = false;
    this.playPauseBtn.innerHTML = '▶';
    console.log('Stopped');

    // Stop audio and reset
    this.advancedAnalyzer.stop();

    // Stop progress updates
    this.stopProgressUpdates();

    // Stop animation loop
    this.stopAnimationLoop();

    // Update time display to show reset
    this.updateProgress();

    // Reset all lights to default state
    this.stage.executeCommands([{
      targetId: 'all',
      updates: {
        intensity: 0,
        color: { r: 0, g: 0, b: 0 }
      },
      transitionMs: 500,
      easing: 'easeOut',
    }]);
  }

  /**
   * Previous track (placeholder)
   */
  private previous(): void {
    console.log('Previous track - not implemented');
    // Could restart current track or load previous from playlist
    if (this.advancedAnalyzer) {
      this.advancedAnalyzer.seek(0);
      this.updateProgress();
    }
  }

  /**
   * Next track (placeholder)
   */
  private next(): void {
    console.log('Next track - not implemented');
    // Could load next track from playlist
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LightshowApp();
});