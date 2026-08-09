import type { PixelBuffer, RGBColor } from '../types';

export type PaletteMode = 'original' | 'reduced';

export interface PaletteSettings {
  /** 'original' performs no reduction. 'reduced' quantizes to at most targetColors colors. */
  mode: PaletteMode;
  /** 2-32. Upper bound on resulting colors in Reduced mode — actual output may be fewer. */
  targetColors: number;
}

export const MIN_PALETTE_COLORS = 2;
export const MAX_PALETTE_COLORS = 32;
/** A recommended starting point for MGO2 emblem readability — not a confirmed technical maximum. */
export const DEFAULT_PALETTE_TARGET = 16;

export const DEFAULT_PALETTE_SETTINGS: PaletteSettings = {
  mode: 'original',
  targetColors: DEFAULT_PALETTE_TARGET,
};

export function clampPaletteTarget(target: number): number {
  return Math.min(MAX_PALETTE_COLORS, Math.max(MIN_PALETTE_COLORS, Math.round(target)));
}

export interface PaletteAnalysis {
  buffer: PixelBuffer;
  /** Deduplicated representative colors actually used, ordered most-populous first (deterministic tiebreak by RGB). */
  palette: RGBColor[];
  /** Distinct RGB values among pixels with alpha > 0 in the input buffer. */
  originalVisibleColorCount: number;
  /** Distinct RGB values among visible pixels in the output. Equals originalVisibleColorCount in Original Colors mode. */
  resultVisibleColorCount: number;
}

export interface ColorCount extends RGBColor {
  count: number;
}

function packColor(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

/**
 * Counts distinct RGB values among visible pixels only. A pixel is "visible"
 * here if alpha > 0 — fully transparent pixels never influence color
 * selection or counts, regardless of what RGB bytes they happen to hold.
 */
export function collectVisibleColorCounts(buffer: PixelBuffer): ColorCount[] {
  const { width, height, data } = buffer;
  const map = new Map<number, ColorCount>();
  const pixelCount = width * height;
  for (let i = 0; i < pixelCount; i++) {
    const p = i * 4;
    if (data[p + 3] === 0) {
      continue;
    }
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const key = packColor(r, g, b);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { r, g, b, count: 1 });
    }
  }
  return Array.from(map.values());
}

/** Distinct RGB values among pixels with alpha > 0. */
export function countVisibleColors(buffer: PixelBuffer): number {
  return collectVisibleColorCounts(buffer).length;
}

interface Box {
  colors: ColorCount[];
  totalCount: number;
}

function sumCount(colors: ColorCount[]): number {
  let total = 0;
  for (const c of colors) {
    total += c.count;
  }
  return total;
}

function boxLongestAxis(box: Box): { channel: 'r' | 'g' | 'b'; range: number } {
  let minR = 255;
  let maxR = 0;
  let minG = 255;
  let maxG = 0;
  let minB = 255;
  let maxB = 0;
  for (const c of box.colors) {
    if (c.r < minR) minR = c.r;
    if (c.r > maxR) maxR = c.r;
    if (c.g < minG) minG = c.g;
    if (c.g > maxG) maxG = c.g;
    if (c.b < minB) minB = c.b;
    if (c.b > maxB) maxB = c.b;
  }
  const rangeR = maxR - minR;
  const rangeG = maxG - minG;
  const rangeB = maxB - minB;
  if (rangeR >= rangeG && rangeR >= rangeB) {
    return { channel: 'r', range: rangeR };
  }
  if (rangeG >= rangeB) {
    return { channel: 'g', range: rangeG };
  }
  return { channel: 'b', range: rangeB };
}

/** Splits a box into two along `channel`, balancing pixel-count weight as evenly as possible. */
function splitBox(box: Box, channel: 'r' | 'g' | 'b'): [Box, Box] {
  const sorted = [...box.colors].sort((a, b) => {
    if (a[channel] !== b[channel]) {
      return a[channel] - b[channel];
    }
    // Deterministic tiebreak when colors share the same value on the split channel.
    if (a.r !== b.r) return a.r - b.r;
    if (a.g !== b.g) return a.g - b.g;
    return a.b - b.b;
  });

  const half = box.totalCount / 2;
  let cumulative = 0;
  let splitIndex = sorted.length - 1;
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i].count;
    if (cumulative >= half) {
      splitIndex = i;
      break;
    }
  }
  // Both halves must be non-empty even for a pathological weight distribution.
  splitIndex = Math.min(Math.max(splitIndex, 0), sorted.length - 2);

  const left = sorted.slice(0, splitIndex + 1);
  const right = sorted.slice(splitIndex + 1);
  return [
    { colors: left, totalCount: sumCount(left) },
    { colors: right, totalCount: sumCount(right) },
  ];
}

/**
 * Deterministic median-cut quantization. Starting from one box containing
 * every distinct visible color, repeatedly splits the splittable box
 * (more than one distinct color) with the largest longest-axis color range —
 * ties broken by larger pixel population, then by box order — along that
 * axis's population-weighted median. Stops at `targetColors` boxes or when
 * no box can be split further, whichever comes first. Identical input color
 * populations and target always produce identical boxes.
 */
function medianCut(colors: ColorCount[], targetColors: number): Box[] {
  if (colors.length === 0) {
    return [];
  }
  const boxes: Box[] = [{ colors, totalCount: sumCount(colors) }];

  while (boxes.length < targetColors) {
    let bestIndex = -1;
    let bestRange = -1;
    let bestTotalCount = -1;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.colors.length <= 1) {
        continue;
      }
      const { range } = boxLongestAxis(box);
      if (range > bestRange || (range === bestRange && box.totalCount > bestTotalCount)) {
        bestIndex = i;
        bestRange = range;
        bestTotalCount = box.totalCount;
      }
    }

    if (bestIndex === -1) {
      break; // no box can be split further — fewer boxes than targetColors is correct here
    }

    const { channel } = boxLongestAxis(boxes[bestIndex]);
    const [left, right] = splitBox(boxes[bestIndex], channel);
    boxes.splice(bestIndex, 1, left, right);
  }

  return boxes;
}

function boxRepresentativeColor(box: Box): RGBColor {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  for (const c of box.colors) {
    rSum += c.r * c.count;
    gSum += c.g * c.count;
    bSum += c.b * c.count;
  }
  return {
    r: Math.round(rSum / box.totalCount),
    g: Math.round(gSum / box.totalCount),
    b: Math.round(bSum / box.totalCount),
  };
}

function quantizeWithColors(buffer: PixelBuffer, colors: ColorCount[], targetColors: number): PaletteAnalysis {
  const { width, height, data } = buffer;
  const output = new Uint8ClampedArray(new ArrayBuffer(data.length));
  output.set(data);

  const originalVisibleColorCount = colors.length;

  if (colors.length === 0) {
    return {
      buffer: { data: output, width, height },
      palette: [],
      originalVisibleColorCount: 0,
      resultVisibleColorCount: 0,
    };
  }

  const target = clampPaletteTarget(targetColors);
  const boxes = medianCut(colors, target);

  const lookup = new Map<number, RGBColor>();
  const paletteWeights = new Map<number, { color: RGBColor; count: number }>();
  for (const box of boxes) {
    const rep = boxRepresentativeColor(box);
    const repKey = packColor(rep.r, rep.g, rep.b);
    const existingWeight = paletteWeights.get(repKey);
    if (existingWeight) {
      existingWeight.count += box.totalCount;
    } else {
      paletteWeights.set(repKey, { color: rep, count: box.totalCount });
    }
    for (const c of box.colors) {
      lookup.set(packColor(c.r, c.g, c.b), rep);
    }
  }

  const pixelCount = width * height;
  for (let i = 0; i < pixelCount; i++) {
    const p = i * 4;
    if (data[p + 3] === 0) {
      continue; // fully transparent pixels stay exactly as-is, never mapped to a palette entry
    }
    const rep = lookup.get(packColor(data[p], data[p + 1], data[p + 2]));
    if (rep) {
      output[p] = rep.r;
      output[p + 1] = rep.g;
      output[p + 2] = rep.b;
      // output[p + 3] (alpha) is left untouched — preserves partial transparency exactly
    }
  }

  const palette = Array.from(paletteWeights.values())
    .sort((a, b) => b.count - a.count || a.color.r - b.color.r || a.color.g - b.color.g || a.color.b - b.color.b)
    .map((entry) => entry.color);

  return {
    buffer: { data: output, width, height },
    palette,
    originalVisibleColorCount,
    resultVisibleColorCount: palette.length,
  };
}

/**
 * The full non-destructive palette stage: given a buffer that has already
 * passed through placement and background processing (never a
 * previously-quantized one), returns the buffer/palette/counts to render.
 * Original Colors mode returns the exact same buffer reference — zero
 * processing — so it reproduces the pre-palette pipeline output exactly.
 */
export function applyPaletteStrategy(buffer: PixelBuffer, settings: PaletteSettings): PaletteAnalysis {
  const colors = collectVisibleColorCounts(buffer);
  const originalVisibleColorCount = colors.length;

  if (settings.mode === 'original') {
    return {
      buffer,
      palette: [],
      originalVisibleColorCount,
      resultVisibleColorCount: originalVisibleColorCount,
    };
  }

  return quantizeWithColors(buffer, colors, settings.targetColors);
}
