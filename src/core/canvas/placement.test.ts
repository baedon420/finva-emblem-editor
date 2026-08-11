import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLACEMENT_SETTINGS,
  FILL_MIN_ZOOM,
  MAX_OFFSET,
  MAX_ZOOM,
  MIN_ZOOM,
  clampOffset,
  clampPadding,
  clampZoom,
  computePlacement,
  getMinZoomForMode,
  resolveScaleFilter,
} from './placement';
import type { PlacementSettings } from './placement';

const TARGET = 256;

function settings(overrides: Partial<PlacementSettings> = {}): PlacementSettings {
  return { ...DEFAULT_PLACEMENT_SETTINGS, ...overrides };
}

describe('computePlacement — contain (Fit) mode', () => {
  it('places a square image edge-to-edge with no padding', () => {
    expect(computePlacement(256, 256, settings(), TARGET)).toEqual({ x: 0, y: 0, width: 256, height: 256 });
  });

  it('centers a landscape image with vertical letterboxing, no cropping', () => {
    const rect = computePlacement(400, 200, settings(), TARGET);
    expect(rect).toEqual({ x: 0, y: 64, width: 256, height: 128 });
  });

  it('centers a portrait image with horizontal letterboxing, no cropping', () => {
    const rect = computePlacement(200, 400, settings(), TARGET);
    expect(rect).toEqual({ x: 64, y: 0, width: 128, height: 256 });
  });

  it('upscales a small source image to fill the canvas', () => {
    expect(computePlacement(32, 32, settings(), TARGET)).toEqual({ x: 0, y: 0, width: 256, height: 256 });
  });

  it('never crops in contain mode — the full image always fits within canvas bounds', () => {
    const rect = computePlacement(1000, 300, settings(), TARGET);
    expect(rect.width).toBeLessThanOrEqual(TARGET);
    expect(rect.height).toBeLessThanOrEqual(TARGET);
  });
});

describe('computePlacement — fill (crop-to-fill) mode', () => {
  it('fills a square target completely for a square image', () => {
    expect(computePlacement(256, 256, settings({ mode: 'fill' }), TARGET)).toEqual({
      x: 0,
      y: 0,
      width: 256,
      height: 256,
    });
  });

  it('overflows horizontally for a landscape image while covering the full height', () => {
    const rect = computePlacement(400, 200, settings({ mode: 'fill' }), TARGET);
    expect(rect).toEqual({ x: -128, y: 0, width: 512, height: 256 });
  });

  it('overflows vertically for a portrait image while covering the full width', () => {
    const rect = computePlacement(200, 400, settings({ mode: 'fill' }), TARGET);
    expect(rect).toEqual({ x: 0, y: -128, width: 256, height: 512 });
  });

  it('at default zoom, always covers the full canvas on both axes (no gaps)', () => {
    const rect = computePlacement(37, 511, settings({ mode: 'fill' }), TARGET);
    expect(rect.width).toBeGreaterThanOrEqual(TARGET);
    expect(rect.height).toBeGreaterThanOrEqual(TARGET);
  });
});

describe('computePlacement — Fill mode never exposes empty space in its active target area', () => {
  const permittedFillZooms = [FILL_MIN_ZOOM, 1.5, 2, 3, MAX_ZOOM];
  const sources = [
    { label: 'square', w: 512, h: 512 },
    { label: 'landscape', w: 800, h: 450 },
    { label: 'portrait', w: 450, h: 800 },
  ];
  const cases = sources.flatMap(({ label, w, h }) => permittedFillZooms.map((zoom) => ({ label, w, h, zoom })));

  it.each(cases)(
    '$label source at zoom $zoom x fully covers the active target area (no padding)',
    ({ w, h, zoom }) => {
      const rect = computePlacement(w, h, settings({ mode: 'fill', zoom }), TARGET);
      expect(rect.width).toBeGreaterThanOrEqual(TARGET);
      expect(rect.height).toBeGreaterThanOrEqual(TARGET);
    },
  );

  it.each(sources)(
    '$label source at every permitted Fill zoom fully covers the active (padded) target area',
    ({ w, h }) => {
      const padding = 16;
      const activeTarget = TARGET - padding * 2;
      for (const zoom of permittedFillZooms) {
        const rect = computePlacement(w, h, settings({ mode: 'fill', zoom, padding }), TARGET);
        expect(rect.width).toBeGreaterThanOrEqual(activeTarget);
        expect(rect.height).toBeGreaterThanOrEqual(activeTarget);
      }
    },
  );

  it('clamps Fill-mode zoom to 1x internally — a zoom below 1x cannot reach computePlacement', () => {
    const belowFloor = computePlacement(400, 200, settings({ mode: 'fill', zoom: 0.25 }), TARGET);
    const atFloor = computePlacement(400, 200, settings({ mode: 'fill', zoom: 1 }), TARGET);
    expect(belowFloor).toEqual(atFloor);
  });

  it('Fit mode is unaffected — it still permits zoom down to 0.25x', () => {
    const rect = computePlacement(256, 256, settings({ mode: 'contain', zoom: MIN_ZOOM }), TARGET);
    expect(rect.width).toBe(64);
    expect(rect.height).toBe(64);
  });

  it('getMinZoomForMode returns 1x for Fill and MIN_ZOOM for Fit', () => {
    expect(getMinZoomForMode('fill')).toBe(FILL_MIN_ZOOM);
    expect(getMinZoomForMode('contain')).toBe(MIN_ZOOM);
  });

  it('clampZoom floors at 1x for Fill mode regardless of how low a value is requested', () => {
    expect(clampZoom(0, 'fill')).toBe(FILL_MIN_ZOOM);
    expect(clampZoom(0.25, 'fill')).toBe(FILL_MIN_ZOOM);
    expect(clampZoom(-100, 'fill')).toBe(FILL_MIN_ZOOM);
  });

  it('clampZoom still floors at MIN_ZOOM for Fit mode', () => {
    expect(clampZoom(0, 'contain')).toBe(MIN_ZOOM);
  });
});

describe('computePlacement — zoom', () => {
  it('scales the placed rect proportionally with zoom', () => {
    const base = computePlacement(256, 256, settings({ zoom: 1 }), TARGET);
    const zoomed = computePlacement(256, 256, settings({ zoom: 2 }), TARGET);
    expect(zoomed.width).toBe(base.width * 2);
    expect(zoomed.height).toBe(base.height * 2);
  });

  it('clamps zoom values above the configured maximum', () => {
    expect(clampZoom(MAX_ZOOM + 10)).toBe(MAX_ZOOM);
  });

  it('clamps zoom values below the configured minimum', () => {
    expect(clampZoom(MIN_ZOOM - 10)).toBe(MIN_ZOOM);
  });

  it('clamps invalid/zero/negative zoom internally so callers cannot collapse the placement', () => {
    const rect = computePlacement(256, 256, settings({ zoom: 0 }), TARGET);
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);

    const negative = computePlacement(256, 256, settings({ zoom: -5 }), TARGET);
    expect(negative.width).toBeGreaterThan(0);
    expect(negative.height).toBeGreaterThan(0);
  });
});

describe('computePlacement — manual positioning', () => {
  it('shifts the placed rect by offsetX/offsetY from the centered position', () => {
    const centered = computePlacement(256, 256, settings(), TARGET);
    const shifted = computePlacement(256, 256, settings({ offsetX: 20, offsetY: -10 }), TARGET);
    expect(shifted.x).toBe(centered.x + 20);
    expect(shifted.y).toBe(centered.y - 10);
  });

  it('clamps extreme offsets to the defensive bound', () => {
    expect(clampOffset(MAX_OFFSET + 1000)).toBe(MAX_OFFSET);
    expect(clampOffset(-MAX_OFFSET - 1000)).toBe(-MAX_OFFSET);
  });
});

describe('computePlacement — safe padding', () => {
  it('shrinks the fitted area inward from the canvas edges', () => {
    const rect = computePlacement(256, 256, settings({ padding: 16 }), TARGET);
    expect(rect).toEqual({ x: 16, y: 16, width: 224, height: 224 });
  });

  it('never collapses to an invalid size even with padding requested near/above the canvas size', () => {
    expect(clampPadding(10000)).toBeLessThan(TARGET / 2);
    const rect = computePlacement(256, 256, settings({ padding: 10000 }), TARGET);
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
  });
});

describe('computePlacement — reset behavior', () => {
  it('DEFAULT_PLACEMENT_SETTINGS reproduces the exact initial contain-fit placement on re-application', () => {
    const initial = computePlacement(640, 480, DEFAULT_PLACEMENT_SETTINGS, TARGET);
    const afterReset = computePlacement(640, 480, { ...DEFAULT_PLACEMENT_SETTINGS }, TARGET);
    expect(afterReset).toEqual(initial);
  });

  it('resetting after custom zoom/offset/mode/padding returns to the same rect as a fresh image', () => {
    const fresh = computePlacement(640, 480, DEFAULT_PLACEMENT_SETTINGS, TARGET);
    const customized = settings({ mode: 'fill', zoom: 2.5, offsetX: 40, offsetY: -30, padding: 12 });
    computePlacement(640, 480, customized, TARGET); // simulate a customized render happening first
    const reset = computePlacement(640, 480, { ...DEFAULT_PLACEMENT_SETTINGS }, TARGET);
    expect(reset).toEqual(fresh);
  });
});

describe('resolveScaleFilter', () => {
  it('auto resolves to smooth when the placed rect shrinks the source on either axis', () => {
    expect(resolveScaleFilter('auto', 1500, 1500, { x: 0, y: 0, width: 256, height: 256 })).toBe('smooth');
    expect(resolveScaleFilter('auto', 300, 100, { x: 0, y: 0, width: 256, height: 85 })).toBe('smooth');
  });

  it('auto resolves to pixelated for upscales and exact 1:1 draws', () => {
    expect(resolveScaleFilter('auto', 32, 32, { x: 0, y: 0, width: 256, height: 256 })).toBe('pixelated');
    expect(resolveScaleFilter('auto', 256, 256, { x: 0, y: 0, width: 256, height: 256 })).toBe('pixelated');
  });

  it('explicit smooth and pixelated always override the geometry heuristic', () => {
    expect(resolveScaleFilter('smooth', 32, 32, { x: 0, y: 0, width: 256, height: 256 })).toBe('smooth');
    expect(resolveScaleFilter('pixelated', 1500, 1500, { x: 0, y: 0, width: 256, height: 256 })).toBe('pixelated');
  });
});

describe('computePlacement — representative landscape/portrait/square inputs', () => {
  const cases: Array<[string, number, number]> = [
    ['square', 512, 512],
    ['landscape', 800, 450],
    ['portrait', 450, 800],
  ];

  it.each(cases)('%s image always produces a positive-size rect in both Fit and Fill', (_label, w, h) => {
    const fit = computePlacement(w, h, settings({ mode: 'contain' }), TARGET);
    const fill = computePlacement(w, h, settings({ mode: 'fill' }), TARGET);
    expect(fit.width).toBeGreaterThan(0);
    expect(fit.height).toBeGreaterThan(0);
    expect(fill.width).toBeGreaterThan(0);
    expect(fill.height).toBeGreaterThan(0);
  });
});
