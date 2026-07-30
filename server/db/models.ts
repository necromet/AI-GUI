import { getAll, getOne, run, runReturning } from './pg';

export interface DBModel {
  id: number;
  name: string;
  description: string | null;
  context_window_size: number | null;
  active: boolean;
  api_key: string | null;
  provider: string | null;
  system_instruction: string | null;
  is_custom: boolean;
  created_at: string;
}

export async function getModels(): Promise<DBModel[]> {
  return getAll<DBModel>('SELECT * FROM models WHERE active = TRUE');
}

export async function getAllModels(): Promise<DBModel[]> {
  return getAll<DBModel>('SELECT * FROM models');
}

export async function getModelById(id: number): Promise<DBModel | undefined> {
  return getOne<DBModel>('SELECT * FROM models WHERE id = $1', [id]);
}

export async function addModel(
  name: string,
  description: string | null,
  contextWindowSize: number | null,
  apiKey?: string | null,
  provider?: string | null,
  systemInstruction?: string | null,
  isCustom?: boolean
): Promise<number> {
  const row = await runReturning<{ id: number }>(
    `INSERT INTO models (name, description, context_window_size, api_key, provider, system_instruction, is_custom)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      name,
      description,
      contextWindowSize,
      apiKey || null,
      provider || null,
      systemInstruction || null,
      isCustom ? true : false,
    ]
  );
  return row!.id;
}

export async function updateModel(
  id: number,
  name: string,
  description: string | null,
  contextWindowSize: number | null,
  apiKey?: string | null,
  provider?: string | null,
  systemInstruction?: string | null,
  isCustom?: boolean
): Promise<void> {
  await run(
    `UPDATE models SET name = $1, description = $2, context_window_size = $3, api_key = $4, provider = $5, system_instruction = $6, is_custom = $7
     WHERE id = $8`,
    [name, description, contextWindowSize, apiKey || null, provider || null, systemInstruction || null, isCustom ? true : false, id]
  );
}

export async function deactivateModel(id: number): Promise<void> {
  await run('UPDATE models SET active = FALSE WHERE id = $1', [id]);
}
