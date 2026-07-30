import { getAll, getOne, run, runReturning } from './pg';

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

export async function getMessagesByConversation(conversationId: number): Promise<DBMessage[]> {
  return getAll<DBMessage>(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY message_order ASC',
    [conversationId]
  );
}

export async function addMessage(
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
): Promise<number> {
  const row = await runReturning<{ id: number }>(
    `INSERT INTO messages (conversation_id, role, content, message_order, token_count, generated_images, prompt_tokens, candidates_tokens, search_annotations, attachments)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      conversationId,
      role,
      content,
      messageOrder,
      tokenCount || null,
      generatedImages || null,
      promptTokens || null,
      candidatesTokens || null,
      searchAnnotations || null,
      attachments || null,
    ]
  );

  await run('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

  return row!.id;
}

export async function updateMessage(id: number, content: string, tokenCount?: number | null): Promise<void> {
  await run('UPDATE messages SET content = $1, token_count = $2 WHERE id = $3', [content, tokenCount || null, id]);
}

export async function deleteMessage(id: number): Promise<void> {
  await run('DELETE FROM messages WHERE id = $1', [id]);
}

export async function getNextMessageOrder(conversationId: number): Promise<number> {
  const row = await getOne<{ max_order: number | null }>(
    'SELECT MAX(message_order) as max_order FROM messages WHERE conversation_id = $1',
    [conversationId]
  );
  return (row?.max_order || 0) + 1;
}
