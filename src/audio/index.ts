/**
 * Workstream A: Audio Analysis Pipeline
 *
 * This module is responsible for:
 * - Loading and decoding audio files
 * - Real-time audio feature extraction
 * - Beat and tempo detection
 * - Producing AudioFrame objects for the mapping engine
 * - Advanced pre-analysis with BPM detection and beat grid
 * - Frequency band analysis and cue scheduling
 */

// Original analyzers
export { AudioAnalyzer } from './AudioAnalyzer';
export { FeatureExtractor } from './FeatureExtractor';
export { BeatDetector } from './BeatDetector';

// Advanced analysis system
export { AdvancedAnalyzer } from './AdvancedAnalyzer';
export type { EnhancedAudioFrame, AdvancedAnalyzerConfig } from './AdvancedAnalyzer';

export { AnalysisCache } from './AnalysisCache';

export { BeatGrid } from './BeatGrid';
export type { BeatInfo } from './BeatGrid';

export { CueScheduler } from './CueScheduler';
export type { LightingCue, CueAction, PreAnalysisResult } from './CueScheduler';
