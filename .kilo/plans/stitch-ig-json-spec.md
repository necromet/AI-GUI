# Plan: Stitch IG Carousel/Story — JSON Spec Architecture + RAG Component Library

## Problem

IG carousels and stories currently generate raw HTML per slide. This causes:

- **Token bloat** — ~1200 tokens/slide of boilerplate (`<!DOCTYPE>`, `<html>`, `<head>`, `<meta>`, `<style>`, `<body>`)
- **Inconsistency** — Each slide is independent; fonts, colors, spacing drift between slides
- **No reuse** — No component library; the AI invents everything from scratch each time
- **Slow generation** — 10-slide carousel = ~12k output tokens, most of it redundant structure

## Solution Overview

Replace raw HTML generation for IG content with a **structured JSON design spec** that a deterministic renderer converts to HTML for preview/export. Add a **RAG-powered component library** so the AI can search and compose from reusable building blocks.

```
User prompt + chips + RAG context
    ↓
AI generates JSON spec (not HTML)
    ↓
Renderer converts JSON → HTML (deterministic)
    ↓
Preview in iframe / Export to PNG
```

Website projects keep the current HTML generation approach unchanged.

---

## Phase 1: JSON Design Spec Schema + Types

### New file: `types/stitchSpec.ts`

Define the structured spec types:

```typescript
// Theme — shared across all slides in a project
interface StitchTheme {
  fonts: { heading: string; body: string };
  colors: Record<string, string>;  // bg, text, accent, secondary, etc.
  borderRadius: string;
  spacing: string;
}

// Element types that can appear on a slide
type StitchElement =
  | { type: 'heading'; text: string; size?: string; weight?: string; color?: string; align?: string }
  | { type: 'body'; text: string; size?: string; color?: string; opacity?: number }
  | { type: 'image'; src: string; alt?: string; fit?: string; radius?: string; width?: string; height?: string }
  | { type: 'icon'; name: string; size?: string; color?: string; library?: 'lucide' | 'heroicons' }
  | { type: 'svg'; content: string; width?: string; height?: string }
  | { type: 'shape'; shape: 'circle' | 'rect' | 'triangle' | 'line'; x?: string; y?: string; width?: string; height?: string; color?: string; opacity?: number }
  | { type: 'spacer'; height: string }
  | { type: 'divider'; color?: string; thickness?: string }
  | { type: 'card'; elements: StitchElement[]; bg?: string; border?: string; radius?: string; padding?: string }
  | { type: 'list'; items: string[]; icon?: string; style?: 'bullet' | 'number' | 'check' }
  | { type: 'button'; text: string; bg?: string; color?: string; radius?: string; size?: string }
  | { type: 'badge'; text: string; bg?: string; color?: string }
  | { type: 'progress'; value: number; label?: string; color?: string }
  | { type: 'quote'; text: string; author?: string }
  | { type: 'swipe-indicator'; direction?: 'left' | 'right' }
  | { type: 'cta'; text: string; subtitle?: string; icon?: string };

// Background
type StitchBackground =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; from: string; to: string; direction?: string }
  | { type: 'image'; src: string; overlay?: string; blur?: string }
  | { type: 'pattern'; pattern: 'dots' | 'grid' | 'waves'; color: string; bg?: string };

// Layout presets
type StitchSlideLayout =
  | 'centered'           // Single column, vertically centered
  | 'split-left'         // Text left, visual right
  | 'split-right'        // Visual left, text right
  | 'top-bottom'         // Header area + body area
  | 'hero'               // Big headline + subtitle + CTA
  | 'listicle'           // Title + numbered list
  | 'quote-card'         // Centered quote
  | 'full-image'         // Full-bleed image + overlay text
  | 'grid-2x2'           // 4 items in a grid
  | 'comparison'         // Side-by-side comparison
  | 'custom'             // Absolute positioning (elements use x/y)

// Single slide
interface StitchSlideSpec {
  layout: StitchSlideLayout;
  elements: StitchElement[];
  background?: StitchBackground;
  overlay?: { color: string; opacity: number };
  padding?: string;
}

// Complete design spec for a project
interface StitchDesignSpec {
  version: 1;
  theme: StitchTheme;
  slides: StitchSlideSpec[];
  metadata?: {
    title: string;
    projectType: 'ig-carousel' | 'ig-story';
    slideCount: number;
  };
}
```

### Changes to `types.ts`

Add optional `designSpec` field to `StitchBoard`:

```typescript
interface StitchBoard {
  // ... existing fields ...
  designSpec?: StitchSlideSpec;  // NEW: structured spec (IG content)
}
```

Add to `StitchProject`:

```typescript
interface StitchProject {
  // ... existing fields ...
  theme?: StitchTheme;  // NEW: shared theme for IG content
}
```

---

## Phase 2: Spec Renderer

### New file: `lib/stitchRenderer.ts`

A pure function that converts `StitchDesignSpec` → HTML string. No AI involved.

```typescript
function renderSlide(spec: StitchSlideSpec, theme: StitchTheme, layout: StitchLayout): string {
  // Returns complete <!DOCTYPE html> string
  // Handles:
  // - Theme → CSS variables
  // - Layout preset → flexbox/grid positioning
  // - Elements → HTML tags with inline styles
  // - Background → CSS background property
  // - Images → <img> with object-fit
  // - Icons → inline SVG (from a bundled icon set or placeholder)
  // - Swipe indicators → CSS-only animation
}

function renderAllSlides(spec: StitchDesignSpec, layout: StitchLayout): string[] {
  return spec.slides.map(slide => renderSlide(slide, spec.theme, layout));
}
```

### Layout engine

Each `StitchSlideLayout` maps to a CSS layout function:

| Layout | CSS |
|--------|-----|
| `centered` | `display:flex; flex-direction:column; align-items:center; justify-content:center` |
| `split-left` | `display:grid; grid-template-columns: 1fr 1fr; align-items:center` |
| `hero` | `display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center` |
| `listicle` | `display:flex; flex-direction:column; padding: 10%` |
| `full-image` | `position:relative` with absolute text overlay |
| `custom` | Elements use `x`/`y` for absolute positioning |

### Icon handling

For Phase 1, icons render as **inline SVG placeholders** (a circle with the icon name). Phase 2 can bundle Lucide icons or use a CDN reference in the renderer output.

---

## Phase 3: Server-Side Changes

### New route: `server/routes/stitch.ts` — generate spec endpoint

Add a new endpoint `POST /api/stitch/generate-spec` alongside the existing `generate-html`:

```typescript
router.post('/generate-spec', async (req, res) => {
  const { prompt, layout, projectType, slideCount, theme, images, model, provider, stream, currentSpec, referenceSpec } = req.body;
  
  // System prompt tells the AI to output JSON spec, not HTML
  const systemPrompt = buildSpecSystemPrompt(layout, projectType, slideCount, theme, images, referenceSpec);
  
  // ... stream/return JSON spec ...
  
  // If not streaming, validate JSON and return
  // If streaming, accumulate and validate at end
});
```

### New file: `server/services/stitchSpecPrompt.ts`

System prompt for JSON spec generation:

```
You are an expert visual designer. Output a JSON design spec (NOT HTML).

OUTPUT FORMAT: Valid JSON matching this schema:
{
  "version": 1,
  "theme": { "fonts": {...}, "colors": {...}, "borderRadius": "...", "spacing": "..." },
  "slides": [
    {
      "layout": "centered|split-left|hero|...",
      "elements": [
        { "type": "heading", "text": "...", "size": "48px" },
        { "type": "body", "text": "..." },
        ...
      ],
      "background": { "type": "gradient", "from": "...", "to": "..." }
    }
  ]
}

RULES:
- Output ONLY valid JSON. No markdown fences, no explanation.
- The "theme" object must be consistent across all slides.
- Use element types: heading, body, image, icon, svg, shape, spacer, divider, card, list, button, badge, progress, quote, swipe-indicator, cta
- Use layouts: centered, split-left, split-right, top-bottom, hero, listicle, quote-card, full-image, grid-2x2, comparison, custom
- Mobile-first: large text (min 24px body for IG), high contrast, bold typography
- 5% safe margins on all edges
- For carousels: slide 1 hooks attention, middle slides deliver one point each, last slide has CTA
- For stories: keep text in center 80%, top 15% and bottom 20% are IG UI zones
```

### Modify: `server/routes/agent.ts`

When `context.projectType` is `ig-carousel` or `ig-story`, use the spec-based tool instead of HTML generation:

- New tool: `generate_spec` — generates JSON design spec
- New tool: `edit_spec` — applies targeted edits to spec (change text, colors, layout)
- Keep `generate_html` and `edit_html` for website projects

### Modify: `server/services/agentService.ts`

Add new tool definitions:

```typescript
{
  name: 'generate_spec',
  description: 'Generate a JSON design spec for IG content. Outputs structured JSON, not HTML.',
  parameters: {
    prompt: { type: 'string', description: 'Design description' },
    slideCount: { type: 'number', description: 'Number of slides (for carousels)' },
  },
},
{
  name: 'edit_spec',
  description: 'Edit specific fields in a design spec. Use JSON path notation.',
  parameters: {
    edits: { type: 'array', description: 'Array of { path, value } edits' },
  },
}
```

---

## Phase 4: Client-Side Changes

### Modify: `services/stitchService.ts`

Add spec generation function:

```typescript
export async function generateSpec(
  prompt: string,
  layout: StitchLayout,
  projectType: StitchProjectType,
  slideCount: number,
  theme?: StitchTheme,
  currentSpec?: StitchDesignSpec,
  model?: string,
  provider?: string,
): Promise<StitchDesignSpec> { ... }

export async function* generateSpecStream(...): AsyncGenerator<StitchStreamChunk> { ... }
```

### Modify: `components/StitchEditor.tsx`

The main change — when `project.projectType` is `ig-carousel` or `ig-story`:

1. **Generation flow**: Call `generate-spec` instead of `generate-html`. Store the returned `StitchDesignSpec` in state.
2. **Rendering**: After spec is received, call `renderSlide()` to produce HTML for preview. Each slide renders independently.
3. **Editing**: Chat modifications edit the spec (via `edit_spec` tool), then re-render.
4. **Preview**: Still uses `<iframe srcDoc={renderedHtml}>` — no change to preview infrastructure.
5. **Board storage**: Store both `designSpec` and `generatedHtml` (renderer output) on each board.

```typescript
// New state
const [designSpec, setDesignSpec] = useState<StitchDesignSpec | null>(null);

// After spec generation
const handleSpecGenerated = (spec: StitchDesignSpec) => {
  setDesignSpec(spec);
  // Render each slide to HTML
  spec.slides.forEach((slide, i) => {
    const html = renderSlide(slide, spec.theme, layout);
    updateBoardAt(i, { generatedHtml: html, designSpec: slide });
  });
};
```

### Modify: `components/StitchPromptBar.tsx`

No structural changes. The chips and prompt input work the same. The backend decides whether to generate HTML or JSON based on `projectType`.

### Modify: `components/StitchExportModal.tsx`

No changes needed — it already renders HTML to PNG/JPEG via `html-to-image`. The renderer output is standard HTML.

---

## Phase 5: RAG Component Library

### New DB tables: `server/db/schema.ts`

```sql
CREATE TABLE IF NOT EXISTS stitch_components (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,           -- 'section' | 'component' | 'icon' | 'svg' | 'template' | 'widget'
  content_type TEXT NOT NULL,        -- 'html' | 'svg' | 'json' | 'js'
  project_type TEXT NOT NULL DEFAULT 'all',  -- 'website' | 'ig-carousel' | 'ig-story' | 'all'
  description TEXT,
  tags TEXT,                         -- JSON array
  content TEXT NOT NULL,             -- The actual HTML/SVG/JSON/JS code
  spec_snippet TEXT,                 -- JSON spec fragment (for IG content)
  thumbnail TEXT,                    -- Optional base64 preview
  is_global INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stitch_component_embeddings (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES stitch_components(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sce_component ON stitch_component_embeddings(component_id);
```

### New file: `server/services/stitchLibraryService.ts`

Reuses `embeddingService.ts` for embedding generation.

```typescript
async function addComponent(component: StitchComponent): Promise<void>
async function listComponents(filters?: { category?: string; projectType?: string }): StitchComponent[]
async function deleteComponent(id: string): Promise<boolean>
async function searchComponents(query: string, projectType: string, topK?: number): Promise<StitchComponentWithScore[]>
```

The `searchComponents` function:
1. Embeds the query via `getEmbedding(query)`
2. Fetches all `stitch_component_embeddings` rows (filtered by `project_type IN (?, 'all')`)
3. Computes cosine similarity
4. Returns top-K components sorted by score

### New routes: `server/routes/stitch.ts` — library CRUD

```
GET    /api/stitch/components              — list all (with optional ?category=&projectType= filters)
POST   /api/stitch/components              — add new component
DELETE /api/stitch/components/:id           — delete component
POST   /api/stitch/components/search       — semantic search { query, projectType, topK }
POST   /api/stitch/components/reindex      — rebuild embeddings for all components
```

### Modify: `server/routes/stitch.ts` — inject into generation

In both `generate-html` and `generate-spec` endpoints:

```typescript
// Before building system prompt:
if (context.projectType === 'ig-carousel' || context.projectType === 'ig-story') {
  const relevantComponents = await searchComponents(userPrompt, context.projectType, 5);
  if (relevantComponents.length > 0) {
    const componentContext = relevantComponents.map(c => 
      `--- ${c.name} (${c.category}) ---\n${c.description}\n\`\`\`${c.content_type}\n${c.spec_snippet || c.content}\n\`\`\``
    ).join('\n\n');
    systemPrompt += `\n\nAVAILABLE COMPONENTS (use as building blocks, adapt to the design):\n${componentContext}`;
  }
}
```

### New component: `components/StitchLibrary.tsx`

UI panel for browsing/searching/managing the component library. Accessible from the StitchEditor sidebar.

Features:
- Search bar (text input → calls `/api/stitch/components/search`)
- Category filter tabs (All, Sections, Components, Icons, SVGs, Templates)
- Card grid showing component name, category, thumbnail
- Click to toggle inclusion in next generation
- "Save from board" button (extract current board's spec as a component)
- Add new component manually (paste HTML/SVG/JSON)

### Modify: `components/StitchEditor.tsx` — library integration

Add a library toggle button in the sidebar. When active, selected components are passed to the generation context:

```typescript
const [selectedLibraryComponents, setSelectedLibraryComponents] = useState<StitchComponent[]>([]);

// In handleGenerate:
context.libraryComponents = selectedLibraryComponents;
```

---

## Phase 6: Seed Starter Library

Pre-populate `stitch_components` with ~25 common IG components:

**Sections (JSON spec snippets):**
- Hook headline (first slide)
- CTA slide (last slide)
- Tip card with icon
- Before/After comparison
- Numbered listicle items
- Quote card
- Stat/number highlight
- Testimonial card

**SVG elements:**
- Arrow decorations (swipe indicators)
- Wave dividers
- Blob shapes
- Sparkle/confetti accents
- Logo placeholder

**Icons (inline SVG):**
- Common social icons (heart, share, comment, bookmark, follow)
- UI icons (arrow, check, star, lightning, fire)
- CTA icons (link, DM, shop)

Each seed entry includes:
- `content` — the raw HTML/SVG/JSON
- `spec_snippet` — JSON spec fragment for IG use
- `description` — rich text for embedding
- `tags` — searchable tags
- `project_type` — appropriate project type filter

---

## Phase 7: Migration & Backward Compatibility

### DB migration in `server/db/index.ts`

Add migration for new tables:

```typescript
// In migrate():
db.exec(`CREATE TABLE IF NOT EXISTS stitch_components (...)`);
db.exec(`CREATE TABLE IF NOT EXISTS stitch_component_embeddings (...)`);
```

### Backward compatibility

- Existing projects with `generatedHtml` continue to work (no migration needed)
- Old carousels without `designSpec` fall back to HTML rendering
- New carousels store both `designSpec` (source of truth) and `generatedHtml` (renderer output)
- Website projects are completely unaffected

---

## Files Changed (Summary)

| File | Change |
|------|--------|
| `types.ts` | Add `designSpec` to `StitchBoard`, `theme` to `StitchProject` |
| **NEW** `types/stitchSpec.ts` | Full spec type definitions |
| **NEW** `lib/stitchRenderer.ts` | JSON spec → HTML renderer |
| **NEW** `server/services/stitchSpecPrompt.ts` | System prompt for spec generation |
| **NEW** `server/services/stitchLibraryService.ts` | RAG component library service |
| **NEW** `components/StitchLibrary.tsx` | Library UI panel |
| `server/db/schema.ts` | Add `stitch_components` + `stitch_component_embeddings` tables |
| `server/db/index.ts` | Migration for new tables |
| `server/routes/stitch.ts` | Add `generate-spec`, library CRUD routes, RAG injection |
| `server/routes/agent.ts` | Add `generate_spec`/`edit_spec` tools for IG content |
| `server/services/agentService.ts` | New tool definitions, spec-aware system prompt |
| `services/stitchService.ts` | Add `generateSpec`, `generateSpecStream`, `renderSlide` (client re-export) |
| `components/StitchEditor.tsx` | Spec-aware generation flow, library integration |
| `components/StitchPromptBar.tsx` | Minor: pass library context through |
| `components/StitchPanel.tsx` | No changes needed |

---

## Implementation Order

1. **Types** (`types/stitchSpec.ts`, `types.ts`) — Define the schema first
2. **Renderer** (`lib/stitchRenderer.ts`) — Build and test with hardcoded specs
3. **Server spec generation** (`stitchSpecPrompt.ts`, routes) — AI generates specs
4. **Editor integration** (`StitchEditor.tsx`) — Wire spec generation into IG flow
5. **DB schema** (`schema.ts`, `index.ts`) — Add component library tables
6. **Library service** (`stitchLibraryService.ts`) — CRUD + RAG search
7. **Library routes** (`routes/stitch.ts`) — API endpoints
8. **Library UI** (`StitchLibrary.tsx`) — Browse/search/manage components
9. **RAG injection** — Wire library search into spec generation prompt
10. **Seed library** — Pre-populate starter components
11. **Agent tools** — `generate_spec`/`edit_spec` for the agent loop

---

## Token Budget Comparison (10-slide carousel)

| Format | Per Slide | 10 Slides | Notes |
|--------|-----------|-----------|-------|
| HTML (current) | ~1200 tokens | ~12,000 tokens | Full `<!DOCTYPE>` + inline CSS per slide |
| JSON spec | ~200 tokens | ~2,000 tokens | Structured data, no boilerplate |
| JSON + shared theme | ~150 tokens | ~1,700 tokens | Theme defined once |

**~85% reduction** in output tokens → faster generation, lower cost, better consistency.
