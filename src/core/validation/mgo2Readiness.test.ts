import { describe, expect, it } from 'vitest';
import { resizeNearestNeighbor } from '../canvas/resizeImageData';
import type { PixelBuffer } from '../types';
import {
  MAX_CENTER_OFFSET_RATIO,
  MAX_PARTIAL_ALPHA_RATIO,
  MAX_TINY_TRANSITION_RATIO,
  MIN_CONTRAST_SPREAD,
  MIN_SUBJECT_OCCUPANCY,
  RECOMMENDED_COLOR_TARGET,
  aggregateStatus,
  validateReadiness,
} from './mgo2Readiness';
import type { ValidationCheck, ValidationInput } from './mgo2Readiness';

const SIZE = 256;

/** Builds a fully transparent buffer of the given size. */
function blankBuffer(width = SIZE, height = SIZE): PixelBuffer {
  return { data: new Uint8ClampedArray(new ArrayBuffer(width * height * 4)), width, height };
}

function fillRect(
  buffer: PixelBuffer,
  x0: number,
  y0: number,
  w: number,
  h: number,
  [r, g, b, a]: [number, number, number, number],
): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || x >= buffer.width || y < 0 || y >= buffer.height) continue;
      const p = (y * buffer.width + x) * 4;
      buffer.data[p] = r;
      buffer.data[p + 1] = g;
      buffer.data[p + 2] = b;
      buffer.data[p + 3] = a;
    }
  }
}

function makeInput(overrides: Partial<ValidationInput> = {}): ValidationInput {
  const master = overrides.masterBuffer ?? blankBuffer();
  return {
    hasImage: true,
    masterBuffer: master,
    preview64: resizeNearestNeighbor(master, 64, 64),
    preview32: resizeNearestNeighbor(master, 32, 32),
    placedRect: { x: 0, y: 0, width: SIZE, height: SIZE },
    visibleColorCount: 4,
    canExportPng: true,
    nearestNeighborEnforced: true,
    ...overrides,
  };
}

/** A well-formed, centred, high-contrast, flat-colour emblem: should be fully READY. */
function goodEmblemBuffer(): PixelBuffer {
  const buffer = blankBuffer();
  fillRect(buffer, 0, 0, SIZE, SIZE, [10, 10, 10, 255]);
  fillRect(buffer, 64, 64, 128, 128, [245, 245, 245, 255]);
  return buffer;
}

function findCheck(checks: ValidationCheck[], id: string): ValidationCheck {
  const found = checks.find((c) => c.id === id);
  if (!found) {
    throw new Error(`check not found: ${id}`);
  }
  return found;
}

describe('validateReadiness — no image loaded', () => {
  it('returns NOT READY with a failing image-loaded check', () => {
    const report = validateReadiness(makeInput({ hasImage: false, masterBuffer: null }));
    expect(report.status).toBe('not-ready');
    expect(findCheck(report.technical, 'image-loaded').status).toBe('fail');
  });

  it('does not run heuristics when no image is loaded', () => {
    const report = validateReadiness(makeInput({ hasImage: false, masterBuffer: null }));
    expect(report.heuristic).toHaveLength(0);
  });
});

describe('validateReadiness — technical checks', () => {
  it('passes dimensions for a valid 256x256 output and reports READY overall', () => {
    const report = validateReadiness(makeInput({ masterBuffer: goodEmblemBuffer() }));
    expect(findCheck(report.technical, 'output-dimensions').status).toBe('pass');
    expect(report.status).toBe('ready');
  });

  it('fails and returns NOT READY for incorrect output dimensions', () => {
    const wrong = blankBuffer(128, 128);
    fillRect(wrong, 0, 0, 128, 128, [10, 10, 10, 255]);
    fillRect(wrong, 32, 32, 64, 64, [245, 245, 245, 255]);
    const report = validateReadiness(makeInput({ masterBuffer: wrong }));
    expect(findCheck(report.technical, 'output-dimensions').status).toBe('fail');
    expect(report.status).toBe('not-ready');
  });

  it('fails and returns NOT READY when the PNG export path is unavailable', () => {
    const report = validateReadiness(makeInput({ masterBuffer: goodEmblemBuffer(), canExportPng: false }));
    expect(findCheck(report.technical, 'png-export').status).toBe('fail');
    expect(report.status).toBe('not-ready');
  });

  it('fails when nearest-neighbour enforcement is not confirmed', () => {
    const report = validateReadiness(makeInput({ masterBuffer: goodEmblemBuffer(), nearestNeighborEnforced: false }));
    expect(findCheck(report.technical, 'nearest-neighbor').status).toBe('fail');
    expect(report.status).toBe('not-ready');
  });

  it('fails when previews were not generated', () => {
    const report = validateReadiness(makeInput({ masterBuffer: goodEmblemBuffer(), preview32: null, preview64: null }));
    expect(findCheck(report.technical, 'previews-generated').status).toBe('fail');
    expect(report.status).toBe('not-ready');
  });
});

describe('validateReadiness — empty/fully transparent output', () => {
  it('treats a fully transparent output as a technical failure with zero visible pixels', () => {
    const report = validateReadiness(makeInput({ masterBuffer: blankBuffer() }));
    const check = findCheck(report.technical, 'visible-content');
    expect(check.status).toBe('fail');
    expect(check.measured?.value).toBe(0);
    expect(report.status).toBe('not-ready');
  });

  it('skips all heuristics when there is nothing visible to measure', () => {
    const report = validateReadiness(makeInput({ masterBuffer: blankBuffer() }));
    expect(report.heuristic).toHaveLength(0);
  });
});

describe('validateReadiness — transparency reporting', () => {
  it('reports valid transparency as a pass when some pixels are transparent', () => {
    const buffer = blankBuffer();
    fillRect(buffer, 64, 64, 128, 128, [245, 245, 245, 255]);
    const report = validateReadiness(makeInput({ masterBuffer: buffer }));
    expect(findCheck(report.technical, 'alpha-valid').status).toBe('pass');
  });

  it('reports a fully opaque output as informational rather than a problem', () => {
    const report = validateReadiness(makeInput({ masterBuffer: goodEmblemBuffer() }));
    expect(findCheck(report.technical, 'alpha-valid').status).toBe('info');
  });
});

describe('validateReadiness — colour count advisory', () => {
  it('passes below the recommended target', () => {
    const report = validateReadiness(makeInput({ masterBuffer: goodEmblemBuffer(), visibleColorCount: 8 }));
    expect(findCheck(report.heuristic, 'color-count').status).toBe('pass');
  });

  it('passes exactly at the recommended target', () => {
    const report = validateReadiness(
      makeInput({ masterBuffer: goodEmblemBuffer(), visibleColorCount: RECOMMENDED_COLOR_TARGET }),
    );
    expect(findCheck(report.heuristic, 'color-count').status).toBe('pass');
  });

  it('warns above the recommended target but never fails', () => {
    const report = validateReadiness(
      makeInput({ masterBuffer: goodEmblemBuffer(), visibleColorCount: RECOMMENDED_COLOR_TARGET + 1 }),
    );
    const check = findCheck(report.heuristic, 'color-count');
    expect(check.status).toBe('warning');
    expect(report.status).toBe('ready-with-warnings');
  });

  it('describes the target as a recommendation rather than an MGO2 limit', () => {
    const report = validateReadiness(makeInput({ masterBuffer: goodEmblemBuffer(), visibleColorCount: 40 }));
    const advice = findCheck(report.heuristic, 'color-count').advice ?? '';
    expect(advice).toContain('not a confirmed MGO2 limit');
  });
});

describe('validateReadiness — subject occupancy', () => {
  it('warns when visible pixels occupy very little of the placed area', () => {
    const buffer = blankBuffer();
    fillRect(buffer, 120, 120, 12, 12, [255, 255, 255, 255]); // ~0.2% occupancy
    const report = validateReadiness(makeInput({ masterBuffer: buffer }));
    const check = findCheck(report.heuristic, 'subject-occupancy');
    expect(check.status).toBe('warning');
    expect(check.measured?.value ?? 1).toBeLessThan(MIN_SUBJECT_OCCUPANCY);
  });

  it('does not warn merely because Fit mode letterboxes a wide image', () => {
    // Wide image fully covering its placed rect, but only half the canvas.
    const buffer = blankBuffer();
    fillRect(buffer, 0, 64, SIZE, 128, [10, 10, 10, 255]);
    fillRect(buffer, 32, 80, 160, 96, [245, 245, 245, 255]);
    const report = validateReadiness(
      makeInput({ masterBuffer: buffer, placedRect: { x: 0, y: 64, width: SIZE, height: 128 } }),
    );
    expect(findCheck(report.heuristic, 'subject-occupancy').status).toBe('pass');
  });
});

describe('validateReadiness — centring', () => {
  it('passes for centred content', () => {
    const report = validateReadiness(makeInput({ masterBuffer: goodEmblemBuffer() }));
    expect(findCheck(report.heuristic, 'centering').status).toBe('pass');
  });

  it('warns for clearly off-centre content', () => {
    const buffer = blankBuffer();
    fillRect(buffer, 0, 0, 60, 60, [255, 255, 255, 255]); // hard against the top-left corner
    const report = validateReadiness(makeInput({ masterBuffer: buffer }));
    const check = findCheck(report.heuristic, 'centering');
    expect(check.status).toBe('warning');
    expect(check.measured?.value ?? 0).toBeGreaterThan(MAX_CENTER_OFFSET_RATIO);
  });
});

describe('validateReadiness — contrast', () => {
  it('warns for a low-contrast fixture', () => {
    const buffer = blankBuffer();
    fillRect(buffer, 0, 0, SIZE, SIZE, [128, 128, 128, 255]);
    fillRect(buffer, 64, 64, 128, 128, [140, 140, 140, 255]);
    const report = validateReadiness(makeInput({ masterBuffer: buffer }));
    const check = findCheck(report.heuristic, 'contrast');
    expect(check.status).toBe('warning');
    expect(check.measured?.value ?? 1).toBeLessThan(MIN_CONTRAST_SPREAD);
  });

  it('passes for a high-contrast fixture', () => {
    const report = validateReadiness(makeInput({ masterBuffer: goodEmblemBuffer() }));
    const check = findCheck(report.heuristic, 'contrast');
    expect(check.status).toBe('pass');
    expect(check.measured?.value ?? 0).toBeGreaterThanOrEqual(MIN_CONTRAST_SPREAD);
  });
});

describe('validateReadiness — tiny-preview detail density', () => {
  it('passes for a simple, readable 32x32 fixture', () => {
    const report = validateReadiness(makeInput({ masterBuffer: goodEmblemBuffer() }));
    const check = findCheck(report.heuristic, 'tiny-detail-density');
    expect(check.status).toBe('pass');
    expect(check.measured?.value ?? 1).toBeLessThanOrEqual(MAX_TINY_TRANSITION_RATIO);
  });

  it('warns for a highly fragmented, noisy fixture', () => {
    // Deterministic hash noise rather than a regular checkerboard: a 1px
    // checkerboard downscaled by an even factor aliases to a flat colour
    // under nearest-neighbour sampling, so it would not exercise this check.
    const buffer = blankBuffer();
    const noiseAt = (x: number, y: number): number => {
      let h = (x * 374761393 + y * 668265263) | 0;
      h = ((h ^ (h >>> 13)) * 1274126177) | 0;
      return (h ^ (h >>> 16)) & 0xff;
    };
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const value = noiseAt(x, y);
        fillRect(buffer, x, y, 1, 1, [value, value, value, 255]);
      }
    }
    const report = validateReadiness(makeInput({ masterBuffer: buffer }));
    const check = findCheck(report.heuristic, 'tiny-detail-density');
    expect(check.status).toBe('warning');
    expect(check.measured?.value ?? 0).toBeGreaterThan(MAX_TINY_TRANSITION_RATIO);
  });

  it('does not warn when a fine regular pattern aliases away to flat colour at 32x32', () => {
    // Documents real nearest-neighbour behaviour: the check measures the
    // ACTUAL downscaled buffer, so a 1px checkerboard correctly reads as
    // simple at 32x32 even though the master looks busy.
    const buffer = blankBuffer();
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const value = (x + y) % 2 === 0 ? 0 : 255;
        fillRect(buffer, x, y, 1, 1, [value, value, value, 255]);
      }
    }
    const report = validateReadiness(makeInput({ masterBuffer: buffer }));
    expect(findCheck(report.heuristic, 'tiny-detail-density').status).toBe('pass');
  });
});

describe('validateReadiness — edge clarity', () => {
  it('passes for hard-edged content with no partial alpha', () => {
    const report = validateReadiness(makeInput({ masterBuffer: goodEmblemBuffer() }));
    expect(findCheck(report.heuristic, 'edge-clarity').status).toBe('pass');
  });

  it('warns when a large share of visible pixels carry partial alpha', () => {
    const buffer = blankBuffer();
    fillRect(buffer, 0, 0, SIZE, 128, [10, 10, 10, 255]);
    fillRect(buffer, 0, 128, SIZE, 128, [245, 245, 245, 128]); // half the pixels partially transparent
    const report = validateReadiness(makeInput({ masterBuffer: buffer }));
    const check = findCheck(report.heuristic, 'edge-clarity');
    expect(check.status).toBe('warning');
    expect(check.measured?.value ?? 0).toBeGreaterThan(MAX_PARTIAL_ALPHA_RATIO);
  });
});

describe('validateReadiness — determinism', () => {
  it('produces identical reports for identical inputs across repeated runs', () => {
    const input = makeInput({ masterBuffer: goodEmblemBuffer(), visibleColorCount: 20 });
    expect(validateReadiness(input)).toEqual(validateReadiness(input));
  });
});

describe('aggregateStatus — status aggregation rules', () => {
  const pass: ValidationCheck = { id: 'a', label: 'a', kind: 'technical', status: 'pass' };
  const info: ValidationCheck = { id: 'b', label: 'b', kind: 'technical', status: 'info' };
  const techWarning: ValidationCheck = { id: 'c', label: 'c', kind: 'technical', status: 'warning' };
  const techFail: ValidationCheck = { id: 'd', label: 'd', kind: 'technical', status: 'fail' };
  const heuristicWarning: ValidationCheck = { id: 'e', label: 'e', kind: 'heuristic', status: 'warning' };

  it('returns READY when everything passes or is informational', () => {
    expect(aggregateStatus([pass, info], [])).toBe('ready');
  });

  it('returns READY WITH WARNINGS for heuristic warnings only', () => {
    expect(aggregateStatus([pass], [heuristicWarning])).toBe('ready-with-warnings');
  });

  it('returns NOT READY only when a technical check fails', () => {
    expect(aggregateStatus([techFail], [])).toBe('not-ready');
  });

  it('never returns NOT READY from heuristic warnings, no matter how many', () => {
    const manyWarnings = Array.from({ length: 20 }, (_, i) => ({ ...heuristicWarning, id: `w${i}` }));
    expect(aggregateStatus([pass], manyWarnings)).toBe('ready-with-warnings');
  });

  it('treats a technical warning as a warning, not a failure', () => {
    expect(aggregateStatus([techWarning], [])).toBe('ready-with-warnings');
  });

  it('lets a technical failure override any number of passing checks', () => {
    expect(aggregateStatus([pass, pass, techFail, pass], [heuristicWarning])).toBe('not-ready');
  });
});
