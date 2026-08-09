import { describe, expect, it } from 'vitest';
import type { ShortcutKeyInput } from './shortcuts';
import { isSpaceConsumingTarget, isTypingTarget, resolveShortcut, shouldStartPan } from './shortcuts';

function key(overrides: Partial<ShortcutKeyInput>): ShortcutKeyInput {
  return { key: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...overrides };
}

describe('resolveShortcut — undo/redo', () => {
  it('Ctrl+Z and Cmd+Z resolve to undo', () => {
    expect(resolveShortcut(key({ key: 'z', ctrlKey: true }))).toEqual({ type: 'undo' });
    expect(resolveShortcut(key({ key: 'z', metaKey: true }))).toEqual({ type: 'undo' });
  });

  it('Ctrl+Shift+Z and Cmd+Shift+Z resolve to redo', () => {
    expect(resolveShortcut(key({ key: 'Z', ctrlKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
    expect(resolveShortcut(key({ key: 'Z', metaKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
  });

  it('Ctrl+Y resolves to redo', () => {
    expect(resolveShortcut(key({ key: 'y', ctrlKey: true }))).toEqual({ type: 'redo' });
  });

  it('Ctrl+Shift+Y is not a shortcut', () => {
    expect(resolveShortcut(key({ key: 'y', ctrlKey: true, shiftKey: true }))).toBeNull();
  });

  it('Alt alongside the primary modifier disables the shortcut', () => {
    expect(resolveShortcut(key({ key: 'z', ctrlKey: true, altKey: true }))).toBeNull();
  });

  it('bare Z or Y is not a shortcut', () => {
    expect(resolveShortcut(key({ key: 'z' }))).toBeNull();
    expect(resolveShortcut(key({ key: 'y' }))).toBeNull();
  });
});

describe('resolveShortcut — tool keys', () => {
  it('maps B/E/I/G to pen/eraser/eyedropper/fill', () => {
    expect(resolveShortcut(key({ key: 'b' }))).toEqual({ type: 'tool', tool: 'pen' });
    expect(resolveShortcut(key({ key: 'e' }))).toEqual({ type: 'tool', tool: 'eraser' });
    expect(resolveShortcut(key({ key: 'i' }))).toEqual({ type: 'tool', tool: 'eyedropper' });
    expect(resolveShortcut(key({ key: 'g' }))).toEqual({ type: 'tool', tool: 'fill' });
  });

  it('is case-insensitive on the key value', () => {
    expect(resolveShortcut(key({ key: 'B' }))).toEqual({ type: 'tool', tool: 'pen' });
  });

  it('ignores tool keys with any modifier held', () => {
    expect(resolveShortcut(key({ key: 'b', ctrlKey: true }))).toBeNull();
    expect(resolveShortcut(key({ key: 'e', metaKey: true }))).toBeNull();
    expect(resolveShortcut(key({ key: 'i', altKey: true }))).toBeNull();
    expect(resolveShortcut(key({ key: 'g', shiftKey: true }))).toBeNull();
  });

  it('unrelated keys resolve to null', () => {
    expect(resolveShortcut(key({ key: 'a' }))).toBeNull();
    expect(resolveShortcut(key({ key: 'Escape' }))).toBeNull();
    expect(resolveShortcut(key({ key: ' ' }))).toBeNull();
  });
});

describe('isTypingTarget', () => {
  it('flags text-entry controls', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  // Regression: clicking any toolbar button leaves it focused. Treating
  // BUTTON as a typing target made B/E/I/G and Ctrl+Z silently stop working
  // after every button click — buttons must NOT suppress letter shortcuts.
  it('does NOT flag buttons, so shortcuts work after clicking one', () => {
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
  });

  it('passes ordinary elements and non-elements through', () => {
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
    expect(isTypingTarget({ tagName: 'CANVAS' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
    expect(isTypingTarget('window')).toBe(false);
  });
});

describe('isSpaceConsumingTarget', () => {
  it('flags everything isTypingTarget flags', () => {
    expect(isSpaceConsumingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isSpaceConsumingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('additionally flags buttons — Space activates a focused button', () => {
    expect(isSpaceConsumingTarget({ tagName: 'BUTTON' })).toBe(true);
  });

  it('passes ordinary elements through', () => {
    expect(isSpaceConsumingTarget({ tagName: 'CANVAS' })).toBe(false);
    expect(isSpaceConsumingTarget(null)).toBe(false);
  });
});

describe('shouldStartPan', () => {
  it('middle mouse always pans', () => {
    expect(shouldStartPan(1, false)).toBe(true);
    expect(shouldStartPan(1, true)).toBe(true);
  });

  it('left button pans only while Space is held', () => {
    expect(shouldStartPan(0, true)).toBe(true);
    expect(shouldStartPan(0, false)).toBe(false);
  });

  it('right button never pans', () => {
    expect(shouldStartPan(2, false)).toBe(false);
    expect(shouldStartPan(2, true)).toBe(false);
  });
});
