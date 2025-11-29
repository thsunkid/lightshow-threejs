/**
 * Shared types for the Lightshow Generator
 *
 * These types define the contracts between workstreams:
 * - Workstream A (Audio) exports AudioFrame
 * - Workstream B (Stage) exports Fixture types and LightingCommand
 * - Workstream C (Style) exports StyleProfile and LightingState
 * - Workstream D (Mapping) consumes all of the above
 */

// =============================================================================
// WORKSTREAM A: Audio Analysis Types
// =============================================================================

/**
 * Represents a single frame of analyzed audio data.
 * Output by AudioAnalyzer, consumed by MappingEngine.
 */
export interface AudioFrame {
  /** Timestamp in milliseconds from start of audio */
  timestamp: number;

  // ─── Rhythm ─────────────────────────────────────────────────────────────────
  /** True if this frame lands on a detected beat */
  isBeat: boolean;
  /** True if this frame lands on a downbeat (first beat of bar) */
  isDownbeat: boolean;
  /** Current tempo in BPM */
  tempo: number;
  /** Position within current beat, 0-1 */
  beatPhase: number;
  /** Current beat number within the track */
  beatNumber: number;

  // ─── Energy ─────────────────────────────────────────────────────────────────
  /** Root mean square amplitude, 0-1 */
  rms: number;
  /** Perceived energy level, 0-1 (smoothed/weighted RMS) */
  energy: number;
  /** Peak amplitude in this frame, 0-1 */
  peak: number;

  // ─── Spectral ───────────────────────────────────────────────────────────────
  /** Spectral centroid (brightness), normalized 0-1 */
  spectralCentroid: number;
  /** Rate of spectral change, 0-1 */
  spectralFlux: number;
  /** Low frequency energy (bass), 0-1 */
  lowEnergy: number;
  /** Mid frequency energy, 0-1 */
  midEnergy: number;
  /** High frequency energy (treble), 0-1 */
  highEnergy: number;

  // ─── Structure (optional) ───────────────────────────────────────────────────
  /** Detected song section, if available */
  section?: SongSection;
  /** Confidence of section detection, 0-1 */
  sectionConfidence?: number;
}

export type SongSection =
  | 'intro'
  | 'verse'
  | 'chorus'
  | 'drop'
  | 'breakdown'
  | 'buildup'
  | 'bridge'
  | 'outro';

/**
 * Configuration for the audio analyzer
 */
export interface AudioAnalyzerConfig {
  /** FFT size for spectral analysis (power of 2) */
  fftSize: number;
  /** Smoothing factor for spectral data, 0-1 */
  smoothingTimeConstant: number;
  /** Minimum tempo to detect (BPM) */
  minTempo: number;
  /** Maximum tempo to detect (BPM) */
  maxTempo: number;
  /** Enable beat detection */
  detectBeats: boolean;
  /** Enable section detection */
  detectSections: boolean;
}

// =============================================================================
// WORKSTREAM B: Stage & Lighting Types
// =============================================================================

/**
 * RGB color representation, values 0-1
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * 3D position in world space
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Base interface for all lighting fixtures
 */
export interface BaseFixture {
  /** Unique identifier for this fixture */
  id: string;
  /** Fixture type discriminator */
  type: FixtureType;
  /** Position in 3D space */
  position: Vector3;
  /** Whether the fixture is currently active */
  enabled: boolean;
}

export type FixtureType = 'moving_head' | 'strobe' | 'wash' | 'laser' | 'par';

/**
 * Moving head fixture with pan/tilt capabilities
 */
export interface MovingHead extends BaseFixture {
  type: 'moving_head';
  /** Horizontal rotation, 0-1 (maps to fixture's pan range) */
  pan: number;
  /** Vertical rotation, 0-1 (maps to fixture's tilt range) */
  tilt: number;
  /** Light intensity, 0-1 */
  intensity: number;
  /** Light color */
  color: RGB;
  /** Beam width, 0-1 (spot to flood) */
  beamWidth: number;
  /** Optional gobo pattern */
  gobo?: string;
  /** Pan/tilt animation speed, 0-1 */
  speed: number;
}

/**
 * Strobe fixture for flash effects
 */
export interface Strobe extends BaseFixture {
  type: 'strobe';
  /** Light intensity when on, 0-1 */
  intensity: number;
  /** Strobe rate in Hz (flashes per second) */
  rate: number;
  /** Light color */
  color: RGB;
  /** Duration of each flash in ms */
  flashDuration: number;
}

/**
 * Wash/flood light for area lighting
 */
export interface WashLight extends BaseFixture {
  type: 'wash';
  /** Light intensity, 0-1 */
  intensity: number;
  /** Light color */
  color: RGB;
  /** Spread angle, 0-1 (narrow to wide) */
  spread: number;
}

/**
 * Laser fixture
 */
export interface Laser extends BaseFixture {
  type: 'laser';
  /** Laser intensity, 0-1 */
  intensity: number;
  /** Beam color */
  color: RGB;
  /** Horizontal scan position, 0-1 */
  xPosition: number;
  /** Vertical scan position, 0-1 */
  yPosition: number;
  /** Laser pattern/effect */
  pattern: LaserPattern;
}

export type LaserPattern = 'beam' | 'fan' | 'tunnel' | 'wave' | 'cone';

/**
 * Union type for all fixtures
 */
export type Fixture = MovingHead | Strobe | WashLight | Laser;

/**
 * Command to update fixture state
 */
export interface LightingCommand {
  /** Target fixture ID, or 'all' for broadcast */
  targetId: string | 'all';
  /** Properties to update */
  updates: Partial<Omit<Fixture, 'id' | 'type' | 'position'>>;
  /** Transition duration in ms (0 = instant) */
  transitionMs: number;
  /** Easing function for transition */
  easing: EasingType;
}

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'snap';

/**
 * Stage configuration
 */
export interface StageConfig {
  /** Stage width in meters */
  width: number;
  /** Stage depth in meters */
  depth: number;
  /** Truss height in meters */
  trussHeight: number;
  /** Haze density, 0-1 */
  hazeDensity: number;
  /** Ambient light level, 0-1 */
  ambientLight: number;
}

// =============================================================================
// WORKSTREAM C: Style Learning Types
// =============================================================================

/**
 * Extracted lighting state from a video frame
 */
export interface LightingState {
  /** Timestamp in the video (ms) */
  timestamp: number;

  // ─── Global ─────────────────────────────────────────────────────────────────
  /** Overall scene brightness, 0-1 */
  overallBrightness: number;
  /** Dominant colors in the frame */
  dominantColors: RGB[];
  /** Average color temperature (warm to cool) */
  colorTemperature: number;

  // ─── Spatial ────────────────────────────────────────────────────────────────
  /** Detected lighting regions in the frame */
  regions: LightingRegion[];

  // ─── Events ─────────────────────────────────────────────────────────────────
  /** Strobe/flash detected */
  isStrobe: boolean;
  /** Blackout detected */
  isBlackout: boolean;
  /** Significant color change from previous frame */
  isColorChange: boolean;
  /** Movement detected in lights */
  hasMovement: boolean;
}

/**
 * A detected lighting region within a frame
 */
export interface LightingRegion {
  /** Region position identifier */
  position: 'left' | 'center' | 'right' | 'back' | 'front' | 'top';
  /** Bounding box in normalized coordinates (0-1) */
  bounds: { x: number; y: number; width: number; height: number };
  /** Average brightness in this region, 0-1 */
  brightness: number;
  /** Dominant color in this region */
  color: RGB;
  /** Whether a visible beam is detected */
  hasBeam: boolean;
  /** Detected beam angle in degrees, if applicable */
  beamAngle?: number;
}

/**
 * A learned style profile that can be applied to new audio
 */
export interface StyleProfile {
  /** Name of this style profile */
  name: string;
  /** Source description (e.g., video URL or performance name) */
  source: string;
  /** When this profile was created */
  createdAt: Date;

  // ─── Color Palette ──────────────────────────────────────────────────────────
  /** Preferred color palette */
  palette: {
    /** Primary colors used most frequently */
    primary: RGB[];
    /** Accent colors for highlights */
    accent: RGB[];
    /** Color used for strobe effects */
    strobeColor: RGB;
  };

  // ─── Behavioral Rules ───────────────────────────────────────────────────────
  /** Rules defining how audio maps to lighting */
  rules: StyleRule[];

  // ─── Statistical Patterns ───────────────────────────────────────────────────
  /** Average brightness level */
  avgBrightness: number;
  /** Brightness variance (how dynamic) */
  brightnessVariance: number;
  /** Color change frequency (changes per second) */
  colorChangeRate: number;
  /** Strobe frequency (strobes per beat) */
  strobeRate: number;

  // ─── ML Model (optional) ────────────────────────────────────────────────────
  /** Trained model weights, if using ML approach */
  modelWeights?: ArrayBuffer;
  /** Model type identifier */
  modelType?: 'skip-bart' | 'custom-nn' | 'rules-only';
}

/**
 * A single style rule mapping audio conditions to lighting actions
 */
export interface StyleRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** When this rule triggers */
  trigger: StyleTrigger;
  /** What action to take */
  action: StyleAction;
  /** Probability of triggering when conditions are met, 0-1 */
  probability: number;
  /** Priority for rule ordering (higher = evaluated first) */
  priority: number;
}

/**
 * Conditions that trigger a style rule
 */
export interface StyleTrigger {
  /** Trigger on beat events */
  onBeat?: boolean;
  /** Trigger on downbeat events */
  onDownbeat?: boolean;
  /** Energy threshold (triggers when exceeded) */
  energyThreshold?: number;
  /** Spectral flux threshold */
  fluxThreshold?: number;
  /** Song sections that activate this rule */
  sections?: SongSection[];
  /** Frequency band to monitor */
  frequencyBand?: 'low' | 'mid' | 'high';
  /** Custom condition expression (advanced) */
  customCondition?: string;
}

/**
 * Lighting action to execute when rule triggers
 */
export interface StyleAction {
  /** Type of action */
  type: 'strobe' | 'color_change' | 'intensity_pulse' | 'movement' | 'blackout' | 'all_on';
  /** Target fixtures (by type or specific IDs) */
  targets: FixtureType[] | string[];
  /** Color to apply (if applicable) */
  color?: RGB | 'random_from_palette';
  /** Intensity value or delta */
  intensity?: number | 'from_energy';
  /** Movement parameters */
  movement?: {
    pan?: number | 'random';
    tilt?: number | 'random';
    speed?: number;
  };
  /** Duration of the action in ms */
  durationMs: number;
}

// =============================================================================
// WORKSTREAM D: Mapping Engine Types
// =============================================================================

/**
 * Configuration for the mapping engine
 */
export interface MappingConfig {
  /** Active style profile */
  styleProfile?: StyleProfile;
  /** Global intensity multiplier, 0-2 */
  intensityScale: number;
  /** Response speed, 0-1 (0 = very smoothed, 1 = instant) */
  reactivity: number;
  /** Enable automatic beat sync */
  beatSync: boolean;
  /** Minimum time between strobe triggers (ms) */
  strobeMinInterval: number;
}

/**
 * Interface for the mapping engine that connects audio to lighting
 */
export interface IMappingEngine {
  /** Process an audio frame and generate lighting commands */
  process(frame: AudioFrame): LightingCommand[];
  /** Load a style profile */
  loadStyle(profile: StyleProfile): void;
  /** Update configuration */
  configure(config: Partial<MappingConfig>): void;
  /** Get current state */
  getState(): MappingState;
}

/**
 * Current state of the mapping engine
 */
export interface MappingState {
  /** Currently loaded style profile name */
  activeStyle: string | null;
  /** Current configuration */
  config: MappingConfig;
  /** Last processed audio frame */
  lastFrame: AudioFrame | null;
  /** Commands generated per second (for monitoring) */
  commandsPerSecond: number;
}

// =============================================================================
// EVENTS & CALLBACKS
// =============================================================================

/**
 * Event emitted when audio analysis produces a new frame
 */
export interface AudioFrameEvent {
  type: 'audio_frame';
  frame: AudioFrame;
}

/**
 * Event emitted when a lighting command should be executed
 */
export interface LightingCommandEvent {
  type: 'lighting_command';
  commands: LightingCommand[];
}

/**
 * Event emitted when playback state changes
 */
export interface PlaybackEvent {
  type: 'playback';
  state: 'playing' | 'paused' | 'stopped';
  position: number;
}

export type LightshowEvent = AudioFrameEvent | LightingCommandEvent | PlaybackEvent;

/**
 * Callback for event listeners
 */
export type EventCallback<T extends LightshowEvent = LightshowEvent> = (event: T) => void;

// =============================================================================
// TEST FIXTURES (for development and testing)
// =============================================================================

/**
 * Sample audio frame for testing
 */
export const TEST_AUDIO_FRAME: AudioFrame = {
  timestamp: 1000,
  isBeat: true,
  isDownbeat: false,
  tempo: 128,
  beatPhase: 0,
  beatNumber: 4,
  rms: 0.7,
  energy: 0.75,
  peak: 0.85,
  spectralCentroid: 0.5,
  spectralFlux: 0.3,
  lowEnergy: 0.8,
  midEnergy: 0.5,
  highEnergy: 0.3,
  section: 'drop',
  sectionConfidence: 0.9,
};

/**
 * Sample moving head fixture for testing
 */
export const TEST_MOVING_HEAD: MovingHead = {
  id: 'mh-1',
  type: 'moving_head',
  position: { x: -2, y: 5, z: -3 },
  enabled: true,
  pan: 0.5,
  tilt: 0.3,
  intensity: 1.0,
  color: { r: 1, g: 0, b: 0.5 },
  beamWidth: 0.2,
  speed: 0.5,
};

/**
 * Sample lighting command for testing
 */
export const TEST_LIGHTING_COMMAND: LightingCommand = {
  targetId: 'mh-1',
  updates: {
    intensity: 1.0,
    color: { r: 0, g: 0.5, b: 1 },
  },
  transitionMs: 100,
  easing: 'easeOut',
};
