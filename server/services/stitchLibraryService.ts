import { getDatabase } from '../db';
import { getEmbedding, cosineSimilarity } from './embeddingService';

export interface StitchComponent {
  id: string;
  name: string;
  category: 'section' | 'component' | 'icon' | 'svg' | 'template' | 'widget';
  contentType: 'html' | 'svg' | 'json' | 'js';
  projectType: 'website' | 'ig-carousel' | 'ig-story' | 'all';
  description: string;
  tags: string[];
  content: string;
  specSnippet?: string;
  thumbnail?: string;
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StitchComponentWithScore extends StitchComponent {
  score: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function rowToComponent(row: any): StitchComponent {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    contentType: row.content_type,
    projectType: row.project_type,
    description: row.description || '',
    tags: row.tags ? JSON.parse(row.tags) : [],
    content: row.content,
    specSnippet: row.spec_snippet || undefined,
    thumbnail: row.thumbnail || undefined,
    isGlobal: row.is_global === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function addComponent(component: Omit<StitchComponent, 'id' | 'createdAt' | 'updatedAt'> & { isGlobal?: boolean }): Promise<StitchComponent> {
  const db = getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO stitch_components (id, name, category, content_type, project_type, description, tags, content, spec_snippet, thumbnail, is_global, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    component.name,
    component.category,
    component.contentType,
    component.projectType,
    component.description,
    JSON.stringify(component.tags),
    component.content,
    component.specSnippet || null,
    component.thumbnail || null,
    component.isGlobal !== false ? 1 : 0,
    now,
    now,
  );

  const embedText = [component.name, component.description, component.tags.join(' '), component.category].join(' ');
  const embedding = await getEmbedding(embedText);

  db.prepare(
    'INSERT INTO stitch_component_embeddings (id, component_id, chunk_text, embedding) VALUES (?, ?, ?, ?)'
  ).run(generateId(), id, embedText, JSON.stringify(embedding));

  return {
    ...component,
    id,
    createdAt: now,
    updatedAt: now,
  };
}

export function listComponents(filters?: { category?: string; projectType?: string }): StitchComponent[] {
  const db = getDatabase();
  let query = 'SELECT * FROM stitch_components WHERE 1=1';
  const params: any[] = [];

  if (filters?.category) {
    query += ' AND category = ?';
    params.push(filters.category);
  }
  if (filters?.projectType) {
    query += ' AND (project_type = ? OR project_type = ?)';
    params.push(filters.projectType, 'all');
  }

  query += ' ORDER BY updated_at DESC';

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map(rowToComponent);
}

export function getComponent(id: string): StitchComponent | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM stitch_components WHERE id = ?').get(id) as any;
  return row ? rowToComponent(row) : undefined;
}

export function deleteComponent(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM stitch_components WHERE id = ?').run(id);
  return result.changes > 0;
}

export async function searchComponents(query: string, projectType?: string, topK: number = 5): Promise<StitchComponentWithScore[]> {
  const db = getDatabase();

  let sql = 'SELECT sc.*, sce.embedding, sce.chunk_text FROM stitch_component_embeddings sce JOIN stitch_components sc ON sce.component_id = sc.id';
  const params: any[] = [];

  if (projectType) {
    sql += ' WHERE (sc.project_type = ? OR sc.project_type = ?)';
    params.push(projectType, 'all');
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
  return scored.slice(0, topK).map(s => ({ ...s.component, score: s.score }));
}

export async function reindexAll(): Promise<number> {
  const db = getDatabase();
  const components = db.prepare('SELECT * FROM stitch_components').all() as any[];

  db.prepare('DELETE FROM stitch_component_embeddings').run();

  for (const row of components) {
    const embedText = [row.name, row.description || '', row.tags ? JSON.parse(row.tags).join(' ') : '', row.category].join(' ');
    const embedding = await getEmbedding(embedText);
    db.prepare(
      'INSERT INTO stitch_component_embeddings (id, component_id, chunk_text, embedding) VALUES (?, ?, ?, ?)'
    ).run(generateId(), row.id, embedText, JSON.stringify(embedding));
  }

  return components.length;
}
