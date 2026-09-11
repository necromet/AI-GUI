import { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CustomNode from './CustomNode';
import NodeSettingsPanel from './NodeSettingsPanel';
import ExecutionPanel from './ExecutionPanel';
import WorkflowToolbar from './WorkflowToolbar';
import WorkflowSidebar from './WorkflowSidebar';
import NodeContextMenu from './NodeContextMenu';
import CanvasContextMenu from './CanvasContextMenu';
import { NODE_DEFINITIONS } from './constants';
import type { WorkflowNodeType, WorkflowNode, WorkflowEdge } from './types';
import { useAutoSave } from './hooks/useAutoSave';

const nodeTypes = { custom: CustomNode };

interface Props {
  workflowId?: string;
  onWorkflowSaved?: (id: string) => void;
  onLoadTemplate?: () => void;
}

function WorkflowCanvasInner({ workflowId, onWorkflowSaved, onLoadTemplate }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number } | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workflowId) return;
    fetch(`/api/workflows/${workflowId}`)
      .then(r => r.json())
      .then(data => {
        if (data.nodes) setNodes(data.nodes.map((n: any) => ({
          id: n.id,
          type: 'custom',
          position: n.position || { x: 0, y: 0 },
          data: n.data || { nodeType: n.type, label: n.type },
        })));
        if (data.edges) setEdges(data.edges);
        if (data.name) setWorkflowName(data.name);
      })
      .catch(console.error);
  }, [workflowId]);

  useAutoSave(workflowId, nodes, edges, true);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as WorkflowNodeType;
      if (!type) return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = {
        x: event.clientX - bounds.left - 75,
        y: event.clientY - bounds.top - 25,
      };

      const def = NODE_DEFINITIONS[type];
      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type: 'custom',
        position,
        data: {
          nodeType: type,
          label: def?.label || type,
          color: def?.color || '#6b7280',
          icon: def?.icon || 'circle',
          ...def?.defaults,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: Record<string, any>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      );
      setSelectedNode((prev) =>
        prev && prev.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev
      );
    },
    [setNodes]
  );

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setNodeContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    setSelectedNode(node);
  }, []);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setCanvasContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const handleDuplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const newNode = {
      ...node,
      id: `${node.data?.nodeType || 'node'}_${Date.now()}`,
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      data: { ...node.data },
    };
    setNodes(nds => [...nds, newNode]);
  }, [nodes, setNodes]);

  const handleDisconnectNode = useCallback((nodeId: string) => {
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
  }, [setEdges]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
  }, [setNodes, setEdges, selectedNode]);

  const handleAddNodeAtPosition = useCallback((type: WorkflowNodeType, clientX: number, clientY: number) => {
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!bounds) return;
    const position = { x: clientX - bounds.left - 75, y: clientY - bounds.top - 25 };
    const def = NODE_DEFINITIONS[type];
    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type: 'custom',
      position,
      data: { nodeType: type, label: def?.label || type, color: def?.color || '#6b7280', icon: def?.icon || 'circle', ...def?.defaults },
    };
    setNodes(nds => [...nds, newNode]);
  }, [setNodes]);

  const handleSelectAll = useCallback(() => {}, []);

  const handleDeleteSelected = useCallback(() => {
    setNodes(nds => nds.filter(n => !n.selected));
    setEdges(eds => {
      const selectedNodeIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
      return eds.filter(e => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target));
    });
  }, [nodes, setNodes, setEdges]);

  useEffect(() => {
    const handleQuickAdd = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setCanvasContextMenu({ x: detail.x, y: detail.y });
    };
    window.addEventListener('ab-quick-add', handleQuickAdd);
    return () => window.removeEventListener('ab-quick-add', handleQuickAdd);
  }, []);

  return (
    <div className="flex h-full w-full">
      <WorkflowSidebar />
      <div className="flex-1 flex flex-col">
        <WorkflowToolbar
          name={workflowName}
          onNameChange={setWorkflowName}
          nodes={nodes}
          edges={edges}
          workflowId={workflowId}
          onWorkflowSaved={onWorkflowSaved}
          onLoadTemplate={onLoadTemplate}
        />
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            colorMode="dark"
          >
            <Background color="rgba(255,255,255,0.03)" gap={20} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => n.data?.color || '#6b7280'}
              className="!bg-[#111114] !border-[#2a2a30]"
            />
            <Panel position="bottom-center">
              <ExecutionPanel nodes={nodes} edges={edges} workflowId={workflowId} />
            </Panel>
          </ReactFlow>
          {nodeContextMenu && (
            <NodeContextMenu
              x={nodeContextMenu.x}
              y={nodeContextMenu.y}
              nodeId={nodeContextMenu.nodeId}
              onEdit={() => { setSelectedNode(nodes.find(n => n.id === nodeContextMenu.nodeId) || null); }}
              onDuplicate={() => handleDuplicateNode(nodeContextMenu.nodeId)}
              onDisconnect={() => handleDisconnectNode(nodeContextMenu.nodeId)}
              onDelete={() => handleDeleteNode(nodeContextMenu.nodeId)}
              onClose={() => setNodeContextMenu(null)}
            />
          )}
          {canvasContextMenu && (
            <CanvasContextMenu
              x={canvasContextMenu.x}
              y={canvasContextMenu.y}
              onAddNode={(type) => handleAddNodeAtPosition(type, canvasContextMenu.x, canvasContextMenu.y)}
              onSelectAll={handleSelectAll}
              onDeleteSelected={handleDeleteSelected}
              onClose={() => setCanvasContextMenu(null)}
            />
          )}
        </div>
      </div>
      {selectedNode && (
        <NodeSettingsPanel
          node={selectedNode}
          onUpdate={(data) => updateNodeData(selectedNode.id, data)}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

export default function WorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
