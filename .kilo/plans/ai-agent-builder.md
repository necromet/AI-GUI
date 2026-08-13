# AI Agent Builder — Replace Plugin Agent

## Overview

Replace the current `/experiments/plugin-agent` (simple chat panel with hardcoded tool toggles) with a visual **AI Agent Workflow Builder** using React Flow drag-and-drop canvas. Users create agents visually — define system prompts, attach tools, and connect them in workflows. Uses Vercel AI SDK (`ai` + `@ai-sdk/openai-compatible`) for agent execution.

The `actuallyexplain` project serves as the **UI reference** for the drag-and-drop canvas style (dark theme, React Flow nodes, dagre layout, node detail panels).

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React 19 + Vite)                          │
│                                                      │
│  /experiments/agent-builder                          │
│  ┌──────────────┬────────────────────────────────┐  │
│  │ Sidebar       │ React Flow Canvas              │  │
│  │ - Agent list  │ - Agent nodes (draggable)      │  │
│  │ - Tool list   │ - Tool nodes (draggable)       │  │
│  │ - Run/Chat    │ - Input/Output nodes           │  │
│  │               │ - Edges: tool → agent           │  │
│  └──────────────┴────────────────────────────────┘  │
│                                                      │
│  Right Panel (on node click):                        │
│  - System prompt editor (Monaco)                     │
│  - Tool parameter editor                             │
│  - Model selector                                    │
└──────────────────┬──────────────────────────────────┘
                   │ REST + SSE
┌──────────────────▼──────────────────────────────────┐
│  Express Backend (port 3001)                         │
│                                                      │
│  /api/agent-builder/workflows   CRUD                 │
│  /api/agent-builder/agents      CRUD                 │
│  /api/agent-builder/tools       CRUD                 │
│  /api/agent-builder/chat        SSE streaming        │
│                                                      │
│  Vercel AI SDK: streamText() + tool()                │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  PostgreSQL                                          │
│                                                      │
│  agent_builder_workflows                             │
│  agent_builder_agents                                │
│  agent_builder_tools                                 │
│  agent_builder_sessions                              │
│  agent_builder_messages                              │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1 Scope (Simple)

### What's in scope:
1. **Agent Nodes** — Create agents with name, system prompt, model selection
2. **Tool Nodes** — Create custom tools (name, description, parameters JSON schema)
3. **Workflow Canvas** — Drag-and-drop React Flow canvas, connect tools to agents
4. **Chat with Agent** — Select an agent, chat via SSE streaming, see tool calls
5. **CRUD Persistence** — Save/load agents, tools, workflows to PostgreSQL
6. **Node Detail Panel** — Click a node to edit its config in a side panel (like actuallyexplain's `NodeDetailsPanel`)

### What's NOT in scope (future):
- Multi-agent orchestration (agent-to-agent edges)
- Conditional branching, loops
- Visual workflow execution tracing
- Agent marketplace / sharing

---

## Database Schema

```sql
-- Tools: reusable tool definitions
CREATE TABLE IF NOT EXISTS agent_builder_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  parameters_schema JSONB NOT NULL DEFAULT '{}',
  implementation TEXT,
  icon TEXT DEFAULT 'wrench',
  color TEXT DEFAULT '#66A0C8',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agents: individual agent configs
CREATE TABLE IF NOT EXISTS agent_builder_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'mimo-v2.5',
  provider TEXT,
  color TEXT DEFAULT '#5ABDAC',
  icon TEXT DEFAULT 'bot',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent ↔ Tool junction (which tools an agent has)
CREATE TABLE IF NOT EXISTS agent_builder_agent_tools (
  agent_id TEXT NOT NULL REFERENCES agent_builder_agents(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL REFERENCES agent_builder_tools(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, tool_id)
);

-- Workflows: canvas layout + node/edge graph
CREATE TABLE IF NOT EXISTS agent_builder_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Untitled Workflow',
  description TEXT,
  graph_json JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat sessions (per-agent)
CREATE TABLE IF NOT EXISTS agent_builder_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_builder_agents(id) ON DELETE CASCADE,
  title TEXT,
  messages_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Backend Routes

### `server/routes/agentBuilder.ts`

```
Tools:
  GET    /api/agent-builder/tools           → list all tools
  POST   /api/agent-builder/tools           → create tool
  PUT    /api/agent-builder/tools/:id       → update tool
  DELETE /api/agent-builder/tools/:id       → delete tool

Agents:
  GET    /api/agent-builder/agents          → list all agents
  GET    /api/agent-builder/agents/:id      → get agent with tools
  POST   /api/agent-builder/agents          → create agent
  PUT    /api/agent-builder/agents/:id      → update agent
  DELETE /api/agent-builder/agents/:id      → delete agent
  POST   /api/agent-builder/agents/:id/tools  → attach tool to agent
  DELETE /api/agent-builder/agents/:id/tools/:toolId → detach tool

Workflows:
  GET    /api/agent-builder/workflows       → list all workflows
  GET    /api/agent-builder/workflows/:id   → get workflow
  POST   /api/agent-builder/workflows       → create workflow
  PUT    /api/agent-builder/workflows/:id   → update workflow (graph_json)
  DELETE /api/agent-builder/workflows/:id   → delete workflow

Chat:
  POST   /api/agent-builder/chat            → SSE streaming chat with an agent
```

### Chat endpoint implementation (Vercel AI SDK)

```typescript
// server/routes/agentBuilder.ts — chat endpoint
import { streamText, tool } from 'ai';
import { createProvider } from '../lib/aiSdk';
import { z } from 'zod';

router.post('/chat', async (req, res) => {
  const { agentId, messages } = req.body;

  // 1. Load agent + attached tools from DB
  const agent = await getAgentWithTools(agentId);

  // 2. Build Vercel AI SDK tool definitions from agent_builder_tools
  const toolsMap = {};
  for (const t of agent.tools) {
    const schema = t.parameters_schema; // JSON Schema from DB
    toolsMap[t.name] = tool({
      description: t.description,
      parameters: z.object(
        Object.fromEntries(
          Object.entries(schema.properties || {}).map(([key, def]: [string, any]) => [
            key,
            def.type === 'string' ? z.string() :
            def.type === 'number' ? z.number() :
            def.type === 'boolean' ? z.boolean() :
            z.any(),
          ])
        )
      ),
      execute: async (args) => {
        // Execute the tool (Phase 1: echo/mock, future: custom implementations)
        return `Tool "${t.name}" executed with: ${JSON.stringify(args)}`;
      },
    });
  }

  // 3. Stream with Vercel AI SDK
  res.setHeader('Content-Type', 'text/event-stream');
  // ... SSE headers ...

  const result = streamText({
    model: createProvider(agent.provider).chatModel(agent.model),
    system: agent.system_prompt,
    messages: convertToCoreMessages(messages),
    tools: toolsMap,
    maxSteps: 4,
  });

  // 4. Stream text + tool calls back to client
  for await (const chunk of result.textStream) {
    res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
  }
  // ... emit tool_call, tool_result events ...
  res.write('data: [DONE]\n\n');
  res.end();
});
```

---

## Frontend Components

### File Structure

```
components/agent-builder/
├── AgentBuilderPanel.tsx          # Main container (replaces AgentChatPanel)
├── AgentBuilderCanvas.tsx         # React Flow canvas with drag-drop
├── AgentNode.tsx                  # Custom React Flow node for agents
├── ToolNode.tsx                   # Custom React Flow node for tools
├── AgentDetailPanel.tsx           # Right panel: edit agent system prompt, model
├── ToolDetailPanel.tsx            # Right panel: edit tool name, description, params
├── AgentSidebar.tsx               # Left sidebar: agent list, tool palette, chat
├── AgentChatView.tsx              # Chat interface for selected agent
├── ToolPalette.tsx                # Draggable tool items
├── types.ts                       # Shared types
└── hooks/
    ├── useAgentBuilder.ts         # CRUD state management
    └── useAgentChat.ts            # SSE streaming chat hook
```

### AgentBuilderPanel.tsx (Main Container)

```tsx
// Replaces AgentChatPanel in App.tsx
// Three-column layout: Sidebar | Canvas | Detail Panel
export function AgentBuilderPanel({ theme, modelConfig, models, onNotification }) {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [view, setView] = useState<'canvas' | 'chat'>('canvas');

  return (
    <div className="flex h-full">
      {/* Left: Sidebar with agent/tool list + chat */}
      <AgentSidebar
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
        onSwitchView={setView}
      />

      {/* Center: React Flow canvas or Chat */}
      {view === 'canvas' ? (
        <AgentBuilderCanvas
          selectedAgent={selectedAgent}
          onNodeClick={setSelectedNode}
        />
      ) : (
        <AgentChatView agent={selectedAgent} />
      )}

      {/* Right: Node detail panel (like actuallyexplain's NodeDetailsPanel) */}
      {selectedNode && (
        <AgentDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
```

### AgentNode.tsx (React Flow Custom Node)

```tsx
// Styled like actuallyexplain's SqlNode — header with icon + label, body text
import { Handle, Position } from '@xyflow/react';
import { Bot, Settings } from 'lucide-react';

export function AgentNode({ data, selected }) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div className="agent-node" style={{ '--node-color': data.color || '#5ABDAC' }}>
        <div className="agent-node-header">
          <Bot size={16} />
          <span>{data.name}</span>
          <button onClick={() => data.openDetails(data.id)}>
            <Settings size={14} />
          </button>
        </div>
        <p className="agent-node-body">
          {data.systemPrompt?.substring(0, 80) || 'No system prompt'}
          {data.systemPrompt?.length > 80 ? '...' : ''}
        </p>
        <div className="agent-node-meta">
          {data.model} · {data.toolCount || 0} tools
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
```

### ToolNode.tsx

```tsx
export function ToolNode({ data, selected }) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div className="tool-node" style={{ '--node-color': data.color || '#66A0C8' }}>
        <div className="tool-node-header">
          <Wrench size={16} />
          <span>{data.name}</span>
        </div>
        <p className="tool-node-body">{data.description}</p>
        <div className="tool-node-params">
          {Object.keys(data.parameters || {}).length} params
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
```

### AgentDetailPanel.tsx

```tsx
// Like actuallyexplain's NodeDetailsPanel — slide-in from right
export function AgentDetailPanel({ node, onClose }) {
  return (
    <div className="detail-panel">
      <header>
        <h3>{node.data.name}</h3>
        <button onClick={onClose}><X size={20} /></button>
      </header>

      {/* System Prompt Editor */}
      <section>
        <h4>System Prompt</h4>
        <Editor
          defaultLanguage="markdown"
          value={node.data.systemPrompt}
          onChange={(val) => updateAgent(node.id, { systemPrompt: val })}
          theme="actuallyexplain"
          options={{ minimap: { enabled: false }, fontSize: 13, lineHeight: 1.5 }}
        />
      </section>

      {/* Model Selector */}
      <section>
        <h4>Model</h4>
        <Select value={node.data.model} onValueChange={...}>
          {models.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
        </Select>
      </section>

      {/* Attached Tools */}
      <section>
        <h4>Tools ({node.data.tools?.length || 0})</h4>
        {node.data.tools?.map(t => (
          <Badge key={t.id}>{t.name}</Badge>
        ))}
      </section>
    </div>
  );
}
```

---

## Integration into edward:labs

### Changes to `App.tsx`

```tsx
// 1. Import the new panel
import AgentBuilderPanel from './components/agent-builder/AgentBuilderPanel';

// 2. Replace AgentRouteContent
const AgentRouteContent = () => (
  <div className="h-full relative">
    <AgentBuilderPanel
      theme={theme}
      modelConfig={selectedModelConfig}
      models={models}
      onNotification={handleNotification}
    />
  </div>
);

// 3. Keep routes as-is (plugin-agent path stays for backward compat,
//    or rename to /experiments/agent-builder)
<Route path="/experiments/plugin-agent" element={...} />
```

### Changes to `Sidebar.tsx`

```tsx
// Update TOOLS_ITEMS
{ key: 'plugin-agent' as const, icon: Bot, label: 'Agent Builder' },
// or rename to 'agent-builder'
```

### Changes to `server/index.ts`

```tsx
import agentBuilderRoutes from './routes/agentBuilder';
app.use('/api/agent-builder', agentBuilderRoutes);
```

### Changes to `server/db/schema.ts`

Add the 5 new tables from the schema above to `SCHEMA_SQL`.

---

## Styling

Use the existing shadcn/ui component library (already in edward:labs). Key components:

| Component | Use |
|-----------|-----|
| `Button` | All interactive buttons |
| `Card` | Node containers in sidebar |
| `Badge` | Tool tags, status indicators |
| `Input` | Name/description fields |
| `Textarea` | System prompt (fallback) |
| `Select` | Model picker |
| `Dialog` | Create/edit modals |
| `Tabs` | Canvas/Chat view toggle |
| `Separator` | Visual dividers |
| `ScrollArea` | Sidebar content |
| `Tooltip` | Hover info |

### React Flow Theme (match actuallyexplain dark theme)

```css
.agent-builder .react-flow.dark {
  --xy-background-color: var(--bg-100);
  --xy-node-background-color: var(--bg-200);
  --xy-node-color: var(--text-100);
  --xy-node-border: 2px solid var(--border-300);
}

.agent-node {
  width: 240px;
  background: var(--bg-200);
  border: 2px solid var(--node-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.agent-node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-300);
  color: var(--node-color);
  font-weight: 600;
  font-size: 13px;
}
```

---

## Implementation Steps

### Step 1: Database Schema
- Add 5 tables to `server/db/schema.ts`
- Verify tables created on server startup

### Step 2: Backend CRUD Routes
- Create `server/routes/agentBuilder.ts`
- Implement tools CRUD (GET, POST, PUT, DELETE)
- Implement agents CRUD (GET, POST, PUT, DELETE + tool junction)
- Implement workflows CRUD (GET, POST, PUT, DELETE)
- Register routes in `server/index.ts`

### Step 3: Backend Chat Endpoint
- Implement `/api/agent-builder/chat` with Vercel AI SDK `streamText()`
- Load agent + tools from DB
- Build dynamic `z.object()` schemas from `parameters_schema` JSONB
- SSE streaming with tool call/result events

### Step 4: Frontend Types & Hooks
- Create `components/agent-builder/types.ts`
- Create `hooks/useAgentBuilder.ts` — CRUD state management via REST
- Create `hooks/useAgentChat.ts` — SSE streaming (reuse pattern from `services/agentService.ts`)

### Step 5: Frontend Canvas
- Create `AgentBuilderCanvas.tsx` — React Flow provider + canvas
- Create `AgentNode.tsx` — custom node component
- Create `ToolNode.tsx` — custom node component
- Implement drag-from-palette-to-canvas
- Auto-layout with dagre

### Step 6: Frontend Sidebar & Detail Panel
- Create `AgentSidebar.tsx` — agent list + tool palette
- Create `AgentDetailPanel.tsx` — system prompt editor (Monaco), model picker
- Create `ToolDetailPanel.tsx` — name, description, parameter schema editor
- Create `AgentChatView.tsx` — chat interface

### Step 7: Main Panel & Integration
- Create `AgentBuilderPanel.tsx` — compose all sub-components
- Update `App.tsx` to use new panel
- Update `Sidebar.tsx` label/icon
- Test full flow: create tool → create agent → attach tool → chat

### Step 8: Styling Polish
- Match actuallyexplain's dark theme aesthetic
- Node hover/selection states
- Animated edges (dashed, like actuallyexplain)
- Mobile-responsive layout

---

## Key Dependencies (already installed in edward:labs)

| Package | Version | Purpose |
|---------|---------|---------|
| `@xyflow/react` | ^12.11.2 | React Flow canvas |
| `dagre` | ^0.8.5 | Auto-layout |
| `ai` | ^7.0.28 | Vercel AI SDK |
| `@ai-sdk/openai-compatible` | ^3.0.11 | OpenAI-compatible provider |
| `zod` | ^4.4.3 | Schema validation for tools |
| `@monaco-editor/react` | ^4.7.0 | System prompt editor |
| `lucide-react` | ^0.554.0 | Icons |
| `tailwindcss` | ^4.3.2 | Styling |
| `express` | ^5.2.1 | Backend |
| `pg` | ^8.22.0 | PostgreSQL |

No new packages needed for Phase 1.

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `server/db/schema.ts` | **EDIT** | Add 5 new tables to `SCHEMA_SQL` |
| `server/routes/agentBuilder.ts` | **CREATE** | Full CRUD + chat routes |
| `server/index.ts` | **EDIT** | Register new route |
| `components/agent-builder/types.ts` | **CREATE** | Shared TypeScript interfaces |
| `components/agent-builder/AgentBuilderPanel.tsx` | **CREATE** | Main container |
| `components/agent-builder/AgentBuilderCanvas.tsx` | **CREATE** | React Flow canvas |
| `components/agent-builder/AgentNode.tsx` | **CREATE** | Agent custom node |
| `components/agent-builder/ToolNode.tsx` | **CREATE** | Tool custom node |
| `components/agent-builder/AgentDetailPanel.tsx` | **CREATE** | Agent config panel |
| `components/agent-builder/ToolDetailPanel.tsx` | **CREATE** | Tool config panel |
| `components/agent-builder/AgentSidebar.tsx` | **CREATE** | Left sidebar |
| `components/agent-builder/AgentChatView.tsx` | **CREATE** | Chat interface |
| `components/agent-builder/ToolPalette.tsx` | **CREATE** | Draggable tool items |
| `components/agent-builder/hooks/useAgentBuilder.ts` | **CREATE** | CRUD state hook |
| `components/agent-builder/hooks/useAgentChat.ts` | **CREATE** | SSE streaming hook |
| `App.tsx` | **EDIT** | Import new panel, update AgentRouteContent |
| `components/Sidebar.tsx` | **EDIT** | Update label/icon for agent-builder |
