# Agent System Gap Analysis: ai-gui vs Kilocode

Comparison of the agent (tool-calling AI loop) systems between **ai-gui** (edward:labs) and **Kilocode** (Kilo CLI).

---

## 1. Architecture Overview

| Aspect | ai-gui | Kilocode |
|---|---|---|
| **Runtime** | Node.js (Express 5) | Bun + Effect-TS |
| **Language model** | Xiaomi MiMo API (OpenAI-compatible) | Vercel AI SDK (500+ models) |
| **Agent loop** | Express route handler with `while` loop | Effect-based `Processor` with stream events |
| **Transport** | SSE via Express response | SSE via Hono HTTP server |
| **Persistence** | IndexedDB (browser) + SQLite (server) | SQLite via Drizzle ORM |
| **Frontend** | React 19 SPA | SolidJS TUI + VS Code extension + JetBrains |
| **Monorepo** | Single app | Turborepo + Bun workspaces (20+ packages) |

---

## 2. System Prompt Engineering

### 2.1 Prompt Assembly

| Aspect | ai-gui | Kilocode |
|---|---|---|
| **Layers** | 4: stitch prompt + system instruction + tool prompt + language instruction | 7+: soul + provider prompt + environment + agent prompt + skills + instructions + plugin reminders |
| **Provider-specific prompts** | No — single MiMo API | Yes — separate `.txt` for Anthropic, GPT, Gemini, Codex, etc. |
| **Personality/soul prompt** | None | Yes — `soul.txt` defines tone, prohibited phrases, behavioral rules |
| **Environment context** | Auto-detected language only | Full context: git repo status, platform, date, config paths, editor context |
| **Skill injection** | None | Dynamic skill list appended to system prompt |
| **User-defined agents** | System instruction passed from client | Agent configs in `kilo.json` with prompt, model, permissions |

### 2.2 Prompt Quality

| Aspect | ai-gui | Kilocode |
|---|---|---|
| **Tool call format** | Fenced `` ```tool `` JSON blocks (regex-parsed) | Native function calling via AI SDK (`tool-call` events) |
| **Tool result injection** | `role: 'user'` messages (`[Tool: name] Result:...`) | Proper `tool` role messages via AI SDK |
| **Stitch-specific prompts** | Rich: HTML edit actions, IG content rules, safe margins, CTA structure | N/A — no visual design tools |
| **Spec generation prompts** | Full JSON schema embedded in prompt | N/A |
| **Code conventions prompt** | None | Detailed: no comments, no `let`, single-word names, early returns, Bun APIs |
| **Task workflow prompt** | None | Explicit: search → implement → verify → lint/typecheck |

### Gap Summary — System Prompts

- **ai-gui has**: Specialized stitch/visual design prompts, language detection
- **ai-gui lacks**: Provider-specific prompt tuning, soul/personality layer, environment context injection, skill system, code convention guidance, multi-agent prompt variants
- **Kilocode has**: Multi-layered prompt assembly, model-specific optimization, rich behavioral rules, dynamic skill injection
- **Kilocode lacks**: Visual design-specific prompts (not needed for its domain)

---

## 3. Tool System

### 3.1 Tool Definitions

| Aspect | ai-gui | Kilocode |
|---|---|---|
| **Total tools** | 8 | 30+ (built-in + Kilo-specific + plugins) |
| **Definition interface** | Plain object `{name, description, parameters}` | `Tool.define()` with Effect Schema, JSON Schema, telemetry, truncation |
| **Parameter validation** | None — raw args passed to executor | Effect Schema validation with `InvalidArgumentsError` feedback |
| **Output truncation** | Manual (8000 char limit on `web_browse`) | Automatic via `Truncate.Service` based on context window |
| **Telemetry** | None | OpenTelemetry spans per tool execution |
| **Plugin tools** | None | MCP servers + `.opencode/tools/*.{js,ts}` + plugin hooks |

### 3.2 Tool Inventory

| Category | ai-gui Tools | Kilocode Tools |
|---|---|---|
| **File operations** | — | `read`, `write`, `edit`, `apply_patch` |
| **Search** | `search_web` (DuckDuckGo scrape) | `grep`, `glob`, `websearch` (Exa/Parallel), `codebase_search`, `semantic_search` |
| **Shell** | `execute_code` (vm.runInNewContext sandbox) | `bash`/`shell` (full PTY with interactive terminal) |
| **Web** | `web_browse` (fetch + strip HTML) | `webfetch` (markdown/text/HTML conversion) |
| **Visual design** | `edit_html`, `generate_html`, `generate_spec`, `edit_spec` | — |
| **Library** | `search_library` (vector similarity) | `skill` (load domain instructions), `recall` (memory) |
| **Agent orchestration** | — | `task` (subagent spawning), `plan` (planning mode) |
| **User interaction** | — | `question`, `suggest` (code review) |
| **Diagnostics** | — | `diagnostics`, `lsp` (Language Server Protocol) |
| **Git/Repo** | — | `repo_clone`, `repo_overview` |
| **Task management** | — | `todowrite` |
| **Notebook** | — | `notebook_read`, `notebook_edit`, `notebook_execute` |
| **Background** | — | `background_process` |
| **MCP** | — | Dynamic MCP tool loading |

### 3.3 Tool Execution

| Aspect | ai-gui | Kilocode |
|---|---|---|
| **Dispatch** | `switch` statement in `executeTool()` | AI SDK `execute` callback per tool |
| **Sandboxing** | `vm.runInNewContext` (5s timeout) for JS execution | No sandbox (permission system as UX gate) |
| **Progress reporting** | SSE `tool_progress` events during sub-generations | Tool part metadata updates via `ctx.metadata()` |
| **Error handling** | Try/catch, error string returned to LLM | Effect error types, retry policy, doom loop detection |
| **Context tracking** | Manual `context` object (`currentHtml`, `currentSpec`) | Session part storage, message history |
| **Permission gating** | None | Full ruleset evaluation (allow/deny/ask) with saved approvals |

### Gap Summary — Tools

- **ai-gui has**: Visual design tools (HTML generation, spec generation, image analysis)
- **ai-gui lacks**: File operations, shell execution, search tools, diagnostics, git tools, notebook tools, plugin system, MCP support, permission gating, parameter validation, output truncation
- **Kilocode has**: Full coding agent toolkit (30+ tools), permission system, plugin architecture, MCP integration, subagent delegation
- **Kilocode lacks**: Visual design tools (domain-specific)

---

## 4. Agent Loop / Processor

### 4.1 Loop Structure

| Aspect | ai-gui | Kilocode |
|---|---|---|
| **Max iterations** | 5 (hardcoded) | Configurable per agent (`steps` field) |
| **Loop mechanism** | `while` loop in Express route handler | Effect stream processor with event-driven state machine |
| **Termination conditions** | No tool calls found, max iterations reached | `"stop"` (blocked/error), `"compact"` (context overflow), `"continue"` (next turn) |
| **Streaming** | SSE chunks from MiMo API | AI SDK stream events → typed `LLMEvent` stream |
| **Abort handling** | `AbortController` on client + `req.on('close')` | Effect `Deferred` + signal propagation |

### 4.2 Event Processing

| Event Type | ai-gui | Kilocode |
|---|---|---|
| **Text delta** | Parsed from SSE, streamed to client | `text-start/delta/end` → session part updates |
| **Reasoning/thinking** | Parsed from SSE `thinking_content` field | `reasoning-start/delta/end` → reasoning part management |
| **Tool call** | Parsed from response text via regex | `tool-call` event from AI SDK |
| **Tool result** | Appended as `role: 'user'` message | Proper `tool-result` from AI SDK |
| **Step tracking** | None | `step-start` (snapshot) + `step-finish` (usage, cost, patch) |
| **Provider errors** | HTTP error codes from MiMo | `provider-error` event with retry policy |
| **Annotations** | `search_annotations` from web search results | N/A |

### 4.3 Advanced Features

| Feature | ai-gui | Kilocode |
|---|---|---|
| **Context compaction** | None | Automatic summarization when context window overflows |
| **Doom loop detection** | None | 3 identical consecutive tool calls triggers permission ask |
| **Git snapshots** | None | Pre/post step snapshots for diff tracking |
| **Cost tracking** | Token counts from MiMo API | Per-message cost calculation with provider pricing |
| **Retry logic** | None (single attempt) | Provider-specific retry with exponential backoff |
| **Subagent delegation** | None | `task` tool spawns child sessions with scoped permissions |
| **Context overflow** | None (truncation if API rejects) | Preflight estimation → proactive compaction |

### Gap Summary — Agent Loop

- **ai-gui has**: Simple functional loop, SSE streaming with tool progress
- **ai-gui lacks**: Context compaction, doom loop detection, git snapshots, cost tracking, retry logic, subagent delegation, step tracking, event-driven architecture
- **Kilocode has**: Full-featured processor with compaction, doom loop detection, snapshots, cost tracking, retry, subagents, telemetry
- **Kilocode lacks**: Nothing significant in this area

---

## 5. Permission System

| Aspect | ai-gui | Kilocode |
|---|---|---|
| **Exists** | No | Yes |
| **Rules** | None | Glob-pattern rulesets: allow/deny/ask |
| **User prompts** | None | Permission dialog with once/always/reject |
| **Saved approvals** | None | Persisted in SQLite, survive across sessions |
| **Config protection** | None | Config file edits always require explicit approval |
| **Agent-specific** | None | Each agent has its own permission ruleset |
| **Doom loop protection** | None | Repeated identical calls trigger permission ask |

### Gap Summary — Permissions

- **ai-gui**: No permission system at all
- **Kilocode**: Full permission system with rulesets, user prompts, saved approvals, agent-specific rules, config protection

---

## 6. Multi-Agent System

| Aspect | ai-gui | Kilocode |
|---|---|---|
| **Agent types** | 1 (generic agent with configurable tools) | 9+ built-in agents + user-defined agents |
| **Agent switching** | No — single agent mode | Yes — switch between code/plan/ask/debug/explore/review |
| **Subagents** | None | `task` tool spawns child agents with scoped permissions |
| **Agent customization** | System instruction from client | `kilo.json` agent config with prompt, model, permissions, temperature |
| **Agent generation** | None | AI-generate new agents from natural language description |
| **Reference agents** | None | Dynamic scout agents for external repo access |

### Built-in Agent Comparison

| Agent | ai-gui | Kilocode |
|---|---|---|
| Code/Coding | — | `code` (default, full tools) |
| Planning | — | `plan` (edit restricted to plan files) |
| Q&A | — | `ask` (read-only, no file changes) |
| Debug | — | `debug` (debugging specialist) |
| Explore | — | `explore` (codebase exploration, read-only) |
| Review | — | `review` (code review) |
| Orchestrator | — | `orchestrator` (task orchestration) |
| Compaction | — | `compaction` (hidden, context summarization) |
| Title | — | `title` (hidden, session naming) |
| Summary | — | `summary` (hidden, session summarization) |
| Scout | — | `scout` (external docs research) |

---

## 7. Provider & Model System

| Aspect | ai-gui | Kilocode |
|---|---|---|
| **Providers** | 1 (Xiaomi MiMo) | 15+ (OpenAI, Anthropic, Google, AWS Bedrock, Azure, Groq, Mistral, xAI, etc.) |
| **Models** | ~12 (MiMo variants) | 500+ via Vercel AI SDK |
| **Mid-task switching** | No | Yes — switch model mid-conversation |
| **Provider abstraction** | Direct HTTP to MiMo API | Vercel AI SDK provider interface |
| **Custom models** | Yes — add via settings UI | Yes — via `kilo.json` config |
| **API key management** | `.env` file with Vite `define` injection | Local config, environment variables, Kilo Gateway |
| **Language model runtime** | Single (MiMo HTTP) | Two: AI SDK (default) + native runtime (experimental) |

---

## 8. Session & Conversation Management

| Aspect | ai-gui | Kilocode |
|---|---|---|
| **Storage** | IndexedDB (browser) | SQLite via Drizzle ORM |
| **Session forking** | No | Yes — `fork()` creates child sessions for subagents |
| **Message structure** | Flat `{role, content, attachments}` | Typed `Part` objects (text, tool, reasoning, step-start, step-finish, patch, compaction) |
| **Cost tracking** | Token counts only | Per-message cost with provider pricing |
| **Auto-summarization** | None | Automatic session summarization for long conversations |
| **Session export** | None | Cloud sync via Kilo Sessions |

---

## 9. Configuration & Extensibility

| Aspect | ai-gui | Kilocode |
|---|---|---|
| **Config format** | `.env` + localStorage | `kilo.json` (project) + `~/.config/kilo/` (global) + env vars |
| **Config hierarchy** | Flat | 4-tier: defaults → global → project → env vars |
| **Plugin system** | None | Hook-based plugin system with tool definitions |
| **MCP support** | None | Full MCP client for external tool servers |
| **Skills** | None | Domain-specific instruction sets loaded on demand |
| **Custom agents** | None | User-defined via `kilo.json` |
| **Custom tools** | None | MCP servers + plugin tools + `.opencode/tools/*` |

---

## 10. Frontend & UX

| Aspect | ai-gui | Kilocode |
|---|---|---|
| **UI framework** | React 19 + shadcn/ui | SolidJS + OpenTUI (TUI), SolidJS (VS Code webview) |
| **Styling** | Tailwind CSS v4 + neon themes | Tailwind CSS |
| **Platforms** | Web browser | TUI, VS Code, JetBrains, Web (console) |
| **Tool progress** | SSE `tool_progress` events with streaming chunks | Tool part status updates (pending → running → completed) |
| **Permission UI** | None | Permission dialog with once/always/reject |
| **Code review** | None | `suggest` tool with inline code review |
| **Planning mode** | None | Dedicated `plan` agent with restricted editing |
| **Voice input** | TTS/ASR panels | VS Code speech-to-text |
| **Visual design** | Stitch canvas (Fabric.js), HTML generation, image generation | None |

---

## 11. Key Gaps Summary

### What ai-gui is Missing (vs Kilocode)

| Gap | Impact | Effort |
|---|---|---|
| **Permission system** | No safety gates on tool execution | High — requires ruleset engine, UI, persistence |
| **File operations tools** (read/write/edit) | Agent cannot modify code files | Medium — implement tools + sandboxing |
| **Shell execution** | Agent cannot run commands | Medium — implement with sandboxing |
| **Context compaction** | Long conversations will fail when context overflows | Medium — implement summarization agent |
| **Provider abstraction** | Locked to MiMo API | High — integrate Vercel AI SDK or similar |
| **Multi-agent system** | No specialized agent modes | Medium — define agent configs + prompts |
| **Subagent delegation** | Cannot parallelize or scope tasks | High — implement session forking + task tool |
| **Doom loop detection** | Agent can get stuck repeating same tool call | Low — add counter + threshold |
| **Git snapshot tracking** | No diff tracking per conversation | Medium — integrate git operations |
| **Cost tracking** | No per-message cost calculation | Low — add provider pricing data |
| **Plugin/MCP system** | No extensibility | High — implement plugin hooks + MCP client |
| **Skill system** | No domain-specific instruction loading | Low — implement skill discovery + loading |
| **Provider-specific prompts** | Suboptimal for non-MiMo models | Medium — create prompt templates per provider |
| **Soul/personality prompt** | No consistent agent personality | Low — write personality template |
| **Environment context injection** | Agent lacks project/platform awareness | Low — add context assembly |
| **Retry logic** | Single attempt, no recovery from transient failures | Low — implement retry with backoff |
| **Parameter validation** | Raw args passed without schema validation | Low — add Zod/Effect schema validation |
| **Output truncation** | Manual limits, no context-window-aware truncation | Low — implement auto-truncation |

### What Kilocode is Missing (vs ai-gui)

| Gap | Impact | Effort |
|---|---|---|
| **Visual design tools** (HTML gen, spec gen, image analysis) | No visual/creative design agent | High — domain-specific tools + prompts |
| **IG content workflows** (carousels, stories) | No social media content creation | Medium — implement spec generation + layouts |
| **Fabric.js canvas integration** | No interactive visual editor | High — implement canvas + element manipulation |
| **Library component search** (vector similarity) | No semantic component discovery | Medium — implement embedding service + search |
| **Image analysis pre-pass** | No vision model integration for reference images | Low — add vision API call before agent loop |

---

## 12. Recommendations

### For ai-gui to Close Gaps

1. **Immediate (Low effort, High impact)**:
   - Add doom loop detection (counter on repeated tool calls)
   - Add parameter validation for tool arguments
   - Implement output auto-truncation based on context window
   - Write a soul/personality prompt for consistent agent behavior
   - Add environment context injection (platform, project info)

2. **Short-term (Medium effort)**:
   - Implement context compaction (summarize old messages when approaching context limit)
   - Add file operation tools (read, write, edit) with sandboxing
   - Create provider-specific prompt templates for better multi-model support
   - Implement retry logic with exponential backoff
   - Add a skill system for domain-specific instructions

3. **Long-term (High effort)**:
   - Build a permission system with rulesets and user prompts
   - Integrate a provider abstraction layer (Vercel AI SDK or similar)
   - Implement subagent delegation for parallel task execution
   - Add MCP support for external tool servers
   - Build a plugin system for extensibility

### For Kilocode to Close Gaps

1. **If visual design is a priority**:
   - Implement HTML generation/editing tools
   - Add image analysis pre-pass with vision models
   - Create IG content spec generation with layout templates
   - Build a canvas integration for visual editing

---

## 13. Architecture Comparison Diagram

```
ai-gui Agent System:
┌─────────────────────────────────────────────────┐
│  Client (React) → SSE → Express Route Handler   │
│  ┌─────────────────────────────────────────┐     │
│  │  while (iteration < 5) {               │     │
│  │    streamChatCompletion(messages)       │     │
│  │    parseToolCalls(response)  ← regex   │     │
│  │    executeTool(call)  ← switch/case    │     │
│  │    messages.push(tool_result as user)   │     │
│  │  }                                      │     │
│  └─────────────────────────────────────────┘     │
│  Tools: 8 (web, code, search, stitch, library)  │
│  Permissions: None                                │
│  Compaction: None                                 │
└─────────────────────────────────────────────────┘

Kilocode Agent System:
┌─────────────────────────────────────────────────────────┐
│  Client (TUI/VS Code/JetBrains) → SDK → Hono Server    │
│  ┌─────────────────────────────────────────────────┐     │
│  │  Session.chat() → Processor.create()            │     │
│  │  ┌───────────────────────────────────────┐      │     │
│  │  │  System Prompt Assembly:              │      │     │
│  │  │    soul + provider + environment +    │      │     │
│  │  │    agent + skills + instructions      │      │     │
│  │  └───────────────────────────────────────┘      │     │
│  │  ┌───────────────────────────────────────┐      │     │
│  │  │  LLM.stream() → handleEvent() loop:  │      │     │
│  │  │    text → update parts                │      │     │
│  │  │    tool-call → permission.evaluate()  │      │     │
│  │  │             → allow/deny/ask          │      │     │
│  │  │             → tool.execute()          │      │     │
│  │  │    step-finish → snapshot + cost      │      │     │
│  │  │    overflow → compact + retry         │      │     │
│  │  └───────────────────────────────────────┘      │     │
│  └─────────────────────────────────────────────────┘     │
│  Tools: 30+ (file, shell, search, git, diagnostic, MCP) │
│  Permissions: Full ruleset with saved approvals          │
│  Compaction: Automatic context summarization             │
│  Subagents: Task tool with session forking               │
└─────────────────────────────────────────────────────────┘
```
