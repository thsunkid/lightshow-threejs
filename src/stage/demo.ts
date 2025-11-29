/**
 * Demo script to test the Stage implementation
 */

import { Stage } from './Stage';
import { TEST_MOVING_HEAD, TEST_LIGHTING_COMMAND } from '../shared/types';

// Wait for DOM to be ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Create or get canvas container
    let container = document.getElementById('canvas-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'canvas-container';
      container.style.width = '100vw';
      container.style.height = '100vh';
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      document.body.appendChild(container);
      document.body.style.margin = '0';
      document.body.style.overflow = 'hidden';
    }

    // Create stage
    const stage = new Stage(container, {
      hazeDensity: 0.5,
      ambientLight: 0.1,
    });

    // Initialize stage
    stage.init();

    // Add test fixture
    stage.addFixture(TEST_MOVING_HEAD);

    // Start render loop
    stage.start();

    // Demo sequence
    setTimeout(() => {
      console.log('Executing test lighting command...');
      stage.executeCommands([TEST_LIGHTING_COMMAND]);
    }, 1000);

    // Test rainbow pattern after 3 seconds
    setTimeout(() => {
      console.log('Starting rainbow pattern...');
      const fixtures = stage.getAllFixtures();
      const colors = [
        { r: 1, g: 0, b: 0 },
        { r: 1, g: 0.5, b: 0 },
        { r: 1, g: 1, b: 0 },
        { r: 0, g: 1, b: 0 },
        { r: 0, g: 0, b: 1 },
        { r: 0.5, g: 0, b: 1 },
      ];

      fixtures.forEach((fixture, index) => {
        const color = colors[index % colors.length];
        stage.executeCommands([
          {
            targetId: fixture.id,
            updates: { intensity: 1, color },
            transitionMs: 2000,
            easing: 'easeInOut',
          },
        ]);
      });
    }, 3000);

    // Test strobe effect after 6 seconds
    setTimeout(() => {
      console.log('Testing strobe effect...');
      stage.executeCommands([
        {
          targetId: 'strobe',
          updates: { intensity: 1, rate: 20 },
          transitionMs: 100,
          easing: 'easeIn',
        },
      ]);

      // Stop strobe after 2 seconds
      setTimeout(() => {
        stage.executeCommands([
          {
            targetId: 'strobe',
            updates: { intensity: 0 },
            transitionMs: 500,
            easing: 'easeOut',
          },
        ]);
      }, 2000);
    }, 6000);

    // Test moving head sweep after 10 seconds
    setTimeout(() => {
      console.log('Testing moving head sweep...');
      stage.executeCommands([
        {
          targetId: 'moving_head',
          updates: {
            pan: 1,
            tilt: 0.5,
            intensity: 1,
            color: { r: 0, g: 1, b: 0.5 },
          },
          transitionMs: 3000,
          easing: 'easeInOut',
        },
      ]);

      setTimeout(() => {
        stage.executeCommands([
          {
            targetId: 'moving_head',
            updates: {
              pan: 0,
              tilt: 0.3,
              color: { r: 1, g: 0, b: 0.5 },
            },
            transitionMs: 3000,
            easing: 'easeInOut',
          },
        ]);
      }, 3500);
    }, 10000);

    // Make stage globally available for debugging
    (window as any).stage = stage;
    console.log('Stage demo started! Access the stage via window.stage');
  });
}