import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { pool } from '../db/pg.js';

let saver: PostgresSaver | null = null;
let setupPromise: Promise<void> | null = null;

export async function getWorkflowCheckpointer(): Promise<PostgresSaver> {
  if (!saver) saver = new PostgresSaver(pool, undefined, { schema: 'public' });
  if (!setupPromise) setupPromise = saver.setup();
  await setupPromise;
  return saver;
}
