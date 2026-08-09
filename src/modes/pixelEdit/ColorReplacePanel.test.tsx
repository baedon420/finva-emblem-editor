// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PixelBuffer } from '../../core/types';
import { useEditorStore } from '../../state/editorStore';
import ColorReplacePanel from './ColorReplacePanel';

afterEach(cleanup);

const RED = { r: 255, g: 0, b: 0 };

function makeBuffer(fill: [number, number, number, number]): PixelBuffer {
  const size = 4;
  const data = new Uint8ClampedArray(new ArrayBuffer(size * size * 4));
  for (let i = 0; i < size * size; i++) {
    data.set(fill, i * 4);
  }
  return { data, width: size, height: size };
}

function setupBakedStore(): void {
  const store = useEditorStore.getState();
  store.discardEdits();
  store.setMode('pixelEdit');
  store.bake(makeBuffer([10, 20, 30, 255]), 1);
  store.setColor(RED);
  store.setReplaceSource({ r: 10, g: 20, b: 30 });
}

function clickReplace(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
}

describe('ColorReplacePanel — result message lifecycle', () => {
  beforeEach(setupBakedStore);

  it('reports the number of replaced pixels', () => {
    render(<ColorReplacePanel onBufferChanged={() => {}} />);
    clickReplace();
    expect(screen.getByText('Replaced 16 pixels.')).toBeTruthy();
  });

  it('reports a no-match replace without creating history', () => {
    useEditorStore.getState().setReplaceSource({ r: 99, g: 99, b: 99 });
    render(<ColorReplacePanel onBufferChanged={() => {}} />);
    clickReplace();
    expect(screen.getByText('No pixels matched — nothing changed.')).toBeTruthy();
    expect(useEditorStore.getState().history.patches).toHaveLength(0);
  });

  // Regression: the message used to persist after Undo, describing a replace
  // that was no longer in the buffer. Any editVersion change must hide it.
  it('hides the message after Undo', () => {
    render(<ColorReplacePanel onBufferChanged={() => {}} />);
    clickReplace();
    expect(screen.getByText('Replaced 16 pixels.')).toBeTruthy();
    act(() => useEditorStore.getState().undo());
    expect(screen.queryByText('Replaced 16 pixels.')).toBeNull();
  });

  it('hides the message after Redo', () => {
    render(<ColorReplacePanel onBufferChanged={() => {}} />);
    clickReplace();
    act(() => useEditorStore.getState().undo());
    act(() => useEditorStore.getState().redo());
    expect(screen.queryByText('Replaced 16 pixels.')).toBeNull();
  });

  it('hides the message after a rebake', () => {
    render(<ColorReplacePanel onBufferChanged={() => {}} />);
    clickReplace();
    act(() => useEditorStore.getState().bake(makeBuffer([1, 1, 1, 255]), 2));
    expect(screen.queryByText('Replaced 16 pixels.')).toBeNull();
  });

  it('hides the message after discarding edits', () => {
    render(<ColorReplacePanel onBufferChanged={() => {}} />);
    clickReplace();
    act(() => useEditorStore.getState().discardEdits());
    expect(screen.queryByText('Replaced 16 pixels.')).toBeNull();
  });

  it('hides the message after a mode change', () => {
    render(<ColorReplacePanel onBufferChanged={() => {}} />);
    clickReplace();
    act(() => useEditorStore.getState().setMode('optimize'));
    expect(screen.queryByText('Replaced 16 pixels.')).toBeNull();
  });
});
