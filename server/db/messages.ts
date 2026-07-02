import { getDatabase } from './index';

export interface DBMessage {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  message_order: number;
  timestamp: string;
  token_count: number | null;
  prompt_tokens: number | null;
  candidates_tokens: number | null;
  generated_images: string | null;
  search_annotations: string | null;
  attachments: string | null;
}

export function getMessagesByConversation(conversationId: number): DBMessage[] {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY message_order ASC'
  ).all(conversationId) as DBMessage[];
}

export function addMessage(
  conversationId: number,
  role: string,
  content: string,
  messageOrder: number,
  tokenCount?: number | null,
  generatedImages?: string | null,
  promptTokens?: number | null,
  candidatesTokens?: number | null,
  searchAnnotations?: string | null,
  attachments?: string | null
): number {
  const db = getDatabase();
  const result = db.prepare(
    `INSERT INTO messages (conversation_id, role, content, message_order, token_count, generated_images, prompt_tokens, candidates_tokens, search_annotations, attachments)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    conversationId,
    role,
    content,
    messageOrder,
    tokenCount || null,
    generatedImages || null,
    promptTokens || null,
    candidatesTokens || null,
    searchAnnotations || null,
    attachments || null
  );

  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conversationId);

  return Number(result.lastInsertRowid);
}

export function updateMessage(id: number, content: string, tokenCount?: number | null): void {
  const db = getDatabase();
  db.prepare('UPDATE messages SET content = ?, token_count = ? WHERE id = ?').run(content, tokenCount || null, id);
}

export function deleteMessage(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM messages WHERE id = ?').run(id);
}

export function getNextMessageOrder(conversationId: number): number {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT MAX(message_order) as max_order FROM messages WHERE conversation_id = ?'
  ).get(conversationId) as { max_order: number | null } | undefined;
  return (row?.max_order || 0) + 1;
}

export function clearConversationMessages(conversationId: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
}
