import { useState } from 'react';
import type { AdjustmentSettings } from '../../core/canvas/adjustments';
import type { PaletteSettings } from '../../core/canvas/palette';
import type { PlacementSettings } from '../../core/canvas/placement';
import { useProjectStore } from '../../state/projectStore';

export interface Recipe {
  id: string;
  label: string;
  /** What this source type needs and why, in one or two sentences. */
  summary: string;
  /** Manual steps the Apply button cannot do for the user. */
  steps: string[];
  /** Full (not partial) setting values so applying is deterministic regardless of prior state. */
  apply: {
    adjustments: AdjustmentSettings;
    palette: PaletteSettings;
    placement?: Partial<Pick<PlacementSettings, 'mode' | 'scaleFilter'>>;
  };
}

const NEUTRAL_ADJUSTMENTS: AdjustmentSettings = {
  autoLevels: false,
  brightness: 0,
  contrast: 0,
  saturation: 0,
};

export const RECIPES: Recipe[] = [
  {
    id: 'photo',
    label: 'Photo / portrait',
    summary:
      'Photos are midtone mush at emblem size, and MGO2’s tan/brown world camouflages warm tones. They need the full posterize treatment.',
    steps: [
      'Zoom in until the face fills most of the frame — crop ruthlessly.',
      'After applying, pick a direction: keep the saturated poster look, or drag Saturation to -100 for high-contrast black-and-white.',
      'If the face is murky, nudge Brightness up 10–20.',
    ],
    apply: {
      adjustments: { autoLevels: true, brightness: 0, contrast: 35, saturation: 25 },
      palette: { mode: 'reduced', targetColors: 8 },
      placement: { mode: 'fill' },
    },
  },
  {
    id: 'logo',
    label: 'Logo / symbol',
    summary: 'Usually already bold shapes — the work is isolating it from its background cleanly.',
    steps: [
      'Background → Transparent, sample the background color, then raise Tolerance until it’s gone (lower it if the logo gets eaten).',
      'Check the Night HUD tile — a dark logo with its background removed can vanish there. Brighten it if so.',
    ],
    apply: {
      adjustments: { autoLevels: true, brightness: 0, contrast: 10, saturation: 0 },
      palette: { mode: 'reduced', targetColors: 12 },
    },
  },
  {
    id: 'cartoon',
    label: 'Cartoon / meme',
    summary:
      'Already flat-colored, so skip the heavy treatment — Emblemize can blow out skin tones. Crop to the recognizable element.',
    steps: [
      'Crop to the face or key element, not the whole panel — a meme only works if it’s identifiable at thumbnail size.',
    ],
    apply: {
      adjustments: { autoLevels: false, brightness: 0, contrast: 15, saturation: 0 },
      palette: { mode: 'reduced', targetColors: 16 },
    },
  },
  {
    id: 'vintage',
    label: 'Retro poster art (Nagel style)',
    summary:
      'Flat color planes and stark line-work are already emblem-friendly. The risks: thin black lines vanish at 16px, and pale skin tones melt into MGO2’s tan UI.',
    steps: [
      'Crop tight on the face with Fill + Zoom — bold shapes survive the shrink, fine line-work won’t.',
      'If the background is white or pale, use Background → Replace with black or deep navy so the pale tones pop on the tan lobby row.',
      'Check the Day HUD tile — white areas camouflage there. Add saturation or darken the background if they do.',
    ],
    apply: {
      adjustments: { autoLevels: false, brightness: 0, contrast: 15, saturation: 15 },
      palette: { mode: 'reduced', targetColors: 8 },
      placement: { mode: 'fill' },
    },
  },
  {
    id: 'pixel-art',
    label: 'Pixel art',
    summary: 'Already made for small sizes — the only job is not ruining it. Smoothing or palette changes would.',
    steps: [
      'Touch nothing else: Preserve background, no adjustments. If the master canvas looks blocky, that’s correct — it will look right in game.',
    ],
    apply: {
      adjustments: { ...NEUTRAL_ADJUSTMENTS },
      palette: { mode: 'original', targetColors: 16 },
      placement: { scaleFilter: 'pixelated' },
    },
  },
  {
    id: 'text',
    label: 'Text / lettering',
    summary: 'Hard rule: 1–3 big characters max. A whole word is unreadable mush at 16px.',
    steps: [
      'Maximum contrast: white or yellow text on a dark or transparent background.',
      'Make the characters fill the frame edge to edge.',
    ],
    apply: {
      adjustments: { autoLevels: false, brightness: 0, contrast: 50, saturation: 0 },
      palette: { mode: 'reduced', targetColors: 8 },
    },
  },
];

/**
 * Per-source-type recipes: pick what kind of image was uploaded, read the
 * manual steps, and Apply sets every slider/palette value for that type in
 * one deterministic shot. Manual steps stay text because they need the
 * user's eyes (sampling a background color, judging the simulation tiles).
 */
export default function PlaybookPanel() {
  const [recipeId, setRecipeId] = useState<string>(RECIPES[0].id);
  const hasImage = useProjectStore((state) => state.hasImage);
  const setAdjustments = useProjectStore((state) => state.setAdjustments);
  const setPalette = useProjectStore((state) => state.setPalette);
  const setPlacement = useProjectStore((state) => state.setPlacement);

  const recipe = RECIPES.find((r) => r.id === recipeId) ?? RECIPES[0];

  const handleApply = () => {
    setAdjustments(recipe.apply.adjustments);
    setPalette(recipe.apply.palette);
    if (recipe.apply.placement) {
      setPlacement(recipe.apply.placement);
    }
  };

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Playbook</h2>

      <select
        aria-label="Image type"
        value={recipeId}
        onChange={(event) => setRecipeId(event.target.value)}
        className="mb-2 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
      >
        {RECIPES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>

      <p className="mb-2 text-[10px] leading-snug text-neutral-400">{recipe.summary}</p>

      <ul className="mb-2 list-disc space-y-1 pl-4 text-[10px] leading-snug text-neutral-500">
        {recipe.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handleApply}
        disabled={!hasImage}
        className="w-full rounded border border-neutral-600 bg-neutral-100/5 px-2 py-1.5 text-xs font-semibold text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Apply Recipe
      </button>
      <p className="mt-1 text-[10px] leading-snug text-neutral-600">
        Apply sets the sliders and palette for this type; the steps above need your eyes. Judge results in the
        In-Game Simulation panel.
      </p>
    </div>
  );
}
