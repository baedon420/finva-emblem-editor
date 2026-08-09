import { MASTER_CANVAS_SIZE } from '../canvas/masterCanvas';
import type { PixelBuffer, PlacedRect } from '../types';
import { computeContrastSpread, computeTransitionRatio, computeVisiblePixelStats } from './metrics';

// ---------------------------------------------------------------------------
// Thresholds. Every one is deliberately conservative: this version should
// stay quiet unless a problem is fairly clear, because a false warning
// teaches users to ignore the panel entirely.
// ---------------------------------------------------------------------------

/**
 * Recommended working colour target. NOT a confirmed MGO2 technical maximum —
 * no such limit has been verified. Sourced from the project's own guidance
 * that ~16 colours reads well as an emblem, so exceeding it is advisory only.
 */
export const RECOMMENDED_COLOR_TARGET = 16;

/**
 * Minimum share of the *placed image area* that visible pixels should cover.
 * Measured against the placed rect rather than the whole canvas so that Fit
 * mode's intentional letterboxing never counts against the user. 15% means
 * the subject would occupy roughly a 12x12 region of a 32x32 preview, at
 * which point detail genuinely starts disappearing.
 */
export const MIN_SUBJECT_OCCUPANCY = 0.15;

/**
 * Maximum distance the visible-pixel centre of mass may sit from the canvas
 * centre, as a fraction of canvas size, before it is called off-centre.
 * 0.20 = ~51px at 256x256 — large enough that deliberate asymmetric
 * compositions are not flagged, small enough to catch genuinely misplaced
 * subjects.
 */
export const MAX_CENTER_OFFSET_RATIO = 0.2;

/**
 * Minimum 5th-to-95th percentile luminance spread (0-1) before contrast is
 * called low. 0.30 corresponds to roughly a mid-grey-to-light-grey range;
 * anything tighter tends to lose all shape separation when shrunk.
 */
export const MIN_CONTRAST_SPREAD = 0.3;

/**
 * Luminance delta (0-255) at which two adjacent pixels count as a
 * transition. 24 is low enough to catch real edges but high enough to
 * ignore trivial gradient banding.
 */
export const TRANSITION_LUMINANCE_THRESHOLD = 24;

/**
 * Transition ratio in the 32x32 preview above which the image is called
 * fragmented. 0.50 means more than half of all neighbouring pixel pairs
 * differ — effectively per-pixel noise at that scale. Set high deliberately:
 * legitimate detailed emblems commonly sit in the 0.2-0.4 range.
 */
export const MAX_TINY_TRANSITION_RATIO = 0.5;

/**
 * Share of visible pixels carrying partial alpha above which soft/antialiased
 * edges are reported. Partial alpha is the ONLY directly measurable
 * antialiasing signal available here — intermediate *colours* are not treated
 * as antialiasing, since legitimate shading is indistinguishable from it.
 * 0.15 tolerates modest soft shading before saying anything.
 */
export const MAX_PARTIAL_ALPHA_RATIO = 0.15;

// ---------------------------------------------------------------------------
// Result model
// ---------------------------------------------------------------------------

export type CheckStatus = 'pass' | 'warning' | 'fail' | 'info';
/** 'technical' = objectively verifiable. 'heuristic' = estimated visual quality. */
export type CheckKind = 'technical' | 'heuristic';
export type ReadinessStatus = 'ready' | 'ready-with-warnings' | 'not-ready';

export interface MeasuredValue {
  value: number;
  /** 'count' | 'ratio' | 'px' — lets the UI decide formatting; core never formats. */
  unit: 'count' | 'ratio' | 'px';
}

export interface ValidationCheck {
  id: string;
  label: string;
  kind: CheckKind;
  status: CheckStatus;
  measured?: MeasuredValue;
  /** Present whenever status is 'warning' or 'fail': what the user can do about it. */
  advice?: string;
}

export interface ValidationReport {
  status: ReadinessStatus;
  technical: ValidationCheck[];
  heuristic: ValidationCheck[];
}

export interface ValidationInput {
  hasImage: boolean;
  masterBuffer: PixelBuffer | null;
  preview64: PixelBuffer | null;
  preview32: PixelBuffer | null;
  placedRect: PlacedRect | null;
  visibleColorCount: number;
  /** True when the app's PNG export path is wired up and callable. */
  canExportPng: boolean;
  /** True when every scaling step in the pipeline used nearest-neighbour. */
  nearestNeighborEnforced: boolean;
}

/**
 * Builds the full readiness report from explicit buffers and metadata.
 * Pure: performs no canvas, DOM, or store access, and returns structured
 * results only — all display formatting is the UI's responsibility.
 */
export function validateReadiness(input: ValidationInput): ValidationReport {
  const technical: ValidationCheck[] = [];
  const heuristic: ValidationCheck[] = [];

  // --- Technical: image loaded -------------------------------------------
  if (!input.hasImage || !input.masterBuffer) {
    technical.push({
      id: 'image-loaded',
      label: 'Image loaded',
      kind: 'technical',
      status: 'fail',
      advice: 'Upload an image to begin.',
    });
    return { status: 'not-ready', technical, heuristic };
  }
  technical.push({ id: 'image-loaded', label: 'Image loaded', kind: 'technical', status: 'pass' });

  const master = input.masterBuffer;

  // --- Technical: output dimensions --------------------------------------
  const dimensionsValid = master.width === MASTER_CANVAS_SIZE && master.height === MASTER_CANVAS_SIZE;
  technical.push({
    id: 'output-dimensions',
    label: `Master output is exactly ${MASTER_CANVAS_SIZE}x${MASTER_CANVAS_SIZE}`,
    kind: 'technical',
    status: dimensionsValid ? 'pass' : 'fail',
    measured: { value: master.width, unit: 'px' },
    advice: dimensionsValid
      ? undefined
      : `The master canvas must be exactly ${MASTER_CANVAS_SIZE}x${MASTER_CANVAS_SIZE}. This indicates an internal pipeline error rather than a settings problem.`,
  });

  // --- Technical: PNG export path ----------------------------------------
  technical.push({
    id: 'png-export',
    label: 'PNG export path available',
    kind: 'technical',
    status: input.canExportPng ? 'pass' : 'fail',
    advice: input.canExportPng ? undefined : 'PNG export is unavailable, so the emblem cannot be saved.',
  });

  // --- Technical: nearest-neighbour enforcement --------------------------
  technical.push({
    id: 'nearest-neighbor',
    label: 'Nearest-neighbour scaling enforced by pipeline',
    kind: 'technical',
    status: input.nearestNeighborEnforced ? 'pass' : 'fail',
    advice: input.nearestNeighborEnforced
      ? undefined
      : 'Smoothing was applied somewhere in the pipeline, which blurs pixel edges.',
  });

  // --- Technical: previews generated -------------------------------------
  const previewsGenerated = Boolean(input.preview64 && input.preview32);
  technical.push({
    id: 'previews-generated',
    label: '64x64 and 32x32 previews generated',
    kind: 'technical',
    status: previewsGenerated ? 'pass' : 'fail',
    advice: previewsGenerated ? undefined : 'Preview generation failed, so small-size readability cannot be checked.',
  });

  const stats = computeVisiblePixelStats(master);

  // --- Technical: visible content present --------------------------------
  // Classified technical, not heuristic: "zero visible pixels" is objectively
  // determined, and a fully transparent PNG is not a usable emblem regardless
  // of taste. No subjective judgement is involved.
  const hasVisibleContent = stats.visibleCount > 0;
  technical.push({
    id: 'visible-content',
    label: 'Output contains visible pixels',
    kind: 'technical',
    status: hasVisibleContent ? 'pass' : 'fail',
    measured: { value: stats.visibleCount, unit: 'count' },
    advice: hasVisibleContent
      ? undefined
      : 'The output is fully transparent. Lower the background tolerance or switch the background mode back to Preserve.',
  });

  // --- Technical: alpha validity -----------------------------------------
  const hasTransparency = stats.visibleCount < master.width * master.height;
  technical.push({
    id: 'alpha-valid',
    label: hasTransparency ? 'Transparency present and valid' : 'Fully opaque output',
    kind: 'technical',
    status: hasTransparency ? 'pass' : 'info',
  });

  // Heuristics need visible pixels to mean anything at all.
  if (!hasVisibleContent) {
    return { status: 'not-ready', technical, heuristic };
  }

  // --- Heuristic: visible colour count -----------------------------------
  const colorCountOk = input.visibleColorCount <= RECOMMENDED_COLOR_TARGET;
  heuristic.push({
    id: 'color-count',
    label: 'Visible colour count',
    kind: 'heuristic',
    status: colorCountOk ? 'pass' : 'warning',
    measured: { value: input.visibleColorCount, unit: 'count' },
    advice: colorCountOk
      ? undefined
      : `Above the recommended working target of ${RECOMMENDED_COLOR_TARGET} colours (not a confirmed MGO2 limit). Enable Reduced Palette or lower the target to simplify the emblem.`,
  });

  // --- Heuristic: subject occupancy --------------------------------------
  // Measured against the placed rect clipped to the canvas, so Fit-mode
  // letterboxing is excluded from the denominator by construction.
  const clippedPlacedArea = input.placedRect
    ? Math.max(
        1,
        (Math.min(input.placedRect.x + input.placedRect.width, master.width) - Math.max(input.placedRect.x, 0)) *
          (Math.min(input.placedRect.y + input.placedRect.height, master.height) - Math.max(input.placedRect.y, 0)),
      )
    : master.width * master.height;
  const occupancy = Math.min(1, stats.visibleCount / clippedPlacedArea);
  const occupancyOk = occupancy >= MIN_SUBJECT_OCCUPANCY;
  heuristic.push({
    id: 'subject-occupancy',
    label: 'Subject occupancy (estimated)',
    kind: 'heuristic',
    status: occupancyOk ? 'pass' : 'warning',
    measured: { value: occupancy, unit: 'ratio' },
    advice: occupancyOk
      ? undefined
      : 'The subject fills very little of the placed image, so it may be hard to make out when shown small. Try zooming in or switching to Fill.',
  });

  // --- Heuristic: centring ------------------------------------------------
  const centroid = stats.centroid as { x: number; y: number };
  const offsetRatio =
    Math.max(
      Math.abs(centroid.x - master.width / 2) / master.width,
      Math.abs(centroid.y - master.height / 2) / master.height,
    ) * 2;
  const centeringOk = offsetRatio <= MAX_CENTER_OFFSET_RATIO;
  heuristic.push({
    id: 'centering',
    label: 'Subject centring (estimated)',
    kind: 'heuristic',
    status: centeringOk ? 'pass' : 'warning',
    measured: { value: offsetRatio, unit: 'ratio' },
    advice: centeringOk
      ? undefined
      : 'The visible content sits noticeably off-centre. Adjust Horizontal/Vertical Position if that was not intentional.',
  });

  // --- Heuristic: contrast ------------------------------------------------
  const contrastSpread = computeContrastSpread(master);
  const contrastOk = contrastSpread >= MIN_CONTRAST_SPREAD;
  heuristic.push({
    id: 'contrast',
    label: 'Contrast spread (estimated)',
    kind: 'heuristic',
    status: contrastOk ? 'pass' : 'warning',
    measured: { value: contrastSpread, unit: 'ratio' },
    advice: contrastOk
      ? undefined
      : 'Light and dark areas are close in brightness, so shapes may blur together when small. Consider a source image with stronger light/dark separation.',
  });

  // --- Heuristic: tiny-preview detail density ----------------------------
  if (input.preview32) {
    const transitionRatio = computeTransitionRatio(input.preview32, TRANSITION_LUMINANCE_THRESHOLD);
    const detailOk = transitionRatio <= MAX_TINY_TRANSITION_RATIO;
    heuristic.push({
      id: 'tiny-detail-density',
      label: 'Estimated 32x32 readability',
      kind: 'heuristic',
      status: detailOk ? 'pass' : 'warning',
      measured: { value: transitionRatio, unit: 'ratio' },
      advice: detailOk
        ? undefined
        : 'The 32x32 preview changes colour on most neighbouring pixels, suggesting fine detail may disappear in game. Simplify the artwork or reduce the palette.',
    });
  }

  if (input.preview64) {
    const transitionRatio64 = computeTransitionRatio(input.preview64, TRANSITION_LUMINANCE_THRESHOLD);
    heuristic.push({
      id: 'tiny-detail-density-64',
      label: 'Estimated 64x64 readability',
      kind: 'heuristic',
      status: transitionRatio64 <= MAX_TINY_TRANSITION_RATIO ? 'pass' : 'warning',
      measured: { value: transitionRatio64, unit: 'ratio' },
      advice:
        transitionRatio64 <= MAX_TINY_TRANSITION_RATIO
          ? undefined
          : 'The 64x64 preview is highly fragmented, which usually means the artwork is too busy for emblem use.',
    });
  }

  // --- Heuristic: edge softness ------------------------------------------
  const partialAlphaRatio = stats.partialAlphaCount / stats.visibleCount;
  const edgesOk = partialAlphaRatio <= MAX_PARTIAL_ALPHA_RATIO;
  heuristic.push({
    id: 'edge-clarity',
    label: 'Edge clarity (estimated)',
    kind: 'heuristic',
    status: edgesOk ? 'pass' : 'warning',
    measured: { value: partialAlphaRatio, unit: 'ratio' },
    advice: edgesOk
      ? undefined
      : 'Many pixels are partially transparent, which usually indicates soft or antialiased edges. Hard edges hold up better at small sizes.',
  });

  return { status: aggregateStatus(technical, heuristic), technical, heuristic };
}

/**
 * Aggregation rule: a technical 'fail' is the ONLY thing that can produce
 * NOT READY. Heuristic checks can never do worse than READY WITH WARNINGS,
 * because they are estimates and must not block a user from exporting.
 */
export function aggregateStatus(technical: ValidationCheck[], heuristic: ValidationCheck[]): ReadinessStatus {
  if (technical.some((check) => check.status === 'fail')) {
    return 'not-ready';
  }
  const anyWarning = [...technical, ...heuristic].some((check) => check.status === 'warning');
  return anyWarning ? 'ready-with-warnings' : 'ready';
}
