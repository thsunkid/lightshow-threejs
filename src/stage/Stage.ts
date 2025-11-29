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
    this.scene.fog = new THREE.FogExp2(0x000000, 0.02 * this.config.hazeDensity);
    this.scene.background = new THREE.Color(0x000000);
  }

  /**
   * Sets up the camera
   */
  private setupCamera(): void {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
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

    // Bloom pass for glow effects
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
      1.5, // strength
      0.4, // radius
      0.85  // threshold
    );
    this.composer.addPass(bloomPass);

    // Output pass
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  /**
   * Sets up basic scene lighting
   */
  private setupLighting(): void {
    // Ambient light for minimal visibility
    const ambientLight = new THREE.AmbientLight(0x404040, this.config.ambientLight);
    this.scene.add(ambientLight);

    // Subtle fill light
    const fillLight = new THREE.DirectionalLight(0x202040, 0.2);
    fillLight.position.set(0, 10, 5);
    this.scene.add(fillLight);
  }

  /**
   * Creates stage geometry (floor, trusses, etc.)
   */
  private createStageGeometry(): void {
    this.stageGroup = new THREE.Group();
    this.stageGroup.name = 'StageGeometry';

    // Stage floor
    const floorGeometry = new THREE.BoxGeometry(
      this.config.width,
      0.5,
      this.config.depth
    );
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      metalness: 0.3,
      roughness: 0.7,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -0.25;
    floor.receiveShadow = true;
    this.stageGroup.add(floor);

    // Stage surface (reflective)
    const surfaceGeometry = new THREE.PlaneGeometry(
      this.config.width,
      this.config.depth
    );
    const surfaceMaterial = new THREE.MeshStandardMaterial({
      color: 0x050505,
      metalness: 0.8,
      roughness: 0.2,
      envMapIntensity: 0.5,
    });
    const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.01;
    surface.receiveShadow = true;
    this.stageGroup.add(surface);

    // Back truss
    this.createTruss(
      { x: 0, y: this.config.trussHeight, z: -this.config.depth / 2 - 2 },
      this.config.width * 0.8,
      true
    );

    // Front truss
    this.createTruss(
      { x: 0, y: this.config.trussHeight - 1, z: this.config.depth / 2 },
      this.config.width * 0.6,
      true
    );

    // Side trusses
    this.createTruss(
      { x: -this.config.width / 2 - 1, y: this.config.trussHeight - 2, z: 0 },
      this.config.depth * 0.8,
      false
    );
    this.createTruss(
      { x: this.config.width / 2 + 1, y: this.config.trussHeight - 2, z: 0 },
      this.config.depth * 0.8,
      false
    );

    this.scene.add(this.stageGroup);
  }

  /**
   * Creates a truss structure
   */
  private createTruss(
    position: { x: number; y: number; z: number },
    length: number,
    horizontal: boolean
  ): void {
    const trussGroup = new THREE.Group();

    // Main beam
    const beamGeometry = new THREE.BoxGeometry(
      horizontal ? length : 0.3,
      0.3,
      horizontal ? 0.3 : length
    );
    const beamMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.3,
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    trussGroup.add(beam);

    // Support structures
    const supportCount = Math.floor(length / 2);
    for (let i = 0; i < supportCount; i++) {
      const offset = -length / 2 + (i + 1) * (length / supportCount);
      const supportGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8);
      const support1 = new THREE.Mesh(supportGeometry, beamMaterial);
      const support2 = new THREE.Mesh(supportGeometry, beamMaterial);

      if (horizontal) {
        support1.position.set(offset, 0, 0.2);
        support2.position.set(offset, 0, -0.2);
      } else {
        support1.position.set(0.2, 0, offset);
        support2.position.set(-0.2, 0, offset);
      }

      support1.rotation.z = Math.PI / 4;
      support2.rotation.z = -Math.PI / 4;
      trussGroup.add(support1, support2);
    }

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
        this.scene.fog.density = 0.02 * value;
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
    this.dynamicCameraTime += deltaTime * 0.0001;

    const radius = 25;
    const height = 8 + Math.sin(this.dynamicCameraTime * 0.5) * 3;
    const angle = this.dynamicCameraTime;

    this.camera.position.x = Math.cos(angle) * radius;
    this.camera.position.y = height;
    this.camera.position.z = Math.sin(angle) * radius;
    this.camera.lookAt(0, 2, 0);
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
        this.camera.position.set(0, 5, 20);
        this.camera.lookAt(0, 2, 0);
        break;
      case 'side':
        this.camera.position.set(25, 8, 0);
        this.camera.lookAt(0, 2, 0);
        break;
      case 'top':
        this.camera.position.set(0, 30, 5);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'dynamic':
        // Initial position, will be animated
        this.camera.position.set(20, 8, 20);
        this.camera.lookAt(0, 2, 0);
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