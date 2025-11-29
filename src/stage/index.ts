/**
 * Workstream B: 3D Stage & Lighting Simulation
 *
 * This module is responsible for:
 * - Three.js scene setup and rendering
 * - Lighting fixture implementations
 * - Volumetric lighting effects
 * - Executing lighting commands
 * - Contextual flake light system
 */

export { Stage } from './Stage';
export { LightingController } from './LightingController';
export { LEDParticlePanel } from './LEDParticlePanel';
export { FlakeLightController, type FlakeConfig, type FlakePattern } from './FlakeLightController';
export { MovingHead } from './fixtures/MovingHead';
export { Strobe } from './fixtures/Strobe';
export { WashLight } from './fixtures/WashLight';
