# How Kilo Code Works With the User Interface

A deep dive into how the Kilo Code coding agent presents itself to users across VS Code, JetBrains, the CLI, and the web — from keystroke to rendered output.

---

## Table of Contents

1. [UI Architecture Overview](#1-ui-architecture-overview)
2. [The Communication Pipeline](#2-the-communication-pipeline)
3. [TUI (Terminal UI)](#3-tui-terminal-ui)
4. [VS Code Extension](#4-vs-code-extension)
5. [JetBrains Plugin](#5-jetbrains-plugin)
6. [Shared UI Components](#6-shared-ui-components)
7. [Message Rendering Pipeline](#7-message-rendering-pipeline)
8. [Real-time Streaming](#8-real-time-streaming)
9. [Tool Call Visualization](#9-tool-call-visualization)
10. [Permission & Question UI](#10-permission--question-ui)
11. [Diff & Code Review UI](#11-diff--code-review-ui)
12. [Agent Manager (Multi-Session)](#12-agent-manager-multi-session)
13. [Data Flow: User Types to Rendered Response](#13-data-flow-user-types-to-rendered-response)

---

## 1. UI Architecture Overview

Every Kilo Code frontend is a **client** of the same backend: a `kilo serve` process running the core engine. The UI never talks directly to an LLM — all communication goes through the server via HTTP + SSE.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                 │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────┐  ┌──────────┐  │
│  │  VS Code    │  │  JetBrains   │  │ CLI TUI │  │   Web    │  │
│  │  Extension  │  │  Plugin      │  │         │  │  Cloud   │  │
│  └──────┬──────┘  └──────┬───────┘  └────┬────┘  └────┬─────┘  │
│         │                │               │            │         │
│         └────────────────┼───────────────┼────────────┘         │
│                          │               │                      │
│                  @kilocode/sdk (HTTP + SSE)                      │
│                          │               │                      │
│              ┌───────────▼───────────────▼──────────┐           │
│              │        kilo serve (Hono)              │           │
│              │                                       │           │
│              │  ┌──────────┐  ┌──────────────────┐  │           │
│              │  │ Sessions │  │  Processor Loop  │  │           │
│              │  └──────────┘  └──────────────────┘  │           │
│              └───────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

**Key principle:** The UI is a thin rendering layer. All AI logic, tool execution, permission checking, and session management lives in the server. The UI receives events and renders them.

---

## 2. The Communication Pipeline

### Server-Sent Events (SSE)

The primary real-time channel. The server exposes `GET /global/event` which streams typed events to the client.

**Server side** (`packages/opencode/src/server/routes/instance/httpapi/handlers/event.ts`):
```
1. Subscribe to in-process Bus (pub/sub)
2. Send initial server.connected event
3. Merge Bus events with 10-second heartbeat
4. Encode as SSE (data: JSON\n\n)
5. Stream terminates on InstanceDisposed
```

**Client side** (via `@kilocode/sdk`):
```
1. SDK creates SSE client via fetch() + ReadableStream
2. TextDecoderStream parses SSE protocol
3. JSON-parsed events yielded via async generator
4. Client event handler dispatches to SolidJS store
5. Fine-grained reactivity updates only affected components
```

### Event Types

| Category | Events | Purpose |
|---|---|---|
| **Sync** | `session.created/updated/deleted.1`, `message.updated/removed.1`, `message.part.updated/removed.1` | State synchronization |
| **Streaming v2** | `session.next.text.started/delta/ended.1`, `session.next.tool.input.started/delta/ended.1`, `session.next.tool.called/progress/success/failed.1`, `session.next.reasoning.started/delta/ended.1` | Real-time token streaming |
| **Application** | `permission.asked/replied`, `question.asked/replied/rejected`, `todo.updated`, `session.diff`, `session.status`, `background_process.*`, `interactive_terminal.*`, `lsp.updated`, `vcs.branch.updated` | Feature-specific lifecycle |

### HTTP API

Used for request/response operations: session CRUD, message sending, config reads, provider listing. All typed via auto-generated SDK from OpenAPI spec.

---

## 3. TUI (Terminal UI)

The CLI's terminal interface is built with **SolidJS + OpenTUI** (`@opentui/solid`), which renders JSX elements directly to the terminal.

### Entry & Routing

**File:** `packages/opencode/src/cli/cmd/tui/app.tsx`

The `tui()` function creates a `CliRenderer` and mounts a SolidJS component tree with deep provider nesting:

```
ErrorBoundary → KeymapProvider → ArgsProvider → ExitProvider → KVProvider →
ToastProvider → RouteProvider → ConfigProvider → SDKProvider → ProjectProvider →
SyncProvider → SyncProviderV2 → ThemeProvider → LocalProvider →
PromptStashProvider → DialogProvider → NudgeProvider → FrecencyProvider →
PromptHistoryProvider → PromptRefProvider → EditorContextProvider → App
```

**Routing** (`context/route.tsx`): A store holds `{ type: "home" | "session" | "plugin" | "kiloclaw" }`. The `<Switch>` in `app.tsx` renders `<Home />`, `<Session />`, or plugin views.

### SDK Connection

**File:** `packages/opencode/src/cli/cmd/tui/context/sdk.tsx`

```typescript
// Create SDK client pointed at server URL
const client = createKiloClient({ baseUrl: serverUrl })

// SSE event streaming
const events = await sdk.global.event()
for await (const event of events.stream) {
  // Batch events (16ms debounce)
  // Emit through GlobalEmitter to sync store
}
```

Reconnection with exponential backoff (1s base, 30s max).

### Data Sync Store

**File:** `packages/opencode/src/cli/cmd/tui/context/sync.tsx`

A massive SolidJS store holds all application state:
- Sessions, messages, parts
- Permissions, questions, suggestions
- Providers, agents, config
- Todos, diffs, MCP status, LSP status
- Background processes, interactive terminals

**Sync v2** (`context/sync-v2.tsx`) handles fine-grained streaming events:
- `session.next.text.delta.1` → appends to current text part
- `session.next.tool.input.delta.1` → streams tool input
- `session.next.tool.called/progress/success/failed.1` → tool lifecycle
- `session.next.reasoning.delta.1` → thinking token streaming

### Chat UI Rendering

**File:** `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`

The Session component renders the main chat view:

```
<scrollbox stickyScroll stickyStart="bottom">
  <For each={messages()}>
    <Switch>
      <Match when={role === "user"}>      → <UserMessage />
      <Match when={role === "assistant"}>  → <AssistantMessage />
    </Switch>
  </For>
</scrollbox>
```

**Message part mapping** (lines 1720-1726):

| Part Type | Component |
|---|---|
| `text` | `TextPart` — renders `<markdown>` with syntax highlighting |
| `tool` | `ToolPart` — dispatches to tool-specific renderer |
| `reasoning` | `ReasoningPart` — collapsible thinking block |
| `step-finish` | `StepFinishPart` — step metadata |

**Tool part rendering** (lines 1889-1998): A `<Switch>` dispatches by tool name:

| Tool | Renderer |
|---|---|
| `shell` | `<Shell>` — BlockTool with `$` command + colored output |
| `read` | `<Read>` — InlineTool with file path |
| `edit` | `<Edit>` — BlockTool with `<diff>` split/unified view |
| `apply_patch` | `<ApplyPatch>` — multi-file diff blocks |
| `write` | `<Write>` — BlockTool with `<code>` + diagnostics |
| `task` | `<Task>` — InlineTool linking to child session |
| `glob`/`grep` | `<Glob>`/`<Grep>` — InlineTool with match counts |
| `question` | `<Question>` — BlockTool with Q&A |
| generic | `<GenericTool>` — InlineTool or BlockTool |

**InlineTool** (lines 2046-2218): Compact single-line display with icon, name, status indicator, and error handling. Used for quick tools like `read`, `glob`, `grep`.

**BlockTool** (lines 2220-2269): Expanded multi-line display with title bar and content area. Used for tools with rich output like `edit`, `shell`, `write`.

---

## 4. VS Code Extension

### Extension Entry Point

**File:** `packages/kilo-vscode/src/extension.ts`

```
activate()
  → Create KiloConnectionService (shared by all webviews)
  → Register SidebarProvider (kilo-code.SidebarProvider)
  → Register AgentManagerProvider (editor panel)
  → Register DiffViewerProvider (inline diffs)
  → Register commands (Open in Tab, Agent Manager, etc.)
```

Each `KiloProvider` instance (sidebar, tabs) shares the same `KiloConnectionService`, which lazily starts and reuses one `kilo serve` backend.

### Server Spawning

**File:** `packages/kilo-vscode/src/services/cli-backend/connection-service.ts`

```
KiloConnectionService
  → owns ServerManager (spawns bin/kilo serve --port 0)
  → captures dynamic port from stdout
  → generates random password (KILO_SERVER_PASSWORD)
  → creates SDK KiloClient
  → creates SdkSSEAdapter for event streaming
```

The server runs as a **child process** of the VS Code extension host. Multiple webviews share one server.

### Extension ↔ Webview Communication

Communication is bidirectional via `vscode.Webview.postMessage()`:

**Extension → Webview:**
```
KiloProvider.postMessage({
  type: "connectionState" | "ready" | "sessionLoaded" | "sessionsLoaded" |
        "partsUpdated" | "partRemoved" | "sessionCreated" | "profileData" |
        "permissionAsked" | "questionAsked" | ...
  data: { ... }
})
```

**Webview → Extension:**
```
vscode.postMessage({
  type: "webviewReady" | "sendMessage" | "abort" | "loadMessages" |
        "createSession" | "permissionResponse" | "requestProviders" |
        "connectProvider" | "requestAgents" | "requestConfig" | ...
  data: { ... }
})
```

**SSE → Webview pipeline:**
```
CLI backend SSE event
  → KiloConnectionService receives
  → Dispatches to KiloProvider instances via listener callbacks
  → mapSSEEventToWebviewMessage() converts to webview message
  → SessionStreamScheduler batches at ~16ms intervals
  → postMessage() to webview
```

### Sidebar Chat UI

**File:** `packages/kilo-vscode/webview-ui/src/App.tsx`

Provider hierarchy:
```
ThemeProvider → DialogProvider → VSCodeProvider → ServerProvider →
LanguageBridge → MarkedProvider → DiffComponentProvider →
CodeComponentProvider → FileComponentProvider → ProviderProvider →
ConfigProvider → DisplayProvider → WorkStyleProvider → IndexingProvider →
EmbeddingModelsProvider → NotificationsProvider → SessionProvider →
AgentRequirementsProvider → FeedbackProvider → DataBridge → AppContent
```

**AppContent** renders views based on `currentView` signal:
- `ChatView` — main chat interface
- `HistoryView` — session history
- `ProfileView` — user profile
- `Settings` — configuration
- `MigrationWizard` — migration flow

**DataBridge** (lines 63-205) bridges session store to `DataProvider` expected by kilo-ui. Uses reactive getters (not memos wrapping whole shape) for per-key reactivity — critical for streaming performance.

### Message Flow in VS Code

```
1. User types in ChatView textarea
2. Webview sends postMessage({ type: "sendMessage", data: { text, files, agent } })
3. Extension receives, calls sdk.session.prompt({ sessionID, parts })
4. Server processes, streams SSE events back
5. KiloConnectionService receives events
6. mapSSEEventToWebviewMessage() converts to webview messages
7. SessionStreamScheduler batches part updates (~16ms)
8. postMessage() to webview with batched updates
9. SessionProvider updates store
10. DataBridge exposes reactive getters
11. DataProvider propagates to kilo-ui components
12. MessagePart component re-renders only affected parts
```

---

## 5. JetBrains Plugin

Built as a standard IntelliJ plugin with Kotlin. Uses split-mode architecture (UI in IDE process, backend in separate process). See `packages/kilo-jetbrains/AGENTS.md` for detailed architecture.

Key differences from VS Code:
- Uses IntelliJ's built-in diff viewer instead of custom webview
- Terminal integration via IntelliJ's terminal API
- Session management through IntelliJ's tool window system

---

## 6. Shared UI Components

### `packages/kilo-ui/` — SolidJS Component Library

40+ components shared between VS Code webview and other clients:

**Core rendering:**
- `message-part.tsx` (2860 lines) — The central message rendering component. Handles all part types with 20+ tool-specific renderers.
- `markdown.tsx` — Markdown with syntax highlighting, Mermaid diagrams, code blocks
- `basic-tool.tsx` — Generic tool rendering (accordion with icon, title, content)

**Layout:**
- `accordion.tsx`, `card.tsx`, `collapsible.tsx`, `dialog.tsx`, `sheet.tsx`

**Feedback:**
- `spinner.tsx`, `toast.tsx`, `tooltip.tsx`, `progress.tsx`

**Form controls:**
- `button.tsx`, `checkbox.tsx`, `select.tsx`, `dropdown-menu.tsx`, `input.tsx`, `textarea.tsx`

**Icons:**
- `icon.tsx` — 75+ custom SVG icons

### `packages/ui/` — Upstream OpenCode UI Primitives

- Pierre diff rendering engine (worker-based, virtualized)
- Markdown rendering with shiki syntax highlighting
- i18n support (16 languages)
- `DataProvider` context for bridging session data to components

### Theme System

Two themes:
- `kilo` — web/desktop with light+dark variants
- `kilo-vscode` — adapts to VS Code's active theme via CSS variables

---

## 7. Message Rendering Pipeline

```
Message (role=user | assistant)
  └─ Parts[] (from sync store)
      ├─ TextPart
      │   └─ <Markdown> with syntax highlighting, streaming support
      │
      ├─ ToolPart
      │   └─ Dispatch by tool name:
      │       ├─ "shell"      → BlockTool: command + colored output
      │       ├─ "read"       → InlineTool: file path + preview
      │       ├─ "edit"       → BlockTool: unified/split diff view
      │       ├─ "apply_patch" → BlockTool: multi-file diff blocks
      │       ├─ "write"      → BlockTool: code content + diagnostics
      │       ├─ "glob"       → InlineTool: pattern + match count
      │       ├─ "grep"       → InlineTool: regex + results
      │       ├─ "task"       → InlineTool: link to child session
      │       ├─ "question"   → BlockTool: question + answer
      │       ├─ "webfetch"   → BlockTool: URL + content preview
      │       ├─ "skill"      → InlineTool: skill name + description
      │       └─ generic      → InlineTool or BlockTool fallback
      │
      ├─ ReasoningPart
      │   └─ Collapsible "thinking" block with streaming text
      │
      └─ StepFinishPart
          └─ Step metadata (cost, tokens, model info)
```

### Tool Status Lifecycle

Each tool part goes through:

```
pending → running → completed | failed
```

Visual indicators:
- **pending**: Gray icon, "Waiting..."
- **running**: Animated spinner, progress text (if available)
- **completed**: Green checkmark, output preview
- **failed**: Red X, error message

---

## 8. Real-time Streaming

### How Tokens Appear in the UI

```
Token arrives at server processor
  → Bus.publish("session.next.text.delta.1", { sessionID, delta: "hello" })
  → SSE event stream (data: {"type":"session.next.text.delta.1","properties":{...}}\n\n)
  → SDK async generator yield
  → Client event handler
  → SolidJS store mutation:
      produce(draft => { draft.part[msgID][idx].text += "hello" })
  → Fine-grained reactivity: only TextPart reading that specific part re-renders
  → <markdown streaming={true}> parses incrementally
```

### Batching

To avoid overwhelming the UI with per-token updates, events are batched:
- **TUI**: 16ms debounce in sync store
- **VS Code**: `SessionStreamScheduler` batches at ~16ms intervals before `postMessage()`

### Auto-scroll

Both TUI and VS Code use auto-scroll:
- `auto-scroll.ts` / `create-auto-scroll.tsx` — Scrolls to bottom during streaming
- `scroll-user-activity.ts` — Detects user scroll intent, pauses auto-scroll until user scrolls back to bottom

---

## 9. Tool Call Visualization

### Inline Tools (compact)

Tools with minimal output (read, glob, grep, skill) render as a single line:

```
📖 read  src/app.tsx                    ✓ 0.2s
🔍 grep  "useState" in src/**/*.tsx     ✓ 15 matches
```

Components: icon, tool name, primary argument, status indicator, execution time.

### Block Tools (expanded)

Tools with rich output (shell, edit, write, apply_patch) render as expandable blocks:

```
┌─ shell ────────────────────────────── ✓ 2.3s ─┐
│ $ npm test                                      │
│                                                  │
│ PASS  src/app.test.ts                           │
│ PASS  src/utils.test.ts                         │
│                                                  │
│ Tests: 2 passed, 2 total                        │
└─────────────────────────────────────────────────┘
```

### Edit Tool (Diff View)

The `edit` tool renders a unified or split diff:

```
┌─ edit  src/app.tsx ─────────────────── ✓ 0.1s ─┐
│  12   │  12  │ const App = () => {              │
│  13   │      │ - const [count, setCount] = useState(0)
│       │  13  │ + const [count, setCount] = useState(1)
│  14   │  14  │                                  │
└─────────────────────────────────────────────────┘
```

Uses Pierre diff engine (worker-based, syntax-highlighted, virtualized for large diffs).

### Task Tool (Subagent)

The `task` tool shows a link to the child session:

```
🔗 task → explore: "Find all auth-related files"   ✓ 4.2s
```

Clicking navigates to the child session's conversation.

---

## 10. Permission & Question UI

### Permission Prompts

When a tool requires user confirmation (action: "ask"):

```
┌─ Permission Required ────────────────────────────┐
│                                                   │
│  The agent wants to run:                          │
│  $ rm -rf node_modules                            │
│                                                   │
│  [ Allow ]  [ Deny ]  [ Allow for session ]       │
│                                                   │
└───────────────────────────────────────────────────┘
```

- **TUI**: Renders as a dialog overlay using `<DialogProvider>`
- **VS Code**: Renders as a webview dialog or notification

### Question Tool

When the agent asks a clarifying question:

```
┌─ Question ───────────────────────────────────────┐
│                                                   │
│  Which database should I use?                     │
│                                                   │
│  ○ PostgreSQL                                     │
│  ○ MySQL                                          │
│  ○ SQLite                                         │
│                                                   │
│  [ Type your answer... ]  [ Submit ]              │
│                                                   │
└───────────────────────────────────────────────────┘
```

The agent loop pauses until the user responds.

---

## 11. Diff & Code Review UI

### Session-Level Diffs

After each agent step, a git snapshot diff is computed. Users can view:

- **Turn diff**: What changed in the current step
- **Session diff**: All changes across the entire conversation
- **Workspace diff**: All uncommitted changes

### Inline Diff Viewer (VS Code)

**File:** `packages/kilo-vscode/src/diff/DiffViewerProvider.ts`

Creates a webview panel that shows diffs inline in the editor area. Uses Pierre diff engine with:
- Worker-based syntax highlighting
- Virtual scrolling for large diffs
- Line selection and commenting
- Comment hover interactions

### Suggest Tool

The `suggest` tool offers code review suggestions:

```
┌─ suggest ────────────────────────────────────────┐
│                                                   │
│  Consider adding error handling:                  │
│                                                   │
│  ```diff                                          │
│  - const data = await fetch(url)                  │
│  + const data = await fetch(url).catch(handleErr) │
│  ```                                              │
│                                                   │
│  [ Apply ]  [ Dismiss ]                           │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## 12. Agent Manager (Multi-Session)

**File:** `packages/kilo-vscode/webview-ui/agent-manager/`

The Agent Manager is a VS Code editor panel for orchestrating multiple agent sessions with git worktree isolation.

### Features

- **Multi-tab sessions**: Each tab is an independent agent session
- **Git worktree isolation**: Each session runs in its own worktree (branch + directory)
- **Drag-and-drop**: Reorder tabs via `@thisbeyond/solid-dnd`
- **Split layout**: Chat + diff panel side by side
- **Terminal integration**: Per-session terminal
- **Parallel execution**: Multiple agents working on different versions simultaneously

### How It Works

```
Agent Manager UI
  → Creates worktree: git worktree add ../worktree-xyz -b feature-xyz
  → Passes worktree path as `directory` to shared KiloConnectionService
  → Server scopes all operations to that directory
  → Each session has its own message history, agent, model
  → Diffs shown inline between worktree and main branch
```

### Provider Hierarchy

Same as sidebar + `WorktreeModeProvider` for worktree-specific behavior.

---

## 13. Data Flow: User Types to Rendered Response

### Complete End-to-End Flow

```
1. USER TYPES "Add error handling to the API client"
   └─ TUI: <Prompt> component captures input
   └─ VS Code: ChatView textarea → postMessage("sendMessage")

2. CLIENT SENDS REQUEST
   └─ SDK: session.prompt({ sessionID, parts: [{ type: "text", text: "..." }] })
   └─ HTTP POST to kilo serve

3. SERVER PROCESSES
   └─ Creates user message in session
   └─ Spawns Session Processor
   └─ Captures git snapshot (pre-step state)

4. PROCESSOR BUILDS PROMPT
   └─ System prompt: model-specific + agent + environment + skills
   └─ Conversation history: all previous messages
   └─ Tool definitions: filtered by agent permissions

5. LLM STREAMS RESPONSE
   └─ Vercel AI SDK → streamText(messages, tools)
   └─ Events flow back through processor

6. SERVER PUBLISHES EVENTS (via Bus → SSE)
   └─ session.next.step.started.1
   └─ session.next.text.started.1
   └─ session.next.text.delta.1 (repeated for each token)
   └─ session.next.tool.input.started.1 (when tool call begins)
   └─ session.next.tool.input.delta.1 (streaming tool arguments)
   └─ session.next.tool.called.1 (tool call complete)
   └─ session.next.tool.progress.1 (tool executing)
   └─ session.next.tool.success.1 (tool done)
   └─ session.next.text.delta.1 (more text after tool result)
   └─ ... (loop continues for multi-step)
   └─ session.next.step.ended.1

7. CLIENT RECEIVES EVENTS
   └─ SDK async generator yields parsed events
   └─ Event handler dispatches to SolidJS store

8. STORE UPDATES (fine-grained reactivity)
   └─ produce(draft => {
       draft.part[messageID][idx].text += "I'll add"
       draft.part[messageID][idx].status = "running"
     })

9. UI RE-RENDERS (only affected components)
   └─ TextPart: <markdown streaming={true}> parses "I'll add error handling..."
   └─ ToolPart: shows spinner → renders tool card → shows result
   └─ Auto-scroll moves to bottom

10. USER SEES
    └─ Text appearing word by word
    └─ Tool cards with live progress
    └─ Diffs rendered inline
    └─ Permission prompts when needed
    └─ Final summary with session diff
```

---

## Key Source Files

```
packages/opencode/src/cli/cmd/tui/
├── app.tsx                    # Main TUI app, provider tree, routing
├── context/
│   ├── sdk.tsx                # SDK connection + SSE streaming
│   ├── sync.tsx               # State sync store (all events)
│   ├── sync-v2.tsx            # Fine-grained streaming events
│   └── route.tsx              # Routing
└── routes/session/
    └── index.tsx              # Chat UI: messages, tools, diffs

packages/kilo-vscode/
├── src/
│   ├── extension.ts           # Extension entry point
│   ├── KiloProvider.ts        # Backend connection manager
│   └── services/
│       └── cli-backend/
│           └── connection-service.ts  # Server spawning + SDK
└── webview-ui/
    ├── src/
    │   ├── App.tsx            # Webview entry, provider tree
    │   └── context/
    │       ├── vscode.tsx     # postMessage bridge
    │       ├── server.tsx     # Connection state
    │       └── session.tsx    # Session state management
    └── agent-manager/
        └── AgentManagerApp.tsx # Multi-session orchestration

packages/kilo-ui/src/
├── components/
│   └── message-part.tsx       # Core message rendering (2860 lines)
├── context/
│   ├── data.tsx               # DataProvider bridge
│   ├── marked.tsx             # Markdown config
│   └── i18n.tsx               # Internationalization
└── theme/
    └── context.tsx            # Theme provider

packages/ui/src/
└── pierre/                    # Diff rendering engine
    ├── virtualizer.ts         # Virtual scrolling
    └── worker.ts              # Syntax highlighting worker
```
