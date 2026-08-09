# Changelog

## v1.0.0 — 2026-08-09

First release: the complete Optimize → Bake → Pixel Edit MVP.

### Optimize pipeline
- Non-destructive pipeline recomputed from the original image on every change: placement → background → palette → 256×256 master canvas, nearest-neighbor scaling enforced throughout.
- Fit / Fill placement with zoom, horizontal/vertical position, and safe padding.

### Background handling
- Preserve, Transparent, and Replace modes with click-to-sample color and adjustable tolerance.
- Removal is edge-connected only: enclosed regions of the background color are kept.

### Palette reduction
- Original Colors, or deterministic median-cut reduction to a 2–32 color target with a live swatch list of resulting colors.

### Tiny previews
- Live 64×64, 41×41, and 32×32 nearest-neighbor previews of the active buffer. The 41×41 preview simulates the approximate (unconfirmed) in-game size and is display-only.

### MGO2 Readiness
- Technical checks (dimensions, PNG path, nearest-neighbor, previews, visible content, alpha validity) plus estimated visual checks (color count, occupancy, centring, contrast, detail density, edge clarity) with plain-language advice. Only technical failures can mark the emblem NOT READY.

### Pixel editor and history
- Baked 256×256 editable copy with stale detection and confirmed re-bake.
- Pen, Eraser, Eyedropper, and iterative 4-connected Fill Bucket; Global Color Replace with affected-pixel count; live palette of the edited image.
- 64-step atomic undo/redo, keyboard shortcuts (B/E/I/G, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y), 1x–16x zoom with grid, Space+drag and middle-mouse panning.

### PNG exports
- `final_emblem.png` (256×256), `preview_64.png`, `preview_32.png` — always from the active buffer, never containing UI overlays. Friendly error handling for unsupported/corrupt imports and failed exports.

### Known limitations
- The 41×41 in-game size is an unconfirmed approximation; visual readiness checks are estimates — verify in MGO2.
- 16 colors is a recommended working target, not a confirmed MGO2 limit.
- No Generate mode, Move/Crop, layers, selections, or dithering; desktop-oriented; no session persistence.
