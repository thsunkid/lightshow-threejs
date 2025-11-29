/**
 * Moving head spotlight fixture implementation
 */

import * as THREE from 'three';
import { MovingHead as IMovingHead } from '../../shared/types';
import { BaseFixtureImpl } from './BaseFixture';

/**
 * Moving head fixture with pan/tilt capabilities and visible beam
 */
export class MovingHead extends BaseFixtureImpl<IMovingHead> {
  private spotlight!: THREE.SpotLight;
  private spotlightHelper?: THREE.SpotLightHelper;
  private target!: THREE.Object3D;
  private housing!: THREE.Mesh;
  private head!: THREE.Mesh;
  private beamMesh!: THREE.Mesh;
  private panGroup!: THREE.Group;
  private tiltGroup!: THREE.Group;
  private maxPanAngle = Math.PI * 1.5; // 270 degrees
  private maxTiltAngle = Math.PI * 0.6; // 108 degrees

  /**
   * Creates the Three.js mesh and light for this fixture
   */
  createMesh(): THREE.Group {
    // Create pan group (for horizontal rotation)
    this.panGroup = new THREE.Group();

    // Create tilt group (for vertical rotation)
    this.tiltGroup = new THREE.Group();
    this.panGroup.add(this.tiltGroup);

    // Create housing (base of moving head) - more detailed
    const housingGeometry = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 24);
    const housingMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.15,
    });
    this.housing = new THREE.Mesh(housingGeometry, housingMaterial);
    this.housing.castShadow = true;
    this.group.add(this.housing);

    // Create yoke arms (connects base to head)
    const yokeArmGeometry = new THREE.BoxGeometry(0.06, 0.3, 0.06);
    const yokeMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.15,
    });
    const leftYoke = new THREE.Mesh(yokeArmGeometry, yokeMaterial);
    leftYoke.position.set(-0.15, 0, 0);
    this.panGroup.add(leftYoke);

    const rightYoke = new THREE.Mesh(yokeArmGeometry, yokeMaterial);
    rightYoke.position.set(0.15, 0, 0);
    this.panGroup.add(rightYoke);

    // Create head (moving part) with more detail
    const headGroup = new THREE.Group();

    // Main head body
    const headGeometry = new THREE.CylinderGeometry(0.14, 0.16, 0.3, 24);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      metalness: 0.95,
      roughness: 0.1,
    });
    this.head = new THREE.Mesh(headGeometry, headMaterial);
    this.head.rotation.z = Math.PI / 2; // Rotate to point forward
    this.head.castShadow = true;
    headGroup.add(this.head);

    // Add lens detail
    const lensGeometry = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 24);
    const lensMaterial = new THREE.MeshStandardMaterial({
      color: 0x2040ff,
      metalness: 0.7,
      roughness: 0.1,
      emissive: 0x1020ff,
      emissiveIntensity: 0.2,
    });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.rotation.z = Math.PI / 2;
    lens.position.x = 0.15;
    headGroup.add(lens);

    // Add heat sink fins for realism
    for (let i = 0; i < 6; i++) {
      const finGeometry = new THREE.BoxGeometry(0.02, 0.18, 0.18);
      const fin = new THREE.Mesh(finGeometry, headMaterial);
      fin.position.x = -0.1 + i * 0.03;
      fin.rotation.z = Math.PI / 2;
      headGroup.add(fin);
    }

    this.tiltGroup.add(headGroup);

    // Create spotlight with enhanced settings
    this.spotlight = new THREE.SpotLight(0xffffff, 150, 60, Math.PI / 10, 0.3, 1.5);
    this.spotlight.position.set(0, 0, 0);
    this.spotlight.castShadow = true;
    this.spotlight.shadow.mapSize.width = 1024;
    this.spotlight.shadow.mapSize.height = 1024;
    this.spotlight.shadow.camera.near = 0.5;
    this.spotlight.shadow.camera.far = 50;
    this.tiltGroup.add(this.spotlight);

    // Create target for spotlight
    this.target = new THREE.Object3D();
    this.target.position.set(0, 0, 10);
    this.tiltGroup.add(this.target);
    this.spotlight.target = this.target;

    // Create volumetric beam effect
    this.createBeam();

    // Add pan group to main group
    this.group.add(this.panGroup);

    // Apply initial state
    this.updateFixtureFromState();

    return this.group;
  }

  /**
   * Creates volumetric beam mesh
   */
  private createBeam(): void {
    const beamLength = 25;
    const beamGeometry = new THREE.ConeGeometry(
      1.8, // radius at far end - tighter beam
      beamLength, // length
      64, // radial segments - more for smoother appearance
      1, // height segments
      true // open ended
    );

    const beamMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(1, 1, 1) },
        intensity: { value: 1.0 },
        beamWidth: { value: 0.2 },
        opacity: { value: 0.55 },
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
        uniform float beamWidth;
        uniform float opacity;

        varying vec3 vPosition;
        varying vec2 vUv;

        void main() {
          // Fade out towards the edges
          float dist = abs(vUv.x - 0.5) * 2.0;
          float alpha = (1.0 - dist) * opacity * intensity;

          // Fade out along the length
          float lengthFade = 1.0 - (vUv.y * 0.5);
          alpha *= lengthFade;

          // Apply beam width
          alpha *= (1.0 - beamWidth * 0.5);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.beamMesh = new THREE.Mesh(beamGeometry, beamMaterial);
    this.beamMesh.position.z = beamLength / 2;
    this.beamMesh.rotation.x = -Math.PI / 2;
    this.tiltGroup.add(this.beamMesh);
  }

  /**
   * Updates the fixture state each frame
   * @param deltaTime Time since last frame in milliseconds
   */
  update(deltaTime: number): void {
    // Update transitions
    this.updateTransitions(deltaTime);

    // Update fixture visuals from state
    this.updateFixtureFromState();
  }

  /**
   * Updates fixture visuals based on current state
   */
  private updateFixtureFromState(): void {
    // Update pan and tilt
    const panAngle = (this.state.pan - 0.5) * this.maxPanAngle;
    const tiltAngle = (this.state.tilt - 0.5) * this.maxTiltAngle;

    this.panGroup.rotation.y = panAngle;
    this.tiltGroup.rotation.x = tiltAngle;

    // Update light color and intensity
    const color = this.rgbToColor(this.state.color);
    this.spotlight.color = color;
    this.spotlight.intensity = this.state.intensity * 200; // Increased for more dramatic lighting

    // Update beam width (spotlight angle)
    const minAngle = Math.PI / 32;
    const maxAngle = Math.PI / 4;
    this.spotlight.angle = minAngle + (maxAngle - minAngle) * this.state.beamWidth;

    // Update beam mesh
    if (this.beamMesh && this.beamMesh.material instanceof THREE.ShaderMaterial) {
      const uniforms = this.beamMesh.material.uniforms;
      uniforms.color.value = color;
      uniforms.intensity.value = this.state.intensity;
      uniforms.beamWidth.value = this.state.beamWidth;
      uniforms.opacity.value = this.state.enabled ? 0.55 * this.state.intensity : 0;
    }

    // Update visibility
    this.spotlight.visible = this.state.enabled;
    this.beamMesh.visible = this.state.enabled && this.state.intensity > 0;
  }

  /**
   * Applies state changes to the fixture
   * @param state Partial state to apply
   * @param transitionMs Transition duration in milliseconds
   * @param easing Easing type for the transition
   */
  applyState(
    state: Partial<IMovingHead>,
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
    if (state.pan !== undefined) {
      this.startTransition('pan', state.pan, transitionMs, easing);
    }
    if (state.tilt !== undefined) {
      this.startTransition('tilt', state.tilt, transitionMs, easing);
    }
    if (state.intensity !== undefined) {
      this.startTransition('intensity', state.intensity, transitionMs, easing);
    }
    if (state.beamWidth !== undefined) {
      this.startTransition('beamWidth', state.beamWidth, transitionMs, easing);
    }
    if (state.speed !== undefined) {
      this.startTransition('speed', state.speed, transitionMs, easing);
    }
    if (state.color !== undefined) {
      this.startTransition('color', state.color, transitionMs, easing);
    }

    // Handle non-transitional properties
    if (state.enabled !== undefined) {
      this.state.enabled = state.enabled;
    }
    if (state.gobo !== undefined) {
      this.state.gobo = state.gobo;
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
    if (this.head) {
      this.head.geometry.dispose();
      if (this.head.material instanceof THREE.Material) {
        this.head.material.dispose();
      }
    }
    if (this.beamMesh) {
      this.beamMesh.geometry.dispose();
      if (this.beamMesh.material instanceof THREE.Material) {
        this.beamMesh.material.dispose();
      }
    }

    // Remove from scene
    this.spotlight.dispose();
    if (this.spotlightHelper) {
      this.spotlightHelper.dispose();
    }

    // Clear references
    this.transitions.clear();
  }
}