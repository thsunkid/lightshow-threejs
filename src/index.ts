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
import { AudioAnalyzer } from '@audio/AudioAnalyzer';
import { Stage } from '@stage/Stage';
// import { StyleLearner } from '@style/StyleLearner';
import { MappingEngine } from '@mapping/MappingEngine';

import type { AudioFrame, LightingCommand } from '@shared/types';

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
  private audioAnalyzer: AudioAnalyzer | null = null;
  private stage!: Stage;
  private mappingEngine!: MappingEngine;
  private isPlaying = false;
  private progressInterval: number | null = null;
  private isDragging = false;
  private unsubscribeFrame: (() => void) | null = null;

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

  constructor() {
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
    console.log('Metadata extracted:', metadata);

    // Update UI with metadata
    this.updateTrackInfo(metadata);

    // Hide drop zone
    this.dropZone.classList.add('hidden');

    try {
      // Initialize AudioAnalyzer if not already created
      if (!this.audioAnalyzer) {
        this.audioAnalyzer = new AudioAnalyzer({
          fftSize: 2048,
          smoothingTimeConstant: 0.8,
          minTempo: 60,
          maxTempo: 200,
          detectBeats: true,
          detectSections: true,
        });
      }

      // Load the audio file
      await this.audioAnalyzer.loadFile(file);
      console.log(`Audio file loaded successfully: ${file.name}`);

      // Update duration once loaded
      const duration = this.audioAnalyzer.getDuration();
      this.totalTimeEl.textContent = this.formatTime(duration / 1000);

      // Unsubscribe from previous frame callback if any
      if (this.unsubscribeFrame) {
        this.unsubscribeFrame();
        this.unsubscribeFrame = null;
      }

      // Set up frame callback to process audio and drive lights
      let frameCount = 0;
      this.unsubscribeFrame = this.audioAnalyzer.onFrame((frame: AudioFrame) => {
        frameCount++;

        // Debug: Log every 60th frame (~1 per second at 60fps)
        if (frameCount % 60 === 0) {
          console.log('Audio Frame:', {
            rms: frame.rms.toFixed(3),
            energy: frame.energy.toFixed(3),
            isBeat: frame.isBeat,
            lowEnergy: frame.lowEnergy.toFixed(3),
            spectralCentroid: frame.spectralCentroid.toFixed(3),
          });
        }

        // Process audio frame through mapping engine
        const commands: LightingCommand[] = this.mappingEngine.process(frame);

        // Debug: Log commands on beats
        if (frame.isBeat && commands.length > 0) {
          console.log(`BEAT! Generated ${commands.length} commands`);
        }

        // Execute commands on stage
        if (commands.length > 0) {
          this.stage.executeCommands(commands);
        }

        // Update flake lights based on audio
        this.stage.updateFlakeLights(frame);
      });

      // Update display
      this.updateProgress();

    } catch (error) {
      console.error('Failed to load audio file:', error);
      alert('Failed to load audio file. Please try another file.');
      this.dropZone.classList.remove('hidden');
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
    if (!this.audioAnalyzer) return;

    const currentTime = this.audioAnalyzer.getCurrentTime() / 1000;
    const duration = this.audioAnalyzer.getDuration() / 1000;

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
      if (!this.audioAnalyzer || this.isDragging) return;

      const currentTime = this.audioAnalyzer.getCurrentTime() / 1000;
      const duration = this.audioAnalyzer.getDuration() / 1000;

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
    if (!this.audioAnalyzer) return;

    const rect = this.progressBg.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const duration = this.audioAnalyzer.getDuration();
    const seekTime = percent * duration;

    this.audioAnalyzer.seek(seekTime);
    this.updateProgress();
  }

  /**
   * Handle dragging on progress bar
   */
  private startDrag(_e: MouseEvent): void {
    if (!this.audioAnalyzer) return;

    this.isDragging = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;

      const rect = this.progressBg.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

      // Update visual position immediately
      this.progressBar.style.width = `${percent * 100}%`;
      this.progressHandle.style.left = `${percent * 100}%`;

      // Update time display
      const duration = this.audioAnalyzer!.getDuration() / 1000;
      this.currentTimeEl.textContent = this.formatTime(percent * duration);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      // Perform the actual seek
      const rect = this.progressBg.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const duration = this.audioAnalyzer!.getDuration();
      const seekTime = percent * duration;

      this.audioAnalyzer!.seek(seekTime);

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
    if (!this.audioAnalyzer) {
      console.warn('No audio loaded. Please load an audio file first.');
      return;
    }

    if (this.isPlaying) return;

    this.isPlaying = true;
    this.playPauseBtn.innerHTML = '❚❚';

    // Start audio playback (async to resume AudioContext if needed)
    await this.audioAnalyzer.play();

    // Start continuous progress updates
    this.startProgressUpdates();
  }

  private pause(): void {
    if (!this.audioAnalyzer) return;

    this.isPlaying = false;
    this.playPauseBtn.innerHTML = '▶';
    console.log('Paused');

    // Pause audio
    this.audioAnalyzer.pause();

    // Stop progress updates
    this.stopProgressUpdates();

    // Update progress one more time to show paused position
    this.updateProgress();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private stop(): void {
    if (!this.audioAnalyzer) return;

    this.isPlaying = false;
    this.playPauseBtn.innerHTML = '▶';
    console.log('Stopped');

    // Stop audio and reset
    this.audioAnalyzer.stop();

    // Stop progress updates
    this.stopProgressUpdates();

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
    if (this.audioAnalyzer) {
      this.audioAnalyzer.seek(0);
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