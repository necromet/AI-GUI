export const SCHEMA_SQL = `
-- Models table
CREATE TABLE IF NOT EXISTS models (
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
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  model_id INTEGER NOT NULL REFERENCES models(id),
  type TEXT NOT NULL DEFAULT 'chat',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  message_order INTEGER NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  token_count INTEGER,
  prompt_tokens INTEGER,
  candidates_tokens INTEGER,
  generated_images TEXT,
  search_annotations TEXT,
  attachments TEXT,
  UNIQUE(conversation_id, message_order)
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- Stitch projects table
CREATE TABLE IF NOT EXISTS stitch_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_type TEXT NOT NULL DEFAULT 'website',
  boards_json TEXT NOT NULL,
  images_json TEXT,
  theme_json TEXT,
  full_design_spec_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- RAG documents table
CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- RAG chunks table
CREATE TABLE IF NOT EXISTS rag_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  embedding TEXT NOT NULL,
  start_index INTEGER NOT NULL,
  end_index INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_chunks(document_id);

-- Stitch component library
CREATE TABLE IF NOT EXISTS stitch_components (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  content_type TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'all',
  description TEXT,
  tags TEXT,
  content TEXT NOT NULL,
  spec_snippet TEXT,
  thumbnail TEXT,
  is_global INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stitch_component_embeddings (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES stitch_components(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sce_component ON stitch_component_embeddings(component_id);

-- General-purpose component library
CREATE TABLE IF NOT EXISTS library_components (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  content_type TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  content TEXT NOT NULL,
  metadata TEXT,
  thumbnail TEXT,
  is_global INTEGER NOT NULL DEFAULT 1,
  agent_accessible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS library_embeddings (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_le_component ON library_embeddings(component_id);
`;

export const SEED_SQL = `
INSERT OR IGNORE INTO models (name, description, context_window_size, active)
VALUES ('gemini-2.5-flash-preview-09-2025', 'Google''s fast and versatile model.', 1000000, 1);
`;
