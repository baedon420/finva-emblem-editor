import type { MouseEvent, RefObject } from 'react';
import { MASTER_CANVAS_SIZE } from '../../core/canvas/masterCanvas';

interface CenterCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  samplingActive: boolean;
  onSampleClick: (canvasX: number, canvasY: number) => void;
}

const DISPLAY_SIZE = MASTER_CANVAS_SIZE * 2;

export default function CenterCanvas({ canvasRef, samplingActive, onSampleClick }: CenterCanvasProps) {
  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!samplingActive) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    const scaleX = MASTER_CANVAS_SIZE / bounds.width;
    const scaleY = MASTER_CANVAS_SIZE / bounds.height;
    const x = Math.min(MASTER_CANVAS_SIZE - 1, Math.max(0, Math.floor((event.clientX - bounds.left) * scaleX)));
    const y = Math.min(MASTER_CANVAS_SIZE - 1, Math.max(0, Math.floor((event.clientY - bounds.top) * scaleY)));
    onSampleClick(x, y);
  };

  return (
    // m-auto (not flex centring) keeps every edge reachable by scrolling when
    // the panel is narrower than the canvas — justify-center clips the start.
    <div className="flex flex-1 overflow-auto bg-neutral-950">
      <div className="checkerboard-bg m-auto" style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}>
        <canvas
          ref={canvasRef}
          width={MASTER_CANVAS_SIZE}
          height={MASTER_CANVAS_SIZE}
          onClick={handleClick}
          className={`border border-neutral-700 ${samplingActive ? 'cursor-crosshair' : ''}`}
          style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE, imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
}
