# Database DDL — edward:labs (PostgreSQL)

PostgreSQL equivalent of the SQLite schema in `server/db/schema.ts`. Uses `pgvector` for vector similarity search, `JSONB` for structured JSON columns, and `TIMESTAMPTZ` for timestamps.

---

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector for embedding search
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()
```

---

## Tables

### `models`

LLM model configurations.

```sql
CREATE TABLE IF NOT EXISTS models (
  id                    SERIAL PRIMARY KEY,
  name                  VARCHAR(255) NOT NULL UNIQUE,
  description           TEXT,
  context_window_size   INTEGER,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  api_key               TEXT,
  provider              VARCHAR(100),
  system_instruction    TEXT,
  is_custom             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `conversations`

Chat conversations linked to a model.

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id          SERIAL PRIMARY KEY,
  title       TEXT,
  model_id    INTEGER NOT NULL REFERENCES models(id),
  type        VARCHAR(50) NOT NULL DEFAULT 'chat',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_type    ON conversations(type);
```

### `messages`

Individual chat messages within a conversation.

```sql
CREATE TABLE IF NOT EXISTS messages (
  id                 SERIAL PRIMARY KEY,
  conversation_id    INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role               VARCHAR(50) NOT NULL,
  content            TEXT NOT NULL,
  message_order      INTEGER NOT NULL,
  timestamp          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  token_count        INTEGER,
  prompt_tokens      INTEGER,
  candidates_tokens  INTEGER,
  generated_images   JSONB,
  search_annotations JSONB,
  attachments        JSONB,
  UNIQUE(conversation_id, message_order)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
```

### `skema_projects`

Visual design projects (Skema feature).

```sql
CREATE TABLE IF NOT EXISTS skema_projects (
  id                     VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title                  TEXT NOT NULL,
  description            TEXT,
  project_type           VARCHAR(50) NOT NULL DEFAULT 'canvas',
  boards_json            JSONB NOT NULL,
  images_json            JSONB,
  theme_json             JSONB,
  full_design_spec_json  JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `skema_components`

Skema component library (visual design building blocks).

```sql
CREATE TABLE IF NOT EXISTS skema_components (
  id             VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name           TEXT NOT NULL,
  category       VARCHAR(100) NOT NULL,
  content_type   VARCHAR(50) NOT NULL,
  project_type   VARCHAR(50) NOT NULL DEFAULT 'all',
  description    TEXT,
  tags           JSONB,
  content        TEXT NOT NULL,
  spec_snippet   TEXT,
  thumbnail      TEXT,
  is_global      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `skema_component_embeddings`

Vector embeddings for skema component semantic search.

```sql
CREATE TABLE IF NOT EXISTS skema_component_embeddings (
  id           VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  component_id VARCHAR(50) NOT NULL REFERENCES skema_components(id) ON DELETE CASCADE,
  chunk_text   TEXT NOT NULL,
  embedding    vector(1536)                 -- OpenAI text-embedding-3-small dimensions
);

CREATE INDEX IF NOT EXISTS idx_sce_component ON skema_component_embeddings(component_id);
```

### `skema_agent_sessions`

Agent chat sessions per Skema project/board.

```sql
CREATE TABLE IF NOT EXISTS skema_agent_sessions (
  id             VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id     VARCHAR(50) NOT NULL REFERENCES skema_projects(id) ON DELETE CASCADE,
  board_idx      INTEGER NOT NULL DEFAULT 0,
  title          TEXT,
  messages_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sas_project ON skema_agent_sessions(project_id);
```

### `rag_documents`

Uploaded RAG documents.

```sql
CREATE TABLE IF NOT EXISTS rag_documents (
  id           VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name         TEXT NOT NULL,
  type         VARCHAR(50) NOT NULL,
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `rag_chunks`

Text chunks with vector embeddings for RAG retrieval.

```sql
CREATE TABLE IF NOT EXISTS rag_chunks (
  id           VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id  VARCHAR(50) NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  embedding    vector(1536),
  start_index  INTEGER NOT NULL,
  end_index    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_chunks(document_id);
```

### `library_components`

General-purpose component library entries.

```sql
CREATE TABLE IF NOT EXISTS library_components (
  id                 VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name               TEXT NOT NULL,
  category           VARCHAR(100) NOT NULL,
  content_type       VARCHAR(50) NOT NULL,
  description        TEXT,
  tags               JSONB,
  content            TEXT NOT NULL,
  metadata           JSONB,
  thumbnail          TEXT,
  is_global          BOOLEAN NOT NULL DEFAULT TRUE,
  agent_accessible   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `library_component_files`

Multi-file support for library components.

```sql
CREATE TABLE IF NOT EXISTS library_component_files (
  id             VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  component_id   VARCHAR(50) NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  filename       VARCHAR(255) NOT NULL,
  content_type   VARCHAR(50) NOT NULL,
  content        TEXT NOT NULL,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_entry       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lcf_component ON library_component_files(component_id);
```

### `library_embeddings`

Vector embeddings for library component semantic search.

```sql
CREATE TABLE IF NOT EXISTS library_embeddings (
  id           VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  component_id VARCHAR(50) NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  chunk_text   TEXT NOT NULL,
  embedding    vector(1536)
);

CREATE INDEX IF NOT EXISTS idx_le_component ON library_embeddings(component_id);
```

### `library_agent_sessions`

Agent chat sessions per library component.

```sql
CREATE TABLE IF NOT EXISTS library_agent_sessions (
  id             VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  component_id   VARCHAR(50) NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  title          TEXT,
  messages_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_las_component ON library_agent_sessions(component_id);
```

### `library_folders`

Organizational folders for library components.

```sql
CREATE TABLE IF NOT EXISTS library_folders (
  id                VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name              TEXT NOT NULL,
  description       TEXT,
  color             VARCHAR(20) NOT NULL DEFAULT '#6366f1',
  icon              VARCHAR(50) NOT NULL DEFAULT 'folder',
  sort_order        INTEGER NOT NULL DEFAULT 0,
  agent_accessible  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `python_projects`

Python executor project files.

```sql
CREATE TABLE IF NOT EXISTS python_projects (
  id             VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title          TEXT NOT NULL,
  description    TEXT,
  files_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings_json  JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Seed Data

```sql
INSERT INTO models (name, description, context_window_size, active)
VALUES ('gemini-2.5-flash-preview-09-2025', 'Google''s fast and versatile model.', 1000000, TRUE)
ON CONFLICT (name) DO NOTHING;
```

---

## Vector Search Helper

With `pgvector`, similarity search replaces the in-memory cosine similarity:

```sql
-- Find top-K library components similar to a query embedding
SELECT
  lc.id,
  lc.name,
  lc.category,
  lc.description,
  1 - (le.embedding <=> $1::vector) AS score
FROM library_embeddings le
JOIN library_components lc ON lc.id = le.component_id
ORDER BY le.embedding <=> $1::vector
LIMIT $2;
```

---

## SQLite → PostgreSQL Mapping Reference

| SQLite | PostgreSQL |
|--------|-----------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `TEXT PRIMARY KEY` | `VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text` |
| `TEXT` (general) | `TEXT` or `VARCHAR(n)` |
| `INTEGER NOT NULL DEFAULT 1` (boolean) | `BOOLEAN NOT NULL DEFAULT TRUE` |
| `datetime('now')` | `NOW()` |
| `TEXT` storing JSON | `JSONB` |
| `TEXT` storing embeddings | `vector(1536)` (pgvector) |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` |
| In-memory cosine similarity | `<=>` (vector distance operator) |

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
