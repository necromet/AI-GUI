# Agent Builder Implementation Plan

## Enhancing Existing `/agent-builder` Route with Open Agent Builder Features

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State — What Already Exists](#2-current-state--what-already-exists)
3. [Gap Analysis — What's Missing](#3-gap-analysis--whats-missing)
4. [Architecture Mapping](#4-architecture-mapping)
5. [Phase 1 — Database Schema Alignment](#5-phase-1--database-schema-alignment)
6. [Phase 2 — Backend: Workflow Execution Engine](#6-phase-2--backend-workflow-execution-engine)
7. [Phase 3 — Backend: Node Executors](#7-phase-3--backend-node-executors)
8. [Phase 4 — Backend: API Routes](#8-phase-4--backend-api-routes)
9. [Phase 5 — Backend: MCP Tool Support](#9-phase-5--backend-mcp-tool-support)
10. [Phase 6 — Backend: Approval System](#10-phase-6--backend-approval-system)
11. [Phase 7 — Frontend: React Flow Canvas & Node Types](#11-phase-7--frontend-react-flow-canvas--node-types)
12. [Phase 8 — Frontend: Node Settings Panels](#12-phase-8--frontend-node-settings-panels)
13. [Phase 9 — Frontend: Execution Panel & Streaming](#13-phase-9--frontend-execution-panel--streaming)
14. [Phase 10 — Frontend: Hooks & State Management](#14-phase-10--frontend-hooks--state-management)
15. [Phase 11 — Frontend: Templates & Import/Export](#15-phase-11--frontend-templates--importexport)
16. [Phase 12 — Integration & Polish](#16-phase-12--integration--polish)
17. [Dependency Matrix](#17-dependency-matrix)
18. [File Manifest](#18-file-manifest)

---

## 1. Executive Summary

This plan enhances the **existing** `/agent-builder` route in edward:labs by porting the full Open Agent Builder feature set. The route, database tables, server routes, and frontend scaffolding **already exist** — this is about expanding stub implementations into production-quality code.

**No new routes or major architectural changes needed.** The work is:
- Expanding 3 stub executors (70, 65, 32 lines → 300, 200, 150 lines)
- Adding 5 missing executor files
- Adding MCP/Firecrawl services
- Expanding frontend panels from stubs to full implementations
- Adding template system and import/export

---

## 2. Current State — What Already Exists

### Frontend (`components/agent-builder/` — 23 files)

| File | Lines | Status |
|------|-------|--------|
| `AgentBuilderMode.tsx` | 107 | ✅ Complete — workflow list + canvas switcher |
| `AgentBuilderPanel.tsx` | 298 | ✅ Complete — sidebar controls |
| `AgentBuilderCanvas.tsx` | 251 | ✅ Complete — canvas wrapper |
| `WorkflowCanvas.tsx` | 157 | ✅ Complete — React Flow with drag-drop, minimap, controls |
| `WorkflowToolbar.tsx` | 91 | ✅ Complete — save, name edit |
| `CustomNode.tsx` | 79 | ⚠️ Basic — renders all node types but generic |
| `AgentNode.tsx` | 42 | ⚠️ Basic — minimal agent node |
| `ToolNode.tsx` | 41 | ⚠️ Basic — minimal tool node |
| `NodeSettingsPanel.tsx` | 99 | ⚠️ Stub — only basic fields |
| `ExecutionPanel.tsx` | 88 | ⚠️ Stub — minimal execution UI |
| `VariablePicker.tsx` | 42 | ⚠️ Stub — basic variable ref |
| `WorkflowSidebar.tsx` | 54 | ✅ Complete |
| `AgentSidebar.tsx` | 219 | ✅ Complete — agent chat sidebar |
| `AgentChatView.tsx` | 169 | ✅ Complete |
| `AgentDetailPanel.tsx` | 208 | ✅ Complete |
| `ToolDetailPanel.tsx` | 127 | ✅ Complete |
| `types.ts` | 169 | ✅ Complete — all types defined |
| `constants.ts` | 34 | ✅ Complete — all 12 node definitions |
| `useWorkflow.ts` | 47 | ⚠️ Stub — basic CRUD |
| `useWorkflowExecution.ts` | 86 | ⚠️ Stub — basic execution |
| `hooks/useAgentBuilder.ts` | 217 | ✅ Complete |
| `hooks/useAgentChat.ts` | 146 | ✅ Complete |
| `styles.css` | 439 | ✅ Complete |

### Backend (`server/` — related files)

| File | Lines | Status |
|------|-------|--------|
| `routes/workflows.ts` | 163 | ⚠️ Has CRUD + execute-stream + resume, missing many endpoints |
| `routes/agentBuilder.ts` | 467 | ✅ Complete — agent/tool/session CRUD + chat |
| `services/workflowExecutor.ts` | 245 | ⚠️ Uses LangGraph, handles all node types but with stub executors |
| `services/workflowExecutors/agent.ts` | 70 | ⚠️ Stub — no tool calling, no multi-turn |
| `services/workflowExecutors/logic.ts` | 65 | ⚠️ Stub — basic if-else/while |
| `services/workflowExecutors/mcp.ts` | 32 | ⚠️ Stub — no real MCP |
| `services/workflowExecutors/variables.ts` | 16 | ⚠️ Stub — basic substitution |
| `db/workflows.ts` | 158 | ⚠️ Has workflow CRUD, missing execution/approval/MCP CRUD |
| `db/schema.ts` | 381 | ✅ Complete — all tables exist |

### Database Tables (all exist in `server/db/schema.ts`)

| Table | Status |
|-------|--------|
| `workflows` | ✅ nodes, edges, is_template, is_public, category, tags |
| `executions` | ✅ status, node_results, variables, input, output, thread_id |
| `mcp_servers` | ✅ url, auth_type, tools, connection_status, enabled |
| `approvals` | ✅ approval_id, workflow_id, execution_id, status |
| `user_llm_keys` | ✅ provider, encrypted_key, is_active |
| `agent_builder_agents` | ✅ Full agent CRUD |
| `agent_builder_tools` | ✅ Full tool CRUD |
| `agent_builder_sessions` | ✅ Chat sessions per agent |

---

## 3. Gap Analysis — What's Missing

### Backend Gaps (Priority Order)

| Gap | Impact | Files |
|-----|--------|-------|
| Agent executor is a stub (no tool calling loop) | **Critical** — agents can't use tools | `workflowExecutors/agent.ts` |
| MCP executor is a stub (no real MCP) | **Critical** — MCP nodes do nothing | `workflowExecutors/mcp.ts` |
| No MCP service (discovery, connection, tool calls) | **Critical** — no MCP support | `mcpService.ts` (new) |
| Logic executor is basic | **High** — while loops unreliable | `workflowExecutors/logic.ts` |
| No transform executor (JS sandbox) | **High** — transform nodes broken | `workflowExecutors/transform.ts` (new) |
| No HTTP executor | **Medium** — HTTP nodes broken | `workflowExecutors/http.ts` (new) |
| No extract executor (Firecrawl) | **Medium** — extract nodes broken | `workflowExecutors/extract.ts` (new) |
| No template system | **Medium** — no pre-built workflows | `workflowTemplates.ts` (new) |
| Missing API endpoints (export, import, templates, MCP test) | **Medium** | `routes/workflows.ts` |
| No approval interrupt/resume flow | **Medium** — approvals don't work | `workflowExecutor.ts` |

### Frontend Gaps (Priority Order)

| Gap | Impact | Files |
|-----|--------|-------|
| NodeSettingsPanel is a stub | **Critical** — can't configure nodes | `NodeSettingsPanel.tsx` |
| ExecutionPanel is a stub | **High** — no execution visualization | `ExecutionPanel.tsx` |
| No node-specific panels (logic, tools, etc.) | **High** — can't configure complex nodes | `panels/*.tsx` (new) |
| useWorkflow is basic | **Medium** — no auto-save, no dirty tracking | `useWorkflow.ts` |
| useWorkflowExecution is basic | **Medium** — no SSE streaming UI | `useWorkflowExecution.ts` |
| No template gallery | **Low** — UX enhancement | `TemplateGallery.tsx` (new) |
| No import/export modals | **Low** — UX enhancement | `ImportModal.tsx`, `ExportModal.tsx` (new) |

---

## 4. Architecture Mapping

| Open Agent Builder (Next.js + Convex) | edward:labs (React + Vite + Express + PG) |
|---------------------------------------|------------------------------------------|
| `convex/schema.ts` | `server/db/schema.ts` (existing tables) |
| `convex/workflows.ts` | `server/db/workflows.ts` (existing) |
| `convex/executions.ts` | `server/db/workflows.ts` (add execution CRUD) |
| `convex/approvals.ts` | `server/db/workflows.ts` (add approval CRUD) |
| `convex/mcpServers.ts` | `server/db/workflows.ts` (add MCP CRUD) |
| `convex/userLLMKeys.ts` | `server/db/workflows.ts` (add LLM key CRUD) |
| `convex/templates.ts` | `server/services/workflowTemplates.ts` (new) |
| `lib/workflow/langgraph.ts` | `server/services/workflowEngine.ts` (new) |
| `lib/workflow/executors/*.ts` | `server/services/workflowExecutors/*.ts` (expand) |
| `lib/workflow/types.ts` | `components/agent-builder/types.ts` (sync) |
| `lib/mcp/*.ts` | `server/services/mcpService.ts` (new) |
| `app/api/workflows/*` | `server/routes/workflows.ts` (expand) |
| `app/api/execute-*` | `server/routes/workflows.ts` (expand) |
| `app/api/approval/*` | `server/routes/workflows.ts` (expand) |
| `app/api/mcp/*` | `server/routes/workflows.ts` (expand) |
| `components/workflow-builder/*` | `components/agent-builder/*` (expand) |
| `hooks/useWorkflow.ts` | `components/agent-builder/useWorkflow.ts` (expand) |
| `hooks/useWorkflowExecution.ts` | `components/agent-builder/useWorkflowExecution.ts` (expand) |
| `hooks/useApprovalWatch.ts` | `components/agent-builder/hooks/useApprovalWatch.ts` (new) |
| Clerk auth middleware | `server/middleware/auth.ts` (existing `requireModeAuth`) |

---

## 5. Phase 1 — Database Schema Alignment

**Goal**: Ensure PostgreSQL tables match what the Open Agent Builder needs.

**Status**: Most tables already exist. Need to add missing columns/tables.

### 3.1 Modify `server/db/schema.ts`

Add to `SCHEMA_SQL`:

```sql
-- Workflow templates table (new)
CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  tags TEXT DEFAULT '[]',
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  difficulty TEXT DEFAULT 'beginner',
  estimated_time TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MCP server registry (expand existing mcp_servers if needed)
-- Already exists, ensure 'tools' column stores discovered tool schemas

-- User API keys (expand existing user_llm_keys if needed)
-- Already exists, ensure provider supports: anthropic, openai, groq, firecrawl, arcade

-- Workflow execution logs (new - for detailed step-by-step tracking)
CREATE TABLE IF NOT EXISTS execution_logs (
  id SERIAL PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exec_logs_execution ON execution_logs(execution_id);
```

### 3.2 Modify `server/db/workflows.ts`

Add CRUD functions:

| Function | Purpose |
|----------|---------|
| `getWorkflowTemplates()` | List all templates |
| `createWorkflowTemplate(data)` | Save as template |
| `deleteWorkflowTemplate(id)` | Remove template |
| `createExecution(data)` | Start new execution |
| `updateExecution(id, data)` | Update execution status/results |
| `getExecution(id)` | Get execution by ID |
| `getExecutionsByWorkflow(workflowId)` | List executions for workflow |
| `createApproval(data)` | Create approval request |
| `updateApproval(id, data)` | Approve/reject |
| `getApproval(approvalId)` | Get approval by ID |
| `getMCPServers()` | List MCP servers |
| `createMCPServer(data)` | Add MCP server |
| `updateMCPServer(id, data)` | Update MCP server |
| `deleteMCPServer(id)` | Remove MCP server |
| `testMCPConnection(url, headers)` | Test MCP server connectivity |
| `getUserLLMKeys()` | List user LLM keys |
| `saveUserLLMKey(data)` | Save/update LLM key |
| `getLLMKeyForProvider(provider)` | Get active key for provider |
| `createExecutionLog(data)` | Log execution step |

**Files to modify:**
- `server/db/schema.ts` — add new tables
- `server/db/workflows.ts` — add all CRUD functions

---

## 6. Phase 2 — Backend: Workflow Execution Engine

**Goal**: Port `lib/workflow/langgraph.ts` (1513 lines) to `server/services/workflowEngine.ts`.

### 4.1 Create `server/services/workflowEngine.ts`

This is the core engine that converts workflow graph definitions (nodes + edges) into an executable pipeline. Port from the Open Agent Builder's `LangGraphExecutor` class.

**Key responsibilities:**
- Parse workflow graph (nodes + edges) into execution order
- Handle node type routing (agent, mcp, transform, if-else, while, approval, etc.)
- Manage execution state (variables, chat history, node results)
- Support streaming execution via SSE
- Handle interrupts (approvals, Arcade auth)
- Support while-loop iteration with configurable max iterations
- Support conditional branching (if-else)
- Support parallel execution for fan-out nodes

**Implementation approach:**
- **Option A (Recommended)**: Port as a standalone execution engine without LangGraph dependency. The core logic is graph traversal + state management, which doesn't require the full LangGraph framework. This avoids adding `@langchain/langgraph` + `@langchain/core` (heavy dependencies).
- **Option B**: Install `@langchain/langgraph` + `@langchain/core` as server dependencies and use the `LangGraphExecutor` class almost as-is.

**Recommendation**: Option A. The LangGraph features actually used are:
- `StateGraph` → custom graph walker
- `MemorySaver` → PostgreSQL-backed checkpointing
- `Command` + `interrupt` → custom approval/auth flow
- `Annotation` → plain TypeScript interfaces

All of these can be implemented without the LangGraph dependency (~2MB of packages).

### 4.2 Core Engine Interface

```typescript
interface WorkflowEngine {
  execute(workflow: Workflow, input: any, config?: ExecutionConfig): Promise<ExecutionResult>;
  executeStream(workflow: Workflow, input: any, config?: ExecutionConfig): AsyncGenerator<ExecutionState>;
  resume(executionId: string, resumeValue: any): AsyncGenerator<ExecutionState>;
}

interface ExecutionConfig {
  apiKeys?: { anthropic?: string; openai?: string; groq?: string; firecrawl?: string; arcade?: string };
  onNodeUpdate?: (nodeId: string, result: NodeExecutionResult) => void;
  threadId?: string;
  executionId?: string;
}

interface ExecutionState {
  variables: Record<string, any>;
  currentNodeId: string;
  nodeResults: Record<string, NodeExecutionResult>;
  pendingAuth?: WorkflowPendingAuth;
  status: 'running' | 'completed' | 'failed' | 'paused';
  error?: string;
}
```

### 4.3 Graph Walker Algorithm

```
1. Find start node
2. Initialize state: { variables: { input }, chatHistory: [], nodeResults: {} }
3. Queue: [startNodeId]
4. While queue not empty:
   a. Dequeue nodeId
   b. Execute node executor based on nodeType
   c. Update state with node output
   d. Find outgoing edges from nodeId
   e. If conditional node (if-else/while):
      - Evaluate condition
      - Queue appropriate target(s)
   f. If parallel (fan-out):
      - Queue all targets
   g. If single edge:
      - Queue target
   h. If end node or no outgoing edges:
      - Complete
5. Return final state
```

**Files to create:**
- `server/services/workflowEngine.ts` — core execution engine (~600-800 lines)

**Files to modify:**
- `server/services/workflowExecutor.ts` — replace or delegate to new engine

---

## 7. Phase 3 — Backend: Node Executors

**Goal**: Port all 8 node executors from `lib/workflow/executors/`.

### 5.1 File Mapping

| Open Agent Builder | edward:labs (existing) | Action |
|-------------------|----------------------|--------|
| `lib/workflow/executors/agent.ts` | `server/services/workflowExecutors/agent.ts` | **Expand** — add full agent execution with tool calling |
| `lib/workflow/executors/logic.ts` | `server/services/workflowExecutors/logic.ts` | **Expand** — add if-else + while-loop |
| `lib/workflow/executors/mcp.ts` | `server/services/workflowExecutors/mcp.ts` | **Expand** — add MCP tool execution |
| `lib/workflow/executors/data.ts` | `server/services/workflowExecutors/variables.ts` | **Expand** — add transform/set-state |
| `lib/workflow/executors/extract.ts` | — | **Create** — Firecrawl extract node |
| `lib/workflow/executors/http.ts` | — | **Create** — HTTP request node |
| `lib/workflow/executors/tools.ts` | — | **Create** — Guardrails/file-search node |
| `lib/workflow/executors/arcade.ts` | — | **Create** — Arcade tool node |

### 5.2 Agent Executor (`server/services/workflowExecutors/agent.ts`)

**Current**: Basic 70-line stub.
**Target**: Full agent execution with:
- Multi-turn tool calling loop (max iterations configurable)
- MCP tool integration (Firecrawl, custom MCP servers)
- Model selection (Anthropic, OpenAI, Groq)
- System prompt construction from node instructions
- JSON output schema enforcement
- Variable interpolation in prompts
- Chat history accumulation
- Token usage tracking

### 5.3 Logic Executor (`server/services/workflowExecutors/logic.ts`)

**Current**: 65-line stub.
**Target**: Full logic execution with:
- If-else conditional evaluation (JavaScript expression)
- While-loop with iteration counter, max iterations cap (100), condition expression
- User-approval interrupt handling
- Break/continue routing for loops

### 5.4 MCP Executor (`server/services/workflowExecutors/mcp.ts`)

**Current**: 32-line stub.
**Target**: Full MCP execution with:
- MCP server connection management
- Tool discovery from MCP server
- Tool call execution via MCP protocol
- Firecrawl-specific shortcuts (scrape, search, crawl, extract)
- Custom MCP server support via HTTP/SSE

### 5.5 New Executors

**Transform Executor** (`server/services/workflowExecutors/transform.ts`):
- JavaScript transform function execution
- Input/output mapping
- Variable state access
- Sandboxed execution (consider `vm` module or E2B)

**HTTP Executor** (`server/services/workflowExecutors/http.ts`):
- Configurable HTTP method, URL, headers, body
- Response parsing (JSON, text, binary)
- Status code handling
- Timeout configuration

**Extract Executor** (`server/services/workflowExecutors/extract.ts`):
- Firecrawl extract integration
- Schema-based extraction
- Multi-URL batch extraction

**Tools Executor** (`server/services/workflowExecutors/tools.ts`):
- Guardrails (PII detection, moderation, jailbreak detection)
- File search integration

**Files to create:**
- `server/services/workflowExecutors/transform.ts`
- `server/services/workflowExecutors/http.ts`
- `server/services/workflowExecutors/extract.ts`
- `server/services/workflowExecutors/tools.ts`
- `server/services/workflowExecutors/arcade.ts`

**Files to modify:**
- `server/services/workflowExecutors/agent.ts` — full rewrite
- `server/services/workflowExecutors/logic.ts` — full rewrite
- `server/services/workflowExecutors/mcp.ts` — full rewrite
- `server/services/workflowExecutors/variables.ts` — expand

---

## 8. Phase 4 — Backend: API Routes

**Goal**: Port all Next.js API routes to Express 5 routes under `/api/workflows/`.

### 6.1 Route Mapping

| Open Agent Builder Route | Express Route | Method | Purpose |
|--------------------------|---------------|--------|---------|
| `GET /api/workflows` | `GET /api/workflows` | GET | List all workflows |
| `POST /api/workflows` | `POST /api/workflows` | POST | Create workflow |
| `GET /api/workflows/:id` | `GET /api/workflows/:id` | GET | Get single workflow |
| `PUT /api/workflows/:id` | `PUT /api/workflows/:id` | PUT | Update workflow |
| `DELETE /api/workflows/:id` | `DELETE /api/workflows/:id` | DELETE | Delete workflow |
| `POST /api/workflows/:id/execute` | `POST /api/workflows/:id/execute` | POST | Execute (non-streaming) |
| `POST /api/workflows/:id/execute-stream` | `POST /api/workflows/:id/execute-stream` | POST | Execute with SSE streaming |
| `POST /api/workflows/:id/resume` | `POST /api/workflows/:id/resume` | POST | Resume paused execution |
| `POST /api/workflows/:id/execute-langgraph` | `POST /api/workflows/:id/execute-langgraph` | POST | Execute via engine |
| `GET /api/workflows/:id/export-code` | `GET /api/workflows/:id/export-code` | GET | Export as executable code |
| `GET /api/workflows/:id/export-langgraph` | `GET /api/workflows/:id/export-langgraph` | GET | Export as LangGraph JSON |
| `POST /api/execute-agent` | `POST /api/workflows/execute-agent` | POST | Single agent execution |
| `POST /api/execute-mcp` | `POST /api/workflows/execute-mcp` | POST | Single MCP tool call |
| `POST /api/execute-firecrawl` | `POST /api/workflows/execute-firecrawl` | POST | Firecrawl action |
| `POST /api/execute-extract` | `POST /api/workflows/execute-extract` | POST | Firecrawl extract |
| `POST /api/execute-guardrails` | `POST /api/workflows/execute-guardrails` | POST | Content moderation |
| `POST /api/approval` | `POST /api/workflows/approval` | POST | Create approval |
| `GET /api/approval/:id` | `GET /api/workflows/approval/:id` | GET | Get approval status |
| `POST /api/approval/:id/resume` | `POST /api/workflows/approval/:id/resume` | POST | Resume after approval |
| `GET /api/config` | `GET /api/workflows/config` | GET | Get available models/providers |
| `GET /api/mcp/registry` | `GET /api/workflows/mcp/registry` | GET | List MCP servers |
| `POST /api/test-mcp-connection` | `POST /api/workflows/mcp/test` | POST | Test MCP connection |
| `POST /api/workflow/execute` | `POST /api/workflows/execute-by-custom-id` | POST | Execute by custom ID |
| `POST /api/workflows/cleanup` | `POST /api/workflows/cleanup` | POST | Clean old executions |
| `POST /api/workflows/import-langgraph` | `POST /api/workflows/import-langgraph` | POST | Import LangGraph JSON |

### 6.2 SSE Streaming Format

The execute-stream endpoint returns Server-Sent Events:

```
event: node-update
data: {"nodeId":"agent-1","status":"running","startedAt":"..."}

event: node-update
data: {"nodeId":"agent-1","status":"completed","output":"...","toolCalls":[...]}

event: state-update
data: {"variables":{...},"nodeResults":{...},"currentNodeId":"transform-1"}

event: pending-auth
data: {"authId":"...","nodeId":"...","toolName":"...","authUrl":"..."}

event: complete
data: {"status":"completed","nodeResults":{...}}

event: error
data: {"error":"...","nodeId":"..."}
```

### 6.3 Implementation

**Files to modify:**
- `server/routes/workflows.ts` — major expansion (currently 163 lines, target ~800 lines)

**Files to create:**
- `server/services/workflowSSE.ts` — SSE streaming helpers for workflow execution

---

## 9. Phase 5 — Backend: MCP Tool Support

**Goal**: Port MCP registry, resolver, and connection testing.

### 7.1 Create `server/services/mcpService.ts`

Port from `lib/mcp/mcp-registry.ts` and `lib/mcp/resolver.ts`:

**Functions:**
- `discoverTools(serverUrl, headers)` — Connect to MCP server and list available tools
- `callTool(serverUrl, toolName, args, headers)` — Execute a tool on an MCP server
- `testConnection(serverUrl, headers)` — Test MCP server connectivity
- `getFirecrawlTools(apiKey)` — Get Firecrawl tool definitions
- `resolveToolCall(toolName, args, context)` — Route tool call to appropriate handler

### 7.2 Firecrawl Integration

The Open Agent Builder has deep Firecrawl integration. Port the Firecrawl-specific tool implementations:
- `scrape(url, options)` — Scrape a URL
- `search(query, options)` — Search the web
- `crawl(url, options)` — Crawl a website
- `extract(urls, schema)` — Structured extraction
- `map(url)` — Sitemap extraction

**Files to create:**
- `server/services/mcpService.ts`
- `server/services/firecrawlService.ts`

---

## 10. Phase 6 — Backend: Approval System

**Goal**: Port human-in-the-loop approval flow.

### 8.1 Approval Flow

1. Workflow encounters a `user-approval` node
2. Engine pauses execution, creates approval record in DB
3. SSE sends `pending-auth` event to frontend
4. Frontend displays approval dialog
5. User approves/rejects via API call
6. Engine resumes execution with approval result

### 8.2 Create Approval Endpoints

```
POST /api/workflows/approval           — Create approval request
GET  /api/workflows/approval/:id       — Get approval status
POST /api/workflows/approval/:id/resume — Resume with approval/rejection
```

### 8.3 Implementation

**Files to modify:**
- `server/db/workflows.ts` — add approval CRUD
- `server/routes/workflows.ts` — add approval endpoints
- `server/services/workflowEngine.ts` — add interrupt/resume support

---

## 11. Phase 7 — Frontend: React Flow Canvas & Node Types

**Goal**: Expand the existing React Flow canvas with all 8 node types and proper visual design.

### 9.1 Node Type Mapping

| Node Type | Open Agent Builder | edward:labs (existing) | Action |
|-----------|-------------------|----------------------|--------|
| Start | `CustomNodes.tsx` (StartNode) | `CustomNode.tsx` (basic) | **Expand** — add input variables config |
| Agent | `CustomNodes.tsx` (AgentNode) | `AgentNode.tsx` | **Expand** — add model, tools, output config |
| MCP Tool | `CustomNodes.tsx` (MCPNode) | `ToolNode.tsx` | **Expand** — add MCP server selection |
| Transform | `CustomNodes.tsx` (TransformNode) | — | **Create** — script editor, input/output mapping |
| If/Else | `CustomNodes.tsx` (IfElseNode) | — | **Create** — condition editor, true/false handles |
| While Loop | `CustomNodes.tsx` (WhileNode) | — | **Create** — condition + max iterations |
| User Approval | `CustomNodes.tsx` (ApprovalNode) | — | **Create** — approval message config |
| End | `CustomNodes.tsx` (EndNode) | — | **Create** — output format selection |
| Note | `CustomNodes.tsx` (NoteNode) | — | **Create** — sticky note (visual only) |

### 9.2 Custom Node Components

**Files to modify:**
- `components/agent-builder/CustomNode.tsx` — expand with all node types
- `components/agent-builder/AgentNode.tsx` — full agent node with model/tools
- `components/agent-builder/ToolNode.tsx` — full MCP tool node

**Files to create:**
- `components/agent-builder/nodes/TransformNode.tsx`
- `components/agent-builder/nodes/IfElseNode.tsx`
- `components/agent-builder/nodes/WhileNode.tsx`
- `components/agent-builder/nodes/ApprovalNode.tsx`
- `components/agent-builder/nodes/EndNode.tsx`
- `components/agent-builder/nodes/NoteNode.tsx`
- `components/agent-builder/nodes/StartNode.tsx`
- `components/agent-builder/nodes/MCPNode.tsx`

### 9.3 Canvas Enhancements

Port from `WorkflowBuilder.tsx` (2008 lines):
- Drag-and-drop node creation from sidebar palette
- Edge connection with source/target handle validation
- Conditional edge labels (true/false, continue/break)
- Multi-select and bulk operations
- Zoom/pan controls
- Mini-map
- Auto-layout algorithm
- Keyboard shortcuts (Delete, Ctrl+Z, Ctrl+C/V)

**Files to modify:**
- `components/agent-builder/WorkflowCanvas.tsx` — major expansion
- `components/agent-builder/AgentBuilderCanvas.tsx` — integrate new features

---

## 12. Phase 8 — Frontend: Node Settings Panels

**Goal**: Port all node configuration panels from the Open Agent Builder.

### 10.1 Panel Mapping

| Panel | Open Agent Builder | edward:labs | Action |
|-------|-------------------|-------------|--------|
| Start Node | `StartNodePanel.tsx` (230 lines) | — | **Create** |
| Agent Settings | `SettingsPanelSimple.tsx` (1313 lines) | `NodeSettingsPanel.tsx` (99 lines) | **Major expand** |
| MCP Tools | `MCPPanel.tsx` (270 lines) | — | **Create** |
| Tools/Guardrails | `ToolsNodePanel.tsx` (670 lines) | — | **Create** |
| Logic (if-else/while) | `LogicNodePanel.tsx` (624 lines) | — | **Create** |
| Data Transform | `DataNodePanel.tsx` (349 lines) | — | **Create** |
| HTTP Request | `HTTPNodePanel.tsx` (343 lines) | — | **Create** |
| Extract | `ExtractNodePanel.tsx` (206 lines) | — | **Create** |
| Note | `NoteNodePanel.tsx` (107 lines) | — | **Create** |
| Output Schema | `OutputSchemaPanel.tsx` (160 lines) | — | **Create** |
| Variable Picker | `VariableReferencePicker.tsx` (234 lines) | `VariablePicker.tsx` (42 lines) | **Expand** |
| Node Arguments | `NodeArgumentsPanel.tsx` (205 lines) | — | **Create** |
| Node I/O Badges | `NodeIOBadges.tsx` (68 lines) | — | **Create** |
| Universal Output | `UniversalOutputSelector.tsx` (181 lines) | — | **Create** |

### 10.2 Implementation

**Files to create:**
- `components/agent-builder/panels/StartNodePanel.tsx`
- `components/agent-builder/panels/AgentSettingsPanel.tsx`
- `components/agent-builder/panels/MCPToolsPanel.tsx`
- `components/agent-builder/panels/ToolsPanel.tsx`
- `components/agent-builder/panels/LogicPanel.tsx`
- `components/agent-builder/panels/TransformPanel.tsx`
- `components/agent-builder/panels/HTTPPanel.tsx`
- `components/agent-builder/panels/ExtractPanel.tsx`
- `components/agent-builder/panels/NotePanel.tsx`
- `components/agent-builder/panels/OutputSchemaPanel.tsx`
- `components/agent-builder/panels/NodeArgumentsPanel.tsx`
- `components/agent-builder/panels/NodeIOBadges.tsx`
- `components/agent-builder/panels/UniversalOutputSelector.tsx`

**Files to modify:**
- `components/agent-builder/NodeSettingsPanel.tsx` — route to correct panel by node type
- `components/agent-builder/VariablePicker.tsx` — full variable reference picker

---

## 13. Phase 9 — Frontend: Execution Panel & Streaming

**Goal**: Port the real-time execution visualization and SSE streaming.

### 11.1 Execution Panel

Port from `ExecutionPanel.tsx` (1289 lines):
- Real-time node status indicators (pending → running → completed/failed)
- Execution timeline with node-by-node progress
- Node output preview (expandable)
- Tool call visualization (name, args, output)
- Error display with stack traces
- Approval request handling (approve/reject buttons)
- Execution history list
- Re-run capability

**Files to modify:**
- `components/agent-builder/ExecutionPanel.tsx` — major expansion (currently 88 lines)

### 11.2 SSE Streaming Hook

Port from `hooks/useWorkflowExecution.ts` (428 lines):

```typescript
function useWorkflowExecution() {
  // State
  const [execution, setExecution] = useState<ExecutionState | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);

  // Actions
  const execute = async (workflowId: string, input: any) => { /* SSE connection */ };
  const resume = async (executionId: string, approved: boolean) => { /* Resume after approval */ };
  const cancel = () => { /* Abort SSE connection */ };

  return { execution, isStreaming, pendingApproval, execute, resume, cancel };
}
```

### 11.3 Approval Watch Hook

Port from `hooks/useApprovalWatch.ts` (132 lines):

```typescript
function useApprovalWatch(executionId: string | null) {
  // Polls for pending approvals
  // Returns { pendingApproval, approve, reject }
}
```

**Files to create:**
- `components/agent-builder/hooks/useApprovalWatch.ts`

**Files to modify:**
- `components/agent-builder/useWorkflowExecution.ts` — full rewrite with SSE
- `components/agent-builder/ExecutionPanel.tsx` — full rewrite

---

## 14. Phase 10 — Frontend: Hooks & State Management

**Goal**: Port all workflow-related hooks.

### 12.1 Workflow CRUD Hook

Port from `hooks/useWorkflow.ts` (342 lines):

```typescript
function useWorkflow(workflowId?: string) {
  // CRUD operations
  const save = async (workflow: Workflow) => { /* PUT /api/workflows/:id */ };
  const create = async (data: Partial<Workflow>) => { /* POST /api/workflows */ };
  const remove = async () => { /* DELETE /api/workflows/:id */ };
  const duplicate = async () => { /* POST /api/workflows (copy) */ };

  // State
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  return { workflow, setWorkflow, save, create, remove, duplicate, isDirty, isSaving };
}
```

### 12.2 Node Palette Hook

```typescript
function useNodePalette() {
  // Available node types for drag-and-drop
  const nodeTypes = [
    { type: 'start', label: 'Start', icon: 'play', category: 'flow' },
    { type: 'agent', label: 'Agent', icon: 'bot', category: 'ai' },
    { type: 'mcp', label: 'MCP Tool', icon: 'wrench', category: 'tools' },
    { type: 'transform', label: 'Transform', icon: 'code', category: 'data' },
    { type: 'if-else', label: 'If/Else', icon: 'git-branch', category: 'flow' },
    { type: 'while', label: 'While Loop', icon: 'repeat', category: 'flow' },
    { type: 'user-approval', label: 'Approval', icon: 'shield', category: 'flow' },
    { type: 'end', label: 'End', icon: 'square', category: 'flow' },
    { type: 'note', label: 'Note', icon: 'sticky-note', category: 'misc' },
  ];
  return { nodeTypes };
}
```

### 12.3 Auto-Save Hook

```typescript
function useAutoSave(workflow: Workflow | null, isDirty: boolean, save: () => Promise<void>) {
  // Debounced auto-save every 5 seconds after changes
}
```

**Files to modify:**
- `components/agent-builder/useWorkflow.ts` — full rewrite
- `components/agent-builder/useWorkflowExecution.ts` — full rewrite
- `components/agent-builder/hooks/useAgentBuilder.ts` — expand with new state

**Files to create:**
- `components/agent-builder/hooks/useNodePalette.ts`
- `components/agent-builder/hooks/useAutoSave.ts`
- `components/agent-builder/hooks/useApprovalWatch.ts`

---

## 15. Phase 11 — Frontend: Templates & Import/Export

**Goal**: Port template system and LangGraph import/export.

### 13.1 Templates

Port from `lib/workflow/templates.ts` and `lib/workflow/templates/examples/`:

**Built-in templates:**
1. Simple Web Scraper — Start → Firecrawl Scrape → Agent Summary → End
2. Agent with Firecrawl — Start → Agent (with Firecrawl MCP) → End
3. Multi-Page Research — Start → Firecrawl Search → While Loop (Scrape) → Agent Synthesis → End
4. Competitive Analysis — Start → Parse Companies → Loop (Research + Extract) → Approval → End
5. Price Monitoring — Start → Loop (Scrape + Extract Price) → Compare → Notify → End
6. Content Pipeline — Start → Search → Extract → Transform → End

### 13.2 Import/Export

**Export formats:**
- LangGraph JSON (interoperable format)
- Executable TypeScript code
- Workflow JSON (native format)

**Import sources:**
- LangGraph JSON
- Workflow JSON file
- Paste JSON configuration

### 13.3 UI Components

**Files to create:**
- `components/agent-builder/TemplateGallery.tsx` — template selection grid
- `components/agent-builder/ImportModal.tsx` — import workflow dialog
- `components/agent-builder/ExportModal.tsx` — export format selection
- `components/agent-builder/SaveAsTemplateModal.tsx` — save workflow as template

**Files to create (backend):**
- `server/services/workflowTemplates.ts` — template definitions + CRUD

---

## 16. Phase 12 — Integration & Polish

### 14.1 App.tsx Integration

The `/agent-builder` route already exists in `App.tsx`. Ensure:
- Password gate uses `shepherdofmysoul` / `edward:labs_agent-builder_session` ✅
- `AgentBuilderMode` component is properly mounted ✅
- Sidebar shows workflow list + MCP server management
- Header shows workflow name, save status, run button

### 14.2 Missing npm Dependencies

Add to `package.json` (server-side only):

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.20.0",
    "@mendable/firecrawl-js": "^3.0.3"
  }
}
```

**Note**: `@xyflow/react` (React Flow) is already in the Open Agent Builder's dependencies. Check if edward:labs already has it; if not, add it.

### 14.3 Settings Integration

Add to `SettingsPage.tsx`:
- **API Keys** section: Anthropic, OpenAI, Groq, Firecrawl, Arcade keys
- **MCP Registry** section: Add/edit/test MCP servers

### 14.4 Environment Variables

Add to `.env.example`:
```bash
# Agent Builder (optional - users can add via Settings)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
FIRECRAWL_API_KEY=
ARCADE_API_KEY=
```

---

## 17. Dependency Matrix

| Phase | Depends On | Blocks |
|-------|-----------|--------|
| 1. Database Schema | — | 2, 3, 4, 5, 6, 8 |
| 2. Execution Engine | 1 | 4, 6, 9 |
| 3. Node Executors | 1 | 2, 4 |
| 4. API Routes | 1, 2, 3 | 9, 10, 11 |
| 5. MCP Support | 1 | 3 |
| 6. Approval System | 1, 2 | 9, 10 |
| 7. Canvas & Nodes | — | 8, 9, 10 |
| 8. Node Settings Panels | 7 | 9, 10 |
| 9. Execution Panel | 2, 4, 7 | 11 |
| 10. Hooks & State | 4, 7 | 11 |
| 11. Templates & Import/Export | 2, 4, 7 | 12 |
| 12. Integration & Polish | All | — |

**Critical path:** 1 → 3 → 2 → 4 → 9 → 12

---

## 18. File Manifest

### New Files (to create)

| File | Lines (est.) | Phase |
|------|-------------|-------|
| `server/services/workflowEngine.ts` | 800 | 2 |
| `server/services/workflowExecutors/transform.ts` | 80 | 3 |
| `server/services/workflowExecutors/http.ts` | 100 | 3 |
| `server/services/workflowExecutors/extract.ts` | 120 | 3 |
| `server/services/workflowExecutors/tools.ts` | 150 | 3 |
| `server/services/workflowExecutors/arcade.ts` | 100 | 3 |
| `server/services/mcpService.ts` | 250 | 5 |
| `server/services/firecrawlService.ts` | 150 | 5 |
| `server/services/workflowSSE.ts` | 100 | 4 |
| `server/services/workflowTemplates.ts` | 300 | 11 |
| `components/agent-builder/nodes/StartNode.tsx` | 80 | 7 |
| `components/agent-builder/nodes/MCPNode.tsx` | 100 | 7 |
| `components/agent-builder/nodes/TransformNode.tsx` | 80 | 7 |
| `components/agent-builder/nodes/IfElseNode.tsx` | 120 | 7 |
| `components/agent-builder/nodes/WhileNode.tsx` | 100 | 7 |
| `components/agent-builder/nodes/ApprovalNode.tsx` | 80 | 7 |
| `components/agent-builder/nodes/EndNode.tsx` | 60 | 7 |
| `components/agent-builder/nodes/NoteNode.tsx` | 60 | 7 |
| `components/agent-builder/panels/StartNodePanel.tsx` | 200 | 8 |
| `components/agent-builder/panels/AgentSettingsPanel.tsx` | 500 | 8 |
| `components/agent-builder/panels/MCPToolsPanel.tsx` | 250 | 8 |
| `components/agent-builder/panels/ToolsPanel.tsx` | 300 | 8 |
| `components/agent-builder/panels/LogicPanel.tsx` | 300 | 8 |
| `components/agent-builder/panels/TransformPanel.tsx` | 200 | 8 |
| `components/agent-builder/panels/HTTPPanel.tsx` | 200 | 8 |
| `components/agent-builder/panels/ExtractPanel.tsx` | 150 | 8 |
| `components/agent-builder/panels/NotePanel.tsx` | 80 | 8 |
| `components/agent-builder/panels/OutputSchemaPanel.tsx` | 120 | 8 |
| `components/agent-builder/panels/NodeArgumentsPanel.tsx` | 150 | 8 |
| `components/agent-builder/panels/NodeIOBadges.tsx` | 60 | 8 |
| `components/agent-builder/panels/UniversalOutputSelector.tsx` | 150 | 8 |
| `components/agent-builder/TemplateGallery.tsx` | 200 | 11 |
| `components/agent-builder/ImportModal.tsx` | 150 | 11 |
| `components/agent-builder/ExportModal.tsx` | 150 | 11 |
| `components/agent-builder/SaveAsTemplateModal.tsx` | 200 | 11 |
| `components/agent-builder/hooks/useNodePalette.ts` | 50 | 10 |
| `components/agent-builder/hooks/useAutoSave.ts` | 60 | 10 |
| `components/agent-builder/hooks/useApprovalWatch.ts` | 100 | 10 |

### Existing Files (to modify)

| File | Current Lines | Target Lines | Phase |
|------|--------------|-------------|-------|
| `server/db/schema.ts` | 381 | ~420 | 1 |
| `server/db/workflows.ts` | 158 | ~400 | 1 |
| `server/routes/workflows.ts` | 163 | ~800 | 4 |
| `server/services/workflowExecutor.ts` | 245 | ~100 (delegate to engine) | 2 |
| `server/services/workflowExecutors/agent.ts` | 70 | ~300 | 3 |
| `server/services/workflowExecutors/logic.ts` | 65 | ~200 | 3 |
| `server/services/workflowExecutors/mcp.ts` | 32 | ~150 | 3 |
| `server/services/workflowExecutors/variables.ts` | 16 | ~80 | 3 |
| `components/agent-builder/CustomNode.tsx` | 79 | ~200 | 7 |
| `components/agent-builder/AgentNode.tsx` | 42 | ~120 | 7 |
| `components/agent-builder/ToolNode.tsx` | 41 | ~100 | 7 |
| `components/agent-builder/WorkflowCanvas.tsx` | 157 | ~400 | 7 |
| `components/agent-builder/AgentBuilderCanvas.tsx` | 251 | ~350 | 7 |
| `components/agent-builder/NodeSettingsPanel.tsx` | 99 | ~200 | 8 |
| `components/agent-builder/VariablePicker.tsx` | 42 | ~200 | 8 |
| `components/agent-builder/ExecutionPanel.tsx` | 88 | ~500 | 9 |
| `components/agent-builder/useWorkflow.ts` | 47 | ~300 | 10 |
| `components/agent-builder/useWorkflowExecution.ts` | 86 | ~350 | 10 |
| `components/agent-builder/hooks/useAgentBuilder.ts` | 217 | ~350 | 10 |
| `components/agent-builder/types.ts` | 169 | ~250 | 7 |
| `components/agent-builder/constants.ts` | 34 | ~80 | 7 |

### Estimated Total

| Category | New Files | Modified Files | Total New Lines |
|----------|-----------|---------------|-----------------|
| Backend (server/) | 10 | 10 | ~2,600 |
| Frontend (components/) | 27 | 11 | ~4,300 |
| **Total** | **37** | **21** | **~6,900** |

---

## Implementation Order (Recommended)

```
Sprint 1 (Foundation):
  ├── Phase 1: Database schema + CRUD
  ├── Phase 3: Node executors (expand existing)
  └── Phase 5: MCP service

Sprint 2 (Engine):
  ├── Phase 2: Workflow execution engine
  ├── Phase 4: API routes (expand)
  └── Phase 6: Approval system

Sprint 3 (Frontend Core):
  ├── Phase 7: Canvas + all node types
  └── Phase 8: Node settings panels

Sprint 4 (Frontend Polish):
  ├── Phase 9: Execution panel + SSE streaming
  ├── Phase 10: Hooks + state management
  └── Phase 11: Templates + import/export

Sprint 5 (Integration):
  └── Phase 12: Integration, testing, polish
```
