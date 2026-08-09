import type { BackgroundMode } from '../../core/canvas/background';
import { MAX_TOLERANCE, MIN_TOLERANCE } from '../../core/canvas/background';
import { hexToRgb, rgbToHex } from '../../core/canvas/color';
import { useProjectStore } from '../../state/projectStore';
import HexColorInput from '../components/HexColorInput';

const modeButtonClass = (active: boolean) =>
  `flex-1 rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
    active ? 'bg-neutral-100 text-neutral-900' : 'border border-neutral-700 text-neutral-300'
  }`;

const MODES: Array<{ value: BackgroundMode; label: string }> = [
  { value: 'preserve', label: 'Preserve' },
  { value: 'transparent', label: 'Transparent' },
  { value: 'replace', label: 'Replace' },
];

export default function BackgroundControls() {
  const hasImage = useProjectStore((state) => state.hasImage);
  const background = useProjectStore((state) => state.background);
  const isSampling = useProjectStore((state) => state.isSampling);
  const setBackground = useProjectStore((state) => state.setBackground);
  const resetBackground = useProjectStore((state) => state.resetBackground);
  const setSampling = useProjectStore((state) => state.setSampling);

  const showRemovalControls = background.mode !== 'preserve';

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Background</h2>

      <div className="mb-2 flex gap-1">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setBackground({ mode: value })}
            disabled={!hasImage}
            className={modeButtonClass(background.mode === value)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-[10px] leading-snug text-neutral-500">
        {background.mode === 'preserve' &&
          'Preserve: leaves the image exactly as placed. No background processing.'}
        {background.mode === 'transparent' &&
          'Transparent: removes background pixels connected to the edges, using a sampled color.'}
        {background.mode === 'replace' &&
          'Replace: fills background pixels connected to the edges with a flat color you choose.'}
      </p>

      {showRemovalControls && (
        <>
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSampling(!isSampling)}
              disabled={!hasImage}
              className={`rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
                isSampling ? 'border-neutral-100 text-neutral-100' : 'border-neutral-700 text-neutral-300'
              }`}
            >
              {isSampling ? 'Click the image…' : 'Sample Background Color'}
            </button>
            <span
              className="h-5 w-5 shrink-0 rounded border border-neutral-600"
              style={{
                backgroundColor: background.sampledColor
                  ? `rgb(${background.sampledColor.r}, ${background.sampledColor.g}, ${background.sampledColor.b})`
                  : 'transparent',
              }}
              title={background.sampledColor ? 'Sampled background color' : 'No color sampled yet'}
            />
          </div>
          {!background.sampledColor && (
            <p className="mb-3 text-[10px] text-amber-400">
              Click "Sample Background Color", then click a background pixel on the image to pick the color to
              remove.
            </p>
          )}

          <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">
            Tolerance ({background.tolerance})
          </label>
          <input
            type="range"
            aria-label="Background removal tolerance"
            min={MIN_TOLERANCE}
            max={MAX_TOLERANCE}
            step={1}
            value={background.tolerance}
            disabled={!hasImage}
            onChange={(event) => setBackground({ tolerance: Number(event.target.value) })}
            className="mb-1 w-full"
          />
          <p className="mb-4 text-[10px] leading-snug text-amber-400">
            ⚠ Higher tolerance removes a broader range of colors. The result updates immediately — lower it again
            if too much gets removed.
          </p>
        </>
      )}

      {background.mode === 'replace' && (
        <>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">
            Replacement Color
          </label>
          <div className="mb-4 flex items-center gap-2">
            <input
              type="color"
              aria-label="Replacement color picker"
              value={rgbToHex(background.replaceColor)}
              disabled={!hasImage}
              onChange={(event) => setBackground({ replaceColor: hexToRgb(event.target.value) ?? undefined })}
              className="h-7 w-10 cursor-pointer border border-neutral-700 bg-transparent"
            />
            <HexColorInput
              color={background.replaceColor}
              onChange={(replaceColor) => setBackground({ replaceColor })}
              aria-label="Replacement color hex value"
            />
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => resetBackground()}
        disabled={!hasImage}
        className="w-full rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Reset Background
      </button>
    </div>
  );
}
