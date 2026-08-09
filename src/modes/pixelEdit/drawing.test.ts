import { describe, expect, it } from 'vitest';
import type { PixelBuffer } from '../../core/types';
import { cloneBuffer, createEmptyBounds, getPixel, isEmptyBounds, paintBrush, paintLine } from './drawing';

function makeBuffer(width: number, height: number, fill: [number, number, number, number] = [0, 0, 0, 0]): PixelBuffer {
  const data = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  for (let i = 0; i < width * height; i++) {
    data.set(fill, i * 4);
  }
  return { data, width, height };
}

const RED = { r: 255, g: 0, b: 0 };

describe('cloneBuffer', () => {
  it('produces an independent copy that does not share memory with the source', () => {
    const source = makeBuffer(4, 4, [10, 20, 30, 255]);
    const copy = cloneBuffer(source);
    expect(Array.from(copy.data)).toEqual(Array.from(source.data));

    paintBrush(copy, 0, 0, 1, RED);
    expect(getPixel(copy, 0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(getPixel(source, 0, 0)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
  });

  it('does not share the underlying ArrayBuffer', () => {
    const source = makeBuffer(2, 2);
    const copy = cloneBuffer(source);
    expect(copy.data.buffer).not.toBe(source.data.buffer);
  });
});

describe('paintBrush — pen placement', () => {
  it('paints exactly one pixel at size 1', () => {
    const buffer = makeBuffer(4, 4);
    paintBrush(buffer, 2, 1, 1, RED);
    expect(getPixel(buffer, 2, 1)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(getPixel(buffer, 1, 1)?.a).toBe(0);
    expect(getPixel(buffer, 2, 0)?.a).toBe(0);
  });

  it('paints a centred square at larger sizes', () => {
    const buffer = makeBuffer(8, 8);
    paintBrush(buffer, 4, 4, 3, RED);
    for (let y = 3; y <= 5; y++) {
      for (let x = 3; x <= 5; x++) {
        expect(getPixel(buffer, x, y)?.a).toBe(255);
      }
    }
    expect(getPixel(buffer, 2, 4)?.a).toBe(0);
    expect(getPixel(buffer, 6, 4)?.a).toBe(0);
  });

  it('sets full opacity when painting a colour', () => {
    const buffer = makeBuffer(2, 2);
    paintBrush(buffer, 0, 0, 1, RED);
    expect(getPixel(buffer, 0, 0)?.a).toBe(255);
  });
});

describe('paintBrush — eraser semantics', () => {
  it('sets erased pixels to fully transparent rather than opaque white', () => {
    const buffer = makeBuffer(4, 4, [255, 255, 255, 255]);
    paintBrush(buffer, 1, 1, 1, null);
    expect(getPixel(buffer, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('leaves neighbouring pixels untouched', () => {
    const buffer = makeBuffer(4, 4, [255, 255, 255, 255]);
    paintBrush(buffer, 1, 1, 1, null);
    expect(getPixel(buffer, 2, 1)?.a).toBe(255);
  });
});

describe('paintBrush — bounds at canvas edges', () => {
  it('clips a large brush at the top-left corner without wrapping', () => {
    const buffer = makeBuffer(4, 4);
    paintBrush(buffer, 0, 0, 4, RED);
    expect(getPixel(buffer, 0, 0)?.a).toBe(255);
    // The opposite corner must stay untouched — proof nothing wrapped around.
    expect(getPixel(buffer, 3, 3)?.a).toBe(0);
  });

  it('clips at the bottom-right corner without overflowing the buffer', () => {
    const buffer = makeBuffer(4, 4);
    expect(() => paintBrush(buffer, 3, 3, 6, RED)).not.toThrow();
    expect(getPixel(buffer, 3, 3)?.a).toBe(255);
    expect(buffer.data.length).toBe(4 * 4 * 4);
  });

  it('painting entirely outside the canvas changes nothing', () => {
    const buffer = makeBuffer(4, 4);
    const before = Array.from(buffer.data);
    paintBrush(buffer, 50, 50, 2, RED);
    expect(Array.from(buffer.data)).toEqual(before);
  });
});

describe('paintLine — continuous strokes without gaps', () => {
  it('fills every pixel along a horizontal run', () => {
    const buffer = makeBuffer(16, 4);
    paintLine(buffer, 1, 2, 12, 2, 1, RED);
    for (let x = 1; x <= 12; x++) {
      expect(getPixel(buffer, x, 2)?.a).toBe(255);
    }
  });

  it('leaves no gaps along a steep diagonal between distant pointer samples', () => {
    const buffer = makeBuffer(32, 32);
    paintLine(buffer, 0, 0, 31, 20, 1, RED);
    // Every row the line passes through must contain at least one painted pixel.
    for (let y = 0; y <= 20; y++) {
      const painted = Array.from({ length: 32 }, (_, x) => getPixel(buffer, x, y)?.a).some((a) => a === 255);
      expect(painted).toBe(true);
    }
  });

  it('paints a single stamp when start and end are the same point', () => {
    const buffer = makeBuffer(4, 4);
    paintLine(buffer, 2, 2, 2, 2, 1, RED);
    expect(getPixel(buffer, 2, 2)?.a).toBe(255);
  });

  it('erases continuously when colour is null', () => {
    const buffer = makeBuffer(16, 4, [255, 255, 255, 255]);
    paintLine(buffer, 0, 1, 15, 1, 1, null);
    for (let x = 0; x <= 15; x++) {
      expect(getPixel(buffer, x, 1)?.a).toBe(0);
    }
  });
});

describe('bounds tracking', () => {
  it('reports an empty bounds object as empty', () => {
    expect(isEmptyBounds(createEmptyBounds())).toBe(true);
  });

  it('accumulates the exact rectangle a stroke touched', () => {
    const buffer = makeBuffer(16, 16);
    const bounds = createEmptyBounds();
    paintLine(buffer, 2, 3, 6, 3, 1, RED, bounds);
    expect(bounds).toEqual({ minX: 2, minY: 3, maxX: 6, maxY: 3 });
  });

  it('clips accumulated bounds to painted pixels only, never past the canvas edge', () => {
    const buffer = makeBuffer(8, 8);
    const bounds = createEmptyBounds();
    paintBrush(buffer, 0, 0, 4, RED, bounds);
    expect(bounds.minX).toBe(0);
    expect(bounds.minY).toBe(0);
  });
});

describe('getPixel — eyedropper sampling', () => {
  it('samples the colour and alpha at a coordinate', () => {
    const buffer = makeBuffer(4, 4);
    paintBrush(buffer, 2, 2, 1, { r: 12, g: 34, b: 56 });
    expect(getPixel(buffer, 2, 2)).toEqual({ r: 12, g: 34, b: 56, a: 255 });
  });

  it('returns null outside the buffer', () => {
    const buffer = makeBuffer(4, 4);
    expect(getPixel(buffer, -1, 0)).toBeNull();
    expect(getPixel(buffer, 4, 0)).toBeNull();
    expect(getPixel(buffer, 0, 4)).toBeNull();
  });

  it('reports transparent pixels as alpha 0', () => {
    const buffer = makeBuffer(4, 4);
    expect(getPixel(buffer, 0, 0)?.a).toBe(0);
  });
});
