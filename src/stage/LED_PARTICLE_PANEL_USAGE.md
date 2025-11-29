# LED Particle Panel Usage Guide

## Overview

The LED Particle Panel is an audio-reactive particle system that creates dynamic visual effects on the stage's LED back panel. It uses curl noise for organic, fluid-like particle movement and responds dramatically to music.

## Features

- **Curl Noise**: Particles move in organic, swirling patterns using 3D curl noise
- **Audio Reactivity**:
  - High frequencies → amplitude (particle displacement)
  - Mid frequencies → offset gain (wave motion)
  - Low frequencies → time advancement (rhythmic pacing)
  - Beats → expansion pulse
  - Downbeats → extra intensity burst
- **Shader-based**: Custom GLSL vertex and fragment shaders for optimal performance
- **Customizable**: Adjustable colors, particle count, and panel dimensions

## Basic Usage

The LED Particle Panel is automatically created when you create a Stage:

```typescript
import { Stage } from './stage';
import { AudioFrame } from './shared/types';

// Create stage (LED panel is automatically initialized)
const stage = new Stage(container, {
  width: 20,
  depth: 10,
  trussHeight: 6,
});

stage.init();
stage.start();
```

## Updating with Audio Data

To make the particles respond to music, call `updateLEDPanel()` with an audio frame:

```typescript
// In your audio processing loop
function onAudioFrame(frame: AudioFrame) {
  stage.updateLEDPanel(frame);
}
```

The `AudioFrame` should contain:
- `highEnergy` (0-1): Controls particle displacement amplitude
- `midEnergy` (0-1): Controls wave motion intensity
- `lowEnergy` (0-1): Affects time advancement speed
- `energy` (0-1): Overall energy, affects opacity
- `isBeat` (boolean): Triggers particle expansion pulse
- `isDownbeat` (boolean): Triggers extra intensity burst

## Customization

### Changing Colors

```typescript
const panel = stage.getLEDParticlePanel();
if (panel) {
  panel.setColors(
    { r: 0.0, g: 0.1, b: 0.2 },  // Base color (dark blue)
    { r: 0.3, g: 0.5, b: 1.0 }   // Accent color (bright blue)
  );
}
```

### Enabling/Disabling

```typescript
const panel = stage.getLEDParticlePanel();
if (panel) {
  panel.setEnabled(false); // Hide particles
  panel.setEnabled(true);  // Show particles
}
```

### Custom Configuration

To create a panel with custom settings, modify the Stage.ts file in the `createBackWall()` method:

```typescript
this.ledParticlePanel = new LEDParticlePanel({
  width: 16,              // Panel width in meters
  height: 4.2,            // Panel height in meters
  particleCount: 5000,    // Number of particles (1000-5000 recommended)
  baseColor: new THREE.Color(0x001030),   // Dark blue base
  accentColor: new THREE.Color(0x4080ff), // Bright blue accent
});
```

## Audio Mapping Details

The particle system maps audio features to shader uniforms as follows:

| Audio Feature | Shader Uniform | Effect | Smoothing |
|---------------|----------------|--------|-----------|
| `highEnergy` | `uAmplitude` | Curl noise displacement (×2.0) | 0.1 |
| `midEnergy` | `uOffsetGain` | Wave motion intensity (×0.5) | 0.15 |
| `isBeat` | `uBeat` | Expansion pulse (1.0, decays at 0.9) | Instant attack |
| `lowEnergy` | `uTime` advancement | Rhythmic time progression | Direct |
| `energy` | `uOpacity` | Overall visibility (0.3 + energy × 0.7) | 0.1 |
| `isDownbeat` | `uBeat` + `uFrequency` | Extra burst + freq spike | Instant |

## Shader Architecture

### Vertex Shader (`ledParticle.vert`)
- Applies curl noise for organic displacement
- Adds wave motion based on particle position and phase
- Implements beat-responsive expansion
- Calculates distance for color interpolation
- Applies size attenuation based on camera distance

### Fragment Shader (`ledParticle.frag`)
- Renders circular particles with soft edges
- Interpolates between base and accent colors based on displacement
- Adds center glow for brightness
- Uses additive blending for volumetric effect

## Performance Considerations

- **Particle Count**: 3000 particles is the default. Lower for mobile, higher for desktop
- **Update Frequency**: Call `updateLEDPanel()` at your audio frame rate (typically 60fps)
- **Blending**: Uses additive blending which is GPU-accelerated
- **Frustum Culling**: Disabled to ensure consistent rendering

## Example: Full Integration

```typescript
import { Stage } from './stage';
import { AudioAnalyzer } from './audio';

// Setup
const container = document.getElementById('stage-container')!;
const stage = new Stage(container);
stage.init();
stage.start();

// Create audio analyzer
const audioAnalyzer = new AudioAnalyzer();
await audioAnalyzer.init();

// Start playback
await audioAnalyzer.loadAudio('path/to/song.mp3');
audioAnalyzer.play();

// Update loop
audioAnalyzer.on('frame', (frame) => {
  // Update LED panel with audio data
  stage.updateLEDPanel(frame);

  // Optionally change colors based on section
  const panel = stage.getLEDParticlePanel();
  if (panel && frame.section === 'drop') {
    panel.setColors(
      { r: 0.1, g: 0.0, b: 0.2 },  // Purple base for drop
      { r: 1.0, g: 0.3, b: 0.8 }   // Magenta accent
    );
  }
});
```

## Files

- `src/stage/LEDParticlePanel.ts` - Main class implementation
- `src/stage/shaders/curlNoise.glsl` - Curl noise function (standalone, for reference)
- `src/stage/shaders/ledParticle.vert` - Vertex shader (includes curl noise)
- `src/stage/shaders/ledParticle.frag` - Fragment shader
- `src/stage/Stage.ts` - Integration point (see `createBackWall()` and `updateLEDPanel()`)

## Reference

Based on the Codrops article: [Creating Audio-Reactive Visuals with Dynamic Particles in Three.js](https://tympanus.net/codrops/2023/12/19/creating-audio-reactive-visuals-with-dynamic-particles-in-three-js)
