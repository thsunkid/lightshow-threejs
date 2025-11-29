/**
 * Main Three.js scene with stage geometry and rendering
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import GUI from 'lil-gui';
import {
  StageConfig,
  Fixture,
  LightingCommand,
} from '../shared/types';
import { LightingController } from './LightingController';

/**
 * Main stage class managing the 3D scene
 */
export class Stage {
  private container: HTMLElement;
  private config: StageConfig;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private lightingController!: LightingController;
  private stageGroup!: THREE.Group;
  private clock: THREE.Clock;
  private gui?: GUI;
  private animationId?: number;
  private cameraPreset: 'front' | 'side' | 'top' | 'dynamic' = 'front';
  private dynamicCameraTime: number = 0;

  // Default configuration
  private static readonly DEFAULT_CONFIG: StageConfig = {
    width: 20,
    depth: 10,
    trussHeight: 6,
    hazeDensity: 0.3,
    ambientLight: 0.05,
  };

  /**
   * Creates a new stage
   * @param container HTML element to render into
   * @param config Stage configuration
   */
  constructor(container: HTMLElement, config?: Partial<StageConfig>) {
    this.container = container;
    this.config = { ...Stage.DEFAULT_CONFIG, ...config };
    this.clock = new THREE.Clock();
  }

  /**
   * Initializes the stage
   */
  init(): void {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupPostProcessing();
    this.setupLighting();
    this.createStageGeometry();
    this.setupLightingController();
    this.setupEventListeners();
    this.setupDebugGUI();
  }

  /**
   * Sets up the Three.js scene
   */
  private setupScene(): void {
    this.scene = new THREE.Scene();
    // Enhanced fog for atmospheric haze effect that makes light beams visible
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.015 * this.config.hazeDensity);

    // Gradient background to simulate venue atmosphere
    const gradientTexture = this.createGradientTexture();
    this.scene.background = gradientTexture;
  }

  /**
   * Creates a gradient texture for the background
   */
  private createGradientTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Create gradient from dark blue-black at top to pure black at bottom
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#0a0a1a');
    gradient.addColorStop(0.5, '#050510');
    gradient.addColorStop(1, '#000000');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * Sets up the camera
   */
  private setupCamera(): void {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    // Adjusted FOV for more dramatic framing
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 1000);
    this.setCameraPreset('front');
  }

  /**
   * Sets up the renderer
   */
  private setupRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    this.container.appendChild(this.renderer.domElement);
  }

  /**
   * Sets up post-processing effects
   */
  private setupPostProcessing(): void {
    this.composer = new EffectComposer(this.renderer);

    // Render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Enhanced bloom pass for dramatic light glow
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
      1.8, // strength - increased for more dramatic bloom
      0.5, // radius - slightly larger
      0.75  // threshold - lower to catch more lights
    );
    this.composer.addPass(bloomPass);

    // Output pass with tone mapping
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    // Add volumetric spotlight effect
    this.addVolumetricLighting();
  }

  /**
   * Adds volumetric lighting effect for visible light beams
   */
  private addVolumetricLighting(): void {
    // Create a subtle volumetric fog particle system
    const fogGeometry = new THREE.BufferGeometry();
    const fogCount = 500;
    const positions = new Float32Array(fogCount * 3);
    const opacities = new Float32Array(fogCount);

    for (let i = 0; i < fogCount; i++) {
      // Distribute fog particles around the stage area
      positions[i * 3] = (Math.random() - 0.5) * this.config.width * 2;
      positions[i * 3 + 1] = Math.random() * this.config.trussHeight * 1.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.config.depth * 3;

      // Random opacity for each particle
      opacities[i] = Math.random() * 0.5 + 0.1;
    }

    fogGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    fogGeometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

    const fogMaterial = new THREE.PointsMaterial({
      color: 0x202040,
      size: 0.5,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const fogParticles = new THREE.Points(fogGeometry, fogMaterial);
    fogParticles.name = 'VolumetricFog';
    this.scene.add(fogParticles);
  }

  /**
   * Sets up basic scene lighting
   */
  private setupLighting(): void {
    // Very subtle ambient light for minimal visibility
    const ambientLight = new THREE.AmbientLight(0x101020, this.config.ambientLight * 0.5);
    this.scene.add(ambientLight);

    // Subtle rim light from behind
    const rimLight = new THREE.DirectionalLight(0x1a1a3a, 0.15);
    rimLight.position.set(0, 15, -10);
    rimLight.castShadow = true;
    rimLight.shadow.mapSize.width = 2048;
    rimLight.shadow.mapSize.height = 2048;
    this.scene.add(rimLight);

    // Very subtle front fill to see stage structure
    const fillLight = new THREE.DirectionalLight(0x0a0a1a, 0.1);
    fillLight.position.set(0, 8, 15);
    this.scene.add(fillLight);
  }

  /**
   * Creates stage geometry (floor, trusses, etc.)
   */
  private createStageGeometry(): void {
    this.stageGroup = new THREE.Group();
    this.stageGroup.name = 'StageGeometry';

    // === STAGE PLATFORM ===
    // Raised stage platform
    const platformGeometry = new THREE.BoxGeometry(
      this.config.width + 4,
      1.2,
      this.config.depth + 2
    );
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      metalness: 0.2,
      roughness: 0.8,
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = -0.6;
    platform.castShadow = true;
    platform.receiveShadow = true;
    this.stageGroup.add(platform);

    // Stage floor (glossy black surface)
    const floorGeometry = new THREE.BoxGeometry(
      this.config.width,
      0.1,
      this.config.depth
    );
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      metalness: 0.8,
      roughness: 0.3,
      envMapIntensity: 1.0,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = 0.05;
    floor.receiveShadow = true;
    this.stageGroup.add(floor);

    // Edge lighting strips
    this.createEdgeLighting();

    // === BACK WALL / LED SCREEN ===
    this.createBackWall();

    // === TRUSS STRUCTURE ===
    // Main back truss (holds most lights)
    this.createDetailedTruss(
      { x: 0, y: this.config.trussHeight, z: -this.config.depth / 2 - 2 },
      this.config.width * 0.9,
      true,
      'back'
    );

    // Front truss
    this.createDetailedTruss(
      { x: 0, y: this.config.trussHeight - 0.5, z: this.config.depth / 2 + 1 },
      this.config.width * 0.7,
      true,
      'front'
    );

    // Side trusses (vertical towers)
    this.createVerticalTruss(
      { x: -this.config.width / 2 - 2, y: 0, z: 0 },
      this.config.trussHeight + 2
    );
    this.createVerticalTruss(
      { x: this.config.width / 2 + 2, y: 0, z: 0 },
      this.config.trussHeight + 2
    );

    // Connecting trusses
    this.createDetailedTruss(
      { x: -this.config.width / 2 - 2, y: this.config.trussHeight - 1, z: 0 },
      this.config.depth + 4,
      false,
      'side'
    );
    this.createDetailedTruss(
      { x: this.config.width / 2 + 2, y: this.config.trussHeight - 1, z: 0 },
      this.config.depth + 4,
      false,
      'side'
    );

    // === AUDIENCE AREA ===
    this.createAudienceArea();

    // === STAGE PROPS ===
    this.createStageProps();

    this.scene.add(this.stageGroup);
  }

  /**
   * Creates edge lighting around the stage
   */
  private createEdgeLighting(): void {
    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0x2040ff,
      transparent: true,
      opacity: 0.9,
    });

    // Front edge
    const frontEdge = new THREE.BoxGeometry(this.config.width, 0.05, 0.1);
    const frontEdgeMesh = new THREE.Mesh(frontEdge, edgeMaterial);
    frontEdgeMesh.position.set(0, 0.1, this.config.depth / 2);
    this.stageGroup.add(frontEdgeMesh);

    // Side edges
    const sideEdge = new THREE.BoxGeometry(0.1, 0.05, this.config.depth);
    const leftEdgeMesh = new THREE.Mesh(sideEdge, edgeMaterial);
    leftEdgeMesh.position.set(-this.config.width / 2, 0.1, 0);
    this.stageGroup.add(leftEdgeMesh);

    const rightEdgeMesh = new THREE.Mesh(sideEdge, edgeMaterial);
    rightEdgeMesh.position.set(this.config.width / 2, 0.1, 0);
    this.stageGroup.add(rightEdgeMesh);
  }

  /**
   * Creates the back wall / LED screen
   */
  private createBackWall(): void {
    // Main back wall structure
    const wallGeometry = new THREE.BoxGeometry(
      this.config.width + 6,
      this.config.trussHeight + 2,
      0.5
    );
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      metalness: 0.3,
      roughness: 0.8,
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(0, (this.config.trussHeight + 2) / 2, -this.config.depth / 2 - 4);
    wall.castShadow = true;
    this.stageGroup.add(wall);

    // LED screen panels (emissive)
    const screenGeometry = new THREE.BoxGeometry(
      this.config.width * 0.8,
      this.config.trussHeight * 0.7,
      0.1
    );
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x001030,
      emissive: 0x001030,
      emissiveIntensity: 0.2,
      metalness: 0.9,
      roughness: 0.1,
    });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(0, this.config.trussHeight * 0.5, -this.config.depth / 2 - 3.7);
    this.stageGroup.add(screen);

    // Screen frame
    this.createScreenFrame(screen.position);
  }

  /**
   * Creates a frame around the LED screen
   */
  private createScreenFrame(position: THREE.Vector3): void {
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.2,
    });

    const frameWidth = 0.2;
    const screenWidth = this.config.width * 0.8;
    const screenHeight = this.config.trussHeight * 0.7;

    // Top frame
    const topFrame = new THREE.BoxGeometry(screenWidth + frameWidth * 2, frameWidth, 0.2);
    const topMesh = new THREE.Mesh(topFrame, frameMaterial);
    topMesh.position.set(position.x, position.y + screenHeight / 2, position.z);
    this.stageGroup.add(topMesh);

    // Bottom frame
    const bottomMesh = new THREE.Mesh(topFrame, frameMaterial);
    bottomMesh.position.set(position.x, position.y - screenHeight / 2, position.z);
    this.stageGroup.add(bottomMesh);

    // Side frames
    const sideFrame = new THREE.BoxGeometry(frameWidth, screenHeight, 0.2);
    const leftMesh = new THREE.Mesh(sideFrame, frameMaterial);
    leftMesh.position.set(position.x - screenWidth / 2 - frameWidth / 2, position.y, position.z);
    this.stageGroup.add(leftMesh);

    const rightMesh = new THREE.Mesh(sideFrame, frameMaterial);
    rightMesh.position.set(position.x + screenWidth / 2 + frameWidth / 2, position.y, position.z);
    this.stageGroup.add(rightMesh);
  }

  /**
   * Creates audience area hint
   */
  private createAudienceArea(): void {
    // Dark floor extending into audience
    const audienceFloorGeometry = new THREE.PlaneGeometry(
      this.config.width * 2,
      30
    );
    const audienceFloorMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      metalness: 0,
      roughness: 1,
      opacity: 0.95,
      transparent: true,
    });
    const audienceFloor = new THREE.Mesh(audienceFloorGeometry, audienceFloorMaterial);
    audienceFloor.rotation.x = -Math.PI / 2;
    audienceFloor.position.set(0, -1, 15);
    audienceFloor.receiveShadow = true;
    this.stageGroup.add(audienceFloor);

    // Barrier/rail in front of stage
    const barrierGeometry = new THREE.BoxGeometry(this.config.width, 1, 0.1);
    const barrierMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.8,
      roughness: 0.3,
    });
    const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
    barrier.position.set(0, -0.5, this.config.depth / 2 + 2);
    this.stageGroup.add(barrier);
  }

  /**
   * Creates stage props for added realism
   */
  private createStageProps(): void {
    // Side monitors
    const monitorGeometry = new THREE.BoxGeometry(2, 1.5, 0.2);
    const monitorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      metalness: 0.7,
      roughness: 0.3,
    });

    const leftMonitor = new THREE.Mesh(monitorGeometry, monitorMaterial);
    leftMonitor.position.set(-this.config.width / 2 + 2, 0.75, this.config.depth / 2 - 1);
    leftMonitor.rotation.y = Math.PI / 6;
    this.stageGroup.add(leftMonitor);

    const rightMonitor = new THREE.Mesh(monitorGeometry, monitorMaterial);
    rightMonitor.position.set(this.config.width / 2 - 2, 0.75, this.config.depth / 2 - 1);
    rightMonitor.rotation.y = -Math.PI / 6;
    this.stageGroup.add(rightMonitor);

    // Speaker stacks (side fill)
    this.createSpeakerStack({ x: -this.config.width / 2 - 3, y: 0, z: 2 });
    this.createSpeakerStack({ x: this.config.width / 2 + 3, y: 0, z: 2 });
  }

  /**
   * Creates a speaker stack
   */
  private createSpeakerStack(position: { x: number; y: number; z: number }): void {
    const speakerMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      metalness: 0.5,
      roughness: 0.6,
    });

    const stackGroup = new THREE.Group();

    // Create multiple speaker boxes
    for (let i = 0; i < 3; i++) {
      const speaker = new THREE.BoxGeometry(1.5, 1, 0.8);
      const speakerMesh = new THREE.Mesh(speaker, speakerMaterial);
      speakerMesh.position.y = i * 1.1 + 0.5;
      speakerMesh.castShadow = true;
      stackGroup.add(speakerMesh);

      // Add speaker cone detail
      const coneGeometry = new THREE.CylinderGeometry(0.3, 0.35, 0.1, 16);
      const coneMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        metalness: 0.8,
        roughness: 0.2,
      });
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);
      cone.position.set(0, i * 1.1 + 0.5, 0.41);
      cone.rotation.x = Math.PI / 2;
      stackGroup.add(cone);
    }

    stackGroup.position.set(position.x, position.y, position.z);
    this.stageGroup.add(stackGroup);
  }

  /**
   * Creates a detailed truss structure with more realistic geometry
   */
  private createDetailedTruss(
    position: { x: number; y: number; z: number },
    length: number,
    horizontal: boolean,
    type: 'back' | 'front' | 'side'
  ): void {
    const trussGroup = new THREE.Group();
    trussGroup.name = `Truss_${type}`;

    const beamMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Main beams (square truss)
    const beamThickness = 0.15;
    const trussWidth = 0.5;

    // Create 4 main beams for square truss
    for (let i = 0; i < 4; i++) {
      const beamGeometry = new THREE.BoxGeometry(
        horizontal ? length : beamThickness,
        beamThickness,
        horizontal ? beamThickness : length
      );
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);

      // Position beams in square formation
      const offsetX = (i % 2 === 0 ? -1 : 1) * trussWidth / 2;
      const offsetY = (i < 2 ? -1 : 1) * trussWidth / 2;

      if (horizontal) {
        beam.position.set(0, offsetY, offsetX);
      } else {
        beam.position.set(offsetX, offsetY, 0);
      }

      beam.castShadow = true;
      trussGroup.add(beam);
    }

    // Cross bracing
    const braceCount = Math.floor(length / 1.5);
    for (let i = 0; i < braceCount; i++) {
      const offset = -length / 2 + (i + 0.5) * (length / braceCount);

      // Diagonal braces
      for (let j = 0; j < 4; j++) {
        const braceGeometry = new THREE.CylinderGeometry(0.03, 0.03, trussWidth * 1.4, 6);
        const brace = new THREE.Mesh(braceGeometry, beamMaterial);

        if (horizontal) {
          brace.position.set(offset, 0, 0);
        } else {
          brace.position.set(0, 0, offset);
        }

        // Rotate for diagonal
        brace.rotation.z = (j % 2 === 0 ? 1 : -1) * Math.PI / 4;
        if (!horizontal) {
          brace.rotation.x = (j < 2 ? 1 : -1) * Math.PI / 4;
        }

        trussGroup.add(brace);
      }

      // Perpendicular braces
      const perpBraceGeometry = new THREE.BoxGeometry(
        horizontal ? 0.05 : trussWidth,
        trussWidth,
        horizontal ? trussWidth : 0.05
      );
      const perpBrace = new THREE.Mesh(perpBraceGeometry, beamMaterial);
      if (horizontal) {
        perpBrace.position.set(offset, 0, 0);
      } else {
        perpBrace.position.set(0, 0, offset);
      }
      trussGroup.add(perpBrace);
    }

    trussGroup.position.set(position.x, position.y, position.z);
    this.stageGroup.add(trussGroup);
  }

  /**
   * Creates a vertical truss tower
   */
  private createVerticalTruss(position: { x: number; y: number; z: number }, height: number): void {
    const trussGroup = new THREE.Group();
    trussGroup.name = 'VerticalTruss';

    const beamMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.9,
      roughness: 0.2,
    });

    const trussWidth = 0.6;
    const beamThickness = 0.15;

    // 4 vertical beams
    for (let i = 0; i < 4; i++) {
      const beamGeometry = new THREE.BoxGeometry(beamThickness, height, beamThickness);
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);

      const offsetX = (i % 2 === 0 ? -1 : 1) * trussWidth / 2;
      const offsetZ = (i < 2 ? -1 : 1) * trussWidth / 2;

      beam.position.set(offsetX, height / 2, offsetZ);
      beam.castShadow = true;
      trussGroup.add(beam);
    }

    // Horizontal bracing
    const braceCount = Math.floor(height / 1.2);
    for (let i = 0; i < braceCount; i++) {
      const yOffset = (i + 0.5) * (height / braceCount);

      // Horizontal braces on all 4 sides
      for (let side = 0; side < 4; side++) {
        const braceGeometry = new THREE.BoxGeometry(
          side % 2 === 0 ? trussWidth : 0.05,
          0.05,
          side % 2 === 0 ? 0.05 : trussWidth
        );
        const brace = new THREE.Mesh(braceGeometry, beamMaterial);
        brace.position.y = yOffset;

        if (side === 0) brace.position.z = trussWidth / 2;
        if (side === 1) brace.position.x = trussWidth / 2;
        if (side === 2) brace.position.z = -trussWidth / 2;
        if (side === 3) brace.position.x = -trussWidth / 2;

        trussGroup.add(brace);
      }

      // Diagonal braces
      for (let j = 0; j < 4; j++) {
        const diagBraceGeometry = new THREE.CylinderGeometry(0.03, 0.03, trussWidth * 1.4, 6);
        const diagBrace = new THREE.Mesh(diagBraceGeometry, beamMaterial);
        diagBrace.position.y = yOffset;
        diagBrace.rotation.z = (j % 2 === 0 ? 1 : -1) * Math.PI / 4;
        diagBrace.rotation.y = j * Math.PI / 2;
        trussGroup.add(diagBrace);
      }
    }

    // Base plate
    const baseGeometry = new THREE.BoxGeometry(trussWidth * 1.5, 0.2, trussWidth * 1.5);
    const basePlate = new THREE.Mesh(baseGeometry, beamMaterial);
    basePlate.position.y = -0.1;
    trussGroup.add(basePlate);

    trussGroup.position.set(position.x, position.y, position.z);
    this.stageGroup.add(trussGroup);
  }


  /**
   * Sets up the lighting controller
   */
  private setupLightingController(): void {
    this.lightingController = new LightingController(this.scene);
    // Create default fixture layout
    this.lightingController.createDefaultLayout();
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  /**
   * Handles window resize
   */
  private onWindowResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  /**
   * Sets up debug GUI
   */
  private setupDebugGUI(): void {
    if (typeof window === 'undefined') return;

    this.gui = new GUI();

    // Stage settings
    const stageFolder = this.gui.addFolder('Stage');
    stageFolder.add(this.config, 'hazeDensity', 0, 1, 0.01).onChange((value: number) => {
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.015 * value;
      }
    });
    stageFolder.add(this.config, 'ambientLight', 0, 1, 0.01).onChange((value: number) => {
      const ambientLight = this.scene.children.find(
        (child) => child instanceof THREE.AmbientLight
      ) as THREE.AmbientLight;
      if (ambientLight) {
        ambientLight.intensity = value;
      }
    });

    // Camera presets
    const cameraFolder = this.gui.addFolder('Camera');
    cameraFolder.add(this, 'cameraPreset', ['front', 'side', 'top', 'dynamic'])
      .onChange((value: string) => {
        this.setCameraPreset(value as any);
      });

    // Lighting controls
    const lightingFolder = this.gui.addFolder('Lighting Controls');
    lightingFolder.add({ blackout: () => this.lightingController.blackout(500) }, 'blackout');
    lightingFolder.add({ whiteout: () => this.lightingController.whiteout(200) }, 'whiteout');
    lightingFolder.add({ flash: () => this.lightingController.flashStrobes(100) }, 'flash');

    // Test patterns
    const testFolder = this.gui.addFolder('Test Patterns');
    testFolder.add({ rainbow: () => this.testRainbowPattern() }, 'rainbow');
    testFolder.add({ sweep: () => this.testSweepPattern() }, 'sweep');
    testFolder.add({ pulse: () => this.testPulsePattern() }, 'pulse');
  }

  /**
   * Test rainbow pattern
   */
  private testRainbowPattern(): void {
    const colors = [
      { r: 1, g: 0, b: 0 },
      { r: 1, g: 0.5, b: 0 },
      { r: 1, g: 1, b: 0 },
      { r: 0, g: 1, b: 0 },
      { r: 0, g: 0, b: 1 },
      { r: 0.5, g: 0, b: 1 },
    ];

    const fixtures = this.lightingController.getAllFixtures();
    fixtures.forEach((fixture, index) => {
      const color = colors[index % colors.length];
      fixture.applyState({ intensity: 1, color } as any, 1000, 'easeInOut');
    });
  }

  /**
   * Test sweep pattern
   */
  private testSweepPattern(): void {
    const movingHeads = this.lightingController.getFixturesByType('moving_head');
    movingHeads.forEach((fixture, index) => {
      setTimeout(() => {
        fixture.applyState(
          {
            pan: Math.random(),
            tilt: 0.3 + Math.random() * 0.4,
            intensity: 1,
            color: { r: 0, g: 0.5, b: 1 },
          } as any,
          2000,
          'easeInOut'
        );
      }, index * 100);
    });
  }

  /**
   * Test pulse pattern
   */
  private testPulsePattern(): void {
    // Pulse on
    this.lightingController.setAllFixtures(
      { intensity: 1, color: { r: 1, g: 1, b: 1 } } as any,
      100,
      'easeIn'
    );

    // Pulse off
    setTimeout(() => {
      this.lightingController.setAllFixtures(
        { intensity: 0 } as any,
        500,
        'easeOut'
      );
    }, 100);
  }

  /**
   * Renders the scene
   */
  render(): void {
    this.composer.render();
  }

  /**
   * Updates the stage
   * @param deltaTime Time since last frame in milliseconds
   */
  update(deltaTime: number): void {
    // Update lighting controller
    this.lightingController.update(deltaTime);

    // Update dynamic camera if enabled
    if (this.cameraPreset === 'dynamic') {
      this.updateDynamicCamera(deltaTime);
    }
  }

  /**
   * Updates dynamic camera movement
   */
  private updateDynamicCamera(deltaTime: number): void {
    this.dynamicCameraTime += deltaTime * 0.00008;

    // More dramatic camera movement
    const radius = 30 + Math.sin(this.dynamicCameraTime * 2) * 5;
    const height = 10 + Math.sin(this.dynamicCameraTime * 0.7) * 5;
    const angle = this.dynamicCameraTime;

    this.camera.position.x = Math.cos(angle) * radius;
    this.camera.position.y = height;
    this.camera.position.z = Math.sin(angle) * radius + 10;

    // Look at slightly above stage center for better framing
    this.camera.lookAt(0, 3, -2);
  }

  /**
   * Sets camera preset
   * @param preset Camera preset name
   */
  setCameraPreset(preset: 'front' | 'side' | 'top' | 'dynamic'): void {
    this.cameraPreset = preset;
    this.dynamicCameraTime = 0;

    switch (preset) {
      case 'front':
        // Dramatic front view showing full stage
        this.camera.position.set(0, 7, 25);
        this.camera.lookAt(0, 3, -2);
        break;
      case 'side':
        // Side angle showing depth
        this.camera.position.set(30, 10, 5);
        this.camera.lookAt(0, 3, 0);
        break;
      case 'top':
        // Overhead view for full layout
        this.camera.position.set(0, 35, 8);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'dynamic':
        // Initial position for animated camera
        this.camera.position.set(25, 10, 20);
        this.camera.lookAt(0, 3, 0);
        break;
    }
  }

  /**
   * Adds a fixture to the stage
   * @param fixture Fixture configuration
   */
  addFixture(fixture: Fixture): void {
    this.lightingController.addFixture(fixture);
  }

  /**
   * Removes a fixture from the stage
   * @param id Fixture ID
   */
  removeFixture(id: string): void {
    this.lightingController.removeFixture(id);
  }

  /**
   * Gets a fixture by ID
   * @param id Fixture ID
   * @returns Fixture or undefined
   */
  getFixture(id: string): Fixture | undefined {
    const fixture = this.lightingController.getFixture(id);
    return fixture?.getState() as Fixture | undefined;
  }

  /**
   * Gets all fixtures
   * @returns Array of all fixtures
   */
  getAllFixtures(): Fixture[] {
    return this.lightingController.getAllFixtures().map((f) => f.getState() as Fixture);
  }

  /**
   * Executes lighting commands
   * @param commands Array of commands to execute
   */
  executeCommands(commands: LightingCommand[]): void {
    this.lightingController.executeCommands(commands);
  }

  /**
   * Starts the render loop
   */
  start(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      const deltaTime = this.clock.getDelta() * 1000; // Convert to milliseconds
      this.update(deltaTime);
      this.render();
    };
    animate();
  }

  /**
   * Stops the render loop
   */
  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
  }

  /**
   * Disposes of all resources
   */
  dispose(): void {
    this.stop();

    // Dispose lighting controller
    this.lightingController.dispose();

    // Dispose GUI
    if (this.gui) {
      this.gui.destroy();
    }

    // Dispose renderer
    this.renderer.dispose();
    this.composer.dispose();

    // Remove from DOM
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }

    // Clear scene
    this.scene.clear();

    // Remove event listeners
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }
}