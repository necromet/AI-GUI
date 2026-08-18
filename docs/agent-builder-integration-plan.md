# Agent Builder Integration Plan — Open Agent Builder → edward:labs

## Overview

Port the [Open Agent Builder](https://github.com/firecrawl/open-agent-builder) visual workflow engine into edward:labs as a new top-level mode called **Agent Builder**. This adds a drag-and-drop canvas for building multi-step AI agent workflows with LangGraph execution, MCP tool support, human-in-the-loop approvals, and real-time SSE streaming.

---

## Architecture Mapping

| Layer | Open Agent Builder | edward:labs Port |
|-------|-------------------|------------------|
| Framework | Next.js 16 (App Router) | Vite + React 19 SPA |
| API Routes | Next.js `app/api/` | Express 5 `server/routes/` |
| Database | Convex (real-time) | PostgreSQL (`pg` pool) |
| Auth | Clerk + API keys | Existing password system (triple-lock) |
| Canvas | `@xyflow/react` v12 | Same — install as dependency |
| Execution | LangGraph (`@langchain/langgraph`) | Same — server-side in Express |
| LLM | Anthropic/OpenAI/Groq SDKs | Same + existing MiMo integration |
| MCP | `@modelcontextprotocol/sdk` | Same — install as dependency |
| State | Jotai (minimal) + React state | React state + context |
| Streaming | Next.js Response SSE | Express `res.write()` SSE (existing pattern) |
| Real-time DB | Convex subscriptions | Poll or PostgreSQL NOTIFY/LISTEN |
| Sandbox | E2B code interpreter | `vm.runInNewContext` (existing pattern) |

---

## New Dependencies

```bash
npm install @xyflow/react @langchain/langgraph @langchain/core @langchain/openai @anthropic-ai/sdk @modelcontextprotocol/sdk zod
```

Optional (for Firecrawl MCP):
```bash
npm install @mendable/firecrawl-js
```

---

## New Files

### Frontend (15 files)

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `components/agent-builder/AgentBuilderMode.tsx` | ~80 | Top-level mode container (like SkemaPanel) |
| `components/agent-builder/WorkflowCanvas.tsx` | ~400 | ReactFlow canvas with nodes, edges, drag-drop |
| `components/agent-builder/CustomNode.tsx` | ~200 | Single node component for all workflow node types |
| `components/agent-builder/WorkflowSidebar.tsx` | ~150 | Left sidebar: node palette + drag-to-add |
| `components/agent-builder/NodeSettingsPanel.tsx` | ~350 | Right panel: node-type-specific settings |
| `components/agent-builder/ExecutionPanel.tsx` | ~250 | Bottom panel: run workflow + live results |
| `components/agent-builder/WorkflowToolbar.tsx` | ~100 | Top toolbar: name, save, run, export |
| `components/agent-builder/types.ts` | ~80 | WorkflowNode, WorkflowEdge, Workflow types |
| `components/agent-builder/constants.ts` | ~60 | Node type definitions, colors, icons |
| `components/agent-builder/useWorkflow.ts` | ~150 | Workflow CRUD via REST API |
| `components/agent-builder/useWorkflowExecution.ts` | ~200 | SSE streaming execution hook |
| `components/agent-builder/VariablePicker.tsx` | ~100 | `{{variable}}` reference picker |
| `components/agent-builder/node-panels/AgentPanel.tsx` | ~150 | Agent node settings (model, prompt, tools) |
| `components/agent-builder/node-panels/MCPPanel.tsx` | ~120 | MCP tool node settings |
| `components/agent-builder/node-panels/LogicPanel.tsx` | ~100 | If/Else + While loop settings |

### Backend (5 files)

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `server/routes/workflows.ts` | ~300 | CRUD for workflows + executions |
| `server/services/workflowExecutor.ts` | ~500 | LangGraphExecutor — converts workflow to StateGraph |
| `server/services/workflowExecutors/agent.ts` | ~250 | Agent node executor (LLM + MCP tools) |
| `server/services/workflowExecutors/logic.ts` | ~150 | If/Else, While, Transform executors |
| `server/services/workflowExecutors/mcp.ts` | ~150 | MCP tool execution |

### Database (2 files)

| File | Purpose |
|------|---------|
| `server/db/workflows.ts` | PostgreSQL CRUD for workflows, executions, mcp_servers |
| DDL additions to `server/db/schema.ts` | 5 new tables |

---

## Modified Files

| File | Change |
|------|--------|
| `types.ts` | Add `'agent-builder'` to mode types |
| `App.tsx` | Add Agent Builder route + mode selector entry |
| `components/ModeSelector.tsx` | Add Agent Builder mode card |
| `server/index.ts` | Mount workflow routes |
| `server/db/schema.ts` | Add workflow tables DDL |
| `src/globals.css` | ReactFlow dark theme overrides |
| `lib/agentConfig.ts` | Add workflow agent tool info |

---

## Database Schema (PostgreSQL)

Add to `server/db/schema.ts`:

```sql
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  custom_id TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT 'Untitled Workflow',
  description TEXT,
  category TEXT DEFAULT 'custom',
  tags TEXT DEFAULT '[]',
  nodes TEXT NOT NULL DEFAULT '[]',
  edges TEXT NOT NULL DEFAULT '[]',
  is_template INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  current_node_id TEXT,
  node_results TEXT NOT NULL DEFAULT '{}',
  variables TEXT NOT NULL DEFAULT '{}',
  input TEXT,
  output TEXT,
  error TEXT,
  thread_id TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'custom',
  auth_type TEXT DEFAULT 'none',
  access_token TEXT,
  tools TEXT DEFAULT '[]',
  connection_status TEXT DEFAULT 'untested',
  enabled INTEGER NOT NULL DEFAULT 1,
  is_official INTEGER NOT NULL DEFAULT 0,
  headers TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  approval_id TEXT UNIQUE NOT NULL,
  workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,
  execution_id TEXT,
  node_id TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT
);

CREATE TABLE IF NOT EXISTS user_llm_keys (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_prefix TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workflows_custom_id ON workflows(custom_id);
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_approval_id ON approvals(approval_id);
```

---

## Implementation Phases

### Phase 1: Core Types + Database (Day 1)

#### 1a. Install dependencies

```bash
npm install @xyflow/react @langchain/langgraph @langchain/core @langchain/openai @anthropic-ai/sdk @modelcontextprotocol/sdk zod
```

#### 1b. Create workflow types (`components/agent-builder/types.ts`)

```typescript
export type NodeType = 
  | 'start' | 'end' 
  | 'agent' | 'mcp' 
  | 'if-else' | 'while' | 'user-approval'
  | 'transform' | 'set-state'
  | 'extract' | 'http' | 'note';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, any>;
  label?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
  animated?: boolean;
}

export interface Workflow {
  id: string;
  customId?: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isTemplate: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: 'running' | 'completed' | 'failed';
  output?: any;
  error?: string;
  startedAt: string;
  completedAt?: string;
  toolCalls?: Array<{ name: string; input: any; output?: any }>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentNodeId?: string;
  nodeResults: Record<string, NodeExecutionResult>;
  variables: Record<string, any>;
  input?: any;
  output?: any;
  error?: string;
  threadId?: string;
  startedAt: string;
  completedAt?: string;
}
```

#### 1c. Add DDL to `server/db/schema.ts`

Append the 5 `CREATE TABLE` statements above to the `SCHEMA_SQL` constant.

#### 1d. Create DB module (`server/db/workflows.ts`)

```typescript
import { getDatabase } from './index';

export function getWorkflows() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM workflows ORDER BY updated_at DESC').all();
}

export function getWorkflow(id: string) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM workflows WHERE id = ? OR custom_id = ?').get(id, id);
}

export function createWorkflow(data: { name: string; nodes: string; edges: string }) {
  const db = getDatabase();
  const id = 'wf_' + Math.random().toString(36).slice(2, 10);
  db.prepare(
    'INSERT INTO workflows (id, custom_id, name, nodes, edges) VALUES (?, ?, ?, ?, ?)'
  ).run(id, id, data.name, data.nodes, data.edges);
  return getWorkflow(id);
}

export function updateWorkflow(id: string, data: Partial<{ name: string; nodes: string; edges: string; description: string }>) {
  const db = getDatabase();
  const sets: string[] = [];
  const params: any[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.nodes !== undefined) { sets.push('nodes = ?'); params.push(data.nodes); }
  if (data.edges !== undefined) { sets.push('edges = ?'); params.push(data.edges); }
  if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
  sets.push("updated_at = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE workflows SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getWorkflow(id);
}

export function deleteWorkflow(id: string) {
  const db = getDatabase();
  db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
}

export function createExecution(data: { workflowId: string; input?: string }) {
  const db = getDatabase();
  const id = 'exec_' + Math.random().toString(36).slice(2, 10);
  db.prepare(
    'INSERT INTO executions (id, workflow_id, input) VALUES (?, ?, ?)'
  ).run(id, data.workflowId, data.input || '{}');
  return id;
}

export function updateExecution(id: string, data: Record<string, any>) {
  const db = getDatabase();
  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, val] of Object.entries(data)) {
    sets.push(`${key} = ?`);
    params.push(typeof val === 'object' ? JSON.stringify(val) : val);
  }
  params.push(id);
  db.prepare(`UPDATE executions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export function getExecution(id: string) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM executions WHERE id = ?').get(id);
}

export function getMCPServers() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM mcp_servers WHERE enabled = 1').all();
}

export function getMCPServer(id: string) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id);
}

export function createApproval(data: { approvalId: string; workflowId: string; executionId: string; nodeId: string; message: string }) {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO approvals (id, approval_id, workflow_id, execution_id, node_id, message) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(data.approvalId, data.approvalId, data.workflowId, data.executionId, data.nodeId, data.message);
}

export function getApproval(approvalId: string) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM approvals WHERE approval_id = ?').get(approvalId);
}

export function respondApproval(approvalId: string, status: 'approved' | 'rejected') {
  const db = getDatabase();
  db.prepare(
    "UPDATE approvals SET status = ?, responded_at = datetime('now') WHERE approval_id = ?"
  ).run(status, approvalId);
}
```

---

### Phase 2: Workflow Executor Engine (Days 2-4)

#### 2a. Core executor (`server/services/workflowExecutor.ts`)

This is the heart of the system — converts a workflow graph into a LangGraph `StateGraph` and executes it.

```typescript
import { StateGraph, Annotation, START, END, MemorySaver } from '@langchain/langgraph';
import { executeAgentNode } from './workflowExecutors/agent';
import { executeTransformNode, executeIfElseNode, executeWhileNode, executeUserApprovalNode } from './workflowExecutors/logic';
import { executeMCPNode } from './workflowExecutors/mcp';
import { substituteVariables } from './workflowExecutors/variables';
import type { WorkflowNode, WorkflowEdge, NodeExecutionResult } from '../../components/agent-builder/types';

const WorkflowStateAnnotation = Annotation.Root({
  variables: Annotation<Record<string, any>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  chatHistory: Annotation<Array<{ role: string; content: string }>>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  currentNodeId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  nodeResults: Annotation<Record<string, NodeExecutionResult>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  pendingAuth: Annotation<any>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  loopResults: Annotation<any[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type WorkflowState = typeof WorkflowStateAnnotation.State;

interface ExecutorOptions {
  onNodeUpdate?: (nodeId: string, status: string, data?: any) => void;
  llmKeys?: Record<string, string>;
  threadId?: string;
  executionId?: string;
}

export class WorkflowExecutor {
  private nodes: WorkflowNode[];
  private edges: WorkflowEdge[];
  private options: ExecutorOptions;

  constructor(nodes: WorkflowNode[], edges: WorkflowEdge[], options: ExecutorOptions = {}) {
    this.nodes = nodes;
    this.edges = edges;
    this.options = options;
  }

  async *executeStream(input: Record<string, any> = {}) {
    const graph = this.buildGraph();
    const checkpointer = new MemorySaver();
    const compiled = graph.compile({ checkpointer });

    const config = {
      configurable: { thread_id: this.options.threadId || `thread_${Date.now()}` },
    };

    const initialState: Partial<WorkflowState> = {
      variables: { input },
      currentNodeId: '',
      nodeResults: {},
      chatHistory: [],
      pendingAuth: null,
      loopResults: [],
    };

    try {
      const stream = await compiled.stream(initialState, {
        ...config,
        streamMode: 'updates',
      });

      for await (const chunk of stream) {
        for (const [nodeName, update] of Object.entries(chunk)) {
          if (nodeName === '__start__' || nodeName === '__end__') continue;

          const state = update as Partial<WorkflowState>;
          if (state.currentNodeId) {
            this.options.onNodeUpdate?.(state.currentNodeId, 'running');
          }
          if (state.nodeResults) {
            for (const [nodeId, result] of Object.entries(state.nodeResults)) {
              this.options.onNodeUpdate?.(nodeId, result.status, result);
            }
          }
          if (state.pendingAuth) {
            yield { type: 'paused', pendingAuth: state.pendingAuth };
            return;
          }

          yield { type: 'state_update', state };
        }
      }

      yield { type: 'completed' };
    } catch (err: any) {
      yield { type: 'error', error: err.message };
    }
  }

  private buildGraph() {
    const graph = new StateGraph(WorkflowStateAnnotation);

    // Add each node as a graph node
    for (const node of this.nodes) {
      graph.addNode(node.id, this.createNodeExecutor(node));
    }

    // Add edges
    const startNode = this.nodes.find(n => n.type === 'start');
    const endNodes = this.nodes.filter(n => n.type === 'end');

    if (startNode) {
      const startTargets = this.edges.filter(e => e.source === startNode.id);
      for (const edge of startTargets) {
        graph.addEdge(START, edge.target);
      }
    }

    // Group edges by source
    const edgesBySource = new Map<string, WorkflowEdge[]>();
    for (const edge of this.edges) {
      if (!edgesBySource.has(edge.source)) edgesBySource.set(edge.source, []);
      edgesBySource.get(edge.source)!.push(edge);
    }

    for (const node of this.nodes) {
      if (node.type === 'end') continue;
      const outEdges = edgesBySource.get(node.id) || [];

      if (outEdges.length === 0) {
        graph.addEdge(node.id, END);
      } else if (node.type === 'if-else') {
        // Conditional routing
        graph.addConditionalEdges(
          node.id,
          (state: WorkflowState) => {
            const result = state.nodeResults[node.id];
            if (result?.output?.branch === 'else') return 'else';
            return 'if';
          },
          {
            if: outEdges.find(e => e.sourceHandle === 'if')?.target || END,
            else: outEdges.find(e => e.sourceHandle === 'else')?.target || END,
          }
        );
      } else if (node.type === 'while') {
        graph.addConditionalEdges(
          node.id,
          (state: WorkflowState) => {
            const result = state.nodeResults[node.id];
            if (result?.output?.shouldContinue) return 'continue';
            return 'break';
          },
          {
            continue: outEdges.find(e => e.sourceHandle === 'continue')?.target || END,
            break: outEdges.find(e => e.sourceHandle === 'break')?.target || END,
          }
        );
      } else if (outEdges.length === 1) {
        graph.addEdge(node.id, outEdges[0].target);
      } else {
        // Parallel edges — go to first (simplified)
        graph.addEdge(node.id, outEdges[0].target);
      }
    }

    return graph;
  }

  private createNodeExecutor(node: WorkflowNode) {
    return async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
      this.options.onNodeUpdate?.(node.id, 'running');

      const startTime = new Date().toISOString();
      let result: NodeExecutionResult;

      try {
        let output: any;

        switch (node.type) {
          case 'start':
            output = { message: 'Workflow started', input: state.variables.input };
            break;
          case 'end':
            output = { message: 'Workflow completed', finalOutput: state.variables };
            break;
          case 'agent':
            output = await executeAgentNode(node.data, state, this.options.llmKeys || {});
            break;
          case 'mcp':
            output = await executeMCPNode(node.data, state, this.options.llmKeys || {});
            break;
          case 'transform':
            output = await executeTransformNode(node.data, state);
            break;
          case 'if-else':
            output = await executeIfElseNode(node.data, state);
            break;
          case 'while':
            output = await executeWhileNode(node.data, state);
            break;
          case 'user-approval':
            output = await executeUserApprovalNode(node.data, state);
            break;
          default:
            output = { message: `Node ${node.type} not implemented` };
        }

        result = {
          nodeId: node.id,
          status: 'completed',
          output,
          startedAt: startTime,
          completedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        result = {
          nodeId: node.id,
          status: 'failed',
          error: err.message,
          startedAt: startTime,
          completedAt: new Date().toISOString(),
        };
      }

      this.options.onNodeUpdate?.(node.id, result.status, result);

      const updates: Partial<WorkflowState> = {
        currentNodeId: node.id,
        nodeResults: { [node.id]: result },
      };

      // Check for pending approval
      if (result.output?.__pendingApproval) {
        updates.pendingAuth = result.output;
      }

      // Extract agent chat history updates
      if (result.output?.__chatHistoryUpdates) {
        updates.chatHistory = result.output.__chatHistoryUpdates;
      }

      return updates;
    };
  }
}
```

#### 2b. Agent executor (`server/services/workflowExecutors/agent.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export async function executeAgentNode(
  data: Record<string, any>,
  state: any,
  llmKeys: Record<string, string>
) {
  const { model, systemPrompt, userPrompt, maxTokens, temperature, tools } = data;

  const resolvedPrompt = substituteVariables(systemPrompt || '', state);
  const resolvedUser = substituteVariables(userPrompt || '', state);

  const provider = detectProvider(model);

  if (provider === 'anthropic') {
    return executeAnthropic(model, resolvedPrompt, resolvedUser, llmKeys, data);
  } else {
    return executeOpenAI(model, resolvedPrompt, resolvedUser, llmKeys, data);
  }
}

function detectProvider(model: string): 'anthropic' | 'openai' | 'groq' {
  if (model?.startsWith('claude')) return 'anthropic';
  if (model?.startsWith('gpt') || model?.startsWith('o1') || model?.startsWith('o3')) return 'openai';
  return 'openai'; // default
}

async function executeAnthropic(model: string, system: string, user: string, keys: any, data: any) {
  const client = new Anthropic({ apiKey: keys.anthropic || process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageCreateParams['messages'] = [
    { role: 'user', content: user },
  ];

  const response = await client.messages.create({
    model: model || 'claude-sonnet-4-20250514',
    max_tokens: data.maxTokens || 4096,
    system,
    messages,
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return {
    response: textBlock?.text || '',
    usage: response.usage,
    model: response.model,
  };
}

async function executeOpenAI(model: string, system: string, user: string, keys: any, data: any) {
  const client = new OpenAI({ apiKey: keys.openai || process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: model || 'gpt-4o',
    max_tokens: data.maxTokens || 4096,
    temperature: data.temperature ?? 0.7,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  return {
    response: response.choices[0]?.message?.content || '',
    usage: response.usage,
    model: response.model,
  };
}

function substituteVariables(template: string, state: any): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const parts = path.trim().split('.');
    let value: any = state;
    for (const part of parts) {
      if (value === undefined || value === null) return match;
      // Handle array indexing
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        value = value[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
      } else {
        value = value[part];
      }
    }
    return typeof value === 'string' ? value : JSON.stringify(value ?? match);
  });
}
```

#### 2c. Logic executors (`server/services/workflowExecutors/logic.ts`)

```typescript
export async function executeTransformNode(data: Record<string, any>, state: any) {
  const { code } = data;
  if (!code) return { output: state.variables };

  // Use vm.runInNewContext (existing pattern in edward:labs)
  const vm = require('vm');
  const sandbox = {
    input: state.variables,
    lastOutput: state.variables.lastOutput,
    ...state.variables,
  };

  try {
    vm.createContext(sandbox);
    const result = vm.runInNewContext(code, sandbox, { timeout: 5000 });
    return { output: result };
  } catch (err: any) {
    throw new Error(`Transform error: ${err.message}`);
  }
}

export async function executeIfElseNode(data: Record<string, any>, state: any) {
  const { condition } = data;
  if (!condition) return { branch: 'if' };

  const resolved = substituteVariables(condition, state);

  try {
    const result = new Function('state', `return ${resolved}`)(state.variables);
    return { branch: result ? 'if' : 'else', conditionResult: result };
  } catch {
    return { branch: 'else', conditionResult: false };
  }
}

export async function executeWhileNode(data: Record<string, any>, state: any) {
  const { condition, maxIterations } = data;
  const max = maxIterations || 10;
  const currentIteration = (state.nodeResults[data.nodeId]?.output?.iteration || 0) + 1;

  if (currentIteration > max) {
    return { shouldContinue: false, iteration: currentIteration, reason: 'max iterations reached' };
  }

  if (!condition) return { shouldContinue: true, iteration: currentIteration };

  const resolved = substituteVariables(condition, state);
  try {
    const result = new Function('state', `return ${resolved}`)(state.variables);
    return { shouldContinue: !!result, iteration: currentIteration };
  } catch {
    return { shouldContinue: false, iteration: currentIteration };
  }
}

export async function executeUserApprovalNode(data: Record<string, any>, state: any) {
  const approvalId = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    __pendingApproval: true,
    approvalId,
    message: data.message || 'This action requires your approval.',
    nodeId: data.nodeId,
  };
}

function substituteVariables(template: string, state: any): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const parts = path.trim().split('.');
    let value: any = state;
    for (const part of parts) {
      value = value?.[part];
    }
    return typeof value === 'string' ? value : JSON.stringify(value ?? match);
  });
}
```

---

### Phase 3: Express Routes (Day 5)

#### 3a. Workflow routes (`server/routes/workflows.ts`)

```typescript
import { Router } from 'express';
import * as workflowDB from '../db/workflows';
import { WorkflowExecutor } from '../services/workflowExecutor';

const router = Router();

// List workflows
router.get('/', (req, res) => {
  const workflows = workflowDB.getWorkflows();
  res.json(workflows.map(parseWorkflow));
});

// Get single workflow
router.get('/:id', (req, res) => {
  const workflow = workflowDB.getWorkflow(req.params.id);
  if (!workflow) return res.status(404).json({ error: 'Not found' });
  res.json(parseWorkflow(workflow));
});

// Create workflow
router.post('/', (req, res) => {
  const { name, nodes, edges } = req.body;
  const workflow = workflowDB.createWorkflow({
    name: name || 'Untitled Workflow',
    nodes: JSON.stringify(nodes || []),
    edges: JSON.stringify(edges || []),
  });
  res.json(parseWorkflow(workflow));
});

// Update workflow
router.put('/:id', (req, res) => {
  const { name, nodes, edges, description } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (nodes !== undefined) updates.nodes = JSON.stringify(nodes);
  if (edges !== undefined) updates.edges = JSON.stringify(edges);
  if (description !== undefined) updates.description = description;
  const workflow = workflowDB.updateWorkflow(req.params.id, updates);
  if (!workflow) return res.status(404).json({ error: 'Not found' });
  res.json(parseWorkflow(workflow));
});

// Delete workflow
router.delete('/:id', (req, res) => {
  workflowDB.deleteWorkflow(req.params.id);
  res.json({ success: true });
});

// Execute workflow (SSE streaming)
router.post('/:id/execute-stream', async (req, res) => {
  const workflow = workflowDB.getWorkflow(req.params.id);
  if (!workflow) return res.status(404).json({ error: 'Not found' });

  const parsed = parseWorkflow(workflow);
  const executionId = workflowDB.createExecution({ workflowId: workflow.id, input: JSON.stringify(req.body) });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const executor = new WorkflowExecutor(parsed.nodes, parsed.edges, {
    onNodeUpdate: (nodeId, status, data) => {
      res.write(`data: ${JSON.stringify({ type: `node_${status}`, nodeId, data })}\n\n`);
    },
    executionId,
  });

  try {
    for await (const event of executor.executeStream(req.body.input || {})) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      if (event.type === 'completed') {
        workflowDB.updateExecution(executionId, {
          status: 'completed',
          completed_at: new Date().toISOString(),
        });
      } else if (event.type === 'paused') {
        workflowDB.updateExecution(executionId, { status: 'paused' });
      } else if (event.type === 'error') {
        workflowDB.updateExecution(executionId, {
          status: 'failed',
          error: event.error,
          completed_at: new Date().toISOString(),
        });
      }
    }
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    workflowDB.updateExecution(executionId, { status: 'failed', error: err.message });
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

// Resume paused workflow
router.post('/:id/resume', async (req, res) => {
  const { executionId, approved } = req.body;
  const execution = workflowDB.getExecution(executionId);
  if (!execution) return res.status(404).json({ error: 'Execution not found' });

  // Update approval status
  if (execution.thread_id) {
    workflowDB.respondApproval(execution.thread_id, approved ? 'approved' : 'rejected');
  }

  res.json({ success: true, status: approved ? 'approved' : 'rejected' });
});

// MCP servers
router.get('/mcp-servers', (req, res) => {
  const servers = workflowDB.getMCPServers();
  res.json(servers);
});

function parseWorkflow(row: any) {
  return {
    id: row.id,
    customId: row.custom_id,
    name: row.name,
    description: row.description,
    category: row.category,
    tags: row.tags ? JSON.parse(row.tags) : [],
    nodes: JSON.parse(row.nodes),
    edges: JSON.parse(row.edges),
    isTemplate: row.is_template === 1,
    isPublic: row.is_public === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default router;
```

#### 3b. Mount in `server/index.ts`

```typescript
import workflowRoutes from './routes/workflows.js';
app.use('/api/workflows', workflowRoutes);
```

---

### Phase 4: ReactFlow Canvas UI (Days 6-9)

#### 4a. Main canvas component (`components/agent-builder/WorkflowCanvas.tsx`)

```tsx
import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CustomNode from './CustomNode';
import WorkflowSidebar from './WorkflowSidebar';
import NodeSettingsPanel from './NodeSettingsPanel';
import ExecutionPanel from './ExecutionPanel';
import WorkflowToolbar from './WorkflowToolbar';
import { NODE_DEFINITIONS } from './constants';
import type { NodeType, WorkflowNode, WorkflowEdge } from './types';

const nodeTypes = { custom: CustomNode };

interface Props {
  workflowId?: string;
}

function WorkflowCanvasInner({ workflowId }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (!type) return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = {
        x: event.clientX - bounds.left - 75,
        y: event.clientY - bounds.top - 25,
      };

      const def = NODE_DEFINITIONS[type];
      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type: 'custom',
        position,
        data: {
          nodeType: type,
          label: def?.label || type,
          color: def?.color || '#6b7280',
          icon: def?.icon || 'circle',
          ...def?.defaults,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: Record<string, any>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      );
    },
    [setNodes]
  );

  return (
    <div className="flex h-full w-full">
      <WorkflowSidebar />
      <div className="flex-1 flex flex-col">
        <WorkflowToolbar
          name={workflowName}
          onNameChange={setWorkflowName}
          nodes={nodes}
          edges={edges}
          workflowId={workflowId}
        />
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            className="bg-[#09090b]"
          >
            <Background color="rgba(255,255,255,0.03)" gap={20} />
            <Controls className="!bg-[#18181b] !border-[#2a2a30] !text-[#e4e4e8]" />
            <MiniMap
              nodeColor={(n) => n.data?.color || '#6b7280'}
              className="!bg-[#111114] !border-[#2a2a30]"
            />
            <Panel position="bottom-center">
              <ExecutionPanel nodes={nodes} edges={edges} workflowId={workflowId} />
            </Panel>
          </ReactFlow>
        </div>
      </div>
      {selectedNode && (
        <NodeSettingsPanel
          node={selectedNode}
          onUpdate={(data) => updateNodeData(selectedNode.id, data)}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

export default function WorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
```

#### 4b. Custom node component (`components/agent-builder/CustomNode.tsx`)

```tsx
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Play, Square, Bot, Wrench, GitBranch, Repeat,
  UserCheck, Code, FileText, Globe, StickyNote
} from 'lucide-react';

const ICONS: Record<string, any> = {
  start: Play, end: Square, agent: Bot, mcp: Wrench,
  'if-else': GitBranch, while: Repeat, 'user-approval': UserCheck,
  transform: Code, extract: FileText, http: Globe, note: StickyNote,
};

function CustomNode({ data, selected }: NodeProps) {
  const { nodeType, label, color, executing, completed, failed } = data as any;
  const Icon = ICONS[nodeType as string] || Bot;

  const borderColor = executing
    ? '#e4a853'
    : failed
    ? '#f87171'
    : completed
    ? '#34d399'
    : selected
    ? color
    : 'rgba(255,255,255,0.08)';

  return (
    <div
      className="relative min-w-[140px] rounded-lg border-2 transition-all duration-300"
      style={{
        borderColor,
        boxShadow: executing
          ? `0 0 20px ${color}40`
          : completed
          ? `0 0 15px #34d39930`
          : 'none',
        background: '#111114',
      }}
    >
      {nodeType !== 'start' && nodeType !== 'note' && (
        <Handle type="target" position={Position.Left} className="!bg-[#2a2a30] !w-3 !h-3" />
      )}

      <div className="flex items-center gap-2 px-3 py-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}20`, color }}
        >
          <Icon size={14} />
        </div>
        <span className="text-xs font-medium text-[#e4e4e8] truncate">
          {String(label)}
        </span>
      </div>

      {nodeType !== 'end' && nodeType !== 'note' && (
        <Handle
          type="source"
          position={Position.Right}
          id={nodeType === 'if-else' ? 'if' : nodeType === 'while' ? 'continue' : undefined}
          className="!bg-[#2a2a30] !w-3 !h-3"
        />
      )}

      {(nodeType === 'if-else' || nodeType === 'while') && (
        <Handle
          type="source"
          position={Position.Right}
          id={nodeType === 'if-else' ? 'else' : 'break'}
          className="!bg-[#2a2a30] !w-3 !h-3"
          style={{ top: '70%' }}
        />
      )}
    </div>
  );
}

export default memo(CustomNode);
```

#### 4c. Node definitions (`components/agent-builder/constants.ts`)

```typescript
import type { NodeType } from './types';

export interface NodeDefinition {
  type: NodeType;
  label: string;
  color: string;
  icon: string;
  category: 'flow' | 'ai' | 'logic' | 'data' | 'io';
  description: string;
  defaults?: Record<string, any>;
}

export const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
  start: { type: 'start', label: 'Start', color: '#34d399', icon: 'play', category: 'flow', description: 'Workflow entry point', defaults: { inputVariables: [] } },
  end: { type: 'end', label: 'End', color: '#f87171', icon: 'square', category: 'flow', description: 'Workflow completion' },
  agent: { type: 'agent', label: 'Agent', color: '#818cf8', icon: 'bot', category: 'ai', description: 'AI reasoning with LLM', defaults: { model: 'claude-sonnet-4-20250514', systemPrompt: '', userPrompt: '', maxTokens: 4096, temperature: 0.7 } },
  mcp: { type: 'mcp', label: 'MCP Tool', color: '#fbbf24', icon: 'wrench', category: 'ai', description: 'External tool call (Firecrawl, APIs)', defaults: { serverId: '', toolName: '', arguments: {} } },
  'if-else': { type: 'if-else', label: 'If/Else', color: '#fb923c', icon: 'git-branch', category: 'logic', description: 'Conditional branching', defaults: { condition: '' } },
  while: { type: 'while', label: 'While Loop', color: '#c084fc', icon: 'repeat', category: 'logic', description: 'Iterate until condition', defaults: { condition: '', maxIterations: 10 } },
  'user-approval': { type: 'user-approval', label: 'User Approval', color: '#ec4899', icon: 'user-check', category: 'logic', description: 'Human-in-the-loop gate', defaults: { message: 'Approve to continue?' } },
  transform: { type: 'transform', label: 'Transform', color: '#60a5fa', icon: 'code', category: 'data', description: 'Run JavaScript to transform data', defaults: { code: 'return input;' } },
  'set-state': { type: 'set-state', label: 'Set State', color: '#a78bfa', icon: 'database', category: 'data', description: 'Set workflow variables', defaults: { variables: {} } },
  extract: { type: 'extract', label: 'Extract', color: '#2dd4bf', icon: 'file-text', category: 'data', description: 'Extract fields from data', defaults: { fields: [] } },
  http: { type: 'http', label: 'HTTP Request', color: '#94a3b8', icon: 'globe', category: 'io', description: 'Make HTTP API calls', defaults: { method: 'GET', url: '', headers: {}, body: '' } },
  note: { type: 'note', label: 'Note', color: '#fbbf24', icon: 'sticky-note', category: 'flow', description: 'Sticky note for documentation', defaults: { text: '' } },
};

export const NODE_CATEGORIES = [
  { id: 'flow', label: 'Flow Control', types: ['start', 'end', 'note'] as NodeType[] },
  { id: 'ai', label: 'AI & Tools', types: ['agent', 'mcp'] as NodeType[] },
  { id: 'logic', label: 'Logic', types: ['if-else', 'while', 'user-approval'] as NodeType[] },
  { id: 'data', label: 'Data', types: ['transform', 'set-state', 'extract'] as NodeType[] },
  { id: 'io', label: 'I/O', types: ['http'] as NodeType[] },
];
```

---

### Phase 5: Mode Integration (Day 10)

#### 5a. Add to `types.ts`

```typescript
// Add to existing mode type or create union
export type AppMode = 'chat' | 'experiments' | 'library' | 'database' | 'agent-builder';
```

#### 5b. Add to `components/ModeSelector.tsx`

Add a new mode card:

```tsx
{
  id: 'agent-builder',
  label: 'Agent Builder',
  desc: 'Visual workflow builder for AI agent pipelines',
  icon: <Workflow size={18} />,
  password: 'your-password-here',
  sessionKey: 'edward:labs_agent-builder_session',
}
```

#### 5c. Add route in `App.tsx`

```tsx
<Route path="/agent-builder" element={
  <ProtectedRoute mode="agent-builder">
    <AgentBuilderMode />
  </ProtectedRoute>
} />
```

#### 5d. Add ReactFlow CSS overrides to `globals.css`

```css
.react-flow__node {
  border: none !important;
  box-shadow: none !important;
}

.react-flow__edge-path {
  stroke: rgba(255, 255, 255, 0.15) !important;
}

.react-flow__edge.selected .react-flow__edge-path {
  stroke: var(--neon-color) !important;
}

.react-flow__controls button {
  background: #18181b !important;
  border-color: #2a2a30 !important;
  color: #e4e4e8 !important;
}

.react-flow__controls button:hover {
  background: #222228 !important;
}

.react-flow__minimap {
  background: #111114 !important;
  border: 1px solid #2a2a30 !important;
}
```

---

### Phase 6: Polish (Days 11-12)

1. Auto-layout nodes (BFS left-to-right)
2. Keyboard shortcuts (Delete, Ctrl+Z undo, Ctrl+Enter run)
3. Edge labels for conditional branches
4. Export workflow as JSON
5. Import workflow from JSON
6. Template library (5 pre-built workflows)
7. Build verification (`npm run build`)

---

## SSE Event Protocol

```
data: {"type": "workflow_started", "executionId": "..."}
data: {"type": "node_started", "nodeId": "agent_1"}
data: {"type": "node_completed", "nodeId": "agent_1", "data": {...}}
data: {"type": "node_failed", "nodeId": "mcp_1", "data": {"error": "..."}}
data: {"type": "state_update", "state": {"variables": {...}}}
data: {"type": "paused", "pendingAuth": {"approvalId": "...", "message": "..."}}
data: {"type": "completed"}
data: {"type": "error", "error": "..."}
data: [DONE]
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Single CustomNode component | One component for all node types | Matches Open Agent Builder pattern — simpler than 12 components |
| LangGraph on Express server | Same as Open Agent Builder | Battle-tested state graph execution with interrupts |
| PostgreSQL for workflows | `nodes`/`edges` as JSONB/TEXT | No schema migration needed for workflow structure changes |
| No Convex dependency | Replace with PostgreSQL + REST | Avoid external real-time DB service |
| No Clerk dependency | Use existing edward:labs auth | Consistent with app auth pattern |
| vm.runInNewContext for transforms | Existing pattern in edward:labs | Already used for `execute_code` tool |
| SSE for execution streaming | Same pattern as chat/agent | Consistent with existing SSE architecture |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LangGraph Node.js compatibility | Server crashes | LangGraph supports Node 18+; test early |
| `@xyflow/react` bundle size | Slow initial load | Lazy load WorkflowCanvas with `React.lazy` |
| MCP protocol version drift | Tool failures | Pin `@modelcontextprotocol/sdk` version |
| Long-running workflows | SSE timeout | Use existing SSE keepalive pattern |
| Complex nested loops | Infinite loops | Hard max iterations (100) enforced in executor |
| LLM API key management | Security | Store encrypted, use env vars as fallback |

---

## Total Effort: ~12 days

| Phase | Days | Deliverable |
|-------|------|-------------|
| 1: Types + Database | 1 | Schema, types, DB module |
| 2: Executor Engine | 3 | LangGraphExecutor, agent/logic/MCP executors |
| 3: Express Routes | 1 | CRUD + SSE execution endpoints |
| 4: ReactFlow UI | 4 | Canvas, nodes, panels, settings |
| 5: Mode Integration | 1 | Route, mode selector, CSS |
| 6: Polish | 2 | Templates, export/import, build |
