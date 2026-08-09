import type { PixelBuffer } from '../types';

/**
 * Encodes a raw pixel buffer to PNG via a detached canvas. Used for exporting
 * the Pixel Edit buffer, so export never depends on what a display canvas
 * happens to be showing (zoom, grid overlay, etc.).
 */
export function exportBufferAsPngBlob(buffer: PixelBuffer): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = buffer.width;
  canvas.height = buffer.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('Failed to acquire 2D context for export'));
  }
  ctx.imageSmoothingEnabled = false;
  ctx.putImageData(new ImageData(buffer.data, buffer.width, buffer.height), 0, 0);
  return exportCanvasAsPngBlob(canvas);
}

export function exportCanvasAsPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to export canvas as PNG'));
      }
    }, 'image/png');
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
