import type { AppMode } from '../../state/editorStore';

interface TopToolbarProps {
  onExport: () => void;
  exportDisabled: boolean;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  /** Pixel Edit needs an image; entering it auto-bakes an editable copy if none exists. */
  pixelEditAvailable: boolean;
}

const modeButtonClass = (active: boolean) =>
  `rounded px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
    active ? 'bg-neutral-100 text-neutral-900' : 'border border-neutral-700 text-neutral-300'
  }`;

export default function TopToolbar({
  onExport,
  exportDisabled,
  mode,
  onModeChange,
  pixelEditAvailable,
}: TopToolbarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-800 px-4">
      <span className="text-sm font-semibold text-neutral-100">MGO2 Emblem Studio</span>

      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onModeChange('optimize')} className={modeButtonClass(mode === 'optimize')}>
          Optimize
        </button>
        <button
          type="button"
          onClick={() => onModeChange('pixelEdit')}
          disabled={!pixelEditAvailable}
          title={pixelEditAvailable ? undefined : 'Upload an image first'}
          className={modeButtonClass(mode === 'pixelEdit')}
        >
          Pixel Edit
        </button>
      </div>

      <button
        type="button"
        onClick={onExport}
        disabled={exportDisabled}
        className="rounded bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Export PNG (256×256)
      </button>
    </header>
  );
}
