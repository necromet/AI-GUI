import { pool } from './pg';

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('[db] PostgreSQL connection established');
  } finally {
    client.release();
  }
}

export { pool };
