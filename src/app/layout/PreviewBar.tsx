import { useCallback, useEffect, useRef } from 'react';
import { downloadBlob, exportCanvasAsPngBlob } from '../../core/io/exportPng';
import type { PixelBuffer } from '../../core/types';
import { useProjectStore } from '../../state/projectStore';

interface PreviewSlotConfig {
  size: number;
  label: string;
  /** null means this slot has no export action (not an official/confirmed output size). */
  exportFileName: string | null;
}

const PREVIEW_SLOTS: PreviewSlotConfig[] = [
  { size: 64, label: '64×64 readability', exportFileName: 'preview_64.png' },
  { size: 41, label: '41×41 — approximate in-game simulation (unconfirmed)', exportFileName: null },
  { size: 32, label: '32×32 readability', exportFileName: 'preview_32.png' },
];

const DISPLAY_BOX_SIZE = 72;

interface PreviewBarProps {
  /** Preview pixel buffers produced by the render pipeline, keyed by size. */
  previews: Record<number, PixelBuffer> | null;
  hasImage: boolean;
}

export default function PreviewBar({ previews, hasImage }: PreviewBarProps) {
  const previewCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const setAppError = useProjectStore((state) => state.setAppError);

  // Paints buffers the pipeline already computed — the UI never samples the
  // master canvas itself, so previews, validation, and export all read from
  // exactly the same pixel data.
  useEffect(() => {
    if (!previews) {
      return;
    }
    for (const slot of PREVIEW_SLOTS) {
      const canvas = previewCanvasRefs.current.get(slot.size);
      const buffer = previews[slot.size];
      if (!canvas || !buffer) {
        continue;
      }
      canvas.width = buffer.width;
      canvas.height = buffer.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        continue;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.putImageData(new ImageData(buffer.data, buffer.width, buffer.height), 0, 0);
    }
  }, [previews]);

  const handleExport = useCallback(
    async (size: number, fileName: string) => {
      const canvas = previewCanvasRefs.current.get(size);
      if (!canvas) {
        setAppError('Load an image before exporting.');
        return;
      }
      try {
        const blob = await exportCanvasAsPngBlob(canvas);
        downloadBlob(blob, fileName);
        setAppError(null);
      } catch {
        setAppError('The PNG could not be created. Try exporting again.');
      }
    },
    [setAppError],
  );

  return (
    <footer className="flex h-36 shrink-0 items-center gap-6 border-t border-neutral-800 px-4">
      {PREVIEW_SLOTS.map((slot) => (
        <div key={slot.size} className="flex flex-col items-center gap-1">
          <div className="checkerboard-bg" style={{ width: DISPLAY_BOX_SIZE, height: DISPLAY_BOX_SIZE }}>
            <canvas
              ref={(el) => {
                if (el) {
                  previewCanvasRefs.current.set(slot.size, el);
                } else {
                  previewCanvasRefs.current.delete(slot.size);
                }
              }}
              width={slot.size}
              height={slot.size}
              className="border border-neutral-700"
              style={{ width: DISPLAY_BOX_SIZE, height: DISPLAY_BOX_SIZE, imageRendering: 'pixelated' }}
            />
          </div>
          <span className="max-w-[7rem] text-center text-[10px] uppercase leading-tight tracking-wide text-neutral-500">
            {slot.label}
          </span>
          {slot.exportFileName && (
            <button
              type="button"
              title={`Saves ${slot.exportFileName}`}
              onClick={() => handleExport(slot.size, slot.exportFileName as string)}
              disabled={!hasImage}
              className="rounded border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Export {slot.size}×{slot.size}
            </button>
          )}
        </div>
      ))}
    </footer>
  );
}
