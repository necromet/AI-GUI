import { useCallback, useState } from 'react';
import { X, Settings } from 'lucide-react';
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

const CONFIG_PANELS: Record<string, React.ComponentType<{ data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; upstreamNodes?: { id: string; label: string }[] }>> = {
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
  const nodeType = (node.data?.nodeType || node.type || 'agent') as string;
  const def = NODE_DEFINITIONS[nodeType as WorkflowNodeType];
  const color = node.data?.color || def?.color || DEFAULT_NODE_COLOR;
  const label = node.data?.label || def?.label || nodeType;

  const ConfigPanel = CONFIG_PANELS[nodeType];

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
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-[var(--neon-color)] transition-colors"
        style={{ opacity: isResizing ? 1 : 0.15 }}
        onMouseDown={handleResizeStart}
      />
      <div
        className="h-full border-l overflow-y-auto flex flex-col transition-transform duration-200"
        style={{
          borderColor: 'var(--border-300)',
          backgroundColor: 'var(--bg-100, #111114)',
          width: panelWidth + 'px',
        }}
      >
        <div className="h-1 w-full" style={{ backgroundColor: color }} />
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border-300)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: color + '20' }}
            >
              <Settings size={12} style={{ color }} />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>
                {label} Settings
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-500)' }}>
                {node.id}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-300)] transition-colors cursor-pointer"
            style={{ color: 'var(--text-500)' }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-300)' }}>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>
            Node Label
          </label>
          <input
            value={(node.data?.label as string) || ''}
            onChange={e => handleUpdate({ label: e.target.value })}
            className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          />
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border-300)' }}>
          <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>Configuration</span>
          <button
            onClick={() => setShowJson(!showJson)}
            className="text-[10px] px-2 py-0.5 rounded cursor-pointer"
            style={{
              backgroundColor: showJson ? 'var(--neon-color)' : 'var(--bg-200)',
              color: showJson ? '#000' : 'var(--text-500)',
            }}
          >
            {showJson ? 'Visual' : 'JSON'}
          </button>
        </div>

        {showJson ? (
          <div className="flex-1 px-4 py-3 overflow-y-auto">
            <pre className="text-[10px] font-mono p-2 rounded overflow-x-auto" style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)' }}>
              {JSON.stringify(node.data, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="flex-1 px-4 py-3 overflow-y-auto">
            {ConfigPanel ? (
              <ConfigPanel data={node.data as Record<string, any>} onUpdate={handleUpdate} upstreamNodes={upstreamNodes} />
            ) : (
              <div className="text-xs text-center py-8" style={{ color: 'var(--text-500)' }}>
                No settings available for this node type
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-2 border-t text-[10px]" style={{ borderColor: 'var(--border-300)', color: 'var(--text-500)' }}>
          Type {'{{'} for variable autocomplete
        </div>
      </div>
    </div>
  );
}
