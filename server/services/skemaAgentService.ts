import { getAll, getOne, run } from '../db/pg';

export interface SkemaAgentSession {
  id: string;
  projectId: string;
  boardIdx: number;
  title: string | null;
  messagesJson: string;
  createdAt: string;
  updatedAt: string;
}

function rowToSession(row: any): SkemaAgentSession {
  return {
    id: row.id,
    projectId: row.project_id,
    boardIdx: row.board_idx ?? 0,
    title: row.title,
    messagesJson: row.messages_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const MAX_SESSIONS = 20;

export async function getSession(id: string): Promise<SkemaAgentSession | undefined> {
  const row = await getOne('SELECT * FROM skema_agent_sessions WHERE id = $1', [id]) as any;
  return row ? rowToSession(row) : undefined;
}

export async function getSessionsByProject(projectId: string, boardIdx?: number): Promise<SkemaAgentSession[]> {
  let rows: any[];
  if (boardIdx !== undefined && !isNaN(boardIdx)) {
    rows = await getAll(
      'SELECT * FROM skema_agent_sessions WHERE project_id = $1 AND board_idx = $2 ORDER BY updated_at DESC',
      [projectId, boardIdx]
    );
  } else {
    rows = await getAll(
      'SELECT * FROM skema_agent_sessions WHERE project_id = $1 ORDER BY updated_at DESC',
      [projectId]
    );
  }
  return rows.map(rowToSession);
}

export async function createSession(projectId: string, boardIdx: number = 0): Promise<SkemaAgentSession> {
  const id = Math.random().toString(36).substring(2, 15);
  const now = new Date().toISOString();

  const existing = await getOne(
    'SELECT COUNT(*) as c FROM skema_agent_sessions WHERE project_id = $1',
    [projectId]
  ) as any;
  if (parseInt(existing.c, 10) >= MAX_SESSIONS) {
    const oldest = await getOne(
      'SELECT id FROM skema_agent_sessions WHERE project_id = $1 ORDER BY updated_at ASC LIMIT 1',
      [projectId]
    ) as any;
    if (oldest) await run('DELETE FROM skema_agent_sessions WHERE id = $1', [oldest.id]);
  }

  await run(
    'INSERT INTO skema_agent_sessions (id, project_id, board_idx, title, messages_json, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, projectId, boardIdx, null, '[]', now, now]
  );

  return { id, projectId, boardIdx, title: null, messagesJson: '[]', createdAt: now, updatedAt: now };
}

export async function updateSession(id: string, updates: { messages?: any[]; title?: string }): Promise<SkemaAgentSession | undefined> {
  const now = new Date().toISOString();

  const existing = await getOne('SELECT * FROM skema_agent_sessions WHERE id = $1', [id]) as any;
  if (!existing) return undefined;

  if (updates.messages) {
    await run('UPDATE skema_agent_sessions SET messages_json = $1, updated_at = $2 WHERE id = $3',
      [JSON.stringify(updates.messages), now, id]);
  }
  if (updates.title) {
    await run('UPDATE skema_agent_sessions SET title = $1, updated_at = $2 WHERE id = $3',
      [updates.title, now, id]);
  }

  const updated = await getOne('SELECT * FROM skema_agent_sessions WHERE id = $1', [id]) as any;
  return updated ? rowToSession(updated) : undefined;
}

export async function deleteSession(id: string): Promise<boolean> {
  const result = await run('DELETE FROM skema_agent_sessions WHERE id = $1', [id]);
  return result.rowCount > 0;
}
