import { describe, expect, it } from 'vitest';
import { exportCanvasAsPngBlob } from './exportPng';

function stubCanvas(blob: Blob | null): HTMLCanvasElement {
  return {
    toBlob: (callback: (blob: Blob | null) => void) => callback(blob),
  } as unknown as HTMLCanvasElement;
}

describe('exportCanvasAsPngBlob', () => {
  it('resolves with the produced blob', async () => {
    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    await expect(exportCanvasAsPngBlob(stubCanvas(blob))).resolves.toBe(blob);
  });

  // Regression: toBlob may legitimately produce null (e.g. out of memory or a
  // zero-sized canvas). That must surface as a rejection callers can catch and
  // report — never as a silent download of nothing or an uncaught throw.
  it('rejects when toBlob produces null', async () => {
    await expect(exportCanvasAsPngBlob(stubCanvas(null))).rejects.toThrow();
  });
});
