export interface DisplayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BufferPoint {
  x: number;
  y: number;
}

/**
 * Converts a pointer position in client/screen space into integer buffer
 * pixel coordinates.
 *
 * Derived from the element's measured display rect rather than from the zoom
 * factor directly, so it stays correct regardless of zoom level, CSS
 * scaling, page scroll, or device pixel ratio. Returns null when the pointer
 * is outside the canvas, so callers never write out of bounds.
 */
export function displayToBufferPoint(
  clientX: number,
  clientY: number,
  rect: DisplayRect,
  bufferWidth: number,
  bufferHeight: number,
): BufferPoint | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  const x = Math.floor(((clientX - rect.left) / rect.width) * bufferWidth);
  const y = Math.floor(((clientY - rect.top) / rect.height) * bufferHeight);
  if (x < 0 || y < 0 || x >= bufferWidth || y >= bufferHeight) {
    return null;
  }
  return { x, y };
}

/** Clamps a point into the buffer instead of rejecting it — used while dragging past an edge. */
export function clampToBuffer(
  clientX: number,
  clientY: number,
  rect: DisplayRect,
  bufferWidth: number,
  bufferHeight: number,
): BufferPoint {
  const rawX = rect.width <= 0 ? 0 : Math.floor(((clientX - rect.left) / rect.width) * bufferWidth);
  const rawY = rect.height <= 0 ? 0 : Math.floor(((clientY - rect.top) / rect.height) * bufferHeight);
  return {
    x: Math.min(bufferWidth - 1, Math.max(0, rawX)),
    y: Math.min(bufferHeight - 1, Math.max(0, rawY)),
  };
}
