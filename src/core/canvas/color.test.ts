import { describe, expect, it } from 'vitest';
import { hexToRgb, rgbToHex } from './color';

describe('rgbToHex / hexToRgb', () => {
  it('round-trips RGB through hex', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 128 })).toBe('#ff0080');
    expect(hexToRgb('#ff0080')).toEqual({ r: 255, g: 0, b: 128 });
  });

  it('accepts hex input without a leading #', () => {
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('is case-insensitive', () => {
    expect(hexToRgb('#ABCDEF')).toEqual({ r: 0xab, g: 0xcd, b: 0xef });
  });

  it('returns null for malformed input', () => {
    expect(hexToRgb('not-a-color')).toBeNull();
    expect(hexToRgb('#fff')).toBeNull();
    expect(hexToRgb('#gggggg')).toBeNull();
  });
});
