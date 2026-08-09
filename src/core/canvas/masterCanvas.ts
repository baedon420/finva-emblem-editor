export const MASTER_CANVAS_SIZE = 256;

export function createMasterCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = MASTER_CANVAS_SIZE;
  canvas.height = MASTER_CANVAS_SIZE;
  return canvas;
}

export function getMasterContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire 2D context for master canvas');
  }
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
