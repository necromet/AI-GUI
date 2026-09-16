import { useCallback, useState, useEffect } from 'react';
import { X, Settings, Code } from 'lucide-react';
import type { Node } from '@xyflow/react';
import { NODE_DEFINITIONS, DEFAULT_NODE_COLOR, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH } from './constants';
import type { WorkflowNodeType } from './types';
import {
  StartNodeConfig,
  AgentNodeConfig,
  MCPNodeConfig,
  TransformNodeConfig,
  IfElseNodeConfig,
  WhileNodeConfig,
  ApprovalNodeConfig,
  EndNodeConfig,
  NoteNodeConfig,
  HTTPNodeConfig,
  ExtractNodeConfig,
  SetStateNodeConfig,
} from './nodes';

interface Props {
  node: Node;
  onUpdate: (data: Record<string, any>) => void;
  onClose: () => void;
  upstreamNodes?: { id: string; label: string }[];
}

const CONFIG_PANELS: Record<string, React.ComponentType<{ data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; upstreamNodes?: { id: string; label: string }[]; accentColor?: string }>> = {
  start: StartNodeConfig,
  agent: AgentNodeConfig,
  mcp: MCPNodeConfig,
  transform: TransformNodeConfig,
  'data-transform': TransformNodeConfig,
  'if-else': IfElseNodeConfig,
  while: WhileNodeConfig,
  'user-approval': ApprovalNodeConfig,
  'user approval': ApprovalNodeConfig,
  approval: ApprovalNodeConfig,
  end: EndNodeConfig,
  note: NoteNodeConfig,
  http: HTTPNodeConfig,
  'http-request': HTTPNodeConfig,
  extract: ExtractNodeConfig,
  'set-state': SetStateNodeConfig,
  'set state': SetStateNodeConfig,
};

export default function NodeSettingsPanel({ node, onUpdate, onClose, upstreamNodes = [] }: Props) {
  const [showJson, setShowJson] = useState(false);
  const [panelWidth, setPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [entered, setEntered] = useState(false);
  const nodeType = (node.data?.nodeType || node.type || 'agent') as string;
  const def = NODE_DEFINITIONS[nodeType as WorkflowNodeType];
  const color = node.data?.color || def?.color || DEFAULT_NODE_COLOR;
  const label = node.data?.label || def?.label || nodeType;

  const ConfigPanel = CONFIG_PANELS[nodeType];

  useEffect(() => { requestAnimationFrame(() => setEntered(true)); }, []);

  const handleUpdate = useCallback((data: Record<string, any>) => {
    onUpdate(data);
  }, [onUpdate]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = panelWidth;
    const handleMouseMove = (moveE: MouseEvent) => {
      const delta = startX - moveE.clientX;
      setPanelWidth(Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, startWidth + delta)));
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  return (
    <div className="flex h-full relative">
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group"
        onMouseDown={handleResizeStart}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 transition-colors group-hover:bg-[var(--neon-color)]"
          style={{ opacity: isResizing ? 1 : 0.15, backgroundColor: isResizing ? 'var(--neon-color)' : undefined }}
        />
      </div>
      <div
        className="h-full border-l overflow-hidden flex flex-col transition-all duration-200"
        style={{
          borderColor: 'var(--border-300)',
          backgroundColor: 'var(--bg-100, #111114)',
          width: panelWidth + 'px',
          opacity: entered ? 1 : 0,
          transform: entered ? 'translateX(0)' : 'translateX(12px)',
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ backgroundColor: `${color}08`, transition: 'background-color 0.2s ease' }}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${color}18` }}
          >
            <Settings size={14} style={{ color }} />
          </div>
          <input
            value={label}
            onChange={e => handleUpdate({ label: e.target.value })}
            className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-none outline-none px-1 py-0.5 rounded hover:bg-[var(--bg-200)] focus:bg-[var(--bg-200)] transition-colors"
            style={{ color: 'var(--text-100)' }}
          />
          <button
            onClick={() => setShowJson(!showJson)}
            className="p-1.5 rounded transition-colors cursor-pointer flex-shrink-0"
            style={{
              backgroundColor: showJson ? `${color}20` : 'transparent',
              color: showJson ? color : 'var(--text-500)',
            }}
            title={showJson ? 'Switch to visual' : 'Switch to JSON'}
          >
            <Code size={13} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[var(--bg-300)] transition-colors cursor-pointer flex-shrink-0"
            style={{ color: 'var(--text-500)' }}
          >
            <X size={14} />
          </button>
        </div>

        {label !== node.id && (
          <div className="px-4 pb-1 -mt-1">
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-500)' }}>{node.id}</span>
          </div>
        )}

        {showJson ? (
          <div className="flex-1 overflow-y-auto node-settings-scroll">
            <pre
              className="text-[11px] font-mono p-4 h-full"
              style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)' }}
            >
              {JSON.stringify(node.data, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="flex-1 px-4 pt-4 pb-6 overflow-y-auto node-settings-scroll">
            {ConfigPanel ? (
              <ConfigPanel data={node.data as Record<string, any>} onUpdate={handleUpdate} upstreamNodes={upstreamNodes} accentColor={color} />
            ) : (
              <div className="text-xs text-center py-8" style={{ color: 'var(--text-500)' }}>
                No settings available for this node type
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
