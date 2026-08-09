import { describe, expect, it } from 'vitest';
import type { PixelBuffer } from '../../core/types';
import { EDITED_PALETTE_MAX_SWATCHES, analyzeEditedPalette } from './editedPalette';

function makeBuffer(pixels: Array<[number, number, number, number]>): PixelBuffer {
  const data = new Uint8ClampedArray(new ArrayBuffer(pixels.length * 4));
  pixels.forEach((rgba, i) => data.set(rgba, i * 4));
  return { data, width: pixels.length, height: 1 };
}

describe('analyzeEditedPalette', () => {
  it('counts distinct visible colors with per-color frequencies', () => {
    const analysis = analyzeEditedPalette(
      makeBuffer([
        [255, 0, 0, 255],
        [255, 0, 0, 255],
        [0, 255, 0, 255],
      ]),
    );
    expect(analysis.totalDistinct).toBe(2);
    expect(analysis.entries).toEqual([
      { r: 255, g: 0, b: 0, count: 2 },
      { r: 0, g: 255, b: 0, count: 1 },
    ]);
  });

  it('excludes fully transparent pixels regardless of their RGB bytes', () => {
    const analysis = analyzeEditedPalette(
      makeBuffer([
        [255, 0, 0, 255],
        [99, 88, 77, 0], // invisible — must not appear
        [0, 0, 0, 0],
      ]),
    );
    expect(analysis.totalDistinct).toBe(1);
    expect(analysis.entries).toEqual([{ r: 255, g: 0, b: 0, count: 1 }]);
  });

  it('includes partially transparent pixels, deduplicated by RGB', () => {
    const analysis = analyzeEditedPalette(
      makeBuffer([
        [10, 20, 30, 255],
        [10, 20, 30, 128], // same RGB, different alpha — one swatch
      ]),
    );
    expect(analysis.totalDistinct).toBe(1);
    expect(analysis.entries[0].count).toBe(2);
  });

  it('sorts by frequency descending with a deterministic RGB tiebreak', () => {
    const analysis = analyzeEditedPalette(
      makeBuffer([
        [5, 5, 5, 255],
        [200, 0, 0, 255],
        [0, 0, 200, 255],
        [5, 5, 5, 255],
        [0, 200, 0, 255],
      ]),
    );
    expect(analysis.entries).toEqual([
      { r: 5, g: 5, b: 5, count: 2 },
      { r: 0, g: 0, b: 200, count: 1 },
      { r: 0, g: 200, b: 0, count: 1 },
      { r: 200, g: 0, b: 0, count: 1 },
    ]);
  });

  it('is deterministic regardless of pixel order', () => {
    const forward = analyzeEditedPalette(
      makeBuffer([
        [1, 1, 1, 255],
        [2, 2, 2, 255],
        [3, 3, 3, 255],
      ]),
    );
    const reversed = analyzeEditedPalette(
      makeBuffer([
        [3, 3, 3, 255],
        [2, 2, 2, 255],
        [1, 1, 1, 255],
      ]),
    );
    expect(forward).toEqual(reversed);
  });

  it('caps entries at the swatch limit while reporting the full distinct count', () => {
    const pixels: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 100; i++) {
      pixels.push([i, 0, 0, 255]);
      if (i < 10) {
        pixels.push([i, 0, 0, 255]); // first ten colors are twice as frequent
      }
    }
    const analysis = analyzeEditedPalette(makeBuffer(pixels));
    expect(analysis.totalDistinct).toBe(100);
    expect(analysis.entries).toHaveLength(EDITED_PALETTE_MAX_SWATCHES);
    // The most frequent colors survive the cap.
    for (let i = 0; i < 10; i++) {
      expect(analysis.entries[i]).toEqual({ r: i, g: 0, b: 0, count: 2 });
    }
  });

  it('returns an empty analysis for a fully transparent buffer', () => {
    const analysis = analyzeEditedPalette(makeBuffer([[0, 0, 0, 0], [50, 50, 50, 0]]));
    expect(analysis.totalDistinct).toBe(0);
    expect(analysis.entries).toEqual([]);
  });
});
