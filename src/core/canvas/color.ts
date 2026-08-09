import type { RGBColor } from '../types';

export function rgbToHex({ r, g, b }: RGBColor): string {
  const toHex = (channel: number) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;

/** Returns null for anything that isn't a well-formed 6-digit hex color, so callers can ignore invalid input. */
export function hexToRgb(hex: string): RGBColor | null {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match) {
    return null;
  }
  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}
