import { getAll, getOne } from './pg';

export interface TokenUsageStats {
  totalTokens: number;
  promptTokens: number;
  candidatesTokens: number;
  messageCount: number;
  conversationCount: number;
}

export interface TokenUsageByModel {
  modelName: string;
  totalTokens: number;
  promptTokens: number;
  candidatesTokens: number;
  messageCount: number;
}

export interface TokenUsageByDate {
  date: string;
  totalTokens: number;
  promptTokens: number;
  candidatesTokens: number;
  messageCount: number;
}

export interface TokenUsageByConversation {
  conversationId: number;
  conversationTitle: string;
  totalTokens: number;
  promptTokens: number;
  candidatesTokens: number;
  messageCount: number;
  updatedAt: string;
}

export async function getOverallTokenStats(): Promise<TokenUsageStats> {
  const row = await getOne<any>(
    `SELECT
       COALESCE(SUM(token_count), 0) as "totalTokens",
       COALESCE(SUM(prompt_tokens), 0) as "promptTokens",
       COALESCE(SUM(candidates_tokens), 0) as "candidatesTokens",
       COUNT(CASE WHEN token_count IS NOT NULL THEN 1 END) as "messageCount"
     FROM messages`
  );

  const convRow = await getOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM conversations');

  return {
    totalTokens: Number(row?.totalTokens) || 0,
    promptTokens: Number(row?.promptTokens) || 0,
    candidatesTokens: Number(row?.candidatesTokens) || 0,
    messageCount: Number(row?.messageCount) || 0,
    conversationCount: Number(convRow?.cnt) || 0,
  };
}

export async function getTokenStatsByModel(): Promise<TokenUsageByModel[]> {
  const rows = await getAll<any>(
    `SELECT
       COALESCE(m.name, 'Unknown Model') as "modelName",
       COALESCE(SUM(msg.token_count), 0) as "totalTokens",
       COALESCE(SUM(msg.prompt_tokens), 0) as "promptTokens",
       COALESCE(SUM(msg.candidates_tokens), 0) as "candidatesTokens",
       COUNT(CASE WHEN msg.token_count IS NOT NULL THEN 1 END) as "messageCount"
     FROM messages msg
     JOIN conversations c ON c.id = msg.conversation_id
     LEFT JOIN models m ON m.id = c.model_id
     GROUP BY m.name
     ORDER BY "totalTokens" DESC`
  );
  return rows.map(r => ({
    ...r,
    totalTokens: Number(r.totalTokens) || 0,
    promptTokens: Number(r.promptTokens) || 0,
    candidatesTokens: Number(r.candidatesTokens) || 0,
    messageCount: Number(r.messageCount) || 0,
  }));
}

export async function getTokenStatsByDate(days: number = 30): Promise<TokenUsageByDate[]> {
  const rows = await getAll<any>(
    `SELECT
       DATE(timestamp)::text as date,
       COALESCE(SUM(token_count), 0) as "totalTokens",
       COALESCE(SUM(prompt_tokens), 0) as "promptTokens",
       COALESCE(SUM(candidates_tokens), 0) as "candidatesTokens",
       COUNT(CASE WHEN token_count IS NOT NULL THEN 1 END) as "messageCount"
     FROM messages
     WHERE timestamp >= NOW() - $1 * INTERVAL '1 day'
     GROUP BY DATE(timestamp)
     ORDER BY date ASC`,
    [days]
  );
  return rows.map(r => ({
    ...r,
    totalTokens: Number(r.totalTokens) || 0,
    promptTokens: Number(r.promptTokens) || 0,
    candidatesTokens: Number(r.candidatesTokens) || 0,
    messageCount: Number(r.messageCount) || 0,
  }));
}

export async function getTokenStatsByConversation(limit: number = 20): Promise<TokenUsageByConversation[]> {
  const rows = await getAll<any>(
    `SELECT
       c.id as "conversationId",
       COALESCE(c.title, 'Untitled Conversation') as "conversationTitle",
       COALESCE(SUM(msg.token_count), 0) as "totalTokens",
       COALESCE(SUM(msg.prompt_tokens), 0) as "promptTokens",
       COALESCE(SUM(msg.candidates_tokens), 0) as "candidatesTokens",
       COUNT(CASE WHEN msg.token_count IS NOT NULL THEN 1 END) as "messageCount",
       c.updated_at as "updatedAt"
     FROM conversations c
     JOIN messages msg ON msg.conversation_id = c.id
     GROUP BY c.id
     HAVING SUM(msg.token_count) > 0
     ORDER BY "totalTokens" DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map(r => ({
    ...r,
    totalTokens: Number(r.totalTokens) || 0,
    promptTokens: Number(r.promptTokens) || 0,
    candidatesTokens: Number(r.candidatesTokens) || 0,
    messageCount: Number(r.messageCount) || 0,
  }));
}
