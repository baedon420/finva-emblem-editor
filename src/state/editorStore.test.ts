import { beforeEach, describe, expect, it } from 'vitest';
import type { PixelBuffer } from '../core/types';
import { cloneBuffer, createEmptyBounds, getPixel, paintBrush } from '../modes/pixelEdit/drawing';
import { floodFill } from '../modes/pixelEdit/fillReplace';
import { createPatch } from '../modes/pixelEdit/history';
import { useEditorStore } from './editorStore';

const RED = { r: 255, g: 0, b: 0 };

function makeOptimizedBuffer(fill: [number, number, number, number] = [10, 20, 30, 255]): PixelBuffer {
  const size = 8;
  const data = new Uint8ClampedArray(new ArrayBuffer(size * size * 4));
  for (let i = 0; i < size * size; i++) {
    data.set(fill, i * 4);
  }
  return { data, width: size, height: size };
}

/** Applies one stroke to the store's editable buffer exactly as the canvas does. */
function strokeOnStore(draw: (target: PixelBuffer, bounds: ReturnType<typeof createEmptyBounds>) => void): void {
  const buffer = useEditorStore.getState().buffer as PixelBuffer;
  const before = cloneBuffer(buffer);
  const bounds = createEmptyBounds();
  draw(buffer, bounds);
  const patch = createPatch(before, buffer, bounds);
  if (patch) {
    useEditorStore.getState().commitPatch(patch);
  }
}

describe('editorStore — bake creates an independent copy', () => {
  beforeEach(() => {
    useEditorStore.getState().discardEdits();
    useEditorStore.getState().setMode('optimize');
  });

  it('copies the optimized buffer contents', () => {
    const optimized = makeOptimizedBuffer();
    useEditorStore.getState().bake(optimized, 5);
    expect(Array.from((useEditorStore.getState().buffer as PixelBuffer).data)).toEqual(Array.from(optimized.data));
  });

  it('does not alias the optimized buffer', () => {
    const optimized = makeOptimizedBuffer();
    useEditorStore.getState().bake(optimized, 5);
    expect(useEditorStore.getState().buffer).not.toBe(optimized);
    expect((useEditorStore.getState().buffer as PixelBuffer).data.buffer).not.toBe(optimized.data.buffer);
  });

  it('editing the copy never mutates the optimized output', () => {
    const optimized = makeOptimizedBuffer();
    const optimizedSnapshot = Array.from(optimized.data);
    useEditorStore.getState().bake(optimized, 5);

    strokeOnStore((target, bounds) => paintBrush(target, 1, 1, 1, RED, bounds));

    expect(getPixel(useEditorStore.getState().buffer as PixelBuffer, 1, 1)).toEqual({
      r: 255,
      g: 0,
      b: 0,
      a: 255,
    });
    expect(Array.from(optimized.data)).toEqual(optimizedSnapshot);
  });

  it('records the optimizer version it was baked from and starts clean', () => {
    useEditorStore.getState().bake(makeOptimizedBuffer(), 7);
    expect(useEditorStore.getState().bakedFromVersion).toBe(7);
    expect(useEditorStore.getState().isDirty).toBe(false);
  });

  it('marks the copy dirty after the first edit', () => {
    useEditorStore.getState().bake(makeOptimizedBuffer(), 1);
    strokeOnStore((t, b) => paintBrush(t, 0, 0, 1, RED, b));
    expect(useEditorStore.getState().isDirty).toBe(true);
  });
});

describe('editorStore — mode switching preserves edits and history', () => {
  beforeEach(() => {
    useEditorStore.getState().discardEdits();
    useEditorStore.getState().setMode('optimize');
  });

  it('keeps the editable buffer and its contents when returning to Optimize', () => {
    useEditorStore.getState().bake(makeOptimizedBuffer(), 1);
    strokeOnStore((t, b) => paintBrush(t, 2, 2, 1, RED, b));

    useEditorStore.getState().setMode('optimize');
    expect(useEditorStore.getState().buffer).not.toBeNull();
    expect(getPixel(useEditorStore.getState().buffer as PixelBuffer, 2, 2)?.a).toBe(255);

    useEditorStore.getState().setMode('pixelEdit');
    expect(getPixel(useEditorStore.getState().buffer as PixelBuffer, 2, 2)?.a).toBe(255);
  });

  it('keeps undo history across a mode switch', () => {
    useEditorStore.getState().bake(makeOptimizedBuffer(), 1);
    strokeOnStore((t, b) => paintBrush(t, 2, 2, 1, RED, b));
    expect(useEditorStore.getState().history.patches).toHaveLength(1);

    useEditorStore.getState().setMode('optimize');
    useEditorStore.getState().setMode('pixelEdit');

    expect(useEditorStore.getState().history.patches).toHaveLength(1);
    useEditorStore.getState().undo();
    // Restored to the baked optimizer colour, proving the patch survived the mode switch.
    expect(getPixel(useEditorStore.getState().buffer as PixelBuffer, 2, 2)).toEqual({
      r: 10,
      g: 20,
      b: 30,
      a: 255,
    });
  });

  it('keeps the dirty flag across a mode switch', () => {
    useEditorStore.getState().bake(makeOptimizedBuffer(), 1);
    strokeOnStore((t, b) => paintBrush(t, 2, 2, 1, RED, b));
    useEditorStore.getState().setMode('optimize');
    expect(useEditorStore.getState().isDirty).toBe(true);
  });
});

describe('editorStore — undo/redo through the store', () => {
  beforeEach(() => {
    useEditorStore.getState().discardEdits();
  });

  it('undoes and redoes a stroke, bumping editVersion each time', () => {
    useEditorStore.getState().bake(makeOptimizedBuffer(), 1);
    strokeOnStore((t, b) => paintBrush(t, 3, 3, 1, RED, b));
    const afterEdit = useEditorStore.getState().editVersion;

    useEditorStore.getState().undo();
    expect(getPixel(useEditorStore.getState().buffer as PixelBuffer, 3, 3)).toEqual({
      r: 10,
      g: 20,
      b: 30,
      a: 255,
    });
    expect(useEditorStore.getState().editVersion).toBeGreaterThan(afterEdit);

    useEditorStore.getState().redo();
    expect(getPixel(useEditorStore.getState().buffer as PixelBuffer, 3, 3)?.r).toBe(255);
  });

  it('ignores undo/redo when no editable buffer exists', () => {
    expect(() => useEditorStore.getState().undo()).not.toThrow();
    expect(() => useEditorStore.getState().redo()).not.toThrow();
  });
});

describe('editorStore — rebake and discard lifecycle', () => {
  beforeEach(() => {
    useEditorStore.getState().discardEdits();
  });

  it('rebaking replaces the buffer and resets history', () => {
    useEditorStore.getState().bake(makeOptimizedBuffer([10, 20, 30, 255]), 1);
    strokeOnStore((t, b) => paintBrush(t, 1, 1, 1, RED, b));
    expect(useEditorStore.getState().history.patches).toHaveLength(1);

    useEditorStore.getState().bake(makeOptimizedBuffer([90, 90, 90, 255]), 2);

    expect(useEditorStore.getState().history.patches).toHaveLength(0);
    expect(useEditorStore.getState().isDirty).toBe(false);
    expect(useEditorStore.getState().bakedFromVersion).toBe(2);
    expect(getPixel(useEditorStore.getState().buffer as PixelBuffer, 1, 1)).toEqual({
      r: 90,
      g: 90,
      b: 90,
      a: 255,
    });
  });

  it('exposes an explicit confirmation flow that does not itself modify the buffer', () => {
    useEditorStore.getState().bake(makeOptimizedBuffer(), 1);
    strokeOnStore((t, b) => paintBrush(t, 1, 1, 1, RED, b));

    useEditorStore.getState().requestRebake();
    expect(useEditorStore.getState().pendingRebake).toBe(true);
    // Requesting confirmation must not have touched the pixels yet.
    expect(getPixel(useEditorStore.getState().buffer as PixelBuffer, 1, 1)?.r).toBe(255);

    useEditorStore.getState().cancelRebake();
    expect(useEditorStore.getState().pendingRebake).toBe(false);
    expect(getPixel(useEditorStore.getState().buffer as PixelBuffer, 1, 1)?.r).toBe(255);
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('clears the pending confirmation once a bake actually happens', () => {
    useEditorStore.getState().bake(makeOptimizedBuffer(), 1);
    useEditorStore.getState().requestRebake();
    useEditorStore.getState().bake(makeOptimizedBuffer(), 2);
    expect(useEditorStore.getState().pendingRebake).toBe(false);
  });

  it('discardEdits removes the buffer and resets the whole lifecycle', () => {
    useEditorStore.getState().bake(makeOptimizedBuffer(), 1);
    strokeOnStore((t, b) => paintBrush(t, 1, 1, 1, RED, b));

    useEditorStore.getState().discardEdits();

    expect(useEditorStore.getState().buffer).toBeNull();
    expect(useEditorStore.getState().bakedFromVersion).toBeNull();
    expect(useEditorStore.getState().isDirty).toBe(false);
    expect(useEditorStore.getState().history.patches).toHaveLength(0);
  });
});

describe('editorStore — Step 7B additions', () => {
  beforeEach(() => {
    useEditorStore.getState().discardEdits();
    useEditorStore.getState().setTool('pen');
    useEditorStore.getState().setReplaceSource(null);
  });

  it('supports the fill tool', () => {
    useEditorStore.getState().setTool('fill');
    expect(useEditorStore.getState().tool).toBe('fill');
  });

  it('stores and clears the Color Replace source', () => {
    expect(useEditorStore.getState().replaceSource).toBeNull();
    useEditorStore.getState().setReplaceSource({ r: 12, g: 34, b: 56 });
    expect(useEditorStore.getState().replaceSource).toEqual({ r: 12, g: 34, b: 56 });
    useEditorStore.getState().setReplaceSource(null);
    expect(useEditorStore.getState().replaceSource).toBeNull();
  });

  it('a committed fill patch participates in undo/redo like a stroke', () => {
    useEditorStore.getState().bake(makeOptimizedBuffer([10, 20, 30, 255]), 1);
    // Fill through the same clone/patch/commit path the canvas uses.
    strokeOnStore((target, bounds) => floodFill(target, 0, 0, RED, bounds));

    expect(getPixel(useEditorStore.getState().buffer as PixelBuffer, 7, 7)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(useEditorStore.getState().history.patches).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(getPixel(useEditorStore.getState().buffer as PixelBuffer, 7, 7)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
    useEditorStore.getState().redo();
    expect(getPixel(useEditorStore.getState().buffer as PixelBuffer, 7, 7)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });
});
