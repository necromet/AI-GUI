# Stitch Agent Implementation Plan

## Overview
Add a **Stitch** agent to the Experiments mode — a Google Stitch-inspired board/canvas editor where users can create visual designs, generate images via AI, and export to HTML.

## Key Decisions
- **Canvas library**: [Fabric.js](http://fabricjs.com/) — mature, supports drag/drop/resize/rotate, SVG export, image embedding
- **Image generation**: OpenAI GPT Image 2 via new `OPENAI_API_KEY` env var
- **Image reference**: MiMo multimodal API (existing) for understanding reference images
- **Access**: Protected by Experiments password (`ilacknothing`)
- **Persistence**: IndexedDB (new `stitch_boards` object store, DB version 5)

---

## Phase 1 — Foundation (types, DB, deps)

### 1.1 Add Stitch types to `types.ts`
```ts
export type StitchLayout = '16:9' | '1:1' | '9:16'; // 9:16 = Instagram

export interface StitchElement {
  id: string;
  type: 'image' | 'text' | 'shape' | 'html';
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  // type-specific payload
  src?: string;         // image base64/url
  text?: string;        // text content
  fontSize?: number;
  fontFamily?: string;
  fill?: string;        // shape fill color
  shapeType?: 'rect' | 'circle' | 'triangle' | 'line' | 'star';
  html?: string;        // raw HTML snippet
  zIndex: number;
}

export interface StitchBoard {
  id: string;
  projectId: string;
  title: string;
  layout: StitchLayout;
  elements: StitchElement[];
  bgImage?: string;     // background image
  bgColor?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StitchProject {
  id: string;
  title: string;
  boards: StitchBoard[];
  createdAt: number;
  updatedAt: number;
}
```

### 1.2 Extend IndexedDB — `services/databaseService.ts`
- Bump `DB_VERSION` from 4 → 5
- Add `stitch_projects` object store (keyPath: `id`)
- Add migration for `oldVersion < 5`

### 1.3 Add DB adapter functions — `services/databaseAdapter.ts`
- `getStitchProjects()`, `getStitchProject(id)`, `saveStitchProject(project)`, `deleteStitchProject(id)`

### 1.4 Install Fabric.js
```bash
npm install fabric@6
npm install -D @types/fabric
```

---

## Phase 2 — Server: Image Generation Route

### 2.1 Add `.env` var
```
OPENAI_API_KEY=your-openai-key
```

### 2.2 Update `vite.config.ts` define block
Add `process.env.OPENAI_API_KEY` (not strictly needed for server-side, but for consistency).

### 2.3 New server route: `server/routes/stitch.ts`
- `POST /api/stitch/generate-image` — calls OpenAI `gpt-image-2` endpoint
  - Body: `{ prompt: string, size?: string, n?: number }`
  - Returns: `{ images: [{ b64_json: string }] }`
- `POST /api/stitch/generate-html` — calls MiMo to generate HTML from board description
  - Body: `{ boardDescription: string, elements: StitchElement[], layout: StitchLayout }`
  - Returns: `{ html: string }`

### 2.4 Register routes in `server/index.ts`
```ts
import stitchRoutes from './routes/stitch';
app.use('/api/stitch', stitchRoutes);
```

---

## Phase 3 — Client Service Layer

### 3.1 New file: `services/stitchService.ts`
- `generateImage(prompt, size?)` → calls `/api/stitch/generate-image`
- `generateHTML(boardDescription, elements, layout)` → calls `/api/stitch/generate-html`
- `getImageDimensions(dataUrl)` → helper for canvas element sizing

---

## Phase 4 — Frontend Components

### 4.1 `components/StitchPanel.tsx` — Main entry point
- Grid of project cards (like Google Stitch home)
- "New Project" button
- Each project card shows thumbnail grid of its boards
- Clicking a project opens `StitchEditor`

### 4.2 `components/StitchEditor.tsx` — Board editor workspace
- **Left sidebar**: board list (thumbnails), add/delete/reorder boards
- **Center**: Fabric.js canvas rendering the active board
- **Right sidebar**: properties panel for selected element
- **Top bar**: layout selector (16:9 / 1:1 / 9:16), export button, AI prompt bar
- **Bottom**: AI prompt input bar for generating/modifying content

### 4.3 `components/StitchCanvas.tsx` — Fabric.js canvas wrapper
- Initialize Fabric canvas with layout dimensions
- Render `StitchElement[]` as Fabric objects
- Handle selection, move, resize, rotate events
- Sync canvas state back to `StitchElement[]`
- Zoom/pan support

### 4.4 `components/StitchToolbar.tsx` — Element creation toolbar
- **Shapes**: Rectangle, Circle, Triangle, Line, Star (SVG primitives)
- **Text**: Add text box with font controls
- **Image**: Upload from file or generate via AI
- **HTML**: Add raw HTML snippet block

### 4.5 `components/StitchPromptBar.tsx` — AI prompt input
- Text input for describing what to create/modify
- "Generate Image" mode — calls OpenAI gpt-image-2
- "Generate HTML" mode — calls MiMo to create HTML layout from board state
- "Apply to Canvas" — inserts AI-generated content onto the board

### 4.6 `components/StitchImagePicker.tsx` — Image sourcing modal
- **Upload**: file picker for local images
- **AI Generate**: prompt input → gpt-image-2
- **Reference**: paste URL or upload reference image → sent to MiMo for description → used as context for generation

### 4.7 `components/StitchExportModal.tsx` — Export dialog
- Preview rendered HTML in iframe
- Copy HTML to clipboard
- Download as `.html` file
- Export board as PNG (Fabric.js `toDataURL`)

---

## Phase 5 — Wire Into App

### 5.1 Update `types.ts`
- Add `'stitch'` to `activeView` type: `'chat' | 'rag' | 'plugin-agent' | 'stitch'`

### 5.2 Update `App.tsx`
- Import `StitchPanel`
- Add `activeView === 'stitch'` branch in content area
- Set default `activeView` for experiments mode to include stitch

### 5.3 Update `Sidebar.tsx`
- Add "Stitch" nav item with `Layers` icon (lucide) in experiments mode
- Update `activeView` and `onNavigate` types to include `'stitch'`

### 5.4 Update `ModeSelector.tsx`
- Update Experiments card description: "RAG, Plugin Agent, Stitch, and experimental tools"

---

## Phase 6 — Styling & Polish

### 6.1 Canvas styling
- Match app dark/light theme
- Neon accent color for selection handles
- Responsive canvas sizing

### 6.2 Board grid layout
- CSS grid for project cards
- Hover effects matching existing card styles

### 6.3 Animations
- Fade-in for board transitions
- Smooth canvas element additions

---

## Files Modified (existing)
| File | Change |
|------|--------|
| `types.ts` | Add Stitch types, update Mode/activeView |
| `App.tsx` | Import + render StitchPanel |
| `components/Sidebar.tsx` | Add Stitch nav item |
| `components/ModeSelector.tsx` | Update description text |
| `services/databaseService.ts` | DB v5, stitch_projects store |
| `services/databaseAdapter.ts` | Stitch CRUD functions |
| `server/index.ts` | Register stitch routes |
| `.env.example` | Add OPENAI_API_KEY |
| `vite.config.ts` | (optional) Add OPENAI_API_KEY define |

## Files Created (new)
| File | Purpose |
|------|---------|
| `components/StitchPanel.tsx` | Project grid / home view |
| `components/StitchEditor.tsx` | Board editor workspace |
| `components/StitchCanvas.tsx` | Fabric.js canvas wrapper |
| `components/StitchToolbar.tsx` | Shape/text/image toolbar |
| `components/StitchPromptBar.tsx` | AI prompt input bar |
| `components/StitchImagePicker.tsx` | Image source modal |
| `components/StitchExportModal.tsx` | Export HTML/PNG modal |
| `services/stitchService.ts` | Client API calls |
| `server/routes/stitch.ts` | Server image gen + HTML gen routes |

## Dependencies Added
| Package | Purpose |
|---------|---------|
| `fabric@6` | Interactive canvas with drag/drop/resize |
| `@types/fabric` | TypeScript types for Fabric.js |

---

## Implementation Order
1. Types + DB migration + adapter
2. `npm install fabric @types/fabric`
3. Server route (`server/routes/stitch.ts`) + register in `index.ts`
4. Client service (`services/stitchService.ts`)
5. `StitchPanel.tsx` (project grid)
6. `StitchCanvas.tsx` (Fabric.js wrapper)
7. `StitchToolbar.tsx` (element tools)
8. `StitchEditor.tsx` (compose canvas + toolbar + sidebar)
9. `StitchPromptBar.tsx` (AI generation)
10. `StitchImagePicker.tsx` (image sourcing)
11. `StitchExportModal.tsx` (HTML export)
12. Wire into App.tsx, Sidebar.tsx, ModeSelector.tsx
13. Test end-to-end
