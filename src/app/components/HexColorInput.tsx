import { useEffect, useState } from 'react';
import { hexToRgb, rgbToHex } from '../../core/canvas/color';
import type { RGBColor } from '../../core/types';

interface HexColorInputProps {
  color: RGBColor;
  onChange: (color: RGBColor) => void;
  'aria-label': string;
  className?: string;
}

const DEFAULT_CLASS = 'w-24 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100';

/**
 * Hex text field that is actually typeable. A naively controlled input bound
 * to the canonical colour resets on every keystroke, because intermediate
 * values like "#20" parse as invalid and the canonical value snaps back —
 * making it impossible to type a colour at all. This keeps the in-progress
 * text as a local draft, commits every valid 6-digit parse immediately, and
 * snaps the draft back to the canonical colour on blur or external change.
 */
export default function HexColorInput({ color, onChange, 'aria-label': ariaLabel, className }: HexColorInputProps) {
  const canonical = rgbToHex(color);
  const [draft, setDraft] = useState(canonical);
  const [focused, setFocused] = useState(false);

  // While not being edited, the field always tracks the canonical colour
  // (e.g. eyedropper picks or swatch clicks made elsewhere).
  useEffect(() => {
    if (!focused) {
      setDraft(canonical);
    }
  }, [canonical, focused]);

  return (
    <input
      type="text"
      inputMode="text"
      spellCheck={false}
      aria-label={ariaLabel}
      value={draft}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setDraft(canonical);
      }}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        const parsed = hexToRgb(next);
        if (parsed) {
          onChange(parsed);
        }
      }}
      className={className ?? DEFAULT_CLASS}
    />
  );
}
