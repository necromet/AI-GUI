# Stitch: Instagram Carousel & Story/Reel Support

## Overview

Add project type selection (Website vs Instagram Carousel vs Instagram Story/Reel) to Stitch, with image reference support (URL paste + local upload), multi-slide carousel workflow, and PNG export for Instagram.

---

## Phase 1: Data Model & Project Type Selection

### 1.1 Add `projectType` to types (`types.ts`)

```ts
export type StitchProjectType = 'website' | 'ig-carousel' | 'ig-story';

export interface StitchProject {
  id: string;
  title: string;
  description?: string;
  projectType: StitchProjectType;  // NEW
  boards: StitchBoard[];
  images?: StitchImageRef[];        // NEW — shared image references
  createdAt: number;
  updatedAt: number;
}

export interface StitchImageRef {    // NEW
  id: string;
  label: string;
  url: string;           // https URL or data:image/... base64 URI
  mimeType?: string;
}
```

### 1.2 Update DB schema (`server/db/schema.ts`)

Add `project_type` column to `stitch_projects`:
```sql
ALTER TABLE stitch_projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'website';
```

Update `server/db/stitchProjects.ts` to read/write `project_type`.

### 1.3 Update server PUT/GET routes (`server/routes/stitch.ts`)

- `PUT /projects/:id` — accept `project_type` in body, store it
- `GET /projects` / `GET /projects/:id` — return `project_type` in response

### 1.4 Update client adapter (`services/apiDatabaseAdapter.ts`)

- `saveStitchProject` — include `projectType` in serialized body
- `getStitchProjects` / `getStitchProject` — return `projectType` from API

### 1.5 Update `stitchService.ts`

- `createNewProject(title, projectType)` — accept and store `projectType`
- `stitchProjectToDB` / `stitchDBToProject` — serialize/deserialize `projectType`

---

## Phase 2: Project Creation UI (`StitchPanel.tsx`)

### 2.1 Replace current "New Project" flow

**Current**: Click "New Project" → name input → layout grid → click layout to create.

**New**: Click "New Project" → **Step 1: Choose project type** → **Step 2: Configure** → Create.

#### Step 1: Project Type Cards

Three cards displayed horizontally:

| Card | Icon | Label | Description |
|------|------|-------|-------------|
| Website | `Globe` | Website | HTML landing pages, dashboards, portfolios |
| IG Carousel | `Images` | Instagram Carousel | Multi-slide posts (4:5 per slide, 2-10 slides) |
| IG Story | `Smartphone` | Instagram Story/Reel | Full-screen vertical content (9:16) |

#### Step 2: Configuration (varies by type)

**Website** (same as current):
- Project name input
- Layout selector (16:9, 1:1, 4:3, etc.)
- Creates single-board project

**Instagram Carousel**:
- Project name input
- Layout locked to `4:5` (1080×1350) — shown as badge, not selectable
- Slide count selector: 2, 3, 4, 5, 6, 7, 8, 9, 10 (default: 5)
- Creates multi-board project (N boards, all `4:5`)
- Each board pre-titled "Slide 1", "Slide 2", etc.

**Instagram Story/Reel**:
- Project name input
- Layout locked to `9:16` (1080×1920)
- Creates single-board project (stories are usually one piece of content)

### 2.2 Update `handleCreateProject`

```ts
const handleCreateProject = async (
  projectType: StitchProjectType,
  layout: StitchLayout,
  slideCount?: number
) => {
  const project = createNewProject(title, projectType);
  if (projectType === 'ig-carousel') {
    project.boards = Array.from({ length: slideCount || 5 }, (_, i) => {
      const board = createNewBoard(project.id, '4:5');
      board.title = `Slide ${i + 1}`;
      return board;
    });
  } else {
    project.boards = [createNewBoard(project.id, layout)];
  }
  // ... save and navigate
};
```

---

## Phase 3: Image References System

### 3.1 New component: `StitchImageManager.tsx`

A panel/section that lets users manage image references for a project.

**Features**:
- List of added images with thumbnail preview, label, and remove button
- "Add Image" button → two options:
  - **Paste URL**: Text input for image URL (https://...)
  - **Upload File**: `<input type="file" accept="image/*">` → reads as base64 data URI
- Drag-and-drop zone for quick upload
- Each image gets a auto-generated label (e.g., "image-1", "image-2") that can be renamed
- Images stored in `project.images[]`

**Location**: Integrate into `StitchEditor` as a collapsible section above the prompt bar, or as a tab in the sidebar.

### 3.2 Pass images to generation context

Update `handleGenerate` in `StitchEditor.tsx`:

```ts
const context: Record<string, any> = {
  layout,
  boardDescription: project.title,
  model: activeModel?.apiModelId || activeModel?.id,
  provider: activeModel?.provider,
  projectType: project.projectType,  // NEW
  images: project.images || [],       // NEW
};
```

### 3.3 Update server-side system prompts

**In `server/services/agentService.ts` — `buildStitchSystemPrompt()`**:

When `context.images` has entries, append to the system prompt:

```
Available images to use in the design:
- "hero-photo" → https://example.com/photo.jpg
- "product-shot" → data:image/jpeg;base64,/9j/4AAQ...

Use these images with <img> tags. Use object-fit: cover for background images.
Do NOT use placeholder gradients when actual images are provided.
```

**In `server/services/agentService.ts` — `toolGenerateHtml()`**:

Same image injection into the system prompt.

**In `server/routes/stitch.ts` — `/generate-html` route**:

Same image injection.

### 3.4 Instagram-specific system prompt additions

When `context.projectType === 'ig-carousel'`:

```
INSTAGRAM CAROUSEL DESIGN RULES:
- This is slide {N} of {TOTAL} in a carousel
- Design for mobile-first: large text, high contrast, bold typography
- Minimum 24px body text, 32px+ headlines
- Leave 5% safe margin on all edges (Instagram crops)
- Use vibrant, eye-catching colors for small thumbnail views
- Slide 1 must hook attention — bold headline, striking visual
- Middle slides deliver value — one key point per slide
- Last slide: strong CTA (Follow, Save, Comment, Share)
- Add "swipe →" indicator on non-final slides
- Maintain consistent typography, colors, and layout across all slides
- Aspect ratio: 4:5 (1080×1350px)
```

When `context.projectType === 'ig-story'`:

```
INSTAGRAM STORY/REEL DESIGN RULES:
- Full-screen vertical: 9:16 (1080×1920px)
- Design for thumb-friendly interaction
- Keep text in center 80% (safe zone away from top/bottom UI)
- Large, bold text — minimum 28px body
- Use high contrast for outdoor viewing
- Include interactive element areas (poll, question, swipe-up)
- Top 15% and bottom 20% are Instagram UI overlays — avoid content there
```

### 3.5 Carousel context for multi-slide generation

When generating slides 2+ for a carousel, include the first slide's HTML as visual reference:

```ts
// In StitchEditor.tsx handleGenerate, for carousel slides after the first:
if (project.projectType === 'ig-carousel' && boardIndex > 0) {
  const firstSlideHtml = project.boards[0]?.generatedHtml;
  if (firstSlideHtml) {
    context.referenceSlideHtml = firstSlideHtml;
    context.slideNumber = boardIndex + 1;
    context.totalSlides = project.boards.length;
  }
}
```

Server-side appends to system prompt:
```
This is slide {N} of {TOTAL}. Here is slide 1's HTML for visual consistency:
[slide 1 HTML]
Match the color scheme, typography, spacing, and visual style of slide 1.
Continue the narrative — this slide should feel like a natural continuation.
```

---

## Phase 4: Multi-Slide Editor (`StitchEditor.tsx`)

### 4.1 Slide navigator

Add a horizontal slide strip at the bottom of the editor (or top of sidebar):

```
[Slide 1] [Slide 2] [+] [Slide 3] ...
```

- Click a slide tab to switch active board
- `[+]` button adds a new slide (up to 10)
- Right-click or `×` on a slide to delete (min 1)
- Drag to reorder (optional, can defer)

### 4.2 Track active board index

```ts
const [activeBoardIdx, setActiveBoardIdx] = useState(0);
const board = project.boards[activeBoardIdx] || project.boards[0];
```

### 4.3 Per-slide state

Each board already has its own `generatedHtml`. The slide navigator switches which board's HTML is displayed/generated.

### 4.4 Generate All Slides button

For carousels, add a "Generate All Slides" button that:
1. Generates slide 1 first
2. Then sequentially generates slides 2-N using slide 1 as reference
3. Shows progress (e.g., "Generating slide 3/5...")

---

## Phase 5: PNG Export

### 5.1 Install dependency

```bash
npm install html-to-image
```

`html-to-image` is lighter than `html2canvas` and works well with iframes. It converts DOM nodes to PNG/JPEG using SVG foreignObject.

### 5.2 New component: `StitchExportModal.tsx`

A modal triggered by the Export button with options:

**Website projects** (current behavior):
- Download HTML file
- Copy HTML to clipboard

**Instagram Carousel**:
- Export current slide as PNG (1080×1350)
- Export all slides as PNG (downloads zip or sequential downloads)
- Export all slides as JPEG (smaller file size)

**Instagram Story/Reel**:
- Export as PNG (1080×1920)
- Export as JPEG

### 5.3 PNG rendering approach

Use the iframe's `srcDoc` content. Two approaches:

**Option A — Client-side with `html-to-image`**:
1. Create a hidden iframe with the exact Instagram dimensions
2. Wait for render
3. Use `htmlToPng(iframeElement)` to capture
4. Trigger download

**Option B — Offscreen canvas approach** (simpler, no extra dep):
1. Create an `OffscreenCanvas` or `<canvas>`
2. Render iframe content via `drawImage` on a `Blob` URL
3. Export canvas as PNG

Recommended: **Option A** — more reliable for complex HTML/CSS.

### 5.4 Batch export for carousels

```ts
async function exportAllSlides(project: StitchProject, format: 'png' | 'jpeg') {
  for (let i = 0; i < project.boards.length; i++) {
    const html = project.boards[i].generatedHtml;
    if (!html) continue;
    const blob = await renderHtmlToImage(html, project.boards[i].layout, format);
    downloadBlob(blob, `${project.title}-slide-${i + 1}.${format}`);
    // Small delay between downloads to avoid browser throttling
    await new Promise(r => setTimeout(r, 300));
  }
}
```

---

## Phase 6: Prompt Bar Updates (`StitchPromptBar.tsx`)

### 6.1 New chip categories

Add Instagram-specific chip categories that appear when `projectType` is `ig-carousel` or `ig-story`:

```ts
const IG_CAROUSEL_CHIPS: { label: string; chips: string[] }[] = [
  {
    label: 'Content',
    chips: ['Listicle', 'Before/After', 'Step-by-Step', 'Tips & Tricks', 'Story Sequence', 'Tutorial', 'Product Showcase', 'Testimonial'],
  },
  {
    label: 'Style',
    chips: ['Bold & Colorful', 'Minimalist', 'Dark Luxury', 'Pastel Aesthetic', 'Neon Pop', 'Corporate Clean', 'Hand-drawn'],
  },
  {
    label: 'CTA',
    chips: ['Save This Post', 'Follow for More', 'Comment Below', 'Share with a Friend', 'Link in Bio', 'DM Us'],
  },
];
```

### 6.2 Conditionally show chips

Pass `projectType` as a prop to `StitchPromptBar`:

```ts
interface StitchPromptBarProps {
  // ... existing props
  projectType?: StitchProjectType;
}
```

Show `IG_CAROUSEL_CHIPS` when `projectType` is `ig-carousel`, and a subset for `ig-story`.

---

## File Change Summary

| File | Changes |
|------|---------|
| `types.ts` | Add `StitchProjectType`, `StitchImageRef`; update `StitchProject` |
| `server/db/schema.ts` | Add `project_type` column migration |
| `server/db/stitchProjects.ts` | Read/write `project_type` |
| `server/routes/stitch.ts` | Accept/return `project_type`; update `/generate-html` system prompt |
| `server/services/agentService.ts` | Update `buildStitchSystemPrompt()` and `toolGenerateHtml()` with image + carousel/story prompts |
| `services/stitchService.ts` | Update `createNewProject`, serializers |
| `services/apiDatabaseAdapter.ts` | Include `projectType` in API calls |
| `components/StitchPanel.tsx` | New project creation flow with type selection |
| `components/StitchEditor.tsx` | Slide navigator, per-board switching, image context, multi-slide generation |
| `components/StitchPromptBar.tsx` | Accept `projectType` prop, show IG-specific chips |
| **NEW** `components/StitchImageManager.tsx` | Image URL paste + file upload UI |
| **NEW** `components/StitchExportModal.tsx` | Export modal with PNG/JPEG options |
| `package.json` | Add `html-to-image` dependency |

---

## Implementation Order

1. **Phase 1** — Data model + DB migration (foundation, no UI changes)
2. **Phase 2** — Project type selection UI in StitchPanel
3. **Phase 3** — Image references (StitchImageManager + server prompt injection)
4. **Phase 4** — Multi-slide editor (slide navigator + carousel generation)
5. **Phase 5** — PNG export (StitchExportModal + html-to-image)
6. **Phase 6** — Prompt bar IG chips (polish)

Each phase is independently testable and deployable.
