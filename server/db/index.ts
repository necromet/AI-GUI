import { pool, query, getOne } from './pg';
import { SCHEMA_SQL, SEED_SQL } from './schema';

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map(statement => statement.trim())
    .filter(statement => statement.replace(/--[^\n]*/g, '').trim().length > 0);
}

async function runSqlScript(client: { query: (text: string) => Promise<unknown> }, sql: string): Promise<void> {
  for (const statement of splitSqlStatements(sql)) {
    try {
      await client.query(statement);
    } catch (err: any) {
      const preview = statement.replace(/\s+/g, ' ').slice(0, 120);
      throw new Error(`${err.message} — while running: ${preview}`);
    }
  }
}

export async function initializeDatabase(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      console.log('[db] PostgreSQL connection established');

      await runSqlScript(client, SCHEMA_SQL);
      console.log('[db] Schema tables ensured');

      await runSqlScript(client, SEED_SQL);
      console.log('[db] Seed data applied');
    } finally {
      client.release();
    }
    return true;
  } catch (err: any) {
    console.error('[db] Failed to initialize database:', err.message);
    return false;
  }
}

export async function initializeDatabaseWithRetry(maxRetries = 10, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const ok = await initializeDatabase();
    if (ok) return;
    if (attempt < maxRetries) {
      console.log(`[db] Retrying in ${delayMs / 1000}s... (attempt ${attempt}/${maxRetries})`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  console.error(`[db] All ${maxRetries} connection attempts failed. Server running without database.`);
}

export { pool };
