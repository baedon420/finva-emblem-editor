import { collectVisibleColorCounts } from '../../core/canvas/palette';
import type { ColorCount } from '../../core/canvas/palette';
import type { PixelBuffer } from '../../core/types';

/**
 * Swatch cap for the edited-buffer palette panel. The spec allows 32–64;
 * 64 shows the widest slice of a hand-edited buffer while staying scannable.
 */
export const EDITED_PALETTE_MAX_SWATCHES = 64;

export interface EditedPaletteAnalysis {
  /** Most frequent visible colors, capped at `maxSwatches`, deterministically ordered. */
  entries: ColorCount[];
  /** Distinct RGB values among pixels with alpha > 0 — may exceed entries.length. */
  totalDistinct: number;
}

/**
 * Palette summary of the editable buffer for the Pixel Edit panel.
 *
 * Fully transparent pixels are excluded entirely (their RGB bytes are
 * invisible and must not appear as swatches). Ordering is deterministic:
 * count descending, ties broken by ascending R, then G, then B — identical
 * buffers always produce identical panels.
 */
export function analyzeEditedPalette(
  buffer: PixelBuffer,
  maxSwatches: number = EDITED_PALETTE_MAX_SWATCHES,
): EditedPaletteAnalysis {
  const counts = collectVisibleColorCounts(buffer);
  counts.sort((a, b) => b.count - a.count || a.r - b.r || a.g - b.g || a.b - b.b);
  return {
    entries: counts.slice(0, maxSwatches),
    totalDistinct: counts.length,
  };
}
