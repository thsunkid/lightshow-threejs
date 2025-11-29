/**
 * VideoAnalyzer - Analyzes video frames to extract lighting states
 *
 * This class processes video frames to detect lighting patterns, colors,
 * brightness levels, and spatial regions for style learning.
 */

import type { LightingState, LightingRegion, RGB } from '../shared/types';

/**
 * Analyzes video frames to extract lighting information
 */
export class VideoAnalyzer {
  private previousState: LightingState | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    // Create offscreen canvas for pixel analysis
    this.canvas = typeof document !== 'undefined'
      ? document.createElement('canvas')
      : {} as HTMLCanvasElement;

    this.ctx = this.canvas?.getContext?.('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  }

  /**
   * Analyze a single video frame or canvas
   * @param source - Video element, canvas, or image data to analyze
   * @returns Extracted lighting state
   */
  analyzeFrame(source: HTMLVideoElement | HTMLCanvasElement | ImageData): LightingState {
    const imageData = this.getImageData(source);

    const overallBrightness = this.calculateBrightness(imageData);
    const dominantColors = this.extractDominantColors(imageData, 3);
    const colorTemperature = this.calculateColorTemperature(dominantColors[0] || { r: 0.5, g: 0.5, b: 0.5 });
    const regions = this.analyzeRegions(imageData);

    const currentState: LightingState = {
      timestamp: Date.now(),
      overallBrightness,
      dominantColors,
      colorTemperature,
      regions,
      isStrobe: false,
      isBlackout: overallBrightness < 0.05,
      isColorChange: false,
      hasMovement: false
    };

    // Detect strobe and color changes using previous state
    if (this.previousState) {
      currentState.isStrobe = this.detectStrobe(currentState, this.previousState);
      currentState.isColorChange = this.detectColorChange(currentState, this.previousState);
      currentState.hasMovement = this.detectMovement(regions, this.previousState.regions);
    }

    this.previousState = currentState;
    return currentState;
  }

  /**
   * Analyze an entire video, extracting frames at specified rate
   * @param video - HTML video element to analyze
   * @param frameRate - Frames per second to sample (default 10)
   * @returns Array of lighting states over time
   */
  async analyzeVideo(video: HTMLVideoElement, frameRate: number = 10): Promise<LightingState[]> {
    const states: LightingState[] = [];
    const duration = video.duration;
    const frameInterval = 1 / frameRate;

    // Reset video to start
    video.currentTime = 0;

    for (let time = 0; time < duration; time += frameInterval) {
      await this.seekToTime(video, time);
      const state = this.analyzeFrame(video);
      state.timestamp = time * 1000; // Convert to milliseconds
      states.push(state);
    }

    return states;
  }

  /**
   * Extract dominant colors from image using k-means clustering
   * @param imageData - Image data to analyze
   * @param count - Number of dominant colors to extract
   * @returns Array of RGB colors
   */
  extractDominantColors(imageData: ImageData, count: number = 3): RGB[] {
    const pixels = this.samplePixels(imageData, 1000); // Sample for performance

    // Initialize clusters with random pixels
    let clusters = this.initializeClusters(pixels, count);

    // K-means iterations
    for (let iter = 0; iter < 10; iter++) {
      const assignments = this.assignPixelsToClusters(pixels, clusters);
      clusters = this.updateClusters(pixels, assignments, count);
    }

    // Sort by cluster size (most dominant first)
    return clusters.map(c => ({
      r: Math.min(1, Math.max(0, c.r / 255)),
      g: Math.min(1, Math.max(0, c.g / 255)),
      b: Math.min(1, Math.max(0, c.b / 255))
    }));
  }

  /**
   * Detect if current frame is a strobe flash
   * @param current - Current lighting state
   * @param previous - Previous lighting state
   * @returns True if strobe detected
   */
  detectStrobe(current: LightingState, previous: LightingState): boolean {
    const brightnessDelta = current.overallBrightness - previous.overallBrightness;

    // Strobe = sudden brightness spike > 0.5
    if (brightnessDelta > 0.5) {
      return true;
    }

    // Or sudden brightness drop after high brightness (strobe off)
    if (previous.overallBrightness > 0.8 && current.overallBrightness < 0.2) {
      return true;
    }

    return false;
  }

  /**
   * Divide frame into regions for spatial analysis
   * @param imageData - Image data to analyze
   * @returns Array of lighting regions
   */
  analyzeRegions(imageData: ImageData): LightingRegion[] {
    const regions: LightingRegion[] = [];

    // Define region boundaries
    const regionDefs: Array<{
      position: LightingRegion['position'];
      bounds: { x: number; y: number; width: number; height: number };
    }> = [
      { position: 'left', bounds: { x: 0, y: 0.2, width: 0.33, height: 0.6 } },
      { position: 'center', bounds: { x: 0.33, y: 0.2, width: 0.34, height: 0.6 } },
      { position: 'right', bounds: { x: 0.67, y: 0.2, width: 0.33, height: 0.6 } },
      { position: 'top', bounds: { x: 0.2, y: 0, width: 0.6, height: 0.3 } },
      { position: 'back', bounds: { x: 0.2, y: 0.7, width: 0.6, height: 0.3 } },
      { position: 'front', bounds: { x: 0.25, y: 0.5, width: 0.5, height: 0.3 } }
    ];

    for (const def of regionDefs) {
      const regionData = this.extractRegion(imageData, def.bounds);
      const brightness = this.calculateBrightness(regionData);
      const colors = this.extractDominantColors(regionData, 1);
      const hasBeam = this.detectBeam(regionData, brightness);

      regions.push({
        position: def.position,
        bounds: def.bounds,
        brightness,
        color: colors[0] || { r: 0, g: 0, b: 0 },
        hasBeam,
        beamAngle: hasBeam ? this.estimateBeamAngle(regionData) : undefined
      });
    }

    return regions;
  }

  // === Private Helper Methods ===

  private getImageData(source: HTMLVideoElement | HTMLCanvasElement | ImageData): ImageData {
    if ('data' in source && source.data instanceof Uint8ClampedArray) {
      return source as ImageData;
    }

    const element = source as HTMLVideoElement | HTMLCanvasElement;
    const width = element.width || (element as HTMLVideoElement).videoWidth || 640;
    const height = element.height || (element as HTMLVideoElement).videoHeight || 480;

    this.canvas.width = width;
    this.canvas.height = height;

    this.ctx.drawImage(element, 0, 0, width, height);
    return this.ctx.getImageData(0, 0, width, height);
  }

  private calculateBrightness(imageData: ImageData): number {
    const data = imageData.data;
    let totalBrightness = 0;
    let pixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      // Use perceived brightness formula
      const brightness = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      totalBrightness += brightness;
      pixelCount++;
    }

    return totalBrightness / pixelCount;
  }

  private calculateColorTemperature(color: RGB): number {
    // Simplified color temperature estimation
    // Warm (red/orange) = low values, Cool (blue) = high values
    const warmth = (color.r * 2 - color.b) / 2;
    return Math.max(0, Math.min(1, 0.5 + warmth * 0.5));
  }

  private samplePixels(imageData: ImageData, sampleSize: number): Array<{ r: number; g: number; b: number }> {
    const pixels: Array<{ r: number; g: number; b: number }> = [];
    const data = imageData.data;
    const pixelCount = data.length / 4;
    const step = Math.max(1, Math.floor(pixelCount / sampleSize));

    for (let i = 0; i < data.length; i += step * 4) {
      pixels.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2]
      });
    }

    return pixels;
  }

  private initializeClusters(pixels: Array<{ r: number; g: number; b: number }>, k: number) {
    const clusters = [];
    for (let i = 0; i < k; i++) {
      const pixel = pixels[Math.floor(Math.random() * pixels.length)];
      clusters.push({ ...pixel });
    }
    return clusters;
  }

  private assignPixelsToClusters(
    pixels: Array<{ r: number; g: number; b: number }>,
    clusters: Array<{ r: number; g: number; b: number }>
  ): number[] {
    return pixels.map(pixel => {
      let minDist = Infinity;
      let bestCluster = 0;

      clusters.forEach((cluster, idx) => {
        const dist = Math.sqrt(
          Math.pow(pixel.r - cluster.r, 2) +
          Math.pow(pixel.g - cluster.g, 2) +
          Math.pow(pixel.b - cluster.b, 2)
        );

        if (dist < minDist) {
          minDist = dist;
          bestCluster = idx;
        }
      });

      return bestCluster;
    });
  }

  private updateClusters(
    pixels: Array<{ r: number; g: number; b: number }>,
    assignments: number[],
    k: number
  ): Array<{ r: number; g: number; b: number }> {
    const newClusters = Array(k).fill(null).map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

    pixels.forEach((pixel, idx) => {
      const cluster = newClusters[assignments[idx]];
      cluster.r += pixel.r;
      cluster.g += pixel.g;
      cluster.b += pixel.b;
      cluster.count++;
    });

    return newClusters.map(cluster => ({
      r: cluster.count > 0 ? cluster.r / cluster.count : 128,
      g: cluster.count > 0 ? cluster.g / cluster.count : 128,
      b: cluster.count > 0 ? cluster.b / cluster.count : 128
    }));
  }

  private detectColorChange(current: LightingState, previous: LightingState): boolean {
    if (!current.dominantColors[0] || !previous.dominantColors[0]) return false;

    const colorDist = Math.sqrt(
      Math.pow(current.dominantColors[0].r - previous.dominantColors[0].r, 2) +
      Math.pow(current.dominantColors[0].g - previous.dominantColors[0].g, 2) +
      Math.pow(current.dominantColors[0].b - previous.dominantColors[0].b, 2)
    );

    return colorDist > 0.3; // Threshold for significant color change
  }

  private detectMovement(current: LightingRegion[], previous: LightingRegion[]): boolean {
    if (current.length !== previous.length) return false;

    let totalBrightnessShift = 0;

    for (let i = 0; i < current.length; i++) {
      const currRegion = current[i];
      const prevRegion = previous.find(r => r.position === currRegion.position);

      if (prevRegion) {
        totalBrightnessShift += Math.abs(currRegion.brightness - prevRegion.brightness);
      }
    }

    // Movement detected if brightness shifts significantly across regions
    return totalBrightnessShift > 0.5;
  }

  private extractRegion(imageData: ImageData, bounds: { x: number; y: number; width: number; height: number }): ImageData {
    const { width, height } = imageData;
    const regionX = Math.floor(bounds.x * width);
    const regionY = Math.floor(bounds.y * height);
    const regionWidth = Math.floor(bounds.width * width);
    const regionHeight = Math.floor(bounds.height * height);

    // Create new ImageData for the region
    const regionData = new ImageData(regionWidth, regionHeight);
    const srcData = imageData.data;
    const dstData = regionData.data;

    for (let y = 0; y < regionHeight; y++) {
      for (let x = 0; x < regionWidth; x++) {
        const srcIdx = ((regionY + y) * width + (regionX + x)) * 4;
        const dstIdx = (y * regionWidth + x) * 4;

        dstData[dstIdx] = srcData[srcIdx];
        dstData[dstIdx + 1] = srcData[srcIdx + 1];
        dstData[dstIdx + 2] = srcData[srcIdx + 2];
        dstData[dstIdx + 3] = srcData[srcIdx + 3];
      }
    }

    return regionData;
  }

  private detectBeam(imageData: ImageData, brightness: number): boolean {
    // Simple beam detection: high brightness with concentrated bright pixels
    if (brightness < 0.3) return false;

    const data = imageData.data;
    let brightPixelCount = 0;
    const threshold = 200; // Brightness threshold for beam pixels

    for (let i = 0; i < data.length; i += 4) {
      const pixelBrightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (pixelBrightness > threshold) {
        brightPixelCount++;
      }
    }

    const brightPixelRatio = brightPixelCount / (data.length / 4);
    return brightPixelRatio > 0.1 && brightPixelRatio < 0.4; // Beam is concentrated, not flood
  }

  private estimateBeamAngle(_imageData: ImageData): number {
    // Simplified beam angle estimation based on bright pixel distribution
    // This is a placeholder - real implementation would use edge detection
    return Math.random() * 90 - 45; // Random angle between -45 and 45 degrees
  }

  private seekToTime(video: HTMLVideoElement, time: number): Promise<void> {
    return new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };

      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;

      // Fallback timeout
      setTimeout(() => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      }, 100);
    });
  }
}