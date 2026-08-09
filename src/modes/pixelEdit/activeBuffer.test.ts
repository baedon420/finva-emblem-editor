import { describe, expect, it } from 'vitest';
import { computePreviews } from '../../core/canvas/renderMaster';
import { countVisibleColors } from '../../core/canvas/palette';
import type { PixelBuffer } from '../../core/types';
import { validateReadiness } from '../../core/validation/mgo2Readiness';
import { selectActiveBuffer } from './activeBuffer';
import { paintBrush } from './drawing';
import { useEditorStore } from '../../state/editorStore';

function makeBuffer(fill: [number, number, number, number], size = 256): PixelBuffer {
  const data = new Uint8ClampedArray(new ArrayBuffer(size * size * 4));
  for (let i = 0; i < size * size; i++) {
    data.set(fill, i * 4);
  }
  return { data, width: size, height: size };
}

const OPTIMIZED = () => makeBuffer([10, 20, 30, 255]);
const EDITABLE = () => makeBuffer([200, 100, 50, 255]);

describe('selectActiveBuffer', () => {
  it('uses the optimized buffer in Optimize mode even when an editable copy exists', () => {
    const optimized = OPTIMIZED();
    const selection = selectActiveBuffer('optimize', EDITABLE(), optimized);
    expect(selection.source).toBe('optimized');
    expect(selection.buffer).toBe(optimized);
  });

  it('uses the editable buffer in Pixel Edit mode', () => {
    const editable = EDITABLE();
    const selection = selectActiveBuffer('pixelEdit', editable, OPTIMIZED());
    expect(selection.source).toBe('editable');
    expect(selection.buffer).toBe(editable);
  });

  it('falls back to the optimized buffer in Pixel Edit mode when no copy has been baked', () => {
    const optimized = OPTIMIZED();
    const selection = selectActiveBuffer('pixelEdit', null, optimized);
    expect(selection.source).toBe('optimized');
    expect(selection.buffer).toBe(optimized);
  });

  it('reports none when nothing is available', () => {
    expect(selectActiveBuffer('optimize', null, null)).toEqual({ buffer: null, source: 'none' });
  });
});

describe('active buffer drives previews, validation and export consistently', () => {
  it('previews are generated from the editable buffer in Pixel Edit mode', () => {
    const editable = EDITABLE();
    const { buffer } = selectActiveBuffer('pixelEdit', editable, OPTIMIZED());
    const previews = computePreviews(buffer as PixelBuffer);
    // Editable fill colour, not the optimized one.
    expect(Array.from(previews[32].data.slice(0, 4))).toEqual([200, 100, 50, 255]);
  });

  it('previews are generated from the optimized buffer in Optimize mode', () => {
    const { buffer } = selectActiveBuffer('optimize', EDITABLE(), OPTIMIZED());
    const previews = computePreviews(buffer as PixelBuffer);
    expect(Array.from(previews[32].data.slice(0, 4))).toEqual([10, 20, 30, 255]);
  });

  it('validation analyses the editable buffer, reflecting pixel edits', () => {
    const editable = EDITABLE();
    // Erase a large region so the edited buffer has transparency the optimized one lacks.
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 256; x++) {
        paintBrush(editable, x, y, 1, null);
      }
    }
    const { buffer } = selectActiveBuffer('pixelEdit', editable, OPTIMIZED());
    const active = buffer as PixelBuffer;
    const previews = computePreviews(active);
    const report = validateReadiness({
      hasImage: true,
      masterBuffer: active,
      preview64: previews[64],
      preview32: previews[32],
      placedRect: { x: 0, y: 0, width: 256, height: 256 },
      visibleColorCount: countVisibleColors(active),
      canExportPng: true,
      nearestNeighborEnforced: true,
    });
    const alphaCheck = report.technical.find((c) => c.id === 'alpha-valid');
    expect(alphaCheck?.status).toBe('pass'); // transparency detected from the edited buffer
  });

  it('colour counting follows the active buffer', () => {
    const editable = EDITABLE();
    paintBrush(editable, 5, 5, 1, { r: 1, g: 2, b: 3 });
    expect(countVisibleColors(selectActiveBuffer('pixelEdit', editable, OPTIMIZED()).buffer as PixelBuffer)).toBe(2);
    expect(countVisibleColors(selectActiveBuffer('optimize', editable, OPTIMIZED()).buffer as PixelBuffer)).toBe(1);
  });
});

describe('grid is display-only and never reaches buffers or exports', () => {
  it('toggling the grid does not modify the editable pixel buffer', () => {
    useEditorStore.getState().discardEdits();
    useEditorStore.getState().bake(EDITABLE(), 1);
    const buffer = useEditorStore.getState().buffer as PixelBuffer;
    const before = Array.from(buffer.data);

    useEditorStore.getState().toggleGrid();
    useEditorStore.getState().toggleGrid();

    expect(Array.from((useEditorStore.getState().buffer as PixelBuffer).data)).toEqual(before);
  });

  it('previews derived from the buffer are identical regardless of grid state', () => {
    useEditorStore.getState().discardEdits();
    useEditorStore.getState().bake(EDITABLE(), 1);

    useEditorStore.getState().toggleGrid();
    const withGridToggled = computePreviews(useEditorStore.getState().buffer as PixelBuffer);
    useEditorStore.getState().toggleGrid();
    const withGridRestored = computePreviews(useEditorStore.getState().buffer as PixelBuffer);

    expect(Array.from(withGridToggled[32].data)).toEqual(Array.from(withGridRestored[32].data));
  });

  it('zoom is display-only and never alters the buffer that would be exported', () => {
    useEditorStore.getState().discardEdits();
    useEditorStore.getState().bake(EDITABLE(), 1);
    const before = Array.from((useEditorStore.getState().buffer as PixelBuffer).data);

    useEditorStore.getState().setZoom(16);

    const buffer = useEditorStore.getState().buffer as PixelBuffer;
    expect(buffer.width).toBe(256);
    expect(buffer.height).toBe(256);
    expect(Array.from(buffer.data)).toEqual(before);
  });
});
