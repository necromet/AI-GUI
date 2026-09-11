import { useEffect, useRef } from 'react';
import { Copy, Unlink, Trash2, Settings } from 'lucide-react';

interface Props {
  x: number;
  y: number;
  nodeId: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function NodeContextMenu({ x, y, nodeId, onEdit, onDuplicate, onDisconnect, onDelete, onClose }: Props) {
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

  const items = [
    { icon: Settings, label: 'Edit Settings', action: onEdit, color: 'var(--text-300)' },
    { icon: Copy, label: 'Duplicate', action: onDuplicate, color: 'var(--text-300)' },
    { icon: Unlink, label: 'Disconnect All', action: onDisconnect, color: '#fbbf24' },
    { icon: Trash2, label: 'Delete Node', action: onDelete, color: '#f87171' },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-lg border shadow-xl overflow-hidden"
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
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer"
          style={{ color: item.color }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <item.icon size={13} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
