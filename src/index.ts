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
// Uncomment as workstreams are completed:
// import { AudioAnalyzer } from '@audio/AudioAnalyzer';
// import { Stage } from '@stage/Stage';
// import { StyleLearner } from '@style/StyleLearner';
// import { MappingEngine } from '@mapping/MappingEngine';

import type { AudioFrame, LightingCommand } from '@shared/types';

console.log('Lightshow Generator initializing...');

/**
 * Main application class
 */
class LightshowApp {
  // private audioAnalyzer: AudioAnalyzer;
  // private stage: Stage;
  // private mappingEngine: MappingEngine;
  private isPlaying = false;

  constructor() {
    this.setupUI();
    this.setupDragAndDrop();
    console.log('Lightshow app ready. Drop an audio file to begin.');
  }

  private setupUI(): void {
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');

    playBtn?.addEventListener('click', () => this.play());
    pauseBtn?.addEventListener('click', () => this.pause());
    stopBtn?.addEventListener('click', () => this.stop());
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

    // TODO: Initialize AudioAnalyzer with the file
    // this.audioAnalyzer = new AudioAnalyzer();
    // await this.audioAnalyzer.loadFile(file);
  }

  private play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    console.log('Playing...');
    // TODO: Start audio playback and analysis
    // this.audioAnalyzer.play();
    // this.startRenderLoop();
  }

  private pause(): void {
    this.isPlaying = false;
    console.log('Paused');
    // TODO: Pause audio
    // this.audioAnalyzer.pause();
  }

  private stop(): void {
    this.isPlaying = false;
    console.log('Stopped');
    // TODO: Stop audio and reset
    // this.audioAnalyzer.stop();
  }

  /**
   * Main render/update loop
   * Called on each animation frame when playing
   */
  private update(): void {
    if (!this.isPlaying) return;

    // 1. Get current audio frame from analyzer
    // const frame: AudioFrame = this.audioAnalyzer.getCurrentFrame();

    // 2. Pass through mapping engine to generate commands
    // const commands: LightingCommand[] = this.mappingEngine.process(frame);

    // 3. Execute commands on stage
    // this.stage.executeCommands(commands);

    // 4. Render the stage
    // this.stage.render();

    requestAnimationFrame(() => this.update());
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LightshowApp();
});
