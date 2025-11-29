/**
 * Workstream A: Audio Analysis Pipeline
 *
 * This module is responsible for:
 * - Loading and decoding audio files
 * - Real-time audio feature extraction
 * - Beat and tempo detection
 * - Producing AudioFrame objects for the mapping engine
 */

export { AudioAnalyzer } from './AudioAnalyzer';
export { FeatureExtractor } from './FeatureExtractor';
export { BeatDetector } from './BeatDetector';
