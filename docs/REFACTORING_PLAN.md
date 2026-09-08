# Refactoring Plan

## Overview

The codebase has grown organically with several files exceeding 1,000 lines and significant duplication across agent routes. This plan breaks the refactoring into 6 phases, ordered by impact and dependency. Each phase is independently shippable — the app should build and run after each phase.

**Goal:** Reduce the largest files from 1,700+ lines to <500, eliminate duplicated agent boilerplate, and make adding a new mode a <100-line change instead of touching 3+ files.

---

## Phase 1: Extract Shared Agent Infrastructure

**Problem:** `server/routes/libraryAgent.ts`, `skemaAgent.ts`, and `agent.ts` each duplicate ~80 lines of SSE setup, agentic tool-loop, error handling, and language detection. `server/services/agentService.ts` (1,530 lines) contains three separate tool sets and executor functions with near-identical switch/case blocks.

### Step 1.1: Create `server/lib/agentRunner.ts`

Extract a shared `runAgentLoop()` function:

```typescript
interface AgentLoopConfig {
  req: Request;
  res: Response;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  tools: ToolDefinition[];
  executeTool: (name: string, args: Record<string, any>, context: any) => Promise<ToolResult>;
  context?: any;
  maxRounds?: number;
  model?: string;
  provider?: string;
  onToolCall?: (call: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
  onDone?: () => void;
}

export async function runAgentLoop(config: AgentLoopConfig): Promise<void>
```

This consolidates:
- SSE header setup
- `emitEvent` helper
- `reqClosed` detection
- The `while (iteration < MAX_ROUNDS)` loop
- `streamChatCompletion` → `readSSEStream` → parse tool calls → execute → repeat
- Error catch + SSE error emit
- `[DONE]` signal

**Files changed:**
- New: `server/lib/agentRunner.ts` (~120 lines)
- Modified: `server/routes/libraryAgent.ts` (309 → ~150 lines)
- Modified: `server/routes/skemaAgent.ts` (349 → ~180 lines)
- Modified: `server/routes/agent.ts` (272 → ~120 lines)

### Step 1.2: Create `server/lib/sseHelpers.ts`

Extract shared SSE utilities:

```typescript
export function setupSSEHeaders(res: Response): void
export function createEmitter(res: Response): (event: any) => void
export function setupCloseDetection(req: Request): { isClosed: () => boolean }
export function sendSSEError(res: Response, error: string): void
export function buildSystemPrompt(...parts: (string | undefined | null)[]): string
```

**Files changed:**
- New: `server/lib/sseHelpers.ts` (~40 lines)
- All agent route files import from here instead of inlining

### Step 1.3: Split `server/services/agentService.ts`

Break the 1,530-line file into domain-specific tool modules:

| New File | Contents | ~Lines |
|----------|----------|--------|
| `server/services/tools/webTools.ts` | `web_browse`, `search_web`, `search_library` | 200 |
| `server/services/tools/codeTools.ts` | `execute_code` | 150 |
| `server/services/tools/htmlTools.ts` | `generate_html`, `edit_html`, `generate_spec`, `edit_spec` | 300 |
| `server/services/tools/fileTools.ts` | `create_file`, `update_file`, `delete_file`, `read_file`, `list_files` | 200 |
| `server/services/tools/commonTools.ts` | `ask_user`, `create_todo_list`, `set_preview` | 100 |
| `server/services/tools/index.ts` | Barrel exports + shared `ToolDefinition` type | 30 |

Each tool module exports:
- `TOOL_DEFINITIONS: ToolDefinition[]` — the tool schema
- `executeXxxTool(name, args, context): Promise<ToolResult>` — execution logic

The current `executeTool`, `executeSkemaFileTool`, `executeLibraryTool` functions become thin routers that delegate to the appropriate module.

**Files changed:**
- New: 6 files under `server/services/tools/`
- Modified: `server/services/agentService.ts` (1,530 → ~200 lines — just re-exports and the prompt builders)

### Step 1.4: Extract shared tool prompt builder

The four `buildXxxToolPrompt()` functions all format tools identically:

```
### tool_name
Description
Parameters:
  - param (type): description
```

Extract into `server/lib/formatToolPrompt.ts`:

```typescript
export function formatToolPrompt(tools: ToolDefinition[]): string
```

**Files changed:**
- New: `server/lib/formatToolPrompt.ts` (~25 lines)
- Modified: `server/services/agentService.ts` — uses shared formatter
- Modified: `server/routes/agentBuilder.ts` — uses shared formatter

---

## Phase 2: Extract Auth Hook and Mode Registry

**Problem:** `App.tsx` has 8 separate `useState` + `sessionStorage` calls for auth (lines 211–234), 8 separate `onUnlock*` callbacks, and a growing ternary chain for mode detection (line 199). Adding a new mode requires editing 5+ places in `App.tsx`.

### Step 2.1: Create `hooks/useModeAuth.ts`

```typescript
interface ModeConfig {
  id: string;
  password: string;
  sessionKey: string;
}

const MODES: ModeConfig[] = [
  { id: 'chat', password: 'thelordismyshepherd', sessionKey: 'edward:labs_chat_session' },
  { id: 'rag', password: 'herestoresmysoul', sessionKey: 'edward:labs_rag_session' },
  // ... all 8 modes
];

export function useModeAuth() {
  // Returns: { isUnlocked(mode), unlock(mode), authStates }
  // Single hook replaces 8 useState + 8 onUnlock callbacks
}
```

**Files changed:**
- New: `hooks/useModeAuth.ts` (~60 lines)
- Modified: `App.tsx` — replaces lines 211–234 and all `onUnlock*` callbacks
- Modified: `components/ModeSelector.tsx` — consumes from hook or receives simplified props

### Step 2.2: Create `lib/modeRegistry.ts`

Central registry for all modes:

```typescript
interface ModeDefinition {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  password: string;
  sessionKey: string;
  hasSidebar: boolean;
  hasHeader: boolean;
}

export const MODES: ModeDefinition[] = [...];
export function getModeFromPath(pathname: string): ModeDefinition | null;
```

This replaces the ternary chain at `App.tsx:199` and the mode detection logic duplicated in `Sidebar.tsx:950–958`.

**Files changed:**
- New: `lib/modeRegistry.ts` (~80 lines)
- Modified: `App.tsx` — `const currentMode = getModeFromPath(location.pathname)`
- Modified: `components/Sidebar.tsx` — uses registry instead of inline boolean flags

### Step 2.3: Create `hooks/useThemeSettings.ts`

Extract theme/font/neon state management from `App.tsx` (lines 235–257, 373–450):

```typescript
export function useThemeSettings() {
  // Returns: { theme, fontSize, fontFamily, neonColor, neonPreset, themePreset, setters... }
  // Handles all localStorage persistence and CSS variable application internally
}
```

**Files changed:**
- New: `hooks/useThemeSettings.ts` (~100 lines)
- Modified: `App.tsx` — replaces ~15 useState calls and ~5 useEffect hooks

---

## Phase 3: Split Sidebar into Per-Mode Components

**Problem:** `Sidebar.tsx` is 1,693 lines with a massive ternary chain (lines 1108–1587) selecting which mode's content to render. Each mode's sidebar content is 50–150 lines of JSX inline.

### Step 3.1: Create `components/sidebar/` directory structure

```
components/sidebar/
  SidebarShell.tsx        — Outer <aside>, header, footer user card (~200 lines)
  ChatSidebar.tsx         — Chat conversation list (~80 lines)
  RagSidebar.tsx          — RAG conversation list (~80 lines)
  LibrarySidebar.tsx      — Library folder/component list (~140 lines)
  SkemaSidebar.tsx        — Skema project sidebar (~30 lines, delegates to CanvasSidebarContent)
  DatabaseSidebar.tsx     — Database schema browser (~30 lines)
  NotesSidebar.tsx        — Notes page tree (~100 lines)
  PythonSidebar.tsx       — Python empty state (~15 lines)
  SettingsSidebar.tsx     — Settings tab list (~40 lines)
  TokenStatsSidebar.tsx   — Token stats panel (~20 lines)
  shared/
    ConversationList.tsx  — Shared chat/RAG conversation grouping + rendering (~80 lines)
    EmptyState.tsx        — Shared empty state pattern (~20 lines)
```

`SidebarShell.tsx` receives `currentMode` and renders the appropriate mode component via a simple map:

```typescript
const SIDEBAR_COMPONENTS: Record<string, React.ComponentType<ModeSidebarProps>> = {
  chat: ChatSidebar,
  rag: RagSidebar,
  library: LibrarySidebar,
  // ...
};
```

**Files changed:**
- New: 12 files under `components/sidebar/`
- Modified: `components/Sidebar.tsx` → replaced by `components/sidebar/SidebarShell.tsx` (~200 lines)
- Deleted: `components/Sidebar.tsx` (or kept as re-export for backward compat)

### Step 3.2: Extract shared `ConversationList` component

Chat and RAG sidebars share identical conversation grouping (today/yesterday/week/older), rendering, and delete logic. Extract into a shared component.

**Files changed:**
- New: `components/sidebar/shared/ConversationList.tsx` (~80 lines)
- Modified: `ChatSidebar.tsx` and `RagSidebar.tsx` — use `<ConversationList>`

---

## Phase 4: Split App.tsx into Route Components

**Problem:** `App.tsx` is 1,766 lines. It holds all routing, auth gating, sidebar/header wiring, chat logic (send/regenerate/edit/feedback), and mode-specific control state in one component.

### Step 4.1: Create `components/routes/` directory

Extract each route's element into its own wrapper component:

```
components/routes/
  ChatRoute.tsx           — Chat message list + empty state (~80 lines)
  RagRoute.tsx            — RAG panel wrapper (~30 lines)
  SkemaRoute.tsx          — Skema panel + controls wiring (~50 lines)
  PythonRoute.tsx         — Python panel wrapper (~30 lines)
  LibraryRoute.tsx        — Library panel + controls wiring (~40 lines)
  DatabaseRoute.tsx       — Database panel + controls wiring (~40 lines)
  AgentBuilderRoute.tsx   — Agent builder wrapper (~20 lines)
  NotesRoute.tsx          — Notes panel + controls wiring (~30 lines)
  SettingsRoute.tsx       — Settings page wrapper (~30 lines)
```

Each route component:
- Receives shared props (theme, modelConfig, models, onNotification)
- Manages its own `onControlsChange` callback
- Renders the panel component with the correct props

**Files changed:**
- New: 9 files under `components/routes/`
- Modified: `App.tsx` — Routes block becomes simple `<Route path="/chat" element={<ChatRoute ... />} />`

### Step 4.2: Extract `hooks/useChat.ts`

Move chat logic out of `App.tsx` (lines 483–984 — ~500 lines):

```typescript
export function useChat(modelConfig: ModelConfig, models: ModelConfig[]) {
  // Returns: { messages, isStreaming, sendMessage, stopGeneration, regenerate, editMessage, feedback, reattach, handleNewChat }
}
```

This consolidates:
- `handleSendMessage` (lines 652–781)
- `handleStopGeneration` (lines 783–787)
- `handleStreamError` (lines 789–807)
- `handleRegenerate` (lines 878–961)
- `handleEditMessage` (line 963)
- `handleFeedback` (lines 965–968)
- `handleReattach` (lines 970–984)
- `processStreamResponse` (lines 115–183)
- Related refs: `abortControllerRef`, `regenerateRef`, `editMessageRef`

**Files changed:**
- New: `hooks/useChat.ts` (~300 lines)
- Modified: `App.tsx` — replaces ~500 lines of chat logic

### Step 4.3: Create `components/AppLayout.tsx`

Extract the main layout shell from `App.tsx` (lines 1097–1763):

```typescript
export function AppLayout({ children, sidebar, header, agentSidebar }: AppLayoutProps) {
  // Renders: sidebar + main area with header + content + input
}
```

**Files changed:**
- New: `components/AppLayout.tsx` (~100 lines)
- Modified: `App.tsx` — uses `<AppLayout>` instead of inline layout JSX

### Step 4.4: Create `components/Header.tsx`

Extract the top bar logic (lines 1184–1407 — ~220 lines of conditional header rendering):

```typescript
export function Header({ mode, controls, ... }: HeaderProps) {
  // Renders the appropriate header based on mode and available controls
}
```

**Files changed:**
- New: `components/Header.tsx` (~150 lines)
- Modified: `App.tsx` — uses `<Header>` instead of inline conditional JSX

---

## Phase 5: Consolidate Agent Route Patterns

**Problem:** `libraryAgent.ts`, `skemaAgent.ts`, and `agentBuilder.ts` share session CRUD patterns. The frontend agent hooks (`useAgentStream.ts`, `useSkemaAgentStream.ts`) also share significant SSE parsing logic.

### Step 5.1: Create `server/lib/sessionCrud.ts`

Generic session CRUD factory:

```typescript
export function createSessionRoutes(router: Router, config: {
  table: string;
  idColumn: string;
  foreignKey?: { column: string; param: string };
  maxSessions?: number;
}): void
```

Generates: `GET /sessions`, `POST /sessions`, `PUT /sessions/:id`, `DELETE /sessions/:id`

**Files changed:**
- New: `server/lib/sessionCrud.ts` (~80 lines)
- Modified: `server/routes/skemaAgent.ts` — uses factory for session endpoints
- Modified: `server/routes/agentBuilder.ts` — uses factory for agent/tool/workflow CRUD

### Step 5.2: Create `hooks/useAgentStreamBase.ts`

Extract shared SSE streaming logic from `useAgentStream.ts` and `useSkemaAgentStream.ts`:

```typescript
export function useAgentStreamBase(config: {
  endpoint: string;
  onEvent: (event: AgentEvent) => void;
  onDone: () => void;
  onError: (error: string) => void;
  maxRounds?: number;
}) {
  // Returns: { send, cancel, isStreaming, round }
}
```

**Files changed:**
- New: `hooks/useAgentStreamBase.ts` (~100 lines)
- Modified: `components/library/agent/useAgentStream.ts` — delegates to base
- Modified: `components/skema/agent/useSkemaAgentStream.ts` — delegates to base

---

## Phase 6: Cleanup and Type Safety

### Step 6.1: Consolidate types

Move scattered type definitions into organized files:

```
types/
  index.ts              — Re-exports everything
  chat.ts               — Message, ChatSession, Role, etc.
  models.ts             — ModelConfig, ModelType
  library.ts            — LibraryComponent, LibraryFolder, LibraryControls
  skema.ts              — SkemaProject, SkemaControls, SkemaBoard
  database.ts           — DatabaseConnection, DatabaseSidebarControls
  agent.ts              — AgentEvent, ToolCall, ToolResult, ToolDefinition
  notes.ts              — Note, NotesControls
  ui.ts                 — Theme, SidebarPanel, Mode
```

**Files changed:**
- New: 9 files under `types/`
- Modified: `types.ts` — becomes re-export barrel
- Modified: All files that import from `types.ts` — no changes needed if barrel re-exports

### Step 6.2: Add barrel exports

Create `index.ts` barrels for:
- `components/ui/index.ts`
- `components/sidebar/index.ts`
- `components/routes/index.ts`
- `server/lib/index.ts`
- `server/services/tools/index.ts`
- `hooks/index.ts`

### Step 6.3: Remove dead code

- `_run_build.cjs` and `_run_build.mjs` — empty files (0 bytes)
- `build-check.mjs` — 8 lines, check if still needed
- `open-agent-builder` — git submodule reference, verify if used

---

## File Size Targets

| File | Current | After All Phases |
|------|---------|-----------------|
| `App.tsx` | 1,766 lines | ~300 lines |
| `components/Sidebar.tsx` | 1,693 lines | Deleted (replaced by `sidebar/SidebarShell.tsx` ~200 lines) |
| `server/services/agentService.ts` | 1,530 lines | ~200 lines |
| `server/routes/libraryAgent.ts` | 309 lines | ~150 lines |
| `server/routes/skemaAgent.ts` | 349 lines | ~180 lines |
| `server/routes/agent.ts` | 272 lines | ~120 lines |
| `components/ModeSelector.tsx` | 512 lines | ~350 lines |

## Execution Order

```
Phase 1 (Agent Infrastructure)  ← Start here — highest duplication, no frontend impact
  ↓
Phase 2 (Auth + Mode Registry)  ← Unblocks Phase 3 and 4
  ↓
Phase 3 (Sidebar Split)         ← Independent of Phase 4
  ↓
Phase 4 (App.tsx Split)         ← Depends on Phase 2
  ↓
Phase 5 (Agent Consolidation)   ← Depends on Phase 1
  ↓
Phase 6 (Cleanup)               ← Final polish
```

Phases 1 and 2 can be worked on in parallel since they touch server and client code respectively. Phase 3 and 4 can also be parallelized after Phase 2 is complete.

## Verification

After each phase:
1. `npm run build` must pass
2. `npm run dev` + `npm run dev:server` must start without errors
3. Manual smoke test: navigate to `/`, unlock a mode, use basic features
4. No new TypeScript errors introduced
