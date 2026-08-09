import type { PixelBuffer } from '../../core/types';
import type { AppMode } from '../../state/editorStore';

export type ActiveBufferSource = 'editable' | 'optimized' | 'none';

export interface ActiveBufferSelection {
  buffer: PixelBuffer | null;
  source: ActiveBufferSource;
}

/**
 * Single source of truth for "which buffer is live right now".
 *
 * Previews, readiness validation, and PNG export all resolve through this,
 * so they can never disagree about what the user is looking at. Pixel Edit
 * mode uses the editable copy only when one actually exists; otherwise the
 * canonical optimizer output stays authoritative.
 */
export function selectActiveBuffer(
  mode: AppMode,
  editableBuffer: PixelBuffer | null,
  optimizedBuffer: PixelBuffer | null,
): ActiveBufferSelection {
  if (mode === 'pixelEdit' && editableBuffer) {
    return { buffer: editableBuffer, source: 'editable' };
  }
  if (optimizedBuffer) {
    return { buffer: optimizedBuffer, source: 'optimized' };
  }
  return { buffer: null, source: 'none' };
}
