import Database from 'better-sqlite3';
import pg from 'pg';
import { resolve } from 'path';

const SQLITE_PATH = resolve(process.cwd(), 'data', 'edwardlabs.db');

const pool = new pg.Pool({
  host: '13.140.162.178',
  port: 5432,
  database: 'edlab',
  user: 'postgres',
  password: process.env.PG_PASSWORD,
});

async function migrate() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const client = await pool.connect();

  try {
    // ========== MODELS ==========
    const models = sqlite.prepare('SELECT * FROM models').all();
    console.log(`models: ${models.length} rows`);
    for (const m of models) {
      await client.query(
        `INSERT INTO models (id, name, description, context_window_size, active, api_key, provider, system_instruction, is_custom, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [m.id, m.name, m.description, m.context_window_size, m.active === 1, m.api_key, m.provider, m.system_instruction, m.is_custom === 1, m.created_at]
      );
    }
    // Reset sequence
    await client.query(`SELECT setval('models_id_seq', COALESCE((SELECT MAX(id) FROM models), 1))`);

    // ========== CONVERSATIONS ==========
    const convos = sqlite.prepare('SELECT * FROM conversations').all();
    console.log(`conversations: ${convos.length} rows`);
    for (const c of convos) {
      await client.query(
        `INSERT INTO conversations (id, title, model_id, type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.title, c.model_id, c.type, c.created_at, c.updated_at]
      );
    }
    if (convos.length > 0) {
      await client.query(`SELECT setval('conversations_id_seq', COALESCE((SELECT MAX(id) FROM conversations), 1))`);
    }

    // ========== MESSAGES ==========
    const msgs = sqlite.prepare('SELECT * FROM messages').all();
    console.log(`messages: ${msgs.length} rows`);
    for (const m of msgs) {
      await client.query(
        `INSERT INTO messages (id, conversation_id, role, content, message_order, timestamp, token_count, prompt_tokens, candidates_tokens, generated_images, search_annotations, attachments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [m.id, m.conversation_id, m.role, m.content, m.message_order, m.timestamp, m.token_count, m.prompt_tokens, m.candidates_tokens, m.generated_images, m.search_annotations, m.attachments]
      );
    }
    if (msgs.length > 0) {
      await client.query(`SELECT setval('messages_id_seq', COALESCE((SELECT MAX(id) FROM messages), 1))`);
    }

    // ========== LIBRARY FOLDERS ==========
    const folders = sqlite.prepare('SELECT * FROM library_folders').all();
    console.log(`library_folders: ${folders.length} rows`);
    for (const f of folders) {
      await client.query(
        `INSERT INTO library_folders (id, name, description, color, icon, sort_order, agent_accessible, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [f.id, f.name, f.description, f.color, f.icon, f.sort_order, f.agent_accessible === 1, f.created_at, f.updated_at]
      );
    }

    // ========== LIBRARY COMPONENTS ==========
    const comps = sqlite.prepare('SELECT * FROM library_components').all();
    console.log(`library_components: ${comps.length} rows`);
    for (const c of comps) {
      await client.query(
        `INSERT INTO library_components (id, name, category, content_type, description, tags, content, metadata, thumbnail, is_global, agent_accessible, folder_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.name, c.category, c.content_type, c.description, c.tags, c.content, c.metadata, c.thumbnail, c.is_global === 1, c.agent_accessible === 1, c.folder_id || null, c.created_at, c.updated_at]
      );
    }

    // ========== LIBRARY COMPONENT FILES ==========
    const files = sqlite.prepare('SELECT * FROM library_component_files').all();
    console.log(`library_component_files: ${files.length} rows`);
    for (const f of files) {
      await client.query(
        `INSERT INTO library_component_files (id, component_id, filename, content_type, content, sort_order, is_entry, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [f.id, f.component_id, f.filename, f.content_type, f.content, f.sort_order, f.is_entry === 1, f.created_at, f.updated_at]
      );
    }

    // ========== LIBRARY EMBEDDINGS ==========
    const embeddings = sqlite.prepare('SELECT * FROM library_embeddings').all();
    console.log(`library_embeddings: ${embeddings.length} rows`);
    for (const e of embeddings) {
      await client.query(
        `INSERT INTO library_embeddings (id, component_id, chunk_text, embedding)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [e.id, e.component_id, e.chunk_text, e.embedding]
      );
    }

    // ========== LIBRARY AGENT SESSIONS ==========
    const sessions = sqlite.prepare('SELECT * FROM library_agent_sessions').all();
    console.log(`library_agent_sessions: ${sessions.length} rows`);
    for (const s of sessions) {
      await client.query(
        `INSERT INTO library_agent_sessions (id, component_id, title, messages_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.component_id, s.title, s.messages_json, s.created_at, s.updated_at]
      );
    }

    // ========== SKEMA PROJECTS ==========
    const projects = sqlite.prepare('SELECT * FROM skema_projects').all();
    console.log(`skema_projects: ${projects.length} rows`);
    for (const p of projects) {
      await client.query(
        `INSERT INTO skema_projects (id, title, description, project_type, boards_json, images_json, theme_json, full_design_spec_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.title, p.description, p.project_type || 'canvas', p.boards_json, p.images_json, p.theme_json, p.full_design_spec_json, p.created_at, p.updated_at]
      );
    }

    // ========== SKEMA COMPONENTS ==========
    const skemaComps = sqlite.prepare('SELECT * FROM skema_components').all();
    console.log(`skema_components: ${skemaComps.length} rows`);
    for (const c of skemaComps) {
      await client.query(
        `INSERT INTO skema_components (id, name, category, content_type, project_type, description, tags, content, spec_snippet, thumbnail, is_global, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.name, c.category, c.content_type, c.project_type, c.description, c.tags, c.content, c.spec_snippet, c.thumbnail, c.is_global === 1, c.created_at, c.updated_at]
      );
    }

    // ========== SKEMA COMPONENT EMBEDDINGS ==========
    const skemaEmb = sqlite.prepare('SELECT * FROM skema_component_embeddings').all();
    console.log(`skema_component_embeddings: ${skemaEmb.length} rows`);
    for (const e of skemaEmb) {
      await client.query(
        `INSERT INTO skema_component_embeddings (id, component_id, chunk_text, embedding)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [e.id, e.component_id, e.chunk_text, e.embedding]
      );
    }

    // ========== SKEMA AGENT SESSIONS ==========
    const skemaSessions = sqlite.prepare('SELECT * FROM skema_agent_sessions').all();
    console.log(`skema_agent_sessions: ${skemaSessions.length} rows`);
    for (const s of skemaSessions) {
      await client.query(
        `INSERT INTO skema_agent_sessions (id, project_id, board_idx, title, messages_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.project_id, s.board_idx, s.title, s.messages_json, s.created_at, s.updated_at]
      );
    }

    // ========== RAG DOCUMENTS ==========
    const ragDocs = sqlite.prepare('SELECT * FROM rag_documents').all();
    console.log(`rag_documents: ${ragDocs.length} rows`);
    for (const d of ragDocs) {
      await client.query(
        `INSERT INTO rag_documents (id, name, type, chunk_count, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [d.id, d.name, d.type, d.chunk_count, d.created_at]
      );
    }

    // ========== RAG CHUNKS ==========
    const ragChunks = sqlite.prepare('SELECT * FROM rag_chunks').all();
    console.log(`rag_chunks: ${ragChunks.length} rows`);
    for (const c of ragChunks) {
      await client.query(
        `INSERT INTO rag_chunks (id, document_id, text, embedding, start_index, end_index)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.document_id, c.text, c.embedding, c.start_index, c.end_index]
      );
    }

    // ========== PYTHON PROJECTS ==========
    const pyProjects = sqlite.prepare('SELECT * FROM python_projects').all();
    console.log(`python_projects: ${pyProjects.length} rows`);
    for (const p of pyProjects) {
      await client.query(
        `INSERT INTO python_projects (id, title, description, files_json, settings_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.title, p.description, p.files_json, p.settings_json, p.created_at, p.updated_at]
      );
    }

    console.log('\n=== Migration complete ===');

  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    sqlite.close();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
