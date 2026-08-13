import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { parse } from 'pgsql-ast-parser';
import { Workflow } from 'lucide-react';
import { buildFlowFromAST, type AstLoc } from './buildFlowFromAST';
import RecursiveEdge from './RecursiveEdge';
import SqlNode from './SqlNode';
import NodeDetailsPanel from './NodeDetailsPanel';
import { NodeActionsContext } from './NodeActionsContext';

const nodeTypes = { sql: SqlNode };
const edgeTypes = { recursive: RecursiveEdge };

const DEBOUNCE_MS = 300;
const PANEL_CLOSE_MS = 400;

function sanitizeInput(raw: string): string {
  return raw
    .replace(/\uFEFF/g, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\bRECURSIVE\b/gi, (m) => ' '.repeat(m.length))
    .trim();
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Unknown parse error';
}

function shortenError(msg: string): string {
  const firstLine = msg.split('\n').find((l) => l.trim()) ?? msg;
  return firstLine.length > 120 ? firstLine.slice(0, 117) + '…' : firstLine;
}

interface ExplainCanvasInnerProps {
  sql: string;
  onHighlight?: (range: { start: number; end: number }) => void;
  cursorOffset?: number | null;
}

function ExplainCanvasInner({ sql, onHighlight, cursorOffset }: ExplainCanvasInnerProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isClosingPanel, setIsClosingPanel] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closePanelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { fitView } = useReactFlow();
  const nodesRef = useRef<Node[]>([]);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  useEffect(() => {
    return () => {
      if (closePanelTimeoutRef.current) clearTimeout(closePanelTimeoutRef.current);
    };
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedNodeId(null);
    setSelectedNode(null);
  }, []);

  const parseSql = useCallback((raw: string) => {
    const input = sanitizeInput(raw);
    clearHighlight();

    if (!input) {
      setNodes([]);
      setEdges([]);
      setParseError(null);
      return;
    }

    try {
      const ast = parse(input, { locationTracking: true });
      const graph = buildFlowFromAST(ast, input);
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setParseError(null);
    } catch (err) {
      if (/\bWITH\b[\s\S]*?\b\w+\s*\([^)]+\)\s*\bAS\b/i.test(raw)) {
        setParseError('Explicit CTE column lists are not supported. Try aliasing columns inside the SELECT statement.');
      } else if (/\bNATURAL\s+JOIN\b/i.test(input)) {
        setParseError('NATURAL JOIN is not supported. Use an explicit JOIN with ON or USING.');
      } else if (/^\s*(GRANT|REVOKE)\b/i.test(raw)) {
        setParseError('DCL statements (GRANT/REVOKE) are not supported for visualization.');
      } else if (/^\s*(CREATE|DROP)\s+(ROLE|USER)\b/i.test(raw)) {
        setParseError('Administrative commands (CREATE ROLE/USER) are not supported.');
      } else if (/^\s*EXPLAIN\b/i.test(raw)) {
        setParseError('actuallyEXPLAIN visualizes logical intent, not execution plans. Remove the EXPLAIN keyword and paste your raw query.');
      } else {
        const message = extractErrorMessage(err);
        setParseError(shortenError(message));
      }
    }
  }, [clearHighlight]);

  // Parse on sql prop change (debounced)
  useEffect(() => {
    if (debounceRef.current != null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => parseSql(sql), DEBOUNCE_MS);
    return () => { if (debounceRef.current != null) clearTimeout(debounceRef.current); };
  }, [sql, parseSql]);

  // Fit view when nodes change
  const prevNodeCount = useRef(0);
  useEffect(() => {
    if (nodes.length > 0 && nodes.length !== prevNodeCount.current) {
      setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 30);
    }
    prevNodeCount.current = nodes.length;
  }, [nodes, fitView]);

  // Highlight node matching cursor offset from editor
  useEffect(() => {
    if (cursorOffset == null) return;
    const match = nodesRef.current.find((n) => {
      const loc = n.data?.loc as AstLoc | undefined;
      if (!loc) return false;
      return cursorOffset >= loc.start && cursorOffset <= loc.end;
    });
    if (match) {
      setHighlightedNodeId(match.id);
    }
  }, [cursorOffset]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (closePanelTimeoutRef.current) {
      clearTimeout(closePanelTimeoutRef.current);
      closePanelTimeoutRef.current = null;
    }
    setIsClosingPanel(false);
    setHighlightedNodeId(node.id);
    setSelectedNode((prev) => prev !== null ? node : null);

    const loc = node.data?.loc as AstLoc | undefined;
    if (loc) onHighlight?.(loc);
  }, [onHighlight]);

  const handlePaneClick = useCallback(() => {
    clearHighlight();
  }, [clearHighlight]);

  const handleClosePanel = useCallback(() => {
    if (!selectedNode || isClosingPanel) return;
    setIsClosingPanel(true);
    closePanelTimeoutRef.current = setTimeout(() => {
      setSelectedNode(null);
      setIsClosingPanel(false);
      closePanelTimeoutRef.current = null;
    }, PANEL_CLOSE_MS);
  }, [selectedNode, isClosingPanel]);

  const openDetails = useCallback((nodeId: string) => {
    if (closePanelTimeoutRef.current) {
      clearTimeout(closePanelTimeoutRef.current);
      closePanelTimeoutRef.current = null;
    }
    setIsClosingPanel(false);

    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedNode(node);
    setHighlightedNodeId(node.id);

    const loc = node.data?.loc as AstLoc | undefined;
    if (loc) onHighlight?.(loc);
  }, [onHighlight]);

  const nodeActions = useMemo(() => ({ openDetails }), [openDetails]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const displayNodes = useMemo(() => {
    if (!highlightedNodeId) return nodes;
    return nodes.map((n) =>
      n.id === highlightedNodeId
        ? {
            ...n,
            style: {
              ...n.style,
              outline: '2px solid rgb(90, 189, 172)',
              outlineOffset: 2,
              boxShadow: '0 0 16px 6px rgba(90, 189, 172, 0.7)',
            },
          }
        : n,
    );
  }, [nodes, highlightedNodeId]);

  if (nodes.length === 0 && !parseError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-500)' }}>
        <Workflow size={32} style={{ opacity: 0.4 }} />
        <p className="text-xs text-center max-w-48">Type a SQL query to see its visual explanation</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Error bar */}
      {parseError && (
        <div
          className="absolute top-0 left-0 right-0 z-20 text-xs px-3 py-2 animate-[fadeIn_0.2s_ease-in]"
          style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)', borderBottom: '1px solid rgba(248,113,113,0.2)' }}
        >
          {parseError}
        </div>
      )}

      {/* Flow canvas */}
      <div className="w-full h-full">
        <NodeActionsContext.Provider value={nodeActions}>
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
            edgesFocusable={false}
            edgesReconnectable={false}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={2} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </NodeActionsContext.Provider>
      </div>

      {/* Details overlay */}
      {selectedNode && (
        <div
          className="absolute top-0 right-0 h-full z-30"
          style={{
            '--node-color': selectedNode.style?.['--node-color' as keyof typeof selectedNode.style] ?? 'var(--neon-color)',
          } as React.CSSProperties}
        >
          <NodeDetailsPanel node={selectedNode} onClose={handleClosePanel} isClosing={isClosingPanel} />
        </div>
      )}
    </div>
  );
}

interface ExplainCanvasProps {
  sql: string;
  onHighlight?: (range: { start: number; end: number }) => void;
  cursorOffset?: number | null;
  className?: string;
}

export default function ExplainCanvas({ sql, onHighlight, cursorOffset, className }: ExplainCanvasProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <ReactFlowProvider>
        <ExplainCanvasInner sql={sql} onHighlight={onHighlight} cursorOffset={cursorOffset} />
      </ReactFlowProvider>
    </div>
  );
}
