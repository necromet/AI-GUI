import { Router, Request, Response } from 'express';
import {
  closeConnectionPool,
  createDatabaseConnection,
  deleteDatabaseConnection,
  executeReadOnlyQuery,
  findDatabaseConnection,
  getConnectionPool,
  listDatabaseConnections,
  sanitizeDatabaseError,
  testDatabaseConnection,
  updateDatabaseConnection,
} from '../services/databaseConnectionService.js';

const router = Router();

router.get('/connections', async (_req: Request, res: Response) => {
  try {
    const connections = await listDatabaseConnections();
    res.json({ connections });
  } catch (error: any) {
    console.error('[database/connections] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/connections/:id', async (req: Request, res: Response) => {
  try {
    const connection = await findDatabaseConnection(String(req.params.id));
    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    res.json({ connection });
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
    const id = await createDatabaseConnection({ name, host, port, database, user, password, ssl });
    res.json({ id });
  } catch (error: any) {
    console.error('[database/connections POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/connections/:id', async (req: Request, res: Response) => {
  try {
    await updateDatabaseConnection(String(req.params.id), req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[database/connections/:id PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/connections/:id', async (req: Request, res: Response) => {
  try {
    await deleteDatabaseConnection(String(req.params.id));
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
    const version = await testDatabaseConnection({ host, port, database, user, password, ssl });
    res.json({ success: true, version });
  } catch (error: any) {
    console.error('[database/test] Error:', error.message);
    res.json({ success: false, error: sanitizeDatabaseError(error) });
  }
});

router.post('/schema', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.body;
    if (!connectionId) {
      res.status(400).json({ error: 'Missing connectionId' });
      return;
    }
    const pool = await getConnectionPool(connectionId);
    if (!pool) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
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
    res.status(500).json({ error: sanitizeDatabaseError(error) });
  }
});

router.post('/query', async (req: Request, res: Response) => {
  try {
    const { connectionId, sql, maxRows, force, timeout } = req.body;
    if (!connectionId || !sql) {
      res.status(400).json({ error: 'Missing connectionId or sql' });
      return;
    }
    const result = await executeReadOnlyQuery(connectionId, sql, [], { maxRows: maxRows ?? 1000, timeoutMs: timeout });
    const columnNames = result.columns.map(column => column.name);
    const flatRows = result.rows.map((row: any) => columnNames.map(column => row[column]));

    res.json({
      columns: columnNames,
      rows: flatRows,
      rowCount: result.rowCount,
      executionTime: result.executionTime,
      truncated: result.truncated,
    });
  } catch (error: any) {
    console.error('[database/query] Error:', error.message);
    res.status(500).json({
      columns: [],
      rows: [],
      rowCount: 0,
      executionTime: 0,
      error: sanitizeDatabaseError(error),
    });
  }
});

router.delete('/connections/:id/pool', async (req: Request, res: Response) => {
  try {
    closeConnectionPool(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/connections/:id/ping', async (req: Request, res: Response) => {
  try {
    const pool = await getConnectionPool(String(req.params.id));
    if (!pool) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    const client = await pool.connect();
    client.release();
    res.json({ reachable: true });
  } catch (error: any) {
    res.json({ reachable: false, error: sanitizeDatabaseError(error) });
  }
});

export default router;
