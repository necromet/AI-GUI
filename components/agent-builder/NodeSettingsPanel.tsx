import { useCallback, useState } from 'react';
import { X, Settings } from 'lucide-react';
import type { Node } from '@xyflow/react';
import { NODE_DEFINITIONS } from './constants';
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
}

const CONFIG_PANELS: Record<string, React.ComponentType<{ data: Record<string, any>; onUpdate: (data: Record<string, any>) => void }>> = {
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

export default function NodeSettingsPanel({ node, onUpdate, onClose }: Props) {
  const [showJson, setShowJson] = useState(false);
  const nodeType = (node.data?.nodeType || node.type || 'agent') as string;
  const def = NODE_DEFINITIONS[nodeType as WorkflowNodeType];
  const color = node.data?.color || def?.color || '#6b7280';
  const label = node.data?.label || def?.label || nodeType;

  const ConfigPanel = CONFIG_PANELS[nodeType];

  const handleUpdate = useCallback((data: Record<string, any>) => {
    onUpdate(data);
  }, [onUpdate]);

  return (
    <div
      className="w-80 h-full border-l overflow-y-auto flex flex-col"
      style={{
        borderColor: 'var(--border-300)',
        backgroundColor: 'var(--bg-100, #111114)',
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
            style={{ backgroundColor: `${color}20` }}
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
            <ConfigPanel data={node.data as Record<string, any>} onUpdate={handleUpdate} />
          ) : (
            <div className="text-xs text-center py-8" style={{ color: 'var(--text-500)' }}>
              No settings available for this node type
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-2 border-t text-[10px]" style={{ borderColor: 'var(--border-300)', color: 'var(--text-500)' }}>
        Use {'{{variableName}}'} to reference workflow variables
      </div>
    </div>
  );
}
