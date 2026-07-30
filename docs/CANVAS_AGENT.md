# Canvas Agent Architecture

## Overview

The Canvas Agent is an AI-powered assistant integrated into the Canvas editor (`/skema/canvas`). It enables users to manipulate the grid-based canvas layout through natural language commands, search the component library, and manage sections via a conversational interface.

## Architecture

```
CanvasEditor.tsx
├── CanvasSidebar (left — AI prompt + Quick Add)
├── CanvasGrid (center — grid with components)
├── CanvasProperties (right — Properties tab + Catalogue tab)
│   └── CanvasCatalogue → CanvasCatalogueCard
└── SkemaAgentSidebar (right — agent chat)
    └── useSkemaAgentStream → POST /api/skema-agent/chat
```

## Data Flow

1. User types a message in `SkemaAgentSidebar`
2. `useSkemaAgentStream` sends the message + `gridState` context to `/api/skema-agent/chat`
3. Server builds canvas tools via `buildCanvasTools()` and system prompt via `buildCanvasSystemPrompt()`
4. AI responds with tool calls (e.g., `place_component`, `remove_component`)
5. Server executes tools, emits SSE events (`component_placed`, `component_removed`, `component_updated`)
6. Frontend handles SSE events and updates `gridState` via callbacks
7. `CanvasEditor` persists the updated state to the database

## Tools

| Tool | Description |
|------|-------------|
| `place_component` | Place a new section on the canvas grid |
| `remove_component` | Remove a section from the canvas |
| `move_component` | Move a section up or down by row delta |
| `resize_component` | Change section height (row span) |
| `update_component` | Update section description or type |
| `regenerate_component` | Regenerate section content |
| `search_library` | Search the component library |

## SSE Events

| Event | Payload | Description |
|-------|---------|-------------|
| `component_placed` | `GridComponent` | A new component was placed |
| `component_removed` | `{ componentId: string }` | A component was removed |
| `component_updated` | `GridComponent` | A component was moved/resized/updated |

## Key Files

| File | Purpose |
|------|---------|
| `server/services/canvasAgentTools.ts` | Canvas grid tool definitions + `buildCanvasTools()` + `buildCanvasSystemPrompt()` |
| `server/routes/skemaAgent.ts` | Express route handling tool execution + SSE emission |
| `components/skema/SkemaAgentSidebar.tsx` | Agent chat UI (reused from Skema) |
| `components/skema/agent/useSkemaAgentStream.ts` | SSE streaming hook with multi-round tool loop |
| `components/canvas/CanvasEditor.tsx` | Mounts sidebar, handles agent grid events |
| `components/canvas/CanvasGrid.tsx` | Renders components including HTML iframes |
| `components/canvas/CanvasProperties.tsx` | Properties + Catalogue tab panel |
| `components/canvas/CanvasCatalogue.tsx` | Library component browser |
| `components/canvas/CanvasCatalogueCard.tsx` | Individual catalogue card with preview |
| `lib/agentConfig.ts` | Frontend tool configuration for skema agent |

## GridComponent Extensions

```typescript
interface GridComponent {
  // ... existing fields
  referenceComponentId?: string;  // Links to library component
  generatedHtml?: string;         // Rendered HTML content (iframe)
}
```

## Component Catalogue

The catalogue tab in `CanvasProperties` fetches components from `GET /api/library/components` and displays them with iframe previews. Clicking "Add to Canvas" creates a `GridComponent` with `referenceComponentId` set and `generatedHtml` populated from the library component's content.

## Session Management

Reuses the existing `skema_agent_sessions` SQLite table. Canvas projects are `skema_projects` with `project_type = 'canvas'`. Sessions are scoped by `project_id` + `board_idx`.
