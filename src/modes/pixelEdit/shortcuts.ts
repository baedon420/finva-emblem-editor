import type { PixelTool } from '../../state/editorStore';

export type ShortcutAction =
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'tool'; tool: PixelTool };

/** The subset of KeyboardEvent the resolver needs — kept structural for testing without a DOM. */
export interface ShortcutKeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const TOOL_KEYS: Record<string, PixelTool> = {
  b: 'pen',
  e: 'eraser',
  i: 'eyedropper',
  g: 'fill',
};

/**
 * Maps a keyboard event to an editor action, or null when the combination is
 * not a recognised shortcut. Undo/redo accept either Ctrl or Cmd as the
 * primary modifier (Ctrl+Z / Cmd+Z, Ctrl+Shift+Z / Cmd+Shift+Z, Ctrl+Y).
 * Tool keys (B/E/I/G) fire only bare — any modifier defers to the browser.
 *
 * Callers are responsible for suppressing shortcuts while a text-entry
 * control has focus (see `isTypingTarget`) — this function only interprets
 * keys.
 */
export function resolveShortcut(input: ShortcutKeyInput): ShortcutAction | null {
  const primary = input.ctrlKey || input.metaKey;
  const key = input.key.toLowerCase();

  if (primary) {
    if (input.altKey) {
      return null;
    }
    if (key === 'z') {
      return input.shiftKey ? { type: 'redo' } : { type: 'undo' };
    }
    if (key === 'y' && !input.shiftKey) {
      return { type: 'redo' };
    }
    return null;
  }

  if (!input.altKey && !input.shiftKey) {
    const tool = TOOL_KEYS[key];
    if (tool) {
      return { type: 'tool', tool };
    }
  }
  return null;
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function targetTag(target: unknown): string | null {
  if (!target || typeof target !== 'object') {
    return null;
  }
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  if (el.isContentEditable === true) {
    return 'CONTENTEDITABLE';
  }
  return typeof el.tagName === 'string' ? el.tagName : null;
}

/**
 * True when the event target consumes keystrokes as text entry — tool and
 * undo/redo shortcuts must never fire there. Deliberately does NOT include
 * BUTTON: buttons only consume Space/Enter, and every toolbar click leaves a
 * button focused, so suppressing letter shortcuts on buttons would make
 * B/E/I/G silently stop working after any click in the panel. Duck-typed on
 * tagName/isContentEditable so it stays testable outside a DOM environment.
 */
export function isTypingTarget(target: unknown): boolean {
  const tag = targetTag(target);
  return tag === 'CONTENTEDITABLE' || (tag !== null && TYPING_TAGS.has(tag));
}

/**
 * True when Space must be left alone for the event target: everything
 * `isTypingTarget` covers, plus BUTTON — Space activates a focused button,
 * so arming the pan there would hijack keyboard activation.
 */
export function isSpaceConsumingTarget(target: unknown): boolean {
  return isTypingTarget(target) || targetTag(target) === 'BUTTON';
}

/**
 * A pointer-down starts a pan — never a stroke — for the middle button, or
 * for the left button while Space is held. Pan initiation is decided before
 * any drawing code runs, so panning can never touch pixel data.
 */
export function shouldStartPan(button: number, spaceHeld: boolean): boolean {
  return button === 1 || (button === 0 && spaceHeld);
}
