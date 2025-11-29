/**
 * Wash/flood light fixture implementation
 */

import * as THREE from 'three';
import { WashLight as IWashLight } from '../../shared/types';
import { BaseFixtureImpl } from './BaseFixture';

/**
 * Wash light fixture for area/flood lighting
 */
export class WashLight extends BaseFixtureImpl<IWashLight> {
  private spotlight!: THREE.SpotLight;
  private housing!: THREE.Mesh;
  private lens!: THREE.Mesh;
  private glowMesh!: THREE.Mesh;

  /**
   * Creates the Three.js mesh and light for this fixture
   */
  createMesh(): THREE.Group {
    // Create housing (PAR can style)
    const housingGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.3, 16);
    const housingMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.7,
      roughness: 0.3,
    });
    this.housing = new THREE.Mesh(housingGeometry, housingMaterial);
    this.housing.rotation.z = Math.PI / 2; // Point forward
    this.group.add(this.housing);

    // Create lens (front glass)
    const lensGeometry = new THREE.CircleGeometry(0.18, 32);
    const lensMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x111111,
      metalness: 0,
      roughness: 0,
      transmission: 0.9,
      thickness: 0.5,
      transparent: true,
      opacity: 0.5,
    });
    this.lens = new THREE.Mesh(lensGeometry, lensMaterial);
    this.lens.position.x = 0.16;
    this.lens.rotation.y = Math.PI / 2;
    this.group.add(this.lens);

    // Create spotlight for wash effect
    const minAngle = Math.PI / 8; // 22.5 degrees minimum
    this.spotlight = new THREE.SpotLight(0xffffff, 50, 40, minAngle, 0.3, 1.5);
    this.spotlight.position.set(0.2, 0, 0);

    // Create target for spotlight
    const target = new THREE.Object3D();
    target.position.set(5, 0, 0);
    this.group.add(target);
    this.spotlight.target = target;
    this.group.add(this.spotlight);

    // Create glow effect mesh
    this.createGlowEffect();

    // Apply initial state
    this.updateFixtureFromState();

    return this.group;
  }

  /**
   * Creates a glow effect for the wash light
   */
  private createGlowEffect(): void {
    const glowGeometry = new THREE.ConeGeometry(3, 10, 32, 1, true);
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(1, 1, 1) },
        intensity: { value: 1.0 },
        spread: { value: 0.5 },
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec2 vUv;

        void main() {
          vPosition = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float intensity;
        uniform float spread;

        varying vec3 vPosition;
        varying vec2 vUv;

        void main() {
          // Create soft edges based on spread
          float dist = length(vUv - vec2(0.5));
          float alpha = 1.0 - smoothstep(0.0, 0.5 + spread * 0.5, dist);

          // Fade out along length
          alpha *= (1.0 - vUv.y * 0.7);

          // Apply intensity
          alpha *= intensity * 0.2;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    this.glowMesh.position.x = 5;
    // Rotate so apex (narrow end) is at the light source, base (wide end) spreads outward
    this.glowMesh.rotation.z = Math.PI / 2;
    this.group.add(this.glowMesh);
  }

  /**
   * Updates the fixture state each frame
   * @param deltaTime Time since last frame in milliseconds
   */
  update(deltaTime: number): void {
    // Update transitions
    this.updateTransitions(deltaTime);

    // Update fixture visuals
    this.updateFixtureFromState();
  }

  /**
   * Updates fixture visuals based on current state
   */
  private updateFixtureFromState(): void {
    // Update light color and intensity
    const color = this.rgbToColor(this.state.color);
    this.spotlight.color = color;
    this.spotlight.intensity = this.state.intensity * 80;

    // Update spread (beam angle)
    const minAngle = Math.PI / 8; // 22.5 degrees
    const maxAngle = Math.PI / 2; // 90 degrees
    this.spotlight.angle = minAngle + (maxAngle - minAngle) * this.state.spread;

    // Update lens emissive to show light color
    if (this.lens.material instanceof THREE.MeshPhysicalMaterial) {
      this.lens.material.emissive = color;
      this.lens.material.emissiveIntensity = this.state.enabled ? this.state.intensity * 0.5 : 0;
    }

    // Update glow effect
    if (this.glowMesh && this.glowMesh.material instanceof THREE.ShaderMaterial) {
      const uniforms = this.glowMesh.material.uniforms;
      uniforms.color.value = color;
      uniforms.intensity.value = this.state.intensity;
      uniforms.spread.value = this.state.spread;
    }

    // Update visibility
    this.spotlight.visible = this.state.enabled;
    this.glowMesh.visible = this.state.enabled && this.state.intensity > 0;
  }

  /**
   * Applies state changes to the fixture
   * @param state Partial state to apply
   * @param transitionMs Transition duration in milliseconds
   * @param easing Easing type for the transition
   */
  applyState(
    state: Partial<IWashLight>,
    transitionMs: number = 0,
    easing: string = 'linear'
  ): void {
    // Handle instant updates
    if (transitionMs === 0 || easing === 'snap') {
      Object.assign(this.state, state);
      this.updateFixtureFromState();
      return;
    }

    // Start transitions for numeric properties
    if (state.intensity !== undefined) {
      this.startTransition('intensity', state.intensity, transitionMs, easing);
    }
    if (state.spread !== undefined) {
      this.startTransition('spread', state.spread, transitionMs, easing);
    }
    if (state.color !== undefined) {
      this.startTransition('color', state.color, transitionMs, easing);
    }

    // Handle non-transitional properties
    if (state.enabled !== undefined) {
      this.state.enabled = state.enabled;
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
    this.spotlight.visible = enabled;
    this.glowMesh.visible = enabled;
    if (!enabled) {
      this.spotlight.intensity = 0;
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
    if (this.lens) {
      this.lens.geometry.dispose();
      if (this.lens.material instanceof THREE.Material) {
        this.lens.material.dispose();
      }
    }
    if (this.glowMesh) {
      this.glowMesh.geometry.dispose();
      if (this.glowMesh.material instanceof THREE.Material) {
        this.glowMesh.material.dispose();
      }
    }

    // Remove light
    this.spotlight.dispose();

    // Clear references
    this.transitions.clear();
  }
}