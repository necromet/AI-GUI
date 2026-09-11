import { useState } from 'react';
import { NODE_DEFINITIONS } from './constants';
import type { WorkflowNodeType } from './types';
import { Plus, Circle } from 'lucide-react';
import { ICON_MAP } from './shared/icons';

interface Props {
  x: number;
  y: number;
  sourceNodeId: string;
  targetNodeId: string;
  onInsertNode: (type: WorkflowNodeType, sourceId: string, targetId: string) => void;
  onClose: () => void;
}

export default function EdgeAddButton({ x, y, sourceNodeId, targetNodeId, onInsertNode, onClose }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  if (!showPicker) {
    return (
      <button
        className="absolute z-10 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-110"
        style={{
          left: x - 12,
          top: y - 12,
          backgroundColor: 'var(--neon-color)',
          color: '#000',
          boxShadow: '0 0 8px rgba(var(--neon-rgb), 0.4)',
        }}
        onClick={() => setShowPicker(true)}
      >
        <Plus size={12} />
      </button>
    );
  }

  return (
    <div
      className="absolute z-50 min-w-[160px] rounded-lg border shadow-xl overflow-hidden"
      style={{
        left: x,
        top: y,
        borderColor: 'var(--border-300)',
        backgroundColor: 'var(--bg-100)',
        animation: 'ctxMenuIn 0.12s ease-out',
      }}
    >
      <style>{`
        @keyframes ctxMenuIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div className="px-2 py-1 border-b" style={{ borderColor: 'var(--border-300)' }}>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-500)' }}>Insert Node</span>
      </div>
      {(['agent', 'mcp', 'transform', 'if-else', 'while', 'user-approval'] as WorkflowNodeType[]).map((type) => {
        const def = NODE_DEFINITIONS[type];
        const Icon = ICON_MAP[def.icon] || Circle;
        return (
          <button
            key={type}
            onClick={() => { onInsertNode(type, sourceNodeId, targetNodeId); onClose(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] transition-colors cursor-pointer"
            style={{ color: 'var(--text-300)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Icon size={11} style={{ color: def.color }} />
            {def.label}
          </button>
        );
      })}
    </div>
  );
}
