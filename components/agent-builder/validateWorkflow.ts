import type { Node, Edge } from '@xyflow/react';
import type { WorkflowNodeType } from './types';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
}

export function validateWorkflow(nodes: Node[], edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const hasStart = nodes.some(n => (n.data?.nodeType as WorkflowNodeType) === 'start');
  const hasEnd = nodes.some(n => (n.data?.nodeType as WorkflowNodeType) === 'end');

  if (!hasStart) issues.push({ severity: 'error', message: 'Workflow has no Start node' });
  if (!hasEnd) issues.push({ severity: 'warning', message: 'Workflow has no End node' });

  const connectedNodeIds = new Set<string>();
  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  for (const node of nodes) {
    const nodeType = node.data?.nodeType as WorkflowNodeType;
    if (nodeType === 'note') continue;

    if (nodes.length > 1 && !connectedNodeIds.has(node.id)) {
      issues.push({ severity: 'warning', message: `"${node.data?.label || nodeType}" is not connected`, nodeId: node.id });
    }

    if (nodeType === 'agent') {
      if (!node.data?.model) issues.push({ severity: 'error', message: `Agent "${node.data?.label || node.id}" has no model selected`, nodeId: node.id });
      if (!node.data?.userPrompt && !node.data?.systemPrompt) issues.push({ severity: 'warning', message: `Agent "${node.data?.label || node.id}" has no prompt`, nodeId: node.id });
    }

    if (nodeType === 'http') {
      if (!node.data?.url) issues.push({ severity: 'error', message: `HTTP "${node.data?.label || node.id}" has no URL`, nodeId: node.id });
    }

    if (nodeType === 'if-else') {
      if (!node.data?.condition) issues.push({ severity: 'warning', message: `If/Else "${node.data?.label || node.id}" has no condition`, nodeId: node.id });
    }

    if (nodeType === 'while') {
      if (!node.data?.condition) issues.push({ severity: 'warning', message: `While "${node.data?.label || node.id}" has no condition`, nodeId: node.id });
    }
  }

  return issues;
}
