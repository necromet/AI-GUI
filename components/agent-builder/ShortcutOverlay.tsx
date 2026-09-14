import { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], desc: 'Quick-add node palette' },
  { keys: ['Ctrl', 'Z'], desc: 'Undo' },
  { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo' },
  { keys: ['Ctrl', 'A'], desc: 'Select all nodes' },
  { keys: ['Ctrl', 'D'], desc: 'Duplicate selected' },
  { keys: ['Ctrl', 'S'], desc: 'Save workflow' },
  { keys: ['Delete'], desc: 'Delete selected' },
  { keys: ['Escape'], desc: 'Deselect / close panels' },
  { keys: ['Ctrl', 'Enter'], desc: 'Run workflow' },
  { keys: ['F'], desc: 'Fit view' },
  { keys: ['?'], desc: 'Show shortcuts' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutOverlay({ isOpen, onClose }: Props) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes('MAC'));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fmtKey = (k: string) => {
    if (isMac) {
      if (k === 'Ctrl') return '⌘';
      if (k === 'Shift') return '⇧';
      if (k === 'Alt') return '⌥';
      if (k === 'Delete') return '⌫';
    }
    return k;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="w-[380px] max-w-[calc(100vw-32px)] rounded-xl border shadow-2xl overflow-hidden"
        style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100, #111114)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-300)' }}>
          <div className="flex items-center gap-2">
            <Keyboard size={14} style={{ color: 'var(--neon-color)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-100)' }}>Keyboard Shortcuts</span>
          </div>
          <button onClick={onClose} className="p-1 rounded cursor-pointer" style={{ color: 'var(--text-500)' }}>
            <X size={14} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <span className="text-xs" style={{ color: 'var(--text-300)' }}>{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <span key={j}>
                    <kbd
                      className="text-[10px] px-1.5 py-0.5 rounded border font-mono"
                      style={{ borderColor: 'var(--border-300)', color: 'var(--text-300)', backgroundColor: 'var(--bg-200)' }}
                    >
                      {fmtKey(k)}
                    </kbd>
                    {j < s.keys.length - 1 && <span className="text-[10px] mx-0.5" style={{ color: 'var(--text-500)' }}>+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ShortcutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded transition-colors cursor-pointer"
      style={{ color: 'var(--text-500)' }}
      title="Keyboard shortcuts (?)"
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-300)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <Keyboard size={14} />
    </button>
  );
}
