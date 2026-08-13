import { getAll, getOne, run, runReturning, transaction } from '../db/pg';
import { getEmbedding, cosineSimilarity } from './embeddingService';
import { safeJsonParse } from '../lib/safeJsonParse';

export interface LibraryComponent {
  id: string;
  name: string;
  category: 'ui-widget' | 'template' | 'theme' | 'python';
  contentType: 'tsx' | 'html' | 'css' | 'js' | 'json' | 'markdown' | 'python';
  description: string;
  tags: string[];
  content: string;
  metadata?: Record<string, any>;
  thumbnail?: string;
  isGlobal: boolean;
  agentAccessible: boolean;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
  files?: LibraryComponentFile[];
}

export interface LibraryComponentFile {
  id: string;
  componentId: string;
  filename: string;
  contentType: 'tsx' | 'html' | 'css' | 'js' | 'json' | 'markdown' | 'python';
  content: string;
  sortOrder: number;
  isEntry: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryComponentWithScore extends LibraryComponent {
  score: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function rowToFile(row: any): LibraryComponentFile {
  return {
    id: row.id,
    componentId: row.component_id,
    filename: row.filename,
    contentType: row.content_type,
    content: row.content,
    sortOrder: row.sort_order,
    isEntry: row.is_entry === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToComponent(row: any): LibraryComponent {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    contentType: row.content_type,
    description: row.description || '',
    tags: safeJsonParse(row.tags, []),
    content: row.content,
    metadata: safeJsonParse(row.metadata, undefined),
    thumbnail: row.thumbnail || undefined,
    isGlobal: row.is_global === true,
    agentAccessible: row.agent_accessible === true,
    folderId: row.folder_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getComponentFiles(componentId: string): Promise<LibraryComponentFile[]> {
  const rows = await getAll('SELECT * FROM library_component_files WHERE component_id = $1 ORDER BY sort_order ASC', [componentId]);
  return rows.map(rowToFile);
}

async function getComponentFilesBatch(componentIds: string[]): Promise<Map<string, LibraryComponentFile[]>> {
  const map = new Map<string, LibraryComponentFile[]>();
  if (componentIds.length === 0) return map;
  const rows = await getAll('SELECT * FROM library_component_files WHERE component_id = ANY($1) ORDER BY sort_order ASC', [componentIds]);
  for (const row of rows) {
    const file = rowToFile(row);
    const list = map.get(file.componentId);
    if (list) list.push(file);
    else map.set(file.componentId, [file]);
  }
  for (const id of componentIds) {
    if (!map.has(id)) map.set(id, []);
  }
  return map;
}

export async function addComponentFile(file: Omit<LibraryComponentFile, 'id' | 'createdAt' | 'updatedAt'>): Promise<LibraryComponentFile> {
  const id = generateId();
  const now = new Date().toISOString();

  await run(
    `INSERT INTO library_component_files (id, component_id, filename, content_type, content, sort_order, is_entry, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, file.componentId, file.filename, file.contentType, file.content, file.sortOrder, file.isEntry, now, now]
  );
  await run(`UPDATE library_components SET updated_at = $1 WHERE id = $2`, [now, file.componentId]);

  return { ...file, id, createdAt: now, updatedAt: now };
}

export async function updateComponentFile(id: string, updates: Partial<Omit<LibraryComponentFile, 'id' | 'componentId' | 'createdAt' | 'updatedAt'>>): Promise<LibraryComponentFile | undefined> {
  const existing = await getOne('SELECT * FROM library_component_files WHERE id = $1', [id]);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const merged = rowToFile({ ...existing, ...updates, updated_at: now });

  await run(
    `UPDATE library_component_files SET filename = $1, content_type = $2, content = $3, sort_order = $4, is_entry = $5, updated_at = $6 WHERE id = $7`,
    [merged.filename, merged.contentType, merged.content, merged.sortOrder, merged.isEntry, now, id]
  );
  await run(`UPDATE library_components SET updated_at = $1 WHERE id = $2`, [now, existing.component_id]);

  return { ...merged, updatedAt: now };
}

export async function deleteComponentFile(id: string): Promise<boolean> {
  const existing = await getOne('SELECT component_id FROM library_component_files WHERE id = $1', [id]);
  const result = await run('DELETE FROM library_component_files WHERE id = $1', [id]);
  if (result.rowCount > 0 && existing) {
    const now = new Date().toISOString();
    await run(`UPDATE library_components SET updated_at = $1 WHERE id = $2`, [now, existing.component_id]);
  }
  return result.rowCount > 0;
}

export async function replaceComponentFiles(componentId: string, files: Omit<LibraryComponentFile, 'id' | 'componentId' | 'createdAt' | 'updatedAt'>[]): Promise<LibraryComponentFile[]> {
  await run('DELETE FROM library_component_files WHERE component_id = $1', [componentId]);
  const results: LibraryComponentFile[] = [];
  const now = new Date().toISOString();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const id = generateId();
    await run(
      `INSERT INTO library_component_files (id, component_id, filename, content_type, content, sort_order, is_entry, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, componentId, f.filename, f.contentType, f.content, f.sortOrder ?? i, f.isEntry, now, now]
    );
    results.push({ ...f, id, componentId, createdAt: now, updatedAt: now });
  }
  await run(`UPDATE library_components SET updated_at = $1 WHERE id = $2`, [now, componentId]);
  return results;
}

const EXT_TO_CT: Record<string, LibraryComponentFile['contentType']> = {
  html: 'html', htm: 'html', css: 'css', js: 'js', jsx: 'tsx',
  ts: 'tsx', tsx: 'tsx', json: 'json', md: 'markdown', markdown: 'markdown',
};

export async function writeComponentFile(
  componentId: string,
  filename: string,
  content: string,
): Promise<LibraryComponentFile> {
  const existingFiles = await getComponentFiles(componentId);
  const existing = existingFiles.find(f => f.filename === filename);

  if (existing) {
    const updated = await updateComponentFile(existing.id, { content });
    return updated!;
  }

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const contentType = EXT_TO_CT[ext] || 'js';

  return addComponentFile({
    componentId,
    filename,
    contentType,
    content,
    sortOrder: existingFiles.length,
    isEntry: existingFiles.length === 0,
  });
}

export async function addComponent(component: Omit<LibraryComponent, 'id' | 'createdAt' | 'updatedAt'> & { files?: Omit<LibraryComponentFile, 'id' | 'componentId' | 'createdAt' | 'updatedAt'>[] }): Promise<LibraryComponent> {
  const id = generateId();
  const now = new Date().toISOString();

  await run(
    `INSERT INTO library_components (id, name, category, content_type, description, tags, content, metadata, thumbnail, is_global, agent_accessible, folder_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [id, component.name, component.category, component.contentType, component.description, JSON.stringify(component.tags), component.content, component.metadata ? JSON.stringify(component.metadata) : null, component.thumbnail || null, component.isGlobal, component.agentAccessible, component.folderId || null, now, now]
  );

  const createdFiles: LibraryComponentFile[] = [];
  if (component.files && component.files.length > 0) {
    for (let i = 0; i < component.files.length; i++) {
      const f = component.files[i];
      createdFiles.push(await addComponentFile({
        componentId: id,
        filename: f.filename,
        contentType: f.contentType,
        content: f.content,
        sortOrder: f.sortOrder ?? i,
        isEntry: f.isEntry ?? (i === 0),
      }));
    }
  } else {
    const FILENAME_MAP: Record<string, string> = {
      html: 'index.html', tsx: 'Component.tsx', css: 'style.css', js: 'script.js', ts: 'script.ts', json: 'data.json', markdown: 'README.md',
    };
    const filename = FILENAME_MAP[component.contentType] || `file.${component.contentType}`;
    createdFiles.push(await addComponentFile({
      componentId: id,
      filename,
      contentType: component.contentType,
      content: component.content,
      sortOrder: 0,
      isEntry: true,
    }));
  }

  const embedText = [component.name, component.description, component.tags.join(' '), component.category].join(' ');
  const embedding = await getEmbedding(embedText);

  await run(
    'INSERT INTO library_embeddings (id, component_id, chunk_text, embedding) VALUES ($1, $2, $3, $4)',
    [generateId(), id, embedText, JSON.stringify(embedding)]
  );

  return {
    ...component,
    id,
    createdAt: now,
    updatedAt: now,
    files: createdFiles,
  };
}

export interface ListComponentsResult {
  components: LibraryComponent[];
  total: number;
  hasMore: boolean;
}

export async function listComponents(filters?: { category?: string; agentAccessibleOnly?: boolean; folderId?: string | null; limit?: number; offset?: number }): Promise<ListComponentsResult> {
  let whereSql = 'WHERE 1=1';
  const params: any[] = [];
  let paramIdx = 1;

  if (filters?.category) {
    whereSql += ` AND category = $${paramIdx++}`;
    params.push(filters.category);
  }
  if (filters?.agentAccessibleOnly) {
    whereSql += ' AND agent_accessible = TRUE';
  }
  if (filters?.folderId !== undefined) {
    if (filters.folderId === null) {
      whereSql += ' AND folder_id IS NULL';
    } else {
      whereSql += ` AND folder_id = $${paramIdx++}`;
      params.push(filters.folderId);
    }
  }

  const countRow = await getOne(`SELECT COUNT(*) as c FROM library_components ${whereSql}`, params);
  const total = Number(countRow?.c) || 0;

  const limit = filters?.limit ?? 24;
  const offset = filters?.offset ?? 0;

  const sql = `SELECT * FROM library_components ${whereSql} ORDER BY updated_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  const rows = await getAll(sql, [...params, limit, offset]);

  const components: LibraryComponent[] = [];
  const componentIds = rows.map(r => r.id);
  const filesMap = await getComponentFilesBatch(componentIds);
  for (const row of rows) {
    const comp = rowToComponent(row);
    comp.files = filesMap.get(comp.id) || [];
    components.push(comp);
  }

  return { components, total, hasMore: offset + limit < total };
}

export async function getComponent(id: string): Promise<LibraryComponent | undefined> {
  const row = await getOne('SELECT * FROM library_components WHERE id = $1', [id]);
  if (!row) return undefined;
  const comp = rowToComponent(row);
  comp.files = await getComponentFiles(comp.id);
  return comp;
}

export async function updateComponent(id: string, updates: Partial<Omit<LibraryComponent, 'id' | 'createdAt' | 'updatedAt'>> & { files?: Omit<LibraryComponentFile, 'id' | 'componentId' | 'createdAt' | 'updatedAt'>[] }): Promise<LibraryComponent | undefined> {
  const existing = await getComponent(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const { files, ...componentUpdates } = updates;
  const merged = { ...existing, ...componentUpdates, updatedAt: now };

  await run(
    `UPDATE library_components SET name = $1, category = $2, content_type = $3, description = $4, tags = $5, content = $6, metadata = $7, thumbnail = $8, is_global = $9, agent_accessible = $10, folder_id = $11, updated_at = $12 WHERE id = $13`,
    [merged.name, merged.category, merged.contentType, merged.description, JSON.stringify(merged.tags), merged.content, merged.metadata ? JSON.stringify(merged.metadata) : null, merged.thumbnail || null, merged.isGlobal, merged.agentAccessible, merged.folderId || null, now, id]
  );

  let updatedFiles: LibraryComponentFile[] | undefined;
  if (files) {
    updatedFiles = await replaceComponentFiles(id, files);
  }

  const embedText = [merged.name, merged.description, merged.tags.join(' '), merged.category].join(' ');
  getEmbedding(embedText).then(async (embedding) => {
    await run('DELETE FROM library_embeddings WHERE component_id = $1', [id]);
    await run(
      'INSERT INTO library_embeddings (id, component_id, chunk_text, embedding) VALUES ($1, $2, $3, $4)',
      [generateId(), id, embedText, JSON.stringify(embedding)]
    );
  }).catch(err => console.error('[library] Failed to update embedding:', err.message));

  return { ...merged, files: updatedFiles ?? existing.files };
}

export async function deleteComponent(id: string): Promise<boolean> {
  const result = await run('DELETE FROM library_components WHERE id = $1', [id]);
  return result.rowCount > 0;
}

export async function searchComponents(query: string, topK: number = 10, agentAccessibleOnly: boolean = false): Promise<LibraryComponentWithScore[]> {
  let sql = 'SELECT lc.*, le.embedding, le.chunk_text FROM library_embeddings le JOIN library_components lc ON le.component_id = lc.id';
  const params: any[] = [];

  if (agentAccessibleOnly) {
    sql += ' WHERE lc.agent_accessible = TRUE';
  }

  const rows = await getAll(sql, params);
  if (rows.length === 0) return [];

  const queryEmbedding = await getEmbedding(query);

  const scored = rows.map(row => {
    const embedding = safeJsonParse(row.embedding, []);
    const score = cosineSimilarity(queryEmbedding, embedding);
    return {
      component: rowToComponent(row),
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const results: LibraryComponentWithScore[] = [];
  for (const s of scored.slice(0, topK)) {
    const comp: LibraryComponentWithScore = { ...s.component, score: s.score };
    comp.files = await getComponentFiles(comp.id);
    results.push(comp);
  }
  return results;
}

export async function reindexAll(): Promise<number> {
  const components = await getAll('SELECT * FROM library_components');

  await run('DELETE FROM library_embeddings');

  for (const row of components) {
    const embedText = [row.name, row.description || '', safeJsonParse(row.tags, [] as string[]).join(' '), row.category].join(' ');
    const embedding = await getEmbedding(embedText);
    await run(
      'INSERT INTO library_embeddings (id, component_id, chunk_text, embedding) VALUES ($1, $2, $3, $4)',
      [generateId(), row.id, embedText, JSON.stringify(embedding)]
    );
  }

  return components.length;
}

export async function getCategories(): Promise<{ category: string; count: number }[]> {
  const rows = await getAll(
    'SELECT category, COUNT(*) as count FROM library_components GROUP BY category ORDER BY count DESC'
  );
  return rows.map(r => ({ category: r.category, count: Number(r.count) }));
}

export async function getStats(): Promise<{ total: number; categories: number; agentAccessible: number }> {
  const totalRow = await getOne('SELECT COUNT(*) as c FROM library_components');
  const catRow = await getOne('SELECT COUNT(DISTINCT category) as c FROM library_components');
  const aaRow = await getOne('SELECT COUNT(*) as c FROM library_components WHERE agent_accessible = TRUE');
  return { total: Number(totalRow?.c), categories: Number(catRow?.c), agentAccessible: Number(aaRow?.c) };
}

// ===== Library Agent Session CRUD =====

export interface LibraryAgentSession {
  id: string;
  componentId: string;
  title: string | null;
  messagesJson: string;
  createdAt: string;
  updatedAt: string;
}

function rowToSession(row: any): LibraryAgentSession {
  return {
    id: row.id,
    componentId: row.component_id,
    title: row.title,
    messagesJson: row.messages_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const MAX_SESSIONS_PER_COMPONENT = 20;

export async function createSession(componentId: string, title?: string): Promise<LibraryAgentSession> {
  const id = generateId();
  const now = new Date().toISOString();

  const existing = await getOne(
    'SELECT COUNT(*) as c FROM library_agent_sessions WHERE component_id = $1',
    [componentId]
  );
  if (existing && Number(existing.c) >= MAX_SESSIONS_PER_COMPONENT) {
    const oldest = await getOne(
      'SELECT id FROM library_agent_sessions WHERE component_id = $1 ORDER BY updated_at ASC LIMIT 1',
      [componentId]
    );
    if (oldest) {
      await run('DELETE FROM library_agent_sessions WHERE id = $1', [oldest.id]);
    }
  }

  await run(
    'INSERT INTO library_agent_sessions (id, component_id, title, messages_json, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, componentId, title || null, '[]', now, now]
  );

  return { id, componentId: componentId, title: title || null, messagesJson: '[]', createdAt: now, updatedAt: now };
}

export async function getSession(id: string): Promise<LibraryAgentSession | undefined> {
  const row = await getOne('SELECT * FROM library_agent_sessions WHERE id = $1', [id]);
  return row ? rowToSession(row) : undefined;
}

export async function getSessionsByComponent(componentId: string, limit: number = 3): Promise<LibraryAgentSession[]> {
  const rows = await getAll(
    'SELECT * FROM library_agent_sessions WHERE component_id = $1 ORDER BY updated_at DESC LIMIT $2',
    [componentId, limit]
  );
  return rows.map(rowToSession);
}

export async function updateSessionMessages(id: string, messages: any[]): Promise<void> {
  const now = new Date().toISOString();
  await run(
    "UPDATE library_agent_sessions SET messages_json = $1, updated_at = $2 WHERE id = $3",
    [JSON.stringify(messages), now, id]
  );
}

export async function updateSessionTitle(id: string, title: string): Promise<void> {
  const now = new Date().toISOString();
  await run(
    "UPDATE library_agent_sessions SET title = $1, updated_at = $2 WHERE id = $3",
    [title, now, id]
  );
}

export async function deleteSession(id: string): Promise<boolean> {
  const result = await run('DELETE FROM library_agent_sessions WHERE id = $1', [id]);
  return result.rowCount > 0;
}

// ===== Library Folder CRUD =====

export interface LibraryFolder {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  sortOrder: number;
  agentAccessible: boolean;
  createdAt: string;
  updatedAt: string;
  componentCount?: number;
}

function rowToFolder(row: any): LibraryFolder {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    color: row.color || '#6366f1',
    icon: row.icon || 'folder',
    sortOrder: row.sort_order ?? 0,
    agentAccessible: row.agent_accessible === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    componentCount: row.component_count != null ? Number(row.component_count) : undefined,
  };
}

export async function addFolder(folder: Omit<LibraryFolder, 'id' | 'createdAt' | 'updatedAt' | 'componentCount'>): Promise<LibraryFolder> {
  const id = generateId();
  const now = new Date().toISOString();

  await run(
    `INSERT INTO library_folders (id, name, description, color, icon, sort_order, agent_accessible, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, folder.name, folder.description || '', folder.color || '#6366f1', folder.icon || 'folder', folder.sortOrder ?? 0, folder.agentAccessible, now, now]
  );

  return { ...folder, id, createdAt: now, updatedAt: now };
}

export async function listFolders(): Promise<LibraryFolder[]> {
  const rows = await getAll(
    `SELECT f.*, (SELECT COUNT(*) FROM library_components c WHERE c.folder_id = f.id) as component_count
     FROM library_folders f
     ORDER BY f.sort_order ASC, f.created_at ASC`
  );
  return rows.map(rowToFolder);
}

export async function getFolder(id: string): Promise<LibraryFolder | undefined> {
  const row = await getOne(
    `SELECT f.*, (SELECT COUNT(*) FROM library_components c WHERE c.folder_id = f.id) as component_count
     FROM library_folders f
     WHERE f.id = $1`,
    [id]
  );
  return row ? rowToFolder(row) : undefined;
}

export async function updateFolder(id: string, updates: Partial<Omit<LibraryFolder, 'id' | 'createdAt' | 'updatedAt' | 'componentCount'>>): Promise<LibraryFolder | undefined> {
  const existing = await getOne('SELECT * FROM library_folders WHERE id = $1', [id]);
  if (!existing) return undefined;

  const now = new Date().toISOString();

  await run(
    `UPDATE library_folders SET name = $1, description = $2, color = $3, icon = $4, sort_order = $5, agent_accessible = $6, updated_at = $7 WHERE id = $8`,
    [updates.name ?? existing.name, updates.description ?? existing.description, updates.color ?? existing.color, updates.icon ?? existing.icon, updates.sortOrder ?? existing.sort_order, updates.agentAccessible !== undefined ? updates.agentAccessible : existing.agent_accessible, now, id]
  );

  return getFolder(id);
}

export async function deleteFolder(id: string): Promise<boolean> {
  await run('UPDATE library_components SET folder_id = NULL WHERE folder_id = $1', [id]);
  const result = await run('DELETE FROM library_folders WHERE id = $1', [id]);
  return result.rowCount > 0;
}

export async function moveComponentToFolder(componentId: string, folderId: string | null): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await run('UPDATE library_components SET folder_id = $1, updated_at = $2 WHERE id = $3', [folderId, now, componentId]);
  return result.rowCount > 0;
}

export async function getComponentsInFolder(folderId: string): Promise<LibraryComponent[]> {
  const rows = await getAll('SELECT * FROM library_components WHERE folder_id = $1 ORDER BY updated_at DESC', [folderId]);
  const results: LibraryComponent[] = [];
  for (const row of rows) {
    const comp = rowToComponent(row);
    comp.files = await getComponentFiles(comp.id);
    results.push(comp);
  }
  return results;
}
