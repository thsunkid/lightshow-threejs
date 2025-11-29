# Lightshow Generator

**Generate concert-style lighting shows from audio input, inspired by Justice's live performances.**

## Vision

Given a music track (e.g., Justice - Neverender), automatically generate a synchronized 3D lightshow simulation that captures the energy, rhythm, and emotional arc of the music — with intelligent show planning based on song structure.

## Demo

Drop an MP3 file into the browser, and watch as the 3D stage comes alive with lights that react to:
- **Beats** — Intensity pulses and strobe flashes
- **Bass** — Moving head tilt and wash light intensity
- **Energy** — Overall brightness and color temperature
- **Spectral content** — Color shifts from warm to cool
- **Song sections** — Dramatic changes on drops and breakdowns

## Stage Layout

```
                           BACK TRUSS
    ╔═══════════════════════════════════════════════════════╗
    ║   [MH]    [MH]    [MH]    [MH]    [MH]    [MH]        ║
    ╠═══════════════════════════════════════════════════════╣
    ║                                                       ║
    ║   ┌───┐          ╔═══════════════════╗          ┌───┐ ║
    ║   │[W]│          ║                   ║          │[W]│ ║
    ║   │   │          ║   LED SCREEN      ║          │   │ ║
    ║   │[S]│  TOWER   ║   (Particles)     ║  TOWER   │[S]│ ║
    ║   │   │          ║                   ║          │   │ ║
    ║   │[W]│          ║                   ║          │[W]│ ║
    ║   └───┘          ╚═══════════════════╝          └───┘ ║
    ║                                                       ║
    ╠═══════════════════════════════════════════════════════╣
    ║                   STAGE FLOOR                         ║
    ╠═══════════════════════════════════════════════════════╣
    ║                                                       ║
    ║         [MH]       [MH]       [MH]       [MH]         ║
    ╚═══════════════════════════════════════════════════════╝
                         FRONT TRUSS

                        AUDIENCE AREA
    ════════════════════════════════════════════════════════
                (Barrier)     (Floor)

    Legend:
    [MH] = Moving Head (pan/tilt spotlight with beam)
    [W]  = Wash Light (area flood lighting)
    [S]  = Strobe (flash effect)
```

## Features

### Audio Analysis
- **Pre-analysis** of entire songs before playback for perfect sync
- **BPM detection** using web-audio-beat-detector
- **Beat grid generation** with bar/beat tracking
- **Section detection** (intro, verse, chorus, drop, breakdown, outro)
- **6-band frequency analysis** (sub, bass, lowMid, mid, highMid, high)
- **Analysis caching** via IndexedDB for instant replay

### 3D Concert Stage
- **Realistic stage geometry** with trusses, LED back wall, speakers
- **Moving heads** with pan/tilt, volumetric beams, and color control
- **Strobes** with rate control and flash patterns
- **Wash lights** for area flood lighting
- **Flake lights** — contextual particle effects that respond to music
- **LED particle panel** — audio-reactive curl-noise particles on the back screen
- **Bloom post-processing** for dramatic light glow

### Intelligent Lighting
- **Show Planner** — creates lighting plans based on song structure
- **8 predefined looks** (Deep Blue, Fire, Minimal, Rave, Ethereal, etc.)
- **Lighting variations** — multiple response options for same audio features
- **Contextual effects** — flakes only appear during appropriate sections
- **Purposeful randomization** — not predictable, but still musical

### Player UI
- **Spotify-style player** with album art, progress bar, and playback controls
- **Loading screen** with analysis progress (decoding → BPM → beats → sections)
- **Metadata extraction** from MP3 ID3 tags using jsmediatags

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LIGHTSHOW GENERATOR                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   AUDIO ANALYSIS              3D STAGE                   INTELLIGENT SHOW   │
│   ──────────────              ────────                   ───────────────    │
│                                                                             │
│   ┌───────────┐             ┌───────────┐             ┌───────────┐         │
│   │ MP3/WAV   │             │ Three.js  │             │ Show      │         │
│   │ Input     │             │ Scene     │             │ Planner   │         │
│   └─────┬─────┘             └─────┬─────┘             └─────┬─────┘         │
│         │                         │                         │               │
│         ▼                         ▼                         ▼               │
│   ┌───────────┐             ┌───────────┐             ┌───────────┐         │
│   │ Advanced  │             │ Volumetric│             │ Lighting  │         │
│   │ Analyzer  │             │ Lights    │             │ Variations│         │
│   └─────┬─────┘             └─────┬─────┘             └─────┬─────┘         │
│         │                         │                         │               │
│         ▼                         ▼                         ▼               │
│   ┌───────────┐             ┌───────────┐             ┌───────────┐         │
│   │ BPM +     │             │ Fixtures: │             │ Scene     │         │
│   │ Beat Grid │             │ MH/Strobe │             │ Looks +   │         │
│   │ + Sections│             │ /Wash/LED │             │ Themes    │         │
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
| **Caching** | IndexedDB |
| **Build Tools** | Vite, TypeScript |

---

## Project Structure

```
lightshow/
├── README.md
├── package.json
├── index.html                 # Main HTML with player UI
├── vite.config.ts
├── vite-plugin-console-stream.ts  # Browser console → terminal streaming
├── src/
│   ├── index.ts               # Main application entry
│   ├── shared/
│   │   └── types.ts           # Shared TypeScript interfaces
│   ├── audio/                 # Audio Analysis
│   │   ├── AudioAnalyzer.ts   # Basic real-time analysis
│   │   ├── AdvancedAnalyzer.ts # Pre-analysis with BPM, beats, sections
│   │   ├── AnalysisCache.ts   # IndexedDB caching
│   │   ├── FeatureExtractor.ts # Meyda.js wrapper
│   │   ├── BeatDetector.ts    # Energy-based beat detection
│   │   ├── BeatGrid.ts        # Beat timing and quantization
│   │   └── CueScheduler.ts    # Beat-synced lighting cues
│   ├── stage/                 # 3D Stage & Lighting
│   │   ├── Stage.ts           # Three.js scene, camera, renderer
│   │   ├── LightingController.ts # Fixture management
│   │   ├── FlakeLightController.ts # Contextual flake particles
│   │   ├── LEDParticlePanel.ts # Audio-reactive back panel
│   │   ├── fixtures/
│   │   │   ├── BaseFixture.ts # Abstract base with transitions
│   │   │   ├── MovingHead.ts  # Pan/tilt spotlight with beam
│   │   │   ├── Strobe.ts      # Flash effect fixture
│   │   │   └── WashLight.ts   # Area flood lighting
│   │   └── shaders/
│   │       ├── curlNoise.glsl
│   │       ├── ledParticle.vert
│   │       └── ledParticle.frag
│   ├── style/                 # Style Learning (future)
│   │   ├── VideoAnalyzer.ts
│   │   ├── StyleLearner.ts
│   │   └── StyleProfile.ts
│   └── mapping/               # Mapping Engine
│       ├── MappingEngine.ts   # AudioFrame → LightingCommand
│       ├── ShowPlanner.ts     # Song structure → show plan
│       ├── LightingVariations.ts # Response variations
│       └── rules/
│           ├── RuleEvaluator.ts
│           └── DefaultRules.ts
├── public/
│   └── assets/
└── tests/
```

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

---

## How It Works

### 1. Audio Pre-Analysis
When you load a song, the system analyzes the entire track:
- Decodes audio to raw PCM data
- Detects BPM using autocorrelation
- Generates beat grid with bar/beat positions
- Identifies sections based on energy patterns
- Caches results in IndexedDB for instant replay

### 2. Show Planning
The ShowPlanner creates a lighting plan from the analysis:
- Assigns "looks" to each section (color palettes, movement styles)
- Plans dramatic contrasts (breakdowns → drops)
- Schedules flake effects for climactic moments
- Generates lighting cues at specific beats

### 3. Real-Time Rendering
During playback, every frame:
- Extracts frequency bands and spectral features
- Checks beat grid for current beat/bar
- Applies lighting variations with randomization
- Updates all fixtures with smooth transitions
- Renders 3D scene with bloom post-processing

---

## Roadmap

### Completed
- [x] Real-time audio analysis with Meyda.js
- [x] BPM detection and beat grid generation
- [x] Section detection (energy-based heuristics)
- [x] 3D concert stage with realistic geometry
- [x] Moving heads with volumetric beams
- [x] Strobes and wash lights
- [x] Flake light particle system
- [x] LED particle panel with curl noise shaders
- [x] Spotify-style player UI
- [x] Analysis caching in IndexedDB
- [x] Show planner with predefined looks
- [x] Lighting variations for non-predictable responses
- [x] Console streaming to terminal for debugging

### In Progress
- [ ] Integration testing of all new systems
- [ ] Performance optimization

### Future
- [ ] Improve section detection with ML
- [ ] Add key/chord detection
- [ ] Implement laser fixtures
- [ ] Add gobo patterns for moving heads
- [ ] Add fog/haze particle system
- [ ] Video file processing for style learning
- [ ] ML-based style transfer (Skip-BART)
- [ ] Style selector UI
- [ ] Video recording/export

---

## References

- [Tone.js Documentation](https://tonejs.github.io/)
- [Meyda.js Documentation](https://meyda.js.org/)
- [Three.js Documentation](https://threejs.org/docs/)
- [web-audio-beat-detector](https://github.com/chrisguttandin/web-audio-beat-detector)
- [jsmediatags](https://github.com/aadsm/jsmediatags)
- [Audio-Reactive Particles (Codrops)](https://tympanus.net/codrops/2023/12/19/creating-audio-reactive-visuals-with-dynamic-particles-in-three-js/)

## Inspiration

- Justice - Live performances (especially Neverender at Accor Arena 2024)
- Deadmau5 cube shows
- Eric Prydz HOLO
- Daft Punk Alive 2007

## License

MIT
