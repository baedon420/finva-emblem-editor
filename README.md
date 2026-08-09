# MGO2 Emblem Studio

A browser-based studio for creating clan emblems for **Metal Gear Online 2 (MGO2)**. It turns any image into an emblem that stays readable at the tiny sizes MGO2 actually renders — and lets you fix individual pixels by hand before exporting.

## What it does (current MVP)

- **Optimize mode** — import an image and prepare it non-destructively:
  - Fit / Fill placement with zoom, horizontal/vertical position, and safe padding
  - Background handling: Preserve, make Transparent, or Replace with a flat color (edge-connected removal with a sampled color and adjustable tolerance — enclosed regions of the same color are kept)
  - Palette: keep Original Colors or reduce to a target of 2–32 colors (deterministic median-cut)
- **Pixel Edit mode** — bake a 256×256 editable copy of the optimized output and edit it directly:
  - Pen, Eraser, Eyedropper, and Fill Bucket (iterative, 4-connected, exact-RGBA matching)
  - Global Color Replace with an affected-pixel count
  - Live palette of the edited image (click a swatch to draw with it, right-click to set it as the replace source)
  - 1x–16x zoom with grid overlay, Space+drag / middle-mouse panning
  - 64-step undo/redo (each stroke, fill, or replace is one atomic step)
  - Keyboard shortcuts: **B** pen · **E** eraser · **I** eyedropper · **G** fill · **Ctrl/Cmd+Z** undo · **Ctrl/Cmd+Shift+Z** or **Ctrl+Y** redo
- **Live previews** at 64×64, 41×41, and 32×32 (nearest-neighbor), always reflecting whichever buffer you are editing
- **MGO2 Readiness panel** — technical checks plus estimated visual checks with plain-language advice

## Getting started

```bash
npm install
npm run dev      # start the dev server (Vite prints the local URL)
```

Other commands:

```bash
npm test         # run the full test suite (Vitest)
npm run build    # type-check and produce a production build in dist/
npm run preview  # serve the production build locally
npm run lint     # run oxlint
```

## Supported imports

PNG, JPEG, GIF, and WebP. Transparency in the source is preserved through the whole pipeline. Unsupported, empty, or unreadable files show a plain-language error and leave the current image untouched.

## Exports

All exports are PNG, always scaled with nearest-neighbor:

| File | Size | Source |
| --- | --- | --- |
| `final_emblem.png` | 256×256 | The active buffer (optimized output, or the edited copy in Pixel Edit) |
| `preview_64.png` | 64×64 | Downscale of the active buffer |
| `preview_32.png` | 32×32 | Downscale of the active buffer |

The 41×41 preview is display-only and intentionally **not exportable** (see limitations). Grid lines and the transparency checkerboard are UI overlays only — they never appear in exported files.

## Workflow

1. **Optimize** — upload an image, place it (Fit/Fill, zoom, position, padding), clean the background, and reduce the palette. Everything here is non-destructive and recomputed from the original image.
2. **Bake** — "Create Editable Copy" snapshots the optimized output into a 256×256 editable buffer. The original image and optimizer settings are never modified. If you change optimizer settings later, the copy is flagged as stale and you can re-bake (with an explicit confirmation, since that discards pixel edits).
3. **Pixel Edit** — fix individual pixels, fill regions, replace colors, and watch the small previews until the emblem reads clearly.
4. **Export** — download `final_emblem.png` plus the 64×64 / 32×32 previews.

## Known limitations

- **41×41 is an unconfirmed simulation.** The true MGO2 in-game emblem resolution has not been verified against a reference screenshot; 41×41 is a best-guess approximation and is labeled as such in the app. It is deliberately not exportable.
- **Visual readiness checks are estimates.** The "Visual Estimates" section of the readiness panel uses heuristics (occupancy, centring, contrast, detail density, edge clarity). They can be wrong in both directions — always verify the emblem in MGO2 itself. Only the technical checks are hard guarantees.
- The recommended 16-color working target is guidance for readability, **not** a confirmed MGO2 technical limit.
- Generate mode (AI/prompt-based emblem creation) is not part of the MVP and has no UI yet.
- No Move/Crop inside Pixel Edit, no layers, selections, or dithering.
- Designed for desktop browsers; narrow windows work (panels scroll) but there is no mobile layout.
- Nothing is saved between sessions — export your work.
