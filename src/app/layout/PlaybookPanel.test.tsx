// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from '../../state/projectStore';
import PlaybookPanel, { RECIPES } from './PlaybookPanel';

afterEach(cleanup);

function loadFakeImage(): void {
  useProjectStore.getState().setImportedImage({
    fileName: 'test.png',
    width: 1200,
    height: 900,
    // The store only holds the element reference; nothing dereferences it in these tests.
    image: {} as HTMLImageElement,
  });
}

describe('PlaybookPanel', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('disables Apply until an image is loaded', () => {
    render(<PlaybookPanel />);
    const button = screen.getByRole('button', { name: 'Apply Recipe' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('applying the photo recipe sets adjustments, palette, and fill mode', () => {
    loadFakeImage();
    render(<PlaybookPanel />);
    fireEvent.change(screen.getByLabelText('Image type'), { target: { value: 'photo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Recipe' }));

    const state = useProjectStore.getState();
    expect(state.adjustments).toEqual({ autoLevels: true, brightness: 0, contrast: 35, saturation: 25 });
    expect(state.palette).toEqual({ mode: 'reduced', targetColors: 8 });
    expect(state.placement.mode).toBe('fill');
  });

  it('applying the pixel art recipe neutralizes adjustments and forces pixelated scaling', () => {
    loadFakeImage();
    render(<PlaybookPanel />);
    fireEvent.change(screen.getByLabelText('Image type'), { target: { value: 'pixel-art' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Recipe' }));

    const state = useProjectStore.getState();
    expect(state.adjustments).toEqual({ autoLevels: false, brightness: 0, contrast: 0, saturation: 0 });
    expect(state.palette.mode).toBe('original');
    expect(state.placement.scaleFilter).toBe('pixelated');
  });

  it('selecting a recipe shows its manual steps', () => {
    render(<PlaybookPanel />);
    fireEvent.change(screen.getByLabelText('Image type'), { target: { value: 'vintage' } });
    const vintage = RECIPES.find((r) => r.id === 'vintage');
    expect(vintage).toBeDefined();
    for (const step of vintage!.steps) {
      expect(screen.getByText(step)).toBeTruthy();
    }
  });

  it('every recipe applies cleanly and lands within store clamps', () => {
    loadFakeImage();
    for (const recipe of RECIPES) {
      render(<PlaybookPanel />);
      fireEvent.change(screen.getByLabelText('Image type'), { target: { value: recipe.id } });
      fireEvent.click(screen.getByRole('button', { name: 'Apply Recipe' }));

      const state = useProjectStore.getState();
      expect(state.adjustments).toEqual(recipe.apply.adjustments);
      expect(state.palette.mode).toBe(recipe.apply.palette.mode);
      cleanup();
    }
  });
});
