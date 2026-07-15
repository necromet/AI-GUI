# Library Agent — Architecture & Flow

## Overview

The Library Agent is an AI-powered assistant that helps users create, edit, and manage React components in the edward:labs component library. It operates as a tool-calling loop: the LLM plans steps, calls tools to read/write files, and verifies results — all streamed to the user in real time via SSE.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (React)                                                 │
│                                                                  │
│  AgentSidebar ──POST /api/library-agent/chat──► Express server   │
│     │  SSE stream ◄────────────────────────────────┘             │
│     │  parses events → renders blocks (text/tool/plan/question)   │
│     │  dispatches CustomEvents to ComponentEditor for verify      │
│     ▼                                                            │
│  ComponentEditor (Monaco preview sandbox)                        │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  Express Server                                                  │
│                                                                  │
│  server/routes/libraryAgent.ts                                   │
│     │  creates agent via lib/agent/agent.ts                      │
│     │  streams agent steps → SSE events                          │
│     │  emits special events (component_created, todo_list, etc.) │
│     ▼                                                            │
│  Vercel AI SDK ToolLoopAgent                                     │
│     │  model: MiMo / DeepSeek via OpenAI-compatible provider     │
│     │  tools: 14 tools from lib/agent/tools/library.ts           │
│     │  max 10 steps per request                                  │
│     ▼                                                            │
│  server/services/libraryService.ts (SQLite CRUD)                 │
│  server/services/agentService.ts (execute_code sandbox)          │
└──────────────────────────────────────────────────────────────────┘
```

## Request Flow (Step by Step)

### 1. User sends a message

`AgentSidebar.tsx` `handleSend()`:
- Appends user message to local state
- POSTs to `/api/library-agent/chat` with:
  ```json
  {
    "messages": [{ "role": "user", "content": "..." }],
    "model": "mimo-v2.5",
    "provider": "mimo",
    "componentId": "abc123"
  }
  ```

### 2. Server builds context

`server/routes/libraryAgent.ts`:
- Loads the selected component from SQLite via `library.getComponent(componentId)`
- Builds a context string with component name, ID, category, description, tags, and file list
- Detects user language and appends a language instruction
- Constructs message array: `[system (context + lang), ...history]`

### 3. Agent loop executes

`lib/agent/agent.ts` creates a `ToolLoopAgent` (Vercel AI SDK) with:
- **Model**: OpenAI-compatible provider (MiMo or DeepSeek)
- **Instructions**: System prompt from `lib/agent/prompts/library.ts`
- **Tools**: 14 tools from `lib/agent/tools/library.ts`
- **Max steps**: 10 (`stopWhen: isStepCount(10)`)
- **Tool approval**: `delete_component_file` requires user approval

The agent runs a loop:
```
LLM thinks → calls tool(s) → gets results → thinks again → ... → final text response
```

Each step emits SSE events via the `onStepEnd` callback.

### 4. Server streams SSE events

Each step produces several event types:

| Event | Payload | When |
|-------|---------|------|
| `content` | `{ content: string }` | LLM generates text (delta) |
| `reasoning` | `{ reasoning: string }` | LLM reasoning/thinking |
| `tool_call` | `{ tool_call: { name, arguments } }` | LLM invokes a tool |
| `tool_result` | `{ tool_result: { name, input, output } }` | Tool returns a result |
| `component_created` | `{ component_created: LibraryComponent }` | After `create_component` |
| `component_updated` | `{ component_updated: LibraryComponent }` | After `write_component_file` |
| `todo_list` | `{ todo_list: AgentTask[] }` | After `create_todo_list` |
| `verify_component` | `{ verify_component: { componentId } }` | After `verify_component` |
| `ask_user` | `{ ask_user: { question } }` | After `ask_user` |
| `tool_summary` | `ToolResult[]` | End of stream (all tool results) |
| `[DONE]` | — | Stream complete |

### 5. Client renders blocks

`AgentSidebar.tsx` parses SSE events and builds a `MessageBlock[]` array per message:

```
MessageBlock = TextBlock | ToolCallBlock | AskUserBlock | AgentPlanBlock
```

- **Text blocks**: Rendered as markdown via `ReactMarkdown`
- **Tool call blocks**: Collapsible cards showing tool name, arguments, status (running → done/error), and output
- **Agent plan blocks**: Checklist UI showing tasks with status indicators
- **Ask user blocks**: Highlighted question bubbles

### 6. Side effects on the editor

When the agent writes files or triggers verification, the sidebar dispatches `CustomEvent`s:

- `agent-file-changed` → `ComponentEditor` reloads the component files in the Monaco editor
- `agent-verify-component` → `ComponentEditor` triggers a live preview render and reports errors back via `agent-verify-result`

## Tools (14 total)

### Read/Search
| Tool | Description |
|------|-------------|
| `search_library` | Natural language search over components using embeddings. Returns ranked results with scores. |
| `read_component` | Read full component by ID — all files, metadata, tags. Truncates at 12K chars. |
| `list_folders` | List all folders with names, descriptions, component counts. |
| `list_folder_contents` | List components in a specific folder. |

### Write
| Tool | Description |
|------|-------------|
| `create_component` | Create a new multi-file component. At least one file required. |
| `write_component_file` | Write/update a single file within a component. Creates file if missing. |
| `update_component` | Update metadata (name, description, tags, category). |
| `delete_component_file` | Delete a single file. Requires user approval. |

### Organize
| Tool | Description |
|------|-------------|
| `create_folder` | Create a new folder with name, description, color. |
| `move_to_folder` | Move a component into/out of a folder. |

### Utility
| Tool | Description |
|------|-------------|
| `execute_code` | Run JavaScript in a sandboxed VM. For calculations, data transforms, etc. |
| `ask_user` | Ask the user a clarifying question. Pauses the agent loop. |
| `verify_component` | Trigger a live render in the preview sandbox. Max 3 attempts. |
| `create_todo_list` | Create a structured task plan displayed as a checklist in the UI. |

## Tool Execution Model

Tools are defined in two places (both must stay in sync):

1. **`lib/agent/tools/library.ts`** — Vercel AI SDK `tool()` definitions with Zod schemas and `execute` functions. These are the ones the agent actually calls.

2. **`server/services/libraryAgentTools.ts`** — Older `ToolDefinition[]` format used by the MiMo-based agent in `server/routes/library.ts` (a separate, non-Vercel-SDK agent path for the library chat route).

The Vercel AI SDK tools (`lib/agent/tools/library.ts`) import `libraryService` functions directly — they run in the same Node.js process as the Express server. There is no separate microservice.

## Provider Configuration

`lib/agent/provider.ts` creates an OpenAI-compatible provider:

| Provider string | API Key env | Base URL env |
|----------------|-------------|--------------|
| `mimo` (default) | `MIMO_API_KEY` | `MIMO_BASE_URL` |
| `mimo-direct` | `MIMO_DIRECT_API_KEY` | `MIMO_DIRECT_BASE_URL` |
| `deepseek` | `DEEPSEEK_API_KEY` | `DEEPSEEK_BASE_URL` |

## Session Persistence

Agent conversations are stored in SQLite (`library_agent_sessions` table):
- Each component can have up to 3 sessions
- Messages are stored as JSON blobs
- Sessions are loaded/created when a component is selected in the sidebar
- Messages are saved to the server after each streaming response completes

## System Prompt Constraints

The agent prompt (`lib/agent/prompts/library.ts`) enforces:

- **Pure code only** — no markdown, no XML, no prose in file content
- **Complete files** — no diffs, always write the entire file
- **No type/interface declarations** — use inline type annotations (sandbox limitation)
- **Workflow order**: Read → Analyze → Plan (todo list) → Execute → Verify → Report
- **Sandbox limitations**: No shadcn/Radix, no CSS modules, no Node.js APIs. Works with React 19, Tailwind, framer-motion, @phosphor-icons/react.

## Key Files

| File | Role |
|------|------|
| `components/library/AgentSidebar.tsx` | UI — chat sidebar, SSE parsing, block rendering, session management |
| `lib/agent/agent.ts` | Creates the Vercel AI SDK `ToolLoopAgent` |
| `lib/agent/tools/library.ts` | Tool definitions with Zod schemas and execute functions |
| `lib/agent/provider.ts` | OpenAI-compatible provider factory |
| `lib/agent/prompts/library.ts` | System prompt with sandbox rules and workflow |
| `server/routes/libraryAgent.ts` | Express route — builds context, creates agent, streams SSE |
| `server/services/libraryService.ts` | SQLite CRUD for components, files, folders |
| `server/services/agentService.ts` | `toolExecuteCode` sandbox (used by `execute_code` tool) |
