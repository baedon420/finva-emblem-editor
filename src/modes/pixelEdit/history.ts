import type { PixelBuffer } from '../../core/types';
import type { Bounds } from './drawing';
import { isEmptyBounds } from './drawing';

/**
 * Upper bound on retained operations. Patches store only the rectangle a
 * stroke actually touched, so a full-canvas stroke is the worst case at
 * ~512KB (before + after) and a typical small stroke costs a few KB. 64
 * operations keeps worst-case history well bounded while comfortably
 * covering the undo depth a user reaches for in practice.
 */
export const MAX_HISTORY_OPERATIONS = 64;

/** A rectangular before/after diff of one atomic operation (e.g. one drag stroke). */
export interface EditPatch {
  x: number;
  y: number;
  width: number;
  height: number;
  before: Uint8ClampedArray<ArrayBuffer>;
  after: Uint8ClampedArray<ArrayBuffer>;
}

export interface EditHistory {
  patches: EditPatch[];
  /** Number of patches currently applied; also the insertion point for the next patch. */
  index: number;
  limit: number;
}

export function createHistory(limit: number = MAX_HISTORY_OPERATIONS): EditHistory {
  return { patches: [], index: 0, limit };
}

function copyRegion(buffer: PixelBuffer, x: number, y: number, width: number, height: number) {
  const out = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  for (let row = 0; row < height; row++) {
    const sourceStart = ((y + row) * buffer.width + x) * 4;
    out.set(buffer.data.subarray(sourceStart, sourceStart + width * 4), row * width * 4);
  }
  return out;
}

function writeRegion(buffer: PixelBuffer, patch: EditPatch, data: Uint8ClampedArray<ArrayBuffer>): void {
  for (let row = 0; row < patch.height; row++) {
    const destStart = ((patch.y + row) * buffer.width + patch.x) * 4;
    buffer.data.set(data.subarray(row * patch.width * 4, (row + 1) * patch.width * 4), destStart);
  }
}

/**
 * Builds a patch describing the change between two buffers over `bounds`.
 * Returns null when the stroke touched nothing, so no-op strokes never
 * consume a history slot.
 */
export function createPatch(before: PixelBuffer, after: PixelBuffer, bounds: Bounds): EditPatch | null {
  if (isEmptyBounds(bounds)) {
    return null;
  }
  const x = Math.max(0, bounds.minX);
  const y = Math.max(0, bounds.minY);
  const width = Math.min(after.width - 1, bounds.maxX) - x + 1;
  const height = Math.min(after.height - 1, bounds.maxY) - y + 1;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return {
    x,
    y,
    width,
    height,
    before: copyRegion(before, x, y, width, height),
    after: copyRegion(after, x, y, width, height),
  };
}

/**
 * Records a completed operation. Any redo entries ahead of the current
 * position are dropped, since the timeline has branched. Oldest entries are
 * evicted once the limit is exceeded.
 */
export function recordPatch(history: EditHistory, patch: EditPatch): void {
  history.patches.length = history.index;
  history.patches.push(patch);
  if (history.patches.length > history.limit) {
    history.patches.splice(0, history.patches.length - history.limit);
  }
  history.index = history.patches.length;
}

export function canUndo(history: EditHistory): boolean {
  return history.index > 0;
}

export function canRedo(history: EditHistory): boolean {
  return history.index < history.patches.length;
}

export function undo(history: EditHistory, buffer: PixelBuffer): boolean {
  if (!canUndo(history)) {
    return false;
  }
  const patch = history.patches[history.index - 1];
  writeRegion(buffer, patch, patch.before);
  history.index -= 1;
  return true;
}

export function redo(history: EditHistory, buffer: PixelBuffer): boolean {
  if (!canRedo(history)) {
    return false;
  }
  const patch = history.patches[history.index];
  writeRegion(buffer, patch, patch.after);
  history.index += 1;
  return true;
}
