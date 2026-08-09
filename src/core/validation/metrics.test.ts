import { describe, expect, it } from 'vitest';
import type { PixelBuffer } from '../types';
import { computeContrastSpread, computeTransitionRatio, computeVisiblePixelStats, luminance } from './metrics';

type Pixel = [number, number, number, number];

function makeBuffer(pixels: Pixel[], width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  pixels.forEach(([r, g, b, a], index) => {
    const p = index * 4;
    data[p] = r;
    data[p + 1] = g;
    data[p + 2] = b;
    data[p + 3] = a;
  });
  return { data, width, height };
}

describe('luminance', () => {
  it('weights green most heavily and blue least, per Rec. 709', () => {
    expect(luminance(255, 0, 0)).toBeCloseTo(54.213);
    expect(luminance(0, 255, 0)).toBeCloseTo(182.376);
    expect(luminance(0, 0, 255)).toBeCloseTo(18.411);
  });

  it('maps black to 0 and white to 255', () => {
    expect(luminance(0, 0, 0)).toBe(0);
    expect(luminance(255, 255, 255)).toBeCloseTo(255);
  });
});

describe('computeVisiblePixelStats', () => {
  it('ignores fully transparent pixels entirely', () => {
    const buffer = makeBuffer(
      [
        [255, 255, 255, 0],
        [255, 255, 255, 255],
      ],
      2,
      1,
    );
    const stats = computeVisiblePixelStats(buffer);
    expect(stats.visibleCount).toBe(1);
    expect(stats.bounds).toEqual({ minX: 1, minY: 0, maxX: 1, maxY: 0 });
  });

  it('counts partial-alpha pixels separately from fully opaque ones', () => {
    const buffer = makeBuffer(
      [
        [10, 10, 10, 128],
        [10, 10, 10, 255],
      ],
      2,
      1,
    );
    const stats = computeVisiblePixelStats(buffer);
    expect(stats.visibleCount).toBe(2);
    expect(stats.partialAlphaCount).toBe(1);
  });

  it('returns null bounds and centroid for a fully transparent buffer', () => {
    const buffer = makeBuffer([[0, 0, 0, 0]], 1, 1);
    const stats = computeVisiblePixelStats(buffer);
    expect(stats.visibleCount).toBe(0);
    expect(stats.bounds).toBeNull();
    expect(stats.centroid).toBeNull();
  });

  it('computes the centre of mass of visible pixels', () => {
    const buffer = makeBuffer(
      [
        [255, 255, 255, 255],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [255, 255, 255, 255],
      ],
      2,
      2,
    );
    const stats = computeVisiblePixelStats(buffer);
    expect(stats.centroid).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('computeContrastSpread', () => {
  it('returns 0 for a flat single-colour image', () => {
    const pixels: Pixel[] = Array.from({ length: 16 }, () => [128, 128, 128, 255]);
    expect(computeContrastSpread(makeBuffer(pixels, 4, 4))).toBe(0);
  });

  it('returns near 1 for a pure black-and-white split', () => {
    const pixels: Pixel[] = [
      ...Array.from({ length: 8 }, () => [0, 0, 0, 255] as Pixel),
      ...Array.from({ length: 8 }, () => [255, 255, 255, 255] as Pixel),
    ];
    expect(computeContrastSpread(makeBuffer(pixels, 4, 4))).toBeGreaterThan(0.9);
  });

  it('returns 0 when nothing is visible', () => {
    const pixels: Pixel[] = Array.from({ length: 4 }, () => [255, 255, 255, 0]);
    expect(computeContrastSpread(makeBuffer(pixels, 2, 2))).toBe(0);
  });

  it('ignores transparent pixels when measuring spread', () => {
    // Opaque pixels are all identical; the transparent one would otherwise widen the range.
    const pixels: Pixel[] = [
      [128, 128, 128, 255],
      [128, 128, 128, 255],
      [0, 0, 0, 0],
      [128, 128, 128, 255],
    ];
    expect(computeContrastSpread(makeBuffer(pixels, 2, 2))).toBe(0);
  });
});

describe('computeTransitionRatio', () => {
  it('returns 0 for a completely flat image', () => {
    const pixels: Pixel[] = Array.from({ length: 16 }, () => [100, 100, 100, 255]);
    expect(computeTransitionRatio(makeBuffer(pixels, 4, 4), 24)).toBe(0);
  });

  it('returns 1 for a per-pixel checkerboard, where every neighbour differs', () => {
    const pixels: Pixel[] = [];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const v = (x + y) % 2 === 0 ? 0 : 255;
        pixels.push([v, v, v, 255]);
      }
    }
    expect(computeTransitionRatio(makeBuffer(pixels, 4, 4), 24)).toBe(1);
  });

  it('counts a visibility change as a transition', () => {
    const pixels: Pixel[] = [
      [100, 100, 100, 255],
      [100, 100, 100, 0],
    ];
    expect(computeTransitionRatio(makeBuffer(pixels, 2, 1), 24)).toBe(1);
  });

  it('does not count differences below the luminance threshold', () => {
    const pixels: Pixel[] = [
      [100, 100, 100, 255],
      [105, 105, 105, 255],
    ];
    expect(computeTransitionRatio(makeBuffer(pixels, 2, 1), 24)).toBe(0);
  });

  it('treats two adjacent transparent pixels as no transition', () => {
    const pixels: Pixel[] = [
      [10, 20, 30, 0],
      [200, 100, 50, 0],
    ];
    expect(computeTransitionRatio(makeBuffer(pixels, 2, 1), 24)).toBe(0);
  });
});
