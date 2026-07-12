# Integration Plan: Kilocode Agent System → ai-gui

## Executive Summary

Kilocode's agent runtime is **deeply coupled to Effect-TS** (62% of source files import Effect). It cannot be "copy-pasted" as plain TypeScript. Three integration approaches exist, ranging from 2 days to 24 weeks. **The recommended path is a hybrid**: use `@kilocode/sdk` to spawn Kilocode's backend as a sidecar service, then incrementally port high-value components into ai-gui's Express stack.

---

## Approach Comparison

| Approach | Effort | Risk | Kilocode Updates | Effect-TS Dependency |
|---|---|---|---|---|
| **A: SDK Sidecar** | 2-3 days | Low | Auto (bump SDK) | None (SDK is HTTP-only) |
| **B: Core Extraction** | 4-6 weeks | Medium | Manual merge | Yes (Effect v4 beta) |
| **C: Concept Port** | 8-12 weeks | High | N/A (own code) | None |
| **D: Ground-Up Rewrite** | 20-24 weeks | Very High | N/A | None |

---

## Recommended: Approach A → B (Incremental)

Start with the SDK sidecar (days) to get value immediately, then incrementally extract components (weeks) as needed.

---

## Phase 1: SDK Sidecar (2-3 Days)

### What

Spawn `kilo serve` as a background process, communicate via `@kilocode/sdk`. ai-gui gets the full Kilocode agent system (30+ tools, permissions, compaction, multi-agent) with zero Effect code.

### Architecture

```
┌──────────────────────────────────────────────────────┐
│  ai-gui Frontend (React)                              │
│  ┌────────────────────────────────────────────────┐   │
│  │  AgentChatPanel (modified)                     │   │
│  │    → POST /api/agent/kilo/chat                 │   │
│  └────────────────────────────────────────────────┘   │
│                        │                               │
│  ┌────────────────────────────────────────────────┐   │
│  │  Express Backend (server/index.ts)             │   │
│  │    /api/agent/kilo/* → KiloProxy routes        │   │
│  └────────────────────┬───────────────────────────┘   │
│                       │ SDK HTTP calls                 │
│  ┌────────────────────▼───────────────────────────┐   │
│  │  Kilo Sidecar (kilo serve --port 0)            │   │
│  │    Full agent runtime: 30+ tools, permissions,  │   │
│  │    compaction, multi-agent, context tracking    │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Install SDK dependency

```bash
cd /Users/edwardrenaldi/Documents/Codes/GIT/ai-gui
npm install @kilocode/sdk
```

#### Step 2: Create Kilo sidecar manager (`server/services/kiloSidecar.ts`)

```typescript
import { spawn, ChildProcess } from 'child_process';
import { createKiloClient } from '@kilocode/sdk/v2';

let sidecarProcess: ChildProcess | null = null;
let client: ReturnType<typeof createKiloClient> | null = null;
let port: number = 0;

export async function startSidecar(): Promise<void> {
  if (sidecarProcess) return;

  const password = crypto.randomBytes(16).toString('hex');

  sidecarProcess = spawn('kilo', ['serve', '--port', '0'], {
    env: {
      ...process.env,
      KILO_SERVER_PASSWORD: password,
      KILO_DISABLE_TELEMETRY: 'true',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Parse port from stdout
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Sidecar startup timeout')), 30000);
    sidecarProcess!.stderr!.on('data', (data: Buffer) => {
      const match = data.toString().match(/listening on http:\/\/[^:]+:(\d+)/);
      if (match) {
        port = parseInt(match[1], 10);
        client = createKiloClient({
          baseUrl: `http://127.0.0.1:${port}`,
          headers: {
            Authorization: 'Basic ' + Buffer.from(`kilo:${password}`).toString('base64'),
          },
          directory: process.cwd(),
        });
        clearTimeout(timeout);
        resolve();
      }
    });
    sidecarProcess!.on('error', reject);
  });
}

export function getClient() {
  if (!client) throw new Error('Kilo sidecar not started');
  return client;
}

export async function stopSidecar(): Promise<void> {
  if (sidecarProcess) {
    sidecarProcess.kill('SIGTERM');
    sidecarProcess = null;
    client = null;
  }
}
```

#### Step 3: Create proxy routes (`server/routes/kiloAgent.ts`)

```typescript
import { Router } from 'express';
import { getClient, startSidecar } from '../services/kiloSidecar.js';

const router = Router();

// Start sidecar on first request
router.use(async (_req, res, next) => {
  try {
    await startSidecar();
    next();
  } catch (err) {
    res.status(503).json({ error: 'Kilo sidecar failed to start' });
  }
});

// Create session
router.post('/session', async (req, res) => {
  const client = getClient();
  const { data } = await client.session.create(req.body, { throwOnError: true });
  res.json(data);
});

// Send message (SSE streaming)
router.post('/session/:id/message', async (req, res) => {
  const client = getClient();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await client.session.promptAsync({
      sessionID: req.params.id,
      parts: req.body.parts,
    });

    for await (const event of stream.stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
  } finally {
    res.end();
  }
});

// List tools
router.get('/tools', async (_req, res) => {
  const client = getClient();
  // Tools are part of the agent config, not a separate endpoint
  res.json({ message: 'Tools are managed by Kilo agents' });
});

// Health check
router.get('/health', async (_req, res) => {
  try {
    const client = getClient();
    await client.global.health({}, { throwOnError: true });
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

export default router;
```

#### Step 4: Mount routes in `server/index.ts`

```typescript
import kiloAgentRoutes from './routes/kiloAgent.js';
// ...
app.use('/api/agent/kilo', kiloAgentRoutes);
```

#### Step 5: Modify `AgentChatPanel.tsx` to support Kilo backend

Add a toggle between the existing MiMo agent and the Kilo backend:

```typescript
const [agentBackend, setAgentBackend] = useState<'mimo' | 'kilo'>('mimo');

// In handleSendMessage:
if (agentBackend === 'kilo') {
  // Call /api/agent/kilo/session/:id/message
  // Parse SSE events (different format from MiMo agent)
} else {
  // Existing MiMo agent flow
}
```

#### Step 6: Install Kilo CLI as a dependency

```json
// package.json
"scripts": {
  "postinstall": "npx @kilocode/cli --version || npm install -g @kilocode/cli"
}
```

Or use the npm binary package:
```bash
npm install @kilocode/cli
```

### Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `server/services/kiloSidecar.ts` | **Create** | Sidecar process manager |
| `server/routes/kiloAgent.ts` | **Create** | Proxy routes to Kilo backend |
| `server/index.ts` | **Modify** | Mount new routes |
| `components/AgentChatPanel.tsx` | **Modify** | Add backend toggle + Kilo SSE parsing |
| `services/agentService.ts` | **Modify** | Add Kilo API functions |
| `package.json` | **Modify** | Add `@kilocode/sdk` dependency |

### What You Get (Day 1)

- 30+ tools (file ops, shell, search, git, diagnostics, MCP)
- Permission system with user prompts
- Context compaction for long conversations
- Multi-agent support (code, plan, ask, debug, explore, review)
- Subagent delegation (parallel task execution)
- 500+ model support via Vercel AI SDK
- Doom loop detection
- Git snapshot tracking
- Skill system
- Plugin/MCP extensibility

### Limitations

- Requires Kilo CLI installed on the server
- Two processes running (Express + Kilo sidecar)
- Agent system is a black box (can't customize internals)
- Startup latency (~2-5s for sidecar initialization)
- Kilo CLI version must be kept in sync with SDK

---

## Phase 2: Core Extraction (4-6 Weeks)

### What

Extract Kilocode's core agent runtime as a standalone library with Effect-TS as a dependency. This gives full control over the agent internals.

### Prerequisites

- Accept Effect-TS v4 beta as a dependency
- Accept Vercel AI SDK as the LLM abstraction layer

### Step 2.1: Create `packages/kilo-agent-core/`

Extract from the Kilocode monorepo:

```
packages/kilo-agent-core/
├── src/
│   ├── tool/
│   │   ├── tool.ts              # Tool.define() interface
│   │   ├── registry.ts          # Tool registry (simplified)
│   │   ├── read.ts              # File reading
│   │   ├── write.ts             # File writing
│   │   ├── edit.ts              # File editing
│   │   ├── shell.ts             # Shell execution
│   │   ├── glob.ts              # File search
│   │   ├── grep.ts              # Content search
│   │   ├── webfetch.ts          # URL fetching
│   │   └── task.ts              # Subagent spawning
│   ├── agent/
│   │   ├── agent.ts             # Agent definitions
│   │   └── prompts/             # System prompts
│   ├── session/
│   │   ├── processor.ts         # The agent loop
│   │   ├── llm.ts               # LLM streaming
│   │   ├── system.ts            # Prompt assembly
│   │   └── compaction.ts        # Context compaction
│   ├── permission/
│   │   └── index.ts             # Permission system
│   └── index.ts                 # Public API
├── package.json
└── tsconfig.json
```

### Step 2.2: Abstract storage layer

Replace Drizzle/SQLite with an interface:

```typescript
interface AgentStorage {
  // Sessions
  createSession(data: SessionData): Promise<string>;
  getSession(id: string): Promise<SessionData | null>;
  updateSession(id: string, data: Partial<SessionData>): Promise<void>;

  // Messages
  addMessage(sessionId: string, message: Message): Promise<void>;
  getMessages(sessionId: string): Promise<Message[]>;

  // Permissions
  getSavedApprovals(pattern: string): Promise<Approval[]>;
  saveApproval(approval: Approval): Promise<void>;
}
```

Implement with IndexedDB (browser) or SQLite (server) to match ai-gui's existing storage.

### Step 2.3: Create Express adapter

Replace Effect HTTP with Express routes:

```typescript
import { AgentCore } from '@ai-gui/agent-core';

const core = new AgentCore({
  storage: new IndexedDBStorage(),
  llm: new MiMoProvider({ apiKey, baseUrl }),
  tools: [/* tool instances */],
});

router.post('/chat', async (req, res) => {
  const stream = await core.processMessage(req.body);
  // Forward stream events as SSE
});
```

### Step 2.4: Port tool implementations

Each Kilocode tool needs its `execute` function converted from `Effect.Effect` to `Promise`:

```typescript
// Kilocode (Effect)
execute: (args, ctx) =>
  Effect.gen(function* () {
    const content = yield* FileSystem.readFileString(args.path);
    return { title: "Read", metadata: {}, output: content };
  })

// ai-gui (Promise)
execute: async (args, ctx) => {
  const content = await fs.readFile(args.path, 'utf-8');
  return { title: "Read", metadata: {}, output: content };
}
```

### Step 2.5: Port permission system

Replace Effect Deferred with plain Promises + EventEmitter:

```typescript
class PermissionManager {
  private pending = new Map<string, {
    resolve: (action: 'allow' | 'deny') => void;
    reject: (err: Error) => void;
  }>();

  async ask(permission: string, pattern: string): Promise<'allow' | 'deny'> {
    // Check saved approvals
    const saved = await this.storage.getSavedApprovals(permission, pattern);
    if (saved) return saved.action;

    // Prompt user
    return new Promise((resolve, reject) => {
      const id = `${permission}:${pattern}`;
      this.pending.set(id, { resolve, reject });
      this.emit('ask', { id, permission, pattern });
    });
  }

  respond(id: string, action: 'allow' | 'deny' | 'always') {
    const entry = this.pending.get(id);
    if (!entry) return;
    if (action === 'always') {
      this.storage.saveApproval(/* ... */);
    }
    entry.resolve(action === 'deny' ? 'deny' : 'allow');
    this.pending.delete(id);
  }
}
```

### Files to Create

| File | Description |
|---|---|
| `packages/kilo-agent-core/package.json` | Package manifest |
| `packages/kilo-agent-core/src/index.ts` | Public API |
| `packages/kilo-agent-core/src/tool/*.ts` | Ported tools |
| `packages/kilo-agent-core/src/agent/*.ts` | Agent definitions + prompts |
| `packages/kilo-agent-core/src/session/*.ts` | Processor, LLM, compaction |
| `packages/kilo-agent-core/src/permission/*.ts` | Permission system |
| `packages/kilo-agent-core/src/storage/*.ts` | Storage interfaces + IndexedDB impl |

### Dependencies

```json
{
  "dependencies": {
    "ai": "^6.0.168",
    "@ai-sdk/openai": "^3.0.53",
    "effect": "^4.0.0-beta.66",
    "zod": "^4.1.8"
  }
}
```

---

## Phase 3: Concept Port (8-12 Weeks) — If Effect-TS is Rejected

### What

Re-implement Kilocode's agent concepts in plain TypeScript without Effect-TS. Higher effort but zero Effect dependency.

### Components to Port

| Component | Kilocode File | Effort | Notes |
|---|---|---|---|
| Tool system | `tool/tool.ts`, `tool/registry.ts` | 2 weeks | `Tool.define()` with Zod schemas |
| Agent loop | `session/processor.ts` | 3 weeks | Async generator-based, no Effect streams |
| LLM integration | `session/llm.ts` | 1 week | AI SDK is standalone, just wire it up |
| System prompts | `session/prompt/*.txt`, `session/system.ts` | 1 week | Copy prompt files, rewrite assembly |
| Permission system | `permission/index.ts` | 2 weeks | EventEmitter + Promise-based |
| Context compaction | `session/compaction.ts` | 1 week | Summarization agent + message replacement |
| Agent definitions | `agent/agent.ts` | 3 days | Plain TS interfaces + config loading |

### Architecture (No Effect)

```
┌─────────────────────────────────────────────────────┐
│  ai-gui Express Backend                              │
│  ┌───────────────────────────────────────────────┐   │
│  │  AgentRuntime (plain class)                   │   │
│  │    .processMessage(messages, tools) → Stream  │   │
│  │                                               │   │
│  │  ┌─────────────┐  ┌──────────────┐           │   │
│  │  │ ToolRegistry│  │ PermissionMgr│           │   │
│  │  └──────┬──────┘  └──────┬───────┘           │   │
│  │         │                │                    │   │
│  │  ┌──────▼────────────────▼───────┐           │   │
│  │  │  AgentLoop (async generator)  │           │   │
│  │  │    while (!done) {            │           │   │
│  │  │      stream = llm.stream()    │           │   │
│  │  │      for await (event) {     │           │   │
│  │  │        yield event           │           │   │
│  │  │        if (toolCall) {       │           │   │
│  │  │          result = await tool │           │   │
│  │  │          messages.push(result)│          │   │
│  │  │        }                     │           │   │
│  │  │      }                       │           │   │
│  │  │    }                         │           │   │
│  │  └──────────────────────────────┘           │   │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Key Porting Decisions

| Kilocode Pattern | Plain TS Replacement |
|---|---|
| `Effect.gen` + `yield*` | `async function*` generator |
| `Stream.Stream<Event>` | `AsyncGenerator<Event>` |
| `Deferred<T>` | `Promise<T>` + `resolve`/`reject` |
| `Effect.Layer` | Constructor dependency injection |
| `Context.Service` | Plain class with injected deps |
| `Schema.Struct` | Zod schemas |
| `Bus.PubSub` | EventEmitter or custom pub/sub |
| `ScopedCache` | `Map<string, LazyValue>` |
| `Effect.retry` | `retry-ts` or manual loop |

---

## Phase 4: Visual Design Tools (Post-Integration)

ai-gui's Stitch tools are unique — Kilocode doesn't have them. After integrating the Kilocode agent system, port Stitch tools as Kilocode-compatible tools:

### Create Kilocode-compatible Stitch tools

```typescript
// Using Kilocode's Tool.define() pattern
export const EditHtmlTool = Tool.define("edit_html", {
  description: "Surgically edit HTML using CSS selectors",
  parameters: Schema.Struct({
    edits: Schema.Array(Schema.Struct({
      selector: Schema.String,
      action: Schema.String,
      // ...
    })),
  }),
  execute: async (args, ctx) => {
    // Existing Cheerio-based edit logic
    const $ = cheerio.load(currentHtml);
    // Apply edits...
    return { title: "Edit HTML", metadata: {}, output: result };
  },
});
```

### Register Stitch tools alongside Kilocode tools

```typescript
const toolRegistry = new ToolRegistry([
  ...kiloBuiltinTools,
  editHtmlTool,
  generateHtmlTool,
  generateSpecTool,
  editSpecTool,
  searchLibraryTool,
]);
```

---

## Dependency Matrix

### Phase 1 (SDK Sidecar)

```json
{
  "dependencies": {
    "@kilocode/sdk": "workspace:*"
  }
}
```

### Phase 2 (Core Extraction)

```json
{
  "dependencies": {
    "@kilocode/sdk": "workspace:*",
    "@ai-gui/agent-core": "workspace:*",
    "ai": "^6.0.168",
    "@ai-sdk/openai": "^3.0.53",
    "effect": "^4.0.0-beta.66",
    "zod": "^4.1.8"
  }
}
```

### Phase 3 (Concept Port)

```json
{
  "dependencies": {
    "ai": "^6.0.168",
    "@ai-sdk/openai": "^3.0.53",
    "zod": "^3.23.0"
  }
}
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Kilo CLI not installed on server | Phase 1 fails | Bundle CLI binary, or use npm `@kilocode/cli` |
| Effect-TS v4 breaking changes | Phase 2 breaks | Pin exact version, test before upgrading |
| Kilocode API changes | Phase 1 breaks | Pin SDK version, monitor releases |
| Performance overhead (two processes) | Phase 1 latency | Use Phase 2/3 for production |
| Kilocode license (MIT) | None | MIT allows commercial use, modification, distribution |
| Vercel AI SDK API changes | Phase 2/3 breaks | Pin version, abstract behind interface |

---

## Timeline

```
Week 1:     Phase 1 — SDK Sidecar (2-3 days)
            └── Get Kilocode agent working in ai-gui immediately

Week 2-3:   Evaluate Phase 1 performance and UX
            └── Identify which Kilocode features are most valuable

Week 4-7:   Phase 2.1-2.3 — Extract core, abstract storage, Express adapter
            └── Or Phase 3.1-3.2 — Port tool system + agent loop

Week 8-11:  Phase 2.4-2.5 — Port tools + permissions
            └── Or Phase 3.3-3.6 — Port remaining components

Week 12:    Phase 4 — Stitch tools as Kilocode-compatible tools
            └── Full integration with visual design preserved
```

---

## Quick Start: Phase 1 in 30 Minutes

```bash
# 1. Install Kilo CLI globally
curl -fsSL https://kilo.ai/cli/install | bash

# 2. Verify installation
kilo --version

# 3. Add SDK to ai-gui
cd /Users/edwardrenaldi/Documents/Codes/GIT/ai-gui
npm install @kilocode/sdk

# 4. Create sidecar service + routes (copy from Phase 1 above)
# 5. Mount routes in server/index.ts
# 6. Start both servers
npm run dev:all

# 7. Test via curl
curl -X POST http://localhost:3001/api/agent/kilo/session \
  -H "Content-Type: application/json" \
  -d '{}'
```
