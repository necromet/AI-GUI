# How Kilo Code Coding Agent Works

## Overview

Kilo Code is an open-source AI coding agent that generates code from natural language, automates development tasks, and supports 500+ AI models. It runs as a VS Code extension, JetBrains plugin, or CLI tool. The architecture is a monorepo (Turborepo + Bun workspaces) with a single core engine (`packages/opencode/`) and multiple client frontends.

```
┌───────────────────────────────────────────────────────────────┐
│                        Clients                                │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌───────────┐  │
│  │ VS Code  │  │ JetBrains │  │  CLI (TUI) │  │  Web/Cloud│  │
│  └────┬─────┘  └─────┬─────┘  └─────┬──────┘  └─────┬─────┘  │
│       └──────────────┼──────────────┼────────────────┘        │
│                      │              │                          │
│              HTTP + SSE (via @kilocode/sdk)                    │
│                      │              │                          │
│       ┌──────────────▼──────────────▼──────────┐              │
│       │         Hono HTTP Server                │              │
│       │         (kilo serve)                    │              │
│       └──────────────┬─────────────────────────┘              │
│                      │                                        │
│       ┌──────────────▼─────────────────────────┐              │
│       │       Core Engine (Effect-TS)           │              │
│       │  ┌─────────┐ ┌──────────┐ ┌──────────┐ │              │
│       │  │ Agents  │ │ Sessions │ │  Tools   │ │              │
│       │  └────┬────┘ └────┬─────┘ └────┬─────┘ │              │
│       │       └───────────┼────────────┘        │              │
│       │            ┌──────▼──────┐              │              │
│       │            │  Processor  │              │              │
│       │            │ (Agent Loop)│              │              │
│       │            └──────┬──────┘              │              │
│       │            ┌──────▼──────┐              │              │
│       │            │  LLM Layer  │              │              │
│       │            │ (AI SDK)    │              │              │
│       │            └─────────────┘              │              │
│       └─────────────────────────────────────────┘              │
└───────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Agent System

Agents are **mode configurations** — not separate AI models. They overlay prompt, permissions, tool access, and model settings on top of the same LLM runtime.

| Built-in Agent | Purpose |
|---|---|
| **Code** | Default. Implements and edits code from natural language. |
| **Plan** | Designs architecture and writes implementation plans before coding. |
| **Ask** | Answers questions about the codebase without modifying files. |
| **Debug** | Troubleshoots and traces issues. |
| **Review** | Reviews changes for performance, security, style, and test coverage. |
| **Explore** | Fast read-only codebase exploration (subagent). |
| **Orchestrator** | Delegates tasks to subagents in parallel. |

**Agent data structure** (`packages/opencode/src/agent/agent.ts`):

```typescript
{
  name: string                    // "code", "plan", "explore", etc.
  description: string             // What this agent does
  mode: "primary" | "subagent" | "all"
  permission: Permission.Ruleset  // Array of {permission, pattern, action} rules
  prompt?: string                 // Custom system prompt
  model?: { providerID, modelID } // Model override
  temperature?: number
  steps?: number                  // Max steps override
  hidden?: boolean
  native?: boolean                // Built-in vs user-defined
}
```

Users can define custom agents in `kilo.json` under the `agent` key. The agent registry merges built-in and user-defined agents, with user configs taking priority.

**Key file:** `packages/opencode/src/agent/agent.ts`

---

### 2. Session & Conversation Management

Sessions represent conversations. Each session has an ID, title, associated agent, model selection, message history, cost tracking, and a project directory link.

Messages are composed of typed **Part** objects:

| Part Type | Description |
|---|---|
| `text` | User or assistant text content |
| `tool` | Tool call with input, output, and status |
| `reasoning` | LLM thinking/reasoning tokens |
| `step-start` / `step-finish` | Step boundaries in multi-step runs |
| `patch` | Git diff of files changed in a step |
| `compaction` | Summarized older messages |

Sessions are persisted in **SQLite** via Drizzle ORM (`packages/opencode/src/session/session.sql.ts`). Sessions can be forked to create child sessions for subagent delegation.

**Key file:** `packages/opencode/src/session/session.ts`

---

### 3. Processor — The Agent Loop

The processor (`packages/opencode/src/session/processor.ts`) is the **heart of the agent**. It orchestrates the conversation loop:

```
1. Capture git snapshot (pre-step state)
2. Build messages array:
   a. System prompt (model-specific + agent-specific + environment + skills)
   b. Conversation history (all previous messages)
   c. Tool definitions (filtered by agent permissions)
3. Call LLM.stream(messages, tools)
4. For each event in stream:
   - text-delta       → append to assistant message, stream to UI
   - reasoning-delta  → track thinking tokens
   - tool-call        → check permissions, execute tool, get result
   - tool-result      → feed back to LLM
   - step-finish      → compute cost, check context overflow
5. If context overflow → trigger compaction, retry
6. If blocked (permission denied) → stop
7. If more tool calls → goto 4
8. If more steps needed → goto 2
9. Finalize: compute diff patch, update session summary
```

**Doom-loop detection:** If the same tool call is repeated 3 times with identical arguments (`DOOM_LOOP_THRESHOLD = 3`), the processor halts to prevent infinite loops.

**Key file:** `packages/opencode/src/session/processor.ts`

---

### 4. LLM Integration Layer

The LLM layer abstracts provider connections using the **Vercel AI SDK**. It supports 500+ models from providers including OpenAI, Anthropic, Google, Mistral, xAI, Groq, Cerebras, and more.

**System prompt assembly** (`packages/opencode/src/session/system.ts`):

```
System prompt = provider-specific prompt (anthropic.txt, gpt.txt, gemini.txt, etc.)
              + environment context (git info, file tree, platform, OS)
              + available skills descriptions
              + agent-specific prompt (from agent.prompt field)
```

Different model families get different system prompt templates from `packages/opencode/src/session/prompt/`. The LLM layer uses streaming — events flow back to the processor in real time.

**Key files:**
- `packages/opencode/src/session/llm.ts` — Main LLM service
- `packages/opencode/src/session/llm/ai-sdk.ts` — AI SDK adapter
- `packages/opencode/src/session/llm/request.ts` — Request preparation

---

### 5. Tool System

Tools are the agent's capabilities. Each tool has a JSON Schema for parameters, a description for the LLM, and an `execute` function.

**Tool definition pattern** (`packages/opencode/src/tool/tool.ts`):

```typescript
import { Tool } from "./tool"
import { Schema } from "effect"

export const MyTool = Tool.define("my_tool", {
  description: "Description for the LLM",
  parameters: Schema.Struct({
    input: Schema.String,
  }),
  execute: async (args, ctx) => {
    // Implementation
    return {
      title: "My Tool",
      metadata: {},
      output: "Result string",
    }
  },
})
```

**Available built-in tools:**

| Tool | File | What It Does |
|---|---|---|
| `read` | `src/tool/read.ts` | Read files from disk |
| `write` | `src/tool/write.ts` | Create/overwrite files |
| `edit` | `src/tool/edit.ts` | Surgical string replacement in files |
| `apply_patch` | `src/tool/apply_patch.ts` | Apply unified diff patches |
| `shell` | `src/tool/shell.ts` | Execute shell commands |
| `glob` | `src/tool/glob.ts` | Find files by pattern |
| `grep` | `src/tool/grep.ts` | Search file contents by regex |
| `webfetch` | `src/tool/webfetch.ts` | Fetch URL content |
| `websearch` | `src/tool/websearch.ts` | Search the web |
| `task` | `src/tool/task.ts` | Spawn a subagent |
| `suggest` | `src/tool/suggest.ts` | Offer code review suggestions |
| `question` | `src/tool/question.ts` | Ask the user a question |
| `plan` | `src/tool/plan.ts` | Enter/exit planning mode |
| `recall` | `src/tool/recall.ts` | Access memory/context |
| `skill` | `src/tool/skill.ts` | Load specialized skill instructions |
| `todo` | `src/tool/todo.ts` | Todo list management |
| `diagnostics` | `src/tool/diagnostics.ts` | LSP diagnostics |
| `lsp` | `src/tool/lsp.ts` | Language Server Protocol operations |

Tool output is auto-truncated to fit the context window (`packages/opencode/src/tool/truncate.ts`). The tool registry resolves which tools are available for a given agent and model combination.

---

### 6. Permission System

Every tool invocation is gated through a permission ruleset. Actions are:

| Action | Behavior |
|---|---|
| `allow` | Execute without prompting |
| `deny` | Block execution |
| `ask` | Prompt the user for confirmation |

Rules support **glob patterns** for fine-grained control over file paths and tool names:

```typescript
[
  { permission: "*", action: "allow" },
  { permission: "edit", pattern: "*.env", action: "ask" },
  { permission: "bash", action: "allow" },
  { permission: "external_directory", pattern: "*", action: "ask" },
]
```

Each agent merges its own permission rules with base defaults. Subagents get isolated, more restrictive permissions.

**Key file:** `packages/opencode/src/permission/index.ts`

---

### 7. Snapshot & Diff Tracking

Before and after each LLM step, the system captures git snapshots to track exactly what files changed. This enables:

- **Session-level diffs** — see all changes made in a conversation
- **Revert operations** — roll back specific changes
- **Patch parts** — diffs stored as message parts in the conversation history

**Key file:** `packages/opencode/src/snapshot/index.ts`

---

### 8. Context Management & Compaction

When the conversation exceeds the model's context window:

1. Overflow is detected via token counting (`packages/opencode/src/session/overflow.ts`)
2. Older messages are summarized by a dedicated compaction agent (`packages/opencode/src/agent/prompt/compaction.txt`)
3. The summary replaces the old messages
4. The LLM call is retried with the compacted context

**Key file:** `packages/opencode/src/session/compaction.ts`

---

### 9. Subagent Delegation (Task Tool)

The `task` tool spawns child agents that run in parallel with scoped permissions:

1. Parent agent calls `task` with a prompt and agent type
2. A new child session is forked from the parent
3. The child agent runs its own processor loop with restricted permissions
4. When the child finishes, its result is returned as tool output to the parent

This enables parallel work — the orchestrator agent can delegate independent subtasks to multiple explore/code agents simultaneously.

**Key file:** `packages/opencode/src/tool/task.ts`

---

### 10. MCP (Model Context Protocol)

External MCP servers can provide additional tools to the agent. Configured in `kilo.json` under the `mcp` key. MCP tools are discovered at runtime and merged with built-in tools.

**Key file:** `packages/opencode/src/mcp/index.ts`

---

### 11. Skills & Plugins

**Skills** are specialized instruction sets loaded on demand via the `skill` tool. They're defined as `SKILL.md` files in `.kilo/skills/<name>/` or `.opencode/skills/<name>/`.

**Plugins** extend the system via hooks in `packages/opencode/src/plugin/index.ts`.

---

### 12. Provider & Model System

Uses the Vercel AI SDK as the abstraction layer. Providers are loaded dynamically. Models come from an external catalog (models.dev), cached locally. Users can switch models mid-task.

**Key file:** `packages/opencode/src/provider/provider.ts`

---

## Data Flow: End-to-End

### Sending a Message

```
User types message in UI
  → Client sends POST /session/:id/message via SDK
  → Server creates User message in session
  → Server spawns Session Processor
  → Processor captures git snapshot
  → Processor assembles prompt:
      1. System prompt (model-specific + agent-specific + environment + skills)
      2. Conversation history (all previous messages)
      3. Tool definitions (filtered by agent permissions)
  → Processor calls LLM.stream(prompt, tools)
  → LLM streams events back via SSE
  → For each tool call:
      a. Check permission (allow/deny/ask)
      b. If "ask" → prompt user via UI
      c. Execute tool
      d. Feed result back to LLM
  → When LLM stops:
      a. Compute diff patch (snapshot)
      b. Update session cost/tokens
      c. Trigger auto-summarization if needed
  → Stream final state to client via SSE
```

### Tool Execution Flow

```
LLM emits tool-call event
  → Processor creates ToolPart (status: "pending")
  → Transitions to (status: "running", input: {...})
  → Permission check against agent's ruleset
  → Tool.execute(args, context) called
  → Tool returns {title, metadata, output, attachments?}
  → Transitions to (status: "completed", output: "...")
  → Result fed back to LLM as tool-result message
```

---

## Configuration

Config hierarchy (lowest to highest priority):

1. Built-in defaults
2. Global config (`~/.config/kilo/kilo.json`)
3. Project config (`kilo.json` in project root)
4. Environment variables

**Key file:** `packages/opencode/src/config/config.ts`

---

## Server Layer

The Hono HTTP server (`packages/opencode/src/server/server.ts`) exposes:

- REST endpoints for session CRUD, message management
- SSE for real-time streaming to clients
- OpenAPI spec generation at `/doc`

Clients (VS Code, JetBrains, TUI) all communicate with this server via `@kilocode/sdk`.

---

## Monorepo Structure

| Package | Purpose |
|---|---|
| `packages/opencode/` | Core CLI engine — agents, tools, sessions, server, TUI |
| `packages/sdk/js/` | Auto-generated TypeScript SDK |
| `packages/kilo-vscode/` | VS Code extension with sidebar chat + Agent Manager |
| `packages/kilo-jetbrains/` | JetBrains plugin |
| `packages/kilo-gateway/` | Auth, provider routing, API integration |
| `packages/kilo-telemetry/` | PostHog analytics + OpenTelemetry |
| `packages/kilo-i18n/` | Internationalization |
| `packages/kilo-ui/` | SolidJS component library |
| `packages/plugin/` | Plugin/tool interface definitions |

---

## Key Source Files

```
packages/opencode/src/
├── agent/agent.ts                    # Agent definitions & registry
├── session/
│   ├── processor.ts                  # THE AGENT LOOP (most important file)
│   ├── session.ts                    # Session CRUD, forking, cost
│   ├── llm.ts                        # LLM streaming service
│   ├── system.ts                     # System prompt assembly
│   ├── compaction.ts                 # Context compaction
│   └── message-v2.ts                # Message & part types
├── tool/
│   ├── tool.ts                       # Tool.define() interface
│   ├── registry.ts                   # Tool registry
│   ├── read.ts, write.ts, edit.ts   # File operations
│   ├── shell.ts                      # Shell execution
│   ├── task.ts                       # Subagent spawning
│   └── ...                           # 20+ built-in tools
├── permission/index.ts               # Permission evaluation
├── provider/provider.ts              # Provider registry
├── config/config.ts                  # Configuration system
├── mcp/index.ts                      # MCP client
├── skill/index.ts                    # Skill system
├── plugin/index.ts                   # Plugin system
├── snapshot/index.ts                 # Git snapshot & diff
└── server/server.ts                  # HTTP server setup
```
