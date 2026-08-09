import { describe, expect, it } from 'vitest';
import type { PixelBuffer } from '../../core/types';
import { createEmptyBounds, getPixel, isEmptyBounds } from './drawing';
import { createPatch } from './history';
import { floodFill, replaceColorExact } from './fillReplace';

const RED = { r: 255, g: 0, b: 0 };
const GREEN = { r: 0, g: 255, b: 0 };
const BLUE = { r: 0, g: 0, b: 255 };

function makeBuffer(width: number, height: number, fill: [number, number, number, number]): PixelBuffer {
  const data = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  for (let i = 0; i < width * height; i++) {
    data.set(fill, i * 4);
  }
  return { data, width, height };
}

function setPixel(buffer: PixelBuffer, x: number, y: number, rgba: [number, number, number, number]): void {
  buffer.data.set(rgba, (y * buffer.width + x) * 4);
}

describe('floodFill — region matching', () => {
  it('fills the whole buffer when every pixel matches the seed', () => {
    const buffer = makeBuffer(4, 4, [10, 20, 30, 255]);
    const changed = floodFill(buffer, 1, 1, RED);
    expect(changed).toBe(16);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        expect(getPixel(buffer, x, y)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
      }
    }
  });

  it('stops at pixels whose RGBA differs from the seed', () => {
    const buffer = makeBuffer(3, 1, [10, 20, 30, 255]);
    setPixel(buffer, 1, 0, [10, 20, 30, 254]); // alpha differs by 1 — exact RGBA must reject it
    const changed = floodFill(buffer, 0, 0, RED);
    expect(changed).toBe(1);
    expect(getPixel(buffer, 1, 0)).toEqual({ r: 10, g: 20, b: 30, a: 254 });
    expect(getPixel(buffer, 2, 0)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
  });

  it('is 4-connected: never leaks across a diagonal gap', () => {
    // Checkerboard: seed colour on (0,0) and (1,1); other colour on (0,1) and (1,0).
    const buffer = makeBuffer(2, 2, [0, 0, 0, 255]);
    setPixel(buffer, 1, 0, [9, 9, 9, 255]);
    setPixel(buffer, 0, 1, [9, 9, 9, 255]);
    const changed = floodFill(buffer, 0, 0, RED);
    expect(changed).toBe(1);
    expect(getPixel(buffer, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });

  it('is blocked by a one-pixel wall between two same-colour regions', () => {
    const buffer = makeBuffer(5, 5, [0, 0, 0, 255]);
    for (let y = 0; y < 5; y++) {
      setPixel(buffer, 2, y, [9, 9, 9, 255]);
    }
    const changed = floodFill(buffer, 0, 2, RED);
    expect(changed).toBe(10); // left 2×5 region only
    expect(getPixel(buffer, 3, 2)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    expect(getPixel(buffer, 4, 2)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });

  it('treats all fully transparent pixels as one region regardless of hidden RGB', () => {
    const buffer = makeBuffer(3, 1, [0, 0, 0, 0]);
    setPixel(buffer, 1, 0, [77, 88, 99, 0]); // invisible RGB noise under alpha 0
    const changed = floodFill(buffer, 0, 0, GREEN);
    expect(changed).toBe(3);
    expect(getPixel(buffer, 1, 0)).toEqual({ r: 0, g: 255, b: 0, a: 255 });
  });

  it('a partially transparent seed matches exact RGBA only', () => {
    const buffer = makeBuffer(3, 1, [10, 20, 30, 128]);
    setPixel(buffer, 2, 0, [10, 20, 30, 255]);
    const changed = floodFill(buffer, 0, 0, RED);
    expect(changed).toBe(2);
    expect(getPixel(buffer, 0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(getPixel(buffer, 2, 0)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
  });
});

describe('floodFill — no-ops and bounds', () => {
  it('returns 0 and leaves bounds empty when the seed already equals the fill colour', () => {
    const buffer = makeBuffer(4, 4, [255, 0, 0, 255]);
    const snapshot = Array.from(buffer.data);
    const bounds = createEmptyBounds();
    expect(floodFill(buffer, 2, 2, RED, bounds)).toBe(0);
    expect(Array.from(buffer.data)).toEqual(snapshot);
    expect(isEmptyBounds(bounds)).toBe(true);
  });

  it('a no-op fill produces no history patch', () => {
    const buffer = makeBuffer(4, 4, [255, 0, 0, 255]);
    const before = makeBuffer(4, 4, [255, 0, 0, 255]);
    const bounds = createEmptyBounds();
    floodFill(buffer, 0, 0, RED, bounds);
    expect(createPatch(before, buffer, bounds)).toBeNull();
  });

  it('returns 0 for out-of-bounds seeds', () => {
    const buffer = makeBuffer(4, 4, [10, 20, 30, 255]);
    expect(floodFill(buffer, -1, 0, RED)).toBe(0);
    expect(floodFill(buffer, 0, -1, RED)).toBe(0);
    expect(floodFill(buffer, 4, 0, RED)).toBe(0);
    expect(floodFill(buffer, 0, 4, RED)).toBe(0);
  });

  it('does fill when only alpha differs from the fill result', () => {
    // Same RGB as the fill colour but semi-transparent: a fill must still opaque it.
    const buffer = makeBuffer(2, 1, [255, 0, 0, 128]);
    expect(floodFill(buffer, 0, 0, RED)).toBe(2);
    expect(getPixel(buffer, 1, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  it('tracks the exact bounding rectangle of changed pixels', () => {
    const buffer = makeBuffer(8, 8, [0, 0, 0, 255]);
    // Carve a 3×2 island of a distinct colour at (2,3)-(4,4).
    for (let y = 3; y <= 4; y++) {
      for (let x = 2; x <= 4; x++) {
        setPixel(buffer, x, y, [50, 60, 70, 255]);
      }
    }
    const bounds = createEmptyBounds();
    expect(floodFill(buffer, 3, 3, BLUE, bounds)).toBe(6);
    expect(bounds).toEqual({ minX: 2, minY: 3, maxX: 4, maxY: 4 });
  });

  it('handles a full 256×256 fill without recursion (stack safety)', () => {
    const buffer = makeBuffer(256, 256, [1, 2, 3, 255]);
    expect(floodFill(buffer, 128, 128, RED)).toBe(256 * 256);
    expect(getPixel(buffer, 0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(getPixel(buffer, 255, 255)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  it('fill + undo patch restores the original buffer exactly', () => {
    const buffer = makeBuffer(6, 6, [10, 20, 30, 255]);
    setPixel(buffer, 3, 3, [1, 1, 1, 255]);
    const snapshot = Array.from(buffer.data);
    const before = { data: new Uint8ClampedArray(buffer.data), width: 6, height: 6 } as PixelBuffer;
    const bounds = createEmptyBounds();
    floodFill(buffer, 0, 0, RED, bounds);
    const patch = createPatch(before, buffer, bounds);
    expect(patch).not.toBeNull();
    // Applying `before` over the patch rectangle must restore the snapshot.
    for (let row = 0; row < (patch as NonNullable<typeof patch>).height; row++) {
      const p = patch as NonNullable<typeof patch>;
      buffer.data.set(p.before.subarray(row * p.width * 4, (row + 1) * p.width * 4), ((p.y + row) * 6 + p.x) * 4);
    }
    expect(Array.from(buffer.data)).toEqual(snapshot);
  });
});

describe('replaceColorExact', () => {
  it('replaces every exact-RGBA match and reports the count', () => {
    const buffer = makeBuffer(4, 1, [10, 20, 30, 255]);
    setPixel(buffer, 1, 0, [99, 99, 99, 255]);
    const changed = replaceColorExact(buffer, { r: 10, g: 20, b: 30, a: 255 }, BLUE);
    expect(changed).toBe(3);
    expect(getPixel(buffer, 0, 0)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
    expect(getPixel(buffer, 1, 0)).toEqual({ r: 99, g: 99, b: 99, a: 255 });
    expect(getPixel(buffer, 3, 0)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
  });

  it('replaces disconnected occurrences globally, unlike fill', () => {
    const buffer = makeBuffer(5, 1, [0, 0, 0, 255]);
    setPixel(buffer, 0, 0, [7, 7, 7, 255]);
    setPixel(buffer, 4, 0, [7, 7, 7, 255]); // separated by a wall of black
    const changed = replaceColorExact(buffer, { r: 7, g: 7, b: 7, a: 255 }, RED);
    expect(changed).toBe(2);
    expect(getPixel(buffer, 0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(getPixel(buffer, 4, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  it('never matches pixels whose alpha differs from the source alpha', () => {
    const buffer = makeBuffer(3, 1, [10, 20, 30, 255]);
    setPixel(buffer, 1, 0, [10, 20, 30, 128]);
    setPixel(buffer, 2, 0, [10, 20, 30, 0]);
    const changed = replaceColorExact(buffer, { r: 10, g: 20, b: 30, a: 255 }, RED);
    expect(changed).toBe(1);
    expect(getPixel(buffer, 1, 0)).toEqual({ r: 10, g: 20, b: 30, a: 128 });
    expect(getPixel(buffer, 2, 0)).toEqual({ r: 10, g: 20, b: 30, a: 0 });
  });

  it('returns 0 and leaves bounds empty when nothing matches', () => {
    const buffer = makeBuffer(4, 4, [10, 20, 30, 255]);
    const snapshot = Array.from(buffer.data);
    const bounds = createEmptyBounds();
    expect(replaceColorExact(buffer, { r: 1, g: 2, b: 3, a: 255 }, RED, bounds)).toBe(0);
    expect(Array.from(buffer.data)).toEqual(snapshot);
    expect(isEmptyBounds(bounds)).toBe(true);
  });

  it('returns 0 when source and target are the same opaque colour', () => {
    const buffer = makeBuffer(4, 4, [255, 0, 0, 255]);
    const snapshot = Array.from(buffer.data);
    expect(replaceColorExact(buffer, { r: 255, g: 0, b: 0, a: 255 }, RED)).toBe(0);
    expect(Array.from(buffer.data)).toEqual(snapshot);
  });

  it('a no-op replace produces no history patch', () => {
    const buffer = makeBuffer(4, 4, [10, 20, 30, 255]);
    const before = makeBuffer(4, 4, [10, 20, 30, 255]);
    const bounds = createEmptyBounds();
    replaceColorExact(buffer, { r: 1, g: 2, b: 3, a: 255 }, RED, bounds);
    expect(createPatch(before, buffer, bounds)).toBeNull();
  });

  it('tracks bounds spanning only the matched pixels', () => {
    const buffer = makeBuffer(8, 8, [0, 0, 0, 255]);
    setPixel(buffer, 1, 2, [7, 7, 7, 255]);
    setPixel(buffer, 6, 5, [7, 7, 7, 255]);
    const bounds = createEmptyBounds();
    replaceColorExact(buffer, { r: 7, g: 7, b: 7, a: 255 }, RED, bounds);
    expect(bounds).toEqual({ minX: 1, minY: 2, maxX: 6, maxY: 5 });
  });
});
