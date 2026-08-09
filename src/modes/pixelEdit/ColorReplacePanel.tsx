import { useState } from 'react';
import HexColorInput from '../../app/components/HexColorInput';
import { rgbToHex } from '../../core/canvas/color';
import { useEditorStore } from '../../state/editorStore';
import { cloneBuffer, createEmptyBounds } from './drawing';
import { replaceColorExact } from './fillReplace';
import { createPatch } from './history';

interface ColorReplacePanelProps {
  /** Called after a committed replace so previews/validation can refresh. */
  onBufferChanged: () => void;
}

/**
 * Global Color Replace: rewrites every pixel matching the source colour
 * (exact RGBA, opaque) to the current drawing colour. Runs only on the
 * explicit Replace button and reports how many pixels changed.
 */
export default function ColorReplacePanel({ onBufferChanged }: ColorReplacePanelProps) {
  const buffer = useEditorStore((state) => state.buffer);
  const color = useEditorStore((state) => state.color);
  const replaceSource = useEditorStore((state) => state.replaceSource);
  const editVersion = useEditorStore((state) => state.editVersion);
  const mode = useEditorStore((state) => state.mode);
  const setReplaceSource = useEditorStore((state) => state.setReplaceSource);
  const commitPatch = useEditorStore((state) => state.commitPatch);

  /**
   * The result message is stamped with the editVersion and mode it described.
   * Any later change — undo, redo, a new edit, rebake, discard, or a mode
   * switch — makes the stamp stale and hides the message, so it can never
   * describe a buffer state the user is no longer looking at.
   */
  const [message, setMessage] = useState<{ text: string; version: number; mode: string } | null>(null);
  const visibleMessage =
    message && message.version === editVersion && message.mode === mode ? message.text : null;

  const stampMessage = (text: string) =>
    setMessage({ text, version: useEditorStore.getState().editVersion, mode });

  const handleReplace = () => {
    if (!buffer || !replaceSource) {
      return;
    }
    const before = cloneBuffer(buffer);
    const bounds = createEmptyBounds();
    // Matches fully opaque pixels of the source colour — the only kind the
    // pen, fill, and palette swatches produce.
    const changed = replaceColorExact(buffer, { ...replaceSource, a: 255 }, color, bounds);
    if (changed === 0) {
      stampMessage('No pixels matched — nothing changed.');
      return;
    }
    const patch = createPatch(before, buffer, bounds);
    if (patch) {
      commitPatch(patch);
      onBufferChanged();
    }
    // Stamped after commitPatch so the message tracks the post-replace version.
    stampMessage(`Replaced ${changed.toLocaleString()} pixel${changed === 1 ? '' : 's'}.`);
  };

  return (
    <div className="mb-3">
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">Global colour replace</label>

      <div className="mb-1 flex items-center gap-2">
        <span className="w-8 text-[10px] text-neutral-500">From</span>
        {replaceSource ? (
          <>
            <span
              className="h-5 w-5 shrink-0 rounded border border-neutral-700"
              style={{ backgroundColor: rgbToHex(replaceSource) }}
            />
            <HexColorInput
              color={replaceSource}
              onChange={setReplaceSource}
              aria-label="Color replace source hex value"
              className="w-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-100"
            />
          </>
        ) : (
          <span className="text-[10px] text-neutral-500">Right-click a swatch above to choose</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setReplaceSource(color)}
        className="mb-2 w-full rounded border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400"
      >
        Use current colour as source
      </button>

      <div className="mb-2 flex items-center gap-2">
        <span className="w-8 text-[10px] text-neutral-500">To</span>
        <span className="h-5 w-5 shrink-0 rounded border border-neutral-700" style={{ backgroundColor: rgbToHex(color) }} />
        <span className="text-[10px] text-neutral-500">current drawing colour ({rgbToHex(color)})</span>
      </div>

      <button
        type="button"
        onClick={handleReplace}
        disabled={!replaceSource}
        className="w-full rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Replace
      </button>
      {visibleMessage && <p className="mt-1 text-[10px] text-neutral-400">{visibleMessage}</p>}
    </div>
  );
}
