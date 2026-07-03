# Component Library — New Top-Level Page with Agent Connectivity

## Overview

Create a new **Library** mode as a top-level page (alongside Chat and Experiments) that serves as a general-purpose component library. It has its own AI agent for browsing/managing components, and exposes an API that other agents (Stitch, Plugin Agent, RAG) can consume.

---

## Architecture

### Routing

| Route | Description |
|-------|-------------|
| `/library` | Library grid view (browse, search, create components) |
| `/library/:componentId` | Component detail / edit view |

The Library is a new `Mode` in `types.ts`: `'selector' | 'chat' | 'experiments' | 'library'`

### Database

New table `library_components` (separate from `stitch_components`):

```sql
CREATE TABLE IF NOT EXISTS library_components (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,          -- 'ui-widget' | 'template' | 'snippet' | 'pattern' | 'hook' | 'util' | 'agent-tool'
  content_type TEXT NOT NULL,      -- 'tsx' | 'html' | 'css' | 'js' | 'json' | 'markdown'
  description TEXT,
  tags TEXT,                       -- JSON array
  content TEXT NOT NULL,           -- the actual code/content
  metadata TEXT,                   -- JSON: { framework, dependencies, agentCapabilities, ... }
  thumbnail TEXT,
  is_global INTEGER NOT NULL DEFAULT 1,
  agent_accessible INTEGER NOT NULL DEFAULT 1,  -- whether other agents can query this
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS library_embeddings (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_le_component ON library_embeddings(component_id);
```

### Server Routes (`/api/library/*`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/library/components` | List components (filter by category, tags) |
| GET | `/api/library/components/:id` | Get single component |
| POST | `/api/library/components` | Create component |
| PUT | `/api/library/components/:id` | Update component |
| DELETE | `/api/library/components/:id` | Delete component |
| POST | `/api/library/components/search` | Semantic search (embeddings) |
| POST | `/api/library/components/reindex` | Reindex all embeddings |
| POST | `/api/library/agent/chat` | Agent chat endpoint (SSE streaming) |

### Agent Connectivity

**Inbound (library has its own AI):**
- The library page embeds a chat panel where an AI agent can:
  - Search components by natural language
  - Create/edit components from descriptions
  - Suggest components for a given use case
  - Generate component code

**Outbound (other agents consume the library):**
- Add `search_library` tool to `server/services/agentService.ts`:
  ```ts
  {
    name: 'search_library',
    description: 'Search the component library for reusable components, templates, snippets, and patterns.',
    parameters: {
      query: { type: 'string', description: 'Natural language search query' },
      category: { type: 'string', description: 'Optional category filter' },
    }
  }
  ```
- This tool is available to Plugin Agent and Stitch agent chats
- When Stitch's agent generates HTML, it can pull components from the library

---

## Files to Create

### 1. `components/LibraryPanel.tsx`
Main library page component. Features:
- Grid/list view of components with search + category filter
- Create new component modal
- Component detail view with code preview
- Embedded AI agent chat sidebar (collapsible)
- Responsive layout

### 2. `server/routes/library.ts`
Express router with CRUD + search + agent chat endpoints.

### 3. `server/services/libraryService.ts`
Database operations for `library_components` + `library_embeddings`. Reuse patterns from `stitchLibraryService.ts`.

### 4. `server/services/libraryAgentService.ts`
Agent system prompt + tool definitions specific to library management. The agent can:
- `search_components` — semantic search
- `create_component` — create from description
- `suggest_components` — recommend components for a task

### 5. `data/seedLibraryComponents.ts`
Seed data with starter components (UI widgets, templates, patterns).

---

## Files to Modify

### `types.ts`
- Add `'library'` to `Mode` type
- Add `'library'` to `ConversationType`
- Add library-specific types (or put in `types/library.ts`)

### `App.tsx`
- Add `isLibraryMode` detection from `location.pathname.startsWith('/library')`
- Add library auth state (`edward:labs_library_session`)
- Add `/library` and `/library/:componentId` routes
- Import `LibraryPanel`
- Add library sidebar mode handling

### `components/ModeSelector.tsx`
- Add Library card (with `BookOpen` or `Library` icon from lucide)
- Add library password modal (new password TBD)
- Update cards grid to 3 columns on desktop

### `components/Sidebar.tsx`
- Add Library mode handling (when `currentMode === 'library'`)
- Library sidebar shows: component categories, search, recent components
- Or: library sidebar shows agent chat history + component navigation

### `server/index.ts`
- Import and mount `libraryRoutes` at `/api/library`

### `server/services/agentService.ts`
- Add `search_library` tool to `AVAILABLE_TOOLS`
- Add `toolSearchLibrary` implementation that calls `libraryService.searchComponents`

### `server/db/schema.ts`
- Add `library_components` and `library_embeddings` tables

### `server/db/index.ts`
- Add migration for new tables (if needed beyond schema creation)

---

## Implementation Order

1. **Database schema** — Add `library_components` + `library_embeddings` tables
2. **Server service** — `libraryService.ts` (CRUD + search + embeddings)
3. **Server routes** — `library.ts` (REST API + agent chat endpoint)
4. **Seed data** — `seedLibraryComponents.ts` with starter components
5. **Types** — Update `types.ts` with library types
6. **Client component** — `LibraryPanel.tsx` (main page)
7. **App routing** — Update `App.tsx` with `/library` routes + auth
8. **ModeSelector** — Add Library card
9. **Sidebar** — Add Library mode navigation
10. **Agent connectivity** — Add `search_library` tool to agent service
11. **Library agent** — Embedded AI chat in library page for search/manage

---

## Agent Integration Design

### Library Agent System Prompt
```
You are a component library assistant. You help users find, create, and manage reusable components.

Available tools:
- search_components: Search the library by natural language
- create_component: Create a new component from a description
- list_categories: List all available categories

When the user asks for a component, search the library first. If nothing matches, offer to create one.
```

### Cross-Agent Tool
When other agents (Stitch, Plugin Agent) have `search_library` enabled:
- They call `/api/library/components/search` with a query
- Results include component content, metadata, and relevance score
- The agent can then incorporate the component into its output

---

## Auth

Library mode password: `psalm23`
Session key: `edward:labs_library_session`

---

## UI Sketch

```
┌─────────────────────────────────────────────────┐
│ [≡] [Library]                    [ModelSelect]  │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  🔍 Search components...                 │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  [All] [UI Widgets] [Templates] [Snippets] ...  │
│                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Card    │ │ Card    │ │ Card    │          │
│  │ Preview │ │ Preview │ │ Preview │          │
│  │ Name    │ │ Name    │ │ Name    │          │
│  │ Tags    │ │ Tags    │ │ Tags    │          │
│  └─────────┘ └─────────┘ └─────────┘          │
│                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Card    │ │ Card    │ │ + New   │          │
│  └─────────┘ └─────────┘ └─────────┘          │
│                                                  │
├─────────────────────────────────────────────────┤
│  [💬 Agent Chat]  (collapsible bottom panel)     │
│  "Find me a responsive navbar component"         │
│  → Found 3 matches: ...                          │
└─────────────────────────────────────────────────┘
```
