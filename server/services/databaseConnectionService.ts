import crypto from 'node:crypto';
import pg from 'pg';
import { parse } from 'pgsql-ast-parser';
import { getAll, getOne, query } from '../db/pg.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const MAX_ROWS = 1000;
const MAX_TIMEOUT_MS = 30_000;
const POOL_IDLE_MS = 5 * 60 * 1000;
const MAX_CACHED_POOLS = 50;

export interface ConnectionRow {
  id: string; name: string; host: string; port: number; database_name: string;
  username: string; password_encrypted: string; ssl: boolean; created_at: string; updated_at: string;
}

export interface PublicConnection {
  id: string; name: string; host: string; port: number; database: string;
  user: string; ssl: boolean; created_at?: string; updated_at?: string;
}

const poolCache = new Map<string, { pool: pg.Pool; lastUsed: number }>();
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of poolCache) if (now - entry.lastUsed > POOL_IDLE_MS) closeConnectionPool(id);
}, 60_000);
cleanupTimer.unref();

function deriveKey(): Buffer {
  const source = process.env.DB_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'insecure-fallback-key-do-not-use-in-production';
  return crypto.scryptSync(source, 'db-pw-salt-v2', 32);
}

export function encryptDatabasePassword(password: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

function decryptDatabasePassword(encoded: string): string {
  const data = Buffer.from(encoded, 'base64');
  try {
    if (data.length < IV_LENGTH + TAG_LENGTH + 1) throw new Error('legacy');
    const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(), data.subarray(0, IV_LENGTH));
    decipher.setAuthTag(data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH));
    return decipher.update(data.subarray(IV_LENGTH + TAG_LENGTH)) + decipher.final('utf8');
  } catch {
    return Buffer.from(encoded, 'base64').toString('utf8');
  }
}

function publicConnection(row: ConnectionRow): PublicConnection {
  return { id: row.id, name: row.name, host: row.host, port: row.port, database: row.database_name, user: row.username, ssl: row.ssl, created_at: row.created_at, updated_at: row.updated_at };
}

export async function listDatabaseConnections(): Promise<PublicConnection[]> {
  return (await getAll<ConnectionRow>('SELECT * FROM database_connections ORDER BY created_at DESC')).map(publicConnection);
}

export async function findDatabaseConnection(id: string): Promise<PublicConnection | null> {
  const row = await getOne<ConnectionRow>('SELECT * FROM database_connections WHERE id = $1', [id]);
  return row ? publicConnection(row) : null;
}

export async function createDatabaseConnection(input: any): Promise<string> {
  const id = crypto.randomBytes(16).toString('hex');
  await query(`INSERT INTO database_connections (id, name, host, port, database_name, username, password_encrypted, ssl) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, input.name, input.host, input.port || 5432, input.database, input.user, encryptDatabasePassword(input.password), input.ssl === true]);
  return id;
}

export async function updateDatabaseConnection(id: string, input: any): Promise<void> {
  const columns: Record<string, string> = { name: 'name', host: 'host', port: 'port', database: 'database_name', user: 'username', ssl: 'ssl' };
  const sets: string[] = []; const params: any[] = [];
  for (const [key, column] of Object.entries(columns)) if (input[key] !== undefined) { params.push(input[key]); sets.push(`${column} = $${params.length}`); }
  if (input.password !== undefined && input.password !== '') { params.push(encryptDatabasePassword(input.password)); sets.push(`password_encrypted = $${params.length}`); }
  sets.push('updated_at = NOW()'); params.push(id);
  await query(`UPDATE database_connections SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  closeConnectionPool(id);
}

export async function deleteDatabaseConnection(id: string): Promise<void> {
  closeConnectionPool(id);
  await query('DELETE FROM database_connections WHERE id = $1', [id]);
}

export async function getConnectionPool(id: string): Promise<pg.Pool | null> {
  const cached = poolCache.get(id);
  if (cached) { cached.lastUsed = Date.now(); return cached.pool; }
  const row = await getOne<ConnectionRow>('SELECT * FROM database_connections WHERE id = $1', [id]);
  if (!row) return null;
  if (poolCache.size >= MAX_CACHED_POOLS) {
    const oldest = [...poolCache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0]?.[0];
    if (oldest) closeConnectionPool(oldest);
  }
  const pool = new pg.Pool({ host: row.host, port: row.port, database: row.database_name, user: row.username, password: decryptDatabasePassword(row.password_encrypted), max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000, statement_timeout: MAX_TIMEOUT_MS, ssl: row.ssl ? { rejectUnauthorized: true } : undefined });
  pool.on('error', () => {});
  poolCache.set(id, { pool, lastUsed: Date.now() });
  return pool;
}

export function closeConnectionPool(id: string): void {
  const cached = poolCache.get(id);
  if (cached) { void cached.pool.end().catch(() => {}); poolCache.delete(id); }
}

export async function testDatabaseConnection(input: any): Promise<string> {
  const pool = new pg.Pool({ host: input.host, port: input.port || 5432, database: input.database, user: input.user, password: input.password, max: 1, connectionTimeoutMillis: 10_000, ssl: input.ssl ? { rejectUnauthorized: true } : undefined });
  try { const result = await pool.query('SELECT version()'); return result.rows[0]?.version || ''; }
  finally { await pool.end(); }
}

export function validateReadOnlySql(sql: string): void {
  let statements: any[];
  try { statements = parse(sql); } catch { throw new Error('SQL must be one valid read-only PostgreSQL statement. Template values may not be used as identifiers.'); }
  if (statements.length !== 1) throw new Error('Only one SQL statement is allowed.');
  if (!['select', 'with', 'show', 'values'].includes(statements[0]?.type)) throw new Error(`Only read-only queries are allowed. ${String(statements[0]?.type || 'statement').toUpperCase()} is not permitted.`);
  const unsafe = findUnsafeStatement(statements[0]);
  if (unsafe) throw new Error(`Only read-only queries are allowed. ${unsafe.toUpperCase()} is not permitted.`);
}

function findUnsafeStatement(value: any): string | null {
  if (!value || typeof value !== 'object') return null;
  const unsafeTypes = new Set(['insert', 'update', 'delete', 'truncate', 'create table', 'create index', 'create sequence', 'create extension', 'alter table', 'drop table', 'drop index', 'drop sequence', 'set', 'commit', 'rollback', 'start transaction', 'prepare', 'deallocate', 'copy', 'grant', 'revoke', 'refresh materialized view']);
  if (typeof value.type === 'string' && unsafeTypes.has(value.type.toLowerCase())) return value.type;
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) { for (const item of child) { const found = findUnsafeStatement(item); if (found) return found; } }
    else if (child && typeof child === 'object') { const found = findUnsafeStatement(child); if (found) return found; }
  }
  return null;
}

export function parameterizeSqlTemplates(sql: string, state: any): { text: string; values: any[] } {
  const values: any[] = []; const parameterByPath = new Map<string, number>();
  let output = ''; let index = 0; let mode: 'normal' | 'single' | 'double' | 'line' | 'block' | 'dollar' = 'normal'; let dollarTag = '';
  while (index < sql.length) {
    const pair = sql.slice(index, index + 2);
    if (mode === 'line') { output += sql[index]; if (sql[index++] === '\n') mode = 'normal'; continue; }
    if (mode === 'block') { output += sql[index++]; if (pair === '*/') { output += sql[index++]; mode = 'normal'; } continue; }
    if (mode === 'single' || mode === 'double') { const quote = mode === 'single' ? "'" : '"'; output += sql[index++]; if (sql[index - 1] === quote) { if (sql[index] === quote) output += sql[index++]; else mode = 'normal'; } continue; }
    if (mode === 'dollar') { if (sql.startsWith(dollarTag, index)) { output += dollarTag; index += dollarTag.length; mode = 'normal'; } else output += sql[index++]; continue; }
    if (pair === '--') { output += pair; index += 2; mode = 'line'; continue; }
    if (pair === '/*') { output += pair; index += 2; mode = 'block'; continue; }
    if (sql[index] === "'") { output += sql[index++]; mode = 'single'; continue; }
    if (sql[index] === '"') { output += sql[index++]; mode = 'double'; continue; }
    const dollar = sql.slice(index).match(/^\$[A-Za-z_0-9]*\$/)?.[0];
    if (dollar) { output += dollar; index += dollar.length; dollarTag = dollar; mode = 'dollar'; continue; }
    const token = sql.slice(index).match(/^\{\{([A-Za-z0-9_.\[\]]+)\}\}/);
    if (!token) { output += sql[index++]; continue; }
    const path = token[1]; let parameter = parameterByPath.get(path);
    if (!parameter) { const value = readTemplateValue(path, state); if (value === undefined) throw new Error(`Unresolved SQL variable: {{${path}}}`); values.push(value); parameter = values.length; parameterByPath.set(path, parameter); }
    output += `$${parameter}`; index += token[0].length;
  }
  if (/\{\{[^}]+\}\}/.test(output.replace(/'(?:''|[^'])*'/g, "''").replace(/--.*$/gm, ''))) throw new Error('SQL contains an unresolved template.');
  return { text: output, values };
}

function readTemplateValue(path: string, state: any): any {
  const tokens = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  const read = (root: any) => tokens.reduce((value, token) => value == null ? undefined : value[token], root);
  return read(state?.variables) ?? read(state?.variables?.input) ?? read(state);
}

export async function executeReadOnlyQuery(connectionId: string, sql: string, values: any[] = [], options: { maxRows?: number; timeoutMs?: number } = {}) {
  const pool = await getConnectionPool(connectionId);
  if (!pool) throw new Error('Saved database connection was not found. Select or create a connection.');
  const maxRows = Math.max(1, Math.min(Number(options.maxRows) || 100, MAX_ROWS));
  const timeoutMs = Math.max(1000, Math.min(Number(options.timeoutMs) || MAX_TIMEOUT_MS, MAX_TIMEOUT_MS));
  validateReadOnlySql(sql);
  const client = await pool.connect(); const started = Date.now();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${Math.trunc(timeoutMs)}`);
    const statementType = parse(sql)[0]?.type;
    const boundedSql = ['select', 'with', 'values'].includes(statementType)
      ? `SELECT * FROM (${sql.trim().replace(/;\s*$/, '')}) AS __workflow_query LIMIT ${maxRows + 1}`
      : sql;
    const result = await client.query({ text: boundedSql, values });
    const truncated = result.rows.length > maxRows;
    const rows = result.rows.slice(0, maxRows);
    await client.query('ROLLBACK');
    return { rows, columns: (result.fields || []).map(field => ({ name: field.name, dataTypeId: field.dataTypeID })), rowCount: rows.length, truncated, executionTime: Date.now() - started };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw new Error(sanitizeDatabaseError(error)); }
  finally { client.release(); }
}

export function sanitizeDatabaseError(error: any): string {
  return String(error?.message || 'Database query failed').replace(/postgres(?:ql)?:\/\/\S+/gi, '[connection]').replace(/password\s*=\s*\S+/gi, 'password=[redacted]').slice(0, 500);
}
