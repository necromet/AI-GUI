import pg from 'pg';

pg.types.setTypeParser(1184, (val) => val);
pg.types.setTypeParser(1114, (val) => val);

const pool = new pg.Pool({
  host: process.env.PG_HOST || '13.140.162.178',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'edlab',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] PostgreSQL pool error:', err.message);
});

export async function query<T = any>(sql: string, params?: any[]): Promise<pg.QueryResult<T>> {
  return pool.query<T>(sql, params);
}

export async function getOne<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
  const result = await pool.query<T>(sql, params);
  return result.rows[0] as T | undefined;
}

export async function getAll<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows as T[];
}

export async function run(sql: string, params?: any[]): Promise<{ rowCount: number }> {
  const result = await pool.query(sql, params);
  return { rowCount: result.rowCount ?? 0 };
}

export async function runReturning<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
  const result = await pool.query<T>(sql, params);
  return result.rows[0] as T | undefined;
}

export async function transaction<T>(fn: (q: (sql: string, params?: any[]) => Promise<pg.QueryResult>) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client.query.bind(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
