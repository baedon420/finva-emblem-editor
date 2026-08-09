import { applyBackgroundStrategy } from './background';
import type { BackgroundSettings } from './background';
import { MASTER_CANVAS_SIZE } from './masterCanvas';
import { applyPaletteStrategy } from './palette';
import type { PaletteSettings } from './palette';
import { computePlacement } from './placement';
import type { PlacementSettings } from './placement';
import { resizeNearestNeighbor } from './resizeImageData';
import type { PixelBuffer, PlacedRect, RGBColor } from '../types';

/** Sizes the pipeline produces previews for. 64 and 32 are the spec's required
 *  diagnostic sizes; 41 is the approximate (unconfirmed) in-game simulation. */
export const PREVIEW_SIZES = [64, 41, 32] as const;

/** Nearest-neighbour downscales of any buffer at every preview size. */
export function computePreviews(buffer: PixelBuffer): Record<number, PixelBuffer> {
  const previews: Record<number, PixelBuffer> = {};
  for (const size of PREVIEW_SIZES) {
    previews[size] = resizeNearestNeighbor(buffer, size, size);
  }
  return previews;
}

export interface PaletteInfo {
  palette: RGBColor[];
  originalVisibleColorCount: number;
  resultVisibleColorCount: number;
}

export interface RenderResult {
  placedRect: PlacedRect;
  paletteInfo: PaletteInfo;
  /** Final post-pipeline master pixels. Exposed so validation and previews never re-read the canvas themselves. */
  masterBuffer: PixelBuffer;
  /** Nearest-neighbour downscales of masterBuffer, keyed by target size. */
  previews: Record<number, PixelBuffer>;
}

/**
 * Renders the master canvas from scratch using the *original* source image
 * plus the current placement, background, and palette settings. The pipeline
 * is always, in order: source -> placement -> background -> palette -> master
 * canvas. Each stage reads the previous stage's freshly-computed buffer —
 * never a previously rendered/masked/quantized canvas — so repeated setting
 * changes in any stage never compound quality loss or accumulate state.
 */
export function renderMasterCanvas(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  placement: PlacementSettings,
  background: BackgroundSettings,
  palette: PaletteSettings,
  targetSize: number = MASTER_CANVAS_SIZE,
): RenderResult {
  const rect = computePlacement(sourceWidth, sourceHeight, placement, targetSize);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, targetSize, targetSize);
  ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, rect.x, rect.y, rect.width, rect.height);

  let buffer: PixelBuffer = ctx.getImageData(0, 0, targetSize, targetSize);
  let changed = false;

  if (background.mode !== 'preserve' && background.sampledColor) {
    const afterBackground = applyBackgroundStrategy(buffer, background);
    if (afterBackground !== buffer) {
      buffer = afterBackground;
      changed = true;
    }
  }

  const paletteResult = applyPaletteStrategy(buffer, palette);
  if (paletteResult.buffer !== buffer) {
    buffer = paletteResult.buffer;
    changed = true;
  }

  if (changed) {
    ctx.putImageData(new ImageData(buffer.data, buffer.width, buffer.height), 0, 0);
  }

  const previews = computePreviews(buffer);

  return {
    placedRect: rect,
    paletteInfo: {
      palette: paletteResult.palette,
      originalVisibleColorCount: paletteResult.originalVisibleColorCount,
      resultVisibleColorCount: paletteResult.resultVisibleColorCount,
    },
    masterBuffer: buffer,
    previews,
  };
}
