-- edward:labs PostgreSQL DDL
-- Database: edlab

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Models table
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

-- Conversations table
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

-- Messages table
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

-- Skema projects table
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

-- Skema components table
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

-- Skema component embeddings (TEXT — pgvector not installed)
CREATE TABLE IF NOT EXISTS skema_component_embeddings (
  id           VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  component_id VARCHAR(50) NOT NULL REFERENCES skema_components(id) ON DELETE CASCADE,
  chunk_text   TEXT NOT NULL,
  embedding    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sce_component ON skema_component_embeddings(component_id);

-- Skema agent sessions
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

-- RAG documents
CREATE TABLE IF NOT EXISTS rag_documents (
  id           VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name         TEXT NOT NULL,
  type         VARCHAR(50) NOT NULL,
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RAG chunks (TEXT — pgvector not installed)
CREATE TABLE IF NOT EXISTS rag_chunks (
  id           VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id  VARCHAR(50) NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  embedding    TEXT NOT NULL,
  start_index  INTEGER NOT NULL,
  end_index    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_chunks(document_id);

-- Library components
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

-- Library component files
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

-- Library embeddings (TEXT — pgvector not installed)
CREATE TABLE IF NOT EXISTS library_embeddings (
  id           VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  component_id VARCHAR(50) NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  chunk_text   TEXT NOT NULL,
  embedding    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_le_component ON library_embeddings(component_id);

-- Library agent sessions
CREATE TABLE IF NOT EXISTS library_agent_sessions (
  id             VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  component_id   VARCHAR(50) NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  title          TEXT,
  messages_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_las_component ON library_agent_sessions(component_id);

-- Library folders
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

-- Python projects
CREATE TABLE IF NOT EXISTS python_projects (
  id             VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title          TEXT NOT NULL,
  description    TEXT,
  files_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings_json  JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed data
INSERT INTO models (name, description, context_window_size, active)
VALUES ('gemini-2.5-flash-preview-09-2025', 'Google''s fast and versatile model.', 1000000, TRUE)
ON CONFLICT (name) DO NOTHING;
