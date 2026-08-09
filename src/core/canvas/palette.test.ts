import { describe, expect, it } from 'vitest';
import { applyBackgroundStrategy } from './background';
import type { BackgroundSettings } from './background';
import { DEFAULT_PALETTE_SETTINGS, MAX_PALETTE_COLORS, MIN_PALETTE_COLORS, applyPaletteStrategy, clampPaletteTarget } from './palette';
import type { PaletteSettings } from './palette';
import type { PixelBuffer } from '../types';

type Pixel = [number, number, number, number];

function makeBuffer(pixels: Pixel[], width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  pixels.forEach(([r, g, b, a], index) => {
    const idx = index * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = a;
  });
  return { data, width, height };
}

function settings(overrides: Partial<PaletteSettings> = {}): PaletteSettings {
  return { ...DEFAULT_PALETTE_SETTINGS, ...overrides };
}

describe('applyPaletteStrategy — Original Colors identity', () => {
  it('returns the exact same buffer reference in Original Colors mode', () => {
    const buffer = makeBuffer(
      [
        [10, 20, 30, 255],
        [40, 50, 60, 255],
        [70, 80, 90, 128],
      ],
      3,
      1,
    );
    const result = applyPaletteStrategy(buffer, settings({ mode: 'original' }));
    expect(result.buffer).toBe(buffer);
  });

  it('reports matching original and resulting counts in Original Colors mode', () => {
    const buffer = makeBuffer(
      [
        [10, 20, 30, 255],
        [40, 50, 60, 255],
        [10, 20, 30, 255],
      ],
      3,
      1,
    );
    const result = applyPaletteStrategy(buffer, settings({ mode: 'original' }));
    expect(result.originalVisibleColorCount).toBe(2);
    expect(result.resultVisibleColorCount).toBe(2);
  });
});

describe('applyPaletteStrategy — deterministic output', () => {
  it('produces byte-identical output for identical input and settings across repeated runs', () => {
    const pixels: Pixel[] = [];
    for (let i = 0; i < 64; i++) {
      pixels.push([(i * 7) % 256, (i * 13) % 256, (i * 29) % 256, 255]);
    }
    const buffer = makeBuffer(pixels, 8, 8);
    const s = settings({ mode: 'reduced', targetColors: 8 });
    const first = applyPaletteStrategy(buffer, s);
    const second = applyPaletteStrategy(buffer, s);
    expect(Array.from(first.buffer.data)).toEqual(Array.from(second.buffer.data));
    expect(first.palette).toEqual(second.palette);
    expect(first.resultVisibleColorCount).toBe(second.resultVisibleColorCount);
  });
});

describe('applyPaletteStrategy — target bounds', () => {
  it('never produces more colors than the requested target', () => {
    const pixels: Pixel[] = [];
    for (let i = 0; i < 200; i++) {
      pixels.push([(i * 3) % 256, (i * 17) % 256, (i * 41) % 256, 255]);
    }
    const buffer = makeBuffer(pixels, 20, 10);
    const result = applyPaletteStrategy(buffer, settings({ mode: 'reduced', targetColors: 10 }));
    expect(result.resultVisibleColorCount).toBeLessThanOrEqual(10);
    expect(result.palette.length).toBeLessThanOrEqual(10);
  });

  it('clamps target requests below the minimum', () => {
    expect(clampPaletteTarget(0)).toBe(MIN_PALETTE_COLORS);
    expect(clampPaletteTarget(-5)).toBe(MIN_PALETTE_COLORS);
  });

  it('clamps target requests above the maximum', () => {
    expect(clampPaletteTarget(1000)).toBe(MAX_PALETTE_COLORS);
  });
});

describe('applyPaletteStrategy — one-color input', () => {
  it('produces exactly one palette color and does not invent additional colors', () => {
    const pixels: Pixel[] = Array.from({ length: 16 }, () => [120, 60, 200, 255] as Pixel);
    const buffer = makeBuffer(pixels, 4, 4);
    const result = applyPaletteStrategy(buffer, settings({ mode: 'reduced', targetColors: 16 }));
    expect(result.palette).toHaveLength(1);
    expect(result.palette[0]).toEqual({ r: 120, g: 60, b: 200 });
    expect(result.resultVisibleColorCount).toBe(1);
  });
});

describe('applyPaletteStrategy — fewer source colors than requested target', () => {
  it('produces exactly as many colors as exist in the source, not the requested target', () => {
    const pixels: Pixel[] = [
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
    ];
    const buffer = makeBuffer(pixels, 3, 1);
    const result = applyPaletteStrategy(buffer, settings({ mode: 'reduced', targetColors: 16 }));
    expect(result.resultVisibleColorCount).toBe(3);
    expect(result.palette).toHaveLength(3);
  });
});

describe('applyPaletteStrategy — fully transparent input', () => {
  it('handles an entirely transparent image safely with zero colors and an unchanged buffer', () => {
    const pixels: Pixel[] = Array.from({ length: 9 }, () => [10, 20, 30, 0] as Pixel);
    const buffer = makeBuffer(pixels, 3, 3);
    const result = applyPaletteStrategy(buffer, settings({ mode: 'reduced', targetColors: 8 }));
    expect(result.originalVisibleColorCount).toBe(0);
    expect(result.resultVisibleColorCount).toBe(0);
    expect(result.palette).toHaveLength(0);
    expect(Array.from(result.buffer.data)).toEqual(Array.from(buffer.data));
  });
});

describe('applyPaletteStrategy — transparent pixels excluded from selection and counting', () => {
  it('does not let fully transparent pixels influence the color count or palette', () => {
    const pixels: Pixel[] = [
      [255, 0, 0, 255],
      [0, 0, 0, 0], // fully transparent, wildly different color, must be ignored
      [255, 0, 0, 255],
    ];
    const buffer = makeBuffer(pixels, 3, 1);
    const result = applyPaletteStrategy(buffer, settings({ mode: 'reduced', targetColors: 8 }));
    expect(result.originalVisibleColorCount).toBe(1);
    expect(result.palette).toEqual([{ r: 255, g: 0, b: 0 }]);
  });

  it('leaves fully transparent pixels exactly as-is, never mapped to a palette color', () => {
    const pixels: Pixel[] = [
      [255, 0, 0, 255],
      [77, 88, 99, 0],
    ];
    const buffer = makeBuffer(pixels, 2, 1);
    const result = applyPaletteStrategy(buffer, settings({ mode: 'reduced', targetColors: 8 }));
    expect(Array.from(result.buffer.data.slice(4, 8))).toEqual([77, 88, 99, 0]);
  });
});

describe('applyPaletteStrategy — partial alpha preservation', () => {
  it('quantizes the RGB of a partially transparent pixel while preserving its exact alpha byte', () => {
    // Four colors varying only in R: two close pairs (10,20) and (200,210).
    // With target=2, median-cut must split into exactly those two pairs, so
    // each pixel's R gets averaged with its pair partner — a hand-verifiable,
    // deterministic outcome rather than an approximate "changed somehow" check.
    const pixels: Pixel[] = [
      [10, 100, 100, 255],
      [20, 100, 100, 255],
      [200, 100, 100, 128], // the partially transparent pixel under test
      [210, 100, 100, 255],
    ];
    const buffer = makeBuffer(pixels, 4, 1);
    const result = applyPaletteStrategy(buffer, settings({ mode: 'reduced', targetColors: 2 }));

    // Pixel index 2 (the partial-alpha one): RGB averaged with its (200,210) pair partner -> r = 205.
    expect(Array.from(result.buffer.data.slice(8, 12))).toEqual([205, 100, 100, 128]);
  });
});

describe('applyPaletteStrategy — non-mutation', () => {
  it('never mutates the input buffer', () => {
    const buffer = makeBuffer(
      [
        [10, 20, 30, 255],
        [200, 100, 50, 255],
      ],
      2,
      1,
    );
    const originalCopy = Array.from(buffer.data);
    applyPaletteStrategy(buffer, settings({ mode: 'reduced', targetColors: 2 }));
    expect(Array.from(buffer.data)).toEqual(originalCopy);
  });
});

describe('applyPaletteStrategy — representative gradients and uneven populations', () => {
  it('produces stable, representative colors spanning a smooth gradient rather than arbitrary output', () => {
    const pixels: Pixel[] = [];
    for (let x = 0; x < 64; x++) {
      pixels.push([x * 4, 0, 255 - x * 4, 255]);
    }
    const buffer = makeBuffer(pixels, 64, 1);
    const result = applyPaletteStrategy(buffer, settings({ mode: 'reduced', targetColors: 4 }));
    expect(result.resultVisibleColorCount).toBeLessThanOrEqual(4);
    expect(result.resultVisibleColorCount).toBeGreaterThan(1);
    const reds = result.palette.map((c) => c.r).sort((a, b) => a - b);
    expect(reds[0]).toBeLessThan(100);
    expect(reds[reds.length - 1]).toBeGreaterThan(150);
  });

  it('gives a dominant color proportionally more representative influence for an unevenly populated image', () => {
    const pixels: Pixel[] = [
      ...Array.from({ length: 90 }, () => [10, 10, 10, 255] as Pixel), // dominant near-black
      ...Array.from({ length: 10 }, () => [250, 250, 250, 255] as Pixel), // rare near-white
    ];
    const buffer = makeBuffer(pixels, 100, 1);
    const result = applyPaletteStrategy(buffer, settings({ mode: 'reduced', targetColors: 2 }));
    expect(result.resultVisibleColorCount).toBe(2);
    const dark = result.palette.find((c) => c.r < 128);
    const light = result.palette.find((c) => c.r >= 128);
    expect(dark).toBeDefined();
    expect(light).toBeDefined();
  });
});

describe('applyPaletteStrategy — interaction with Transparent and Replace background modes', () => {
  it('excludes background pixels the Transparent background stage already zeroed out', () => {
    const W: Pixel = [255, 255, 255, 255];
    const B: Pixel = [0, 0, 0, 255];
    const buffer = makeBuffer([W, W, W, W, B, W, W, W, W], 3, 3);
    const bg: BackgroundSettings = {
      mode: 'transparent',
      sampledColor: { r: 255, g: 255, b: 255 },
      tolerance: 0,
      replaceColor: { r: 0, g: 0, b: 0 },
    };
    const afterBackground = applyBackgroundStrategy(buffer, bg);
    const result = applyPaletteStrategy(afterBackground, settings({ mode: 'reduced', targetColors: 8 }));
    expect(result.originalVisibleColorCount).toBe(1);
    expect(result.palette).toEqual([{ r: 0, g: 0, b: 0 }]);
  });

  it('counts flat-filled Replace background pixels like any other opaque color', () => {
    const W: Pixel = [255, 255, 255, 255];
    const B: Pixel = [0, 0, 0, 255];
    const buffer = makeBuffer([W, W, W, W, B, W, W, W, W], 3, 3);
    const bg: BackgroundSettings = {
      mode: 'replace',
      sampledColor: { r: 255, g: 255, b: 255 },
      tolerance: 0,
      replaceColor: { r: 10, g: 20, b: 30 },
    };
    const afterBackground = applyBackgroundStrategy(buffer, bg);
    const result = applyPaletteStrategy(afterBackground, settings({ mode: 'reduced', targetColors: 8 }));
    expect(result.originalVisibleColorCount).toBe(2); // replacement color + subject color
    const hasReplaceColor = result.palette.some((c) => c.r === 10 && c.g === 20 && c.b === 30);
    expect(hasReplaceColor).toBe(true);
  });
});
