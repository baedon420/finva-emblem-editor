import { describe, expect, it } from 'vitest';
import type { PixelBuffer } from '../../core/types';
import { cloneBuffer, createEmptyBounds, getPixel, paintBrush, paintLine } from './drawing';
import {
  MAX_HISTORY_OPERATIONS,
  canRedo,
  canUndo,
  createHistory,
  createPatch,
  recordPatch,
  redo,
  undo,
} from './history';

function makeBuffer(width = 16, height = 16): PixelBuffer {
  return { data: new Uint8ClampedArray(new ArrayBuffer(width * height * 4)), width, height };
}

const RED = { r: 255, g: 0, b: 0 };
const BLUE = { r: 0, g: 0, b: 255 };

/** Simulates one complete drag stroke: snapshot, draw, diff, record. */
function applyStroke(
  buffer: PixelBuffer,
  history: ReturnType<typeof createHistory>,
  draw: (target: PixelBuffer, bounds: ReturnType<typeof createEmptyBounds>) => void,
): void {
  const before = cloneBuffer(buffer);
  const bounds = createEmptyBounds();
  draw(buffer, bounds);
  const patch = createPatch(before, buffer, bounds);
  if (patch) {
    recordPatch(history, patch);
  }
}

describe('history — atomic stroke undo', () => {
  it('undoes an entire multi-segment drag stroke in a single action', () => {
    const buffer = makeBuffer();
    const history = createHistory();

    applyStroke(buffer, history, (target, bounds) => {
      // Several segments, as a real drag would produce across pointer events.
      paintLine(target, 1, 1, 5, 1, 1, RED, bounds);
      paintLine(target, 5, 1, 9, 1, 1, RED, bounds);
      paintLine(target, 9, 1, 12, 1, 1, RED, bounds);
    });

    expect(getPixel(buffer, 12, 1)?.a).toBe(255);
    expect(history.patches).toHaveLength(1);

    expect(undo(history, buffer)).toBe(true);
    for (let x = 1; x <= 12; x++) {
      expect(getPixel(buffer, x, 1)?.a).toBe(0);
    }
  });

  it('restores the exact previous pixel values, not just transparency', () => {
    const buffer = makeBuffer();
    const history = createHistory();
    paintBrush(buffer, 4, 4, 1, BLUE);

    applyStroke(buffer, history, (target, bounds) => paintBrush(target, 4, 4, 1, RED, bounds));
    expect(getPixel(buffer, 4, 4)).toEqual({ r: 255, g: 0, b: 0, a: 255 });

    undo(history, buffer);
    expect(getPixel(buffer, 4, 4)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
  });

  it('undoes multiple strokes one at a time, in reverse order', () => {
    const buffer = makeBuffer();
    const history = createHistory();
    applyStroke(buffer, history, (t, b) => paintBrush(t, 1, 1, 1, RED, b));
    applyStroke(buffer, history, (t, b) => paintBrush(t, 2, 2, 1, RED, b));

    undo(history, buffer);
    expect(getPixel(buffer, 2, 2)?.a).toBe(0);
    expect(getPixel(buffer, 1, 1)?.a).toBe(255);

    undo(history, buffer);
    expect(getPixel(buffer, 1, 1)?.a).toBe(0);
  });

  it('reports canUndo correctly and refuses to undo past the beginning', () => {
    const buffer = makeBuffer();
    const history = createHistory();
    expect(canUndo(history)).toBe(false);
    expect(undo(history, buffer)).toBe(false);

    applyStroke(buffer, history, (t, b) => paintBrush(t, 1, 1, 1, RED, b));
    expect(canUndo(history)).toBe(true);
    undo(history, buffer);
    expect(canUndo(history)).toBe(false);
  });

  it('does not consume a history slot for a stroke that painted nothing', () => {
    const buffer = makeBuffer();
    const history = createHistory();
    applyStroke(buffer, history, (t, b) => paintBrush(t, 500, 500, 1, RED, b));
    expect(history.patches).toHaveLength(0);
  });
});

describe('history — redo', () => {
  it('reapplies an undone stroke', () => {
    const buffer = makeBuffer();
    const history = createHistory();
    applyStroke(buffer, history, (t, b) => paintBrush(t, 3, 3, 1, RED, b));

    undo(history, buffer);
    expect(getPixel(buffer, 3, 3)?.a).toBe(0);

    expect(redo(history, buffer)).toBe(true);
    expect(getPixel(buffer, 3, 3)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  it('reports canRedo correctly and refuses to redo past the end', () => {
    const buffer = makeBuffer();
    const history = createHistory();
    applyStroke(buffer, history, (t, b) => paintBrush(t, 3, 3, 1, RED, b));
    expect(canRedo(history)).toBe(false);

    undo(history, buffer);
    expect(canRedo(history)).toBe(true);

    redo(history, buffer);
    expect(canRedo(history)).toBe(false);
    expect(redo(history, buffer)).toBe(false);
  });

  it('supports undoing and redoing several steps back and forth', () => {
    const buffer = makeBuffer();
    const history = createHistory();
    applyStroke(buffer, history, (t, b) => paintBrush(t, 1, 1, 1, RED, b));
    applyStroke(buffer, history, (t, b) => paintBrush(t, 2, 2, 1, RED, b));
    applyStroke(buffer, history, (t, b) => paintBrush(t, 3, 3, 1, RED, b));

    undo(history, buffer);
    undo(history, buffer);
    expect(getPixel(buffer, 1, 1)?.a).toBe(255);
    expect(getPixel(buffer, 2, 2)?.a).toBe(0);

    redo(history, buffer);
    expect(getPixel(buffer, 2, 2)?.a).toBe(255);
    expect(getPixel(buffer, 3, 3)?.a).toBe(0);
  });
});

describe('history — redo clears after a new edit', () => {
  it('drops redo entries once a new stroke is recorded after an undo', () => {
    const buffer = makeBuffer();
    const history = createHistory();
    applyStroke(buffer, history, (t, b) => paintBrush(t, 1, 1, 1, RED, b));
    applyStroke(buffer, history, (t, b) => paintBrush(t, 2, 2, 1, RED, b));

    undo(history, buffer);
    expect(canRedo(history)).toBe(true);

    applyStroke(buffer, history, (t, b) => paintBrush(t, 5, 5, 1, BLUE, b));

    expect(canRedo(history)).toBe(false);
    expect(history.patches).toHaveLength(2);
  });

  it('does not resurrect the discarded branch on a later undo', () => {
    const buffer = makeBuffer();
    const history = createHistory();
    applyStroke(buffer, history, (t, b) => paintBrush(t, 2, 2, 1, RED, b));
    undo(history, buffer);
    applyStroke(buffer, history, (t, b) => paintBrush(t, 5, 5, 1, BLUE, b));

    undo(history, buffer);
    expect(getPixel(buffer, 5, 5)?.a).toBe(0);
    expect(getPixel(buffer, 2, 2)?.a).toBe(0);
  });
});

describe('history — bounded memory', () => {
  it('never retains more than the configured limit', () => {
    const buffer = makeBuffer();
    const history = createHistory(5);
    for (let i = 0; i < 20; i++) {
      applyStroke(buffer, history, (t, b) => paintBrush(t, i % 16, 0, 1, RED, b));
    }
    expect(history.patches).toHaveLength(5);
    expect(history.index).toBe(5);
  });

  it('evicts the oldest operations first, keeping recent undos working', () => {
    const buffer = makeBuffer();
    const history = createHistory(3);
    for (let i = 0; i < 6; i++) {
      applyStroke(buffer, history, (t, b) => paintBrush(t, i, 0, 1, RED, b));
    }
    // The three most recent strokes remain undoable.
    expect(undo(history, buffer)).toBe(true);
    expect(getPixel(buffer, 5, 0)?.a).toBe(0);
    expect(undo(history, buffer)).toBe(true);
    expect(undo(history, buffer)).toBe(true);
    expect(undo(history, buffer)).toBe(false);
    // The evicted early strokes stay painted — they are beyond the horizon.
    expect(getPixel(buffer, 0, 0)?.a).toBe(255);
  });

  it('defaults to the documented operation limit', () => {
    expect(createHistory().limit).toBe(MAX_HISTORY_OPERATIONS);
    expect(MAX_HISTORY_OPERATIONS).toBeGreaterThanOrEqual(50);
    expect(MAX_HISTORY_OPERATIONS).toBeLessThanOrEqual(100);
  });
});

describe('createPatch', () => {
  it('returns null when nothing was touched', () => {
    const buffer = makeBuffer();
    expect(createPatch(buffer, buffer, createEmptyBounds())).toBeNull();
  });

  it('stores only the touched rectangle, not the whole canvas', () => {
    const buffer = makeBuffer(64, 64);
    const before = cloneBuffer(buffer);
    const bounds = createEmptyBounds();
    paintBrush(buffer, 10, 10, 1, RED, bounds);

    const patch = createPatch(before, buffer, bounds);
    expect(patch).not.toBeNull();
    expect(patch?.width).toBe(1);
    expect(patch?.height).toBe(1);
    expect(patch?.before.length).toBe(4);
  });
});
