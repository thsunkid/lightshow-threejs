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
  baseColor: THREE.Color;
  accentColor: THREE.Color;
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
    const phases = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);

    // Distribute particles across the panel area
    for (let i = 0; i < particleCount; i++) {
      // Random position within panel bounds
      const x = (Math.random() - 0.5) * width;
      const y = (Math.random() - 0.5) * height;
      const z = (Math.random() - 0.5) * 0.5; // Slight depth variation

      // Store position
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Store original position for displacement calculations
      originalPositions[i * 3] = x;
      originalPositions[i * 3 + 1] = y;
      originalPositions[i * 3 + 2] = z;

      // Random phase for wave animation
      phases[i] = Math.random() * Math.PI * 2;

      // Varied particle sizes
      sizes[i] = Math.random() * 3 + 1;
    }

    // Set geometry attributes
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aOriginalPosition', new THREE.BufferAttribute(originalPositions, 3));
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
        uBaseColor: { value: this.config.baseColor },
        uAccentColor: { value: this.config.accentColor },
        uOpacity: { value: 0.3 },
        uIntensity: { value: 0 },
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
      frame.lowEnergy * 1.5 + frame.highEnergy,
      0.15
    );

    // Mid frequencies control offset gain (wave motion)
    this.material.uniforms.uOffsetGain.value = lerp(
      this.material.uniforms.uOffsetGain.value,
      frame.midEnergy * 0.5,
      0.15
    );

    // Beat pulse (quick attack, slow decay)
    if (frame.isBeat) {
      // More dramatic beat response: 2.0 for downbeats, 1.5 for regular beats
      if (frame.isDownbeat) {
        this.material.uniforms.uBeat.value = 2.0;
      } else {
        this.material.uniforms.uBeat.value = 1.5;
      }
    } else {
      this.material.uniforms.uBeat.value *= 0.9;
    }

    // Advance time based on low frequency for rhythmic motion
    this.material.uniforms.uTime.value += deltaTime * 0.001 * (1 + frame.lowEnergy);

    // Adjust opacity based on overall energy - reduced brightness
    const targetOpacity = 0.1 + frame.energy * 0.5;
    this.material.uniforms.uOpacity.value = lerp(
      this.material.uniforms.uOpacity.value,
      targetOpacity,
      0.1
    );

    // Update intensity uniform for overall visibility control
    const targetIntensity = frame.energy;
    this.material.uniforms.uIntensity.value = lerp(
      this.material.uniforms.uIntensity.value,
      targetIntensity,
      0.1
    );

    // On downbeats, add extra intensity
    if (frame.isDownbeat) {
      this.material.uniforms.uFrequency.value = 0.7;
    } else {
      // Gradually return to base frequency
      this.material.uniforms.uFrequency.value = lerp(
        this.material.uniforms.uFrequency.value,
        0.5,
        0.05
      );
    }
  }

  /**
   * Set colors dynamically
   * @param base Base color (RGB 0-1)
   * @param accent Accent color (RGB 0-1)
   */
  setColors(base: RGB, accent: RGB): void {
    this.material.uniforms.uBaseColor.value.setRGB(base.r, base.g, base.b);
    this.material.uniforms.uAccentColor.value.setRGB(accent.r, accent.g, accent.b);
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
