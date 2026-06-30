# Plan: Simplify Stitch to HTML Generator Flow

## Goal
Recreate Stitch as a simplified HTML generator: user picks layout → describes desired HTML (with prompt helpers) → LLM generates HTML → preview on screen. Remove all manual canvas editing tools (shapes, text, images, Fabric.js canvas).

## Current Architecture (to be replaced)
- `StitchCanvas.tsx` — Fabric.js interactive canvas (drag/drop/resize shapes, text, images)
- `StitchToolbar.tsx` — Shape tools (rect, circle, triangle, line, star), text, image, HTML, selection tools
- `StitchEditor.tsx` — Full editor with sidebar boards, toolbar, canvas, prompt bar
- `StitchPanel.tsx` — Project grid + create project (name + layout)
- `StitchPromptBar.tsx` — Simple text input, HTML/Image mode toggle
- `StitchExportModal.tsx` — Export HTML preview/source + PNG download
- `StitchImagePicker.tsx` — Upload or AI-generate images

## New Flow
```
[Layout Selection] → [Describe HTML (with prompt chips)] → [LLM generates] → [Preview + Actions]
```

## Files to Modify

### 1. `components/StitchPanel.tsx` — Simplify project creation
- Remove project name input (auto-generate)
- Keep layout selection (16:9, 1:1, 9:16) as the primary action
- Project grid stays for accessing previous generations
- On "New Project" click → show layout picker → immediately create project and open editor

### 2. `components/StitchEditor.tsx` — Complete rewrite (main workspace)
**Remove:**
- Left sidebar (board list, add/delete boards)
- Fabric.js canvas (`StitchCanvas` import)
- Toolbar (`StitchToolbar` import)
- Image picker (`StitchImagePicker` import)
- `StitchControls` interface
- All shape/text/image element handling
- `buildHTMLFromCanvas()` function
- Background color picker

**New layout (single column):**
- Top: Back button + layout selector (16:9 / 1:1 / 9:16 pills) + project title
- Center: HTML preview iframe (fills available space) — shows generated HTML or empty state
- Bottom: Prompt input area with suggestion chips + Generate button

**Prompt suggestion chips (categorized):**
- **Type**: Landing Page, Portfolio, Dashboard, Hero Section, Card Grid, Pricing Table, Contact Form, Testimonial, Footer, Navigation Bar
- **Style**: Modern, Minimalist, Glassmorphism, Neomorphic, Dark Theme, Colorful, Corporate, Playful
- **Color**: Blue Gradient, Purple/Pink, Green/Nature, Warm Sunset, Monochrome, Neon, Earth Tones
- **Layout**: Centered Content, Full Width, Split Screen, Sidebar Layout, Grid Layout, Single Column

User can click chips to build prompt, and/or type freely in the text input.

**Actions after generation:**
- Regenerate (re-send same prompt)
- Edit prompt (modify and regenerate)
- Download HTML
- Copy HTML
- Toggle between Preview / Source Code view (inline, not modal)

### 3. `components/StitchPromptBar.tsx` — Rewrite with suggestion chips
- Remove Image mode toggle (HTML only now)
- Add horizontal scrollable chip categories (Type, Style, Color, Layout)
- Chips are toggleable (add to prompt text)
- Text input for freeform description
- Generate button with loading state

### 4. `components/StitchExportModal.tsx` — Remove (inline preview instead)
Preview and source code viewing moves inline into StitchEditor. Download/copy buttons also inline.

### 5. `components/StitchToolbar.tsx` — Remove entirely

### 6. `components/StitchCanvas.tsx` — Remove entirely

### 7. `components/StitchImagePicker.tsx` — Remove entirely

### 8. `services/stitchService.ts` — Keep as-is
`generateHTML()` and `getLayoutDimensions()` are still needed. `createNewElement()` can be removed.

### 9. `server/routes/stitch.ts` — Keep as-is
The `/api/stitch/generate-html` endpoint already does what we need. Update the system prompt to be more focused on standalone HTML generation (no element descriptions needed).

### 10. `App.tsx` — Simplify stitch controls
- Remove `StitchControls` interface usage
- Remove duplicate/bring-to-front/send-to-back/delete buttons from header
- Remove layout switcher from header (moved into StitchEditor)
- Keep: back button, project title, export button
- Simplify `onControlsChange` to just expose `onExport` and `isGenerating`

### 11. `types.ts` — Clean up Stitch types
- Remove `StitchShapeType`, `StitchElement` (no longer needed)
- Keep `StitchLayout`, `StitchBoard` (simplified — no elements array), `StitchProject`

## Implementation Order
1. Update `types.ts` — simplify Stitch types
2. Rewrite `StitchPromptBar.tsx` — add suggestion chips
3. Rewrite `StitchEditor.tsx` — new layout with inline preview
4. Simplify `StitchPanel.tsx` — streamline project creation
5. Update `App.tsx` — simplify header controls
6. Remove unused files: `StitchToolbar.tsx`, `StitchCanvas.tsx`, `StitchImagePicker.tsx`, `StitchExportModal.tsx`
7. Update `stitchService.ts` — remove `createNewElement()`
8. Update `server/routes/stitch.ts` — simplify system prompt
9. Clean up any remaining imports

## Verification
- Run `npm run dev:all` and test the full flow
- Verify: layout selection → prompt with chips → HTML generation → preview renders correctly
- Verify: download HTML, copy HTML, regenerate all work
- Verify: project list still saves/loads from IndexedDB
