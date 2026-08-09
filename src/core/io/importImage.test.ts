import { describe, expect, it } from 'vitest';
import { SUPPORTED_IMAGE_TYPES, validateImageFile } from './importImage';

describe('validateImageFile', () => {
  it('accepts every supported image type', () => {
    for (const type of SUPPORTED_IMAGE_TYPES) {
      expect(validateImageFile({ name: 'a', type, size: 100 })).toBeNull();
    }
  });

  it('rejects empty files with a user-facing message', () => {
    const message = validateImageFile({ name: 'empty.png', type: 'image/png', size: 0 });
    expect(message).toMatch(/empty/i);
  });

  it('rejects unsupported types with a message naming the supported ones', () => {
    for (const type of ['text/plain', 'application/pdf', 'image/tiff', 'image/svg+xml', '']) {
      const message = validateImageFile({ name: 'file', type, size: 100 });
      expect(message).toMatch(/PNG, JPEG, GIF, or WebP/);
    }
  });

  it('never returns technical jargon', () => {
    const message = validateImageFile({ name: 'x.bin', type: 'application/octet-stream', size: 5 });
    expect(message).not.toMatch(/error|exception|null|undefined|failed/i);
  });
});
