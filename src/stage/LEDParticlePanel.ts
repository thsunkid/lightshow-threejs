/**
 * LED Particle Panel - Audio-reactive particle system for the LED back panel
 * Based on curl noise particle system from Codrops
 */

/// <reference types="../vite-env.d.ts" />

import * as THREE from 'three';
import { AudioFrame, RGB } from '../shared/types';

// Import shaders as raw strings
import vertexShader from './shaders/ledParticle.vert?raw';
import fragmentShader from './shaders/ledParticle.frag?raw';

export interface LEDPanelConfig {
  width: number;        // Panel width
  height: number;       // Panel height
  particleCount: number; // Number of particles (1000-5000)
  warmColor: THREE.Color;   // Warm stripe color (amber/orange)
  coolColor: THREE.Color;   // Cool stripe color (white-blue)
}

/**
 * Lerp (linear interpolation) helper
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * LED Particle Panel class
 * Creates an audio-reactive particle system using curl noise for organic movement
 */
export class LEDParticlePanel {
  private config: LEDPanelConfig;
  private points!: THREE.Points;
  private geometry!: THREE.BufferGeometry;
  private material!: THREE.ShaderMaterial;
  private enabled: boolean = true;

  /**
   * Creates a new LED particle panel
   * @param config Panel configuration
   */
  constructor(config: LEDPanelConfig) {
    this.config = config;
    this.createParticleSystem();
  }

  /**
   * Creates the particle system with custom shaders
   */
  private createParticleSystem(): void {
    // Create geometry
    this.geometry = new THREE.BufferGeometry();

    const { particleCount, width, height } = this.config;

    // Create arrays for particle attributes
    const positions = new Float32Array(particleCount * 3);
    const originalPositions = new Float32Array(particleCount * 3);
    const targetPositions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);

    // Create a grid-like distribution with some randomness
    const cols = Math.ceil(Math.sqrt(particleCount * width / height));
    const rows = Math.ceil(particleCount / cols);
    const cellWidth = width / cols;
    const cellHeight = height / rows;

    for (let i = 0; i < particleCount; i++) {
      // Grid position with jitter
      const col = i % cols;
      const row = Math.floor(i / cols);

      // Base grid position
      let x = (col - cols / 2 + 0.5) * cellWidth;
      let y = (row - rows / 2 + 0.5) * cellHeight;

      // Add some randomness
      x += (Math.random() - 0.5) * cellWidth * 0.8;
      y += (Math.random() - 0.5) * cellHeight * 0.8;

      // Clamp to bounds
      x = Math.max(-width / 2 * 0.95, Math.min(width / 2 * 0.95, x));
      y = Math.max(-height / 2 * 0.95, Math.min(height / 2 * 0.95, y));

      const z = (Math.random() - 0.5) * 0.2;

      // Store original position
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      originalPositions[i * 3] = x;
      originalPositions[i * 3 + 1] = y;
      originalPositions[i * 3 + 2] = z;

      // Target position (Codrops-style) - particles move toward center when audio plays
      // Create a swirling/converging pattern
      const angle = Math.atan2(y, x);
      const dist = Math.sqrt(x * x + y * y);
      const targetDist = dist * 0.3; // Move toward center
      const targetAngle = angle + Math.PI * 0.2; // Slight rotation

      targetPositions[i * 3] = Math.cos(targetAngle) * targetDist;
      targetPositions[i * 3 + 1] = Math.sin(targetAngle) * targetDist;
      targetPositions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;

      // Random phase for wave animation
      phases[i] = Math.random() * Math.PI * 2;

      // Varied particle sizes
      sizes[i] = Math.random() * 2.5 + 1.5;
    }

    // Set geometry attributes
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aOriginalPosition', new THREE.BufferAttribute(originalPositions, 3));
    this.geometry.setAttribute('aTargetPosition', new THREE.BufferAttribute(targetPositions, 3));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    // Create shader material
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: 0 },
        uOffsetGain: { value: 0 },
        uFrequency: { value: 0.5 },
        uBeat: { value: 0 },
        uWarmColor: { value: this.config.warmColor },
        uCoolColor: { value: this.config.coolColor },
        uOpacity: { value: 0.4 },
        uIntensity: { value: 0 },
        uBounds: { value: new THREE.Vector2(width / 2, height / 2) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Create points mesh
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false; // Ensure particles always render
  }

  /**
   * Returns the THREE.Points object to add to scene
   */
  getMesh(): THREE.Points {
    return this.points;
  }

  /**
   * Update with audio frame
   * @param frame Audio frame data
   * @param deltaTime Time since last frame in seconds
   */
  update(frame: AudioFrame, deltaTime: number): void {
    if (!this.enabled) return;

    // Map audio features to uniforms with smooth interpolation
    // Bass and high frequencies control amplitude (particle displacement)
    const currentAmplitude = this.material.uniforms.uAmplitude.value;
    this.material.uniforms.uAmplitude.value = lerp(
      currentAmplitude,
      frame.lowEnergy * 1.2 + frame.highEnergy * 0.8,
      0.12
    );

    // Mid frequencies control offset gain (wave motion)
    this.material.uniforms.uOffsetGain.value = lerp(
      this.material.uniforms.uOffsetGain.value,
      frame.midEnergy * 0.4,
      0.12
    );

    // Beat pulse (quick attack, slow decay)
    if (frame.isBeat) {
      if (frame.isDownbeat) {
        this.material.uniforms.uBeat.value = 1.8;
      } else {
        this.material.uniforms.uBeat.value = 1.2;
      }
    } else {
      this.material.uniforms.uBeat.value *= 0.92;
    }

    // Advance time based on low frequency for rhythmic motion
    this.material.uniforms.uTime.value += deltaTime * 0.001 * (1 + frame.lowEnergy * 0.5);

    // Adjust opacity based on overall energy
    const targetOpacity = 0.15 + frame.energy * 0.45;
    this.material.uniforms.uOpacity.value = lerp(
      this.material.uniforms.uOpacity.value,
      targetOpacity,
      0.08
    );

    // Update intensity uniform for overall visibility control
    const targetIntensity = frame.energy;
    this.material.uniforms.uIntensity.value = lerp(
      this.material.uniforms.uIntensity.value,
      targetIntensity,
      0.08
    );

    // On downbeats, increase frequency for more motion
    if (frame.isDownbeat) {
      this.material.uniforms.uFrequency.value = 0.65;
    } else {
      this.material.uniforms.uFrequency.value = lerp(
        this.material.uniforms.uFrequency.value,
        0.45,
        0.04
      );
    }
  }

  /**
   * Set colors dynamically
   * @param warm Warm color (RGB 0-1)
   * @param cool Cool color (RGB 0-1)
   */
  setColors(warm: RGB, cool: RGB): void {
    this.material.uniforms.uWarmColor.value.setRGB(warm.r, warm.g, warm.b);
    this.material.uniforms.uCoolColor.value.setRGB(cool.r, cool.g, cool.b);
  }

  /**
   * Enable/disable effect
   * @param enabled Whether the effect is enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.points.visible = enabled;
  }

  /**
   * Get current enabled state
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
  }
}
