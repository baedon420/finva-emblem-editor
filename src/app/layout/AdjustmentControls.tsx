import { MAX_ADJUSTMENT, MIN_ADJUSTMENT } from '../../core/canvas/adjustments';
import type { AdjustmentSettings } from '../../core/canvas/adjustments';
import { useProjectStore } from '../../state/projectStore';

const SLIDERS: Array<{ key: keyof Omit<AdjustmentSettings, 'autoLevels'>; label: string }> = [
  { key: 'brightness', label: 'Brightness' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'saturation', label: 'Saturation' },
];

/** Emblemize preset values: the photo -> emblem treatment. Auto-levels
 *  stretches a washed-out tonal range to full black-to-white, the contrast
 *  and saturation boosts separate the subject from MGO2's muted tan/brown
 *  environments, and the 8-color reduction posterizes photo gradients into
 *  flat readable tones. */
export const EMBLEMIZE_ADJUSTMENTS: Pick<AdjustmentSettings, 'autoLevels' | 'brightness' | 'contrast' | 'saturation'> = {
  autoLevels: true,
  brightness: 0,
  contrast: 35,
  saturation: 25,
};
export const EMBLEMIZE_PALETTE_TARGET = 8;

export default function AdjustmentControls() {
  const hasImage = useProjectStore((state) => state.hasImage);
  const adjustments = useProjectStore((state) => state.adjustments);
  const setAdjustments = useProjectStore((state) => state.setAdjustments);
  const resetAdjustments = useProjectStore((state) => state.resetAdjustments);
  const setPalette = useProjectStore((state) => state.setPalette);

  const handleEmblemize = () => {
    setAdjustments({ ...EMBLEMIZE_ADJUSTMENTS });
    setPalette({ mode: 'reduced', targetColors: EMBLEMIZE_PALETTE_TARGET });
  };

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Adjustments</h2>

      <button
        type="button"
        onClick={handleEmblemize}
        disabled={!hasImage}
        className="mb-1 w-full rounded border border-amber-600/60 bg-amber-500/10 px-2 py-1.5 text-xs font-semibold text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ★ Emblemize (photo → emblem)
      </button>
      <p className="mb-3 text-[10px] leading-snug text-neutral-500">
        One-click preset for photo sources: stretches tones to full range, boosts contrast and saturation, and
        reduces the palette to {EMBLEMIZE_PALETTE_TARGET} colors. Fine-tune with the controls below.
      </p>

      <label className="mb-3 flex items-center gap-2 text-xs text-neutral-300">
        <input
          type="checkbox"
          checked={adjustments.autoLevels}
          disabled={!hasImage}
          onChange={(event) => setAdjustments({ autoLevels: event.target.checked })}
        />
        Auto Levels (stretch tonal range)
      </label>

      {SLIDERS.map(({ key, label }) => (
        <div key={key} className="mb-2">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">
            {label} ({adjustments[key] > 0 ? `+${adjustments[key]}` : adjustments[key]})
          </label>
          <input
            type="range"
            aria-label={label}
            min={MIN_ADJUSTMENT}
            max={MAX_ADJUSTMENT}
            step={1}
            value={adjustments[key]}
            disabled={!hasImage}
            onChange={(event) => setAdjustments({ [key]: Number(event.target.value) })}
            className="w-full"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => resetAdjustments()}
        disabled={!hasImage}
        className="mt-1 w-full rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Reset Adjustments
      </button>
    </div>
  );
}
