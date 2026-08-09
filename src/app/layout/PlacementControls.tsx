import { MAX_OFFSET, MAX_PADDING, MAX_ZOOM, getMinZoomForMode } from '../../core/canvas/placement';
import { useProjectStore } from '../../state/projectStore';

const modeButtonClass = (active: boolean) =>
  `flex-1 rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
    active ? 'bg-neutral-100 text-neutral-900' : 'border border-neutral-700 text-neutral-300'
  }`;

export default function PlacementControls() {
  const hasImage = useProjectStore((state) => state.hasImage);
  const placement = useProjectStore((state) => state.placement);
  const setPlacement = useProjectStore((state) => state.setPlacement);
  const resetPlacement = useProjectStore((state) => state.resetPlacement);
  const zoomMin = getMinZoomForMode(placement.mode);

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Crop &amp; Position</h2>

      <div className="mb-2 flex gap-1">
        <button
          type="button"
          onClick={() => setPlacement({ mode: 'contain' })}
          disabled={!hasImage}
          className={modeButtonClass(placement.mode === 'contain')}
        >
          Fit
        </button>
        <button
          type="button"
          onClick={() => setPlacement({ mode: 'fill' })}
          disabled={!hasImage}
          className={modeButtonClass(placement.mode === 'fill')}
        >
          Fill
        </button>
      </div>
      <p className="mb-4 text-[10px] leading-snug text-neutral-500">
        {placement.mode === 'contain'
          ? 'Fit: shows the entire image. Empty space may appear around it.'
          : 'Fill: covers the whole canvas. Edges of the image may be cropped. Zoom cannot go below 1x in this mode. (Safe Padding still shrinks the placed area if set.)'}
      </p>

      <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">
        Zoom ({placement.zoom.toFixed(2)}x)
      </label>
      <input
        type="range"
        aria-label="Zoom"
        min={zoomMin}
        max={MAX_ZOOM}
        step={0.05}
        value={placement.zoom}
        disabled={!hasImage}
        onChange={(event) => setPlacement({ zoom: Number(event.target.value) })}
        className="mb-3 w-full"
      />

      <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">
        Horizontal Position ({placement.offsetX}px)
      </label>
      <input
        type="range"
        aria-label="Horizontal position"
        min={-MAX_OFFSET}
        max={MAX_OFFSET}
        step={1}
        value={placement.offsetX}
        disabled={!hasImage}
        onChange={(event) => setPlacement({ offsetX: Number(event.target.value) })}
        className="mb-3 w-full"
      />

      <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">
        Vertical Position ({placement.offsetY}px)
      </label>
      <input
        type="range"
        aria-label="Vertical position"
        min={-MAX_OFFSET}
        max={MAX_OFFSET}
        step={1}
        value={placement.offsetY}
        disabled={!hasImage}
        onChange={(event) => setPlacement({ offsetY: Number(event.target.value) })}
        className="mb-3 w-full"
      />

      <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">
        Safe Padding ({placement.padding}px)
      </label>
      <input
        type="range"
        aria-label="Safe padding"
        min={0}
        max={MAX_PADDING}
        step={1}
        value={placement.padding}
        disabled={!hasImage}
        onChange={(event) => setPlacement({ padding: Number(event.target.value) })}
        className="mb-4 w-full"
      />

      <button
        type="button"
        onClick={() => resetPlacement()}
        disabled={!hasImage}
        className="w-full rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Reset to Fit
      </button>
    </div>
  );
}
