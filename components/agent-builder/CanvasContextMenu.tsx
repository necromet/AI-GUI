import { useEffect, useRef } from 'react';
import { NODE_CATEGORIES, NODE_DEFINITIONS } from './constants';
import type { WorkflowNodeType } from './types';
import { Circle } from 'lucide-react';
import { ICON_MAP } from './shared/icons';

interface Props {
  x: number;
  y: number;
  onAddNode: (type: WorkflowNodeType, x: number, y: number) => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onClose: () => void;
}

export default function CanvasContextMenu({ x, y, onAddNode, onSelectAll, onDeleteSelected, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] rounded-lg border shadow-xl overflow-hidden"
      style={{
        left: x,
        top: y,
        borderColor: 'var(--border-300)',
        backgroundColor: 'var(--bg-100)',
        backdropFilter: 'blur(12px)',
        animation: 'ctxMenuIn 0.12s ease-out',
      }}
    >
      <style>{`
        @keyframes ctxMenuIn {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--border-300)' }}>
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>Add Node</span>
      </div>

      {NODE_CATEGORIES.map((cat) => (
        <div key={cat.id}>
          <div className="px-3 py-1" style={{ borderTop: '1px solid var(--border-200)' }}>
            <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>{cat.label}</span>
          </div>
          {cat.types.map((type) => {
            const def = NODE_DEFINITIONS[type];
            const Icon = ICON_MAP[def.icon] || Circle;
            return (
              <button
                key={type}
                onClick={() => onAddNode(type, x, y)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer"
                style={{ color: 'var(--text-300)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Icon size={12} style={{ color: def.color }} />
                {def.label}
              </button>
            );
          })}
        </div>
      ))}

      <div className="border-t" style={{ borderColor: 'var(--border-300)' }}>
        <button
          onClick={() => { onSelectAll(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer"
          style={{ color: 'var(--text-300)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Select All
        </button>
        <button
          onClick={() => { onDeleteSelected(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer"
          style={{ color: '#f87171' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Delete Selected
        </button>
      </div>
    </div>
  );
}
