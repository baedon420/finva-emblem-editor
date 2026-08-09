import { describe, expect, it } from 'vitest';
import { getEditableCopyStatus } from './editableCopy';

describe('getEditableCopyStatus', () => {
  it('reports absent when no editable copy has been baked', () => {
    const status = getEditableCopyStatus({
      hasBuffer: false,
      bakedFromVersion: null,
      currentOptimizerVersion: 3,
      isDirty: false,
    });
    expect(status.state).toBe('absent');
    expect(status.requiresRebakeConfirmation).toBe(false);
  });

  it('reports current when the copy matches the optimizer version it came from', () => {
    const status = getEditableCopyStatus({
      hasBuffer: true,
      bakedFromVersion: 3,
      currentOptimizerVersion: 3,
      isDirty: false,
    });
    expect(status.state).toBe('current');
  });

  it('reports stale once optimizer settings change after baking', () => {
    const status = getEditableCopyStatus({
      hasBuffer: true,
      bakedFromVersion: 3,
      currentOptimizerVersion: 4,
      isDirty: false,
    });
    expect(status.state).toBe('stale');
  });

  it('stays stale regardless of whether the copy has been edited', () => {
    const status = getEditableCopyStatus({
      hasBuffer: true,
      bakedFromVersion: 3,
      currentOptimizerVersion: 9,
      isDirty: true,
    });
    expect(status.state).toBe('stale');
    expect(status.hasUnsavedEdits).toBe(true);
  });

  it('requires rebake confirmation only when pixel edits would be destroyed', () => {
    const dirty = getEditableCopyStatus({
      hasBuffer: true,
      bakedFromVersion: 1,
      currentOptimizerVersion: 2,
      isDirty: true,
    });
    const clean = getEditableCopyStatus({
      hasBuffer: true,
      bakedFromVersion: 1,
      currentOptimizerVersion: 2,
      isDirty: false,
    });
    expect(dirty.requiresRebakeConfirmation).toBe(true);
    expect(clean.requiresRebakeConfirmation).toBe(false);
  });
});
