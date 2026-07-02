import { getDatabase } from './index';

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

export function getOverallTokenStats(): TokenUsageStats {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT
       COALESCE(SUM(token_count), 0) as totalTokens,
       COALESCE(SUM(prompt_tokens), 0) as promptTokens,
       COALESCE(SUM(candidates_tokens), 0) as candidatesTokens,
       COUNT(CASE WHEN token_count IS NOT NULL THEN 1 END) as messageCount
     FROM messages`
  ).get() as any;

  const convRow = db.prepare('SELECT COUNT(*) as cnt FROM conversations').get() as { cnt: number };

  return {
    totalTokens: row.totalTokens || 0,
    promptTokens: row.promptTokens || 0,
    candidatesTokens: row.candidatesTokens || 0,
    messageCount: row.messageCount || 0,
    conversationCount: convRow.cnt || 0,
  };
}

export function getTokenStatsByModel(): TokenUsageByModel[] {
  const db = getDatabase();
  return db.prepare(
    `SELECT
       COALESCE(m.name, 'Unknown Model') as modelName,
       COALESCE(SUM(msg.token_count), 0) as totalTokens,
       COALESCE(SUM(msg.prompt_tokens), 0) as promptTokens,
       COALESCE(SUM(msg.candidates_tokens), 0) as candidatesTokens,
       COUNT(CASE WHEN msg.token_count IS NOT NULL THEN 1 END) as messageCount
     FROM messages msg
     JOIN conversations c ON c.id = msg.conversation_id
     LEFT JOIN models m ON m.id = c.model_id
     GROUP BY m.name
     ORDER BY totalTokens DESC`
  ).all() as TokenUsageByModel[];
}

export function getTokenStatsByDate(days: number = 30): TokenUsageByDate[] {
  const db = getDatabase();
  return db.prepare(
    `SELECT
       DATE(timestamp) as date,
       COALESCE(SUM(token_count), 0) as totalTokens,
       COALESCE(SUM(prompt_tokens), 0) as promptTokens,
       COALESCE(SUM(candidates_tokens), 0) as candidatesTokens,
       COUNT(CASE WHEN token_count IS NOT NULL THEN 1 END) as messageCount
     FROM messages
     WHERE timestamp >= datetime('now', '-' || ? || ' days')
     GROUP BY DATE(timestamp)
     ORDER BY date ASC`
  ).all(days) as TokenUsageByDate[];
}

export function getTokenStatsByConversation(limit: number = 20): TokenUsageByConversation[] {
  const db = getDatabase();
  return db.prepare(
    `SELECT
       c.id as conversationId,
       COALESCE(c.title, 'Untitled Conversation') as conversationTitle,
       COALESCE(SUM(msg.token_count), 0) as totalTokens,
       COALESCE(SUM(msg.prompt_tokens), 0) as promptTokens,
       COALESCE(SUM(msg.candidates_tokens), 0) as candidatesTokens,
       COUNT(CASE WHEN msg.token_count IS NOT NULL THEN 1 END) as messageCount,
       c.updated_at as updatedAt
     FROM conversations c
     JOIN messages msg ON msg.conversation_id = c.id
     GROUP BY c.id
     HAVING totalTokens > 0
     ORDER BY totalTokens DESC
     LIMIT ?`
  ).all(limit) as TokenUsageByConversation[];
}
