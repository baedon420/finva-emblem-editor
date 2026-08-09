import { describe, expect, it } from 'vitest';
import type { PixelBuffer, RGBColor } from '../types';
import {
  DEFAULT_BACKGROUND_SETTINGS,
  MAX_COLOR_DISTANCE,
  applyBackgroundMask,
  applyBackgroundStrategy,
  clampTolerance,
  colorDistance,
  computeEdgeConnectedBackgroundMask,
  toleranceToDistance,
} from './background';
import type { BackgroundSettings } from './background';

type Pixel = [number, number, number, number];

function makeGridBuffer(rows: Pixel[][]): PixelBuffer {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  rows.forEach((row, y) => {
    row.forEach(([r, g, b, a], x) => {
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    });
  });
  return { data, width, height };
}

describe('colorDistance / toleranceToDistance / clampTolerance', () => {
  it('computes plain Euclidean RGB distance', () => {
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 })).toBe(0);
    expect(colorDistance({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 0 })).toBe(255);
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(MAX_COLOR_DISTANCE);
  });

  it('maps a 0-100 tolerance percentage linearly onto the distance range', () => {
    expect(toleranceToDistance(0)).toBe(0);
    expect(toleranceToDistance(100)).toBeCloseTo(MAX_COLOR_DISTANCE);
    expect(toleranceToDistance(50)).toBeCloseTo(MAX_COLOR_DISTANCE / 2);
  });

  it('clamps tolerance to 0-100', () => {
    expect(clampTolerance(-10)).toBe(0);
    expect(clampTolerance(150)).toBe(100);
  });
});

describe('computeEdgeConnectedBackgroundMask — edge-connected removal and protected interior regions', () => {
  // 5x5 grid: a white (W) ring connected to every canvas edge, enclosing a
  // 3x3 black (B) subject block, which itself encloses a single white (H)
  // "hole" pixel that is NOT reachable from any edge.
  const W: Pixel = [255, 255, 255, 255];
  const B: Pixel = [0, 0, 0, 255];
  const grid: Pixel[][] = [
    [W, W, W, W, W],
    [W, B, B, B, W],
    [W, B, W, B, W], // center pixel is white but fully enclosed by black
    [W, B, B, B, W],
    [W, W, W, W, W],
  ];
  const buffer = makeGridBuffer(grid);
  const seed: RGBColor = { r: 255, g: 255, b: 255 };
  const mask = computeEdgeConnectedBackgroundMask(buffer, seed, 0);
  const at = (x: number, y: number) => mask[y * 5 + x];

  it('marks the edge-connected white ring as background', () => {
    expect(at(0, 0)).toBe(1);
    expect(at(2, 0)).toBe(1);
    expect(at(4, 4)).toBe(1);
    expect(at(0, 2)).toBe(1);
    expect(at(4, 2)).toBe(1);
  });

  it('never marks the black subject as background', () => {
    expect(at(1, 1)).toBe(0);
    expect(at(2, 1)).toBe(0);
    expect(at(3, 3)).toBe(0);
  });

  it('protects the enclosed same-colored interior pixel — it is unreachable from any edge', () => {
    expect(at(2, 2)).toBe(0);
  });
});

describe('computeEdgeConnectedBackgroundMask — tolerance boundaries', () => {
  const seed: RGBColor = { r: 100, g: 100, b: 100 };

  it('at zero tolerance, only an exact color match counts as background', () => {
    const buffer = makeGridBuffer([
      [
        [100, 100, 100, 255],
        [101, 100, 100, 255],
      ],
    ]);
    const mask = computeEdgeConnectedBackgroundMask(buffer, seed, 0);
    expect(mask[0]).toBe(1); // exact match
    expect(mask[1]).toBe(0); // 1 unit off, exceeds zero tolerance
  });

  it('raising tolerance includes a previously-excluded near-background color', () => {
    // (130,100,100) is exactly distance 30 from the seed.
    const buffer = makeGridBuffer([
      [
        [130, 100, 100, 255],
        [100, 100, 100, 255],
      ],
    ]);
    const lowTolerance = computeEdgeConnectedBackgroundMask(buffer, seed, 5); // threshold ~22 < 30
    const highTolerance = computeEdgeConnectedBackgroundMask(buffer, seed, 50); // threshold ~221 > 30

    expect(lowTolerance[0]).toBe(0);
    expect(highTolerance[0]).toBe(1);
  });
});

describe('computeEdgeConnectedBackgroundMask — existing transparency', () => {
  it('treats fully transparent pixels as background regardless of RGB, if reachable from an edge', () => {
    const seed: RGBColor = { r: 0, g: 0, b: 0 };
    const buffer = makeGridBuffer([
      [
        [0, 0, 0, 0], // already transparent -> background
        [200, 50, 10, 0], // already transparent, wildly different RGB -> still background
        [9, 9, 9, 255], // opaque, slightly off-color, zero tolerance -> not background
      ],
    ]);
    const mask = computeEdgeConnectedBackgroundMask(buffer, seed, 0);
    expect(mask[0]).toBe(1);
    expect(mask[1]).toBe(1);
    expect(mask[2]).toBe(0);
  });
});

describe('applyBackgroundMask', () => {
  it('zeroes alpha for masked pixels in transparent mode and leaves unmasked pixels untouched', () => {
    const buffer = makeGridBuffer([
      [
        [255, 255, 255, 255],
        [10, 20, 30, 255],
      ],
    ]);
    const mask = new Uint8Array([1, 0]);
    const result = applyBackgroundMask(buffer, mask, 'transparent', { r: 0, g: 0, b: 0 });
    expect(result.data[3]).toBe(0);
    expect(Array.from(result.data.slice(4, 8))).toEqual([10, 20, 30, 255]);
  });

  it('replaces masked pixels with the replacement color at full opacity in replace mode', () => {
    const buffer = makeGridBuffer([
      [
        [255, 255, 255, 255],
        [10, 20, 30, 255],
      ],
    ]);
    const mask = new Uint8Array([1, 0]);
    const replaceColor: RGBColor = { r: 20, g: 200, b: 50 };
    const result = applyBackgroundMask(buffer, mask, 'replace', replaceColor);
    expect(Array.from(result.data.slice(0, 4))).toEqual([20, 200, 50, 255]);
    expect(Array.from(result.data.slice(4, 8))).toEqual([10, 20, 30, 255]);
  });

  it('does not mutate the input buffer', () => {
    const buffer = makeGridBuffer([[[255, 255, 255, 255]]]);
    const originalCopy = Array.from(buffer.data);
    applyBackgroundMask(buffer, new Uint8Array([1]), 'transparent', { r: 0, g: 0, b: 0 });
    expect(Array.from(buffer.data)).toEqual(originalCopy);
  });
});

describe('applyBackgroundStrategy — Preserve-mode identity and end-to-end masking', () => {
  it('Preserve mode returns the exact same buffer reference — zero processing', () => {
    const buffer = makeGridBuffer([
      [
        [10, 20, 30, 255],
        [40, 50, 60, 128],
      ],
    ]);
    const settings: BackgroundSettings = {
      mode: 'preserve',
      sampledColor: { r: 10, g: 20, b: 30 },
      tolerance: 50,
      replaceColor: { r: 0, g: 0, b: 0 },
    };
    expect(applyBackgroundStrategy(buffer, settings)).toBe(buffer);
  });

  it('a non-preserve mode with no sampled color yet also does nothing (identity)', () => {
    const buffer = makeGridBuffer([[[10, 20, 30, 255]]]);
    const settings: BackgroundSettings = {
      mode: 'transparent',
      sampledColor: null,
      tolerance: 50,
      replaceColor: { r: 0, g: 0, b: 0 },
    };
    expect(applyBackgroundStrategy(buffer, settings)).toBe(buffer);
  });

  it('applies transparent removal end-to-end once a color is sampled', () => {
    const W: Pixel = [255, 255, 255, 255];
    const B: Pixel = [0, 0, 0, 255];
    const buffer = makeGridBuffer([
      [W, W, W],
      [W, B, W],
      [W, W, W],
    ]);
    const settings: BackgroundSettings = {
      mode: 'transparent',
      sampledColor: { r: 255, g: 255, b: 255 },
      tolerance: 0,
      replaceColor: { r: 0, g: 0, b: 0 },
    };
    const result = applyBackgroundStrategy(buffer, settings);
    const centerIndex = (1 * 3 + 1) * 4;
    expect(result.data[centerIndex + 3]).toBe(255); // subject stays opaque
    expect(result.data[3]).toBe(0); // corner background pixel now transparent
  });

  it('applies replacement end-to-end with the configured replace color', () => {
    const W: Pixel = [255, 255, 255, 255];
    const B: Pixel = [0, 0, 0, 255];
    const buffer = makeGridBuffer([
      [W, W, W],
      [W, B, W],
      [W, W, W],
    ]);
    const settings: BackgroundSettings = {
      mode: 'replace',
      sampledColor: { r: 255, g: 255, b: 255 },
      tolerance: 0,
      replaceColor: { r: 20, g: 200, b: 50 },
    };
    const result = applyBackgroundStrategy(buffer, settings);
    expect(Array.from(result.data.slice(0, 4))).toEqual([20, 200, 50, 255]);
    const centerIndex = (1 * 3 + 1) * 4;
    expect(Array.from(result.data.slice(centerIndex, centerIndex + 4))).toEqual([0, 0, 0, 255]);
  });
});

describe('DEFAULT_BACKGROUND_SETTINGS', () => {
  it('defaults to Preserve mode with no sampled color', () => {
    expect(DEFAULT_BACKGROUND_SETTINGS.mode).toBe('preserve');
    expect(DEFAULT_BACKGROUND_SETTINGS.sampledColor).toBeNull();
  });
});
