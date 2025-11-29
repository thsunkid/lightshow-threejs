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
 * Main application class
 */
class LightshowApp {
  private audioAnalyzer: AudioAnalyzer | null = null;
  private stage!: Stage;
  private mappingEngine!: MappingEngine;
  private isPlaying = false;
  private currentTimeDisplay: HTMLElement | null = null;

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
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');

    playBtn?.addEventListener('click', () => this.play());
    pauseBtn?.addEventListener('click', () => this.pause());
    stopBtn?.addEventListener('click', () => this.stop());

    // Add a time display element
    const controls = document.getElementById('controls');
    if (controls) {
      const timeDisplay = document.createElement('div');
      timeDisplay.id = 'time-display';
      timeDisplay.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 10px 20px;
        border-radius: 4px;
        min-width: 120px;
        text-align: center;
        font-family: monospace;
      `;
      timeDisplay.textContent = '00:00 / 00:00';
      controls.appendChild(timeDisplay);
      this.currentTimeDisplay = timeDisplay;
    }
  }

  private setupDragAndDrop(): void {
    const dropZone = document.getElementById('drop-zone');
    const audioInput = document.getElementById('audio-input') as HTMLInputElement;

    if (!dropZone || !audioInput) return;

    dropZone.addEventListener('click', () => audioInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'rgba(255, 255, 255, 0.8)';
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'rgba(255, 255, 255, 0.3)';
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

  private async loadAudio(file: File): Promise<void> {
    console.log(`Loading audio file: ${file.name}`);
    const dropZone = document.getElementById('drop-zone');
    dropZone?.classList.add('hidden');

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

      // Set up frame callback to process audio and drive lights
      this.audioAnalyzer.onFrame((frame: AudioFrame) => {
        // Process audio frame through mapping engine
        const commands: LightingCommand[] = this.mappingEngine.process(frame);

        // Execute commands on stage
        if (commands.length > 0) {
          this.stage.executeCommands(commands);
        }

        // Update time display
        this.updateTimeDisplay();
      });

      // Update display to show file is loaded
      this.updateTimeDisplay();

    } catch (error) {
      console.error('Failed to load audio file:', error);
      alert('Failed to load audio file. Please try another file.');
      dropZone?.classList.remove('hidden');
    }
  }

  private updateTimeDisplay(): void {
    if (!this.currentTimeDisplay || !this.audioAnalyzer) return;

    const currentTime = this.audioAnalyzer.getCurrentTime();
    const duration = this.audioAnalyzer.getDuration();

    const formatTime = (ms: number): string => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
        .toString()
        .padStart(2, '0')}`;
    };

    this.currentTimeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(
      duration
    )}`;
  }

  private play(): void {
    if (!this.audioAnalyzer) {
      console.warn('No audio loaded. Please load an audio file first.');
      return;
    }

    if (this.isPlaying) return;

    this.isPlaying = true;
    console.log('Playing...');

    // Start audio playback
    this.audioAnalyzer.play();
  }

  private pause(): void {
    if (!this.audioAnalyzer) return;

    this.isPlaying = false;
    console.log('Paused');

    // Pause audio
    this.audioAnalyzer.pause();
  }

  private stop(): void {
    if (!this.audioAnalyzer) return;

    this.isPlaying = false;
    console.log('Stopped');

    // Stop audio and reset
    this.audioAnalyzer.stop();

    // Update time display to show reset
    this.updateTimeDisplay();

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

}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LightshowApp();
});
