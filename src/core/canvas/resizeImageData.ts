import type { PixelBuffer } from '../types';

/**
 * Pure nearest-neighbor point-sampling resize over a raw pixel buffer.
 *
 * This intentionally does not use `CanvasRenderingContext2D.drawImage`
 * (even with `imageSmoothingEnabled = false`) so the sampling behavior is
 * guaranteed and independent of any per-browser drawImage minification
 * quirks. Each destination pixel takes the color of exactly one source
 * pixel — never an average or blend of neighbors.
 */
export function resizeNearestNeighbor(
  source: PixelBuffer,
  targetWidth: number,
  targetHeight: number,
): PixelBuffer {
  const { data: srcData, width: srcWidth, height: srcHeight } = source;
  const destData = new Uint8ClampedArray(new ArrayBuffer(targetWidth * targetHeight * 4));

  for (let destY = 0; destY < targetHeight; destY++) {
    const srcY = Math.min(srcHeight - 1, Math.floor((destY * srcHeight) / targetHeight));
    for (let destX = 0; destX < targetWidth; destX++) {
      const srcX = Math.min(srcWidth - 1, Math.floor((destX * srcWidth) / targetWidth));
      const srcIndex = (srcY * srcWidth + srcX) * 4;
      const destIndex = (destY * targetWidth + destX) * 4;
      destData[destIndex] = srcData[srcIndex];
      destData[destIndex + 1] = srcData[srcIndex + 1];
      destData[destIndex + 2] = srcData[srcIndex + 2];
      destData[destIndex + 3] = srcData[srcIndex + 3];
    }
  }

  return { data: destData, width: targetWidth, height: targetHeight };
}
