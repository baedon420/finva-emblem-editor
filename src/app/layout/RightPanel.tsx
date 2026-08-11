import type { PixelBuffer } from '../../core/types';
import type { CheckStatus, ReadinessStatus, ValidationCheck } from '../../core/validation/mgo2Readiness';
import { useProjectStore } from '../../state/projectStore';
import InGamePreview from './InGamePreview';

const STATUS_PRESENTATION: Record<ReadinessStatus, { label: string; className: string }> = {
  ready: { label: 'MGO2 READY', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-600/40' },
  'ready-with-warnings': {
    label: 'MGO2 READY WITH WARNINGS',
    className: 'bg-amber-500/15 text-amber-300 border-amber-600/40',
  },
  'not-ready': { label: 'NOT READY', className: 'bg-red-500/15 text-red-300 border-red-600/40' },
};

const CHECK_ICON: Record<CheckStatus, string> = {
  pass: '✅',
  warning: '⚠',
  fail: '✕',
  info: 'ℹ',
};

const CHECK_TEXT_CLASS: Record<CheckStatus, string> = {
  pass: 'text-neutral-300',
  warning: 'text-amber-300',
  fail: 'text-red-300',
  info: 'text-neutral-400',
};

function formatMeasured(check: ValidationCheck): string | null {
  if (!check.measured) {
    return null;
  }
  const { value, unit } = check.measured;
  if (unit === 'ratio') {
    return `${Math.round(value * 100)}%`;
  }
  if (unit === 'px') {
    return `${value}px`;
  }
  return `${value}`;
}

function CheckRow({ check }: { check: ValidationCheck }) {
  const measured = formatMeasured(check);
  return (
    <li className="mb-2">
      <div className={`flex items-start gap-1.5 text-[11px] leading-snug ${CHECK_TEXT_CLASS[check.status]}`}>
        <span aria-hidden className="shrink-0">
          {CHECK_ICON[check.status]}
        </span>
        <span>
          {check.label}
          {measured !== null && <span className="text-neutral-500"> — {measured}</span>}
        </span>
      </div>
      {check.advice && <p className="ml-5 mt-0.5 text-[10px] leading-snug text-neutral-500">{check.advice}</p>}
    </li>
  );
}

interface RightPanelProps {
  /** Preview buffers from the render pipeline, keyed by size; used by the in-game simulation. */
  previews: Record<number, PixelBuffer> | null;
}

export default function RightPanel({ previews }: RightPanelProps) {
  const validation = useProjectStore((state) => state.validation);
  const hasImage = useProjectStore((state) => state.hasImage);

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-neutral-800 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">In-Game Simulation</h2>
      {hasImage && previews ? (
        <InGamePreview previews={previews} />
      ) : (
        <p className="mb-4 text-xs text-neutral-500">Upload an image to see the in-game simulation.</p>
      )}

      <h2 className="mb-2 border-t border-neutral-800 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        MGO2 Readiness
      </h2>

      {!validation ? (
        <p className="text-xs text-neutral-500">Upload an image to run validation.</p>
      ) : (
        <>
          <div
            className={`mb-4 rounded border px-3 py-2 text-center text-xs font-semibold ${
              STATUS_PRESENTATION[validation.status].className
            }`}
          >
            {STATUS_PRESENTATION[validation.status].label}
          </div>

          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Technical Checks
          </h3>
          <ul className="mb-4">
            {validation.technical.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </ul>

          {validation.heuristic.length > 0 && (
            <>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Visual Estimates
              </h3>
              <ul className="mb-4">
                {validation.heuristic.map((check) => (
                  <CheckRow key={check.id} check={check} />
                ))}
              </ul>
            </>
          )}

          <p className="border-t border-neutral-800 pt-3 text-[10px] leading-snug text-neutral-500">
            Visual checks are estimates. Always verify the emblem in MGO2.
          </p>
        </>
      )}
    </aside>
  );
}
