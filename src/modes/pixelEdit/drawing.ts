import type { PixelBuffer, RGBColor } from '../../core/types';

/** Supported brush sizes, in buffer pixels (square brushes). */
export const BRUSH_SIZES = [1, 2, 3, 4, 6, 8] as const;
export type BrushSize = (typeof BRUSH_SIZES)[number];

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function createEmptyBounds(): Bounds {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
}

export function isEmptyBounds(bounds: Bounds): boolean {
  return bounds.minX > bounds.maxX || bounds.minY > bounds.maxY;
}

function expandBounds(bounds: Bounds, x: number, y: number): void {
  if (x < bounds.minX) bounds.minX = x;
  if (x > bounds.maxX) bounds.maxX = x;
  if (y < bounds.minY) bounds.minY = y;
  if (y > bounds.maxY) bounds.maxY = y;
}

/** Deep copy — the editable buffer must never share memory with the optimizer's output. */
export function cloneBuffer(buffer: PixelBuffer): PixelBuffer {
  const data = new Uint8ClampedArray(new ArrayBuffer(buffer.data.length));
  data.set(buffer.data);
  return { data, width: buffer.width, height: buffer.height };
}

export interface SampledPixel extends RGBColor {
  a: number;
}

/** Reads a pixel, or null when the coordinate lies outside the buffer. */
export function getPixel(buffer: PixelBuffer, x: number, y: number): SampledPixel | null {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) {
    return null;
  }
  const p = (y * buffer.width + x) * 4;
  return { r: buffer.data[p], g: buffer.data[p + 1], b: buffer.data[p + 2], a: buffer.data[p + 3] };
}

/**
 * Paints one square brush stamp centred on (cx, cy).
 * `color === null` means erase: affected pixels become fully transparent
 * (alpha 0) rather than being painted an opaque colour.
 */
export function paintBrush(
  buffer: PixelBuffer,
  cx: number,
  cy: number,
  size: number,
  color: RGBColor | null,
  bounds?: Bounds,
): void {
  const offset = Math.floor((size - 1) / 2);
  const startX = cx - offset;
  const startY = cy - offset;

  for (let y = startY; y < startY + size; y++) {
    if (y < 0 || y >= buffer.height) {
      continue; // clipped at the canvas edge, never wrapped
    }
    for (let x = startX; x < startX + size; x++) {
      if (x < 0 || x >= buffer.width) {
        continue;
      }
      const p = (y * buffer.width + x) * 4;
      if (color === null) {
        buffer.data[p] = 0;
        buffer.data[p + 1] = 0;
        buffer.data[p + 2] = 0;
        buffer.data[p + 3] = 0;
      } else {
        buffer.data[p] = color.r;
        buffer.data[p + 1] = color.g;
        buffer.data[p + 2] = color.b;
        buffer.data[p + 3] = 255;
      }
      if (bounds) {
        expandBounds(bounds, x, y);
      }
    }
  }
}

/**
 * Paints a continuous line of brush stamps between two points using
 * Bresenham's algorithm. Pointer events fire far apart during a fast drag,
 * so every segment must be interpolated or the stroke would come out as
 * disconnected dots.
 */
export function paintLine(
  buffer: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number,
  color: RGBColor | null,
  bounds?: Bounds,
): void {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = dx - dy;

  for (;;) {
    paintBrush(buffer, x, y, size, color, bounds);
    if (x === x1 && y === y1) {
      break;
    }
    const doubleError = error * 2;
    if (doubleError > -dy) {
      error -= dy;
      x += stepX;
    }
    if (doubleError < dx) {
      error += dx;
      y += stepY;
    }
  }
}
