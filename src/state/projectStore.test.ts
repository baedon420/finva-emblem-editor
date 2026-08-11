import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore as appErrorStore } from './projectStore';

describe('projectStore — app error lifecycle', () => {
  beforeEach(() => {
    appErrorStore.getState().reset();
  });

  it('stores and clears an error message', () => {
    appErrorStore.getState().setAppError('Something went wrong.');
    expect(appErrorStore.getState().appError).toBe('Something went wrong.');
    appErrorStore.getState().setAppError(null);
    expect(appErrorStore.getState().appError).toBeNull();
  });

  // Regression: after a failed import, a successful retry must clear the old
  // error rather than leaving it on screen next to a healthy image.
  it('a successful import clears any earlier error', () => {
    appErrorStore.getState().setAppError('That file type is not supported.');
    appErrorStore.getState().setImportedImage({
      fileName: 'ok.png',
      width: 10,
      height: 10,
      image: {} as HTMLImageElement,
    });
    expect(appErrorStore.getState().appError).toBeNull();
    expect(appErrorStore.getState().hasImage).toBe(true);
  });

  it('reset clears the error', () => {
    appErrorStore.getState().setAppError('boom');
    appErrorStore.getState().reset();
    expect(appErrorStore.getState().appError).toBeNull();
  });
});
import { DEFAULT_BACKGROUND_SETTINGS } from '../core/canvas/background';
import { DEFAULT_PALETTE_SETTINGS, MAX_PALETTE_COLORS, MIN_PALETTE_COLORS } from '../core/canvas/palette';
import { useProjectStore } from './projectStore';

describe('projectStore — Fill-mode zoom floor on mode switch', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('clamps zoom to 1x when switching from Fit at 0.25x to Fill', () => {
    useProjectStore.getState().setPlacement({ mode: 'contain', zoom: 0.25 });
    expect(useProjectStore.getState().placement.mode).toBe('contain');
    expect(useProjectStore.getState().placement.zoom).toBe(0.25);

    useProjectStore.getState().setPlacement({ mode: 'fill' });
    expect(useProjectStore.getState().placement.mode).toBe('fill');
    expect(useProjectStore.getState().placement.zoom).toBe(1);
  });

  it('still allows zoom down to 0.25x while Fit is active', () => {
    useProjectStore.getState().setPlacement({ mode: 'contain', zoom: 0.25 });
    expect(useProjectStore.getState().placement.zoom).toBe(0.25);
  });

  it('rejects a zoom update below 1x while already in Fill mode', () => {
    useProjectStore.getState().setPlacement({ mode: 'fill' });
    useProjectStore.getState().setPlacement({ zoom: 0.3 });
    expect(useProjectStore.getState().placement.zoom).toBe(1);
  });

  it('switching back from Fill to Fit does not force zoom back down — it stays at its current value', () => {
    useProjectStore.getState().setPlacement({ mode: 'fill', zoom: 2 });
    useProjectStore.getState().setPlacement({ mode: 'contain' });
    expect(useProjectStore.getState().placement.zoom).toBe(2);
  });
});

describe('projectStore — Reset restores exact initial placement', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('restores Fit mode, zoom 1x, offsets 0, and padding 0 after arbitrary customization', () => {
    useProjectStore.getState().setPlacement({
      mode: 'fill',
      scaleFilter: 'pixelated',
      zoom: 2.5,
      offsetX: 30,
      offsetY: -20,
      padding: 10,
    });

    useProjectStore.getState().resetPlacement();

    expect(useProjectStore.getState().placement).toEqual({
      mode: 'contain',
      scaleFilter: 'auto',
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      padding: 0,
    });
  });
});

describe('projectStore — Background settings', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('defaults to Preserve mode with no sampled color', () => {
    expect(useProjectStore.getState().background).toEqual(DEFAULT_BACKGROUND_SETTINGS);
  });

  it('resetBackground restores Preserve, no sampled color, default tolerance, default replace color', () => {
    useProjectStore.getState().setBackground({
      mode: 'replace',
      sampledColor: { r: 10, g: 20, b: 30 },
      tolerance: 80,
      replaceColor: { r: 1, g: 2, b: 3 },
    });
    expect(useProjectStore.getState().background.mode).toBe('replace');

    useProjectStore.getState().resetBackground();

    expect(useProjectStore.getState().background).toEqual(DEFAULT_BACKGROUND_SETTINGS);
  });

  it('clamps tolerance updates to 0-100', () => {
    useProjectStore.getState().setBackground({ tolerance: 500 });
    expect(useProjectStore.getState().background.tolerance).toBe(100);

    useProjectStore.getState().setBackground({ tolerance: -50 });
    expect(useProjectStore.getState().background.tolerance).toBe(0);
  });

  it('setSampling toggles sampling mode without touching background settings', () => {
    useProjectStore.getState().setSampling(true);
    expect(useProjectStore.getState().isSampling).toBe(true);
    expect(useProjectStore.getState().background).toEqual(DEFAULT_BACKGROUND_SETTINGS);

    useProjectStore.getState().setSampling(false);
    expect(useProjectStore.getState().isSampling).toBe(false);
  });

  it('a fresh image import resets background settings to defaults', () => {
    useProjectStore.getState().setBackground({ mode: 'replace', sampledColor: { r: 1, g: 2, b: 3 } });
    const fakeImage = {} as HTMLImageElement;
    useProjectStore.getState().setImportedImage({ fileName: 'a.png', width: 10, height: 10, image: fakeImage });
    expect(useProjectStore.getState().background).toEqual(DEFAULT_BACKGROUND_SETTINGS);
  });
});

describe('projectStore — Palette settings', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('defaults to Original Colors with a target of 16', () => {
    expect(useProjectStore.getState().palette).toEqual(DEFAULT_PALETTE_SETTINGS);
    expect(useProjectStore.getState().palette.targetColors).toBe(16);
  });

  it('resetPalette restores Original Colors and target 16 after customization', () => {
    useProjectStore.getState().setPalette({ mode: 'reduced', targetColors: 4 });
    expect(useProjectStore.getState().palette.mode).toBe('reduced');

    useProjectStore.getState().resetPalette();

    expect(useProjectStore.getState().palette).toEqual(DEFAULT_PALETTE_SETTINGS);
  });

  it('clamps target color updates to the 2-32 range', () => {
    useProjectStore.getState().setPalette({ targetColors: 1000 });
    expect(useProjectStore.getState().palette.targetColors).toBe(MAX_PALETTE_COLORS);

    useProjectStore.getState().setPalette({ targetColors: 0 });
    expect(useProjectStore.getState().palette.targetColors).toBe(MIN_PALETTE_COLORS);
  });

  it('a fresh image import clears any previous validation report', () => {
    useProjectStore.getState().setValidation({ status: 'ready', technical: [], heuristic: [] });
    expect(useProjectStore.getState().validation).not.toBeNull();

    const fakeImage = {} as HTMLImageElement;
    useProjectStore.getState().setImportedImage({ fileName: 'a.png', width: 10, height: 10, image: fakeImage });
    expect(useProjectStore.getState().validation).toBeNull();
  });

  it('stores a validation report for the UI to render without reformatting it', () => {
    const report = {
      status: 'ready-with-warnings' as const,
      technical: [{ id: 't', label: 'T', kind: 'technical' as const, status: 'pass' as const }],
      heuristic: [{ id: 'h', label: 'H', kind: 'heuristic' as const, status: 'warning' as const }],
    };
    useProjectStore.getState().setValidation(report);
    expect(useProjectStore.getState().validation).toEqual(report);
  });

  it('a fresh image import resets palette settings and palette info to defaults', () => {
    useProjectStore.getState().setPalette({ mode: 'reduced', targetColors: 4 });
    useProjectStore.getState().setPaletteInfo({
      palette: [{ r: 1, g: 2, b: 3 }],
      originalVisibleColorCount: 5,
      resultVisibleColorCount: 1,
    });
    const fakeImage = {} as HTMLImageElement;
    useProjectStore.getState().setImportedImage({ fileName: 'a.png', width: 10, height: 10, image: fakeImage });
    expect(useProjectStore.getState().palette).toEqual(DEFAULT_PALETTE_SETTINGS);
    expect(useProjectStore.getState().paletteInfo).toEqual({
      palette: [],
      originalVisibleColorCount: 0,
      resultVisibleColorCount: 0,
    });
  });
});
