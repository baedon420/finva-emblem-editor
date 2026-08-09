import { resizeNearestNeighbor } from './resizeImageData';

/**
 * Reads the full master canvas, downscales it with pure nearest-neighbor
 * point sampling, and paints the result onto an existing destination
 * canvas (resized to targetSize x targetSize). Used both for on-screen
 * live previews and, since the destination canvas holds real pixel data
 * afterward, directly for PNG export via exportCanvasAsPngBlob.
 */
export function renderPreviewToCanvas(
  masterCanvas: HTMLCanvasElement,
  destCanvas: HTMLCanvasElement,
  targetSize: number,
): void {
  const masterCtx = masterCanvas.getContext('2d');
  if (!masterCtx) {
    throw new Error('Failed to acquire 2D context for master canvas');
  }

  const sourceImageData = masterCtx.getImageData(0, 0, masterCanvas.width, masterCanvas.height);
  const resized = resizeNearestNeighbor(sourceImageData, targetSize, targetSize);

  destCanvas.width = targetSize;
  destCanvas.height = targetSize;
  const destCtx = destCanvas.getContext('2d');
  if (!destCtx) {
    throw new Error('Failed to acquire 2D context for preview canvas');
  }
  destCtx.imageSmoothingEnabled = false;
  destCtx.putImageData(new ImageData(resized.data, resized.width, resized.height), 0, 0);
}
