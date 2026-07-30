# Database DDL — edward:labs

SQLite schema managed by `server/db/schema.ts`. Auto-migrated on every server startup. DB file: `data/edwardlabs.db` (WAL mode).

---

## Tables

### `models`

LLM model configurations.

```sql
CREATE TABLE IF NOT EXISTS models (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL UNIQUE,
  description           TEXT,
  context_window_size   INTEGER,
  active                INTEGER NOT NULL DEFAULT 1,
  api_key               TEXT,
  provider              TEXT,
  system_instruction    TEXT,
  is_custom             INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `conversations`

Chat conversations linked to a model.

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT,
  model_id    INTEGER NOT NULL REFERENCES models(id),
  type        TEXT NOT NULL DEFAULT 'chat',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_type    ON conversations(type);
```

### `messages`

Individual chat messages within a conversation.

```sql
CREATE TABLE IF NOT EXISTS messages (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id    INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role               TEXT NOT NULL,
  content            TEXT NOT NULL,
  message_order      INTEGER NOT NULL,
  timestamp          TEXT NOT NULL DEFAULT (datetime('now')),
  token_count        INTEGER,
  prompt_tokens      INTEGER,
  candidates_tokens  INTEGER,
  generated_images   TEXT,
  search_annotations TEXT,
  attachments        TEXT,
  UNIQUE(conversation_id, message_order)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
```

### `skema_projects`

Visual design projects (Skema feature).

```sql
CREATE TABLE IF NOT EXISTS skema_projects (
  id                   TEXT PRIMARY KEY,
  title                TEXT NOT NULL,
  description          TEXT,
  project_type         TEXT NOT NULL DEFAULT 'canvas',
  boards_json          TEXT NOT NULL,
  images_json          TEXT,
  theme_json           TEXT,
  full_design_spec_json TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `skema_components`

Skema component library (visual design building blocks).

```sql
CREATE TABLE IF NOT EXISTS skema_components (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL,
  content_type   TEXT NOT NULL,
  project_type   TEXT NOT NULL DEFAULT 'all',
  description    TEXT,
  tags           TEXT,
  content        TEXT NOT NULL,
  spec_snippet   TEXT,
  thumbnail      TEXT,
  is_global      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `skema_component_embeddings`

Vector embeddings for skema component semantic search.

```sql
CREATE TABLE IF NOT EXISTS skema_component_embeddings (
  id           TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES skema_components(id) ON DELETE CASCADE,
  chunk_text   TEXT NOT NULL,
  embedding    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sce_component ON skema_component_embeddings(component_id);
```

### `skema_agent_sessions`

Agent chat sessions per Skema project/board.

```sql
CREATE TABLE IF NOT EXISTS skema_agent_sessions (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES skema_projects(id) ON DELETE CASCADE,
  board_idx      INTEGER NOT NULL DEFAULT 0,
  title          TEXT,
  messages_json  TEXT NOT NULL DEFAULT '[]',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sas_project ON skema_agent_sessions(project_id);
```

### `rag_documents`

Uploaded RAG documents.

```sql
CREATE TABLE IF NOT EXISTS rag_documents (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `rag_chunks`

Text chunks with vector embeddings for RAG retrieval.

```sql
CREATE TABLE IF NOT EXISTS rag_chunks (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  embedding    TEXT NOT NULL,
  start_index  INTEGER NOT NULL,
  end_index    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_chunks(document_id);
```

### `library_components`

General-purpose component library entries.

```sql
CREATE TABLE IF NOT EXISTS library_components (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  category           TEXT NOT NULL,
  content_type       TEXT NOT NULL,
  description        TEXT,
  tags               TEXT,
  content            TEXT NOT NULL,
  metadata           TEXT,
  thumbnail          TEXT,
  is_global          INTEGER NOT NULL DEFAULT 1,
  agent_accessible   INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `library_component_files`

Multi-file support for library components.

```sql
CREATE TABLE IF NOT EXISTS library_component_files (
  id             TEXT PRIMARY KEY,
  component_id   TEXT NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  content_type   TEXT NOT NULL,
  content        TEXT NOT NULL,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_entry       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lcf_component ON library_component_files(component_id);
```

### `library_embeddings`

Vector embeddings for library component semantic search.

```sql
CREATE TABLE IF NOT EXISTS library_embeddings (
  id           TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  chunk_text   TEXT NOT NULL,
  embedding    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_le_component ON library_embeddings(component_id);
```

### `library_agent_sessions`

Agent chat sessions per library component.

```sql
CREATE TABLE IF NOT EXISTS library_agent_sessions (
  id             TEXT PRIMARY KEY,
  component_id   TEXT NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  title          TEXT,
  messages_json  TEXT NOT NULL DEFAULT '[]',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_las_component ON library_agent_sessions(component_id);
```

### `library_folders`

Organizational folders for library components.

```sql
CREATE TABLE IF NOT EXISTS library_folders (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  color             TEXT NOT NULL DEFAULT '#6366f1',
  icon              TEXT NOT NULL DEFAULT 'folder',
  sort_order        INTEGER NOT NULL DEFAULT 0,
  agent_accessible  INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `python_projects`

Python executor project files.

```sql
CREATE TABLE IF NOT EXISTS python_projects (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  files_json    TEXT NOT NULL DEFAULT '[]',
  settings_json TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Seed Data

On startup, if the `models` table is empty:

```sql
INSERT OR IGNORE INTO models (name, description, context_window_size, active)
VALUES ('gemini-2.5-flash-preview-09-2025', 'Google''s fast and versatile model.', 1000000, 1);
```

---

## ER Relationships

```
models ──────────────┬──── conversations ──── messages
                     │         (model_id)       (conversation_id)

library_folders ─────┤
                     │
library_components ──┼──── library_component_files  (component_id)
                     ├──── library_embeddings       (component_id)
                     └──── library_agent_sessions   (component_id)

skema_projects ──────┬──── skema_agent_sessions     (project_id)
                     │
skema_components ────┴──── skema_component_embeddings (component_id)

rag_documents ─────────── rag_chunks                 (document_id)

python_projects       (standalone)
```
