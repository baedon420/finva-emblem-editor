import { useCallback, useEffect, useRef, useState } from 'react';
import { MASTER_CANVAS_SIZE, getMasterContext } from '../core/canvas/masterCanvas';
import { countVisibleColors } from '../core/canvas/palette';
import { computePreviews, renderMasterCanvas } from '../core/canvas/renderMaster';
import { downloadBlob, exportBufferAsPngBlob, exportCanvasAsPngBlob } from '../core/io/exportPng';
import { loadImageFromFile } from '../core/io/importImage';
import type { PixelBuffer } from '../core/types';
import { validateReadiness } from '../core/validation/mgo2Readiness';
import { useEditorStore } from '../state/editorStore';
import { useProjectStore } from '../state/projectStore';
import { selectActiveBuffer } from '../modes/pixelEdit/activeBuffer';
import PixelEditCanvas from '../modes/pixelEdit/PixelEditCanvas';
import { isTypingTarget, resolveShortcut } from '../modes/pixelEdit/shortcuts';
import CenterCanvas from './layout/CenterCanvas';
import LeftPanel from './layout/LeftPanel';
import PreviewBar from './layout/PreviewBar';
import RightPanel from './layout/RightPanel';
import TopToolbar from './layout/TopToolbar';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const optimizedBufferRef = useRef<PixelBuffer | null>(null);
  const [previews, setPreviews] = useState<Record<number, PixelBuffer> | null>(null);

  const hasImage = useProjectStore((state) => state.hasImage);
  const sourceFileName = useProjectStore((state) => state.sourceFileName);
  const sourceWidth = useProjectStore((state) => state.sourceWidth);
  const sourceHeight = useProjectStore((state) => state.sourceHeight);
  const sourceImage = useProjectStore((state) => state.sourceImage);
  const placement = useProjectStore((state) => state.placement);
  const background = useProjectStore((state) => state.background);
  const palette = useProjectStore((state) => state.palette);
  const isSampling = useProjectStore((state) => state.isSampling);
  const optimizerVersion = useProjectStore((state) => state.version);
  const setImportedImage = useProjectStore((state) => state.setImportedImage);
  const setPlacedRect = useProjectStore((state) => state.setPlacedRect);
  const setBackground = useProjectStore((state) => state.setBackground);
  const setPaletteInfo = useProjectStore((state) => state.setPaletteInfo);
  const setValidation = useProjectStore((state) => state.setValidation);
  const setSampling = useProjectStore((state) => state.setSampling);
  const appError = useProjectStore((state) => state.appError);
  const setAppError = useProjectStore((state) => state.setAppError);

  const mode = useEditorStore((state) => state.mode);
  const editBuffer = useEditorStore((state) => state.buffer);
  const editVersion = useEditorStore((state) => state.editVersion);
  const setMode = useEditorStore((state) => state.setMode);
  const bake = useEditorStore((state) => state.bake);

  const pixelEditActive = mode === 'pixelEdit' && editBuffer !== null;

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        const loaded = await loadImageFromFile(file);
        // A successful import clears any earlier error and replaces all
        // previews; a failed one changes nothing, so the previous image and
        // its previews remain valid rather than stale.
        setImportedImage({
          fileName: loaded.fileName,
          width: loaded.width,
          height: loaded.height,
          image: loaded.element,
        });
      } catch (error) {
        setAppError(error instanceof Error ? error.message : 'That image could not be opened.');
      }
    },
    [setImportedImage, setAppError],
  );

  /**
   * Recomputes previews and validation from whichever buffer is currently
   * active: the Pixel Edit copy when that mode is showing it, otherwise the
   * canonical optimizer output. Both paths feed the same downstream
   * consumers, so previews, validation, and export can never disagree.
   */
  const refreshFromActiveBuffer = useCallback(() => {
    const { buffer: active } = selectActiveBuffer(mode, editBuffer, optimizedBufferRef.current);
    if (!active) {
      return;
    }
    const nextPreviews = computePreviews(active);
    setPreviews(nextPreviews);
    setValidation(
      validateReadiness({
        hasImage: true,
        masterBuffer: active,
        preview64: nextPreviews[64] ?? null,
        preview32: nextPreviews[32] ?? null,
        placedRect: useProjectStore.getState().placedRect,
        visibleColorCount: countVisibleColors(active),
        canExportPng: typeof document.createElement('canvas').toBlob === 'function',
        nearestNeighborEnforced: true,
      }),
    );
  }, [mode, editBuffer, setValidation]);

  // Optimizer pipeline: source -> placement -> background -> palette -> master.
  // Always recomputed from the original source, never from the rendered canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImage || sourceWidth === null || sourceHeight === null) {
      return;
    }
    const ctx = getMasterContext(canvas);
    const result = renderMasterCanvas(
      ctx,
      sourceImage,
      sourceWidth,
      sourceHeight,
      placement,
      background,
      palette,
      MASTER_CANVAS_SIZE,
    );
    optimizedBufferRef.current = result.masterBuffer;
    setPlacedRect(result.placedRect);
    setPaletteInfo(result.paletteInfo);
  }, [sourceImage, sourceWidth, sourceHeight, placement, background, palette, setPlacedRect, setPaletteInfo]);

  // Previews + validation follow the active buffer, re-running whenever the
  // optimizer output changes, the pixel buffer is edited, or the mode changes.
  useEffect(() => {
    refreshFromActiveBuffer();
  }, [refreshFromActiveBuffer, optimizerVersion, editVersion, mode]);

  // Keyboard shortcuts are active only while Pixel Edit is showing the
  // editable copy, and never while a form control has focus. Undo/redo bump
  // editVersion, which already re-runs previews and validation.
  useEffect(() => {
    if (!pixelEditActive) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      const action = resolveShortcut(event);
      if (!action) {
        return;
      }
      event.preventDefault();
      const editor = useEditorStore.getState();
      if (action.type === 'undo') {
        editor.undo();
      } else if (action.type === 'redo') {
        editor.redo();
      } else {
        editor.setTool(action.tool);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pixelEditActive]);

  const handleBake = useCallback(() => {
    const optimized = optimizedBufferRef.current;
    if (!optimized) {
      return;
    }
    bake(optimized, optimizerVersion);
    setMode('pixelEdit');
  }, [bake, optimizerVersion, setMode]);

  const handleExport = useCallback(async () => {
    // Exports resolve through the same selector as previews and validation.
    const { buffer: active, source } = selectActiveBuffer(mode, editBuffer, optimizedBufferRef.current);
    const canvas = canvasRef.current;
    if (source === 'none' || (source === 'optimized' && !canvas)) {
      // The button is disabled without an image; this guards direct calls.
      setAppError('Load an image before exporting.');
      return;
    }
    try {
      const blob =
        source === 'editable' && active
          ? await exportBufferAsPngBlob(active)
          : await exportCanvasAsPngBlob(canvas as HTMLCanvasElement);
      downloadBlob(blob, 'final_emblem.png');
      setAppError(null);
    } catch {
      setAppError('The PNG could not be created. Try exporting again.');
    }
  }, [mode, editBuffer, setAppError]);

  const handleSampleClick = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) {
        return;
      }
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      setBackground({ sampledColor: { r: pixel[0], g: pixel[1], b: pixel[2] } });
      setSampling(false);
    },
    [setBackground, setSampling],
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-900 text-neutral-100">
      <TopToolbar
        onExport={handleExport}
        exportDisabled={!hasImage}
        mode={mode}
        onModeChange={setMode}
        pixelEditAvailable={editBuffer !== null}
      />
      {appError && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-4 border-b border-red-800/60 bg-red-950/60 px-4 py-2 text-xs text-red-200"
        >
          <span>{appError}</span>
          <button
            type="button"
            onClick={() => setAppError(null)}
            aria-label="Dismiss error"
            className="rounded border border-red-700/60 px-2 py-0.5 text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          onUpload={handleUpload}
          sourceFileName={sourceFileName}
          sourceWidth={sourceWidth}
          sourceHeight={sourceHeight}
          onBake={handleBake}
          onBufferChanged={refreshFromActiveBuffer}
        />
        {pixelEditActive && (
          /* Panning scrolls this container; the canvas centres itself via
             m-auto so the top-left corner stays reachable at high zoom. */
          <div data-pixel-scroll className="flex flex-1 overflow-auto bg-neutral-950 p-4">
            <PixelEditCanvas onBufferChanged={refreshFromActiveBuffer} />
          </div>
        )}
        {/* The optimizer canvas is hidden — never unmounted — in Pixel Edit
            mode. Remounting would produce a blank canvas element that the
            pipeline effect (keyed on settings, not canvas identity) would
            not repaint, blanking the Optimize view and its export until a
            setting changed. */}
        <div className={pixelEditActive ? 'hidden' : 'contents'}>
          <CenterCanvas canvasRef={canvasRef} samplingActive={isSampling} onSampleClick={handleSampleClick} />
        </div>
        <RightPanel />
      </div>
      <PreviewBar previews={previews} hasImage={hasImage} />
    </div>
  );
}
