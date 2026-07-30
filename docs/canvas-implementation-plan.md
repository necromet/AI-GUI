# Canvas — Grid Builder Implementation Plan

## Overview

Replace the iframe-based `SkemaEditor` canvas preview with a Canvas interactive grid builder for the `canvas` project type. Users get a fixed-resolution canvas where they can add predefined section types (navbar, hero, features, etc.) with mock content previews, arrange them vertically, and export code.

**Reference design:** `docs/layout_craft.html` — vanilla HTML/JS prototype that this implementation ports to React.

## Architecture

### Fixed Template Approach

Canvas uses fixed screen resolution templates instead of freeform drawing:

| Template | Resolution | Grid | Cell Size |
|----------|-----------|------|-----------|
| Desktop 1080p | 1920×1080 | 12-col | 160×80px |
| Desktop 1440p | 1440×900 | 12-col | 120×80px |
| Tablet | 768×1024 | 8-col | 96×80px |
| Mobile | 375×812 | 4-col | 94×80px |

Each template defines a fixed column count and cell width. Components are placed full-width and stacked vertically (like a website wireframe).

### Component Flow

```
SkemaPanel (canvas project type selected)
  └─ CanvasEditor (new)
       ├─ Left Sidebar (244px) — AI prompt + Quick Add buttons
       ├─ Canvas Area (flex-1)
       │    ├─ Canvas Toolbar — resolution picker, grid info
       │    └─ Canvas Scroll
       │         └─ Canvas Grid — column ruler + grid lines + placed components
       └─ Right Panel (270px) — Properties of selected component
```

### Data Model

```typescript
interface GridComponent {
  id: string;
  type: SectionType;       // navbar, hero, features, etc.
  order: number;           // vertical ordering
  prompt: string;          // user's description
  generating: boolean;     // animation state
  generated: boolean;      // completed state
}

interface GridState {
  version: '1.0';
  template: ResolutionTemplate;  // desktop-1080p, desktop-1440p, etc.
  components: GridComponent[];
  pageTitle: string;
}
```

Components are **full-width only** — stacked vertically. No arbitrary grid-cell placement. This matches website wireframe semantics.

### State Storage

Grid state serialized as JSON → `board.generatedHtml` with a `__canvas__:1.0` prefix marker. This avoids DB schema changes.

## Files

### New Files (9)

| File | Lines | Purpose |
|------|-------|---------|
| `components/canvas/types.ts` | ~35 | Grid data model types |
| `components/canvas/constants.ts` | ~100 | Section types, colors, resolution templates |
| `components/canvas/MockContent.tsx` | ~250 | JSX mock content for each section type |
| `components/canvas/CanvasGrid.tsx` | ~180 | Canvas grid with ruler, lines, components |
| `components/canvas/CanvasSidebar.tsx` | ~80 | Left sidebar with AI prompt + Quick Add |
| `components/canvas/CanvasProperties.tsx` | ~120 | Right properties panel |
| `components/canvas/CanvasExportModal.tsx` | ~150 | Export dialog (HTML/React/Tailwind) |
| `components/canvas/CanvasEditor.tsx` | ~300 | Main editor container |
| `components/canvas/index.ts` | ~3 | Barrel export |

### Modified Files (2)

| File | Change |
|------|--------|
| `components/SkemaPanel.tsx` | Route canvas → CanvasEditor |
| `src/globals.css` | Add Canvas CSS utilities |

## UI Style Integration

All components use existing codebase patterns:
- shadcn/ui: `Button`, `Badge`, `Card`, `Input`, `Textarea`, `Dialog`, `Select`
- Tailwind CSS v4 with `cn()` from `lib/utils.ts`
- CSS variables: `--bg-*`, `--text-*`, `--border-*`, `--neon-color`, `--neon-rgb`
- Lucide React icons
- `sonner` for toast notifications

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Full-width stacked | Matches website wireframe semantics |
| Grid drawing | Removed | User said "fixed template" — no freeform draw |
| AI generation | Simulated (setTimeout) | Real AI integration is a separate phase |
| State storage | `board.generatedHtml` JSON prefix | Avoids DB schema migration |
| Carousel/Story | Unchanged in SkemaEditor | No regression risk |
