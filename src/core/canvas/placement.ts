import { MASTER_CANVAS_SIZE } from './masterCanvas';
import type { PlacedRect } from '../types';

export type FitMode = 'contain' | 'fill';

/**
 * How the source image is resampled onto the master canvas.
 * 'auto' picks smooth when the draw shrinks the source (photos: nearest-
 * neighbour downscaling discards most pixels and produces severe speckling)
 * and pixelated when it enlarges or keeps it 1:1 (pixel art: smoothing would
 * blur the hard edges that make it readable).
 */
export type ScaleFilter = 'auto' | 'smooth' | 'pixelated';

export interface PlacementSettings {
  /** 'contain' (Fit) shows the whole image, letterboxed. 'fill' (Fill) covers the canvas, cropping overflow. */
  mode: FitMode;
  /** Resampling filter for the source -> master draw. Preview/export scaling is always nearest-neighbour regardless. */
  scaleFilter: ScaleFilter;
  /** Manual horizontal shift, in master-canvas pixels, from the centered position. */
  offsetX: number;
  /** Manual vertical shift, in master-canvas pixels, from the centered position. */
  offsetY: number;
  /** Multiplier applied on top of the mode's base fit/fill scale. 1 = no extra zoom. */
  zoom: number;
  /** Inset, in master-canvas pixels, applied symmetrically before fit/fill scaling. */
  padding: number;
}

/** Fit-mode zoom floor. Zooming out below this in Fit is fine — it only ever adds letterboxing. */
export const MIN_ZOOM = 0.25;
/**
 * Fill-mode zoom floor. Fill must always cover its active target area with no
 * gaps, and 1x is exactly the scale at which Fill's base fit-to-cover
 * calculation already achieves that — so Fill can never zoom out past 1x.
 */
export const FILL_MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
/** Defensive bound on manual offsets — not a usability limit, just a guard against absurd values. */
export const MAX_OFFSET = MASTER_CANVAS_SIZE;
/** Padding is capped well below half the canvas so the fit/fill target area never collapses. */
export const MAX_PADDING = 32;

export const DEFAULT_PLACEMENT_SETTINGS: PlacementSettings = {
  mode: 'contain',
  scaleFilter: 'auto',
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  padding: 0,
};

/**
 * Resolves 'auto' against the actual draw geometry: smooth only when the
 * placed rect is smaller than the source on either axis (a downscale).
 * Explicit 'smooth'/'pixelated' always win, so users with downscaled pixel
 * art or upscaled photos can override the heuristic.
 */
export function resolveScaleFilter(
  filter: ScaleFilter,
  sourceWidth: number,
  sourceHeight: number,
  rect: PlacedRect,
): 'smooth' | 'pixelated' {
  if (filter !== 'auto') {
    return filter;
  }
  return rect.width < sourceWidth || rect.height < sourceHeight ? 'smooth' : 'pixelated';
}

/** The minimum permitted zoom depends on mode: Fill can never go below 1x, Fit can go down to MIN_ZOOM. */
export function getMinZoomForMode(mode: FitMode): number {
  return mode === 'fill' ? FILL_MIN_ZOOM : MIN_ZOOM;
}

export function clampZoom(zoom: number, mode: FitMode = 'contain'): number {
  return Math.min(MAX_ZOOM, Math.max(getMinZoomForMode(mode), zoom));
}

export function clampOffset(offset: number): number {
  return Math.min(MAX_OFFSET, Math.max(-MAX_OFFSET, offset));
}

export function clampPadding(padding: number): number {
  return Math.min(MAX_PADDING, Math.max(0, padding));
}

/**
 * Computes where a source image should be drawn onto a square target canvas
 * given explicit placement settings. Pure function — no DOM/canvas access —
 * so it is fully unit-testable and reusable by any renderer. All inputs are
 * clamped internally, so no caller can produce a zero-size or malformed rect.
 */
export function computePlacement(
  sourceWidth: number,
  sourceHeight: number,
  settings: PlacementSettings,
  targetSize: number = MASTER_CANVAS_SIZE,
): PlacedRect {
  const padding = clampPadding(settings.padding);
  const safeTarget = Math.max(1, targetSize - padding * 2);

  const baseScale =
    settings.mode === 'fill'
      ? Math.max(safeTarget / sourceWidth, safeTarget / sourceHeight)
      : Math.min(safeTarget / sourceWidth, safeTarget / sourceHeight);

  const scale = baseScale * clampZoom(settings.zoom, settings.mode);

  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const centeredX = Math.round((targetSize - width) / 2);
  const centeredY = Math.round((targetSize - height) / 2);

  const x = Math.round(centeredX + clampOffset(settings.offsetX));
  const y = Math.round(centeredY + clampOffset(settings.offsetY));

  return { x, y, width, height };
}
