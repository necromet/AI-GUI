import { X } from 'lucide-react';
import type { Node } from '@xyflow/react';
import AgentPanel from './node-panels/AgentPanel';
import MCPPanel from './node-panels/MCPPanel';
import LogicPanel from './node-panels/LogicPanel';
import { NODE_DEFINITIONS } from './constants';

interface Props {
  node: Node;
  onUpdate: (data: Record<string, any>) => void;
  onClose: () => void;
}

export default function NodeSettingsPanel({ node, onUpdate, onClose }: Props) {
  const nodeType = (node.data as any)?.nodeType;
  const def = NODE_DEFINITIONS[nodeType as keyof typeof NODE_DEFINITIONS];

  const renderPanel = () => {
    switch (nodeType) {
      case 'agent':
        return <AgentPanel data={node.data as any} onUpdate={onUpdate} />;
      case 'mcp':
        return <MCPPanel data={node.data as any} onUpdate={onUpdate} />;
      case 'if-else':
      case 'while':
      case 'user-approval':
        return <LogicPanel data={node.data as any} onUpdate={onUpdate} nodeType={nodeType} />;
      case 'transform':
        return (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>JavaScript Code</span>
              <textarea
                className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs font-mono resize-y min-h-[100px]"
                style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
                value={(node.data as any).code || ''}
                onChange={(e) => onUpdate({ code: e.target.value })}
                placeholder="return input;"
              />
            </label>
            <p className="text-[10px]" style={{ color: 'var(--text-500)' }}>
              Available: <code>input</code>, <code>lastOutput</code>, and all workflow variables.
            </p>
          </div>
        );
      case 'note':
        return (
          <label className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Note Text</span>
            <textarea
              className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs resize-y min-h-[80px]"
              style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
              value={(node.data as any).text || ''}
              onChange={(e) => onUpdate({ text: e.target.value })}
              placeholder="Add a note..."
            />
          </label>
        );
      default:
        return (
          <p className="text-xs" style={{ color: 'var(--text-500)' }}>
            No settings available for this node type.
          </p>
        );
    }
  };

  return (
    <div className="w-72 border-l flex flex-col overflow-y-auto" style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-300)' }}>
        <div className="flex items-center gap-2">
          {def && (
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${def.color}20`, color: def.color }}>
              <span className="text-[9px] font-bold">{def.label.charAt(0)}</span>
            </div>
          )}
          <span className="text-sm font-medium" style={{ color: 'var(--text-100)' }}>{def?.label || nodeType}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-200)] cursor-pointer" style={{ color: 'var(--text-500)' }}>
          <X size={14} />
        </button>
      </div>

      <div className="p-3 flex-1">
        <label className="block mb-3">
          <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Label</span>
          <input
            type="text"
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs"
            style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
            value={(node.data as any).label || ''}
            onChange={(e) => onUpdate({ label: e.target.value })}
          />
        </label>
        {renderPanel()}
      </div>
    </div>
  );
}
