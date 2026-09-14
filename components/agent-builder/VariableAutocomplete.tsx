import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { VARIABLE_TYPE_COLORS } from './shared/colors';

interface VariableSuggestion {
  name: string;
  description: string;
  type: 'string' | 'object' | 'array' | 'any';
}

const BUILT_IN_VARIABLES: VariableSuggestion[] = [
  { name: 'input', description: 'Workflow input', type: 'string' },
  { name: 'lastOutput', description: 'Previous node output', type: 'any' },
  { name: 'state', description: 'Workflow state object', type: 'object' },
  { name: 'loopIndex', description: 'Current loop iteration', type: 'string' },
  { name: 'variables', description: 'All workflow variables', type: 'object' },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  upstreamNodes?: { id: string; label: string }[];
}

export default function VariableAutocomplete({ value, onChange, placeholder, multiline, className, upstreamNodes = [] }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerPos, setTriggerPos] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const nodeVariables = useMemo(() =>
    upstreamNodes.map(n => ({
      name: `${n.id}.output`,
      description: `Output from ${n.label}`,
      type: 'any' as const,
    })),
    [upstreamNodes]
  );

  const allSuggestions = useMemo(() => [...BUILT_IN_VARIABLES, ...nodeVariables], [nodeVariables]);

  const filtered = useMemo(() => {
    if (!filter) return allSuggestions;
    const q = filter.toLowerCase();
    return allSuggestions.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }, [filter, allSuggestions]);

  useEffect(() => { setSelectedIndex(0); }, [filter]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart || 0;
    const textBefore = newValue.slice(0, cursorPos);
    const lastBrace = textBefore.lastIndexOf('{{');

    if (lastBrace !== -1 && !textBefore.slice(lastBrace).includes('}}')) {
      setTriggerPos(lastBrace);
      setFilter(textBefore.slice(lastBrace + 2));
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
      setTriggerPos(null);
    }
  }, [onChange]);

  const insertVariable = useCallback((name: string) => {
    if (triggerPos === null) return;
    const before = value.slice(0, triggerPos);
    const cursorPos = (inputRef.current || textareaRef.current)?.selectionStart || value.length;
    const after = value.slice(cursorPos);
    const newValue = `${before}{{${name}}}${after}`;
    onChange(newValue);
    setShowDropdown(false);
    setTriggerPos(null);
    setTimeout(() => {
      const el = inputRef.current || textareaRef.current;
      if (el) {
        const pos = before.length + name.length + 4;
        el.setSelectionRange(pos, pos);
        el.focus();
      }
    }, 0);
  }, [value, triggerPos, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (filtered[selectedIndex]) {
        e.preventDefault();
        insertVariable(filtered[selectedIndex].name);
      }
    }
    if (e.key === 'Escape') { setShowDropdown(false); }
  }, [showDropdown, filtered, selectedIndex, insertVariable]);

  const typeColor = (type: string) => VARIABLE_TYPE_COLORS[type] || VARIABLE_TYPE_COLORS.any;

  const inputClasses = `w-full px-2 py-1.5 text-xs rounded border bg-transparent ${className || ''}`;

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${inputClasses} font-mono min-h-[80px] resize-y`}
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          rows={3}
        />
      ) : (
        <input
          ref={inputRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClasses}
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      )}

      {showDropdown && filtered.length > 0 && (
        <div
          className="absolute z-40 left-0 right-0 mt-1 rounded-lg border shadow-xl max-h-[180px] overflow-y-auto"
          style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100, #111114)' }}
        >
          {filtered.map((s, i) => (
            <button
              key={s.name}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-left transition-colors cursor-pointer"
              style={{ backgroundColor: i === selectedIndex ? 'var(--bg-300)' : 'transparent' }}
              onClick={() => insertVariable(s.name)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <code className="text-[10px] font-mono font-medium" style={{ color: 'var(--text-100)' }}>
                  {`{{${s.name}}}`}
                </code>
                <span className="text-[10px] truncate" style={{ color: 'var(--text-500)' }}>
                  {s.description}
                </span>
              </div>
              <span
                className="text-[8px] px-1 py-0.5 rounded-full ml-2 flex-shrink-0"
                style={{ backgroundColor: `${typeColor(s.type)}15`, color: typeColor(s.type) }}
              >
                {s.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
