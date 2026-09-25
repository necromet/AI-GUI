import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWorkflowGraph } from '../../lib/workflow/graph.js';
import { WORKFLOW_NODE_TYPES } from '../../lib/workflow/types.js';
import { parameterizeSqlTemplates, validateReadOnlySql } from '../../server/services/databaseConnectionService.js';
import { redactWorkflowSecrets } from '../../server/services/workflowRedaction.js';

test('normalizes all workflow edges to the interactive renderer', () => {
  const graph = normalizeWorkflowGraph(
    [{ id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} }, { id: 'end', type: 'end', position: { x: 10, y: 0 }, data: {} }],
    [{ id: 'edge', source: 'start', target: 'end', type: 'default' }],
  );
  assert.equal(graph.edges[0].type, 'interactive');
});

test('keeps history and memory as Agent switches, not workflow node types', () => {
  assert.equal(WORKFLOW_NODE_TYPES.includes('chat-history' as any), false);
  assert.equal(WORKFLOW_NODE_TYPES.includes('chat-memory' as any), false);
  const [legacy] = normalizeWorkflowGraph([{ id: 'old', type: 'database', position: { x: 2, y: 3 }, data: { sourceType: 'chat-history', limit: 12 } }], []).nodes;
  assert.equal(legacy.id, 'old');
  assert.deepEqual(legacy.position, { x: 2, y: 3 });
  assert.equal(legacy.data.dataSource, '');
  assert.match(legacy.data.migrationWarning, /Agent History\/Memory switches/);
});

test('migrates legacy document nodes and strips embedded connection secrets', () => {
  const [node] = normalizeWorkflowGraph([{ id: 'db', type: 'database', data: { sourceType: 'documents', password: 'secret', host: 'private', query: 'hello' } }], []).nodes;
  assert.equal(node.data.dataSource, 'documents');
  assert.equal(node.data.query, 'hello');
  assert.equal(node.data.password, undefined);
  assert.equal(node.data.host, undefined);
});

test('parameterizes SQL templates outside strings and comments with repeated values', () => {
  const result = parameterizeSqlTemplates(
    "SELECT * FROM users WHERE id = {{input.id}} OR owner_id = {{input.id}} AND active = {{active}} -- {{ignored}}\nAND note = '{{literal}}'",
    { variables: { input: { id: 42 }, active: true } },
  );
  assert.match(result.text, /id = \$1 OR owner_id = \$1/);
  assert.match(result.text, /active = \$2/);
  assert.match(result.text, /-- \{\{ignored\}\}/);
  assert.match(result.text, /'\{\{literal\}\}'/);
  assert.deepEqual(result.values, [42, true]);
  assert.throws(() => parameterizeSqlTemplates('SELECT {{missing}}', { variables: {} }), /Unresolved SQL variable/);
});

test('AST validation accepts reads and rejects mutations, CTE writes, and multiple statements', () => {
  assert.doesNotThrow(() => validateReadOnlySql('SELECT id FROM users WHERE active = true'));
  assert.doesNotThrow(() => validateReadOnlySql('WITH x AS (SELECT 1 AS id) SELECT * FROM x'));
  assert.throws(() => validateReadOnlySql('SELECT 1; SELECT 2'), /one SQL statement/i);
  assert.throws(() => validateReadOnlySql('UPDATE users SET active = false'), /read-only/i);
  assert.throws(() => validateReadOnlySql('WITH changed AS (DELETE FROM users RETURNING id) SELECT * FROM changed'), /DELETE/i);
  assert.throws(() => validateReadOnlySql("SET search_path = public"), /read-only/i);
});

test('redacts secret-shaped fields recursively while preserving connection references', () => {
  const safe = redactWorkflowSecrets({ connectionId: 'conn_1', nested: { password: 'nope', passwordEncrypted: 'nope', api_key: 'nope', value: 3 } });
  assert.equal(safe.connectionId, 'conn_1');
  assert.equal(safe.nested.password, '[redacted]');
  assert.equal(safe.nested.passwordEncrypted, '[redacted]');
  assert.equal(safe.nested.api_key, '[redacted]');
  assert.equal(safe.nested.value, 3);
});
