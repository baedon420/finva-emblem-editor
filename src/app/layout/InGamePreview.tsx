import { useEffect, useRef } from 'react';
import type { PixelBuffer } from '../../core/types';

/** Approximate emblem display size on the lobby/briefing player list. */
export const LOBBY_EMBLEM_SIZE = 20;
/** Approximate emblem display size next to the clan name in the match HUD. */
export const HUD_EMBLEM_SIZE = 16;

/** Paints a preview buffer at its native pixel size — no scaling, so the
 *  simulation shows honest in-game scale rather than a flattering blow-up. */
function EmblemCanvas({ buffer }: { buffer: PixelBuffer | undefined }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !buffer) {
      return;
    }
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(new ImageData(buffer.data, buffer.width, buffer.height), 0, 0);
  }, [buffer]);

  if (!buffer) {
    return null;
  }
  return <canvas ref={ref} className="shrink-0" style={{ width: buffer.width, height: buffer.height }} />;
}

interface InGamePreviewProps {
  /** Preview buffers from the render pipeline, keyed by size. */
  previews: Record<number, PixelBuffer> | null;
}

/**
 * Mock-ups of the two places a clan emblem actually appears in MGO2 —
 * the lobby/briefing player list and the in-match HUD clan tag — with row
 * colors, text colors, and emblem sizes approximated from real in-game
 * reference screenshots (savemgo revival, captured 2026-08). The HUD is shown
 * over both a daylight and a night backdrop because the tag renders straight
 * over the scene.
 */
export default function InGamePreview({ previews }: InGamePreviewProps) {
  const lobbyBuffer = previews?.[LOBBY_EMBLEM_SIZE];
  const hudBuffer = previews?.[HUD_EMBLEM_SIZE];

  return (
    <div className="mb-4">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Lobby player list (~{LOBBY_EMBLEM_SIZE}px)
      </h3>
      <div className="mb-3 overflow-hidden rounded border border-neutral-800 font-mono">
        <div className="flex items-center gap-2 px-2 py-1" style={{ backgroundColor: '#1a110a' }}>
          <EmblemCanvas buffer={lobbyBuffer} />
          <span className="text-[11px] font-bold tracking-wide" style={{ color: '#d95c40' }}>
            PlayerName
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-2 py-1"
          style={{ background: 'linear-gradient(#c59d6b, #a37b48)' }}
        >
          <EmblemCanvas buffer={lobbyBuffer} />
          <span className="text-[11px] font-bold tracking-wide" style={{ color: '#7c1f12' }}>
            PlayerName
          </span>
        </div>
      </div>

      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Match HUD clan tag (~{HUD_EMBLEM_SIZE}px)
      </h3>
      <div className="mb-2 flex gap-2">
        {[
          { label: 'Day', backdrop: 'linear-gradient(#b3a68d, #94886d)' },
          { label: 'Night', backdrop: 'linear-gradient(#1b1710, #100d08)' },
        ].map(({ label, backdrop }) => (
          <div
            key={label}
            className="flex-1 rounded border border-neutral-800 p-2"
            style={{ background: backdrop }}
          >
            <div className="mb-1.5 h-2.5 w-full rounded-sm border border-black/30 bg-gradient-to-b from-[#8f2b1a] to-[#6e1f10]" />
            <div className="flex items-center gap-1.5">
              <EmblemCanvas buffer={hudBuffer} />
              <span className="font-mono text-[10px] font-semibold" style={{ color: '#e08a63' }}>
                ClanName
              </span>
            </div>
            <p className="mt-1.5 text-right text-[9px] uppercase tracking-wide text-neutral-100/40">{label}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] leading-snug text-neutral-500">
        Approximate simulation. Sizes and backdrops measured from real lobby/HUD screenshots — the HUD tag
        draws over whatever is behind it, so both lighting extremes are shown.
      </p>
    </div>
  );
}
