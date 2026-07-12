import { getDatabase } from '../db';
import { getEmbedding, cosineSimilarity } from './embeddingService';

export interface LibraryComponent {
  id: string;
  name: string;
  category: 'ui-widget' | 'template' | 'snippet' | 'pattern' | 'hook' | 'util' | 'agent-tool';
  contentType: 'tsx' | 'html' | 'css' | 'js' | 'json' | 'markdown';
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
  contentType: 'tsx' | 'html' | 'css' | 'js' | 'json' | 'markdown';
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
    isEntry: row.is_entry === 1,
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
    tags: row.tags ? JSON.parse(row.tags) : [],
    content: row.content,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    thumbnail: row.thumbnail || undefined,
    isGlobal: row.is_global === 1,
    agentAccessible: row.agent_accessible === 1,
    folderId: row.folder_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getComponentFiles(componentId: string): LibraryComponentFile[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM library_component_files WHERE component_id = ? ORDER BY sort_order ASC').all(componentId) as any[];
  return rows.map(rowToFile);
}

export function addComponentFile(file: Omit<LibraryComponentFile, 'id' | 'createdAt' | 'updatedAt'>): LibraryComponentFile {
  const db = getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO library_component_files (id, component_id, filename, content_type, content, sort_order, is_entry, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    file.componentId,
    file.filename,
    file.contentType,
    file.content,
    file.sortOrder,
    file.isEntry ? 1 : 0,
    now,
    now,
  );

  return { ...file, id, createdAt: now, updatedAt: now };
}

export function updateComponentFile(id: string, updates: Partial<Omit<LibraryComponentFile, 'id' | 'componentId' | 'createdAt' | 'updatedAt'>>): LibraryComponentFile | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM library_component_files WHERE id = ?').get(id) as any;
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const merged = rowToFile({ ...existing, ...updates, updated_at: now });

  db.prepare(
    `UPDATE library_component_files SET filename = ?, content_type = ?, content = ?, sort_order = ?, is_entry = ?, updated_at = ? WHERE id = ?`
  ).run(
    merged.filename,
    merged.contentType,
    merged.content,
    merged.sortOrder,
    merged.isEntry ? 1 : 0,
    now,
    id,
  );

  return { ...merged, updatedAt: now };
}

export function deleteComponentFile(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM library_component_files WHERE id = ?').run(id);
  return result.changes > 0;
}

export function replaceComponentFiles(componentId: string, files: Omit<LibraryComponentFile, 'id' | 'componentId' | 'createdAt' | 'updatedAt'>[]): LibraryComponentFile[] {
  const db = getDatabase();
  db.prepare('DELETE FROM library_component_files WHERE component_id = ?').run(componentId);
  return files.map((f, i) => addComponentFile({ ...f, componentId, sortOrder: f.sortOrder ?? i }));
}

const EXT_TO_CT: Record<string, LibraryComponentFile['contentType']> = {
  html: 'html', htm: 'html', css: 'css', js: 'js', jsx: 'tsx',
  ts: 'tsx', tsx: 'tsx', json: 'json', md: 'markdown', markdown: 'markdown',
};

export function writeComponentFile(
  componentId: string,
  filename: string,
  content: string,
): LibraryComponentFile {
  const existingFiles = getComponentFiles(componentId);
  const existing = existingFiles.find(f => f.filename === filename);

  if (existing) {
    const updated = updateComponentFile(existing.id, { content });
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
  const db = getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO library_components (id, name, category, content_type, description, tags, content, metadata, thumbnail, is_global, agent_accessible, folder_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    component.name,
    component.category,
    component.contentType,
    component.description,
    JSON.stringify(component.tags),
    component.content,
    component.metadata ? JSON.stringify(component.metadata) : null,
    component.thumbnail || null,
    component.isGlobal ? 1 : 0,
    component.agentAccessible ? 1 : 0,
    component.folderId || null,
    now,
    now,
  );

  const createdFiles: LibraryComponentFile[] = [];
  if (component.files && component.files.length > 0) {
    for (let i = 0; i < component.files.length; i++) {
      const f = component.files[i];
      createdFiles.push(addComponentFile({
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
    createdFiles.push(addComponentFile({
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

  db.prepare(
    'INSERT INTO library_embeddings (id, component_id, chunk_text, embedding) VALUES (?, ?, ?, ?)'
  ).run(generateId(), id, embedText, JSON.stringify(embedding));

  return {
    ...component,
    id,
    createdAt: now,
    updatedAt: now,
    files: createdFiles,
  };
}

export function listComponents(filters?: { category?: string; agentAccessibleOnly?: boolean; folderId?: string | null }): LibraryComponent[] {
  const db = getDatabase();
  let query = 'SELECT * FROM library_components WHERE 1=1';
  const params: any[] = [];

  if (filters?.category) {
    query += ' AND category = ?';
    params.push(filters.category);
  }
  if (filters?.agentAccessibleOnly) {
    query += ' AND agent_accessible = 1';
  }
  if (filters?.folderId !== undefined) {
    if (filters.folderId === null) {
      query += ' AND folder_id IS NULL';
    } else {
      query += ' AND folder_id = ?';
      params.push(filters.folderId);
    }
  }

  query += ' ORDER BY updated_at DESC';

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map(row => {
    const comp = rowToComponent(row);
    comp.files = getComponentFiles(comp.id);
    return comp;
  });
}

export function getComponent(id: string): LibraryComponent | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM library_components WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  const comp = rowToComponent(row);
  comp.files = getComponentFiles(comp.id);
  return comp;
}

export function updateComponent(id: string, updates: Partial<Omit<LibraryComponent, 'id' | 'createdAt' | 'updatedAt'>> & { files?: Omit<LibraryComponentFile, 'id' | 'componentId' | 'createdAt' | 'updatedAt'>[] }): LibraryComponent | undefined {
  const db = getDatabase();
  const existing = getComponent(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const { files, ...componentUpdates } = updates;
  const merged = { ...existing, ...componentUpdates, updatedAt: now };

  db.prepare(
    `UPDATE library_components SET name = ?, category = ?, content_type = ?, description = ?, tags = ?, content = ?, metadata = ?, thumbnail = ?, is_global = ?, agent_accessible = ?, folder_id = ?, updated_at = ? WHERE id = ?`
  ).run(
    merged.name,
    merged.category,
    merged.contentType,
    merged.description,
    JSON.stringify(merged.tags),
    merged.content,
    merged.metadata ? JSON.stringify(merged.metadata) : null,
    merged.thumbnail || null,
    merged.isGlobal ? 1 : 0,
    merged.agentAccessible ? 1 : 0,
    merged.folderId || null,
    now,
    id,
  );

  let updatedFiles: LibraryComponentFile[] | undefined;
  if (files) {
    updatedFiles = replaceComponentFiles(id, files);
  }

  const embedText = [merged.name, merged.description, merged.tags.join(' '), merged.category].join(' ');
  getEmbedding(embedText).then(embedding => {
    const db2 = getDatabase();
    db2.prepare('DELETE FROM library_embeddings WHERE component_id = ?').run(id);
    db2.prepare(
      'INSERT INTO library_embeddings (id, component_id, chunk_text, embedding) VALUES (?, ?, ?, ?)'
    ).run(generateId(), id, embedText, JSON.stringify(embedding));
  }).catch(err => console.error('[library] Failed to update embedding:', err.message));

  return { ...merged, files: updatedFiles ?? existing.files };
}

export function deleteComponent(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM library_components WHERE id = ?').run(id);
  return result.changes > 0;
}

export async function searchComponents(query: string, topK: number = 10, agentAccessibleOnly: boolean = false): Promise<LibraryComponentWithScore[]> {
  const db = getDatabase();

  let sql = 'SELECT lc.*, le.embedding, le.chunk_text FROM library_embeddings le JOIN library_components lc ON le.component_id = lc.id';
  const params: any[] = [];

  if (agentAccessibleOnly) {
    sql += ' WHERE lc.agent_accessible = 1';
  }

  const rows = db.prepare(sql).all(...params) as any[];
  if (rows.length === 0) return [];

  const queryEmbedding = await getEmbedding(query);

  const scored = rows.map(row => {
    const embedding = JSON.parse(row.embedding);
    const score = cosineSimilarity(queryEmbedding, embedding);
    return {
      component: rowToComponent(row),
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => {
    const comp = { ...s.component, score: s.score };
    comp.files = getComponentFiles(comp.id);
    return comp;
  });
}

export async function reindexAll(): Promise<number> {
  const db = getDatabase();
  const components = db.prepare('SELECT * FROM library_components').all() as any[];

  db.prepare('DELETE FROM library_embeddings').run();

  for (const row of components) {
    const embedText = [row.name, row.description || '', row.tags ? JSON.parse(row.tags).join(' ') : '', row.category].join(' ');
    const embedding = await getEmbedding(embedText);
    db.prepare(
      'INSERT INTO library_embeddings (id, component_id, chunk_text, embedding) VALUES (?, ?, ?, ?)'
    ).run(generateId(), row.id, embedText, JSON.stringify(embedding));
  }

  return components.length;
}

export function getCategories(): { category: string; count: number }[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT category, COUNT(*) as count FROM library_components GROUP BY category ORDER BY count DESC'
  ).all() as any[];
  return rows.map(r => ({ category: r.category, count: r.count }));
}

export function getStats(): { total: number; categories: number; agentAccessible: number } {
  const db = getDatabase();
  const total = (db.prepare('SELECT COUNT(*) as c FROM library_components').get() as any).c;
  const categories = (db.prepare('SELECT COUNT(DISTINCT category) as c FROM library_components').get() as any).c;
  const agentAccessible = (db.prepare('SELECT COUNT(*) as c FROM library_components WHERE agent_accessible = 1').get() as any).c;
  return { total, categories, agentAccessible };
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

export function createSession(componentId: string, title?: string): LibraryAgentSession {
  const db = getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  const existing = db.prepare(
    'SELECT COUNT(*) as c FROM library_agent_sessions WHERE component_id = ?'
  ).get(componentId) as any;
  if (existing.c >= MAX_SESSIONS_PER_COMPONENT) {
    const oldest = db.prepare(
      'SELECT id FROM library_agent_sessions WHERE component_id = ? ORDER BY updated_at ASC LIMIT 1'
    ).get(componentId) as any;
    if (oldest) {
      db.prepare('DELETE FROM library_agent_sessions WHERE id = ?').run(oldest.id);
    }
  }

  db.prepare(
    'INSERT INTO library_agent_sessions (id, component_id, title, messages_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, componentId, title || null, '[]', now, now);

  return { id, componentId: componentId, title: title || null, messagesJson: '[]', createdAt: now, updatedAt: now };
}

export function getSession(id: string): LibraryAgentSession | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM library_agent_sessions WHERE id = ?').get(id) as any;
  return row ? rowToSession(row) : undefined;
}

export function getSessionsByComponent(componentId: string, limit: number = 3): LibraryAgentSession[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM library_agent_sessions WHERE component_id = ? ORDER BY updated_at DESC LIMIT ?'
  ).all(componentId, limit) as any[];
  return rows.map(rowToSession);
}

export function updateSessionMessages(id: string, messages: any[]): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE library_agent_sessions SET messages_json = ?, updated_at = ? WHERE id = ?"
  ).run(JSON.stringify(messages), now, id);
}

export function updateSessionTitle(id: string, title: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE library_agent_sessions SET title = ?, updated_at = ? WHERE id = ?"
  ).run(title, now, id);
}

export function deleteSession(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM library_agent_sessions WHERE id = ?').run(id);
  return result.changes > 0;
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
    agentAccessible: row.agent_accessible === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    componentCount: row.component_count ?? undefined,
  };
}

export function addFolder(folder: Omit<LibraryFolder, 'id' | 'createdAt' | 'updatedAt' | 'componentCount'>): LibraryFolder {
  const db = getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO library_folders (id, name, description, color, icon, sort_order, agent_accessible, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    folder.name,
    folder.description || '',
    folder.color || '#6366f1',
    folder.icon || 'folder',
    folder.sortOrder ?? 0,
    folder.agentAccessible ? 1 : 0,
    now,
    now,
  );

  return { ...folder, id, createdAt: now, updatedAt: now };
}

export function listFolders(): LibraryFolder[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT f.*, COUNT(c.id) as component_count
     FROM library_folders f
     LEFT JOIN library_components c ON c.folder_id = f.id
     GROUP BY f.id
     ORDER BY f.sort_order ASC, f.created_at ASC`
  ).all() as any[];
  return rows.map(rowToFolder);
}

export function getFolder(id: string): LibraryFolder | undefined {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT f.*, COUNT(c.id) as component_count
     FROM library_folders f
     LEFT JOIN library_components c ON c.folder_id = f.id
     WHERE f.id = ?
     GROUP BY f.id`
  ).get(id) as any;
  return row ? rowToFolder(row) : undefined;
}

export function updateFolder(id: string, updates: Partial<Omit<LibraryFolder, 'id' | 'createdAt' | 'updatedAt' | 'componentCount'>>): LibraryFolder | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM library_folders WHERE id = ?').get(id) as any;
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const merged = { ...existing, ...updates, updated_at: now };

  db.prepare(
    `UPDATE library_folders SET name = ?, description = ?, color = ?, icon = ?, sort_order = ?, agent_accessible = ?, updated_at = ? WHERE id = ?`
  ).run(
    updates.name ?? existing.name,
    updates.description ?? existing.description,
    updates.color ?? existing.color,
    updates.icon ?? existing.icon,
    updates.sortOrder ?? existing.sort_order,
    updates.agentAccessible !== undefined ? (updates.agentAccessible ? 1 : 0) : existing.agent_accessible,
    now,
    id,
  );

  return getFolder(id);
}

export function deleteFolder(id: string): boolean {
  const db = getDatabase();
  db.prepare('UPDATE library_components SET folder_id = NULL WHERE folder_id = ?').run(id);
  const result = db.prepare('DELETE FROM library_folders WHERE id = ?').run(id);
  return result.changes > 0;
}

export function moveComponentToFolder(componentId: string, folderId: string | null): boolean {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE library_components SET folder_id = ?, updated_at = ? WHERE id = ?').run(folderId, now, componentId);
  return result.changes > 0;
}

export function getComponentsInFolder(folderId: string): LibraryComponent[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM library_components WHERE folder_id = ? ORDER BY updated_at DESC').all(folderId) as any[];
  return rows.map(row => {
    const comp = rowToComponent(row);
    comp.files = getComponentFiles(comp.id);
    return comp;
  });
}
