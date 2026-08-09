// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HexColorInput from './HexColorInput';

afterEach(cleanup);

const LABEL = 'Test hex value';

function renderInput(color = { r: 255, g: 255, b: 255 }, onChange = vi.fn()) {
  render(<HexColorInput color={color} onChange={onChange} aria-label={LABEL} />);
  return { input: screen.getByLabelText(LABEL) as HTMLInputElement, onChange };
}

describe('HexColorInput', () => {
  it('shows the canonical colour initially', () => {
    const { input } = renderInput({ r: 32, g: 64, b: 128 });
    expect(input.value).toBe('#204080');
  });

  // Regression: a naively controlled input reset to the canonical value on
  // every keystroke, because intermediate text like "#20" parses as invalid.
  // Typing a colour was impossible — the field must keep the draft visible.
  it('keeps invalid intermediate text in the field without committing', () => {
    const { input, onChange } = renderInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '#20' } });
    expect(input.value).toBe('#20');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits as soon as the draft parses as a full hex colour', () => {
    const { input, onChange } = renderInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '#204080' } });
    expect(onChange).toHaveBeenCalledWith({ r: 32, g: 64, b: 128 });
  });

  it('accepts hex without a leading #', () => {
    const { input, onChange } = renderInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'ff8000' } });
    expect(onChange).toHaveBeenCalledWith({ r: 255, g: 128, b: 0 });
  });

  it('never commits garbage', () => {
    const { input, onChange } = renderInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'not-a-colour' } });
    expect(input.value).toBe('not-a-colour');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('snaps the draft back to the canonical colour on blur', () => {
    const { input } = renderInput({ r: 0, g: 0, b: 0 });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '#zz' } });
    fireEvent.blur(input);
    expect(input.value).toBe('#000000');
  });

  it('tracks external colour changes while not focused', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <HexColorInput color={{ r: 0, g: 0, b: 0 }} onChange={onChange} aria-label={LABEL} />,
    );
    rerender(<HexColorInput color={{ r: 255, g: 0, b: 0 }} onChange={onChange} aria-label={LABEL} />);
    expect((screen.getByLabelText(LABEL) as HTMLInputElement).value).toBe('#ff0000');
  });
});
