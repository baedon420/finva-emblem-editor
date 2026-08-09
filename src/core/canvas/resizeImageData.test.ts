import { describe, expect, it } from 'vitest';
import type { PixelBuffer } from '../types';
import { resizeNearestNeighbor } from './resizeImageData';

function makeBuffer(pixels: number[][], width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  pixels.forEach(([r, g, b, a], index) => {
    data.set([r, g, b, a], index * 4);
  });
  return { data, width, height };
}

describe('resizeNearestNeighbor', () => {
  it('returns pixel-identical data when source and target sizes match', () => {
    const source = makeBuffer(
      [
        [255, 0, 0, 255],
        [0, 255, 0, 255],
        [0, 0, 255, 255],
        [255, 255, 0, 255],
      ],
      2,
      2,
    );
    const result = resizeNearestNeighbor(source, 2, 2);
    expect(Array.from(result.data)).toEqual(Array.from(source.data));
  });

  it('samples the correct single source pixel for each destination pixel (point sampling)', () => {
    // Encode each source pixel's row-major index into its red channel so the
    // exact sampled source pixel for every destination pixel is verifiable.
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = i;
      data[i * 4 + 3] = 255;
    }
    const source: PixelBuffer = { data, width, height };

    const result = resizeNearestNeighbor(source, 2, 2);
    const redAt = (x: number, y: number) => result.data[(y * 2 + x) * 4];

    expect(redAt(0, 0)).toBe(0); // src(0,0)
    expect(redAt(1, 0)).toBe(2); // src(2,0)
    expect(redAt(0, 1)).toBe(8); // src(0,2)
    expect(redAt(1, 1)).toBe(10); // src(2,2)
  });

  it('never blends or averages colors — only source colors appear in the output', () => {
    const red = [255, 0, 0, 255];
    const blue = [0, 0, 255, 255];
    const source = makeBuffer([red, blue, red, blue], 2, 2);

    const result = resizeNearestNeighbor(source, 5, 5);

    const allowed = new Set(['255,0,0,255', '0,0,255,255']);
    for (let i = 0; i < result.data.length; i += 4) {
      const color = `${result.data[i]},${result.data[i + 1]},${result.data[i + 2]},${result.data[i + 3]}`;
      expect(allowed.has(color)).toBe(true);
    }
  });

  it('clamps sampling to the last row/column when upscaling (no out-of-bounds reads)', () => {
    const source = makeBuffer(
      [
        [1, 1, 1, 255],
        [2, 2, 2, 255],
        [3, 3, 3, 255],
        [4, 4, 4, 255],
      ],
      2,
      2,
    );
    const result = resizeNearestNeighbor(source, 3, 3);
    expect(result.width).toBe(3);
    expect(result.height).toBe(3);
    expect(result.data.length).toBe(3 * 3 * 4);

    const validReds = new Set([1, 2, 3, 4]);
    for (let i = 0; i < result.data.length; i += 4) {
      expect(validReds.has(result.data[i])).toBe(true);
    }
  });

  it('downscales 256 to 64/41/32 producing exactly the requested dimensions', () => {
    const size = 256;
    const data = new Uint8ClampedArray(size * size * 4).fill(128);
    const source: PixelBuffer = { data, width: size, height: size };

    for (const target of [64, 41, 32]) {
      const result = resizeNearestNeighbor(source, target, target);
      expect(result.width).toBe(target);
      expect(result.height).toBe(target);
      expect(result.data.length).toBe(target * target * 4);
    }
  });
});
