export const SCHEMA_SQL = `
-- Migration tracking
CREATE TABLE IF NOT EXISTS _migrations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Models table
CREATE TABLE IF NOT EXISTS models (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  context_window_size INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  api_key TEXT,
  provider TEXT,
  system_instruction TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  title TEXT,
  model_id INTEGER NOT NULL REFERENCES models(id),
  type TEXT NOT NULL DEFAULT 'chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  message_order INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  token_count INTEGER,
  prompt_tokens INTEGER,
  candidates_tokens INTEGER,
  generated_images TEXT,
  search_annotations TEXT,
  attachments TEXT,
  UNIQUE(conversation_id, message_order)
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- Skema projects table
CREATE TABLE IF NOT EXISTS skema_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_type TEXT NOT NULL DEFAULT 'canvas',
  boards_json TEXT NOT NULL,
  images_json TEXT,
  theme_json TEXT,
  full_design_spec_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RAG documents table
CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- Skema component library
CREATE TABLE IF NOT EXISTS skema_components (
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
  is_global BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skema_component_embeddings (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES skema_components(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sce_component ON skema_component_embeddings(component_id);

-- Library folders (must come before library_components due to FK)
CREATE TABLE IF NOT EXISTS library_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT 'folder',
  sort_order INTEGER NOT NULL DEFAULT 0,
  agent_accessible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  is_global BOOLEAN NOT NULL DEFAULT TRUE,
  agent_accessible BOOLEAN NOT NULL DEFAULT TRUE,
  folder_id VARCHAR(50) REFERENCES library_folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lc_folder ON library_components(folder_id);

CREATE TABLE IF NOT EXISTS library_embeddings (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_le_component ON library_embeddings(component_id);

-- Library component files (multi-file support)
CREATE TABLE IF NOT EXISTS library_component_files (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_entry BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lcf_component ON library_component_files(component_id);

-- Library agent chat sessions (per-component)
CREATE TABLE IF NOT EXISTS library_agent_sessions (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  title TEXT,
  messages_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_las_component ON library_agent_sessions(component_id);

-- Skema agent chat sessions (per-project)
CREATE TABLE IF NOT EXISTS skema_agent_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES skema_projects(id) ON DELETE CASCADE,
  board_idx INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  messages_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sas_project ON skema_agent_sessions(project_id);

-- Python executor projects
CREATE TABLE IF NOT EXISTS python_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  files_json TEXT NOT NULL DEFAULT '[]',
  settings_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Database explorer connections
CREATE TABLE IF NOT EXISTS database_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 5432,
  database_name TEXT NOT NULL,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  ssl BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Builder: tools
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

-- Agent Builder: agents
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

-- Agent Builder: agent <-> tool junction
CREATE TABLE IF NOT EXISTS agent_builder_agent_tools (
  agent_id TEXT NOT NULL REFERENCES agent_builder_agents(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL REFERENCES agent_builder_tools(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, tool_id)
);

-- Agent Builder: workflows (canvas graph)
CREATE TABLE IF NOT EXISTS agent_builder_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Untitled Workflow',
  description TEXT,
  graph_json JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Builder: workflow <-> agent junction
CREATE TABLE IF NOT EXISTS agent_builder_workflow_agents (
  workflow_id TEXT NOT NULL REFERENCES agent_builder_workflows(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agent_builder_agents(id) ON DELETE CASCADE,
  PRIMARY KEY (workflow_id, agent_id)
);

-- Agent Builder: workflow <-> tool junction
CREATE TABLE IF NOT EXISTS agent_builder_workflow_tools (
  workflow_id TEXT NOT NULL REFERENCES agent_builder_workflows(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL REFERENCES agent_builder_tools(id) ON DELETE CASCADE,
  PRIMARY KEY (workflow_id, tool_id)
);

-- Agent Builder: chat sessions per agent
CREATE TABLE IF NOT EXISTS agent_builder_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_builder_agents(id) ON DELETE CASCADE,
  title TEXT,
  messages_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_abs_agent ON agent_builder_sessions(agent_id);

-- Agent Builder: visual workflow execution engine
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  custom_id TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT 'Untitled Workflow',
  description TEXT,
  category TEXT DEFAULT 'custom',
  tags TEXT DEFAULT '[]',
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  current_node_id TEXT,
  node_results JSONB NOT NULL DEFAULT '{}',
  variables JSONB NOT NULL DEFAULT '{}',
  input JSONB,
  output JSONB,
  error TEXT,
  thread_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'custom',
  auth_type TEXT DEFAULT 'none',
  access_token TEXT,
  tools JSONB DEFAULT '[]',
  connection_status TEXT DEFAULT 'untested',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  headers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  approval_id TEXT UNIQUE NOT NULL,
  workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,
  execution_id TEXT,
  node_id TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_llm_keys (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_prefix TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_custom_id ON workflows(custom_id);
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_approval_id ON approvals(approval_id);
`;

export const SEED_SQL = `
INSERT INTO models (name, description, context_window_size, active)
VALUES ('gemini-2.5-flash-preview-09-2025', 'Google''s fast and versatile model.', 1000000, TRUE)
ON CONFLICT (name) DO NOTHING;
`;
