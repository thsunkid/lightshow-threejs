# Mapping Engine Documentation

## Overview

The Mapping Engine (Workstream D) is the core component that bridges audio analysis (Workstream A) to stage lighting (Workstream B), optionally using learned styles from Workstream C.

## Architecture

### Core Components

1. **MappingEngine** (`MappingEngine.ts`)
   - Main orchestrator that processes `AudioFrame` objects
   - Generates `LightingCommand` arrays
   - Manages style profiles and configuration
   - Provides both default and style-based mapping

2. **RuleEvaluator** (`rules/RuleEvaluator.ts`)
   - Evaluates style rule trigger conditions
   - Executes lighting actions
   - Manages color palettes
   - Handles rate limiting

3. **DefaultRules** (`rules/DefaultRules.ts`)
   - Provides sensible default mapping rules
   - Includes genre-specific rule sets
   - Utilities for creating and validating custom rules

## Usage Example

```typescript
import { MappingEngine } from './mapping';
import { AudioFrame, Fixture } from '../shared/types';

// Initialize the engine
const engine = new MappingEngine({
  intensityScale: 1.0,      // Global brightness multiplier
  reactivity: 0.7,          // Response smoothing (0=smooth, 1=instant)
  beatSync: true,           // Enable beat synchronization
  strobeMinInterval: 100    // Minimum ms between strobes
});

// Register available fixtures
const fixtures: Fixture[] = [/* your fixtures */];
engine.registerFixtures(fixtures);

// Process audio frames
const audioFrame: AudioFrame = {/* audio data */};
const commands = engine.process(audioFrame);

// Commands can be sent to the stage renderer
commands.forEach(cmd => {
  // Apply lighting command to stage
});
```

## Default Mapping Behavior

When no style profile is loaded, the engine uses intelligent defaults:

1. **Intensity** - Follows audio RMS with configurable scaling
2. **Color** - Maps spectral centroid to hue (warm to cool)
3. **Beat Sync** - Triggers intensity pulses on beats
4. **Movement** - Bass energy drives moving head tilt
5. **Beam Width** - High energy creates wider beams
6. **Color Shifts** - Downbeats trigger palette rotation
7. **Strobes** - High spectral flux triggers strobe effects
8. **Section Awareness** - Different behaviors for verse/chorus/drop

## Style Profiles

Load a learned style profile to override default behavior:

```typescript
import { StyleProfile } from '../shared/types';

const styleProfile: StyleProfile = {
  name: "Justice - Neverender",
  source: "concert-video.mp4",
  palette: {
    primary: [/* RGB colors */],
    accent: [/* RGB colors */],
    strobeColor: { r: 1, g: 1, b: 1 }
  },
  rules: [/* style rules */],
  // ... other properties
};

engine.loadStyle(styleProfile);
```

## Configuration Options

- `intensityScale` (0-2): Global brightness multiplier
- `reactivity` (0-1): Response speed (0=heavily smoothed, 1=instant)
- `beatSync` (boolean): Enable beat-triggered effects
- `strobeMinInterval` (ms): Minimum time between strobe triggers

## Style Rules

Rules define how audio features map to lighting actions:

```typescript
const rule: StyleRule = {
  id: 'drop-strobe',
  name: 'Drop Section Strobe',
  trigger: {
    onBeat: true,
    sections: ['drop'],
    energyThreshold: 0.8
  },
  action: {
    type: 'strobe',
    targets: ['strobe', 'moving_head'],
    color: 'random_from_palette',
    intensity: 1.0,
    durationMs: 100
  },
  probability: 0.6,  // 60% chance when triggered
  priority: 150      // Higher priority evaluated first
};
```

### Trigger Conditions
- `onBeat` / `onDownbeat` - Rhythmic triggers
- `energyThreshold` - Minimum energy level
- `fluxThreshold` - Spectral change threshold
- `sections` - Active during specific song sections
- `frequencyBand` - React to specific frequency ranges

### Action Types
- `strobe` - Flash effects
- `color_change` - Smooth color transitions
- `intensity_pulse` - Brightness pulses
- `movement` - Pan/tilt for moving heads
- `blackout` - All lights off
- `all_on` - All lights to specified state

## Integration Points

### Input (from Workstream A)
- Receives `AudioFrame` objects at regular intervals (~60 FPS)
- Each frame contains rhythm, energy, and spectral data

### Output (to Workstream B)
- Generates `LightingCommand` arrays
- Each command targets specific fixtures or all
- Includes transition timing and easing

### Style Learning (from Workstream C)
- Accepts `StyleProfile` objects
- Can operate with or without a loaded style
- Supports hot-swapping styles during playback

## Performance Considerations

- Commands are generated at ~60 FPS
- Smoothing prevents jarring transitions
- Rate limiting prevents seizure-inducing flash rates
- Fixture registration allows targeted updates
- State tracking enables consistent behavior

## Testing

The engine includes comprehensive default rules that produce good results without any configuration. Test with various audio inputs to verify:

1. Beat detection triggers pulses
2. Energy changes affect intensity
3. Frequency content drives color
4. Section changes alter behavior
5. Smoothing creates natural transitions