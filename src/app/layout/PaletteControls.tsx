import { useCallback } from 'react';
import { rgbToHex } from '../../core/canvas/color';
import type { PaletteMode } from '../../core/canvas/palette';
import { MAX_PALETTE_COLORS, MIN_PALETTE_COLORS } from '../../core/canvas/palette';
import { useProjectStore } from '../../state/projectStore';

const modeButtonClass = (active: boolean) =>
  `flex-1 rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
    active ? 'bg-neutral-100 text-neutral-900' : 'border border-neutral-700 text-neutral-300'
  }`;

const MODES: Array<{ value: PaletteMode; label: string }> = [
  { value: 'original', label: 'Original Colors' },
  { value: 'reduced', label: 'Reduced Palette' },
];

export default function PaletteControls() {
  const hasImage = useProjectStore((state) => state.hasImage);
  const palette = useProjectStore((state) => state.palette);
  const paletteInfo = useProjectStore((state) => state.paletteInfo);
  const setPalette = useProjectStore((state) => state.setPalette);
  const resetPalette = useProjectStore((state) => state.resetPalette);

  const handleCopy = useCallback((hex: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(hex).catch(() => {});
    }
  }, []);

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Palette</h2>

      <div className="mb-2 flex gap-1">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPalette({ mode: value })}
            disabled={!hasImage}
            className={modeButtonClass(palette.mode === value)}
          >
            {label}
          </button>
        ))}
      </div>

      {palette.mode === 'reduced' && (
        <>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">
            Target Colors ({palette.targetColors})
          </label>
          <input
            type="range"
            aria-label="Target colors"
            min={MIN_PALETTE_COLORS}
            max={MAX_PALETTE_COLORS}
            step={1}
            value={palette.targetColors}
            disabled={!hasImage}
            onChange={(event) => setPalette({ targetColors: Number(event.target.value) })}
            className="mb-1 w-full"
          />
          <p className="mb-3 text-[10px] leading-snug text-neutral-500">
            16 is a recommended starting point for MGO2 readability, not a confirmed technical maximum.
          </p>
        </>
      )}

      <p className="mb-2 text-[10px] text-neutral-500">
        Original colors: {paletteInfo.originalVisibleColorCount} · Resulting colors:{' '}
        {paletteInfo.resultVisibleColorCount}
      </p>

      {palette.mode === 'reduced' && paletteInfo.palette.length > 0 && (
        <div className="mb-3 grid grid-cols-4 gap-2">
          {paletteInfo.palette.map((color, index) => {
            const hex = rgbToHex(color);
            return (
              <button
                key={`${hex}-${index}`}
                type="button"
                onClick={() => handleCopy(hex)}
                title="Click to copy hex value"
                className="flex flex-col items-center gap-0.5"
              >
                <span className="h-6 w-full rounded border border-neutral-700" style={{ backgroundColor: hex }} />
                <span className="font-mono text-[9px] text-neutral-400">{hex}</span>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => resetPalette()}
        disabled={!hasImage}
        className="w-full rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Reset Palette
      </button>
    </div>
  );
}
