import { describe, expect, it } from 'vitest';
import { clampToBuffer, displayToBufferPoint } from './coordinates';

const SIZE = 256;

/** Display rect for the 256px canvas shown at a given zoom, offset on the page. */
function rectAtZoom(zoom: number, left = 0, top = 0) {
  return { left, top, width: SIZE * zoom, height: SIZE * zoom };
}

describe('displayToBufferPoint — coordinate conversion at multiple zoom levels', () => {
  it('maps 1:1 at zoom 1', () => {
    expect(displayToBufferPoint(10, 20, rectAtZoom(1), SIZE, SIZE)).toEqual({ x: 10, y: 20 });
  });

  it('halves display coordinates at zoom 2', () => {
    expect(displayToBufferPoint(10, 20, rectAtZoom(2), SIZE, SIZE)).toEqual({ x: 5, y: 10 });
  });

  it('maps correctly at zoom 8', () => {
    expect(displayToBufferPoint(80, 160, rectAtZoom(8), SIZE, SIZE)).toEqual({ x: 10, y: 20 });
  });

  it('maps correctly at zoom 16', () => {
    expect(displayToBufferPoint(160, 32, rectAtZoom(16), SIZE, SIZE)).toEqual({ x: 10, y: 2 });
  });

  it('accounts for the element offset on the page', () => {
    expect(displayToBufferPoint(110, 220, rectAtZoom(1, 100, 200), SIZE, SIZE)).toEqual({ x: 10, y: 20 });
  });

  it('accounts for offset and zoom together', () => {
    expect(displayToBufferPoint(100 + 80, 200 + 160, rectAtZoom(8, 100, 200), SIZE, SIZE)).toEqual({
      x: 10,
      y: 20,
    });
  });

  it('resolves every display pixel within one zoomed buffer pixel to the same buffer coordinate', () => {
    const rect = rectAtZoom(4);
    for (let offset = 0; offset < 4; offset++) {
      expect(displayToBufferPoint(40 + offset, 0, rect, SIZE, SIZE)).toEqual({ x: 10, y: 0 });
    }
    expect(displayToBufferPoint(44, 0, rect, SIZE, SIZE)).toEqual({ x: 11, y: 0 });
  });

  it('returns null outside the canvas on every side', () => {
    const rect = rectAtZoom(2, 50, 50);
    expect(displayToBufferPoint(49, 60, rect, SIZE, SIZE)).toBeNull();
    expect(displayToBufferPoint(60, 49, rect, SIZE, SIZE)).toBeNull();
    expect(displayToBufferPoint(50 + SIZE * 2, 60, rect, SIZE, SIZE)).toBeNull();
    expect(displayToBufferPoint(60, 50 + SIZE * 2, rect, SIZE, SIZE)).toBeNull();
  });

  it('returns null for a zero-sized rect rather than dividing by zero', () => {
    expect(displayToBufferPoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }, SIZE, SIZE)).toBeNull();
  });

  it('maps the last display pixel to the last buffer pixel', () => {
    const rect = rectAtZoom(2);
    expect(displayToBufferPoint(SIZE * 2 - 1, SIZE * 2 - 1, rect, SIZE, SIZE)).toEqual({
      x: SIZE - 1,
      y: SIZE - 1,
    });
  });
});

describe('clampToBuffer — dragging past an edge', () => {
  it('clamps coordinates left/above the canvas to 0', () => {
    expect(clampToBuffer(-500, -500, rectAtZoom(4), SIZE, SIZE)).toEqual({ x: 0, y: 0 });
  });

  it('clamps coordinates right/below the canvas to the last pixel', () => {
    expect(clampToBuffer(99999, 99999, rectAtZoom(4), SIZE, SIZE)).toEqual({ x: SIZE - 1, y: SIZE - 1 });
  });

  it('agrees with displayToBufferPoint for in-bounds coordinates', () => {
    const rect = rectAtZoom(8, 30, 40);
    expect(clampToBuffer(30 + 80, 40 + 160, rect, SIZE, SIZE)).toEqual(
      displayToBufferPoint(30 + 80, 40 + 160, rect, SIZE, SIZE),
    );
  });
});
