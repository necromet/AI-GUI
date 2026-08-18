import { useCallback, useRef, useState } from 'react';
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
import WorkflowSidebar from './WorkflowSidebar';
import NodeSettingsPanel from './NodeSettingsPanel';
import ExecutionPanel from './ExecutionPanel';
import WorkflowToolbar from './WorkflowToolbar';
import { NODE_DEFINITIONS } from './constants';
import type { WorkflowNodeType, WorkflowNode, WorkflowEdge } from './types';

const nodeTypes = { custom: CustomNode };

interface Props {
  workflowId?: string;
  onWorkflowSaved?: (id: string) => void;
}

function WorkflowCanvasInner({ workflowId, onWorkflowSaved }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

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
    },
    [setNodes]
  );

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
