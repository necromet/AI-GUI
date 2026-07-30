import { getAll, getOne, run, runReturning } from '../db/pg';
import { getEmbedding, cosineSimilarity } from './embeddingService';
import { safeJsonParse } from '../lib/safeJsonParse';

export interface SkemaComponent {
  id: string;
  name: string;
  category: 'section' | 'component' | 'icon' | 'svg' | 'template' | 'widget' | 'image' | 'palette' | 'layout';
  contentType: 'html' | 'svg' | 'json' | 'js' | 'image-url' | 'image-base64' | 'colors';
  projectType: 'canvas' | 'ig-carousel' | 'ig-story' | 'all';
  description: string;
  tags: string[];
  content: string;
  specSnippet?: string;
  thumbnail?: string;
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkemaComponentWithScore extends SkemaComponent {
  score: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function rowToComponent(row: any): SkemaComponent {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    contentType: row.content_type,
    projectType: row.project_type,
    description: row.description || '',
    tags: safeJsonParse(row.tags, []),
    content: row.content,
    specSnippet: row.spec_snippet || undefined,
    thumbnail: row.thumbnail || undefined,
    isGlobal: row.is_global === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function addComponent(component: Omit<SkemaComponent, 'id' | 'createdAt' | 'updatedAt'> & { isGlobal?: boolean }): Promise<SkemaComponent> {
  const id = generateId();
  const now = new Date().toISOString();

  await run(
    `INSERT INTO skema_components (id, name, category, content_type, project_type, description, tags, content, spec_snippet, thumbnail, is_global, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [id, component.name, component.category, component.contentType, component.projectType, component.description, JSON.stringify(component.tags), component.content, component.specSnippet || null, component.thumbnail || null, component.isGlobal !== false, now, now]
  );

  const embedText = [component.name, component.description, component.tags.join(' '), component.category].join(' ');
  const embedding = await getEmbedding(embedText);

  await run(
    'INSERT INTO skema_component_embeddings (id, component_id, chunk_text, embedding) VALUES ($1, $2, $3, $4)',
    [generateId(), id, embedText, JSON.stringify(embedding)]
  );

  return {
    ...component,
    id,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listComponents(filters?: { category?: string; projectType?: string }): Promise<SkemaComponent[]> {
  let sql = 'SELECT * FROM skema_components WHERE 1=1';
  const params: any[] = [];
  let paramIdx = 1;

  if (filters?.category) {
    sql += ` AND category = $${paramIdx++}`;
    params.push(filters.category);
  }
  if (filters?.projectType) {
    sql += ` AND (project_type = $${paramIdx++} OR project_type = $${paramIdx++})`;
    params.push(filters.projectType, 'all');
  }

  sql += ' ORDER BY updated_at DESC';

  const rows = await getAll(sql, params);
  return rows.map(rowToComponent);
}

export async function getComponent(id: string): Promise<SkemaComponent | undefined> {
  const row = await getOne('SELECT * FROM skema_components WHERE id = $1', [id]);
  return row ? rowToComponent(row) : undefined;
}

export async function deleteComponent(id: string): Promise<boolean> {
  const result = await run('DELETE FROM skema_components WHERE id = $1', [id]);
  return result.rowCount > 0;
}

export async function searchComponents(query: string, projectType?: string, topK: number = 5): Promise<SkemaComponentWithScore[]> {
  let sql = 'SELECT sc.*, sce.embedding, sce.chunk_text FROM skema_component_embeddings sce JOIN skema_components sc ON sce.component_id = sc.id';
  const params: any[] = [];

  if (projectType) {
    sql += ' WHERE (sc.project_type = $1 OR sc.project_type = $2)';
    params.push(projectType, 'all');
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
  return scored.slice(0, topK).map(s => ({ ...s.component, score: s.score }));
}

export async function reindexAll(): Promise<number> {
  const components = await getAll('SELECT * FROM skema_components');

  await run('DELETE FROM skema_component_embeddings');

  for (const row of components) {
    const embedText = [row.name, row.description || '', safeJsonParse(row.tags, [] as string[]).join(' '), row.category].join(' ');
    const embedding = await getEmbedding(embedText);
    await run(
      'INSERT INTO skema_component_embeddings (id, component_id, chunk_text, embedding) VALUES ($1, $2, $3, $4)',
      [generateId(), row.id, embedText, JSON.stringify(embedding)]
    );
  }

  return components.length;
}
