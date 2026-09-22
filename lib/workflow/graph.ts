import {
  WORKFLOW_NODE_TYPES,
  type WorkflowEdge,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeType,
  type WorkflowValidationIssue,
} from './types.js';
import { validateConditionNode } from './conditions.js';

const NODE_TYPES = new Set<string>(WORKFLOW_NODE_TYPES);
const EXECUTABLE_TYPES = new Set<string>(WORKFLOW_NODE_TYPES.filter(type => type !== 'note'));

export function getWorkflowNodeType(node: any): WorkflowNodeType | string {
  return String(node?.data?.nodeType || node?.type || '').trim().toLowerCase();
}

export function normalizeWorkflowGraph(rawNodes: any[] = [], rawEdges: any[] = []): WorkflowGraph {
  const nodes: WorkflowNode[] = rawNodes.map((raw, index) => {
    const rawType = getWorkflowNodeType(raw);
    const type = (NODE_TYPES.has(rawType) ? rawType : rawType || 'agent') as WorkflowNodeType;
    const id = String(raw?.id || `${type}_${index}`);
    const position = raw?.position && Number.isFinite(raw.position.x) && Number.isFinite(raw.position.y)
      ? { x: raw.position.x, y: raw.position.y }
      : { x: index * 240, y: 160 };
    const label = typeof raw?.data?.label === 'string'
      ? raw.data.label
      : typeof raw?.label === 'string' ? raw.label : type;

    return {
      ...raw,
      id,
      type,
      position,
      data: { ...(raw?.data || {}), nodeType: type, label },
      label,
    } as WorkflowNode;
  });

  const edges: WorkflowEdge[] = rawEdges.map((raw, index) => {
    const source = String(raw?.source || '');
    const sourceNode = nodes.find(node => node.id === source);
    const handle = normalizeHandle(raw?.sourceHandle || raw?.label);
    const defaultBranchLabel = getWorkflowNodeType(sourceNode) === 'if-else'
      ? handle === 'if' ? sourceNode?.data?.trueLabel || 'True' : handle === 'else' ? sourceNode?.data?.falseLabel || 'False' : undefined
      : undefined;
    return {
      ...raw,
      id: String(raw?.id || `edge_${index}`),
      source,
      target: String(raw?.target || ''),
      sourceHandle: raw?.sourceHandle || undefined,
      targetHandle: raw?.targetHandle || undefined,
      label: typeof raw?.label === 'string' && raw.label.trim() ? raw.label : defaultBranchLabel,
    };
  });

  return { nodes, edges };
}

function addIssue(issues: WorkflowValidationIssue[], issue: WorkflowValidationIssue, seen: Set<string>) {
  const key = `${issue.code}:${issue.nodeId || ''}:${issue.edgeId || ''}`;
  if (!seen.has(key)) {
    seen.add(key);
    issues.push(issue);
  }
}

export function validateWorkflowGraph(rawNodes: any[] = [], rawEdges: any[] = []): WorkflowValidationIssue[] {
  const { nodes, edges } = normalizeWorkflowGraph(rawNodes, rawEdges);
  const issues: WorkflowValidationIssue[] = [];
  const seen = new Set<string>();
  const nodeMap = new Map<string, WorkflowNode>();

  for (const node of nodes) {
    if (nodeMap.has(node.id)) addIssue(issues, { code: 'duplicate_node_id', severity: 'error', message: `Duplicate node id "${node.id}"`, nodeId: node.id }, seen);
    nodeMap.set(node.id, node);
    if (!NODE_TYPES.has(getWorkflowNodeType(node))) addIssue(issues, { code: 'unknown_node_type', severity: 'error', message: `"${node.data?.label || node.id}" has an unsupported node type`, nodeId: node.id }, seen);
  }

  const starts = nodes.filter(node => getWorkflowNodeType(node) === 'start');
  const ends = nodes.filter(node => getWorkflowNodeType(node) === 'end');
  if (starts.length !== 1) addIssue(issues, { code: 'start_count', severity: 'error', message: starts.length === 0 ? 'Workflow needs one Start node' : 'Workflow can only have one Start node' }, seen);
  if (ends.length === 0) addIssue(issues, { code: 'missing_end', severity: 'error', message: 'Workflow needs at least one End node' }, seen);

  const validEdges: WorkflowEdge[] = [];
  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) addIssue(issues, { code: 'duplicate_edge_id', severity: 'error', message: `Duplicate edge id "${edge.id}"`, edgeId: edge.id }, seen);
    edgeIds.add(edge.id);
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) {
      addIssue(issues, { code: 'dangling_edge', severity: 'error', edgeId: edge.id, message: `Connection "${edge.id}" points to a node that no longer exists` }, seen);
      continue;
    }
    if (edge.source === edge.target) {
      addIssue(issues, { code: 'self_edge', severity: 'error', edgeId: edge.id, nodeId: edge.source, message: 'A node cannot connect to itself' }, seen);
      continue;
    }
    if (getWorkflowNodeType(source) === 'note' || getWorkflowNodeType(target) === 'note') {
      addIssue(issues, { code: 'note_edge', severity: 'error', edgeId: edge.id, message: 'Notes are visual only and cannot be connected' }, seen);
      continue;
    }
    if (getWorkflowNodeType(source) === 'end') {
      addIssue(issues, { code: 'end_outgoing', severity: 'error', edgeId: edge.id, nodeId: source.id, message: 'End nodes cannot have outgoing connections' }, seen);
      continue;
    }
    if (getWorkflowNodeType(target) === 'start') {
      addIssue(issues, { code: 'start_incoming', severity: 'error', edgeId: edge.id, nodeId: target.id, message: 'Start nodes cannot have incoming connections' }, seen);
      continue;
    }
    validEdges.push(edge);
  }

  const outgoing = new Map<string, WorkflowEdge[]>();
  for (const edge of validEdges) outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge]);

  const routingEdges = [...validEdges];
  for (const node of nodes) {
    if (getWorkflowNodeType(node) !== 'if-else') continue;
    for (const handle of ['if', 'else'] as const) {
      const resolution = resolveIfElseBranch(node, handle, nodes, validEdges);
      if (resolution.source === 'path' && resolution.targetId) {
        routingEdges.push({
          id: `virtual:${node.id}:${handle}`,
          source: node.id,
          target: resolution.targetId,
          sourceHandle: handle,
          label: handle === 'if' ? node.data?.trueLabel || 'True' : node.data?.falseLabel || 'False',
        });
      }
    }
  }
  const routingOutgoing = new Map<string, WorkflowEdge[]>();
  for (const edge of routingEdges) routingOutgoing.set(edge.source, [...(routingOutgoing.get(edge.source) || []), edge]);

  const requiredHandles: Record<string, string[]> = {
    'if-else': ['if', 'else'],
    while: ['continue', 'break'],
    'user-approval': ['approve', 'reject'],
  };
  for (const node of nodes) {
    const type = getWorkflowNodeType(node);
    if (!EXECUTABLE_TYPES.has(type)) continue;
    const nodeEdges = outgoing.get(node.id) || [];
    if (type !== 'end' && type !== 'if-else' && nodeEdges.length === 0) addIssue(issues, { code: 'dead_end', severity: 'error', nodeId: node.id, message: `"${node.data?.label || node.id}" needs an outgoing connection` }, seen);
    for (const handle of requiredHandles[type] || []) {
      if (type === 'if-else') {
        const resolution = resolveIfElseBranch(node, handle as 'if' | 'else', nodes, validEdges);
        const branchName = handle === 'if' ? 'True' : 'False';
        if (resolution.error) addIssue(issues, { code: 'invalid_branch_path', severity: 'error', nodeId: node.id, message: `"${node.data?.label || node.id}" ${branchName} destination ${resolution.error}` }, seen);
        else if (resolution.conflict) addIssue(issues, { code: 'branch_path_conflict', severity: 'warning', nodeId: node.id, message: `"${node.data?.label || node.id}" ${branchName} edge overrides its text destination` }, seen);
        else if (!resolution.targetId) addIssue(issues, { code: 'missing_branch', severity: 'warning', nodeId: node.id, message: `"${node.data?.label || node.id}" ${branchName} branch is not connected and will end` }, seen);
      } else if (!nodeEdges.some(edge => normalizeHandle(edge.sourceHandle || edge.label) === handle)) {
        addIssue(issues, { code: 'missing_branch', severity: 'error', nodeId: node.id, message: `"${node.data?.label || node.id}" needs a ${handle} connection` }, seen);
      }
    }
    validateNodeConfiguration(node, issues, seen);
  }

  if (starts.length === 1) {
    const reachable = traverse(starts[0].id, routingOutgoing);
    for (const node of nodes) {
      const type = getWorkflowNodeType(node);
      if (type !== 'note' && !reachable.has(node.id)) addIssue(issues, { code: 'unreachable_node', severity: 'error', nodeId: node.id, message: `"${node.data?.label || node.id}" is not reachable from Start` }, seen);
    }

    const reverse = new Map<string, WorkflowEdge[]>();
    for (const edge of routingEdges) reverse.set(edge.target, [...(reverse.get(edge.target) || []), edge]);
    const terminalBranches = nodes.filter(node => getWorkflowNodeType(node) === 'if-else' && (['if', 'else'] as const).some(handle => !resolveIfElseBranch(node, handle, nodes, validEdges).targetId));
    const canReachEnd = new Set<string>([...ends.map(node => node.id), ...terminalBranches.map(node => node.id)]);
    const queue = [...canReachEnd];
    while (queue.length) {
      const id = queue.shift()!;
      for (const edge of reverse.get(id) || []) {
        if (!canReachEnd.has(edge.source)) {
          canReachEnd.add(edge.source);
          queue.push(edge.source);
        }
      }
    }
    for (const node of nodes) {
      const type = getWorkflowNodeType(node);
      if (type !== 'note' && reachable.has(node.id) && !canReachEnd.has(node.id)) addIssue(issues, { code: 'no_completion_path', severity: 'error', nodeId: node.id, message: `"${node.data?.label || node.id}" has no path to an End node` }, seen);
    }
  }

  return issues;
}

export function normalizeHandle(value?: string): string {
  const handle = String(value || '').toLowerCase().trim();
  if (['true', 'yes'].includes(handle)) return 'if';
  if (['false', 'no'].includes(handle)) return 'else';
  if (['loop', 'next'].includes(handle)) return 'continue';
  if (['exit', 'stop', 'complete'].includes(handle)) return 'break';
  if (handle === 'approved') return 'approve';
  if (handle === 'rejected') return 'reject';
  return handle;
}

export interface BranchResolution {
  targetId?: string;
  source: 'edge' | 'path' | 'none';
  path?: string;
  conflict?: boolean;
  error?: string;
}

export function resolveIfElseBranch(
  node: WorkflowNode,
  handle: 'if' | 'else',
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): BranchResolution {
  const edge = edges.find(item => item.source === node.id && normalizeHandle(item.sourceHandle || item.label) === handle);
  const path = String(handle === 'if' ? node.data?.truePath || '' : node.data?.falsePath || '').trim();
  if (edge) return { targetId: edge.target, source: 'edge', path: path || undefined, conflict: Boolean(path) };
  if (!path) return { source: 'none' };
  const byId = nodes.find(item => item.id === path);
  if (byId) {
    const targetError = invalidBranchTarget(node, byId);
    return targetError ? { source: 'path', path, error: targetError } : { targetId: byId.id, source: 'path', path };
  }
  const normalizedPath = path.toLocaleLowerCase();
  const labelMatches = nodes.filter(item => item.id !== node.id && String(item.data?.label || item.label || '').trim().toLocaleLowerCase() === normalizedPath);
  if (labelMatches.length === 1) {
    const targetError = invalidBranchTarget(node, labelMatches[0]);
    return targetError ? { source: 'path', path, error: targetError } : { targetId: labelMatches[0].id, source: 'path', path };
  }
  if (labelMatches.length > 1) return { source: 'path', path, error: `"${path}" is ambiguous` };
  return { source: 'path', path, error: `"${path}" does not match a node` };
}

function invalidBranchTarget(source: WorkflowNode, target: WorkflowNode): string | null {
  if (source.id === target.id) return 'cannot point back to the same node';
  const type = getWorkflowNodeType(target);
  if (type === 'start') return 'cannot point to Start';
  if (type === 'note') return 'cannot point to a visual note';
  return null;
}

function traverse(start: string, outgoing: Map<string, WorkflowEdge[]>): Set<string> {
  const visited = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift()!;
    for (const edge of outgoing.get(id) || []) {
      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push(edge.target);
      }
    }
  }
  return visited;
}

function validateNodeConfiguration(node: WorkflowNode, issues: WorkflowValidationIssue[], seen: Set<string>) {
  const type = getWorkflowNodeType(node);
  const data = node.data || {};
  const label = data.label || node.id;
  const required = (ok: boolean, code: string, message: string) => {
    if (!ok) addIssue(issues, { code, severity: 'error', nodeId: node.id, message: `"${label}" ${message}` }, seen);
  };

  if (type === 'agent') {
    required(Boolean(data.model), 'agent_model', 'needs a model');
    required(Boolean(String(data.userPrompt || data.systemPrompt || data.instructions || '').trim()), 'agent_prompt', 'needs instructions or a prompt');
  } else if (type === 'mcp') required(Boolean(data.toolName || data.mcpAction), 'mcp_tool', 'needs an MCP action or tool');
  else if (type === 'http') required(Boolean(String(data.url || data.httpUrl || '').trim()), 'http_url', 'needs a URL');
  else if (type === 'if-else') {
    const conditionError = validateConditionNode(data);
    required(!conditionError, 'if-else_condition', conditionError || 'needs a condition');
  } else if (type === 'while') required(Boolean(String(data.condition || data.whileCondition || '').trim()), `${type}_condition`, 'needs a condition');
  else if (type === 'transform') required(Boolean(String(data.code || data.transformScript || '').trim()), 'transform_code', 'needs transformation code');
  else if (type === 'set-state') required(Boolean(data.stateKey || (data.variables && Object.keys(data.variables).length)), 'state_value', 'needs a state value');
  else if (type === 'extract') required(Boolean(data.schema || data.extractConfig?.schema || data.fields?.length), 'extract_schema', 'needs fields or a schema');
  else if (type === 'arcade') {
    required(Boolean(data.arcadeTool), 'arcade_tool', 'needs an Arcade tool');
    required(Boolean(data.arcadeUserId), 'arcade_user', 'needs an Arcade user ID');
  }
}
