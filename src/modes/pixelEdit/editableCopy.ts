/**
 * Lifecycle state of the editable pixel-edit copy, expressed as a model
 * rather than as UI copy so the rules are testable and every consumer
 * (toolbar, canvas, export, validation) agrees on them.
 */
export type EditableCopyState =
  /** No editable copy exists yet — Pixel Edit has never been baked. */
  | 'absent'
  /** A copy exists and matches the optimizer output it was baked from. */
  | 'current'
  /** A copy exists, but optimizer settings have changed since it was baked. */
  | 'stale';

export interface EditableCopyStatus {
  state: EditableCopyState;
  /** True when the buffer holds user pixel edits that a rebake would destroy. */
  hasUnsavedEdits: boolean;
  /** True when baking now would overwrite existing pixel edits and must be confirmed first. */
  requiresRebakeConfirmation: boolean;
}

export interface EditableCopyInput {
  hasBuffer: boolean;
  /** projectStore.version captured when the copy was baked. */
  bakedFromVersion: number | null;
  /** projectStore.version right now. */
  currentOptimizerVersion: number;
  /** True once any drawing operation has been applied to the copy. */
  isDirty: boolean;
}

export function getEditableCopyStatus(input: EditableCopyInput): EditableCopyStatus {
  if (!input.hasBuffer) {
    return { state: 'absent', hasUnsavedEdits: false, requiresRebakeConfirmation: false };
  }
  const state: EditableCopyState =
    input.bakedFromVersion !== null && input.bakedFromVersion !== input.currentOptimizerVersion
      ? 'stale'
      : 'current';
  return {
    state,
    hasUnsavedEdits: input.isDirty,
    // Only edited pixels are irreplaceable. Rebaking over an untouched copy
    // destroys nothing, so it should not nag the user.
    requiresRebakeConfirmation: input.isDirty,
  };
}
