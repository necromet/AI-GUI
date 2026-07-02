# Plan: Migrate to Server-Side SQLite Database

## Context

The app currently stores data in two places:
1. **Client-side IndexedDB** (via `idb` library) — models, conversations, messages, stitch projects
2. **Server-side JSON file** (`data/rag_chunks.json`) — RAG documents and embeddings

This is problematic for deployment because:
- Data is siloed per browser (no cross-device sync)
- RAG data is stored as a flat JSON file (fragile, no indexing)
- No centralized data layer

**Goal**: Move ALL data to a single SQLite database on the Express backend. Client will use REST API endpoints for all CRUD operations.

---

## Database Choice: SQLite (via `better-sqlite3`)

**Why SQLite over PostgreSQL:**
- Zero configuration — no separate Docker container
- Single file, mountable as Docker volume for persistence
- `better-sqlite3` is synchronous, fast, and well-suited for this workload
- Chat apps with moderate concurrency don't need Postgres
- Easy to back up (copy the file)
- Simple migration path to Postgres later if needed

---

## Schema Design

```sql
-- Models table
CREATE TABLE models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  context_window_size INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  api_key TEXT,
  provider TEXT,
  system_instruction TEXT,
  is_custom INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Conversations table
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  model_id INTEGER NOT NULL REFERENCES models(id),
  type TEXT NOT NULL DEFAULT 'chat', -- 'chat' | 'rag' | 'plugin-agent' | 'stitch'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX idx_conversations_type ON conversations(type);

-- Messages table
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  message_order INTEGER NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  token_count INTEGER,
  prompt_tokens INTEGER,
  candidates_tokens INTEGER,
  generated_images TEXT, -- JSON
  search_annotations TEXT, -- JSON
  attachments TEXT, -- JSON
  UNIQUE(conversation_id, message_order)
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- Stitch projects table
CREATE TABLE stitch_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  boards_json TEXT NOT NULL, -- JSON-serialized StitchBoard[]
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- RAG documents table
CREATE TABLE rag_documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- RAG chunks table (with embeddings stored as JSON array)
CREATE TABLE rag_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  embedding TEXT NOT NULL, -- JSON-serialized number[]
  start_index INTEGER NOT NULL,
  end_index INTEGER NOT NULL
);
CREATE INDEX idx_rag_chunks_document ON rag_chunks(document_id);
```

---

## Implementation Steps

### Step 1: Install dependencies
```bash
npm install better-sqlite3 @types/better-sqlite3
```

### Step 2: Create `server/db/schema.ts`
- Define the SQL schema as a string constant
- Export an `initDatabase(dbPath: string)` function that creates tables if they don't exist
- Default DB path: `data/edwardlabs.db`

### Step 3: Create `server/db/index.ts`
- Singleton database connection using `better-sqlite3`
- Export `getDatabase()` function
- Call `initDatabase()` on first access
- Enable WAL mode for better concurrent read performance
- Enable foreign keys

### Step 4: Create `server/db/models.ts`
- `getModels()` — all active models
- `getAllModels()` — all models including inactive
- `getModelById(id)`
- `getModelByName(name)`
- `addModel(...)` — returns inserted ID
- `updateModel(id, ...)`
- `deactivateModel(id)`

### Step 5: Create `server/db/conversations.ts`
- `getConversations()` — ordered by updated_at DESC
- `getConversationsByType(type)`
- `getConversationById(id)`
- `createConversation(modelId, title, type)` — returns inserted ID
- `updateConversationTitle(id, title)`
- `deleteConversation(id)` — CASCADE deletes messages

### Step 6: Create `server/db/messages.ts`
- `getMessagesByConversation(conversationId)` — ordered by message_order
- `addMessage(...)` — also updates conversation's updated_at
- `updateMessage(id, content, tokenCount)`
- `deleteMessage(id)`
- `getNextMessageOrder(conversationId)`
- `clearConversationMessages(conversationId)`

### Step 7: Create `server/db/stitchProjects.ts`
- `getStitchProjects()` — ordered by updated_at DESC
- `getStitchProject(id)`
- `saveStitchProject(project)` — upsert
- `deleteStitchProject(id)`

### Step 8: Create `server/db/tokenStats.ts`
- `getOverallTokenStats()`
- `getTokenStatsByModel()`
- `getTokenStatsByDate(days)`
- `getTokenStatsByConversation(limit)`

### Step 9: Refactor `server/services/ragService.ts`
- Replace JSON file storage with SQLite queries
- Keep the same in-memory search logic (load chunks from DB, compute cosine similarity)
- Functions: `addDocument`, `listDocuments`, `deleteDocument`, `retrieveRelevantChunks`

### Step 10: Create REST API routes for database CRUD

#### `server/routes/models.ts`
- `GET /api/models` — list active models
- `GET /api/models/all` — list all models
- `POST /api/models` — create model
- `PUT /api/models/:id` — update model
- `DELETE /api/models/:id` — deactivate model

#### `server/routes/conversations.ts`
- `GET /api/conversations` — list all conversations
- `GET /api/conversations?type=chat` — filter by type
- `GET /api/conversations/:id` — get single conversation
- `POST /api/conversations` — create conversation
- `PUT /api/conversations/:id` — update title
- `DELETE /api/conversations/:id` — delete with cascade

#### `server/routes/messages.ts`
- `GET /api/conversations/:id/messages` — get messages for conversation
- `POST /api/conversations/:id/messages` — add message
- `PUT /api/messages/:id` — update message
- `DELETE /api/messages/:id` — delete message

#### `server/routes/stitch.ts` (extend existing)
- `GET /api/stitch/projects` — list projects
- `GET /api/stitch/projects/:id` — get project
- `PUT /api/stitch/projects/:id` — save project
- `DELETE /api/stitch/projects/:id` — delete project

#### `server/routes/stats.ts`
- `GET /api/stats/overall` — overall token stats
- `GET /api/stats/by-model` — token stats by model
- `GET /api/stats/by-date?days=30` — token stats by date
- `GET /api/stats/by-conversation?limit=20` — token stats by conversation

### Step 11: Register new routes in `server/index.ts`
- Import and mount all new route modules

### Step 12: Create `services/apiDatabaseAdapter.ts` (client-side)
- New client-side adapter that calls REST API endpoints instead of IndexedDB
- Same function signatures as current `databaseAdapter.ts` but uses `fetch()`
- Drop-in replacement

### Step 13: Update `App.tsx`
- Replace `import * as db from './services/databaseAdapter'` with `import * as db from './services/apiDatabaseAdapter'`
- No other changes needed (same function signatures)

### Step 14: Update Docker configuration
- Add `data/` volume mount in `docker-compose.yml` for SQLite persistence
- Update `Dockerfile.backend` to create `data/` directory
- Add `data/` to `.gitignore` (if not already)

### Step 15: Seed default model
- On database init, insert the default `gemini-2.5-flash-preview-09-2025` model if it doesn't exist

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/db/schema.ts` | SQL schema + init function |
| `server/db/index.ts` | Singleton DB connection |
| `server/db/models.ts` | Model CRUD operations |
| `server/db/conversations.ts` | Conversation CRUD operations |
| `server/db/messages.ts` | Message CRUD operations |
| `server/db/stitchProjects.ts` | Stitch project CRUD operations |
| `server/db/tokenStats.ts` | Token usage statistics queries |
| `server/routes/models.ts` | Model REST endpoints |
| `server/routes/conversations.ts` | Conversation REST endpoints |
| `server/routes/messages.ts` | Message REST endpoints |
| `server/routes/stats.ts` | Token stats REST endpoints |
| `services/apiDatabaseAdapter.ts` | Client-side API adapter (replaces IndexedDB) |

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `better-sqlite3` dependency |
| `server/index.ts` | Register new routes, init DB |
| `server/services/ragService.ts` | Replace JSON storage with SQLite |
| `server/routes/stitch.ts` | Add project CRUD endpoints |
| `App.tsx` | Switch import to `apiDatabaseAdapter` |
| `docker-compose.yml` | Add `data/` volume for persistence |
| `Dockerfile.backend` | Create `data/` dir, copy schema |
| `.gitignore` | Add `data/*.db` |

## Files to Deprecate (keep but no longer imported)

| File | Reason |
|------|--------|
| `services/databaseService.ts` | Replaced by server-side SQLite |
| `services/databaseAdapter.ts` | Replaced by `apiDatabaseAdapter.ts` |

---

## Data Flow (After Migration)

```
Client (React)
  └── services/apiDatabaseAdapter.ts  (fetch → REST API)
        └── Express Backend (server/index.ts)
              ├── server/routes/*.ts  (REST endpoints)
              └── server/db/*.ts      (SQLite queries)
                    └── data/edwardlabs.db  (SQLite file)
```

---

## Deployment Options

SQLite is a single-file database, which means the key concern across all deployment targets is **persistent filesystem access**. Here are the viable options ranked by simplicity:

### Option 1: Docker (already configured)

Best for: Self-hosted VPS, home server, or any Docker-capable environment.

```yaml
# docker-compose.yml
services:
  backend:
    volumes:
      - db-data:/app/data
    # ...

volumes:
  db-data:
```

The named volume `db-data` persists the SQLite file across container restarts and rebuilds. Backup: `docker cp backend:/app/data/edwardlabs.db ./backup.db`.

### Option 2: Direct Node.js on a VPS

Best for: Simplest setup — no Docker knowledge required.

**Providers**: DigitalOcean ($4-6/mo droplet), Hetzner ($4/mo VPS), AWS EC2 (t2.micro free tier), Linode, Vultr.

```bash
# On the server:
git clone <repo> && cd ai-gui
npm ci
cp .env.example .env   # fill in API keys
npm run build          # build frontend
npx tsx server/index.ts  # or use pm2 below
```

Use **pm2** for process management and auto-restart:
```bash
npm install -g pm2
pm2 start "npx tsx server/index.ts" --name edwardlabs
pm2 startup   # auto-start on boot
pm2 save
```

Serve the frontend with nginx (same as Docker setup) or Caddy (auto-HTTPS):
```bash
# Caddy example — zero-config HTTPS
sudo apt install caddy
# /etc/caddy/Caddyfile:
# edwardlabs.yourdomain.com {
#   reverse_proxy localhost:3001
#   root * /path/to/ai-gui/dist
#   file_server
#   try_files {path} /index.html
# }
```

SQLite file lives at `./data/edwardlabs.db`. Backup with `cp data/edwardlabs.db backup-$(date +%F).db` or set up a cron job.

### Option 3: Railway

Best for: One-click deploy, automatic HTTPS, zero DevOps.

- Railway provides persistent volumes ($0.25/GB/mo)
- Add a volume mounted to `/app/data` in the Railway dashboard
- Set env vars (MIMO_API_KEY, etc.) in the Railway dashboard
- Deploy from GitHub repo — Railway auto-detects Node.js
- Add a `railway.toml` or just use the start command: `npx tsx server/index.ts`
- Railway handles HTTPS and custom domains automatically

```toml
# railway.toml (optional)
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm run build && npx tsx server/index.ts"
```

### Option 4: Fly.io

Best for: Global edge deployment, generous free tier, excellent SQLite story.

Fly.io is specifically designed for SQLite apps (they built LiteFS for distributed SQLite).

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh
fly auth login

# Initialize the app
fly launch  # creates fly.toml

# Add a persistent volume
fly volumes create edwardlabs_data --size 1  # 1GB, ~$0.15/mo

# Deploy
fly deploy
```

```toml
# fly.toml
app = "edwardlabs"
primary_region = "sin"  # Singapore, closest to you

[mounts]
  source = "edwardlabs_data"
  destination = "/app/data"

[env]
  SERVER_PORT = "3001"

[[services]]
  internal_port = 3001
  protocol = "tcp"
  [[services.ports]]
    handlers = ["http"]
    port = 80
  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

### Option 5: Render

Best for: GitHub-integrated deploy, managed TLS.

- Create a **Web Service** on Render, connect GitHub repo
- Add a **Disk** (persistent storage) mounted to `/app/data` ($0.25/GB/mo)
- Set build command: `npm ci && npm run build`
- Set start command: `npx tsx server/index.ts`
- Render provides automatic HTTPS and custom domains

### Option 6: VPS + systemd (production-hardened)

Best for: Full control, production workloads.

```ini
# /etc/systemd/system/edwardlabs.service
[Unit]
Description=Edward Labs API Server
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/ai-gui
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/ai-gui/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable edwardlabs
sudo systemctl start edwardlabs
sudo journalctl -u edwardlabs -f  # view logs
```

Then put Caddy or nginx in front for HTTPS and serving the static frontend.

---

### Comparison Table

| Option | Cost (est.) | HTTPS | Effort | Persistent Storage | Best For |
|--------|------------|-------|--------|--------------------|----------|
| Docker (VPS) | $4-6/mo | Manual (Caddy/nginx) | Low | Volume mount | Self-hosting |
| Direct Node.js + pm2 | $4-6/mo | Manual (Caddy/nginx) | Lowest | Local filesystem | Simplest setup |
| Railway | $5-10/mo | Automatic | Very Low | Volume ($0.25/GB) | Zero DevOps |
| Fly.io | $2-5/mo | Automatic | Low | Volume ($0.15/GB) | Global edge, free tier |
| Render | $7-12/mo | Automatic | Low | Disk ($0.25/GB) | GitHub integration |
| VPS + systemd | $4-6/mo | Manual (Caddy/nginx) | Medium | Local filesystem | Production hardening |

**Recommendation**: **Railway** or **Fly.io** for the easiest deploy-to-production path. **Direct Node.js + pm2 + Caddy** if you want full control at minimal cost.
