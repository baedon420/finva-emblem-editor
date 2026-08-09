import type { PixelBuffer } from '../types';

/**
 * Rec. 709 relative luminance on a 0-255 scale. Chosen over a naive RGB
 * average because it weights green far more heavily than blue, matching
 * human brightness perception — the thing that actually determines whether
 * an emblem's shapes separate from each other at small size.
 */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface VisiblePixelStats {
  /** Pixels with alpha > 0. */
  visibleCount: number;
  /** Pixels with 0 < alpha < 255 — the only directly measurable antialiasing signal. */
  partialAlphaCount: number;
  /** Bounding box of visible pixels, or null when nothing is visible. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  /** Center of mass of visible pixels, or null when nothing is visible. */
  centroid: { x: number; y: number } | null;
}

export function computeVisiblePixelStats(buffer: PixelBuffer): VisiblePixelStats {
  const { width, height, data } = buffer;
  let visibleCount = 0;
  let partialAlphaCount = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha === 0) {
        continue;
      }
      visibleCount++;
      if (alpha < 255) {
        partialAlphaCount++;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sumX += x;
      sumY += y;
    }
  }

  if (visibleCount === 0) {
    return { visibleCount: 0, partialAlphaCount: 0, bounds: null, centroid: null };
  }

  return {
    visibleCount,
    partialAlphaCount,
    bounds: { minX, minY, maxX, maxY },
    centroid: { x: sumX / visibleCount, y: sumY / visibleCount },
  };
}

/**
 * Spread between the 5th and 95th percentile luminance across visible
 * pixels, normalized to 0-1. Percentiles rather than min/max so a handful
 * of stray bright or dark pixels cannot make a flat image look
 * high-contrast. Uses a 256-bin histogram, so the result is exact and
 * order-independent (no floating-point sort instability).
 */
export function computeContrastSpread(buffer: PixelBuffer): number {
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
    return 0;
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

  return (percentileValue(0.95) - percentileValue(0.05)) / 255;
}

/**
 * Fraction of orthogonally adjacent pixel pairs that differ meaningfully.
 * A pair differs if its visibility differs, or (when both visible) its
 * luminance differs by more than `luminanceThreshold`. Near 0 means large
 * flat regions; near 1 means nearly every neighbouring pixel changes, i.e.
 * per-pixel noise that will not survive being displayed small.
 */
export function computeTransitionRatio(buffer: PixelBuffer, luminanceThreshold: number): number {
  const { width, height, data } = buffer;
  let transitions = 0;
  let pairs = 0;

  const differs = (indexA: number, indexB: number): boolean => {
    const pA = indexA * 4;
    const pB = indexB * 4;
    const visibleA = data[pA + 3] > 0;
    const visibleB = data[pB + 3] > 0;
    if (visibleA !== visibleB) {
      return true;
    }
    if (!visibleA) {
      return false;
    }
    const lA = luminance(data[pA], data[pA + 1], data[pA + 2]);
    const lB = luminance(data[pB], data[pB + 1], data[pB + 2]);
    return Math.abs(lA - lB) > luminanceThreshold;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (x + 1 < width) {
        pairs++;
        if (differs(index, index + 1)) {
          transitions++;
        }
      }
      if (y + 1 < height) {
        pairs++;
        if (differs(index, index + width)) {
          transitions++;
        }
      }
    }
  }

  return pairs === 0 ? 0 : transitions / pairs;
}
