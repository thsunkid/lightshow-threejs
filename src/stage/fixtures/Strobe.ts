/**
 * Strobe light fixture implementation
 */

import * as THREE from 'three';
import { Strobe as IStrobe } from '../../shared/types';
import { BaseFixtureImpl } from './BaseFixture';

/**
 * Strobe fixture for flash effects
 */
export class Strobe extends BaseFixtureImpl<IStrobe> {
  private pointLight!: THREE.PointLight;
  private housing!: THREE.Mesh;
  private panel!: THREE.Mesh;
  private lastFlashTime: number = 0;
  private isFlashing: boolean = false;
  private flashStartTime: number = 0;

  /**
   * Creates the Three.js mesh and light for this fixture
   */
  createMesh(): THREE.Group {
    // Create housing (strobe unit)
    const housingGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.1);
    const housingMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.3,
    });
    this.housing = new THREE.Mesh(housingGeometry, housingMaterial);
    this.group.add(this.housing);

    // Create strobe panel (emissive surface)
    const panelGeometry = new THREE.BoxGeometry(0.35, 0.25, 0.01);
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      metalness: 0,
      roughness: 1,
    });
    this.panel = new THREE.Mesh(panelGeometry, panelMaterial);
    this.panel.position.z = 0.06;
    this.group.add(this.panel);

    // Create point light for strobe
    this.pointLight = new THREE.PointLight(0xffffff, 0, 30, 1);
    this.pointLight.position.z = 0.5;
    this.group.add(this.pointLight);

    // Apply initial state
    this.updateFixtureFromState();

    return this.group;
  }

  /**
   * Updates the fixture state each frame
   * @param deltaTime Time since last frame in milliseconds
   */
  update(deltaTime: number): void {
    // Update transitions
    this.updateTransitions(deltaTime);

    // Handle strobe flashing
    if (this.state.enabled && this.state.rate > 0 && this.state.intensity > 0) {
      const currentTime = Date.now();
      const flashInterval = 1000 / this.state.rate; // Convert Hz to ms

      // Check if we should start a new flash
      if (currentTime - this.lastFlashTime >= flashInterval) {
        this.isFlashing = true;
        this.flashStartTime = currentTime;
        this.lastFlashTime = currentTime;
      }

      // Check if current flash should end
      if (this.isFlashing) {
        const flashElapsed = currentTime - this.flashStartTime;
        if (flashElapsed >= this.state.flashDuration) {
          this.isFlashing = false;
        }
      }
    } else {
      this.isFlashing = false;
    }

    // Update fixture visuals
    this.updateFixtureFromState();
  }

  /**
   * Updates fixture visuals based on current state
   */
  private updateFixtureFromState(): void {
    // Determine if light should be on
    const isOn = this.state.enabled && this.isFlashing;

    // Update light color and intensity
    const color = this.rgbToColor(this.state.color);
    this.pointLight.color = color;

    if (isOn) {
      this.pointLight.intensity = this.state.intensity * 200; // Strong intensity for strobe

      // Update panel emissive
      if (this.panel.material instanceof THREE.MeshStandardMaterial) {
        this.panel.material.emissive = color;
        this.panel.material.emissiveIntensity = this.state.intensity * 2;
      }
    } else {
      this.pointLight.intensity = 0;

      // Turn off panel emissive
      if (this.panel.material instanceof THREE.MeshStandardMaterial) {
        this.panel.material.emissiveIntensity = 0;
      }
    }

    // Update visibility
    this.pointLight.visible = this.state.enabled;
  }

  /**
   * Applies state changes to the fixture
   * @param state Partial state to apply
   * @param transitionMs Transition duration in milliseconds
   * @param easing Easing type for the transition
   */
  applyState(
    state: Partial<IStrobe>,
    transitionMs: number = 0,
    easing: string = 'linear'
  ): void {
    // Strobe effects are typically instant, but we'll support transitions for intensity
    if (transitionMs === 0 || easing === 'snap') {
      Object.assign(this.state, state);
      this.updateFixtureFromState();
      return;
    }

    // Start transitions for numeric properties
    if (state.intensity !== undefined) {
      this.startTransition('intensity', state.intensity, transitionMs, easing);
    }
    if (state.rate !== undefined) {
      // Rate changes should be instant for strobes
      this.state.rate = state.rate;
    }
    if (state.flashDuration !== undefined) {
      // Flash duration changes should be instant
      this.state.flashDuration = state.flashDuration;
    }
    if (state.color !== undefined) {
      this.startTransition('color', state.color, transitionMs, easing);
    }

    // Handle non-transitional properties
    if (state.enabled !== undefined) {
      this.state.enabled = state.enabled;
      if (!state.enabled) {
        this.isFlashing = false;
      }
    }
  }

  /**
   * Triggers a single flash (useful for manual control)
   */
  flash(duration?: number): void {
    if (this.state.enabled) {
      this.isFlashing = true;
      this.flashStartTime = Date.now();
      const flashDuration = duration ?? this.state.flashDuration;

      setTimeout(() => {
        this.isFlashing = false;
      }, flashDuration);
    }
  }

  /**
   * Sets enabled state - override to properly handle light visibility
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    this.group.visible = enabled;
    // Important: Must explicitly set light visibility because lights affect
    // the scene globally even when their parent group is hidden
    this.pointLight.visible = enabled;
    if (!enabled) {
      this.isFlashing = false;
      this.pointLight.intensity = 0;
    }
  }

  /**
   * Cleans up Three.js resources
   */
  dispose(): void {
    // Dispose geometries
    if (this.housing) {
      this.housing.geometry.dispose();
      if (this.housing.material instanceof THREE.Material) {
        this.housing.material.dispose();
      }
    }
    if (this.panel) {
      this.panel.geometry.dispose();
      if (this.panel.material instanceof THREE.Material) {
        this.panel.material.dispose();
      }
    }

    // Remove light
    this.pointLight.dispose();

    // Clear references
    this.transitions.clear();
  }
}