/**
 * Manages all lighting fixtures and executes lighting commands
 */

import * as THREE from 'three';
import {
  Fixture,
  LightingCommand,
  MovingHead as IMovingHead,
  Strobe as IStrobe,
  WashLight as IWashLight,
  EasingType,
} from '../shared/types';
import { BaseFixtureImpl } from './fixtures/BaseFixture';
import { MovingHead } from './fixtures/MovingHead';
import { Strobe } from './fixtures/Strobe';
import { WashLight } from './fixtures/WashLight';

/**
 * Controller for managing lighting fixtures and executing commands
 */
export class LightingController {
  private fixtures: Map<string, BaseFixtureImpl> = new Map();
  private scene: THREE.Scene;
  private fixtureGroup: THREE.Group;
  private manualOverrideActive: boolean = false;
  private overrideEndTime: number = 0;
  private postEffectDimFactor: number = 1.0;
  private dimEndTime: number = 0;

  /**
   * Creates a new lighting controller
   * @param scene Three.js scene to add fixtures to
   */
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.fixtureGroup = new THREE.Group();
    this.fixtureGroup.name = 'Fixtures';
    this.scene.add(this.fixtureGroup);
  }

  /**
   * Adds a fixture to the controller
   * @param fixture Fixture configuration
   */
  addFixture(fixture: Fixture): void {
    if (this.fixtures.has(fixture.id)) {
      console.warn(`Fixture with ID ${fixture.id} already exists`);
      return;
    }

    let fixtureImpl: BaseFixtureImpl;

    switch (fixture.type) {
      case 'moving_head':
        fixtureImpl = new MovingHead(fixture as IMovingHead);
        break;
      case 'strobe':
        fixtureImpl = new Strobe(fixture as IStrobe);
        break;
      case 'wash':
        fixtureImpl = new WashLight(fixture as IWashLight);
        break;
      default:
        console.warn(`Unknown fixture type: ${(fixture as any).type}`);
        return;
    }

    // Create and add mesh to scene
    const mesh = fixtureImpl.createMesh();
    this.fixtureGroup.add(mesh);

    // Store fixture
    this.fixtures.set(fixture.id, fixtureImpl);
  }

  /**
   * Removes a fixture from the controller
   * @param id Fixture ID to remove
   */
  removeFixture(id: string): void {
    const fixture = this.fixtures.get(id);
    if (!fixture) {
      console.warn(`Fixture with ID ${id} not found`);
      return;
    }

    // Remove from scene
    this.fixtureGroup.remove(fixture.getGroup());

    // Dispose resources
    fixture.dispose();

    // Remove from map
    this.fixtures.delete(id);
  }

  /**
   * Gets a fixture by ID
   * @param id Fixture ID
   * @returns Fixture instance or undefined
   */
  getFixture(id: string): BaseFixtureImpl | undefined {
    return this.fixtures.get(id);
  }

  /**
   * Gets all fixtures
   * @returns Array of all fixtures
   */
  getAllFixtures(): BaseFixtureImpl[] {
    const fixtures: BaseFixtureImpl[] = [];
    this.fixtures.forEach((fixture) => {
      fixtures.push(fixture);
    });
    return fixtures;
  }

  /**
   * Gets fixtures by type
   * @param type Fixture type
   * @returns Array of fixtures of the specified type
   */
  getFixturesByType(type: string): BaseFixtureImpl[] {
    const result: BaseFixtureImpl[] = [];
    this.fixtures.forEach((fixture) => {
      if (fixture.getState().type === type) {
        result.push(fixture);
      }
    });
    return result;
  }

  /**
   * Executes lighting commands
   * @param commands Array of commands to execute
   */
  executeCommands(commands: LightingCommand[]): void {
    for (const command of commands) {
      this.executeCommand(command);
    }
  }

  /**
   * Executes a single lighting command
   * @param command Command to execute
   */
  private executeCommand(command: LightingCommand): void {
    // Get target fixtures
    const targets = this.getTargetFixtures(command.targetId);

    if (targets.length === 0) {
      console.warn(`No fixtures found for target: ${command.targetId}`);
      return;
    }

    // Apply updates to each target
    for (const fixture of targets) {
      fixture.applyState(
        command.updates as any,
        command.transitionMs,
        command.easing
      );
    }
  }

  /**
   * Gets fixtures based on target ID
   * @param targetId Target ID or 'all'
   * @returns Array of target fixtures
   */
  private getTargetFixtures(targetId: string | 'all'): BaseFixtureImpl[] {
    if (targetId === 'all') {
      return this.getAllFixtures();
    }

    // Check if it's a specific fixture ID
    const fixture = this.fixtures.get(targetId);
    if (fixture) {
      return [fixture];
    }

    // Check if it's a fixture type
    const fixturesByType = this.getFixturesByType(targetId);
    if (fixturesByType.length > 0) {
      return fixturesByType;
    }

    return [];
  }

  /**
   * Triggers a manual effect that temporarily overrides audio
   * @param durationMs How long the override lasts
   * @param dimAfterMs How long to dim lights after effect (0 = no dim)
   */
  setManualOverride(durationMs: number, dimAfterMs: number = 0): void {
    this.manualOverrideActive = true;
    this.overrideEndTime = performance.now() + durationMs;
    if (dimAfterMs > 0) {
      this.dimEndTime = this.overrideEndTime + dimAfterMs;
      this.postEffectDimFactor = 0.2; // Dim to 20%
    }
  }

  isManualOverrideActive(): boolean {
    return this.manualOverrideActive;
  }

  getPostEffectDimFactor(): number {
    return this.postEffectDimFactor;
  }

  /**
   * Updates all fixtures
   * @param deltaTime Time since last frame in milliseconds
   */
  update(deltaTime: number): void {
    const now = performance.now();

    // Check if manual override has ended
    if (this.manualOverrideActive && now > this.overrideEndTime) {
      this.manualOverrideActive = false;
    }

    // Handle post-effect dim fade back
    if (this.postEffectDimFactor < 1.0 && now < this.dimEndTime) {
      // Keep dimmed
    } else if (this.postEffectDimFactor < 1.0) {
      // Gradually restore brightness over 500ms
      this.postEffectDimFactor = Math.min(1.0, this.postEffectDimFactor + deltaTime * 0.002);
    }

    // Update all fixtures
    this.fixtures.forEach((fixture) => {
      fixture.update(deltaTime);
    });
  }

  /**
   * Sets all fixtures to a specific state
   * @param state State to apply to all fixtures
   * @param transitionMs Transition duration
   * @param easing Easing type
   */
  setAllFixtures(
    state: Partial<Fixture>,
    transitionMs: number = 0,
    easing: EasingType = 'linear'
  ): void {
    this.executeCommand({
      targetId: 'all',
      updates: state,
      transitionMs,
      easing,
    });
  }

  /**
   * Creates a blackout (all lights off)
   * @param transitionMs Transition duration
   */
  blackout(transitionMs: number = 0): void {
    this.setAllFixtures({ intensity: 0 } as any, transitionMs, 'easeOut');
  }

  /**
   * Creates a whiteout (all lights full intensity white)
   * @param transitionMs Transition duration
   */
  whiteout(transitionMs: number = 0): void {
    this.setManualOverride(transitionMs, 2000); // 2s dim after whiteout
    this.setAllFixtures(
      {
        intensity: 1,
        color: { r: 1, g: 1, b: 1 },
      } as any,
      transitionMs,
      'easeIn'
    );
  }

  /**
   * Triggers all strobes
   * @param duration Flash duration in ms
   */
  flashStrobes(duration: number = 50): void {
    this.setManualOverride(duration, 1500); // 1.5s dim after flash
    const strobes = this.getFixturesByType('strobe');
    for (const strobe of strobes) {
      if (strobe instanceof Strobe) {
        strobe.flash(duration);
      }
    }
  }

  /**
   * Creates default stage layout with fixtures
   */
  createDefaultLayout(): void {
    // Clear existing fixtures
    this.clearAll();

    // Back truss - 8 moving heads
    for (let i = 0; i < 8; i++) {
      const x = -7 + i * 2;
      this.addFixture({
        id: `mh-back-${i + 1}`,
        type: 'moving_head',
        position: { x, y: 6, z: -8 },
        enabled: true,
        pan: 0.5,
        tilt: 0.3,
        intensity: 0,
        color: { r: 1, g: 0, b: 0 },
        beamWidth: 0.2,
        speed: 0.5,
      });
    }

    // Front truss - 6 moving heads
    for (let i = 0; i < 6; i++) {
      const x = -5 + i * 2;
      this.addFixture({
        id: `mh-front-${i + 1}`,
        type: 'moving_head',
        position: { x, y: 5, z: 5 },
        enabled: true,
        pan: 0.5,
        tilt: 0.5,
        intensity: 0,
        color: { r: 0, g: 0, b: 1 },
        beamWidth: 0.3,
        speed: 0.5,
      });
    }

    // Left wash lights - 4 units
    for (let i = 0; i < 4; i++) {
      const z = -6 + i * 3;
      this.addFixture({
        id: `wash-left-${i + 1}`,
        type: 'wash',
        position: { x: -10, y: 4, z },
        enabled: true,
        intensity: 0,
        color: { r: 1, g: 0.5, b: 0 },
        spread: 0.5,
      });
    }

    // Right wash lights - 4 units
    for (let i = 0; i < 4; i++) {
      const z = -6 + i * 3;
      this.addFixture({
        id: `wash-right-${i + 1}`,
        type: 'wash',
        position: { x: 10, y: 4, z },
        enabled: true,
        intensity: 0,
        color: { r: 0, g: 1, b: 0.5 },
        spread: 0.5,
      });
    }

    // Front strobes - 4 units
    for (let i = 0; i < 4; i++) {
      const x = -6 + i * 4;
      this.addFixture({
        id: `strobe-${i + 1}`,
        type: 'strobe',
        position: { x, y: 1, z: 6 },
        enabled: true,
        intensity: 0,
        rate: 10,
        color: { r: 1, g: 1, b: 1 },
        flashDuration: 50,
      });
    }
  }

  /**
   * Removes all fixtures
   */
  clearAll(): void {
    const ids = Array.from(this.fixtures.keys());
    for (const id of ids) {
      this.removeFixture(id);
    }
  }

  /**
   * Disposes of all resources
   */
  dispose(): void {
    this.clearAll();
    this.scene.remove(this.fixtureGroup);
  }
}