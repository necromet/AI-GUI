# actuallyexplain — Integration into Database Explorer

## Overview

Port the standalone `actuallyexplain/` SQL visual flow mapper into the edward:labs Database Explorer (`/database` mode) as a first-class feature. Users get a "Visual Explain" toggle in the SQL editor toolbar that renders an interactive ReactFlow diagram showing the logical intent of any SQL query — with node details, bidirectional editor↔diagram highlighting, and full mobile support.

## What It Does

actuallyexplain is a **SQL logical intent visualizer** — it parses raw SQL into an AST, builds a directed graph of operations (FROM → WHERE → JOIN → SELECT → ORDER BY → LIMIT), and renders it as an interactive node-edge diagram. Each node shows:

- The raw SQL fragment
- A plain-English description ("Keeps only rows where o.total > 100")
- A color-coded icon by type (table=green, where=yellow, join=teal, select=blue)

Clicking a node highlights the corresponding SQL in the Monaco editor and opens a details panel with an encyclopedia definition + link to PostgreSQL docs.

## Architecture

```
DatabasePanel.tsx
├── Schema Browser (left)
├── Main Content (center)
│   ├── SQL Editor Toolbar  ← [Explain✦] toggle button added here
│   ├── Monaco Editor (sql)
│   ├── ExplainCanvas       ← NEW — ReactFlow diagram (when explain mode on)
│   │   ├── ReactFlow nodes (SqlNode)
│   │   ├── ReactFlow edges (RecursiveEdge)
│   │   └── NodeDetailsPanel (overlay)
│   └── Results Table
└── Connect Form / Dialogs
```

### Data Flow

```
User types SQL in Monaco Editor
  → sql state updates in DatabasePanel
  → ExplainCanvas receives sql prop
  → 300ms debounce → pgsql-ast-parser parses SQL
  → buildFlowFromAST() → dagre layout → nodes + edges
  → ReactFlow renders diagram
  → User clicks node → highlights SQL in Monaco via callback
  → User moves cursor in Monaco → highlights matching node via prop
```

## New Dependencies

```bash
npm install @xyflow/react dagre pgsql-ast-parser
npm install -D @types/dagre
```

## Files

### New Files (7)

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `components/actuallyexplain/buildFlowFromAST.ts` | ~1012 | Core AST→graph engine with dagre layout |
| `components/actuallyexplain/NodeActionsContext.ts` | ~5 | React context for node click actions |
| `components/actuallyexplain/RecursiveEdge.tsx` | ~28 | Custom edge for recursive CTE feedback loops |
| `components/actuallyexplain/SqlNode.tsx` | ~80 | Custom ReactFlow node (Tailwind-ified) |
| `components/actuallyexplain/NodeDetailsPanel.tsx` | ~300 | Slide-in details panel with encyclopedia |
| `components/actuallyexplain/ExplainCanvas.tsx` | ~350 | Main canvas component (refactored from standalone) |
| `docs/actuallyexplain-integration.md` | this file | Implementation documentation |

### Modified Files (2)

| File | Change |
|------|--------|
| `components/DatabasePanel.tsx` | Add explain mode toggle, canvas integration, bidirectional highlighting |
| `src/globals.css` | Add ReactFlow dark theme overrides, highlight decoration, animations |

## UI Design

### Toolbar Addition

A new "Visual Explain" toggle button in the SQL editor toolbar:

```
[Schema] [SQL] [Format] [Clear] [WordWrap] [FontSize] [Explain✦] [Ctrl+Enter] [?] [History] [Run]
```

- Icon: `Workflow` from lucide-react
- Active state: neon accent color glow
- Tooltip: "Visual Explain — see your query as a diagram"

### Layout Modes

**Default mode** (current):
```
┌──────────┬──────────────────────────┐
│          │  [Toolbar]               │
│  Schema  │  Monaco Editor           │
│          │  ─────────────────────── │
│          │  Results Table           │
└──────────┴──────────────────────────┘
```

**Explain mode** (new):
```
┌──────────┬──────────────────────────┐
│          │  [Toolbar] [Explain✦]    │
│  Schema  │  Monaco Editor           │
│          │  ════════════════════════ │
│          │  ReactFlow Canvas        │
│          │    └─ NodeDetailsPanel   │
│          │  ════════════════════════ │
│          │  Results Table           │
└──────────┴──────────────────────────┘
```

The editor and canvas share vertical space with a resizable divider. Results table remains below.

### Node Details Panel

Slide-in panel from the right (overlays the canvas) showing:

1. **Header**: icon + operation name (e.g., "WHERE (Filter)")
2. **Raw SQL block**: the SQL fragment
3. **Definition**: encyclopedia entry + PostgreSQL docs link
4. **In this query**: contextual explanation with inline code styling

### Mobile (< 768px)

- Editor and canvas stack vertically with tab switcher ("Code" / "Diagram")
- Node details panel becomes full-screen overlay
- Touch-friendly node interaction

## Color Mapping

Each SQL operation type has a distinct color:

| Kind | Color | Icon |
|------|-------|------|
| table | `#879A39` (green) | Database |
| join | `#3AA99F` (teal) | Link |
| where | `#D0A215` (yellow) | Filter |
| select | `#4385BE` (blue) | SquareDashedMousePointer |
| orderby | `#8B7EC8` (purple) | ArrowUpDown |
| groupby | `#CE5D97` (pink) | Group |
| cte | `#3AA99F` (teal) | Repeat2 |
| union | `#8B7EC8` (purple) | SquaresUnite |
| insert | `#DA702C` (orange) | BetweenHorizonalStart |
| update | `#DA702C` (orange) | SquarePen |
| delete | `#D14D41` (red) | Trash2 |
| create | `#879A39` (green) | SquarePlus |

## Bidirectional Highlighting

### Diagram → Editor

1. User clicks a node in ReactFlow
2. `ExplainCanvas` calls `onHighlight({ start, end })` with AST byte offsets
3. `DatabasePanel` receives the range, converts to Monaco positions via `model.getPositionAt()`
4. Sets selection + decoration with `.sql-explain-highlight` CSS class
5. Scrolls editor to reveal the range

### Editor → Diagram

1. User moves cursor in Monaco
2. `DatabasePanel` tracks cursor offset via `editor.onDidChangeCursorPosition`
3. Passes `cursorOffset` prop to `ExplainCanvas`
4. `ExplainCanvas` finds the node whose AST location contains that offset
5. Highlights the node with glow outline

## Supported SQL Statements

| Statement | Status |
|-----------|--------|
| SELECT | Full support |
| JOIN (INNER, LEFT, RIGHT, FULL, CROSS) | Full support |
| WHERE, HAVING | Full support |
| GROUP BY, ORDER BY | Full support |
| LIMIT, OFFSET | Full support |
| Subqueries (FROM, WHERE, SELECT) | Full support |
| CTE (WITH) | Full support |
| WITH RECURSIVE | Full support (custom edge for feedback loop) |
| UNION, UNION ALL, INTERSECT, EXCEPT | Full support |
| INSERT (VALUES, SELECT) | Full support |
| UPDATE | Full support |
| DELETE | Full support |
| CREATE TABLE | Full support |
| RETURNING | Full support |

**Not supported** (shows error message):
- EXPLAIN output (execution plans, not logical intent)
- NATURAL JOIN
- GRANT/REVOKE (DCL)
- CREATE ROLE/USER

## Implementation Phases

### Phase 1: Core Engine + Components
1. Install npm dependencies
2. Port `buildFlowFromAST.ts` (pure logic, no UI changes)
3. Port `NodeActionsContext.ts` + `RecursiveEdge.tsx`
4. Create `SqlNode.tsx` with Tailwind classes
5. Create `NodeDetailsPanel.tsx` with Tailwind + shadcn ScrollArea

### Phase 2: Canvas Component
6. Create `ExplainCanvas.tsx` — ReactFlow canvas with parse/debounce/layout
7. Add ReactFlow CSS overrides to `globals.css`

### Phase 3: DatabasePanel Integration
8. Add explain mode state + toggle button to `DatabasePanel.tsx`
9. Render `ExplainCanvas` between editor and results when active
10. Wire bidirectional highlighting

### Phase 4: Polish
11. Mobile responsiveness
12. Empty states and error messages
13. Build verification

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| No separate Monaco | Receive `sql` as prop | Editor already exists in DatabasePanel |
| CSS Modules → Tailwind | Convert all styles | Project uses Tailwind exclusively |
| AboutModal → shadcn Dialog | Reuse existing UI library | Consistent with rest of app |
| Lazy load | React.lazy + Suspense | ReactFlow is ~150KB, load only when needed |
| No server round-trip | Client-side parsing | pgsql-ast-parser runs in browser, instant feedback |
