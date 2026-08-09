import { hexToRgb, rgbToHex } from '../../core/canvas/color';
import HexColorInput from '../../app/components/HexColorInput';
import { MIN_GRID_ZOOM, ZOOM_LEVELS, useEditorStore } from '../../state/editorStore';
import type { PixelTool } from '../../state/editorStore';
import { useProjectStore } from '../../state/projectStore';
import ColorReplacePanel from './ColorReplacePanel';
import { BRUSH_SIZES } from './drawing';
import type { BrushSize } from './drawing';
import { getEditableCopyStatus } from './editableCopy';
import EditedPalettePanel from './EditedPalettePanel';
import { canRedo, canUndo } from './history';

const buttonClass = (active: boolean) =>
  `flex-1 rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
    active ? 'bg-neutral-100 text-neutral-900' : 'border border-neutral-700 text-neutral-300'
  }`;

const TOOLS: Array<{ value: PixelTool; label: string; shortcut: string }> = [
  { value: 'pen', label: 'Pen', shortcut: 'B' },
  { value: 'eraser', label: 'Eraser', shortcut: 'E' },
  { value: 'eyedropper', label: 'Pick', shortcut: 'I' },
  { value: 'fill', label: 'Fill', shortcut: 'G' },
];

interface PixelEditControlsProps {
  onBake: () => void;
  onBufferChanged: () => void;
}

export default function PixelEditControls({ onBake, onBufferChanged }: PixelEditControlsProps) {
  const hasImage = useProjectStore((state) => state.hasImage);
  const optimizerVersion = useProjectStore((state) => state.version);

  const buffer = useEditorStore((state) => state.buffer);
  const bakedFromVersion = useEditorStore((state) => state.bakedFromVersion);
  const isDirty = useEditorStore((state) => state.isDirty);
  const history = useEditorStore((state) => state.history);
  const editVersion = useEditorStore((state) => state.editVersion);
  const tool = useEditorStore((state) => state.tool);
  const color = useEditorStore((state) => state.color);
  const brushSize = useEditorStore((state) => state.brushSize);
  const zoom = useEditorStore((state) => state.zoom);
  const showGrid = useEditorStore((state) => state.showGrid);
  const pendingRebake = useEditorStore((state) => state.pendingRebake);

  const setTool = useEditorStore((state) => state.setTool);
  const setColor = useEditorStore((state) => state.setColor);
  const setBrushSize = useEditorStore((state) => state.setBrushSize);
  const setZoom = useEditorStore((state) => state.setZoom);
  const toggleGrid = useEditorStore((state) => state.toggleGrid);
  const requestRebake = useEditorStore((state) => state.requestRebake);
  const cancelRebake = useEditorStore((state) => state.cancelRebake);
  const discardEdits = useEditorStore((state) => state.discardEdits);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  const status = getEditableCopyStatus({
    hasBuffer: buffer !== null,
    bakedFromVersion,
    currentOptimizerVersion: optimizerVersion,
    isDirty,
  });

  // editVersion is read so undo/redo availability re-renders after each edit.
  void editVersion;
  const undoAvailable = buffer !== null && canUndo(history);
  const redoAvailable = buffer !== null && canRedo(history);

  const handleBakeClick = () => {
    if (status.requiresRebakeConfirmation) {
      requestRebake();
      return;
    }
    onBake();
  };

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Pixel Edit</h2>

      {status.state === 'absent' ? (
        <>
          <button
            type="button"
            onClick={onBake}
            disabled={!hasImage}
            className="w-full rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create Editable Copy
          </button>
          <p className="mt-2 text-[10px] leading-snug text-neutral-500">
            Takes a 256×256 snapshot of the current optimized output to draw on. The original image and optimizer
            settings are never modified.
          </p>
        </>
      ) : (
        <>
          {status.state === 'stale' && (
            <p className="mb-2 rounded border border-amber-600/40 bg-amber-500/10 px-2 py-1 text-[10px] leading-snug text-amber-300">
              ⚠ This editable copy was made from an earlier optimization. Optimizer settings have changed since.
              Re-bake to pick them up, or keep editing this copy.
            </p>
          )}

          {pendingRebake ? (
            <div className="mb-3 rounded border border-red-600/40 bg-red-500/10 p-2">
              <p className="mb-2 text-[10px] leading-snug text-red-300">
                Re-baking replaces this copy with a fresh snapshot and <strong>permanently discards your pixel
                edits</strong>. This cannot be undone.
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={onBake}
                  className="flex-1 rounded bg-red-500/80 px-2 py-1 text-[11px] font-medium text-white"
                >
                  Overwrite edits
                </button>
                <button
                  type="button"
                  onClick={cancelRebake}
                  className="flex-1 rounded border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-3 flex gap-1">
              <button
                type="button"
                onClick={handleBakeClick}
                className="flex-1 rounded border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300"
              >
                Re-bake
              </button>
              <button
                type="button"
                onClick={discardEdits}
                className="flex-1 rounded border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300"
              >
                Discard Pixel Edits
              </button>
            </div>
          )}

          <p className="mb-3 text-[10px] text-neutral-500">
            {isDirty ? 'Edited — unsaved pixel changes' : 'No pixel edits yet'}
          </p>

          <div className="mb-2 flex gap-1">
            {TOOLS.map(({ value, label, shortcut }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTool(value)}
                title={`${label} (${shortcut})`}
                className={buttonClass(tool === value)}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">Brush size</label>
          <div className="mb-3 flex gap-1">
            {BRUSH_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setBrushSize(size as BrushSize)}
                className={`flex-1 rounded px-1 py-1 text-[11px] ${
                  brushSize === size ? 'bg-neutral-100 text-neutral-900' : 'border border-neutral-700 text-neutral-300'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">Colour</label>
          <div className="mb-3 flex items-center gap-2">
            <input
              type="color"
              aria-label="Drawing color picker"
              value={rgbToHex(color)}
              onChange={(event) => setColor(hexToRgb(event.target.value) ?? color)}
              className="h-7 w-10 cursor-pointer border border-neutral-700 bg-transparent"
            />
            <HexColorInput color={color} onChange={setColor} aria-label="Drawing color hex value" />
          </div>

          <EditedPalettePanel />
          <ColorReplacePanel onBufferChanged={onBufferChanged} />

          <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">Zoom ({zoom}x)</label>
          <div className="mb-3 flex flex-wrap gap-1">
            {ZOOM_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setZoom(level)}
                className={`rounded px-2 py-1 text-[11px] ${
                  zoom === level ? 'bg-neutral-100 text-neutral-900' : 'border border-neutral-700 text-neutral-300'
                }`}
              >
                {level}x
              </button>
            ))}
          </div>
          {zoom > 1 && (
            <p className="-mt-1 mb-3 text-[10px] leading-snug text-neutral-500">
              Hold Space and drag, or use the middle mouse button, to pan.
            </p>
          )}

          <button
            type="button"
            onClick={toggleGrid}
            className={`mb-1 w-full rounded px-2 py-1 text-xs ${
              showGrid ? 'bg-neutral-100 text-neutral-900' : 'border border-neutral-700 text-neutral-300'
            }`}
          >
            Grid: {showGrid ? 'On' : 'Off'}
          </button>
          {showGrid && zoom < MIN_GRID_ZOOM && (
            <p className="mb-3 text-[10px] text-neutral-500">Grid appears at {MIN_GRID_ZOOM}x zoom and above.</p>
          )}

          <div className="mt-3 flex gap-1">
            <button
              type="button"
              onClick={() => {
                undo();
                onBufferChanged();
              }}
              disabled={!undoAvailable}
              className="flex-1 rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => {
                redo();
                onBufferChanged();
              }}
              disabled={!redoAvailable}
              className="flex-1 rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Redo
            </button>
          </div>

          <p className="mt-2 text-[10px] leading-snug text-neutral-500">
            Shortcuts: B/E/I/G tools · Ctrl+Z undo · Ctrl+Shift+Z or Ctrl+Y redo · Space+drag or middle-mouse to
            pan
          </p>
        </>
      )}
    </div>
  );
}
