# Lightshow Generator

**Generate concert-style lighting shows from audio input, inspired by Justice's live performances.**

## Vision

Given a music track (e.g., Justice - Neverender), automatically generate a synchronized 3D lightshow simulation that captures the energy, rhythm, and emotional arc of the music — with the ability to learn and replicate lighting styles from real concert footage.

## Background

Professional concert lighting is typically programmed manually by lighting designers who craft cues synchronized to song structure. This project explores automating that process through:

1. **Audio analysis** — Extracting musical features (beats, energy, spectral content, structure)
2. **Style learning** — Optionally learning lighting patterns from reference concert videos
3. **Generative mapping** — Translating audio features into lighting parameters
4. **3D simulation** — Rendering realistic volumetric lighting in the browser

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LIGHTSHOW GENERATOR                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   WORKSTREAM A              WORKSTREAM B              WORKSTREAM C      │
│   ─────────────             ─────────────             ─────────────     │
│   Audio Analysis            3D Stage/Lights           Style Learning    │
│                                                                         │
│   ┌───────────┐             ┌───────────┐             ┌───────────┐     │
│   │ Audio In  │             │ Three.js  │             │ YouTube   │     │
│   │ (MP3/WAV) │             │ Scene     │             │ Video In  │     │
│   └─────┬─────┘             └─────┬─────┘             └─────┬─────┘     │
│         │                         │                         │           │
│         ▼                         ▼                         ▼           │
│   ┌───────────┐             ┌───────────┐             ┌───────────┐     │
│   │ Meyda.js  │             │ Volumetric│             │ Frame     │     │
│   │ Essentia  │             │ Lights    │             │ Analyzer  │     │
│   └─────┬─────┘             └─────┬─────┘             └─────┬─────┘     │
│         │                         │                         │           │
│         ▼                         ▼                         ▼           │
│   ┌───────────┐             ┌───────────┐             ┌───────────┐     │
│   │ Feature   │             │ Fixture   │             │ Light     │     │
│   │ Vector    │             │ Controls  │             │ State     │     │
│   │ Stream    │             │ API       │             │ Extractor │     │
│   └─────┬─────┘             └─────┬─────┘             └─────┬─────┘     │
│         │                         │                         │           │
│         └────────────┬────────────┘                         │           │
│                      │                                      │           │
│                      ▼                                      │           │
│              ┌───────────────┐                              │           │
│              │    MAPPING    │◄─────────────────────────────┘           │
│              │    ENGINE     │  (learned rules / ML model)              │
│              │               │                                          │
│              │ audio features│                                          │
│              │      ──►      │                                          │
│              │ light params  │                                          │
│              └───────────────┘                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Workstreams

Each workstream can be developed independently and merged once interfaces are defined.

---

### Workstream A: Audio Analysis Pipeline

**Owner:** TBD
**Goal:** Extract musically-meaningful features from audio in real-time

#### Deliverables

1. **Audio loader** — Accept MP3/WAV, decode to Web Audio API
2. **Feature extractor** — Real-time stream of audio features per frame
3. **Beat/structure detector** — Identify beats, downbeats, drops, builds
4. **Output interface** — Standardized feature vector format

#### Tech Stack

| Library | Purpose |
|---------|---------|
| Web Audio API | Audio decoding and playback |
| Meyda.js | Real-time spectral features (RMS, centroid, flux, MFCC) |
| Essentia.js | Beat tracking, tempo, key detection (WASM) |
| Clubber.js | Music-theory-aware MIDI note binning (optional) |

#### Output Format

```typescript
interface AudioFrame {
  timestamp: number;        // ms from start

  // Rhythm
  isBeat: boolean;
  isDownbeat: boolean;
  tempo: number;            // BPM
  beatPhase: number;        // 0-1 position within beat

  // Energy
  rms: number;              // 0-1 overall loudness
  energy: number;           // 0-1 perceived energy

  // Spectral
  spectralCentroid: number; // brightness
  spectralFlux: number;     // rate of change
  lowEnergy: number;        // bass 0-1
  midEnergy: number;        // mids 0-1
  highEnergy: number;       // highs 0-1

  // Structure (if detected)
  section?: 'intro' | 'verse' | 'chorus' | 'drop' | 'breakdown' | 'outro';
}
```

#### Tasks

- [ ] Set up Web Audio API audio loading and playback
- [ ] Integrate Meyda.js for real-time feature extraction
- [ ] Integrate Essentia.js for beat tracking
- [ ] Create AudioAnalyzer class with standardized output
- [ ] Add song structure detection (optional, can use ML or heuristics)
- [ ] Write unit tests with known audio samples
- [ ] Document API and usage examples

---

### Workstream B: 3D Stage & Lighting Simulation

**Owner:** TBD
**Goal:** Render a realistic 3D concert stage with controllable lighting fixtures

#### Deliverables

1. **Stage scene** — 3D environment (stage, truss, haze)
2. **Fixture library** — Moving heads, strobes, wash lights, lasers
3. **Volumetric rendering** — Visible light beams through atmosphere
4. **Control API** — Programmatic control of all fixtures

#### Tech Stack

| Library | Purpose |
|---------|---------|
| Three.js | 3D rendering engine |
| three-volumetric-spotlight | Volumetric light cones |
| postprocessing | Bloom, god rays, effects |
| lil-gui / dat.gui | Debug controls |

#### Fixture Types

```typescript
interface MovingHead {
  id: string;
  position: Vector3;

  // Control parameters (0-1 normalized)
  pan: number;              // horizontal rotation
  tilt: number;             // vertical rotation
  intensity: number;        // brightness
  color: { r: number, g: number, b: number };
  beamWidth: number;        // spot to flood
  gobo?: string;            // pattern projection
}

interface Strobe {
  id: string;
  position: Vector3;
  intensity: number;
  rate: number;             // flashes per second
  color: { r: number, g: number, b: number };
}

interface WashLight {
  id: string;
  position: Vector3;
  intensity: number;
  color: { r: number, g: number, b: number };
  spread: number;
}
```

#### Stage Layout (Initial)

```
              [BACK TRUSS - 8 moving heads]
                    ████████████

        [LEFT]                        [RIGHT]
        4 wash                        4 wash
        lights                        lights

                    ┌────────┐
                    │ STAGE  │
                    │        │
                    └────────┘

              [FRONT TRUSS - 6 moving heads]
                    ████████████

                    [STROBES x4]
```

#### Tasks

- [ ] Set up Three.js scene with stage geometry
- [ ] Implement basic spotlight fixtures
- [ ] Add volumetric light rendering (beams visible in haze)
- [ ] Create MovingHead class with pan/tilt/color controls
- [ ] Create Strobe class with rate control
- [ ] Create WashLight class
- [ ] Build fixture group/universe management
- [ ] Add bloom and post-processing effects
- [ ] Implement camera controls (orbit, preset angles)
- [ ] Create LightingController API for external control
- [ ] Performance optimization (instancing, LOD)
- [ ] Document fixture API

---

### Workstream C: Style Learning from Video

**Owner:** TBD
**Goal:** Extract lighting patterns from concert footage to learn a "style"

#### Deliverables

1. **Video frame analyzer** — Extract lighting states from video frames
2. **Audio-visual pairing** — Align extracted states with audio features
3. **Style profile generator** — Create reusable lighting style rules/model
4. **Inference engine** — Apply learned style to new audio

#### Approach Options

**Option 1: Rule Extraction (Simpler)**
- Analyze video frames for dominant colors, brightness regions
- Correlate with audio features at same timestamps
- Extract rules like: "when energy > 0.8 AND beat → strobe flash"
- Build probabilistic style profile

**Option 2: ML Model (Skip-BART)**
- Use pre-trained Skip-BART model for audio → lighting generation
- Fine-tune on extracted video data if possible
- Run inference in browser via ONNX.js or TensorFlow.js

#### Tech Stack

| Library | Purpose |
|---------|---------|
| OpenCV.js | Frame analysis, color extraction |
| TensorFlow.js | ML inference in browser |
| Skip-BART | Pre-trained lighting generation model |
| yt-dlp | YouTube video/audio download (preprocessing) |
| FFmpeg | Frame extraction (preprocessing) |

#### Video Analysis Output

```typescript
interface LightingState {
  timestamp: number;

  // Global
  overallBrightness: number;  // 0-1
  dominantColors: RGB[];      // top 3-5 colors

  // Spatial (divide frame into regions)
  regions: {
    position: 'left' | 'center' | 'right' | 'back';
    brightness: number;
    color: RGB;
    hasBeam: boolean;
    beamAngle?: number;
  }[];

  // Events
  isStrobe: boolean;
  isBlackout: boolean;
  isColorChange: boolean;
}
```

#### Style Profile Format

```typescript
interface StyleProfile {
  name: string;
  source: string;  // e.g., "Justice - Neverender (Accor Arena 2024)"

  // Color palette preferences
  palette: {
    primary: RGB[];
    accent: RGB[];
    strobeColor: RGB;
  };

  // Behavioral rules
  rules: {
    onBeat: { action: string; probability: number }[];
    onDrop: { action: string; probability: number }[];
    energyMapping: { threshold: number; action: string }[];
    // etc.
  };

  // Or: trained model weights
  modelWeights?: ArrayBuffer;
}
```

#### Tasks

- [ ] Research Skip-BART implementation and requirements
- [ ] Build video frame extraction pipeline (preprocessing)
- [ ] Implement frame color/brightness analyzer with OpenCV.js
- [ ] Create audio-visual alignment tool
- [ ] Design style profile format
- [ ] Implement rule extraction algorithm
- [ ] (Optional) Set up TensorFlow.js for ML inference
- [ ] (Optional) Integrate Skip-BART or train custom model
- [ ] Create StyleLearner class
- [ ] Document style learning workflow

---

### Workstream D: Mapping Engine & Integration

**Owner:** TBD
**Goal:** Connect audio features to lighting controls, merge all workstreams

#### Deliverables

1. **Mapping engine** — Transform audio features → lighting parameters
2. **Rule system** — Configurable rules for reactive behavior
3. **Style applicator** — Apply learned styles to generation
4. **Main application** — Unified UI bringing it all together

#### Mapping Strategies

```typescript
// Direct mapping
intensity = audioFrame.rms;

// Threshold-based
if (audioFrame.isBeat) triggerStrobe();

// Smoothed/eased
intensity = lerp(currentIntensity, targetIntensity, 0.1);

// Style-influenced
const action = style.rules.onBeat.sample();
executeAction(action);
```

#### Tasks

- [ ] Define mapping interface between Workstream A and B
- [ ] Implement basic rule-based mapper
- [ ] Add smoothing and easing for natural transitions
- [ ] Integrate style profiles from Workstream C
- [ ] Build main application shell
- [ ] Create UI for audio upload and playback
- [ ] Add style selection/loading
- [ ] Implement real-time visualization
- [ ] Add export options (video recording?)
- [ ] Performance testing and optimization
- [ ] End-to-end integration testing

---

## Tech Stack Summary

| Category | Technologies |
|----------|--------------|
| **Frontend** | TypeScript, Vite, React (optional) |
| **3D Rendering** | Three.js, postprocessing |
| **Audio Analysis** | Web Audio API, Meyda.js, Essentia.js |
| **Video Analysis** | OpenCV.js, TensorFlow.js |
| **ML Models** | Skip-BART, ONNX.js |
| **Build Tools** | Vite, ESBuild |

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd lightshow

# Install dependencies
npm install

# Start development server
npm run dev
```

## Project Structure (Proposed)

```
lightshow/
├── README.md
├── package.json
├── src/
│   ├── audio/              # Workstream A
│   │   ├── AudioAnalyzer.ts
│   │   ├── features/
│   │   └── types.ts
│   ├── stage/              # Workstream B
│   │   ├── Stage.ts
│   │   ├── fixtures/
│   │   │   ├── MovingHead.ts
│   │   │   ├── Strobe.ts
│   │   │   └── WashLight.ts
│   │   └── LightingController.ts
│   ├── style/              # Workstream C
│   │   ├── VideoAnalyzer.ts
│   │   ├── StyleLearner.ts
│   │   └── StyleProfile.ts
│   ├── mapping/            # Workstream D
│   │   ├── MappingEngine.ts
│   │   └── rules/
│   ├── app/                # Main application
│   │   ├── App.ts
│   │   └── ui/
│   └── index.ts
├── public/
│   └── assets/
├── scripts/                # Preprocessing tools
│   ├── extract-frames.sh
│   └── download-video.sh
└── tests/
```

## References

- [Essentia.js Documentation](https://mtg.github.io/essentia.js/)
- [Meyda.js Documentation](https://meyda.js.org/)
- [Clubber.js GitHub](https://github.com/wizgrav/clubber)
- [Three.js Documentation](https://threejs.org/docs/)
- [Skip-BART Paper](https://arxiv.org/abs/2506.01482) | [GitHub](https://github.com/RS2002/Skip-BART)
- [Awesome Audio Visualization](https://github.com/willianjusten/awesome-audio-visualization)

## Inspiration

- Justice - Live performances (especially Neverender at Accor Arena 2024)
- Deadmau5 cube shows
- Eric Prydz HOLO
- Daft Punk Alive 2007

---

## Contributing

1. Pick a workstream
2. Check the task list in that section
3. Create a feature branch: `git checkout -b workstream-a/audio-loader`
4. Implement and test
5. Submit PR with documentation

## License

MIT
