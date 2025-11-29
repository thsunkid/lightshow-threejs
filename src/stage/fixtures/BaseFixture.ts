/**
 * Abstract base class for all lighting fixtures
 */

import * as THREE from 'three';
import { BaseFixture as IBaseFixture, RGB } from '../../shared/types';

/**
 * Abstract base implementation for all lighting fixtures
 */
export abstract class BaseFixtureImpl<T extends IBaseFixture = IBaseFixture> {
  protected group: THREE.Group;
  protected state: T;
  protected light?: THREE.Light;
  protected mesh?: THREE.Mesh;
  protected targetState: Partial<T> = {};
  protected transitions: Map<string, Transition> = new Map();

  /**
   * Creates a new fixture
   * @param initialState Initial fixture state
   */
  constructor(initialState: T) {
    this.state = { ...initialState };
    this.group = new THREE.Group();
    this.group.position.set(
      initialState.position.x,
      initialState.position.y,
      initialState.position.z
    );
  }

  /**
   * Creates the Three.js mesh and light for this fixture
   */
  abstract createMesh(): THREE.Group;

  /**
   * Updates the fixture state each frame
   * @param deltaTime Time since last frame in milliseconds
   */
  abstract update(deltaTime: number): void;

  /**
   * Applies state changes to the fixture
   * @param state Partial state to apply
   * @param transitionMs Transition duration in milliseconds
   * @param easing Easing type for the transition
   */
  abstract applyState(
    state: Partial<T>,
    transitionMs?: number,
    easing?: string
  ): void;

  /**
   * Cleans up Three.js resources
   */
  abstract dispose(): void;

  /**
   * Gets the fixture's Three.js group
   */
  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * Gets the current fixture state
   */
  getState(): T {
    return { ...this.state };
  }

  /**
   * Gets the fixture ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Checks if fixture is enabled
   */
  isEnabled(): boolean {
    return this.state.enabled;
  }

  /**
   * Sets enabled state
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    this.group.visible = enabled;
    if (this.light) {
      this.light.visible = enabled;
    }
    if (this.mesh) {
      this.mesh.visible = enabled;
    }
  }

  /**
   * Converts RGB (0-1) to Three.js color
   */
  protected rgbToColor(rgb: RGB): THREE.Color {
    return new THREE.Color(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Converts Three.js color to RGB (0-1)
   */
  protected colorToRgb(color: THREE.Color): RGB {
    return {
      r: color.r,
      g: color.g,
      b: color.b,
    };
  }

  /**
   * Updates transitions
   */
  protected updateTransitions(deltaTime: number): void {
    const completed: string[] = [];

    this.transitions.forEach((transition, key) => {
      transition.elapsed += deltaTime;
      const progress = Math.min(transition.elapsed / transition.duration, 1);
      const easedProgress = this.applyEasing(progress, transition.easing);

      // Apply the transition
      const value = this.interpolateValue(
        transition.startValue,
        transition.targetValue,
        easedProgress
      );
      this.setStateValue(key, value);

      if (progress >= 1) {
        completed.push(key);
      }
    });

    // Remove completed transitions
    completed.forEach((key) => this.transitions.delete(key));
  }

  /**
   * Sets a value in the state object
   */
  protected setStateValue(key: string, value: any): void {
    if (key.includes('.')) {
      const keys = key.split('.');
      let obj: any = this.state;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
    } else {
      (this.state as any)[key] = value;
    }
  }

  /**
   * Gets a value from the state object
   */
  protected getStateValue(key: string): any {
    if (key.includes('.')) {
      const keys = key.split('.');
      let obj: any = this.state;
      for (const k of keys) {
        obj = obj[k];
      }
      return obj;
    } else {
      return (this.state as any)[key];
    }
  }

  /**
   * Interpolates between two values
   */
  protected interpolateValue(start: any, end: any, progress: number): any {
    if (typeof start === 'number' && typeof end === 'number') {
      return start + (end - start) * progress;
    } else if (typeof start === 'object' && 'r' in start) {
      // RGB color
      return {
        r: start.r + (end.r - start.r) * progress,
        g: start.g + (end.g - start.g) * progress,
        b: start.b + (end.b - start.b) * progress,
      };
    }
    return progress >= 1 ? end : start;
  }

  /**
   * Applies easing to progress value
   */
  protected applyEasing(progress: number, easing: string): number {
    switch (easing) {
      case 'easeIn':
        return progress * progress;
      case 'easeOut':
        return 1 - (1 - progress) * (1 - progress);
      case 'easeInOut':
        return progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      case 'snap':
        return progress >= 1 ? 1 : 0;
      default: // linear
        return progress;
    }
  }

  /**
   * Starts a transition for a property
   */
  protected startTransition(
    key: string,
    targetValue: any,
    duration: number,
    easing: string = 'linear'
  ): void {
    const currentValue = this.getStateValue(key);
    this.transitions.set(key, {
      startValue: currentValue,
      targetValue,
      duration,
      elapsed: 0,
      easing,
    });
  }
}

/**
 * Transition state for animated property changes
 */
interface Transition {
  startValue: any;
  targetValue: any;
  duration: number;
  elapsed: number;
  easing: string;
}