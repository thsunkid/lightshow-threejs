/**
 * FlakeLightController - Manages contextual flake light system
 *
 * Flake lights are atmospheric particle lights that appear during specific
 * sections and respond to audio with various movement patterns.
 */

import * as THREE from 'three';
import { AudioFrame, RGB } from '../shared/types';

export interface FlakeConfig {
  count: number;
  stageWidth: number;
  stageDepth: number;
  maxHeight: number;
}

export type FlakePattern = 'drift' | 'pulse' | 'burst' | 'rain' | 'spiral';

/**
 * Controls flake lights with contextual activation and patterns
 */
export class FlakeLightController {
  private scene: THREE.Scene;
  private config: FlakeConfig;
  private flakeLightsGroup: THREE.Group;

  // Particle systems
  private flakePointsWarm!: THREE.Points;
  private flakePointsCool!: THREE.Points;

  // Animation data
  private flakePositions: Float32Array;
  private flakeVelocities: Float32Array;
  private flakePhases: Float32Array;

  // State
  private enabled: boolean = false;
  private targetIntensity: number = 0;
  private currentIntensity: number = 0;
  private currentPattern: FlakePattern = 'drift';
  private time: number = 0;

  // Colors
  private warmColor: THREE.Color;
  private coolColor: THREE.Color;

  constructor(scene: THREE.Scene, config: FlakeConfig) {
    this.scene = scene;
    this.config = config;

    // Initialize colors
    this.warmColor = new THREE.Color(1.0, 0.85, 0.4);
    this.coolColor = new THREE.Color(0.7, 0.85, 1.0);

    // Create group
    this.flakeLightsGroup = new THREE.Group();
    this.flakeLightsGroup.name = 'FlakeLights';

    // Initialize arrays
    const totalFlakes = this.config.count * 2; // Both warm and cool
    this.flakePositions = new Float32Array(totalFlakes * 3);
    this.flakeVelocities = new Float32Array(totalFlakes * 3);
    this.flakePhases = new Float32Array(totalFlakes);

    // Create particle systems
    this.createWarmFlakes();
    this.createCoolFlakes();

    // Add to scene
    this.scene.add(this.flakeLightsGroup);
  }

  /**
   * Creates warm (yellow-gold) flake particles
   */
  private createWarmFlakes(): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.config.count * 3);
    const sizes = new Float32Array(this.config.count);

    for (let i = 0; i < this.config.count; i++) {
      // Distribute across stage area
      const x = (Math.random() - 0.5) * this.config.stageWidth;
      const y = Math.random() * this.config.maxHeight + 1;
      const z = (Math.random() - 0.5) * this.config.stageDepth - 2;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Store in master arrays
      this.flakePositions[i * 3] = x;
      this.flakePositions[i * 3 + 1] = y;
      this.flakePositions[i * 3 + 2] = z;

      // Random velocities
      this.flakeVelocities[i * 3] = (Math.random() - 0.5) * 0.02;
      this.flakeVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
      this.flakeVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

      // Random phase for animation
      this.flakePhases[i] = Math.random() * Math.PI * 2;

      // Varied sizes
      sizes[i] = Math.random() * 0.15 + 0.05;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      color: this.warmColor,
      size: 0.12,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.flakePointsWarm = new THREE.Points(geometry, material);
    this.flakePointsWarm.name = 'FlakesWarm';
    this.flakeLightsGroup.add(this.flakePointsWarm);
  }

  /**
   * Creates cool (white-blue) flake particles
   */
  private createCoolFlakes(): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.config.count * 3);
    const sizes = new Float32Array(this.config.count);

    for (let i = 0; i < this.config.count; i++) {
      const idx = this.config.count + i;

      const x = (Math.random() - 0.5) * this.config.stageWidth;
      const y = Math.random() * this.config.maxHeight + 0.5;
      const z = (Math.random() - 0.5) * this.config.stageDepth - 1;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Store in master arrays
      this.flakePositions[idx * 3] = x;
      this.flakePositions[idx * 3 + 1] = y;
      this.flakePositions[idx * 3 + 2] = z;

      // Random velocities
      this.flakeVelocities[idx * 3] = (Math.random() - 0.5) * 0.02;
      this.flakeVelocities[idx * 3 + 1] = (Math.random() - 0.5) * 0.01;
      this.flakeVelocities[idx * 3 + 2] = (Math.random() - 0.5) * 0.02;

      // Random phase
      this.flakePhases[idx] = Math.random() * Math.PI * 2;

      sizes[i] = Math.random() * 0.12 + 0.04;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      color: this.coolColor,
      size: 0.1,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.flakePointsCool = new THREE.Points(geometry, material);
    this.flakePointsCool.name = 'FlakesCool';
    this.flakeLightsGroup.add(this.flakePointsCool);
  }

  /**
   * Enable or disable flake lights
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.targetIntensity = 0;
    }
  }

  /**
   * Set target intensity (0-1)
   */
  setIntensity(intensity: number): void {
    this.targetIntensity = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Set movement pattern
   */
  setPattern(pattern: FlakePattern): void {
    this.currentPattern = pattern;
  }

  /**
   * Set colors for warm and cool flakes
   */
  setColors(warm: RGB, cool: RGB): void {
    this.warmColor.setRGB(warm.r, warm.g, warm.b);
    this.coolColor.setRGB(cool.r, cool.g, cool.b);

    const warmMaterial = this.flakePointsWarm.material as THREE.PointsMaterial;
    const coolMaterial = this.flakePointsCool.material as THREE.PointsMaterial;

    warmMaterial.color.copy(this.warmColor);
    coolMaterial.color.copy(this.coolColor);
  }

  /**
   * Update flakes based on audio frame
   */
  update(frame: AudioFrame): void {
    const deltaTime = 16; // Approximate delta for smooth animation
    this.time += deltaTime * 0.001;

    // Smooth intensity fade
    const fadeSpeed = 0.05;
    if (this.enabled) {
      this.currentIntensity += (this.targetIntensity - this.currentIntensity) * fadeSpeed;
    } else {
      this.currentIntensity += (0 - this.currentIntensity) * fadeSpeed;
    }

    // Update materials
    this.updateMaterials(frame);

    // Update positions based on pattern
    this.updatePositions(deltaTime);
  }

  /**
   * Updates material properties based on audio
   */
  private updateMaterials(frame: AudioFrame): void {
    const warmMaterial = this.flakePointsWarm.material as THREE.PointsMaterial;
    const coolMaterial = this.flakePointsCool.material as THREE.PointsMaterial;

    // Base opacity from current intensity
    const baseOpacity = this.currentIntensity * 0.6;

    // Add beat pulse
    const beatPulse = frame.isBeat ? 0.3 : 0;

    // Warm flakes respond to low frequencies
    warmMaterial.opacity = Math.min(0.9, baseOpacity + frame.lowEnergy * 0.3 + beatPulse);
    warmMaterial.size = 0.1 + frame.lowEnergy * 0.08 + beatPulse * 0.05;

    // Cool flakes respond to high frequencies
    coolMaterial.opacity = Math.min(0.8, baseOpacity + frame.highEnergy * 0.3 + beatPulse * 0.7);
    coolMaterial.size = 0.08 + frame.highEnergy * 0.06 + beatPulse * 0.04;
  }

  /**
   * Updates particle positions based on current pattern
   */
  private updatePositions(deltaTime: number): void {
    const warmPositions = this.flakePointsWarm.geometry.attributes.position.array as Float32Array;
    const coolPositions = this.flakePointsCool.geometry.attributes.position.array as Float32Array;

    switch (this.currentPattern) {
      case 'drift':
        this.updateDriftPattern(warmPositions, coolPositions, deltaTime);
        break;
      case 'pulse':
        this.updatePulsePattern(warmPositions, coolPositions, deltaTime);
        break;
      case 'burst':
        this.updateBurstPattern(warmPositions, coolPositions, deltaTime);
        break;
      case 'rain':
        this.updateRainPattern(warmPositions, coolPositions, deltaTime);
        break;
      case 'spiral':
        this.updateSpiralPattern(warmPositions, coolPositions, deltaTime);
        break;
    }

    // Mark geometries for update
    this.flakePointsWarm.geometry.attributes.position.needsUpdate = true;
    this.flakePointsCool.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Drift pattern - subtle floating movement
   */
  private updateDriftPattern(warmPos: Float32Array, coolPos: Float32Array, dt: number): void {
    for (let i = 0; i < this.config.count; i++) {
      const phase = this.flakePhases[i];
      const drift = Math.sin(this.time * 0.5 + phase) * 0.02;

      warmPos[i * 3] += this.flakeVelocities[i * 3] + drift * 0.5;
      warmPos[i * 3 + 1] += this.flakeVelocities[i * 3 + 1];
      warmPos[i * 3 + 2] += this.flakeVelocities[i * 3 + 2] + drift * 0.3;

      this.wrapPosition(warmPos, i);
    }

    for (let i = 0; i < this.config.count; i++) {
      const idx = this.config.count + i;
      const phase = this.flakePhases[idx];
      const drift = Math.sin(this.time * 0.4 + phase) * 0.015;

      coolPos[i * 3] += this.flakeVelocities[idx * 3] + drift * 0.4;
      coolPos[i * 3 + 1] += this.flakeVelocities[idx * 3 + 1];
      coolPos[i * 3 + 2] += this.flakeVelocities[idx * 3 + 2] + drift * 0.25;

      this.wrapPositionCool(coolPos, i);
    }
  }

  /**
   * Pulse pattern - radial pulsing from center
   */
  private updatePulsePattern(warmPos: Float32Array, coolPos: Float32Array, dt: number): void {
    const pulseStrength = Math.sin(this.time * 2) * 0.03;

    for (let i = 0; i < this.config.count; i++) {
      const x = warmPos[i * 3];
      const z = warmPos[i * 3 + 2];
      const dist = Math.sqrt(x * x + z * z);

      if (dist > 0.1) {
        warmPos[i * 3] += (x / dist) * pulseStrength;
        warmPos[i * 3 + 2] += (z / dist) * pulseStrength;
      }

      warmPos[i * 3 + 1] += this.flakeVelocities[i * 3 + 1];
      this.wrapPosition(warmPos, i);
    }

    for (let i = 0; i < this.config.count; i++) {
      const x = coolPos[i * 3];
      const z = coolPos[i * 3 + 2];
      const dist = Math.sqrt(x * x + z * z);

      if (dist > 0.1) {
        coolPos[i * 3] += (x / dist) * pulseStrength * 0.8;
        coolPos[i * 3 + 2] += (z / dist) * pulseStrength * 0.8;
      }

      const idx = this.config.count + i;
      coolPos[i * 3 + 1] += this.flakeVelocities[idx * 3 + 1];
      this.wrapPositionCool(coolPos, i);
    }
  }

  /**
   * Burst pattern - explosive outward movement
   */
  private updateBurstPattern(warmPos: Float32Array, coolPos: Float32Array, dt: number): void {
    const burstSpeed = 0.15;

    for (let i = 0; i < this.config.count; i++) {
      const phase = this.flakePhases[i];
      const angle = phase * 2;

      warmPos[i * 3] += Math.cos(angle) * burstSpeed;
      warmPos[i * 3 + 1] += Math.sin(phase) * burstSpeed * 0.5;
      warmPos[i * 3 + 2] += Math.sin(angle) * burstSpeed;

      this.wrapPosition(warmPos, i);
    }

    for (let i = 0; i < this.config.count; i++) {
      const idx = this.config.count + i;
      const phase = this.flakePhases[idx];
      const angle = phase * 2 + Math.PI / 4;

      coolPos[i * 3] += Math.cos(angle) * burstSpeed * 0.8;
      coolPos[i * 3 + 1] += Math.sin(phase) * burstSpeed * 0.4;
      coolPos[i * 3 + 2] += Math.sin(angle) * burstSpeed * 0.8;

      this.wrapPositionCool(coolPos, i);
    }
  }

  /**
   * Rain pattern - falling downward
   */
  private updateRainPattern(warmPos: Float32Array, coolPos: Float32Array, dt: number): void {
    for (let i = 0; i < this.config.count; i++) {
      warmPos[i * 3] += this.flakeVelocities[i * 3] * 0.5;
      warmPos[i * 3 + 1] -= 0.08; // Fall down
      warmPos[i * 3 + 2] += this.flakeVelocities[i * 3 + 2] * 0.5;

      // Reset to top when reaching bottom
      if (warmPos[i * 3 + 1] < 0.5) {
        warmPos[i * 3 + 1] = this.config.maxHeight + 1;
      }

      this.wrapPosition(warmPos, i);
    }

    for (let i = 0; i < this.config.count; i++) {
      const idx = this.config.count + i;
      coolPos[i * 3] += this.flakeVelocities[idx * 3] * 0.5;
      coolPos[i * 3 + 1] -= 0.06;
      coolPos[i * 3 + 2] += this.flakeVelocities[idx * 3 + 2] * 0.5;

      if (coolPos[i * 3 + 1] < 0.5) {
        coolPos[i * 3 + 1] = this.config.maxHeight + 0.5;
      }

      this.wrapPositionCool(coolPos, i);
    }
  }

  /**
   * Spiral pattern - rotating spiral movement
   */
  private updateSpiralPattern(warmPos: Float32Array, coolPos: Float32Array, dt: number): void {
    const spiralSpeed = 0.02;

    for (let i = 0; i < this.config.count; i++) {
      const phase = this.flakePhases[i];
      const radius = Math.sqrt(warmPos[i * 3] ** 2 + warmPos[i * 3 + 2] ** 2);
      const angle = Math.atan2(warmPos[i * 3 + 2], warmPos[i * 3]) + spiralSpeed;

      warmPos[i * 3] = Math.cos(angle) * radius;
      warmPos[i * 3 + 1] += Math.sin(this.time + phase) * 0.02;
      warmPos[i * 3 + 2] = Math.sin(angle) * radius;

      this.wrapPosition(warmPos, i);
    }

    for (let i = 0; i < this.config.count; i++) {
      const idx = this.config.count + i;
      const phase = this.flakePhases[idx];
      const radius = Math.sqrt(coolPos[i * 3] ** 2 + coolPos[i * 3 + 2] ** 2);
      const angle = Math.atan2(coolPos[i * 3 + 2], coolPos[i * 3]) - spiralSpeed * 0.8;

      coolPos[i * 3] = Math.cos(angle) * radius;
      coolPos[i * 3 + 1] += Math.sin(this.time * 0.8 + phase) * 0.015;
      coolPos[i * 3 + 2] = Math.sin(angle) * radius;

      this.wrapPositionCool(coolPos, i);
    }
  }

  /**
   * Wraps particle position within bounds (warm)
   */
  private wrapPosition(positions: Float32Array, index: number): void {
    const halfWidth = this.config.stageWidth / 2;
    const halfDepth = this.config.stageDepth / 2;

    if (positions[index * 3] > halfWidth) positions[index * 3] = -halfWidth;
    if (positions[index * 3] < -halfWidth) positions[index * 3] = halfWidth;

    if (positions[index * 3 + 1] > this.config.maxHeight + 1) positions[index * 3 + 1] = 1;
    if (positions[index * 3 + 1] < 1) positions[index * 3 + 1] = this.config.maxHeight + 1;

    if (positions[index * 3 + 2] > halfDepth - 2) positions[index * 3 + 2] = -halfDepth - 2;
    if (positions[index * 3 + 2] < -halfDepth - 2) positions[index * 3 + 2] = halfDepth - 2;
  }

  /**
   * Wraps particle position within bounds (cool)
   */
  private wrapPositionCool(positions: Float32Array, index: number): void {
    const halfWidth = this.config.stageWidth / 2;
    const halfDepth = this.config.stageDepth / 2;

    if (positions[index * 3] > halfWidth) positions[index * 3] = -halfWidth;
    if (positions[index * 3] < -halfWidth) positions[index * 3] = halfWidth;

    if (positions[index * 3 + 1] > this.config.maxHeight + 0.5) positions[index * 3 + 1] = 0.5;
    if (positions[index * 3 + 1] < 0.5) positions[index * 3 + 1] = this.config.maxHeight + 0.5;

    if (positions[index * 3 + 2] > halfDepth - 1) positions[index * 3 + 2] = -halfDepth - 1;
    if (positions[index * 3 + 2] < -halfDepth - 1) positions[index * 3 + 2] = halfDepth - 1;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.flakePointsWarm.geometry.dispose();
    (this.flakePointsWarm.material as THREE.Material).dispose();
    this.flakePointsCool.geometry.dispose();
    (this.flakePointsCool.material as THREE.Material).dispose();
    this.scene.remove(this.flakeLightsGroup);
  }
}
