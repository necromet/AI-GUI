import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorkflowGraph, validateWorkflowGraph } from '../../lib/workflow/graph.js';
import { getBuiltinTemplates } from '../../server/services/workflowTemplates.js';

const node = (id: string, type: string, data: Record<string, any> = {}) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { nodeType: type, label: id, ...data },
});

test('normalizes legacy React Flow custom nodes without dropping data', () => {
  const graph = normalizeWorkflowGraph([
    { id: 'agent_1', type: 'custom', position: { x: 10, y: 20 }, data: { nodeType: 'agent', label: 'Research', model: 'mimo-v2.5', userPrompt: 'Go' } },
  ], []);
  assert.equal(graph.nodes[0].type, 'agent');
  assert.equal(graph.nodes[0].data.label, 'Research');
  assert.equal(graph.nodes[0].data.model, 'mimo-v2.5');
});

test('accepts a connected Start to End workflow', () => {
  const issues = validateWorkflowGraph(
    [node('start_1', 'start'), node('end_1', 'end')],
    [{ id: 'edge_1', source: 'start_1', target: 'end_1' }],
  );
  assert.deepEqual(issues, []);
});

test('blocks the reported unreachable agent scenario before LangGraph compilation', () => {
  const unreachableId = 'agent_1789027907589';
  const issues = validateWorkflowGraph(
    [node('start_1', 'start'), node('end_1', 'end'), node(unreachableId, 'agent', { model: 'mimo-v2.5', userPrompt: 'Hello' })],
    [{ id: 'edge_1', source: 'start_1', target: 'end_1' }],
  );
  assert.ok(issues.some(issue => issue.code === 'unreachable_node' && issue.nodeId === unreachableId));
});

test('reports dangling edges while preserving the source graph', () => {
  const nodes = [node('start_1', 'start'), node('end_1', 'end')];
  const edges = [
    { id: 'edge_ok', source: 'start_1', target: 'end_1' },
    { id: 'edge_stale', source: 'missing', target: 'end_1' },
  ];
  const issues = validateWorkflowGraph(nodes, edges);
  assert.ok(issues.some(issue => issue.code === 'dangling_edge' && issue.edgeId === 'edge_stale'));
  assert.equal(edges.length, 2);
});

test('requires every branch and accepts parallel reachable destinations', () => {
  const branching = validateWorkflowGraph(
    [node('start', 'start'), node('condition', 'if-else', { condition: 'true' }), node('end', 'end')],
    [
      { id: 'a', source: 'start', target: 'condition' },
      { id: 'b', source: 'condition', sourceHandle: 'if', target: 'end' },
    ],
  );
  assert.ok(branching.some(issue => issue.code === 'missing_branch' && issue.severity === 'warning'));

  const parallel = validateWorkflowGraph(
    [
      node('start', 'start'),
      node('agent_a', 'agent', { model: 'mimo-v2.5', userPrompt: 'A' }),
      node('agent_b', 'agent', { model: 'mimo-v2.5', userPrompt: 'B' }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'agent_a' },
      { id: 'b', source: 'start', target: 'agent_b' },
      { id: 'c', source: 'agent_a', target: 'end' },
      { id: 'd', source: 'agent_b', target: 'end' },
    ],
  );
  assert.equal(parallel.filter(issue => issue.severity === 'error').length, 0);
});

test('validates simple conditions and includes string branch destinations in reachability', () => {
  const nodes = [
    node('start', 'start'),
    node('condition', 'if-else', {
      conditionMode: 'simple',
      conditionRule: { left: 'input.status', op: 'eq', right: 'ready' },
      truePath: 'Success',
    }),
    node('success', 'end', { label: 'Success' }),
  ];
  const issues = validateWorkflowGraph(nodes, [{ id: 'a', source: 'start', target: 'condition' }]);
  assert.equal(issues.some(issue => issue.code === 'unreachable_node' && issue.nodeId === 'success'), false);
  assert.equal(issues.some(issue => issue.severity === 'error'), false);
});

test('reports incomplete rules, invalid paths, and edge-path conflicts', () => {
  const baseNodes = [
    node('start', 'start'),
    node('condition', 'if-else', { conditionMode: 'simple', conditionRule: { left: 'input', op: 'contains', right: '' }, truePath: 'missing' }),
    node('end', 'end'),
  ];
  const invalid = validateWorkflowGraph(baseNodes, [{ id: 'a', source: 'start', target: 'condition' }]);
  assert.ok(invalid.some(issue => issue.code === 'if-else_condition' && issue.severity === 'error'));
  assert.ok(invalid.some(issue => issue.code === 'invalid_branch_path' && issue.severity === 'error'));

  const conflictNodes = baseNodes.map(item => item.id === 'condition' ? node('condition', 'if-else', { condition: 'true', truePath: 'end' }) : item);
  const conflict = validateWorkflowGraph(conflictNodes, [
    { id: 'a', source: 'start', target: 'condition' },
    { id: 'b', source: 'condition', sourceHandle: 'if', target: 'end' },
  ]);
  assert.ok(conflict.some(issue => issue.code === 'branch_path_conflict' && issue.severity === 'warning'));
});

test('rejects ambiguous and ineligible string destinations', () => {
  const ambiguous = validateWorkflowGraph([
    node('start', 'start'),
    node('condition', 'if-else', { condition: 'true', truePath: 'Duplicate' }),
    node('first', 'end', { label: 'Duplicate' }),
    node('second', 'end', { label: 'Duplicate' }),
  ], [{ id: 'a', source: 'start', target: 'condition' }]);
  assert.ok(ambiguous.some(issue => issue.code === 'invalid_branch_path' && issue.message.includes('ambiguous')));

  const startTarget = validateWorkflowGraph([
    node('start', 'start'),
    node('condition', 'if-else', { condition: 'true', truePath: 'start' }),
    node('end', 'end'),
  ], [{ id: 'a', source: 'start', target: 'condition' }]);
  assert.ok(startTarget.some(issue => issue.code === 'invalid_branch_path' && issue.message.includes('Start')));
});

test('ignores disconnected visual notes', () => {
  const issues = validateWorkflowGraph(
    [node('start', 'start'), node('end', 'end'), node('note', 'note', { text: 'Docs' })],
    [{ id: 'edge', source: 'start', target: 'end' }],
  );
  assert.equal(issues.some(issue => issue.nodeId === 'note'), false);
});

test('all bundled workflow templates pass structural validation', () => {
  for (const template of getBuiltinTemplates()) {
    const errors = validateWorkflowGraph(template.nodes, template.edges).filter(issue => issue.severity === 'error');
    assert.deepEqual(errors, [], template.name);
  }
});
