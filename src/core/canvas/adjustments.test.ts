import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADJUSTMENT_SETTINGS,
  applyAdjustments,
  clampAdjustment,
  isNeutralAdjustments,
} from './adjustments';
import type { AdjustmentSettings } from './adjustments';
import type { PixelBuffer } from '../types';

/** Builds a width x 1 buffer from [r, g, b, a] tuples. */
function makeBuffer(pixels: Array<[number, number, number, number]>): PixelBuffer {
  const data = new Uint8ClampedArray(new ArrayBuffer(pixels.length * 4));
  pixels.forEach(([r, g, b, a], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  });
  return { data, width: pixels.length, height: 1 };
}

function settingsWith(overrides: Partial<AdjustmentSettings>): AdjustmentSettings {
  return { ...DEFAULT_ADJUSTMENT_SETTINGS, ...overrides };
}

function pixelAt(buffer: PixelBuffer, index: number): [number, number, number, number] {
  const p = index * 4;
  return [buffer.data[p], buffer.data[p + 1], buffer.data[p + 2], buffer.data[p + 3]];
}

describe('clampAdjustment', () => {
  it('clamps and rounds to the -100..100 range', () => {
    expect(clampAdjustment(-250)).toBe(-100);
    expect(clampAdjustment(250)).toBe(100);
    expect(clampAdjustment(12.6)).toBe(13);
    expect(clampAdjustment(0)).toBe(0);
  });
});

describe('isNeutralAdjustments', () => {
  it('is true only when every field is at its neutral value', () => {
    expect(isNeutralAdjustments(DEFAULT_ADJUSTMENT_SETTINGS)).toBe(true);
    expect(isNeutralAdjustments(settingsWith({ autoLevels: true }))).toBe(false);
    expect(isNeutralAdjustments(settingsWith({ brightness: 1 }))).toBe(false);
    expect(isNeutralAdjustments(settingsWith({ contrast: -1 }))).toBe(false);
    expect(isNeutralAdjustments(settingsWith({ saturation: 5 }))).toBe(false);
  });
});

describe('applyAdjustments', () => {
  it('returns the exact same buffer reference for neutral settings', () => {
    const buffer = makeBuffer([[10, 20, 30, 255]]);
    expect(applyAdjustments(buffer, DEFAULT_ADJUSTMENT_SETTINGS)).toBe(buffer);
  });

  it('never touches fully transparent pixels, including their RGB bytes', () => {
    const buffer = makeBuffer([
      [7, 8, 9, 0],
      [100, 100, 100, 255],
    ]);
    const result = applyAdjustments(buffer, settingsWith({ brightness: 100 }));
    expect(result).not.toBe(buffer);
    expect(pixelAt(result, 0)).toEqual([7, 8, 9, 0]);
  });

  it('preserves partial alpha exactly while adjusting the color', () => {
    const buffer = makeBuffer([[100, 100, 100, 128]]);
    const result = applyAdjustments(buffer, settingsWith({ brightness: 50 }));
    const [, , , a] = pixelAt(result, 0);
    expect(a).toBe(128);
    expect(result.data[0]).toBeGreaterThan(100);
  });

  it('brightness raises and lowers values by a flat offset', () => {
    const buffer = makeBuffer([[100, 100, 100, 255]]);
    const brighter = applyAdjustments(buffer, settingsWith({ brightness: 100 }));
    expect(brighter.data[0]).toBeGreaterThanOrEqual(227);
    const darker = applyAdjustments(buffer, settingsWith({ brightness: -100 }));
    expect(darker.data[0]).toBe(0);
  });

  it('maximum contrast pushes midtones out to pure black and white', () => {
    const buffer = makeBuffer([
      [100, 100, 100, 255],
      [150, 150, 150, 255],
    ]);
    const result = applyAdjustments(buffer, settingsWith({ contrast: 100 }));
    expect(pixelAt(result, 0)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(result, 1)).toEqual([255, 255, 255, 255]);
  });

  it('saturation -100 produces exact greyscale (r = g = b)', () => {
    const buffer = makeBuffer([[200, 50, 50, 255]]);
    const result = applyAdjustments(buffer, settingsWith({ saturation: -100 }));
    const [r, g, b] = pixelAt(result, 0);
    expect(r).toBe(g);
    expect(g).toBe(b);
    // Rec. 709 luminance of (200, 50, 50) is ~81.9.
    expect(r).toBe(82);
  });

  it('positive saturation moves channels away from grey', () => {
    const buffer = makeBuffer([[180, 80, 80, 255]]);
    const result = applyAdjustments(buffer, settingsWith({ saturation: 60 }));
    const [r, , b] = pixelAt(result, 0);
    expect(r).toBeGreaterThan(180);
    expect(b).toBeLessThan(80);
  });

  it('auto-levels stretches a narrow tonal range to full black-to-white', () => {
    const buffer = makeBuffer([
      [100, 100, 100, 255],
      [150, 150, 150, 255],
    ]);
    const result = applyAdjustments(buffer, settingsWith({ autoLevels: true }));
    expect(pixelAt(result, 0)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(result, 1)).toEqual([255, 255, 255, 255]);
  });

  it('auto-levels on a flat single-tone image is a no-op rather than a blow-out', () => {
    const buffer = makeBuffer([
      [120, 120, 120, 255],
      [120, 120, 120, 255],
    ]);
    const result = applyAdjustments(buffer, settingsWith({ autoLevels: true }));
    expect(pixelAt(result, 0)).toEqual([120, 120, 120, 255]);
  });

  it('auto-levels ignores transparent pixels when measuring the range', () => {
    const buffer = makeBuffer([
      [0, 0, 0, 0], // transparent pure black must not anchor the low end
      [100, 100, 100, 255],
      [150, 150, 150, 255],
    ]);
    const result = applyAdjustments(buffer, settingsWith({ autoLevels: true }));
    expect(pixelAt(result, 1)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(result, 2)).toEqual([255, 255, 255, 255]);
  });

  it('is deterministic: identical input and settings produce identical output', () => {
    const pixels: Array<[number, number, number, number]> = [
      [12, 200, 90, 255],
      [240, 3, 77, 128],
      [0, 0, 0, 0],
    ];
    const settings = settingsWith({ autoLevels: true, brightness: 10, contrast: 25, saturation: 40 });
    const a = applyAdjustments(makeBuffer(pixels), settings);
    const b = applyAdjustments(makeBuffer(pixels), settings);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });
});
