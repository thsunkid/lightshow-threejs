# Lightshow Generator

**Generate concert-style lighting shows from audio input, inspired by Justice's live performances.**

## Vision

Given a music track (e.g., Justice - Neverender), automatically generate a synchronized 3D lightshow simulation that captures the energy, rhythm, and emotional arc of the music — with the ability to learn and replicate lighting styles from real concert footage.

## Demo

Drop an MP3 file into the browser, and watch as the 3D stage comes alive with lights that react to:
- **Beats** — Intensity pulses and strobe flashes
- **Bass** — Moving head tilt and wash light intensity
- **Energy** — Overall brightness and color temperature
- **Spectral content** — Color shifts from warm to cool
- **Song sections** — Dramatic changes on drops and breakdowns

## Features

- **Real-time audio analysis** with BPM detection, beat grid, and section detection
- **3D concert stage** with moving heads, strobes, wash lights, and volumetric beams
- **Spotify-like player UI** with album art, progress bar, and playback controls
- **Style presets** inspired by Justice, minimal techno, and EDM festivals
- **Pre-analysis** of entire songs before playback for perfect sync

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LIGHTSHOW GENERATOR                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   AUDIO ANALYSIS              3D STAGE                   STYLE LEARNING     │
│   ──────────────              ────────                   ──────────────     │
│                                                                             │
│   ┌───────────┐             ┌───────────┐             ┌───────────┐         │
│   │ MP3/WAV   │             │ Three.js  │             │ Video     │         │
│   │ Input     │             │ Scene     │             │ Analysis  │         │
│   └─────┬─────┘             └─────┬─────┘             └─────┬─────┘         │
│         │                         │                         │               │
│         ▼                         ▼                         ▼               │
│   ┌───────────┐             ┌───────────┐             ┌───────────┐         │
│   │ Tone.js + │             │ Volumetric│             │ Color &   │         │
│   │ Meyda.js  │             │ Lights    │             │ Pattern   │         │
│   └─────┬─────┘             └─────┬─────┘             └─────┬─────┘         │
│         │                         │                         │               │
│         ▼                         ▼                         ▼               │
│   ┌───────────┐             ┌───────────┐             ┌───────────┐         │
│   │ BPM +     │             │ Fixtures: │             │ Style     │         │
│   │ Beat Grid │             │ MH/Strobe │             │ Profiles  │         │
│   │ + Sections│             │ /Wash     │             │ + Rules   │         │
│   └─────┬─────┘             └─────┬─────┘             └─────┬─────┘         │
│         │                         │                         │               │
│         └────────────┬────────────┘                         │               │
│                      │                                      │               │
│                      ▼                                      │               │
│              ┌───────────────┐                              │               │
│              │    MAPPING    │◄─────────────────────────────┘               │
│              │    ENGINE     │                                              │
│              │               │                                              │
│              │ AudioFrame ─► │                                              │
│              │ LightingCmd   │                                              │
│              └───────────────┘                                              │
│                      │                                                      │
│                      ▼                                                      │
│              ┌───────────────┐                                              │
│              │  PLAYER UI    │                                              │
│              │  (Spotify-    │                                              │
│              │   style)      │                                              │
│              └───────────────┘                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Category | Technologies |
|----------|--------------|
| **Frontend** | TypeScript, Vite |
| **3D Rendering** | Three.js, postprocessing (bloom) |
| **Audio Playback** | Tone.js, Web Audio API |
| **Audio Analysis** | Meyda.js, web-audio-beat-detector |
| **Metadata** | jsmediatags (ID3 tags, album art) |
| **Style Learning** | Canvas API, k-means clustering |
| **Build Tools** | Vite, TypeScript |

---

## Workstreams

The project is organized into four workstreams that can be developed independently.

---

### Workstream A: Audio Analysis Pipeline

**Goal:** Extract musically-meaningful features from audio with pre-analysis and real-time processing

#### Components

| File | Purpose |
|------|---------|
| `AudioAnalyzer.ts` | Basic real-time audio analysis |
| `AdvancedAnalyzer.ts` | Pre-analysis with BPM detection, beat grid, sections |
| `FeatureExtractor.ts` | Meyda.js wrapper for spectral features |
| `BeatDetector.ts` | Energy-based beat detection |
| `BeatGrid.ts` | Beat timing, quantization, bar tracking |
| `CueScheduler.ts` | Beat-synced lighting cue scheduling |

#### Output Format

```typescript
interface AudioFrame {
  timestamp: number;

  // Rhythm
  isBeat: boolean;
  isDownbeat: boolean;
  tempo: number;
  beatPhase: number;
  beatNumber: number;

  // Energy
  rms: number;
  energy: number;
  peak: number;

  // Spectral
  spectralCentroid: number;
  spectralFlux: number;
  lowEnergy: number;
  midEnergy: number;
  highEnergy: number;

  // Structure
  section?: 'intro' | 'verse' | 'chorus' | 'drop' | 'breakdown' | 'outro';
}

// Enhanced frequency bands (AdvancedAnalyzer)
interface FrequencyBands {
  sub: number;      // 20-60 Hz (sub bass)
  bass: number;     // 60-250 Hz (kick, bass)
  lowMid: number;   // 250-500 Hz (low vocals, toms)
  mid: number;      // 500-2000 Hz (vocals, snare)
  highMid: number;  // 2000-6000 Hz (hi-hats, presence)
  high: number;     // 6000-20000 Hz (air, cymbals)
}
```

#### Tasks

- [x] Set up Web Audio API audio loading and playback
- [x] Integrate Meyda.js for real-time feature extraction
- [x] Create AudioAnalyzer class with standardized output
- [x] Implement energy-based beat detection
- [x] Add BPM pre-analysis with web-audio-beat-detector
- [x] Create BeatGrid for beat timing and quantization
- [x] Implement CueScheduler for beat-synced events
- [x] Add 6-band frequency analysis
- [x] Add song section detection (energy-based heuristics)
- [ ] Improve section detection with ML
- [ ] Add key/chord detection

---

### Workstream B: 3D Stage & Lighting Simulation

**Goal:** Render a realistic 3D concert stage with controllable lighting fixtures

#### Components

| File | Purpose |
|------|---------|
| `Stage.ts` | Three.js scene, camera, renderer, post-processing |
| `LightingController.ts` | Fixture management, command execution |
| `fixtures/BaseFixture.ts` | Abstract base class with transitions |
| `fixtures/MovingHead.ts` | Pan/tilt spotlight with volumetric beam |
| `fixtures/Strobe.ts` | Flash effect fixture |
| `fixtures/WashLight.ts` | Area flood lighting |

#### Stage Layout

```
                         ┌─────────────────────────┐
                         │     LED BACK WALL       │
                         └─────────────────────────┘
                               BACK TRUSS
                    ═══════════════════════════════════
                    ║  MH  MH  MH  MH  MH  MH  MH  MH  ║
              SIDE  ║                                   ║  SIDE
             TRUSS  ║                                   ║ TRUSS
                    ║     ┌─────────────────────┐       ║
               WASH ║     │                     │       ║ WASH
              LIGHTS║     │    STAGE FLOOR      │       ║LIGHTS
                    ║     │                     │       ║
                    ║     └─────────────────────┘       ║
                    ═══════════════════════════════════
                          FRONT TRUSS (6 MH)

                         [STROBE] [STROBE] [STROBE] [STROBE]

                    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                              AUDIENCE AREA
```

#### Fixture Types

```typescript
interface MovingHead {
  pan: number;        // 0-1 horizontal
  tilt: number;       // 0-1 vertical
  intensity: number;  // 0-1 brightness
  color: RGB;
  beamWidth: number;  // 0-1 spot to flood
  speed: number;      // 0-1 movement speed
}

interface Strobe {
  intensity: number;
  rate: number;       // Hz (flashes per second)
  color: RGB;
  flashDuration: number;
}

interface WashLight {
  intensity: number;
  color: RGB;
  spread: number;     // 0-1 narrow to wide
}
```

#### Tasks

- [x] Set up Three.js scene with stage geometry
- [x] Create raised stage platform with reflective floor
- [x] Add truss structures (square profile with cross-bracing)
- [x] Add LED back wall/screen
- [x] Implement MovingHead with pan/tilt/color controls
- [x] Add volumetric beam effect with shaders
- [x] Create Strobe class with rate control
- [x] Create WashLight class
- [x] Build LightingController for command execution
- [x] Add bloom post-processing effects
- [x] Implement camera presets (front, side, top, dynamic)
- [x] Add speaker stacks and stage monitors
- [x] Add audience area with barrier
- [ ] Add laser fixtures
- [ ] Implement gobo patterns
- [ ] Add fog/haze particle system

---

### Workstream C: Style Learning from Video

**Goal:** Extract lighting patterns from concert footage to learn a "style"

#### Components

| File | Purpose |
|------|---------|
| `VideoAnalyzer.ts` | Frame analysis, color extraction |
| `StyleLearner.ts` | Audio-visual correlation, rule extraction |
| `StyleProfile.ts` | Profile management, presets, persistence |

#### Built-in Presets

| Preset | Description |
|--------|-------------|
| `justice-style` | Dramatic, intense - magenta/red washes, white strobes on drops |
| `minimal-techno` | Monochrome, subtle - kick pulses, occasional blackouts |
| `edm-festival` | Vibrant, high-energy - rainbow colors, constant movement |

#### Style Profile Format

```typescript
interface StyleProfile {
  name: string;
  source: string;

  palette: {
    primary: RGB[];
    accent: RGB[];
    strobeColor: RGB;
  };

  rules: StyleRule[];

  // Statistics
  avgBrightness: number;
  brightnessVariance: number;
  colorChangeRate: number;
  strobeRate: number;
}

interface StyleRule {
  trigger: {
    onBeat?: boolean;
    onDownbeat?: boolean;
    energyThreshold?: number;
    sections?: SongSection[];
  };
  action: {
    type: 'strobe' | 'color_change' | 'intensity_pulse' | 'movement';
    targets: FixtureType[];
    durationMs: number;
  };
  probability: number;
}
```

#### Tasks

- [x] Implement VideoAnalyzer with canvas-based frame analysis
- [x] Add dominant color extraction (k-means clustering)
- [x] Create StyleLearner with rule extraction
- [x] Build StyleProfile manager with localStorage persistence
- [x] Create built-in presets (justice-style, minimal-techno, edm-festival)
- [x] Add strobe detection (brightness spike analysis)
- [ ] Implement actual video file processing
- [ ] Add ML-based style transfer (Skip-BART integration)

---

### Workstream D: Mapping Engine & Integration

**Goal:** Connect audio features to lighting controls, merge all workstreams

#### Components

| File | Purpose |
|------|---------|
| `MappingEngine.ts` | AudioFrame → LightingCommand processing |
| `rules/RuleEvaluator.ts` | Style rule evaluation |
| `rules/DefaultRules.ts` | Built-in mapping behaviors |

#### Mapping Strategies

```typescript
// Default behavior (no style loaded)
intensity = audioFrame.rms * config.intensityScale;
color = hslToRgb(audioFrame.spectralCentroid * 0.7, 0.8, 0.5);

if (audioFrame.isBeat) {
  triggerIntensityPulse(1.0, 100);
}

if (audioFrame.isDownbeat) {
  rotatePalette();
}

// Moving heads follow bass
movingHeadTilt = audioFrame.lowEnergy;
beamWidth = audioFrame.energy * 0.5 + 0.2;
```

#### Tasks

- [x] Implement MappingEngine with AudioFrame processing
- [x] Create RuleEvaluator for style rule evaluation
- [x] Build default mapping behaviors
- [x] Add smoothing and easing utilities
- [x] Implement rate limiting for strobes
- [x] Connect to Stage for command execution
- [x] Create main application with drag-and-drop
- [x] Build Spotify-like player UI
- [x] Add album art extraction with jsmediatags
- [x] Implement progress bar with seeking
- [ ] Add style selector UI
- [ ] Implement video recording/export

---

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd lightshow

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000 and drop an MP3 file
```

## Project Structure

```
lightshow/
├── README.md
├── package.json
├── index.html                 # Main HTML with player UI
├── src/
│   ├── index.ts               # Main application entry
│   ├── shared/
│   │   └── types.ts           # Shared TypeScript interfaces
│   ├── audio/                 # Workstream A
│   │   ├── AudioAnalyzer.ts
│   │   ├── AdvancedAnalyzer.ts
│   │   ├── FeatureExtractor.ts
│   │   ├── BeatDetector.ts
│   │   ├── BeatGrid.ts
│   │   └── CueScheduler.ts
│   ├── stage/                 # Workstream B
│   │   ├── Stage.ts
│   │   ├── LightingController.ts
│   │   └── fixtures/
│   │       ├── BaseFixture.ts
│   │       ├── MovingHead.ts
│   │       ├── Strobe.ts
│   │       └── WashLight.ts
│   ├── style/                 # Workstream C
│   │   ├── VideoAnalyzer.ts
│   │   ├── StyleLearner.ts
│   │   └── StyleProfile.ts
│   └── mapping/               # Workstream D
│       ├── MappingEngine.ts
│       └── rules/
│           ├── RuleEvaluator.ts
│           └── DefaultRules.ts
├── public/
│   └── assets/
└── tests/
```

## References

- [Tone.js Documentation](https://tonejs.github.io/)
- [Meyda.js Documentation](https://meyda.js.org/)
- [Three.js Documentation](https://threejs.org/docs/)
- [web-audio-beat-detector](https://github.com/chrisguttandin/web-audio-beat-detector)
- [jsmediatags](https://github.com/aadsm/jsmediatags)
- [Skip-BART Paper](https://arxiv.org/abs/2506.01482) | [GitHub](https://github.com/RS2002/Skip-BART)
- [Awesome Audio Visualization](https://github.com/willianjusten/awesome-audio-visualization)

## Inspiration

- Justice - Live performances (especially Neverender at Accor Arena 2024)
- Deadmau5 cube shows
- Eric Prydz HOLO
- Daft Punk Alive 2007

## License

MIT
