import type { Node, Edge } from '@xyflow/react';
import { validateWorkflowGraph } from '../../lib/workflow/graph';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
}

export function validateWorkflow(nodes: Node[], edges: Edge[]): ValidationIssue[] {
  return validateWorkflowGraph(nodes, edges).map(issue => ({
    severity: issue.severity,
    message: issue.message,
    nodeId: issue.nodeId,
  }));
}
