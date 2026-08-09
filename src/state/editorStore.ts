import { create } from 'zustand';
import type { PixelBuffer, RGBColor } from '../core/types';
import { cloneBuffer } from '../modes/pixelEdit/drawing';
import type { BrushSize } from '../modes/pixelEdit/drawing';
import { createHistory, redo as redoHistory, undo as undoHistory } from '../modes/pixelEdit/history';
import type { EditHistory, EditPatch } from '../modes/pixelEdit/history';
import { recordPatch } from '../modes/pixelEdit/history';

export type AppMode = 'optimize' | 'pixelEdit';
export type PixelTool = 'pen' | 'eraser' | 'eyedropper' | 'fill';

export const ZOOM_LEVELS = [1, 2, 3, 4, 6, 8, 12, 16] as const;
/** Below this zoom a 1px grid line would be as thick as the pixels it separates. */
export const MIN_GRID_ZOOM = 4;

interface EditorState {
  mode: AppMode;
  /** The editable 256x256 copy. Source of truth for Pixel Edit mode; null until baked. */
  buffer: PixelBuffer | null;
  /** projectStore.version at bake time, for stale detection. */
  bakedFromVersion: number | null;
  isDirty: boolean;
  history: EditHistory;
  tool: PixelTool;
  color: RGBColor;
  /** Source colour for Global Color Replace; null until the user picks one. */
  replaceSource: RGBColor | null;
  brushSize: BrushSize;
  zoom: number;
  showGrid: boolean;
  /** True while an overwrite confirmation is pending for a requested rebake. */
  pendingRebake: boolean;
  /** Bumped on every committed edit so previews/validation recompute. */
  editVersion: number;

  setMode: (mode: AppMode) => void;
  bake: (source: PixelBuffer, optimizerVersion: number) => void;
  requestRebake: () => void;
  cancelRebake: () => void;
  discardEdits: () => void;
  commitPatch: (patch: EditPatch) => void;
  undo: () => void;
  redo: () => void;
  setTool: (tool: PixelTool) => void;
  setColor: (color: RGBColor) => void;
  setReplaceSource: (color: RGBColor | null) => void;
  setBrushSize: (size: BrushSize) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  mode: 'optimize',
  buffer: null,
  bakedFromVersion: null,
  isDirty: false,
  history: createHistory(),
  tool: 'pen',
  color: { r: 255, g: 255, b: 255 },
  replaceSource: null,
  brushSize: 1,
  zoom: 2,
  showGrid: true,
  pendingRebake: false,
  editVersion: 0,

  setMode: (mode) => set({ mode }),

  // Always clones: the editable copy must never alias the optimizer's buffer,
  // so pixel edits can never write back into the canonical pipeline output.
  bake: (source, optimizerVersion) =>
    set((state) => ({
      buffer: cloneBuffer(source),
      bakedFromVersion: optimizerVersion,
      isDirty: false,
      history: createHistory(),
      pendingRebake: false,
      editVersion: state.editVersion + 1,
    })),

  requestRebake: () => set({ pendingRebake: true }),
  cancelRebake: () => set({ pendingRebake: false }),

  discardEdits: () =>
    set((state) => ({
      buffer: null,
      bakedFromVersion: null,
      isDirty: false,
      history: createHistory(),
      pendingRebake: false,
      editVersion: state.editVersion + 1,
    })),

  commitPatch: (patch) =>
    set((state) => {
      recordPatch(state.history, patch);
      return { isDirty: true, editVersion: state.editVersion + 1 };
    }),

  undo: () => {
    const { history, buffer } = get();
    if (!buffer || !undoHistory(history, buffer)) {
      return;
    }
    set((state) => ({ editVersion: state.editVersion + 1 }));
  },

  redo: () => {
    const { history, buffer } = get();
    if (!buffer || !redoHistory(history, buffer)) {
      return;
    }
    set((state) => ({ editVersion: state.editVersion + 1 }));
  },

  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setReplaceSource: (replaceSource) => set({ replaceSource }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setZoom: (zoom) => set({ zoom }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
}));
