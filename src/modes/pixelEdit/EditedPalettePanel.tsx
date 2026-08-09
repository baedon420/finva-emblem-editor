import { useMemo } from 'react';
import { rgbToHex } from '../../core/canvas/color';
import { useEditorStore } from '../../state/editorStore';
import { EDITED_PALETTE_MAX_SWATCHES, analyzeEditedPalette } from './editedPalette';

/**
 * Live palette of the editable buffer. Left-click a swatch to draw with that
 * colour; right-click to set it as the Color Replace source.
 */
export default function EditedPalettePanel() {
  const buffer = useEditorStore((state) => state.buffer);
  const editVersion = useEditorStore((state) => state.editVersion);
  const setColor = useEditorStore((state) => state.setColor);
  const setReplaceSource = useEditorStore((state) => state.setReplaceSource);

  // editVersion invalidates the memo after every committed edit, undo, or
  // redo — the buffer object itself is mutated in place and never replaced.
  const analysis = useMemo(
    () => (buffer ? analyzeEditedPalette(buffer) : null),
    [buffer, editVersion],
  );

  if (!analysis) {
    return null;
  }

  return (
    <div className="mb-3">
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">Colours in image</label>
      {analysis.entries.length === 0 ? (
        <p className="text-[10px] text-neutral-500">No visible pixels yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-8 gap-1">
            {analysis.entries.map((entry) => {
              const hex = rgbToHex(entry);
              return (
                <button
                  key={hex}
                  type="button"
                  title={`${hex} — ${entry.count.toLocaleString()} px\nClick: drawing colour · Right-click: replace source`}
                  aria-label={`${hex}, ${entry.count} pixels`}
                  onClick={() => setColor({ r: entry.r, g: entry.g, b: entry.b })}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setReplaceSource({ r: entry.r, g: entry.g, b: entry.b });
                  }}
                  className="checkerboard-bg h-6 w-full rounded border border-neutral-700"
                >
                  <span className="block h-full w-full rounded-[3px]" style={{ backgroundColor: hex }} />
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-neutral-500">
            {analysis.totalDistinct.toLocaleString()} distinct colour{analysis.totalDistinct === 1 ? '' : 's'}
            {analysis.totalDistinct > analysis.entries.length &&
              ` — showing the ${EDITED_PALETTE_MAX_SWATCHES} most frequent`}
          </p>
        </>
      )}
    </div>
  );
}
