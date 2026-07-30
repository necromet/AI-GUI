# Unified Skema + Canvas Agent — Implementation Plan

## Overview

Extend the existing Skema Agent to serve the Canvas editor (`/skema/canvas`). Since IG content types (`ig-carousel`, `ig-story`) have been removed from the frontend, the Skema Agent is now exclusively a **canvas agent**. The existing `SkemaAgentSidebar`, `useSkemaAgentStream`, `useSkemaAgentSessions`, and `server/routes/skemaAgent.ts` are extended with canvas grid tools, a library component catalogue, and a canvas-aware system prompt.

---

## Current State (Post IG Cleanup)

### What Exists Now

| Component | State | Notes |
|-----------|-------|-------|
| `types.ts:140` | `SkemaProjectType = 'canvas'` | IG types removed |
| `SkemaPanel.tsx` | Only `canvas` in `PROJECT_TYPES` | IG carousel/story removed |
| `SkemaEditor.tsx` | IG logic removed | No `isCarousel`, `isIgContent`, `designSpec`, `handleAddSlide`, `handleAgentSpecGenerated`. Still mounts `SkemaAgentSidebar` with `currentSpec`/`onSpecGenerated` props (dead) |
| `SkemaExportModal.tsx` | HTML-only export | IG image export removed |
| `SkemaAgentSidebar.tsx` | Still accepts `currentSpec`, `onSpecGenerated` props | These are dead — no IG project types exist |
| `useSkemaAgentStream.ts` | Still has `isIgContent` branching (lines 56, 67-68, 260-261) | Dead code — `projectType` is always `'canvas'` |
| `useSkemaAgentStream.ts` | Still handles `spec_generated` SSE event (lines 208-213) | Dead code |
| `server/routes/skemaAgent.ts` | Still has `generate_spec`, `edit_spec` tools | Dead code — no frontend sends these tools |
| `server/services/agentService.ts` | `buildSkemaSystemPrompt` still has IG mode | Dead code path |
| `canvas/types.ts` | `GridComponent` has `cs/ce/rs/re` (col/row start/end) | No `referenceComponentId`, no `generatedHtml` |
| `canvas/CanvasEditor.tsx` | No agent sidebar mounted | Mock generation via `setTimeout` only |
| `canvas/CanvasGrid.tsx` | Renders `MockContent` only | No iframe HTML rendering |
| `canvas/CanvasProperties.tsx` | Properties panel only | No catalogue tab |
| `lib/agentConfig.ts` | `'skema'` agent type with 8 tools | Includes dead `generate_spec`/`edit_spec` |

### What Needs to Change

1. **Clean up dead IG code** from `useSkemaAgentStream.ts`, `SkemaAgentSidebar.tsx`, `types.ts` (agent), `agentConfig.ts`
2. **Add 6 canvas grid tools** to `server/routes/skemaAgent.ts`
3. **Add canvas system prompt** to `server/services/agentService.ts`
4. **Mount `SkemaAgentSidebar` in `CanvasEditor`** with canvas-specific props
5. **Extend `GridComponent`** with `referenceComponentId` and `generatedHtml`
6. **Handle new SSE events** (`component_placed`, `component_removed`, `component_updated`) in `useSkemaAgentStream`
7. **Add `CanvasCatalogue`** panel in `CanvasProperties`
8. **Render HTML content** in `CanvasGrid` when `generatedHtml` exists

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SkemaPanel (only 'canvas' project type)                                │
│  └─ CanvasEditor                                                        │
│     ├─ CanvasSidebar (left — AI prompt + Quick Add)                     │
│     ├─ CanvasGrid (center — grid with components)                       │
│     ├─ CanvasProperties (right — Properties tab + Catalogue tab)        │
│     └─ SkemaAgentSidebar (right — agent chat, reused as-is + extensions)│
│        └─ useSkemaAgentStream → POST /api/skema-agent/chat              │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  server/routes/skemaAgent.ts (extended)                                 │
│  ├─ buildSkemaTools(context) — now includes 6 canvas grid tools        │
│  ├─ buildSkemaSystemPrompt(context) — now canvas-only mode             │
│  └─ Session CRUD — unchanged (reuses skema_agent_sessions)             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Files

### New Files (4)

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `server/services/canvasAgentTools.ts` | ~250 | 6 canvas grid tool definitions + `buildCanvasTools()` + grid context builder |
| `components/canvas/CanvasCatalogue.tsx` | ~200 | Library component catalogue panel with search/filter/preview |
| `components/canvas/CanvasCatalogueCard.tsx` | ~150 | Individual catalogue card with iframe preview + "Add to Canvas" button |
| `docs/CANVAS_AGENT.md` | ~300 | Architecture documentation |

### Modified Files (10)

| File | Change |
|------|--------|
| `server/routes/skemaAgent.ts` | Import canvas tools, extend `buildSkemaTools()` with canvas tools when `projectType === 'canvas'`, replace IG system prompt with canvas system prompt, emit `component_placed`/`component_removed`/`component_updated` SSE events |
| `server/services/agentService.ts` | Add `buildCanvasSystemPrompt()` alongside existing `buildSkemaSystemPrompt()` (or replace since IG is dead) |
| `components/skema/SkemaAgentSidebar.tsx` | Remove dead `currentSpec`/`onSpecGenerated` props from destructuring and `useSkemaAgentStream` call. Add new optional props: `gridState`, `onComponentPlaced`, `onComponentRemoved`, `onComponentUpdated` |
| `components/skema/agent/types.ts` | Remove `currentSpec`/`onSpecGenerated` from `SkemaAgentSidebarProps`. Add canvas props: `gridState`, `onComponentPlaced`, `onComponentRemoved`, `onComponentUpdated` |
| `components/skema/agent/useSkemaAgentStream.ts` | Remove dead IG branching (`isIgContent`, `currentSpec`, `slideCount`). Add canvas tool selection. Handle `component_placed`/`component_removed`/`component_updated` SSE events. Inject `gridState` into context |
| `components/canvas/CanvasEditor.tsx` | Mount `SkemaAgentSidebar`, handle agent grid events, pass `gridState` + callbacks |
| `components/canvas/CanvasGrid.tsx` | Render `generatedHtml` in iframe when available, render library component preview when `referenceComponentId` is set |
| `components/canvas/CanvasProperties.tsx` | Add tab toggle between Properties and Catalogue modes |
| `components/canvas/types.ts` | Add `referenceComponentId?: string` and `generatedHtml?: string` to `GridComponent` |
| `lib/agentConfig.ts` | Replace dead IG tools (`generate_spec`, `edit_spec`) with canvas tools in `'skema'` agent type |

### Unchanged Files

- `components/skema/agent/useSkemaAgentSessions.ts` — works as-is
- `components/library/agent/MessageBlocks.tsx` — shared rendering, unchanged
- `components/library/agent/AgentMarkdown.tsx` — shared rendering, unchanged
- `components/library/agent/ModelPicker.tsx` — shared rendering, unchanged
- `components/SkemaEditor.tsx` — mounts SkemaAgentSidebar for freeform HTML editing, unchanged
- `server/routes/skemaAgent.ts` session CRUD — unchanged

---

## New Tools (6 Canvas Grid Tools)

Added to `buildSkemaTools(context)` in `server/routes/skemaAgent.ts`:

### Grid Operations

| Tool | Parameters | Description |
|------|-----------|-------------|
| `place_component` | `type: SectionType`, `prompt?: string`, `row?: number`, `referenceComponentId?: string` | Place a new section on the grid. `row` defaults to first empty. `referenceComponentId` links to a library component. |
| `remove_component` | `componentId: string` | Remove a section from the grid. |
| `move_component` | `componentId: string`, `deltaRow: number` | Move a section up/down by row delta. |
| `resize_component` | `componentId: string`, `newRowSpan: number` | Change section height (row span). Always full-width. |
| `update_component` | `componentId: string`, `prompt?: string`, `type?: SectionType` | Update section description or type. |
| `regenerate_component` | `componentId: string`, `prompt?: string` | Regenerate section content with optional new description. |

### Tool Definitions (`server/services/canvasAgentTools.ts`)

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import type { GridState, GridComponent, SectionType } from '../../components/canvas/types';
import { SECTION_TYPES, RESOLUTIONS, ROWS } from '../../components/canvas/constants';

interface CanvasToolContext {
  gridState: GridState;
  resolution: { cols: number; width: number; height: number; cellW: number; cellH: number };
}

export function buildCanvasTools(ctx: CanvasToolContext) {
  function overlap(c1: number, r1: number, c2: number, r2: number, exId?: string) {
    return ctx.gridState.components.some(c => {
      if (c.id === exId) return false;
      return !(c2 < c.cs || c1 > c.ce || r2 < c.rs || r1 > c.re);
    });
  }

  function findEmptyRow(needRows: number): number {
    for (let r = 1; r <= ROWS - needRows + 1; r++) {
      if (!overlap(1, r, ctx.resolution.cols, r + needRows - 1)) return r;
    }
    return -1;
  }

  return {
    place_component: tool({
      description: `Place a new section component on the canvas grid. Types: ${Object.keys(SECTION_TYPES).join(', ')}.`,
      parameters: z.object({
        type: z.enum([...Object.keys(SECTION_TYPES)] as [string, ...string[]]),
        prompt: z.string().optional().describe('Description of the section content'),
        row: z.number().optional().describe('Row to place at (omit for first empty)'),
        referenceComponentId: z.string().optional().describe('Library component ID to reference'),
      }),
      execute: async ({ type, prompt, row, referenceComponentId }) => {
        const rows = SECTION_TYPES[type as SectionType]?.rows || 1;
        const targetRow = row ?? findEmptyRow(rows);
        if (targetRow < 0) return JSON.stringify({ error: 'No space available on the grid' });
        if (overlap(1, targetRow, ctx.resolution.cols, targetRow + rows - 1)) {
          return JSON.stringify({ error: `Overlap at row ${targetRow}` });
        }
        const comp: GridComponent = {
          id: `c${Date.now()}`,
          type: type as SectionType,
          cs: 1, ce: ctx.resolution.cols,
          rs: targetRow, re: targetRow + rows - 1,
          prompt: prompt || type,
          generating: false, generated: true,
          referenceComponentId,
        };
        ctx.gridState.components.push(comp);
        return JSON.stringify(comp);
      },
    }),

    remove_component: tool({
      description: 'Remove a section component from the canvas grid by its ID.',
      parameters: z.object({ componentId: z.string() }),
      execute: async ({ componentId }) => {
        const idx = ctx.gridState.components.findIndex(c => c.id === componentId);
        if (idx < 0) return JSON.stringify({ error: `Component ${componentId} not found` });
        ctx.gridState.components.splice(idx, 1);
        return JSON.stringify({ success: true, componentId });
      },
    }),

    move_component: tool({
      description: 'Move a section component up or down on the canvas grid.',
      parameters: z.object({
        componentId: z.string(),
        deltaRow: z.number().describe('Rows to move (negative=up, positive=down)'),
      }),
      execute: async ({ componentId, deltaRow }) => {
        const comp = ctx.gridState.components.find(c => c.id === componentId);
        if (!comp) return JSON.stringify({ error: `Component ${componentId} not found` });
        const nr = comp.rs + deltaRow;
        const nre = comp.re + deltaRow;
        if (nr < 1 || nre > ROWS) return JSON.stringify({ error: 'Out of bounds' });
        if (overlap(comp.cs, nr, comp.ce, nre, componentId)) return JSON.stringify({ error: 'Overlap' });
        comp.rs = nr; comp.re = nre;
        return JSON.stringify(comp);
      },
    }),

    resize_component: tool({
      description: 'Change the height (row span) of a section component.',
      parameters: z.object({
        componentId: z.string(),
        newRowSpan: z.number().min(1).max(ROWS),
      }),
      execute: async ({ componentId, newRowSpan }) => {
        const comp = ctx.gridState.components.find(c => c.id === componentId);
        if (!comp) return JSON.stringify({ error: `Component ${componentId} not found` });
        const nre = comp.rs + newRowSpan - 1;
        if (nre > ROWS) return JSON.stringify({ error: 'Exceeds grid rows' });
        if (overlap(comp.cs, comp.rs, comp.ce, nre, componentId)) return JSON.stringify({ error: 'Overlap' });
        comp.re = nre;
        return JSON.stringify(comp);
      },
    }),

    update_component: tool({
      description: 'Update a section component\'s description or type.',
      parameters: z.object({
        componentId: z.string(),
        prompt: z.string().optional(),
        type: z.string().optional(),
      }),
      execute: async ({ componentId, prompt, type }) => {
        const comp = ctx.gridState.components.find(c => c.id === componentId);
        if (!comp) return JSON.stringify({ error: `Component ${componentId} not found` });
        if (prompt) comp.prompt = prompt;
        if (type && type in SECTION_TYPES) comp.type = type as SectionType;
        return JSON.stringify(comp);
      },
    }),

    regenerate_component: tool({
      description: 'Regenerate a section component\'s content. Optionally with a new description.',
      parameters: z.object({
        componentId: z.string(),
        prompt: z.string().optional(),
      }),
      execute: async ({ componentId, prompt }) => {
        const comp = ctx.gridState.components.find(c => c.id === componentId);
        if (!comp) return JSON.stringify({ error: `Component ${componentId} not found` });
        if (prompt) comp.prompt = prompt;
        comp.generating = true;
        return JSON.stringify(comp);
      },
    }),
  };
}
```

---

## System Prompt — Canvas Mode

### `server/services/agentService.ts`

Add `buildCanvasSystemPrompt()` (or repurpose `buildSkemaSystemPrompt()` since IG is dead):

```typescript
export function buildCanvasSystemPrompt(context: Record<string, any>): string {
  const { gridState, resolution, availableComponents } = context;

  let prompt = `You are a senior web layout engineer specializing in grid-based page composition.

## Grid Model
- Fixed-resolution template with a column/row grid
- Components are **full-width sections** stacked vertically (website wireframe)
- Resolution: ${resolution.width}×${resolution.height}, ${resolution.cols} columns
- Maximum ${ROWS} rows

## Section Types
${Object.entries(SECTION_TYPES).map(([k, v]) => `- ${k} (${v.rows} row${v.rows > 1 ? 's' : ''}) — ${v.label}`).join('\n')}

## Available Tools
- place_component — Add a section to the grid
- remove_component — Remove a section
- move_component — Reorder sections vertically
- resize_component — Change section height
- update_component — Update section description or type
- regenerate_component — Regenerate section content
- search_library — Find reusable components from the library

## Workflow
1. Understand the user's layout request
2. Search library for relevant components (optional)
3. Place components on the grid with descriptive prompts
4. Report what was placed and where

## Rules
- NEVER place overlapping components — check grid positions before placing
- NEVER modify the grid resolution or template
- Use descriptive prompts for each component
- Place components in logical order (navbar at top, footer at bottom)
- When referencing a library component, always search_library first`;

  if (gridState) {
    const componentSummary = gridState.components.map((c: any) => {
      const rows = SECTION_TYPES[c.type]?.rows || 1;
      return `- ${c.id}: ${c.type} at rows ${c.rs}–${c.re} — "${c.prompt}"`;
    }).join('\n');

    prompt += `\n\n## Current Grid State
- Template: ${gridState.template} (${resolution.cols} columns)
- Components (${gridState.components.length}):
${componentSummary || '(empty canvas)'}`;
  }

  if (availableComponents?.length > 0) {
    const grouped: Record<string, any[]> = {};
    for (const c of availableComponents) {
      (grouped[c.category] ??= []).push(c);
    }
    prompt += `\n\n## Library Components\n${Object.entries(grouped).map(([cat, comps]) =>
      `### ${cat} (${comps.length})\n${comps.slice(0, 10).map((c: any) => `- ${c.id}: ${c.name}`).join('\n')}`
    ).join('\n\n')}`;
  }

  return prompt;
}
```

---

## SkemaAgentSidebar Changes

### `components/skema/agent/types.ts`

```typescript
export interface SkemaAgentSidebarProps {
  // Existing (kept)
  isOpen: boolean;
  onToggle: () => void;
  project: SkemaProject;
  activeBoardIdx: number;
  currentHtml: string;
  modelConfig?: ModelConfig;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onHtmlGenerated?: (html: string) => void;
  models?: Array<{ id: string; name: string }>;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;

  // Removed (IG dead code)
  // currentSpec?: any;          ← REMOVED
  // onSpecGenerated?: (spec) => void;  ← REMOVED

  // New — canvas grid callbacks (optional)
  gridState?: GridState;
  onComponentPlaced?: (component: GridComponent) => void;
  onComponentRemoved?: (componentId: string) => void;
  onComponentUpdated?: (component: GridComponent) => void;
}
```

### `components/skema/SkemaAgentSidebar.tsx`

Changes:
1. Remove `currentSpec`, `onSpecGenerated` from destructuring and `useSkemaAgentStream` call
2. Add `gridState`, `onComponentPlaced`, `onComponentRemoved`, `onComponentUpdated` to destructuring and `useSkemaAgentStream` call
3. Header title: change "Skema Agent" to "Canvas Agent"

### `components/skema/agent/useSkemaAgentStream.ts`

Changes:

1. **Remove IG dead code from `buildContext()`** (lines 56, 67-68):
```diff
- const isIgContent = project.projectType === 'ig-carousel' || project.projectType === 'ig-story';
  ...
- if (isIgContent && currentSpec) context.currentSpec = currentSpec;
- if (isIgContent) context.slideCount = project.boards.length;
+ if (gridState) context.gridState = gridState;
```

2. **Remove IG dead code from `handleSend()`** (lines 260-262):
```diff
- const isIgContent = project.projectType === 'ig-carousel' || project.projectType === 'ig-story';
- const defaultTools = isIgContent ? ['generate_spec', 'edit_spec', 'search_library'] : ['edit_html', 'generate_html', 'search_library'];
+ const defaultTools = ['place_component', 'remove_component', 'move_component', 'resize_component', 'update_component', 'regenerate_component', 'search_library'];
```

3. **Remove `spec_generated` handler** (lines 208-213):
```diff
- if (parsed.spec_generated) {
-   try {
-     const spec = JSON.parse(parsed.spec_generated);
-     onSpecGenerated?.(spec);
-   } catch {}
- }
```

4. **Add canvas SSE event handlers** after `html_generated`:
```typescript
if (parsed.component_placed) {
  onComponentPlaced?.(parsed.component_placed);
}
if (parsed.component_removed) {
  onComponentRemoved?.(parsed.component_removed.componentId);
}
if (parsed.component_updated) {
  onComponentUpdated?.(parsed.component_updated);
}
```

5. **Remove `currentSpec` and `onSpecGenerated` from options interface and deps**

6. **Add canvas tool-to-task matching** in `matchToolToTask`:
```typescript
(toolName === 'place_component' && t.title.toLowerCase().includes('place')) ||
(toolName === 'remove_component' && t.title.toLowerCase().includes('remove')) ||
```

---

## CanvasEditor Integration

### Mount SkemaAgentSidebar

```tsx
// components/canvas/CanvasEditor.tsx — add imports
import SkemaAgentSidebar from '@/components/skema/SkemaAgentSidebar';

// Add state
const [showAgentSidebar, setShowAgentSidebar] = useState(true);
const [selectedModelId, setSelectedModelId] = useState<string>(modelConfig?.id || '');

// Add handlers
const handleComponentPlaced = useCallback((component: GridComponent) => {
  const newState: GridState = {
    ...gridState,
    components: [...gridState.components, component],
  };
  saveState(newState);
  toast.success(`${component.type} placed`);
}, [gridState, saveState]);

const handleComponentRemoved = useCallback((componentId: string) => {
  const newState: GridState = {
    ...gridState,
    components: gridState.components.filter(c => c.id !== componentId),
  };
  saveState(newState);
}, [gridState, saveState]);

const handleComponentUpdated = useCallback((component: GridComponent) => {
  const newState: GridState = {
    ...gridState,
    components: gridState.components.map(c => c.id === component.id ? component : c),
  };
  saveState(newState);
}, [gridState, saveState]);

// In render — add after CanvasProperties:
<SkemaAgentSidebar
  isOpen={showAgentSidebar}
  onToggle={() => setShowAgentSidebar(!showAgentSidebar)}
  project={project}
  activeBoardIdx={0}
  currentHtml=""
  modelConfig={modelConfig}
  onNotification={onNotification}
  models={chatModels.map(m => ({ id: m.id, name: m.name }))}
  selectedModelId={selectedModelId}
  onModelChange={setSelectedModelId}
  gridState={gridState}
  onComponentPlaced={handleComponentPlaced}
  onComponentRemoved={handleComponentRemoved}
  onComponentUpdated={handleComponentUpdated}
/>
```

---

## Server Route Changes (`skemaAgent.ts`)

### Import Canvas Tools

```typescript
import { buildCanvasTools } from '../services/canvasAgentTools';
```

### Extend `buildSkemaTools()`

```typescript
function buildSkemaTools(context: Record<string, any>) {
  const tools: Record<string, any> = {};

  if (context.projectType === 'canvas' && context.gridState) {
    // Canvas mode — grid manipulation tools
    Object.assign(tools, buildCanvasTools({
      gridState: context.gridState,
      resolution: context.resolution,
    }));
  }

  // Always available
  tools.search_library = tool({
    /* existing search_library definition */
  });
  tools.web_browse = tool({ /* existing */ });
  tools.execute_code = tool({ /* existing */ });
  tools.search_web = tool({ /* existing */ });

  // Remove dead IG tools (generate_spec, edit_spec)
  // Remove dead HTML tools (generate_html, edit_html) — canvas uses grid tools

  return tools;
}
```

### System Prompt Selection

```typescript
// In POST /chat handler:
const systemPrompt = buildCanvasSystemPrompt({
  gridState: context.gridState,
  resolution: context.resolution,
  availableComponents: /* fetched from library */,
});
```

### Emit Canvas SSE Events

After tool results are processed:

```typescript
for (const tr of toolResults) {
  if (tr.name === 'place_component') {
    try {
      const comp = JSON.parse(tr.output);
      if (!comp.error) res.write(`data: ${JSON.stringify({ component_placed: comp })}\n\n`);
    } catch {}
  } else if (tr.name === 'remove_component') {
    try {
      const result = JSON.parse(tr.output);
      if (result.success) res.write(`data: ${JSON.stringify({ component_removed: { componentId: result.componentId } })}\n\n`);
    } catch {}
  } else if (['move_component', 'resize_component', 'update_component', 'regenerate_component'].includes(tr.name)) {
    try {
      const comp = JSON.parse(tr.output);
      if (!comp.error) res.write(`data: ${JSON.stringify({ component_updated: comp })}\n\n`);
    } catch {}
  }
}
```

---

## GridComponent Type Extension

```typescript
// components/canvas/types.ts
export interface GridComponent {
  id: string;
  type: SectionType;
  cs: number;   // column start
  ce: number;   // column end
  rs: number;   // row start
  re: number;   // row end
  prompt: string;
  generating: boolean;
  generated: boolean;
  referenceComponentId?: string;  // NEW — links to library component
  generatedHtml?: string;         // NEW — rendered HTML content
}
```

### CanvasGrid Rendering Change

```tsx
// In CanvasGrid.tsx — component body:
{component.generatedHtml ? (
  <iframe
    srcDoc={component.generatedHtml}
    className="w-full h-full border-0"
    sandbox="allow-scripts"
  />
) : component.referenceComponentId ? (
  <iframe
    srcDoc={`<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100%;background:#18181b;color:#a1a1aa;font-family:system-ui;font-size:12px">Library component: ${component.referenceComponentId}</body></html>`}
    className="w-full h-full border-0"
    sandbox="allow-scripts"
  />
) : (
  <MockContent type={component.type} cols={colSpan} />
)}
```

---

## Component Catalogue

### CanvasProperties.tsx — Add Tab Toggle

```tsx
const [tab, setTab] = useState<'properties' | 'catalogue'>('properties');

// At top of panel:
<div className="flex border-b" style={{ borderColor: 'var(--border-300)' }}>
  <button
    className={tab === 'properties' ? 'active-tab-style' : 'tab-style'}
    onClick={() => setTab('properties')}
  >
    Properties
  </button>
  <button
    className={tab === 'catalogue' ? 'active-tab-style' : 'tab-style'}
    onClick={() => setTab('catalogue')}
  >
    Catalogue
  </button>
</div>
{tab === 'properties' ? <ExistingPropertiesContent ... /> : (
  <CanvasCatalogue onAddToCanvas={handleCatalogueAdd} />
)}
```

### CanvasCatalogue.tsx

- Fetches from `GET /api/library/components`
- Search via `POST /api/library/components/search`
- Category filter pills
- Grid of `CanvasCatalogueCard` components
- "Add to Canvas" creates a `GridComponent` with `referenceComponentId`

### CanvasCatalogueCard.tsx

- 100px iframe preview (compiled via `/api/library/components/:id/compiled`)
- Component name, category badge, content type badge
- "Add to Canvas" button → calls `onAddToCanvas(comp)`

---

## Session Management

**No changes.** Reuses `skema_agent_sessions` table. Canvas projects are `skema_projects` with `project_type = 'canvas'`. Sessions are scoped by `project_id` + `board_idx`.

---

## agentConfig.ts Changes

Replace dead IG tools with canvas tools:

```typescript
AGENT_TOOL_INFO.skema = [
  // Canvas grid tools (NEW)
  { name: 'place_component', description: 'Place a new section on the canvas grid' },
  { name: 'remove_component', description: 'Remove a section from the canvas' },
  { name: 'move_component', description: 'Move a section up or down' },
  { name: 'resize_component', description: 'Change section height' },
  { name: 'update_component', description: 'Update section description or type' },
  { name: 'regenerate_component', description: 'Regenerate section content' },
  // Always available
  { name: 'search_library', description: 'Search the component library' },
  { name: 'web_browse', description: 'Fetch URL content' },
  { name: 'execute_code', description: 'Run JavaScript in sandbox' },
  { name: 'search_web', description: 'Search the web' },
  // Removed: generate_spec, edit_spec (IG dead code)
  // Removed: generate_html, edit_html (canvas uses grid tools, not freeform HTML)
];
```

---

## Implementation Phases

### Phase 1: IG Cleanup (0.5 days)

1. `components/skema/agent/types.ts` — remove `currentSpec`, `onSpecGenerated` from `SkemaAgentSidebarProps`
2. `components/skema/SkemaAgentSidebar.tsx` — remove `currentSpec`, `onSpecGenerated` from destructuring and `useSkemaAgentStream` call
3. `components/skema/agent/useSkemaAgentStream.ts` — remove `isIgContent` branching, `currentSpec`, `slideCount`, `spec_generated` handler, IG tool selection
4. `lib/agentConfig.ts` — remove `generate_spec`, `edit_spec` from skema tools

### Phase 2: Backend — Canvas Tools + System Prompt (1.5 days)

1. Create `server/services/canvasAgentTools.ts` — 6 tool definitions
2. Modify `server/routes/skemaAgent.ts` — import canvas tools, extend `buildSkemaTools()`, canvas system prompt, emit canvas SSE events
3. Add/repurpose `buildCanvasSystemPrompt()` in `server/services/agentService.ts`

### Phase 3: Frontend — Agent Sidebar Integration (1 day)

1. Extend `SkemaAgentSidebarProps` with canvas callbacks
2. Pass canvas props from `SkemaAgentSidebar` to `useSkemaAgentStream`
3. Handle `component_placed`/`component_removed`/`component_updated` in `useSkemaAgentStream`
4. Mount `SkemaAgentSidebar` in `CanvasEditor.tsx`
5. Add agent toggle button in canvas toolbar

### Phase 4: GridComponent + Rendering (0.5 days)

1. Extend `GridComponent` in `canvas/types.ts` with `referenceComponentId` and `generatedHtml`
2. Update `CanvasGrid.tsx` to render HTML content in iframe when available

### Phase 5: Component Catalogue (1 day)

1. Create `CanvasCatalogue.tsx` — search/filter/list library components
2. Create `CanvasCatalogueCard.tsx` — card with preview + "Add to Canvas"
3. Modify `CanvasProperties.tsx` — add tab toggle
4. Wire catalogue "Add" → creates `GridComponent` with `referenceComponentId`

### Phase 6: Polish (0.5 days)

1. Create `docs/CANVAS_AGENT.md`
2. Test full flow
3. Verify session persistence

**Total: ~5 days**

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Single agent for all Skema types | Canvas is now the only type | IG removed — no branching needed |
| No new routes | Extend `server/routes/skemaAgent.ts` | Same backend, same session table |
| No new sidebar component | Reuse `SkemaAgentSidebar` | Same UI patterns — just new tools + callbacks |
| Clean up IG dead code | Remove now | Cleaner codebase, less confusion |
| Canvas tools replace HTML tools | Grid tools for canvas mode | Canvas uses grid model, not freeform HTML |
| `referenceComponentId` on GridComponent | Links to library component | Agent can search library and reference components |
| Library catalogue as tab | In `CanvasProperties` | Shares space with properties panel |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Grid state sync between agent and editor | Stale state conflicts | Agent receives latest `gridState` on each request; editor updates on SSE events |
| Removing IG tools breaks server-side code | Server still has IG tool definitions | Server-side IG code is dead but harmless — remove from frontend tool list only, server tools are selected by frontend |
| Library catalogue iframe perf | Slow rendering | Lazy-load iframes with IntersectionObserver |
| Agent generates overlapping components | Grid collision | `place_component` validates overlap before placing |
| `SkemaEditor.tsx` still passes `currentSpec`/`onSpecGenerated` | Props still in SkemaEditor | Clean up SkemaEditor props after removing from types |
