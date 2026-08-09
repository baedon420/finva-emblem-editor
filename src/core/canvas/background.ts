import type { PixelBuffer, RGBColor } from '../types';

export type BackgroundMode = 'preserve' | 'transparent' | 'replace';

export interface BackgroundSettings {
  /** 'preserve' leaves the image untouched. 'transparent'/'replace' use an edge-connected color mask. */
  mode: BackgroundMode;
  /** Seed color for the mask, normally picked with the eyedropper. No color = no processing yet. */
  sampledColor: RGBColor | null;
  /** 0-100. Higher tolerance matches a broader range of colors around sampledColor. */
  tolerance: number;
  /** Fill color used only in 'replace' mode. */
  replaceColor: RGBColor;
}

export const MIN_TOLERANCE = 0;
export const MAX_TOLERANCE = 100;
export const DEFAULT_TOLERANCE = 24;
/** Maximum possible Euclidean distance between two RGB colors (black to white). */
export const MAX_COLOR_DISTANCE = Math.sqrt(255 * 255 * 3);

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  mode: 'preserve',
  sampledColor: null,
  tolerance: DEFAULT_TOLERANCE,
  replaceColor: { r: 255, g: 255, b: 255 },
};

export function clampTolerance(tolerance: number): number {
  return Math.min(MAX_TOLERANCE, Math.max(MIN_TOLERANCE, tolerance));
}

/** Converts a 0-100 tolerance percentage into a color-distance threshold. */
export function toleranceToDistance(tolerancePercent: number): number {
  return (clampTolerance(tolerancePercent) / 100) * MAX_COLOR_DISTANCE;
}

/** Plain Euclidean distance between two RGB colors. 0 = identical, ~441.67 = black vs white. */
export function colorDistance(a: RGBColor, b: RGBColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isBackgroundMatch(
  r: number,
  g: number,
  b: number,
  a: number,
  seed: RGBColor,
  tolerancePercent: number,
): boolean {
  // A fully transparent pixel is already "background" regardless of its RGB —
  // this preserves any transparency the source image or Fit-mode letterboxing
  // already introduced, without requiring the user to sample it separately.
  if (a === 0) {
    return true;
  }
  return colorDistance({ r, g, b }, seed) <= toleranceToDistance(tolerancePercent);
}

/**
 * Iterative (explicit-stack, non-recursive) 4-connected flood fill seeded
 * from every pixel on the canvas border that matches `seedColor` within
 * `tolerancePercent`. Returns a mask where 1 means "background, reachable
 * from a canvas edge." A same-colored region that is fully enclosed by
 * non-matching pixels is never reachable from the edges and is therefore
 * never marked — interior regions are protected purely by connectivity,
 * not by re-checking color alone.
 */
export function computeEdgeConnectedBackgroundMask(
  buffer: PixelBuffer,
  seedColor: RGBColor,
  tolerancePercent: number,
): Uint8Array {
  const { width, height, data } = buffer;
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  const tryVisit = (x: number, y: number): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }
    const idx = y * width + x;
    if (visited[idx]) {
      return;
    }
    visited[idx] = 1;
    const p = idx * 4;
    if (isBackgroundMatch(data[p], data[p + 1], data[p + 2], data[p + 3], seedColor, tolerancePercent)) {
      mask[idx] = 1;
      stack.push(idx);
    }
  };

  for (let x = 0; x < width; x++) {
    tryVisit(x, 0);
    tryVisit(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryVisit(0, y);
    tryVisit(width - 1, y);
  }

  while (stack.length > 0) {
    const idx = stack.pop() as number;
    const x = idx % width;
    const y = Math.floor(idx / width);
    tryVisit(x + 1, y);
    tryVisit(x - 1, y);
    tryVisit(x, y + 1);
    tryVisit(x, y - 1);
  }

  return mask;
}

/**
 * Applies a precomputed mask to a pixel buffer, returning a new buffer.
 * The input buffer is never mutated.
 */
export function applyBackgroundMask(
  buffer: PixelBuffer,
  mask: Uint8Array,
  mode: Extract<BackgroundMode, 'transparent' | 'replace'>,
  replaceColor: RGBColor,
): PixelBuffer {
  const { width, height, data } = buffer;
  const output = new Uint8ClampedArray(new ArrayBuffer(data.length));
  output.set(data);

  for (let idx = 0; idx < mask.length; idx++) {
    if (!mask[idx]) {
      continue;
    }
    const p = idx * 4;
    if (mode === 'transparent') {
      output[p + 3] = 0;
    } else {
      output[p] = replaceColor.r;
      output[p + 1] = replaceColor.g;
      output[p + 2] = replaceColor.b;
      output[p + 3] = 255;
    }
  }

  return { data: output, width, height };
}

/**
 * The full non-destructive background stage: given a freshly-placed pixel
 * buffer (never a previously-masked one) and the current background
 * settings, returns the buffer to actually render. Preserve mode — and any
 * mode before a color has been sampled — returns the exact same buffer
 * reference, doing no processing at all.
 */
export function applyBackgroundStrategy(buffer: PixelBuffer, settings: BackgroundSettings): PixelBuffer {
  if (settings.mode === 'preserve' || !settings.sampledColor) {
    return buffer;
  }
  const mask = computeEdgeConnectedBackgroundMask(buffer, settings.sampledColor, settings.tolerance);
  return applyBackgroundMask(buffer, mask, settings.mode, settings.replaceColor);
}
