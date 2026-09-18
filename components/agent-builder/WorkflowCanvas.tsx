import { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
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
import NodeContextMenu from './NodeContextMenu';
import CanvasContextMenu from './CanvasContextMenu';
import CommandPalette from './CommandPalette';
import EdgeLabelModal from './EdgeLabelModal';
import OnboardingOverlay from './OnboardingOverlay';
import ShortcutOverlay from './ShortcutOverlay';
import { ExecutionStatusProvider, useExecutionStatus } from './ExecutionStatusContext';
import { NODE_DEFINITIONS, DEFAULT_NODE_COLOR } from './constants';
import type { WorkflowNodeType, WorkflowHeaderControls } from './types';
import { useAutoSave } from './hooks/useAutoSave';
import { useUndoRedo } from './hooks/useUndoRedo';
import { validateWorkflow } from './validateWorkflow';
import { cleanupInvalidEdges } from './edgeCleanup';

const nodeTypes = { custom: CustomNode };

interface Props {
  workflowId?: string;
  onWorkflowSaved?: (id: string) => void;
  onLoadTemplate?: () => void;
  onBack?: () => void;
  onHeaderControls?: (controls: WorkflowHeaderControls | null) => void;
}

function WorkflowCanvasInner({ workflowId, onWorkflowSaved, onLoadTemplate, onBack, onHeaderControls }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { getNodeStatus } = useExecutionStatus();

  // Add animation classes to edges based on source node execution status
  const animatedEdges = edges.map(edge => {
    const sourceStatus = getNodeStatus(edge.source);
    if (sourceStatus?.status === 'running') {
      return { ...edge, className: 'ab-edge-active', animated: true };
    }
    if (sourceStatus?.status === 'completed') {
      return { ...edge, className: '', animated: false };
    }
    return { ...edge, className: '', animated: edge.animated ?? true };
  });
  const [shortcutOverlayOpen, setShortcutOverlayOpen] = useState(false);
  const [edgeLabelEdit, setEdgeLabelEdit] = useState<{ edgeId: string; label?: string; x: number; y: number } | null>(null);
  const [recentNodeTypes, setRecentNodeTypes] = useState<WorkflowNodeType[]>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  const undoRedo = useUndoRedo();

  useEffect(() => {
    if (!workflowId) return;
    fetch(`/api/workflows/${workflowId}`)
      .then(r => r.json())
      .then(data => {
        const loadedNodes = data.nodes ? data.nodes.map((n: any) => ({
          id: n.id,
          type: 'custom',
          position: n.position || { x: 0, y: 0 },
          data: n.data || { nodeType: n.type, label: n.type },
        })) : [];
        if (data.nodes) setNodes(loadedNodes);
        if (data.edges) setEdges(cleanupInvalidEdges(loadedNodes, data.edges));
        if (data.name) setWorkflowName(data.name);
      })
      .catch(console.error);
  }, [workflowId]);

  useAutoSave(workflowId, nodes, edges, true);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source === params.target) return;
      const isDuplicate = edges.some(e =>
        e.source === params.source &&
        e.target === params.target &&
        e.sourceHandle === params.sourceHandle
      );
      if (isDuplicate) return;
      undoRedo.pushSnapshot(nodes, edges, 'Connect nodes');
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    },
    [setEdges, nodes, edges, undoRedo]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setNodeContextMenu(null);
    setCanvasContextMenu(null);
  }, []);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setEdgeLabelEdit({ edgeId: edge.id, label: edge.label as string | undefined, x: _.clientX, y: _.clientY });
  }, []);

  const handleEdgeLabelUpdate = useCallback((edgeId: string, label: string) => {
    undoRedo.pushSnapshot(nodes, edges, 'Update edge label');
    setEdges(eds => eds.map(e => e.id === edgeId ? { ...e, label } : e));
  }, [nodes, edges, undoRedo, setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const createNode = useCallback((type: WorkflowNodeType, position: { x: number; y: number }) => {
    const def = NODE_DEFINITIONS[type];
    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type: 'custom',
      position,
      data: {
        nodeType: type,
        label: def?.label || type,
        color: def?.color || DEFAULT_NODE_COLOR,
        icon: def?.icon || 'circle',
        ...def?.defaults,
      },
    };
    return newNode;
  }, []);

  const addNode = useCallback((type: WorkflowNodeType, position: { x: number; y: number }) => {
    undoRedo.pushSnapshot(nodes, edges, `Add ${NODE_DEFINITIONS[type]?.label || type}`);
    const newNode = createNode(type, position);
    setNodes((nds) => [...nds, newNode]);
    setRecentNodeTypes(prev => [type, ...prev.filter(t => t !== type)].slice(0, 5));
    return newNode;
  }, [nodes, edges, undoRedo, createNode, setNodes]);

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

      addNode(type, position);
    },
    [addNode]
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
    undoRedo.pushSnapshot(nodes, edges, `Duplicate ${node.data?.label || 'node'}`);
    const newNode = {
      ...node,
      id: `${node.data?.nodeType || 'node'}_${Date.now()}`,
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      data: { ...node.data },
    };
    setNodes(nds => [...nds, newNode]);
  }, [nodes, edges, undoRedo, setNodes]);

  const handleDisconnectNode = useCallback((nodeId: string) => {
    undoRedo.pushSnapshot(nodes, edges, 'Disconnect node');
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
  }, [nodes, edges, undoRedo, setEdges]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    undoRedo.pushSnapshot(nodes, edges, 'Delete node');
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
  }, [nodes, edges, undoRedo, setNodes, setEdges, selectedNode]);

  const handleAddNodeAtPosition = useCallback((type: WorkflowNodeType, clientX: number, clientY: number) => {
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!bounds) return;
    const position = { x: clientX - bounds.left - 75, y: clientY - bounds.top - 25 };
    addNode(type, position);
  }, [addNode]);

  const handleCommandPaletteAdd = useCallback((type: WorkflowNodeType) => {
    const viewport = reactFlowWrapper.current?.getBoundingClientRect();
    const position = viewport
      ? { x: viewport.width / 2 - 75, y: viewport.height / 2 - 25 }
      : { x: 400, y: 300 };
    addNode(type, position);
  }, [addNode]);

  const handleSelectAll = useCallback(() => {
    setNodes(nds => nds.map(n => ({ ...n, selected: true })));
  }, [setNodes]);

  const handleDeleteSelected = useCallback(() => {
    const selected = nodes.filter(n => n.selected);
    if (selected.length === 0) return;
    undoRedo.pushSnapshot(nodes, edges, `Delete ${selected.length} node(s)`);
    const selectedIds = new Set(selected.map(n => n.id));
    setNodes(nds => nds.filter(n => !selectedIds.has(n.id)));
    setEdges(eds => eds.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
  }, [nodes, edges, undoRedo, setNodes, setEdges]);

  const handleDuplicateSelected = useCallback(() => {
    const selected = nodes.filter(n => n.selected);
    if (selected.length === 0) return;
    undoRedo.pushSnapshot(nodes, edges, `Duplicate ${selected.length} node(s)`);
    const newNodes = selected.map(n => ({
      ...n,
      id: `${n.data?.nodeType || 'node'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      position: { x: n.position.x + 30, y: n.position.y + 30 },
      selected: false,
    }));
    setNodes(nds => [...nds, ...newNodes]);
  }, [nodes, edges, undoRedo, setNodes]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  useEffect(() => {
    const handleQuickAdd = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setCanvasContextMenu({ x: detail.x, y: detail.y });
    };
    const handleRename = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      updateNodeData(detail.nodeId, { label: detail.label });
    };
    window.addEventListener('ab-quick-add', handleQuickAdd);
    window.addEventListener('ab-rename-node', handleRename);
    return () => {
      window.removeEventListener('ab-quick-add', handleQuickAdd);
      window.removeEventListener('ab-rename-node', handleRename);
    };
  }, [updateNodeData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
        return;
      }

      if (commandPaletteOpen || shortcutOverlayOpen) return;

      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShortcutOverlayOpen(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoRedo.undo(setNodes, setEdges);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        undoRedo.redo(setNodes, setEdges);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        undoRedo.redo(setNodes, setEdges);
        return;
      }

      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
        return;
      }
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setNodeContextMenu(null);
        setCanvasContextMenu(null);
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        handleFitView();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, shortcutOverlayOpen, undoRedo, setNodes, setEdges, handleSelectAll, handleDeleteSelected, handleDuplicateSelected, handleFitView]);

  const validationIssues = validateWorkflow(nodes, edges);

  return (
      <div className="flex h-full w-full">
        <OnboardingOverlay
          onNewWorkflow={() => {
            const startNode = createNode('start', { x: 250, y: 150 });
            setNodes([startNode]);
          }}
          onOpenTemplates={onLoadTemplate || (() => {})}
        />
        <div className="flex-1 flex flex-col relative">
          <WorkflowToolbar
            name={workflowName}
            onNameChange={setWorkflowName}
            nodes={nodes}
            edges={edges}
            workflowId={workflowId}
            onWorkflowSaved={onWorkflowSaved}
            onLoadTemplate={onLoadTemplate}
            canUndo={undoRedo.canUndo}
            canRedo={undoRedo.canRedo}
            onUndo={() => undoRedo.undo(setNodes, setEdges)}
            onRedo={() => undoRedo.redo(setNodes, setEdges)}
            onFitView={handleFitView}
            validationIssues={validationIssues}
            onShowShortcuts={() => setShortcutOverlayOpen(true)}
            onBack={onBack}
            onHeaderControls={onHeaderControls}
          />
          <div ref={reactFlowWrapper} className="flex-1">
            <ReactFlow
              nodes={nodes}
              edges={animatedEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={onPaneClick}
              onNodeContextMenu={onNodeContextMenu}
              onPaneContextMenu={onPaneContextMenu}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              fitView
              colorMode="dark"
              multiSelectionKeyCode="Shift"
              deleteKeyCode={null}
            >
              <Background color="rgba(255,255,255,0.03)" gap={20} />
              <Controls showInteractive={false} position="top-left" />
              <MiniMap
                nodeColor={(n) => n.data?.color || DEFAULT_NODE_COLOR}
                className="!bg-[#111114] !border-[#2a2a30]"
                pannable
                zoomable
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
            {edgeLabelEdit && (
              <EdgeLabelModal
                edgeId={edgeLabelEdit.edgeId}
                label={edgeLabelEdit.label}
                x={edgeLabelEdit.x}
                y={edgeLabelEdit.y}
                onUpdateLabel={handleEdgeLabelUpdate}
                onClose={() => setEdgeLabelEdit(null)}
              />
            )}
          </div>
        </div>
        {selectedNode && (
          <NodeSettingsPanel
            node={selectedNode}
            onUpdate={(data) => updateNodeData(selectedNode.id, data)}
            onClose={() => setSelectedNode(null)}
            upstreamNodes={nodes
              .filter(n => n.id !== selectedNode.id && (n.data?.nodeType as string) !== 'note')
              .map(n => ({ id: n.id, label: (n.data?.label as string) || (n.data?.nodeType as string) || n.id }))
            }
          />
        )}
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onAddNode={handleCommandPaletteAdd}
          recentNodes={recentNodeTypes}
        />
        <ShortcutOverlay
          isOpen={shortcutOverlayOpen}
          onClose={() => setShortcutOverlayOpen(false)}
        />
      </div>
  );
}

export default function WorkflowCanvas(props: Props) {
  return (
    <ExecutionStatusProvider>
      <ReactFlowProvider>
        <WorkflowCanvasInner {...props} />
      </ReactFlowProvider>
    </ExecutionStatusProvider>
  );
}
