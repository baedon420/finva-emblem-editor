import PixelEditControls from '../../modes/pixelEdit/PixelEditControls';
import { useEditorStore } from '../../state/editorStore';
import BackgroundControls from './BackgroundControls';
import PaletteControls from './PaletteControls';
import PlacementControls from './PlacementControls';

interface LeftPanelProps {
  onUpload: (file: File) => void;
  sourceFileName: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  onBake: () => void;
  onBufferChanged: () => void;
}

export default function LeftPanel({
  onUpload,
  sourceFileName,
  sourceWidth,
  sourceHeight,
  onBake,
  onBufferChanged,
}: LeftPanelProps) {
  const mode = useEditorStore((state) => state.mode);

  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-neutral-800 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Upload</h2>
      <input
        type="file"
        aria-label="Upload image"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onUpload(file);
          }
          event.target.value = '';
        }}
        className="block w-full text-xs text-neutral-300"
      />
      <p className="mt-3 truncate text-xs text-neutral-500">
        {sourceFileName ? `Loaded: ${sourceFileName}` : 'No image loaded'}
      </p>
      {sourceWidth !== null && sourceHeight !== null && (
        <p className="mt-1 text-xs text-neutral-500">
          Source: {sourceWidth}×{sourceHeight}
        </p>
      )}

      {mode === 'optimize' && (
        <>
          <PlacementControls />
          <BackgroundControls />
          <PaletteControls />
        </>
      )}

      <PixelEditControls onBake={onBake} onBufferChanged={onBufferChanged} />
    </aside>
  );
}
