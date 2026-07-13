# Kilo Code Agent vs Library Agent — Comparison

A side-by-side comparison of the Kilo Code coding agent and the Library Agent (from ai-gui).

---

## Architecture Summary

| Aspect | Kilo Code Agent | Library Agent |
|---|---|---|
| **Runtime** | Dedicated backend server (`kilo serve`) with Effect-TS | Express.js server route (`server/routes/library.ts`) |
| **Language** | TypeScript (Effect-TS, Bun) | TypeScript (Express, Node.js) |
| **LLM** | Vercel AI SDK — 500+ models (OpenAI, Anthropic, Google, etc.) | Xiaomi MiMo API (single model) |
| **Client** | VS Code extension, JetBrains plugin, CLI TUI | React sidebar (`AgentSidebar.tsx`) in a web app |
| **Protocol** | HTTP + SSE via auto-generated SDK | HTTP + SSE via `fetch` + `ReadableStream` |
| **Persistence** | SQLite (Drizzle ORM) | IndexedDB (client) + in-memory/file (server) |
| **Scope** | Full software engineering (files, shell, git, web, LSP) | UI component library CRUD + live preview verification |

---

## Agent Loop

Both systems use a **multi-step tool-calling loop** — the LLM generates a response, if it contains tool calls the server executes them, feeds results back, and loops until the LLM produces a final text response or hits a limit.

### Kilo Code

**File:** `packages/opencode/src/session/processor.ts` (1100 lines)

```
1. Capture git snapshot
2. Build system prompt (model-specific + agent + environment + skills)
3. Resolve tools for agent + model
4. LLM.stream(messages, tools) via Vercel AI SDK
5. For each streamed event:
   - text-delta → append to message, stream to client
   - reasoning-delta → track thinking tokens
   - tool-call → permission check → execute → feed result back
   - step-finish → compute cost, check overflow
6. If context overflow → compact, retry
7. If doom-loop detected (3 identical calls) → stop
8. Finalize: compute diff patch, update summary
```

- Uses **Vercel AI SDK streaming** — native tool call protocol (JSON Schema + function calling)
- Tools are executed via **Effect-TS** with structured concurrency, abort signals, and typed errors
- **Permission system** gates every tool call (allow/deny/ask)
- **Git snapshots** before/after each step for diff tracking
- **Context compaction** when conversation exceeds context window
- **Doom-loop detection** halts after 3 identical tool calls

### Library Agent

**File:** `server/routes/library.ts:593-815` (~220 lines)

```
1. Build system prompt (base + component context + tool docs + language)
2. While iteration < 10:
   a. Stream MiMo API → accumulate fullResponse
   b. parseToolCalls(fullResponse) — regex extracts tool blocks
   c. If no tools → send content, break
   d. Strip tool syntax, send clean text
   e. For each tool call:
      - Send tool_call SSE event
      - executeLibraryTool(call)
      - Handle special cases (ask_user, verify, etc.)
      - Send tool_result SSE event
      - Push result to apiMessages
3. Send tool_summary + [DONE]
```

- Uses **regex-based tool call parsing** (`parseToolCalls()`) — not native function calling
- Three parse formats: XML `<tool_call>`, code block `` ```tool ``, bare JSON
- **No permission system** — all tools execute without user confirmation
- **No git snapshots** or diff tracking
- **No context compaction** — hard 10-iteration limit
- **No doom-loop detection**

---

## Tool System

### Kilo Code

**20+ built-in tools** with JSON Schema parameters and Effect-TS execution:

| Category | Tools |
|---|---|
| File I/O | `read`, `write`, `edit`, `apply_patch` |
| Search | `glob`, `grep`, `webfetch`, `websearch` |
| Execution | `shell` (bash/PowerShell) |
| Agent | `task` (subagent spawning), `plan`, `skill` |
| Interaction | `question` (ask user), `suggest` (code review), `todo` |
| IDE | `diagnostics` (LSP), `lsp` (language server) |
| Memory | `recall` (context/memory access) |
| Git | `repo_clone`, `repo_overview` |

Tools use **Vercel AI SDK native function calling** — parameters are JSON Schema, the LLM generates structured tool calls.

### Library Agent

**13 tools** with JSON arguments parsed from regex-matched text:

| Category | Tools |
|---|---|
| Component CRUD | `search_library`, `create_component`, `read_component`, `update_component`, `write_component_file`, `delete_component_file` |
| Organization | `list_folders`, `create_folder`, `move_to_folder`, `list_folder_contents` |
| Planning | `create_todo_list` |
| Verification | `verify_component` (live render in iframe) |
| Interaction | `ask_user` |
| Execution | `execute_code` (sandboxed JS VM) |

Tools use **regex-based parsing** — the LLM outputs tool calls in XML/JSON/code-block format, the server extracts them with regex patterns.

---

## Permission System

| Aspect | Kilo Code | Library Agent |
|---|---|---|
| **Exists** | Yes | No |
| **Actions** | `allow`, `deny`, `ask` | N/A |
| **Granularity** | Per-tool, per-file-pattern (glob) | N/A |
| **User prompt** | Built-in `question` tool + permission ask UI | `ask_user` tool only |
| **Subagent isolation** | Child agents get restricted permissions | N/A |

Kilo Code's permission system is a UX/security feature that gates every tool invocation. The Library Agent executes all tools without confirmation.

---

## LLM Integration

| Aspect | Kilo Code | Library Agent |
|---|---|---|
| **Abstraction** | Vercel AI SDK (provider-agnostic) | Direct MiMo API calls |
| **Models** | 500+ (OpenAI, Anthropic, Google, Mistral, xAI, etc.) | Xiaomi MiMo only |
| **Tool calling** | Native function calling (JSON Schema) | Regex-parsed text output |
| **Streaming** | AI SDK streaming with typed events | Raw SSE with manual accumulation |
| **Model switching** | Mid-task model switching | Per-session model selection |
| **System prompts** | Model-family-specific prompts (anthropic.txt, gpt.txt, gemini.txt) | Single base prompt |
| **Thinking tokens** | Captured as `reasoning` parts | Not captured |

---

## Session Management

| Aspect | Kilo Code | Library Agent |
|---|---|---|
| **Storage** | SQLite (server-side, persistent) | IndexedDB (client) + server sessions |
| **Session scope** | Per-project, multi-agent | Per-component |
| **Max sessions** | Unlimited | 3 per component |
| **Forking** | Yes (for subagent delegation) | No |
| **Cost tracking** | Per-session token/cost calculation | No |
| **Auto-summarization** | Yes (older messages compacted) | No |
| **Session title** | AI-generated from first message | First user message text |

---

## Client Architecture

### Kilo Code

Multiple clients connect to the same `kilo serve` backend:

- **VS Code Extension** — sidebar chat, inline diffs, Agent Manager (multi-session with git worktree isolation)
- **JetBrains Plugin** — split-mode architecture with IDE integration
- **CLI TUI** — SolidJS + OpenTUI terminal interface
- **Web/Cloud** — browser-based agent at app.kilo.ai

All clients communicate via `@kilocode/sdk` (auto-generated from OpenAPI spec).

### Library Agent

Single client embedded in the web app:

- **AgentSidebar.tsx** — React component with block-based message rendering
- SSE events parsed into `MessageBlock` types (text, tool_call, ask_user, agent_plan)
- Client-side `extractToolBlocks()` as safety net for tool syntax stripping
- Structured layout with tool phases (Reading → Planning → Writing → Verifying)

---

## Verification / Testing

| Aspect | Kilo Code | Library Agent |
|---|---|---|
| **Code verification** | Shell execution, LSP diagnostics, git diffs | `verify_component` — live render in iframe |
| **Error detection** | LSP errors, test failures, lint output | Iframe render errors (SyntaxError, ReferenceError) |
| **Self-correction** | Agent reads errors, fixes code, re-runs | Agent sees verification result, fixes, re-verifies |
| **CI/CD** | `kilo run --auto` for autonomous pipelines | No CI/CD integration |

The Library Agent has a unique **verify flow** that renders the component in a sandboxed iframe and posts results back — tailored for UI component development.

---

## Context Management

| Aspect | Kilo Code | Library Agent |
|---|---|---|
| **Window management** | Automatic compaction when overflow detected | Hard 10-iteration limit |
| **Compaction** | Summarizes older messages, retries | None |
| **Tool output truncation** | Auto-truncation to fit context | No truncation |
| **Doom-loop detection** | Halts after 3 identical tool calls | None |

---

## Key Differences Summary

| Dimension | Kilo Code | Library Agent |
|---|---|---|
| **Purpose** | General-purpose software engineering | UI component library management |
| **Complexity** | ~1100-line processor, 20+ tools, permission system, snapshots | ~220-line loop, 13 tools, regex parsing |
| **LLM flexibility** | 500+ models, mid-task switching | Single model (MiMo) |
| **Tool protocol** | Native function calling (JSON Schema) | Regex-parsed text (XML/JSON/code-block) |
| **Safety** | Permission gating, sandbox options | No permission system |
| **Persistence** | SQLite (server) | IndexedDB (client) |
| **Extensibility** | MCP servers, plugins, skills, custom agents | Fixed tool set |
| **Deployment** | Standalone server + multiple clients | Embedded in Express app |
| **Git integration** | Full (snapshots, diffs, patches) | None |
| **IDE integration** | VS Code, JetBrains | Web app only |

---

## When to Use Which

**Kilo Code** is suited for:
- Full software engineering workflows (read/write/edit any file, run any command)
- Multi-file refactoring with git tracking
- Teams needing multiple agents (plan, code, debug, review)
- CI/CD automation (`kilo run --auto`)
- Projects requiring model flexibility or local model support

**Library Agent** is suited for:
- UI component library CRUD operations
- Live preview verification of component changes
- Single-model, single-domain workflows
- Embedded agent experiences within a web app
