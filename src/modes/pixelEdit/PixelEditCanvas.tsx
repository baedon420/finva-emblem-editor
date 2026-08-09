import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { MASTER_CANVAS_SIZE } from '../../core/canvas/masterCanvas';
import type { PixelBuffer } from '../../core/types';
import { MIN_GRID_ZOOM, useEditorStore } from '../../state/editorStore';
import { clampToBuffer, displayToBufferPoint } from './coordinates';
import { cloneBuffer, createEmptyBounds, getPixel, paintBrush, paintLine } from './drawing';
import type { Bounds } from './drawing';
import { floodFill } from './fillReplace';
import { createPatch } from './history';
import { isSpaceConsumingTarget, shouldStartPan } from './shortcuts';

interface PixelEditCanvasProps {
  /** Called after each committed stroke so previews/validation can refresh. */
  onBufferChanged: () => void;
}

interface PanState {
  scrollEl: HTMLElement;
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
}

/** Pointer capture is an enhancement (keeps drags alive outside the canvas) — never let it abort the gesture. */
function capturePointer(canvas: HTMLCanvasElement, pointerId: number): void {
  try {
    canvas.setPointerCapture(pointerId);
  } catch {
    // Invalid/synthetic pointer ids throw; the gesture still works uncaptured.
  }
}

export default function PixelEditCanvas({ onBufferChanged }: PixelEditCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokeRef = useRef<{ before: PixelBuffer; bounds: Bounds; lastX: number; lastY: number } | null>(null);
  const panRef = useRef<PanState | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const buffer = useEditorStore((state) => state.buffer);
  const editVersion = useEditorStore((state) => state.editVersion);
  const tool = useEditorStore((state) => state.tool);
  const color = useEditorStore((state) => state.color);
  const brushSize = useEditorStore((state) => state.brushSize);
  const zoom = useEditorStore((state) => state.zoom);
  const showGrid = useEditorStore((state) => state.showGrid);
  const commitPatch = useEditorStore((state) => state.commitPatch);
  const setColor = useEditorStore((state) => state.setColor);

  // Space arms panning while held. Never while typing in a form control, and
  // preventDefault stops the page itself from scrolling on Space.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isSpaceConsumingTarget(event.target)) {
        return;
      }
      event.preventDefault();
      setSpaceHeld(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setSpaceHeld(false);
      }
    };
    const handleWindowBlur = () => setSpaceHeld(false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  /** Repaints the display canvas from the buffer. The buffer is the source of truth. */
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(new ImageData(buffer.data, buffer.width, buffer.height), 0, 0);
  }, [buffer]);

  useEffect(() => {
    repaint();
  }, [repaint, editVersion]);

  const applyAt = useCallback(
    (x: number, y: number, fromX: number | null, fromY: number | null) => {
      const stroke = strokeRef.current;
      if (!buffer || !stroke) {
        return;
      }
      const paintColor = tool === 'eraser' ? null : color;
      if (fromX === null || fromY === null) {
        paintBrush(buffer, x, y, brushSize, paintColor, stroke.bounds);
      } else {
        // Interpolate between pointer samples so fast drags stay continuous.
        paintLine(buffer, fromX, fromY, x, y, brushSize, paintColor, stroke.bounds);
      }
      repaint();
    },
    [buffer, tool, color, brushSize, repaint],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !buffer) {
        return;
      }

      // Pan is decided before any drawing code runs, so panning can never
      // touch pixel data — regardless of the active tool.
      if (shouldStartPan(event.button, spaceHeld)) {
        event.preventDefault(); // suppress middle-click autoscroll
        const scrollEl = canvas.closest('[data-pixel-scroll]');
        if (scrollEl instanceof HTMLElement) {
          capturePointer(canvas, event.pointerId);
          panRef.current = {
            scrollEl,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startScrollLeft: scrollEl.scrollLeft,
            startScrollTop: scrollEl.scrollTop,
          };
          setIsPanning(true);
        }
        return;
      }

      if (event.button !== 0) {
        return; // only the left button draws
      }

      const point = displayToBufferPoint(
        event.clientX,
        event.clientY,
        canvas.getBoundingClientRect(),
        buffer.width,
        buffer.height,
      );
      if (!point) {
        return;
      }

      if (tool === 'eyedropper') {
        const sampled = getPixel(buffer, point.x, point.y);
        if (sampled && sampled.a > 0) {
          setColor({ r: sampled.r, g: sampled.g, b: sampled.b });
        }
        return;
      }

      if (tool === 'fill') {
        // One click = one atomic fill = one undo step. A fill that changes
        // nothing leaves empty bounds, so no history entry is created.
        const before = cloneBuffer(buffer);
        const bounds = createEmptyBounds();
        const changed = floodFill(buffer, point.x, point.y, color, bounds);
        if (changed === 0) {
          return;
        }
        repaint();
        const patch = createPatch(before, buffer, bounds);
        if (patch) {
          commitPatch(patch);
          onBufferChanged();
        }
        return;
      }

      capturePointer(canvas, event.pointerId);
      strokeRef.current = {
        before: cloneBuffer(buffer),
        bounds: createEmptyBounds(),
        lastX: point.x,
        lastY: point.y,
      };
      applyAt(point.x, point.y, null, null);
    },
    [buffer, tool, color, spaceHeld, setColor, applyAt, repaint, commitPatch, onBufferChanged],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const pan = panRef.current;
      if (pan) {
        // Drag right = content follows the pointer = scroll left.
        pan.scrollEl.scrollLeft = pan.startScrollLeft - (event.clientX - pan.startClientX);
        pan.scrollEl.scrollTop = pan.startScrollTop - (event.clientY - pan.startClientY);
        return;
      }
      const canvas = canvasRef.current;
      const stroke = strokeRef.current;
      if (!canvas || !buffer || !stroke) {
        return;
      }
      // Clamped rather than rejected, so dragging beyond an edge keeps painting
      // along that edge instead of silently dropping the segment.
      const point = clampToBuffer(
        event.clientX,
        event.clientY,
        canvas.getBoundingClientRect(),
        buffer.width,
        buffer.height,
      );
      if (point.x === stroke.lastX && point.y === stroke.lastY) {
        return;
      }
      applyAt(point.x, point.y, stroke.lastX, stroke.lastY);
      stroke.lastX = point.x;
      stroke.lastY = point.y;
    },
    [buffer, applyAt],
  );

  const handlePointerEnd = useCallback(() => {
    if (panRef.current) {
      panRef.current = null;
      setIsPanning(false);
      return;
    }
    const stroke = strokeRef.current;
    strokeRef.current = null;
    if (!stroke || !buffer) {
      return;
    }
    // One drag = one patch = one undo step.
    const patch = createPatch(stroke.before, buffer, stroke.bounds);
    if (patch) {
      commitPatch(patch);
      onBufferChanged();
    }
  }, [buffer, commitPatch, onBufferChanged]);

  if (!buffer) {
    return null;
  }

  const displaySize = MASTER_CANVAS_SIZE * zoom;
  const gridVisible = showGrid && zoom >= MIN_GRID_ZOOM;
  const cursorClass = isPanning ? 'cursor-grabbing' : spaceHeld ? 'cursor-grab' : 'cursor-crosshair';

  return (
    // m-auto centres the canvas when it fits and keeps the top-left corner
    // reachable when zoomed past the viewport (flex centring would clip it).
    <div className="relative m-auto" style={{ width: displaySize, height: displaySize }}>
      <div className="checkerboard-bg absolute inset-0" />
      <canvas
        ref={canvasRef}
        width={MASTER_CANVAS_SIZE}
        height={MASTER_CANVAS_SIZE}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={`absolute inset-0 touch-none ${cursorClass}`}
        style={{ width: displaySize, height: displaySize, imageRendering: 'pixelated' }}
      />
      {gridVisible && (
        // Pure CSS overlay: never touches the pixel buffer, so it cannot leak
        // into previews or exports.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px),' +
              'linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)',
            backgroundSize: `${zoom}px ${zoom}px`,
          }}
        />
      )}
    </div>
  );
}
