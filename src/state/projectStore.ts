import { create } from 'zustand';
import { DEFAULT_ADJUSTMENT_SETTINGS, clampAdjustment } from '../core/canvas/adjustments';
import type { AdjustmentSettings } from '../core/canvas/adjustments';
import { DEFAULT_BACKGROUND_SETTINGS, clampTolerance } from '../core/canvas/background';
import type { BackgroundSettings } from '../core/canvas/background';
import { DEFAULT_PALETTE_SETTINGS, clampPaletteTarget } from '../core/canvas/palette';
import type { PaletteSettings } from '../core/canvas/palette';
import { DEFAULT_PLACEMENT_SETTINGS, clampOffset, clampPadding, clampZoom } from '../core/canvas/placement';
import type { PlacementSettings } from '../core/canvas/placement';
import type { PaletteInfo } from '../core/canvas/renderMaster';
import type { PlacedRect } from '../core/types';
import type { ValidationReport } from '../core/validation/mgo2Readiness';

interface ImportedImageArgs {
  fileName: string;
  width: number;
  height: number;
  image: HTMLImageElement;
}

const INITIAL_PALETTE_INFO: PaletteInfo = {
  palette: [],
  originalVisibleColorCount: 0,
  resultVisibleColorCount: 0,
};

interface ProjectState {
  hasImage: boolean;
  sourceFileName: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  /** The original, untouched decoded source image — every re-render draws from this, never from the master canvas. */
  sourceImage: HTMLImageElement | null;
  placement: PlacementSettings;
  background: BackgroundSettings;
  adjustments: AdjustmentSettings;
  palette: PaletteSettings;
  /** Latest color counts/palette computed by the render pipeline, for display only. */
  paletteInfo: PaletteInfo;
  /** Latest readiness report computed by the render pipeline, for display only. */
  validation: ValidationReport | null;
  /** True while the user is in "click the image to sample a color" mode. */
  isSampling: boolean;
  /** Last computed placement rect, for display purposes only (not used as a render input). */
  placedRect: PlacedRect | null;
  /** User-facing import/export error, or null. Cleared on any successful import or export. */
  appError: string | null;
  /** Increments on every master canvas mutation; drives preview regeneration. */
  version: number;
  setImportedImage: (args: ImportedImageArgs) => void;
  setAppError: (message: string | null) => void;
  setPlacement: (updates: Partial<PlacementSettings>) => void;
  resetPlacement: () => void;
  setBackground: (updates: Partial<BackgroundSettings>) => void;
  resetBackground: () => void;
  setAdjustments: (updates: Partial<AdjustmentSettings>) => void;
  resetAdjustments: () => void;
  setPalette: (updates: Partial<PaletteSettings>) => void;
  resetPalette: () => void;
  setPaletteInfo: (info: PaletteInfo) => void;
  setValidation: (report: ValidationReport) => void;
  setSampling: (active: boolean) => void;
  setPlacedRect: (rect: PlacedRect) => void;
  reset: () => void;
}

const initialStatus = {
  hasImage: false,
  sourceFileName: null,
  sourceWidth: null,
  sourceHeight: null,
  sourceImage: null,
  placement: { ...DEFAULT_PLACEMENT_SETTINGS },
  background: { ...DEFAULT_BACKGROUND_SETTINGS },
  adjustments: { ...DEFAULT_ADJUSTMENT_SETTINGS },
  palette: { ...DEFAULT_PALETTE_SETTINGS },
  paletteInfo: { ...INITIAL_PALETTE_INFO },
  validation: null,
  isSampling: false,
  placedRect: null,
  appError: null,
} satisfies Omit<
  ProjectState,
  | 'version'
  | 'setImportedImage'
  | 'setAppError'
  | 'setPlacement'
  | 'resetPlacement'
  | 'setBackground'
  | 'resetBackground'
  | 'setAdjustments'
  | 'resetAdjustments'
  | 'setPalette'
  | 'resetPalette'
  | 'setPaletteInfo'
  | 'setValidation'
  | 'setSampling'
  | 'setPlacedRect'
  | 'reset'
>;

export const useProjectStore = create<ProjectState>((set) => ({
  ...initialStatus,
  version: 0,
  setImportedImage: ({ fileName, width, height, image }) =>
    set((state) => ({
      hasImage: true,
      sourceFileName: fileName,
      sourceWidth: width,
      sourceHeight: height,
      sourceImage: image,
      placement: { ...DEFAULT_PLACEMENT_SETTINGS },
      background: { ...DEFAULT_BACKGROUND_SETTINGS },
      adjustments: { ...DEFAULT_ADJUSTMENT_SETTINGS },
      palette: { ...DEFAULT_PALETTE_SETTINGS },
      paletteInfo: { ...INITIAL_PALETTE_INFO },
      validation: null,
      isSampling: false,
      appError: null, // a successful import supersedes any earlier failure
      version: state.version + 1,
    })),
  setAppError: (message) => set({ appError: message }),
  setPlacement: (updates) =>
    set((state) => {
      const nextMode = updates.mode ?? state.placement.mode;
      const next: PlacementSettings = {
        mode: nextMode,
        offsetX: clampOffset(updates.offsetX ?? state.placement.offsetX),
        offsetY: clampOffset(updates.offsetY ?? state.placement.offsetY),
        // Clamped against the resulting mode, not the previous one, so
        // switching Fit -> Fill while zoomed below 1x snaps zoom up to 1x.
        zoom: clampZoom(updates.zoom ?? state.placement.zoom, nextMode),
        padding: clampPadding(updates.padding ?? state.placement.padding),
      };
      return { placement: next, version: state.version + 1 };
    }),
  resetPlacement: () =>
    set((state) => ({ placement: { ...DEFAULT_PLACEMENT_SETTINGS }, version: state.version + 1 })),
  setBackground: (updates) =>
    set((state) => {
      const next: BackgroundSettings = {
        mode: updates.mode ?? state.background.mode,
        sampledColor: updates.sampledColor !== undefined ? updates.sampledColor : state.background.sampledColor,
        tolerance: clampTolerance(updates.tolerance ?? state.background.tolerance),
        replaceColor: updates.replaceColor ?? state.background.replaceColor,
      };
      return { background: next, version: state.version + 1 };
    }),
  resetBackground: () =>
    set((state) => ({ background: { ...DEFAULT_BACKGROUND_SETTINGS }, version: state.version + 1 })),
  setAdjustments: (updates) =>
    set((state) => {
      const next: AdjustmentSettings = {
        autoLevels: updates.autoLevels ?? state.adjustments.autoLevels,
        brightness: clampAdjustment(updates.brightness ?? state.adjustments.brightness),
        contrast: clampAdjustment(updates.contrast ?? state.adjustments.contrast),
        saturation: clampAdjustment(updates.saturation ?? state.adjustments.saturation),
      };
      return { adjustments: next, version: state.version + 1 };
    }),
  resetAdjustments: () =>
    set((state) => ({ adjustments: { ...DEFAULT_ADJUSTMENT_SETTINGS }, version: state.version + 1 })),
  setPalette: (updates) =>
    set((state) => {
      const next: PaletteSettings = {
        mode: updates.mode ?? state.palette.mode,
        targetColors: clampPaletteTarget(updates.targetColors ?? state.palette.targetColors),
      };
      return { palette: next, version: state.version + 1 };
    }),
  resetPalette: () => set((state) => ({ palette: { ...DEFAULT_PALETTE_SETTINGS }, version: state.version + 1 })),
  setPaletteInfo: (info) => set({ paletteInfo: info }),
  setValidation: (report) => set({ validation: report }),
  setSampling: (active) => set({ isSampling: active }),
  setPlacedRect: (rect) => set({ placedRect: rect }),
  reset: () =>
    set({
      ...initialStatus,
      placement: { ...DEFAULT_PLACEMENT_SETTINGS },
      background: { ...DEFAULT_BACKGROUND_SETTINGS },
      adjustments: { ...DEFAULT_ADJUSTMENT_SETTINGS },
      palette: { ...DEFAULT_PALETTE_SETTINGS },
      paletteInfo: { ...INITIAL_PALETTE_INFO },
      validation: null,
      version: 0,
    }),
}));
