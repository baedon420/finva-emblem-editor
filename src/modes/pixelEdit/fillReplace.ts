import type { PixelBuffer, RGBColor } from '../../core/types';
import type { Bounds } from './drawing';

export interface RGBAColor extends RGBColor {
  a: number;
}

function readPixel(data: Uint8ClampedArray, p: number): RGBAColor {
  return { r: data[p], g: data[p + 1], b: data[p + 2], a: data[p + 3] };
}

function expandBounds(bounds: Bounds, x: number, y: number): void {
  if (x < bounds.minX) bounds.minX = x;
  if (x > bounds.maxX) bounds.maxX = x;
  if (y < bounds.minY) bounds.minY = y;
  if (y > bounds.maxY) bounds.maxY = y;
}

/**
 * Iterative (explicit-stack, never recursive) 4-connected flood fill.
 *
 * The region is defined by exact RGBA equality with the seed pixel, with one
 * deliberate exception: when the seed is fully transparent (alpha 0), every
 * fully transparent pixel matches regardless of its hidden RGB bytes.
 * Invisible RGB differences under alpha 0 are artifacts of earlier stages
 * (erasing zeroes RGB, background removal may not) and must not fragment a
 * region the user perceives as uniformly empty.
 *
 * Filled pixels become `fill` at full opacity. Diagonal neighbours are never
 * connected. Returns the number of pixels changed — 0 when the seed is out of
 * bounds or the seed already equals the fill result, in which case the buffer
 * and `bounds` are untouched (so callers create no history entry).
 */
export function floodFill(
  buffer: PixelBuffer,
  x: number,
  y: number,
  fill: RGBColor,
  bounds?: Bounds,
): number {
  const { data, width, height } = buffer;
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return 0;
  }

  const seed = readPixel(data, (y * width + x) * 4);
  if (seed.a === 255 && seed.r === fill.r && seed.g === fill.g && seed.b === fill.b) {
    return 0; // seed already equals the fill result — a fill would change nothing
  }

  const matchesSeed =
    seed.a === 0
      ? (p: number) => data[p + 3] === 0
      : (p: number) =>
          data[p] === seed.r && data[p + 1] === seed.g && data[p + 2] === seed.b && data[p + 3] === seed.a;

  let changed = 0;
  const stack: number[] = [y * width + x];

  while (stack.length > 0) {
    const index = stack.pop() as number;
    const p = index * 4;
    if (!matchesSeed(p)) {
      continue; // already filled via another path, or never part of the region
    }

    data[p] = fill.r;
    data[p + 1] = fill.g;
    data[p + 2] = fill.b;
    data[p + 3] = 255;
    changed += 1;

    const px = index % width;
    const py = (index - px) / width;
    if (bounds) {
      expandBounds(bounds, px, py);
    }

    if (px > 0) stack.push(index - 1);
    if (px < width - 1) stack.push(index + 1);
    if (py > 0) stack.push(index - width);
    if (py < height - 1) stack.push(index + width);
  }

  return changed;
}

/**
 * Global colour replace: rewrites every pixel exactly matching `from` (all
 * four RGBA channels) to `to` at full opacity. Fully transparent pixels can
 * only match a `from` with alpha 0, so a replace sourced from a visible
 * colour never resurrects erased pixels.
 *
 * Returns the number of pixels changed — 0 when `from` already equals the
 * replacement result or nothing matches, leaving the buffer and `bounds`
 * untouched (so callers create no history entry).
 */
export function replaceColorExact(
  buffer: PixelBuffer,
  from: RGBAColor,
  to: RGBColor,
  bounds?: Bounds,
): number {
  const { data, width, height } = buffer;
  if (from.a === 255 && from.r === to.r && from.g === to.g && from.b === to.b) {
    return 0;
  }

  let changed = 0;
  const pixelCount = width * height;
  for (let i = 0; i < pixelCount; i++) {
    const p = i * 4;
    if (data[p] !== from.r || data[p + 1] !== from.g || data[p + 2] !== from.b || data[p + 3] !== from.a) {
      continue;
    }
    data[p] = to.r;
    data[p + 1] = to.g;
    data[p + 2] = to.b;
    data[p + 3] = 255;
    changed += 1;
    if (bounds) {
      const x = i % width;
      expandBounds(bounds, x, (i - x) / width);
    }
  }

  return changed;
}
