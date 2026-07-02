import { getDatabase } from './index';

export interface DBConversation {
  id: number;
  title: string | null;
  model_id: number;
  type: string;
  created_at: string;
  updated_at: string;
}

export function getConversations(): DBConversation[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as DBConversation[];
}

export function getConversationsByType(type: string): DBConversation[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM conversations WHERE type = ? ORDER BY updated_at DESC').all(type) as DBConversation[];
}

export function getConversationById(id: number): DBConversation | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as DBConversation | undefined;
}

export function createConversation(modelId: number, title: string | null, type: string = 'chat'): number {
  const db = getDatabase();
  const result = db.prepare(
    'INSERT INTO conversations (model_id, title, type) VALUES (?, ?, ?)'
  ).run(modelId, title, type);
  return Number(result.lastInsertRowid);
}

export function updateConversationTitle(id: number, title: string): void {
  const db = getDatabase();
  db.prepare(
    "UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title, id);
}

export function deleteConversation(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
}
