# Intelligent Lighting Design System

## Overview

The Intelligent Lighting Design System creates dynamic, context-aware lighting shows that respond to song structure and audio features with purposeful variation. Instead of predictable, repetitive responses, it generates dramatic contrasts between sections while maintaining musical intentionality.

## Key Components

### 1. ShowPlanner (`src/mapping/ShowPlanner.ts`)

Creates comprehensive show plans from pre-analysis results.

#### Features:
- **Predefined Lighting Looks**: 8 distinct visual styles (Deep Blue, Fire, Minimal, Rave, Ethereal, Electric Teal, Sunset, Purple Haze)
- **Section-Aware Planning**: Different behaviors for intro, verse, chorus, drop, breakdown, buildup, bridge, and outro
- **Intensity Levels**: Low, medium, high, and extreme intensity settings
- **Contextual Features**: Flakes, strobes, and movement patterns enabled/disabled based on section type

#### Usage:

```typescript
import { ShowPlanner } from './mapping/ShowPlanner';
import { PreAnalysisResult } from './audio/CueScheduler';

// Create planner
const planner = new ShowPlanner();

// Generate plan from pre-analysis
const analysis: PreAnalysisResult = {
  bpm: 128,
  beats: [0, 0.5, 1.0, 1.5],
  downbeats: [0, 2, 4, 6],
  sections: [
    { start: 0, end: 16, type: 'intro', energy: 0.3 },
    { start: 16, end: 48, type: 'verse', energy: 0.5 },
    { start: 48, end: 80, type: 'chorus', energy: 0.8 },
    { start: 80, end: 96, type: 'drop', energy: 0.95 },
  ],
  averageEnergy: 0.6,
};

const plan = planner.createPlan(analysis);

// Get scene at specific time
const scene = planner.getSceneAt(32.5); // Get scene at 32.5 seconds
console.log(scene.look.name); // "Electric Teal"
console.log(scene.intensity); // "medium"
console.log(scene.features.useFlakes); // false
```

#### Scene Structure:

```typescript
interface Scene {
  startTime: number;
  endTime: number;
  sectionType: SongSection;
  look: LightingLook;
  intensity: 'low' | 'medium' | 'high' | 'extreme';
  palette: RGB[];
  features: {
    useFlakes: boolean;
    flakeIntensity: number;
    useStrobes: boolean;
    movingHeadPattern: 'slow' | 'medium' | 'fast' | 'sweep' | 'random';
    washPattern: 'static' | 'pulse' | 'chase';
  };
}
```

### 2. LightingVariations (`src/mapping/LightingVariations.ts`)

Provides multiple response options for audio features to avoid predictability.

#### Variation Types:

1. **Beat Variations** (5 options):
   - Intensity pulse
   - Flash all
   - Color shift
   - Moving head snap
   - Strobe accent

2. **Energy Variations** (4 options):
   - Brightness scale
   - Beam spread
   - Color warmth
   - Movement speed

3. **Spectral Variations** (4 options):
   - Frequency-to-color mapping
   - Bass-driven intensity
   - Treble-driven movement
   - Spectral flux strobe

4. **Section Variations** (3 options):
   - Breakdown minimal
   - Drop explosion
   - Buildup crescendo

#### Usage:

```typescript
import { VariationSelector } from './mapping/LightingVariations';
import { AudioFrame } from './shared/types';
import { Scene } from './mapping/ShowPlanner';

const selector = new VariationSelector();

function processFrame(frame: AudioFrame, scene: Scene) {
  // Get varied responses
  const beatCommands = selector.getBeatResponse(frame, scene);
  const energyCommands = selector.getEnergyResponse(frame, scene);
  const spectralCommands = selector.getSpectralResponse(frame, scene);
  const sectionCommands = selector.getSectionResponse(frame, scene);

  // Apply all commands
  executeCommands([...beatCommands, ...energyCommands, ...spectralCommands, ...sectionCommands]);
}
```

#### Variation Selection:

Variations are selected randomly based on weights:
- Higher weight = more likely to be selected
- Never selects the same variation twice in a row
- Contextual: some variations only trigger in specific conditions

### 3. FlakeLightController (`src/stage/FlakeLightController.ts`)

Manages contextual flake light system with multiple movement patterns.

#### Features:
- **Contextual Activation**: Only appears during specific sections
- **5 Movement Patterns**: Drift, Pulse, Burst, Rain, Spiral
- **Audio Reactivity**: Responds to beats and frequency content
- **Smooth Fading**: Graceful enable/disable transitions
- **Dual Color System**: Warm (gold) and cool (blue) particles

#### Usage:

```typescript
import { FlakeLightController } from './stage/FlakeLightController';

// Access through Stage
const stage = new Stage(container);
stage.init();

const flakeController = stage.getFlakeLightController();

// Control visibility and intensity
flakeController.setEnabled(true);
flakeController.setIntensity(0.7);

// Change movement pattern
flakeController.setPattern('spiral'); // or 'drift', 'pulse', 'burst', 'rain'

// Customize colors
flakeController.setColors(
  { r: 1.0, g: 0.9, b: 0.4 }, // warm
  { r: 0.6, g: 0.8, b: 1.0 }  // cool
);

// Update with audio (called automatically in Stage.update)
flakeController.update(audioFrame);
```

#### Movement Patterns:

- **Drift**: Subtle floating with sine-wave motion
- **Pulse**: Radial pulsing from center
- **Burst**: Explosive outward movement
- **Rain**: Falling downward effect
- **Spiral**: Rotating spiral motion

### 4. MappingEngine Integration

The MappingEngine now supports show plans for intelligent lighting control.

#### Usage:

```typescript
import { MappingEngine } from './mapping/MappingEngine';

const engine = new MappingEngine();

// Create and load a show plan
const planner = engine.getShowPlanner();
const plan = planner.createPlan(analysis);
engine.loadShowPlan(plan);

// Process frames - will use show plan
const commands = engine.process(audioFrame);

// Clear plan to return to default mapping
engine.clearShowPlan();
```

## Design Principles

### 1. Dramatic Contrast

Different sections have distinct visual identities:

- **Intro/Outro**: Atmospheric, minimal lighting
- **Verse**: Subtle, consistent lighting
- **Chorus**: Energetic, full lighting with flakes
- **Drop**: Explosive, extreme intensity with strobes
- **Breakdown**: Minimal, sparse lighting
- **Buildup**: Progressive intensity increase

### 2. Purposeful Randomization

Randomization is constrained to maintain musical coherence:

- Variations are weighted (more common behaviors have higher weights)
- Same variation never repeats twice in a row
- Section-specific variations only trigger in appropriate contexts
- Beat responses are always musically timed

### 3. Section Awareness

Each section type has predefined characteristics:

```typescript
// Example: Drop section
{
  useFlakes: true,
  flakeIntensity: 1.0,
  useStrobes: true,
  movingHeadPattern: 'fast',
  washPattern: 'chase',
}

// Example: Breakdown section
{
  useFlakes: false,
  flakeIntensity: 0,
  useStrobes: false,
  movingHeadPattern: 'slow',
  washPattern: 'static',
}
```

### 4. Buildup & Release

Energy builds and releases naturally:

- **Buildup sections**: Intensity increases progressively based on position in section
- **Drop sections**: Immediate explosion of light
- **Breakdown sections**: Sudden cut to minimal lighting
- **Transitions**: Smooth fades, cuts, builds, or explosions based on context

## Predefined Lighting Looks

### Deep Blue
- **Base Color**: Blue (#1A4DE5)
- **Accent Color**: Cyan (#4DCCFF)
- **Use Cases**: Intro, verse, calm sections
- **Movement**: Slow, subtle

### Fire
- **Base Color**: Red (#FF3300)
- **Accent Color**: Orange (#FF9900)
- **Use Cases**: Chorus, drop, high energy
- **Movement**: Fast, aggressive

### Minimal
- **Base Color**: Soft white (#CCCCЕ5)
- **Accent Color**: Pure white (#FFFFFF)
- **Use Cases**: Breakdown, bridge, minimal sections
- **Movement**: Minimal, centered

### Rave
- **Base Color**: Magenta (#FF00FF)
- **Accent Color**: Green (#00FF00)
- **Use Cases**: Drop, high energy sections
- **Movement**: Multi-directional, chaotic

### Ethereal
- **Base Color**: White (#E5E5FF)
- **Accent Color**: Lavender (#B380FF)
- **Use Cases**: Intro, outro, atmospheric sections
- **Movement**: Slow drift
- **Special**: Heavy flake usage

### Electric Teal
- **Base Color**: Teal (#00CCB3)
- **Accent Color**: Cyan (#00FFE5)
- **Use Cases**: Buildup, chorus, energetic verses
- **Movement**: Medium speed

### Sunset
- **Base Color**: Orange (#FF6633)
- **Accent Color**: Gold (#FFB34D)
- **Use Cases**: Warm sections, buildups
- **Movement**: Medium speed

### Purple Haze
- **Base Color**: Purple (#9933E5)
- **Accent Color**: Pink (#CC66FF)
- **Use Cases**: Bridge, atmospheric sections
- **Movement**: Slow

## Example: Complete Integration

```typescript
import { Stage } from './stage/Stage';
import { MappingEngine } from './mapping/MappingEngine';
import { AudioAnalyzer } from './audio/AudioAnalyzer';

// Initialize stage
const stage = new Stage(document.getElementById('stage-container'));
stage.init();
stage.start();

// Initialize mapping engine
const mappingEngine = new MappingEngine();

// Register fixtures
mappingEngine.registerFixtures(stage.getAllFixtures());

// Perform pre-analysis and create show plan
const analyzer = new AudioAnalyzer(audioContext);
const analysis = await analyzer.preAnalyze(audioBuffer);

const planner = mappingEngine.getShowPlanner();
const showPlan = planner.createPlan(analysis);
mappingEngine.loadShowPlan(showPlan);

// Get flake controller for scene-based control
const flakeController = stage.getFlakeLightController();

// Process audio frames
function onAudioFrame(frame: AudioFrame) {
  // Get current scene
  const scene = planner.getSceneAt(frame.timestamp / 1000);

  // Update flake controller based on scene
  if (scene) {
    flakeController.setEnabled(scene.features.useFlakes);
    flakeController.setIntensity(scene.features.flakeIntensity);

    // Set pattern based on section
    const pattern = scene.sectionType === 'drop' ? 'burst' :
                   scene.sectionType === 'breakdown' ? 'drift' :
                   scene.features.movingHeadPattern === 'fast' ? 'spiral' : 'drift';
    flakeController.setPattern(pattern);

    // Set colors from scene palette
    if (scene.palette.length >= 2) {
      flakeController.setColors(scene.palette[0], scene.palette[1]);
    }
  }

  // Generate and execute lighting commands
  const commands = mappingEngine.process(frame);
  stage.executeCommands(commands);

  // Update flakes with audio
  stage.updateFlakeLights(frame);
}

// Connect to audio analysis
analyzer.on('frame', onAudioFrame);
```

## Advanced Configuration

### Custom Scene Creation

```typescript
const customScene: Scene = {
  startTime: 60,
  endTime: 90,
  sectionType: 'drop',
  look: {
    name: 'Custom Fire',
    baseColor: { r: 1.0, g: 0.1, b: 0.0 },
    accentColor: { r: 1.0, g: 0.8, b: 0.0 },
    movingHeadPositions: [
      { pan: 0.2, tilt: 0.6 },
      { pan: 0.8, tilt: 0.6 },
    ],
  },
  intensity: 'extreme',
  palette: [
    { r: 1.0, g: 0.1, b: 0.0 },
    { r: 1.0, g: 0.5, b: 0.0 },
    { r: 1.0, g: 0.8, b: 0.2 },
  ],
  features: {
    useFlakes: true,
    flakeIntensity: 1.0,
    useStrobes: true,
    movingHeadPattern: 'fast',
    washPattern: 'chase',
  },
};
```

### Custom Variation

```typescript
import { LightingVariation } from './mapping/LightingVariations';

const customVariation: LightingVariation = {
  name: 'custom-sweep',
  weight: 2.5,
  respond: (frame, scene) => {
    if (!frame.isBeat) return [];

    return [
      {
        targetId: 'moving_head',
        updates: {
          pan: Math.random(),
          tilt: 0.3 + Math.random() * 0.4,
          color: scene.palette[0],
        },
        transitionMs: 300,
        easing: 'easeInOut',
      },
    ];
  },
};

// Add to variation array
BEAT_VARIATIONS.push(customVariation);
```

## Performance Considerations

1. **Variation Selection**: Computed once per beat, not every frame
2. **Flake Particles**: Limited to 300 total (150 warm + 150 cool)
3. **Scene Lookup**: O(n) search through scenes (optimizable with binary search)
4. **Command Generation**: Filtered by scene features to avoid unnecessary commands

## Testing

The system can be tested without audio by simulating frames:

```typescript
const testFrame: AudioFrame = {
  timestamp: 32000, // 32 seconds
  isBeat: true,
  isDownbeat: false,
  tempo: 128,
  beatPhase: 0,
  beatNumber: 64,
  rms: 0.7,
  energy: 0.8,
  peak: 0.85,
  spectralCentroid: 0.5,
  spectralFlux: 0.6,
  lowEnergy: 0.7,
  midEnergy: 0.6,
  highEnergy: 0.4,
  section: 'chorus',
  sectionConfidence: 0.9,
};

const commands = mappingEngine.process(testFrame);
console.log(`Generated ${commands.length} commands`);
```

## Future Enhancements

Potential areas for expansion:

1. **Machine Learning Integration**: Train on user-created shows
2. **Transition Choreography**: More complex transition animations
3. **Color Palette Learning**: Extract palettes from album artwork
4. **Fixture Grouping**: Coordinate fixture groups for patterns
5. **Beat Prediction**: Anticipate drops and buildups
6. **Energy Smoothing**: Multi-frame energy averaging
7. **Custom Look Library**: User-defined lighting looks
8. **Scene Interpolation**: Smooth blending between scenes
