import { getDatabase } from './index';

export interface DBModel {
  id: number;
  name: string;
  description: string | null;
  context_window_size: number | null;
  active: number;
  api_key: string | null;
  provider: string | null;
  system_instruction: string | null;
  is_custom: number;
  created_at: string;
}

export function getModels(): DBModel[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM models WHERE active = 1').all() as DBModel[];
}

export function getAllModels(): DBModel[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM models').all() as DBModel[];
}

export function getModelById(id: number): DBModel | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM models WHERE id = ?').get(id) as DBModel | undefined;
}

export function getModelByName(name: string): DBModel | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM models WHERE name = ?').get(name) as DBModel | undefined;
}

export function addModel(
  name: string,
  description: string | null,
  contextWindowSize: number | null,
  apiKey?: string | null,
  provider?: string | null,
  systemInstruction?: string | null,
  isCustom?: boolean
): number {
  const db = getDatabase();
  const stmt = db.prepare(
    `INSERT INTO models (name, description, context_window_size, api_key, provider, system_instruction, is_custom)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    name,
    description,
    contextWindowSize,
    apiKey || null,
    provider || null,
    systemInstruction || null,
    isCustom ? 1 : 0
  );
  return Number(result.lastInsertRowid);
}

export function updateModel(
  id: number,
  name: string,
  description: string | null,
  contextWindowSize: number | null,
  apiKey?: string | null,
  provider?: string | null,
  systemInstruction?: string | null,
  isCustom?: boolean
): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE models SET name = ?, description = ?, context_window_size = ?, api_key = ?, provider = ?, system_instruction = ?, is_custom = ?
     WHERE id = ?`
  ).run(name, description, contextWindowSize, apiKey || null, provider || null, systemInstruction || null, isCustom ? 1 : 0, id);
}

export function deactivateModel(id: number): void {
  const db = getDatabase();
  db.prepare('UPDATE models SET active = 0 WHERE id = ?').run(id);
}
