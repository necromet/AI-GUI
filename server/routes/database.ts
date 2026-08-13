import { Router, Request, Response } from 'express';
import pg from 'pg';
import crypto from 'crypto';
import { query, getOne, getAll } from '../db/pg';

const router = Router();

const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function encodePassword(pw: string): string {
  if (!ENCRYPTION_KEY) {
    if (process.env.NODE_ENV !== 'test') console.warn('[database] DB_ENCRYPTION_KEY not set — passwords stored as base64 (insecure)');
    return Buffer.from(pw, 'utf-8').toString('base64');
  }
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'db-pw-salt', 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(pw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decodePassword(encoded: string): string {
  if (!ENCRYPTION_KEY) {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  }
  const data = Buffer.from(encoded, 'base64');
  if (data.length < IV_LENGTH + TAG_LENGTH + 1) {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  }
  try {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'db-pw-salt', 32);
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  }
}

const poolCache = new Map<string, { pool: pg.Pool; lastUsed: number }>();
const POOL_IDLE_MS = 5 * 60 * 1000;
const MAX_ROWS = 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of poolCache) {
    if (now - entry.lastUsed > POOL_IDLE_MS) {
      entry.pool.end().catch(() => {});
      poolCache.delete(id);
    }
  }
}, 60_000);

function getPool(id: string, config: { host: string; port: number; database: string; user: string; password: string; ssl: boolean }): pg.Pool {
  const cached = poolCache.get(id);
  if (cached) {
    cached.lastUsed = Date.now();
    return cached.pool;
  }
  const pool = new pg.Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  });
  pool.on('error', () => {});
  poolCache.set(id, { pool, lastUsed: Date.now() });
  return pool;
}

function removePool(id: string) {
  const cached = poolCache.get(id);
  if (cached) {
    cached.pool.end().catch(() => {});
    poolCache.delete(id);
  }
}

function stripSqlComments(sql: string): string {
  return sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function isReadOnlyQuery(sql: string): { allowed: boolean; keyword?: string } {
  const cleaned = stripSqlComments(sql).trim();
  const match = cleaned.match(/^\s*(SELECT|WITH|EXPLAIN|SHOW|SET\s+|BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\b/i);
  if (!match) {
    const nonReadMatch = cleaned.match(/^\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\b/i);
    return { allowed: false, keyword: nonReadMatch?.[1]?.toUpperCase() || 'non-SELECT' };
  }
  return { allowed: true };
}

function injectRowLimit(sql: string, maxRows: number): string {
  const cleaned = stripSqlComments(sql).trim().replace(/;\s*$/, '');
  if (/\bLIMIT\s+\d+/i.test(cleaned)) return sql;
  if (/^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i.test(cleaned)) return sql;
  return `${cleaned} LIMIT ${maxRows}`;
}

interface ConnRow {
  id: string;
  name: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  password_encrypted: string;
  ssl: boolean;
  created_at: string;
  updated_at: string;
}

async function getConnConfig(id: string): Promise<{ pool: pg.Pool; row: ConnRow } | null> {
  const row = await getOne<ConnRow>('SELECT * FROM database_connections WHERE id = $1', [id]);
  if (!row) return null;
  const pool = getPool(id, {
    host: row.host,
    port: row.port,
    database: row.database_name,
    user: row.username,
    password: decodePassword(row.password_encrypted),
    ssl: row.ssl,
  });
  return { pool, row };
}

router.get('/connections', async (_req: Request, res: Response) => {
  try {
    const rows = await getAll<ConnRow>('SELECT * FROM database_connections ORDER BY created_at DESC');
    const connections = rows.map(r => ({
      id: r.id,
      name: r.name,
      host: r.host,
      port: r.port,
      database: r.database_name,
      user: r.username,
      ssl: r.ssl,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
    res.json({ connections });
  } catch (error: any) {
    console.error('[database/connections] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/connections/:id', async (req: Request, res: Response) => {
  try {
    const row = await getOne<ConnRow>('SELECT * FROM database_connections WHERE id = $1', [req.params.id]);
    if (!row) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    res.json({
      connection: {
        id: row.id,
        name: row.name,
        host: row.host,
        port: row.port,
        database: row.database_name,
        user: row.username,
        ssl: row.ssl,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[database/connections/:id] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/connections', async (req: Request, res: Response) => {
  try {
    const { name, host, port, database, user, password, ssl } = req.body;
    if (!name || !host || !database || !user || !password) {
      res.status(400).json({ error: 'Missing required fields: name, host, database, user, password' });
      return;
    }
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const encoded = encodePassword(password);
    await query(
      `INSERT INTO database_connections (id, name, host, port, database_name, username, password_encrypted, ssl)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, name, host, port || 5432, database, user, encoded, ssl || false]
    );
    res.json({ id });
  } catch (error: any) {
    console.error('[database/connections POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/connections/:id', async (req: Request, res: Response) => {
  try {
    const { name, host, port, database, user, password, ssl } = req.body;
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name); }
    if (host !== undefined) { sets.push(`host = $${idx++}`); params.push(host); }
    if (port !== undefined) { sets.push(`port = $${idx++}`); params.push(port); }
    if (database !== undefined) { sets.push(`database_name = $${idx++}`); params.push(database); }
    if (user !== undefined) { sets.push(`username = $${idx++}`); params.push(user); }
    if (password !== undefined) { sets.push(`password_encrypted = $${idx++}`); params.push(encodePassword(password)); }
    if (ssl !== undefined) { sets.push(`ssl = $${idx++}`); params.push(ssl); }
    sets.push(`updated_at = NOW()`);
    params.push(req.params.id);
    await query(`UPDATE database_connections SET ${sets.join(', ')} WHERE id = $${idx}`, params);
    removePool(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[database/connections/:id PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/connections/:id', async (req: Request, res: Response) => {
  try {
    removePool(req.params.id);
    await query('DELETE FROM database_connections WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[database/connections/:id DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/test', async (req: Request, res: Response) => {
  try {
    const { host, port, database, user, password, ssl } = req.body;
    if (!host || !database || !user || !password) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const testPool = new pg.Pool({
      host,
      port: port || 5432,
      database,
      user,
      password,
      max: 1,
      connectionTimeoutMillis: 10000,
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
    });
    const client = await testPool.connect();
    const result = await client.query('SELECT version()');
    client.release();
    await testPool.end();
    res.json({ success: true, version: result.rows[0]?.version || '' });
  } catch (error: any) {
    console.error('[database/test] Error:', error.message);
    res.json({ success: false, error: error.message });
  }
});

router.post('/schema', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.body;
    if (!connectionId) {
      res.status(400).json({ error: 'Missing connectionId' });
      return;
    }
    const config = await getConnConfig(connectionId);
    if (!config) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    const { pool } = config;

    const schemasResult = await pool.query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       ORDER BY schema_name`
    );
    const schemas = schemasResult.rows.map((r: any) => r.schema_name);

    const tablesResult = await pool.query(
      `SELECT t.table_schema, t.table_name, t.table_type
       FROM information_schema.tables t
       WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       ORDER BY t.table_schema, t.table_name`
    );

    const tables: any[] = [];
    const rowCountsResult = await pool.query(
      `SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables`
    );
    const rowCounts: Record<string, number> = {};
    for (const r of rowCountsResult.rows) {
      rowCounts[`${r.schemaname}.${r.relname}`] = r.n_live_tup ?? 0;
    }

    const fkResult = await pool.query(
      `SELECT
         ku.table_schema, ku.table_name, ku.column_name,
         ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name AND tc.table_schema = ku.table_schema
       JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'`
    );
    const fkMap: Record<string, { refTable: string; refColumn: string }[]> = {};
    for (const fk of fkResult.rows) {
      const key = `${fk.table_schema}.${fk.table_name}.${fk.column_name}`;
      if (!fkMap[key]) fkMap[key] = [];
      fkMap[key].push({ refTable: `${fk.foreign_table_schema}.${fk.foreign_table_name}`, refColumn: fk.foreign_column_name });
    }

    for (const t of tablesResult.rows) {
      const colsResult = await pool.query(
        `SELECT
           c.column_name, c.data_type, c.is_nullable, c.column_default,
           c.character_maximum_length,
           CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
         FROM information_schema.columns c
         LEFT JOIN (
           SELECT ku.column_name, ku.table_schema, ku.table_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name AND tc.table_schema = ku.table_schema
           WHERE tc.constraint_type = 'PRIMARY KEY'
         ) pk ON pk.column_name = c.column_name AND pk.table_schema = c.table_schema AND pk.table_name = c.table_name
         WHERE c.table_schema = $1 AND c.table_name = $2
         ORDER BY c.ordinal_position`,
        [t.table_schema, t.table_name]
      );
      tables.push({
        schema: t.table_schema,
        name: t.table_name,
        type: t.table_type === 'VIEW' ? 'view' : 'table',
        rowCount: rowCounts[`${t.table_schema}.${t.table_name}`] ?? null,
        columns: colsResult.rows.map((c: any) => {
          const fkKey = `${t.table_schema}.${t.table_name}.${c.column_name}`;
          const fks = fkMap[fkKey] || [];
          return {
            name: c.column_name,
            dataType: c.data_type,
            isNullable: c.is_nullable === 'YES',
            isPrimaryKey: c.is_primary_key === true,
            columnDefault: c.column_default,
            characterMaximumLength: c.character_maximum_length,
            foreignKey: fks.length > 0 ? fks[0] : undefined,
          };
        }),
      });
    }

    res.json({ schemas, tables });
  } catch (error: any) {
    console.error('[database/schema] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/query', async (req: Request, res: Response) => {
  try {
    const { connectionId, sql, maxRows, force, timeout } = req.body;
    if (!connectionId || !sql) {
      res.status(400).json({ error: 'Missing connectionId or sql' });
      return;
    }
    const config = await getConnConfig(connectionId);
    if (!config) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    const check = isReadOnlyQuery(sql);
    if (!check.allowed) {
      res.status(403).json({
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: `Only read-only queries are allowed. "${check.keyword}" statements are not permitted.`,
      });
      return;
    }

    const limit = Math.min(maxRows || MAX_ROWS, MAX_ROWS);
    const finalSql = injectRowLimit(sql, limit);
    const start = Date.now();
    const result = await config.pool.query({
      text: finalSql,
      ...(timeout ? { query_timeout: timeout } : {}),
    } as any);
    const executionTime = Date.now() - start;

    const columns = result.fields?.map((f: any) => f.name) || [];
    let rows = result.rows || [];
    const truncated = rows.length > limit;
    if (truncated) {
      rows = rows.slice(0, limit);
    }

    const flatRows = rows.map((row: any) => columns.map(col => row[col]));
    const isSelect = columns.length > 0;

    res.json({
      columns,
      rows: flatRows,
rowCount: isSelect ? flatRows.length : (result.rowCount || 0),
      executionTime,
      truncated,
    });
  } catch (error: any) {
    console.error('[database/query] Error:', error.message);
    res.status(500).json({
      columns: [],
      rows: [],
      rowCount: 0,
      executionTime: 0,
      error: error.message,
    });
  }
});

router.delete('/connections/:id/pool', async (req: Request, res: Response) => {
  try {
    removePool(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/connections/:id/ping', async (req: Request, res: Response) => {
  try {
    const config = await getConnConfig(req.params.id);
    if (!config) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    const client = await config.pool.connect();
    client.release();
    res.json({ reachable: true });
  } catch (error: any) {
    res.json({ reachable: false, error: error.message });
  }
});

export default router;
