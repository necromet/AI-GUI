import { getAll, getOne, run, runReturning } from './pg';

export interface DBConversation {
  id: number;
  title: string | null;
  model_id: number;
  type: string;
  created_at: string;
  updated_at: string;
}

export async function getConversations(): Promise<DBConversation[]> {
  return getAll<DBConversation>('SELECT * FROM conversations ORDER BY updated_at DESC');
}

export async function getConversationsByType(type: string): Promise<DBConversation[]> {
  return getAll<DBConversation>('SELECT * FROM conversations WHERE type = $1 ORDER BY updated_at DESC', [type]);
}

export async function getConversationById(id: number): Promise<DBConversation | undefined> {
  return getOne<DBConversation>('SELECT * FROM conversations WHERE id = $1', [id]);
}

export async function createConversation(modelId: number, title: string | null, type: string = 'chat'): Promise<number> {
  const row = await runReturning<{ id: number }>(
    'INSERT INTO conversations (model_id, title, type) VALUES ($1, $2, $3) RETURNING id',
    [modelId, title, type]
  );
  return row!.id;
}

export async function updateConversationTitle(id: number, title: string): Promise<void> {
  await run(
    'UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2',
    [title, id]
  );
}

export async function deleteConversation(id: number): Promise<void> {
  await run('DELETE FROM conversations WHERE id = $1', [id]);
}
