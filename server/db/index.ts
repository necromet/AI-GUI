import { pool, query, getOne } from './pg';
import { SCHEMA_SQL, SEED_SQL } from './schema';

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('[db] PostgreSQL connection established');

    await client.query(SCHEMA_SQL);
    console.log('[db] Schema tables ensured');

    await client.query(SEED_SQL);
    console.log('[db] Seed data applied');
  } finally {
    client.release();
  }
}

export { pool };
