# MGO2 EMBLEM STUDIO — DEVELOPMENT BIBLE v1.0

## 1. PROJECT OVERVIEW

### Product Name
**MGO2 Emblem Studio**

### Product Goal
Build the best possible application for creating, optimizing, editing, and exporting images for **Metal Gear Online 2 (MGO2) clan emblems**.

The app must help a user take **almost any source image** — photo, cartoon, logo, meme, symbol, or existing pixel art — and convert it into a visually clear, MGO2-friendly emblem that stays readable when shown very small in-game.

The app should combine:
1. **Generator tools** for creating emblem-style art from prompts or source images
2. **Optimizer tools** for making images MGO2-ready
3. **Manual pixel editing tools** inspired by the original in-game MGO2 emblem editor

---

## 2. CORE PRODUCT PROMISE

> If an image can reasonably be represented as an MGO2 clan emblem, the application should help the user get it there while preserving clarity, silhouette, and recognizability at small in-game display sizes.

---

## 3. IMPORTANT MGO2 FACTS AND KNOWN CONSTRAINTS

These are known facts from user testing and must be treated as authoritative unless later contradicted by real testing:

### Technical Constraints
- **MGO2 rejects JPEG**
- Final export must be **PNG**
- Emblems are viewed extremely small in practice
- Practical readability must be tested at approximately:
  - **32×32**
  - **64×64**
- **Nearest-neighbor scaling is required**
- Smooth scaling / bilinear / bicubic / antialiasing should not be used for final pixel-art resizing
- Clear silhouette is more important than fine detail
- Facial features and small elements easily disappear at small size
- A visually good large image can still fail as an in-game emblem if it does not read well at small size

### Working Assumption
- The application should maintain a **master working canvas** and generate MGO2-friendly output from it.
- Current known user workflow emphasizes **256×256 PNG output**, but tiny in-game readability matters more than large-canvas beauty.

### Design Truth
MGO2 emblem success is determined by:
- **recognizable silhouette**
- **strong contrast**
- **simplified readable shapes**
- **limited clean color usage**
- **nearest-neighbor pixel preservation**
- **successful 32×32 / 64×64 readability**

---

## 4. PRODUCT VISION

This app is not just a color reducer.

This app is a purpose-built **MGO2 emblem creation system**.

It must outperform:
- generic image editors
- low-quality pixel converters
- older MGO2 emblem generators
- simple upload → reduce-color tools

The app should feel like a modernized version of the original MGO2 emblem workflow:
- pixel-first
- grid-aware
- palette-aware
- small-preview-driven
- simple, fast, and practical

---

## 5. USER TYPES

### Primary User
A person who wants to create MGO2-ready clan emblems from:
- memes
- logos
- cartoons
- tactical symbols
- clan icons
- portraits
- animal mascots
- skulls / robots / patches
- random images

### Secondary Users
- MGO2r community members
- players who want to make readable in-game emblems quickly
- users who want AI assistance but still need manual correction tools

---

## 6. PRIMARY USE CASES

The app must support these workflows:

### Use Case A — Optimize Existing Image
1. Upload an image
2. Crop / center subject
3. Clean background or preserve it
4. Reduce palette
5. Improve silhouette
6. Resize with nearest-neighbor
7. Preview at 32×32 / 64×64
8. Make manual fixes
9. Export PNG

### Use Case B — Generate New Emblem
1. Enter a text prompt or upload a reference
2. Generate an MGO2-style image
3. Optimize it for readability
4. Manually fix if needed
5. Export PNG

### Use Case C — Manual Pixel Edit
1. Start from blank or imported image
2. Use pixel tools to edit directly
3. Preview at tiny sizes
4. Export PNG

---

## 7. PRODUCT MODES

The application must have **three clearly separated modes**.

# MODE 1 — GENERATE
AI may reinterpret or redraw the source.

### Purpose
Create new MGO2-style emblem artwork from:
- prompt only
- uploaded image
- uploaded image + instructions

### Allowed Actions
- Stylize
- Simplify
- Redraw
- Recompose
- Background replacement
- Generate original emblem art

### Notable Requirement
Generation should aim for:
- bold silhouette
- simplified readable detail
- approximately 16 colors
- pixel-art-friendly structure
- subject readability at small size

---

# MODE 2 — OPTIMIZE
AI and processing tools must preserve the image as much as possible.

### Purpose
Take an existing image and make it MGO2-ready **without needlessly regenerating it**.

### Hard Rule
> **Optimize Mode must never regenerate the image unless the user explicitly requests regeneration.**

### Allowed Actions
- Crop
- Center
- Add padding
- Background removal
- Background preservation
- Background replacement
- Palette reduction
- Color cleanup
- Edge cleanup
- Contrast tuning
- Dithering
- Nearest-neighbor resizing
- 32×32 / 64×64 preview generation
- Export

### Forbidden Behavior
- Reimagining the subject
- Inventing new subject details
- Replacing the art style unless requested
- Redrawing the image when a technical optimization would suffice

---

# MODE 3 — PIXEL EDIT
Manual editing mode inspired by the original MGO2 in-game editor.

### Purpose
Allow direct user control over final emblem details.

### Must Support
- pixel grid editing
- pen
- eraser
- eyedropper
- fill
- move
- crop
- undo/redo
- palette editing
- color replace
- zoom
- preview pane

---

## 8. HARD RULES

These rules are critical.

### General Rules
1. Final export must be **PNG**
2. Final resizing must use **nearest-neighbor only**
3. The app must always show **small preview simulations**
4. Tiny-size readability is more important than large-size complexity
5. Strong silhouette is mandatory
6. Background must not overpower the subject

### Optimize Mode Rules
1. Never regenerate unless explicitly asked
2. Preserve the original subject identity
3. Preserve original composition when possible
4. Prefer technical cleanup over creative reinterpretation
5. Preserve the original pixels whenever possible in image-preservation workflows

### Generate Mode Rules
1. Subject must remain readable at 32×32
2. Shapes must be simplified for emblem use
3. Avoid unnecessary micro-detail
4. Favor high contrast and limited palettes
5. Generated art should look suitable for PSP-era / MGO2-inspired emblem usage

### Pixel Edit Rules
1. Editing must snap to pixel logic
2. Grid mode must be available
3. Previews must update live
4. User changes must not be softened by smoothing filters

---

## 9. INPUT TYPES

The app should accept:
- PNG
- JPG / JPEG (for import only, then convert internally)
- GIF (static first; animated support optional later)
- WebP (optional)
- Prompt-only generation
- Image + prompt
- Blank canvas

### Supported Subject Types
- photos
- memes
- cartoons
- pixel art
- logos
- tactical icons
- text-based marks
- mascots
- portraits
- animals
- robots
- skulls
- clan badges

---

## 10. OUTPUT TYPES

### Required Exports
- **final_emblem.png**
- **preview_64.png**
- **preview_32.png**

### Nice-to-Have Exports
- **optimized_master.png**
- **palette.png**
- **project file** (custom format for reopening work later)

### Required Output Condition
- PNG only for final MGO2 export

---

## 11. MGO2 READINESS VALIDATION

The application should include an automated **MGO2 Readiness** system.

### Output States
- **MGO2 READY**
- **MGO2 READY WITH WARNINGS**
- **NOT READY**

### Validation Criteria
Check:
- PNG export format
- nearest-neighbor usage
- image dimensions
- estimated readability at 32×32
- estimated readability at 64×64
- subject centering
- subject/background separation
- color count
- anti-aliasing presence
- edge clarity
- contrast strength
- silhouette integrity

### Example Warning Messages
- `⚠ Too many fine details may disappear at 32×32`
- `⚠ Background competes with subject`
- `⚠ Low contrast detected`
- `⚠ Subject too small within frame`
- `⚠ Anti-aliased edge pixels detected`

### Example Success Messages
- `✅ PNG export`
- `✅ Nearest-neighbor scaling confirmed`
- `✅ Strong silhouette`
- `✅ Clear 32×32 readability`
- `✅ Good subject centering`

### Optional Score
Provide a score such as:
**MGO2 Readiness Score: 0–100**

Suggested weighted areas:
- silhouette: 25
- contrast: 20
- tiny-preview readability: 25
- clean edges: 15
- background separation: 10
- palette cleanliness: 5

---

## 12. IMAGE PROCESSING PIPELINE

The optimizer should roughly follow this sequence:

1. **Import image**
2. **Analyze subject and background**
3. **Detect subject bounds**
4. **Crop / center subject**
5. **Apply safe padding**
6. **Choose background strategy**
   - preserve
   - remove
   - replace
   - simplify
7. **Simplify detail**
8. **Reduce palette**
9. **Improve contrast**
10. **Clean edges**
11. **Apply optional dithering**
12. **Generate nearest-neighbor resized outputs**
13. **Preview at 256 / 64 / 32**
14. **Run MGO2 validation**
15. **Allow manual edit**
16. **Export PNGs**

---

## 13. BACKGROUND HANDLING

The app must support three background strategies:

### A. Preserve Original Background
Use when background is part of the visual joke, identity, or composition.

Requirements:
- keep main scenery
- simplify it
- reduce its detail relative to the subject
- prevent it from overwhelming the emblem

### B. Replace Background
User may choose:
- chroma key green
- transparent
- flat color
- simple pixel background
- custom uploaded background

### C. Remove Background
For isolated emblem subjects.

### Background Rule
> Background detail must always be subordinate to subject readability.

---

## 14. PALETTE ENGINE

### Goal
Help images stay visually clean and MGO2-friendly.

### Requirements
- Show active palette
- Count colors
- Reduce colors automatically
- Allow manual palette locking
- Allow manual color replacement
- Offer palette presets

### Suggested Presets
- Tactical
- Cartoon
- Skull / Dark
- Animal
- Robot / Mech
- Warm Vintage
- Grayscale
- High Contrast
- MGO2 Classic

### Important Rule
The palette engine should prioritize **readability**, not just mathematical color reduction.

---

## 15. PIXEL ENGINE

### Requirements
- nearest-neighbor scaling only for final output
- no unintentional smoothing
- visible grid overlay
- pixel snapping behavior where appropriate
- preserve hard edges
- allow manual pixel-level cleanup

### Edge Handling
The system should detect and optionally fix:
- anti-aliased fringe pixels
- muddy transitions
- outline breaks
- weak silhouette edges

---

## 16. PREVIEW SYSTEM

This is one of the most important features.

### Required Previews
- Main working preview
- **64×64 preview**
- **32×32 preview**
- optionally a “simulated in-game” preview panel

### Purpose
Users must see what the emblem actually looks like when tiny.

### Rules
- previews must update live
- previews must represent nearest-neighbor results
- previews should be easy to compare side by side

### Optional Comparison Toggle
- Original
- Optimized
- Generated
- 64×64
- 32×32
- in-game simulation

---

## 17. MANUAL EDITOR REQUIREMENTS

The editor should be inspired by the original MGO2 editor philosophy.

### Must-Have Tools
- Pen
- Eraser
- Eyedropper
- Fill bucket
- Color replace
- Move
- Crop
- Undo
- Redo
- Zoom
- Grid mode
- Palette panel

### Nice-to-Have Tools
- Mirror draw
- Outline generator
- Dither brush
- Magic wand / region select
- Layer-lite support
- Before/after toggle

### Editor UI Philosophy
- simple
- fast
- practical
- pixel-focused
- not bloated

---

## 18. UI / UX LAYOUT

Recommended layout:

### Left Panel
- file upload
- mode selector
- generation presets
- optimization settings

### Center
- main editing canvas
- zoomed pixel view
- optional grid overlay

### Right Panel
- palette
- layers/project info (if implemented)
- MGO2 readiness score
- warnings
- export controls

### Bottom / Side Preview Area
- 256 preview
- 64 preview
- 32 preview
- optional in-game UI mock preview

### Top Toolbar
- undo / redo
- mode switching
- save / export
- zoom
- grid toggle

---

## 19. GENERATION PRESETS

These presets should exist in Generate Mode:

- Cartoon
- Meme
- Skull
- Tactical
- Animal
- Robot / Mech
- Portrait
- Clan Logo
- Military Patch
- Retro Game Hero
- Preserve Background
- Chroma Background
- Transparent Background

Each preset should bias:
- shape simplification
- outline strength
- palette style
- contrast
- detail level
- background treatment

---

## 20. DESIGN PRINCIPLES FOR GOOD MGO2 EMBLEMS

The system should optimize toward these truths:

1. **Silhouette first**
2. **Readable face or subject features**
3. **Strong contrast**
4. **Limited detail**
5. **Clear subject separation**
6. **Readable at tiny size**
7. **Background supports, never competes**
8. **Pixel edges remain crisp**
9. **Nearest-neighbor is mandatory**
10. **Export must be easy and reliable**

---

## 21. BENCHMARKS AND REFERENCES

The app should be designed to improve on these categories of existing tools:

### A. Original MGO2 In-Game Editor
Strengths:
- pixel-first
- grid-aware
- palette-aware
- preview-driven
- simple focused tools

This app should preserve that philosophy.

### B. Older Community Generators
Some older tools:
- perform color reduction
- allow import and limited editing
- are helpful but incomplete

This app should exceed them by adding:
- real optimization logic
- better readability analysis
- better previews
- better export workflow
- manual correction tools
- optional AI support

---

## 22. NON-GOALS

The first version does **not** need to be:
- a full Photoshop replacement
- a general digital painting app
- a huge social platform
- a modern AAA art suite
- a giant animation system

The app is focused on one job:
> make images work well as MGO2 clan emblems

---

## 23. MVP SCOPE

The fastest useful MVP should include:

### Required for MVP
- Image upload
- PNG export
- Crop / center
- Background preserve/remove/replace
- Palette reduction
- Nearest-neighbor resizing
- 32×32 and 64×64 previews
- MGO2 readiness validation
- Grid mode
- Pen / eraser / eyedropper
- Undo / redo
- Palette panel

### Optional for MVP
- Simple Generate Mode
- One or two presets
- Basic contrast cleanup
- Simple background simplification

### Post-MVP
- stronger AI generation
- saved projects
- more presets
- advanced validation
- batch processing
- project history
- community preset sharing

---

## 24. RECOMMENDED TECHNICAL DIRECTION

Claude may choose exact implementation, but these are recommended principles.

### App Type
Prefer:
- **local-first web app**
- installable PWA if possible

Why:
- easy to run
- easy to share
- can work locally
- avoids complex server dependency for early versions
- image processing can happen client-side

### Suggested Stack
Claude may adapt, but recommended:
- **Next.js** or **React**
- **TypeScript**
- **HTML Canvas** or similar pixel-capable rendering layer
- local image processing
- modular pipeline architecture

### Architecture Principles
- keep generator, optimizer, and editor separate
- keep validation modular
- keep image pipeline deterministic where possible
- preserve non-destructive workflow where practical

---

## 25. ACCEPTANCE TESTS

The app is successful if it can do the following:

### Test 1 — Meme Input
Upload a meme face and produce a readable tiny emblem.

### Test 2 — Cartoon Input
Upload a cartoon dolphin with background and preserve both subject and scene in emblem form.

### Test 3 — Logo Input
Upload a logo and keep it crisp and centered.

### Test 4 — Photo Input
Upload a portrait and simplify it into a readable emblem.

### Test 5 — Pixel Preservation
Import existing pixel art and resize/export without blurring.

### Test 6 — Optimize Only
Optimize an image without regenerating or reimagining it.

### Test 7 — Export
Export valid PNG files that the user can reliably save and use.

---

## 26. CLAUDE BUILD INSTRUCTIONS

Claude, follow these instructions:

1. This document is authoritative.
2. Do not invent behavior that conflicts with this document.
3. When in doubt, prioritize **MGO2 compatibility and tiny-size readability** over large-size visual flourish.
4. In Optimize Mode, **preserve the original image** unless explicit regeneration is requested.
5. Final resizing for emblem output must use **nearest-neighbor only**.
6. Tiny preview quality is a first-class product feature, not an afterthought.
7. Build the MVP first.
8. Prefer working software over speculative complexity.
9. Keep the UI simple and efficient.
10. Preserve a clean path for future expansion into better AI generation and more advanced editing.

---

## 27. PHASED DEVELOPMENT PLAN

### Phase 1 — MVP
- upload
- crop / center
- palette reduction
- nearest-neighbor export
- 32×32 and 64×64 previews
- simple pixel editor
- validation
- PNG export

### Phase 2 — Better Optimizer
- smarter subject detection
- anti-alias cleanup
- better background simplification
- silhouette scoring
- contrast scoring

### Phase 3 — Generator Layer
- text-to-emblem workflow
- image-to-emblem stylization
- preset library
- background strategy presets

### Phase 4 — Advanced Features
- save projects
- project history
- batch optimization
- in-game UI mock previews
- community preset import/export

---

## 28. OPEN QUESTIONS / FUTURE RESEARCH

These are useful future discoveries but should not block MVP:
- exact original internal MGO2 emblem grid resolution
- exact in-game palette limitations, if any
- exact file size limitations, if any
- better simulation of how MGO2 renders emblems in all UI contexts
- whether more faithful legacy editor UI emulation is valuable

---

## 29. FINAL PRODUCT SUMMARY

MGO2 Emblem Studio should become:

- the best **optimizer**
- the best **manual pixel emblem editor**
- eventually the best **AI-assisted emblem generator**

for making MGO2-ready clan emblems from nearly any source image.

The product should feel like:
- a respectful evolution of the original MGO2 emblem editor
- smarter than old community tools
- easier than doing everything by hand
- more trustworthy than generic AI generators

---

# CLAUDE KICKOFF PROMPT

You can paste this after the Bible:

---

**Claude, build this application according to the Development Bible above. Start with the MVP only.**

### Immediate MVP requirements:
- local-first web app
- upload image
- crop and center subject
- preserve/remove/replace background
- palette reduction
- nearest-neighbor scaling
- live 32×32 and 64×64 previews
- basic pixel editor with:
  - pen
  - eraser
  - eyedropper
  - undo/redo
  - grid toggle
  - zoom
- MGO2 readiness panel
- PNG export

### Additional implementation guidance:
- use a clean modular architecture
- use TypeScript
- keep Generate, Optimize, and Pixel Edit modes separated in the codebase
- prioritize correctness and working export flow
- do not overbuild the UI
- give me a usable MVP quickly, then iterate

### Deliverables:
1. project structure
2. tech stack choice
3. MVP feature breakdown
4. build plan
5. first implementation pass

---
