import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import VariableAutocomplete from './VariableAutocomplete';

interface Props {
  nodeLabel: string;
  onApply: (data: Record<string, any>) => void;
  onClose: () => void;
}

export default function PasteConfigModal({ nodeLabel, onApply, onClose }: Props) {
  const [json, setJson] = useState('');
  const [error, setError] = useState<string | null>(null);
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

  const handleApply = useCallback(() => {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setError('Must be a JSON object');
        return;
      }
      onApply(parsed);
      toast.success('Config applied');
      onClose();
    } catch (err: any) {
      setError('Invalid JSON: ' + err.message);
    }
  }, [json, onApply, onClose]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJson(text);
      setError(null);
    } catch {
      // clipboard access denied, ignore
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        ref={ref}
        className="rounded-xl border shadow-2xl w-[380px]"
        style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100)' }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-300)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>Paste Config</h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-500)' }}>Import configuration for "{nodeLabel}"</p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>JSON Config</label>
            <button
              onClick={handlePaste}
              className="text-[10px] px-2 py-0.5 rounded cursor-pointer"
              style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-400)' }}
            >
              Paste from clipboard
            </button>
          </div>
          <VariableAutocomplete
            value={json}
            onChange={value => { setJson(value); setError(null); }}
            placeholder='{"model": "mimo-v2.5", "systemPrompt": "..."}'
            multiline
            autoFocus
            rows={8}
          />
          {error && (
            <div className="text-[10px]" style={{ color: 'var(--danger, #f87171)' }}>{error}</div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border-300)' }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs cursor-pointer"
            style={{ color: 'var(--text-400)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!json.trim()}
            className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
