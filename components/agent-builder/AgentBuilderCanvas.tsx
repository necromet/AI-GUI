import { useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeTypes,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { AgentNode } from './AgentNode';
import { ToolNode } from './ToolNode';
import type { AgentBuilderAgent, AgentBuilderTool, WorkflowDetail } from './types';

const nodeTypes: NodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 120;

function autoLayout(
  agents: AgentBuilderAgent[],
  tools: AgentBuilderTool[],
  savedPositions?: Record<string, { x: number; y: number }>,
  savedEdges?: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  if (agents.length === 0 && tools.length === 0) return { nodes: [], edges: [] };

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodesNeedingLayout: string[] = [];

  for (const agent of agents) {
    const id = `agent-${agent.id}`;
    const hasSavedPos = savedPositions && savedPositions[id];
    if (!hasSavedPos) {
      g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
      nodesNeedingLayout.push(id);
    }
    nodes.push({
      id,
      type: 'agent',
      position: hasSavedPos ? savedPositions[id] : { x: 0, y: 0 },
      data: {
        id: agent.id,
        name: agent.name,
        systemPrompt: agent.system_prompt,
        model: agent.model,
        color: agent.color,
        toolCount: agent.tools?.length || 0,
      },
    });
  }

  for (const t of tools) {
    const id = `tool-${t.id}`;
    const hasSavedPos = savedPositions && savedPositions[id];
    if (!hasSavedPos) {
      g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
      nodesNeedingLayout.push(id);
    }
    nodes.push({
      id,
      type: 'tool',
      position: hasSavedPos ? savedPositions[id] : { x: 0, y: 0 },
      data: {
        id: t.id,
        name: t.name,
        description: t.description,
        parameters: t.parameters_schema?.properties || {},
        color: t.color,
      },
    });
  }

  const allToolIds = new Set(tools.map(t => t.id));

  if (savedEdges && savedEdges.length > 0) {
    for (const edge of savedEdges) {
      const srcAgent = edge.source.startsWith('agent-');
      const tgtTool = edge.target.startsWith('tool-');
      if (srcAgent && tgtTool && allToolIds.has(edge.target.replace('tool-', ''))) {
        edges.push(edge);
      }
    }
  } else {
    for (const agent of agents) {
      if (agent.tools) {
        for (const t of agent.tools) {
          const sourceId = `agent-${agent.id}`;
          const targetId = `tool-${t.id}`;
          if (!allToolIds.has(t.id)) continue;
          const edgeId = `e-${agent.id}-${t.id}`;
          edges.push({
            id: edgeId,
            source: sourceId,
            target: targetId,
            animated: true,
            style: { stroke: t.color || '#66A0C8', strokeDasharray: '6 6', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: t.color || '#66A0C8' },
          });
        }
      }
    }
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  if (nodesNeedingLayout.length > 0) {
    dagre.layout(g);
    for (const node of nodes) {
      if (nodesNeedingLayout.includes(node.id)) {
        const pos = g.node(node.id);
        if (pos) {
          node.position = { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 };
        }
      }
    }
  }

  return { nodes, edges };
}

interface AgentBuilderCanvasProps {
  workflowDetail?: WorkflowDetail | null;
  agents: AgentBuilderAgent[];
  tools: AgentBuilderTool[];
  selectedAgentId: string | null;
  onNodeClick?: (nodeId: string, nodeType: 'agent' | 'tool', data: any) => void;
  onOpenDetail?: (id: string, type: 'agent' | 'tool') => void;
  onConnect?: (agentId: string, toolId: string) => void;
  onGraphChange?: (graphJson: { nodePositions: Record<string, { x: number; y: number }>; edges: Edge[] }) => void;
}

export function AgentBuilderCanvas({ workflowDetail, agents, tools, selectedAgentId, onNodeClick, onOpenDetail, onConnect, onGraphChange }: AgentBuilderCanvasProps) {
  const wfAgents = workflowDetail?.agents ?? agents;
  const wfTools = workflowDetail?.tools ?? tools;
  const savedPositions = workflowDetail?.graph_json?.nodePositions;
  const savedEdges = workflowDetail?.graph_json?.edges as Edge[] | undefined;

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => autoLayout(wfAgents, wfTools, savedPositions, savedEdges),
    [wfAgents, wfTools, savedPositions, savedEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  const onGraphChangeRef = useRef(onGraphChange);
  onGraphChangeRef.current = onGraphChange;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleGraphSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const positions: Record<string, { x: number; y: number }> = {};
      for (const n of nodes) {
        positions[n.id] = n.position;
      }
      onGraphChangeRef.current?.({ nodePositions: positions, edges });
    }, 400);
  }, [nodes, edges]);

  useEffect(() => {
    setNodes(layoutNodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        onOpenDetail: (id: string) => onOpenDetail?.(id, n.type === 'agent' ? 'agent' : 'tool'),
      },
    })));
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges, onOpenDetail]);

  const handleNodeDragStop = useCallback(() => {
    scheduleGraphSave();
  }, [scheduleGraphSave]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const type = node.type === 'agent' ? 'agent' : 'tool';
      onNodeClick?.(node.data.id as string, type, node.data);
    },
    [onNodeClick]
  );

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const srcIsAgent = connection.source.startsWith('agent-');
    const tgtIsAgent = connection.target.startsWith('agent-');

    let agentId: string, toolId: string;
    if (srcIsAgent && !tgtIsAgent) {
      agentId = connection.source.replace('agent-', '');
      toolId = connection.target.replace('tool-', '');
    } else if (!srcIsAgent && tgtIsAgent) {
      toolId = connection.source.replace('tool-', '');
      agentId = connection.target.replace('agent-', '');
    } else {
      return;
    }

    onConnect?.(agentId, toolId);
    scheduleGraphSave();
  }, [onConnect, scheduleGraphSave]);

  const isValidConnection = useCallback((connection: Connection) => {
    const srcIsAgent = connection.source?.startsWith('agent-');
    const tgtIsAgent = connection.target?.startsWith('agent-');
    return srcIsAgent !== tgtIsAgent;
  }, []);

  return (
    <div className="ab-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange as OnEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        edgesReconnectable={false}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
