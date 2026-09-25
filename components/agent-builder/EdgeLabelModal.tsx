import { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
  edgeId: string;
  label?: string;
  sourceLabel: string;
  targetLabel: string;
  branchName?: string;
  x: number;
  y: number;
  onUpdateLabel: (edgeId: string, label: string) => void;
  onDelete: (edgeId: string) => void;
  onClose: () => void;
}

export default function EdgeLabelModal({ edgeId, label, sourceLabel, targetLabel, branchName, x, y, onUpdateLabel, onDelete, onClose }: Props) {
  const [value, setValue] = useState(label || '');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
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

  const handleSubmit = useCallback(() => {
    onUpdateLabel(edgeId, value.trim());
    onClose();
  }, [edgeId, value, onUpdateLabel, onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-lg border shadow-xl p-3 ctx-menu-enter"
      style={{
        left: x,
        top: y,
        borderColor: 'var(--border-300)',
        backgroundColor: 'var(--bg-100)',
        minWidth: 240,
      }}
    >
      <div className="mb-3 border-b pb-2" style={{ borderColor: 'var(--border-200)' }}>
        <div className="truncate text-xs font-medium" style={{ color: 'var(--text-100)' }}>
          {sourceLabel} <span style={{ color: 'var(--text-500)' }}>→</span> {targetLabel}
        </div>
        {branchName && <div className="mt-1 text-[10px]" style={{ color: 'var(--text-400)' }}>Branch: {branchName}</div>}
      </div>
      <label className="text-[10px] font-medium block mb-1.5" style={{ color: 'var(--text-300)' }}>
        Edge Label
      </label>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder="e.g. true, false, next..."
        className="w-full px-2 py-1.5 text-xs rounded border bg-transparent outline-none mb-2 transition-colors focus:ring-1 focus:ring-[var(--neon-color)]"
        style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => { onDelete(edgeId); onClose(); }}
          className="mr-auto flex cursor-pointer items-center gap-1 px-2 py-1 text-[10px]"
          style={{ color: 'var(--semantic-danger)' }}
        >
          <Trash2 size={11} /> Delete connection
        </button>
        <button
          onClick={() => { onUpdateLabel(edgeId, ''); onClose(); }}
          className="px-2 py-1 rounded text-[10px] cursor-pointer"
          style={{ color: 'var(--text-500)' }}
        >
          Clear
        </button>
        <button
          onClick={handleSubmit}
          className="px-2 py-1 rounded text-[10px] cursor-pointer"
          style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
