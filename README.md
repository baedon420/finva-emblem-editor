# FinVa Emblem Editor

A browser-based editor for creating clan emblems for **Metal Gear Online 2 (MGO2)**. It turns any image into an emblem that stays readable at the tiny sizes MGO2 actually renders — and lets you fix individual pixels by hand before exporting.

**▶ Use it in your browser — nothing to install:** https://baedon420.github.io/finva-emblem-editor/

Everything runs locally in your browser; your images are never uploaded anywhere.

## What it does (current MVP)

- **Optimize mode** — import an image and prepare it non-destructively:
  - **Playbook** — pick your image type (photo, logo, cartoon/meme, retro poster art, pixel art, text) to get per-type instructions and one-click recipe settings
  - Fit / Fill placement with zoom, horizontal/vertical position, and safe padding
  - Source Scaling: Auto (smooth resampling when shrinking photos, pixel-perfect when enlarging pixel art), with Smooth/Pixel overrides
  - Background handling: Preserve, make Transparent, or Replace with a flat color (edge-connected removal with a sampled color and adjustable tolerance — enclosed regions of the same color are kept)
  - Adjustments: Auto Levels (5th–95th percentile stretch), Brightness, Contrast, Saturation — plus the **★ Emblemize** one-click photo→emblem preset
  - Palette: keep Original Colors or reduce to a target of 2–32 colors (deterministic median-cut)
- **Pixel Edit mode** — bake a 256×256 editable copy of the optimized output and edit it directly:
  - Pen, Eraser, Eyedropper, and Fill Bucket (iterative, 4-connected, exact-RGBA matching)
  - Global Color Replace with an affected-pixel count
  - Live palette of the edited image (click a swatch to draw with it, right-click to set it as the replace source)
  - 1x–16x zoom with grid overlay, Space+drag / middle-mouse panning
  - 64-step undo/redo (each stroke, fill, or replace is one atomic step)
  - Keyboard shortcuts: **B** pen · **E** eraser · **I** eyedropper · **G** fill · **Ctrl/Cmd+Z** undo · **Ctrl/Cmd+Shift+Z** or **Ctrl+Y** redo
- **Live previews** at 64×64, 41×41, and 32×32 (nearest-neighbor), always reflecting whichever buffer you are editing
- **In-Game Simulation panel** — your emblem at approximate true in-game scale (~20px lobby list, ~16px HUD clan tag) on lobby-row and day/night HUD backdrops modeled from real in-game screenshots
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

## Playbook — handling different image types

The in-app Playbook panel applies these automatically; the short version:

| Source | Recipe | Watch out for |
| --- | --- | --- |
| Photo / portrait | Fill + zoom tight on the face, then Emblemize (auto-levels, contrast +35, saturation +25, 8 colors). Saturation −100 afterward gives a black-and-white poster look. | Warm midtones camouflage into MGO2's tan/brown UI |
| Logo / symbol | Background → Transparent (sample + tolerance), Auto Levels, ~12 colors | Dark logos vanish on the night HUD once their background is removed |
| Cartoon / meme | Contrast +15, ~16 colors — skip Emblemize (it blows out flat skin tones) | Crop to the recognizable element, not the whole panel |
| Retro poster art (Nagel style) | Fill + zoom on the face, contrast +15, saturation +15, 8 colors | Thin line-work vanishes at 16px; pale skin melts into the tan lobby row — replace white backgrounds with black/navy |
| Pixel art | Source Scaling → Pixel, everything else untouched | Any smoothing or palette change ruins it |
| Text / lettering | 1–3 big characters max, contrast +50, 8 colors, white/yellow on dark | A whole word is unreadable at 16px |

Whatever the source: judge the result in the In-Game Simulation panel (the big canvas lies by being large), keep to ≤16 colors, and check the silhouette against both the tan and dark backdrops.

## Known limitations

- **41×41 is an unconfirmed simulation.** The true MGO2 in-game emblem resolution has not been verified against a reference screenshot; 41×41 is a best-guess approximation and is labeled as such in the app. It is deliberately not exportable.
- **Visual readiness checks are estimates.** The "Visual Estimates" section of the readiness panel uses heuristics (occupancy, centring, contrast, detail density, edge clarity). They can be wrong in both directions — always verify the emblem in MGO2 itself. Only the technical checks are hard guarantees.
- The recommended 16-color working target is guidance for readability, **not** a confirmed MGO2 technical limit.
- Generate mode (AI/prompt-based emblem creation) is not part of the MVP and has no UI yet.
- No Move/Crop inside Pixel Edit, no layers, selections, or dithering.
- Designed for desktop browsers; narrow windows work (panels scroll) but there is no mobile layout.
- Nothing is saved between sessions — export your work.
