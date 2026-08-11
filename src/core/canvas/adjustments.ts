import { luminance } from '../validation/metrics';
import type { PixelBuffer } from '../types';

export interface AdjustmentSettings {
  /** Stretches the 5th-95th percentile luminance range of visible pixels to full 0-255. */
  autoLevels: boolean;
  /** -100..100. 0 is neutral. Applied as a flat offset of up to ±127.5. */
  brightness: number;
  /** -100..100. 0 is neutral. Standard pivot-around-mid-grey contrast curve. */
  contrast: number;
  /** -100..100. 0 is neutral, -100 is full greyscale. */
  saturation: number;
}

export const MIN_ADJUSTMENT = -100;
export const MAX_ADJUSTMENT = 100;

export const DEFAULT_ADJUSTMENT_SETTINGS: AdjustmentSettings = {
  autoLevels: false,
  brightness: 0,
  contrast: 0,
  saturation: 0,
};

export function clampAdjustment(value: number): number {
  return Math.min(MAX_ADJUSTMENT, Math.max(MIN_ADJUSTMENT, Math.round(value)));
}

export function isNeutralAdjustments(settings: AdjustmentSettings): boolean {
  return (
    !settings.autoLevels && settings.brightness === 0 && settings.contrast === 0 && settings.saturation === 0
  );
}

/**
 * 5th/95th percentile luminance of visible pixels, via the same 256-bin
 * histogram approach as computeContrastSpread: exact, order-independent, and
 * immune to a few stray outlier pixels faking a full tonal range.
 */
function computeLevelsRange(buffer: PixelBuffer): { lo: number; hi: number } {
  const { width, height, data } = buffer;
  const histogram = new Uint32Array(256);
  let visibleCount = 0;

  const pixelCount = width * height;
  for (let i = 0; i < pixelCount; i++) {
    const p = i * 4;
    if (data[p + 3] === 0) {
      continue;
    }
    const l = Math.round(luminance(data[p], data[p + 1], data[p + 2]));
    histogram[Math.min(255, Math.max(0, l))]++;
    visibleCount++;
  }

  if (visibleCount === 0) {
    return { lo: 0, hi: 255 };
  }

  const percentileValue = (fraction: number): number => {
    const targetCount = fraction * visibleCount;
    let cumulative = 0;
    for (let bin = 0; bin < 256; bin++) {
      cumulative += histogram[bin];
      if (cumulative >= targetCount) {
        return bin;
      }
    }
    return 255;
  };

  return { lo: percentileValue(0.05), hi: percentileValue(0.95) };
}

/**
 * The tonal adjustment stage: auto-levels, then brightness, then contrast,
 * then saturation, all in floating point with a single clamp on write-out.
 * Fully transparent pixels are never touched, and alpha is never modified.
 * Neutral settings return the exact same buffer reference — zero processing —
 * matching the pipeline's other stages so repeated renders never drift.
 */
export function applyAdjustments(buffer: PixelBuffer, settings: AdjustmentSettings): PixelBuffer {
  if (isNeutralAdjustments(settings)) {
    return buffer;
  }

  const { width, height, data } = buffer;
  const output = new Uint8ClampedArray(new ArrayBuffer(data.length));
  output.set(data);

  let lo = 0;
  let levelScale = 1;
  if (settings.autoLevels) {
    const range = computeLevelsRange(buffer);
    // A degenerate range (flat image) leaves levels as a no-op rather than
    // dividing by zero or blowing a single tone out to white.
    if (range.hi > range.lo) {
      lo = range.lo;
      levelScale = 255 / (range.hi - range.lo);
    }
  }

  const brightnessOffset = (clampAdjustment(settings.brightness) / 100) * 127.5;
  const c = clampAdjustment(settings.contrast) * 2.55;
  const contrastFactor = (259 * (c + 255)) / (255 * (259 - c));
  const saturationFactor = 1 + clampAdjustment(settings.saturation) / 100;

  const pixelCount = width * height;
  for (let i = 0; i < pixelCount; i++) {
    const p = i * 4;
    if (data[p + 3] === 0) {
      continue;
    }
    let r: number = data[p];
    let g: number = data[p + 1];
    let b: number = data[p + 2];

    if (levelScale !== 1 || lo !== 0) {
      r = (r - lo) * levelScale;
      g = (g - lo) * levelScale;
      b = (b - lo) * levelScale;
    }

    r += brightnessOffset;
    g += brightnessOffset;
    b += brightnessOffset;

    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    if (saturationFactor !== 1) {
      const l = luminance(r, g, b);
      r = l + (r - l) * saturationFactor;
      g = l + (g - l) * saturationFactor;
      b = l + (b - l) * saturationFactor;
    }

    output[p] = r;
    output[p + 1] = g;
    output[p + 2] = b;
    // output[p + 3] (alpha) is left untouched.
  }

  return { data: output, width, height };
}
