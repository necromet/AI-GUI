import { Plus, X } from 'lucide-react';
import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

export default function SetStateNodeConfig({ data, onUpdate }: Props) {
  const vars: Record<string, any> = data.variables || {};
  const entries = Object.entries(vars);

  const addVar = () => onUpdate({ variables: { ...vars, '': '' } });
  const updateVar = (oldKey: string, newKey: string, value: any) => {
    const updated = { ...vars };
    delete updated[oldKey];
    updated[newKey] = value;
    onUpdate({ variables: updated });
  };
  const removeVar = (key: string) => {
    const updated = { ...vars };
    delete updated[key];
    onUpdate({ variables: updated });
  };

  return (
    <div className="space-y-4">
      <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
        Variables
      </div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium" style={FIELD_STYLES.label}>Variables to Set</label>
        <button onClick={addVar} className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: 'var(--neon-color)' }}>
          <Plus size={12} /> Add
        </button>
      </div>
      {entries.map(([key, val], i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={key}
            onChange={e => updateVar(key, e.target.value, val)}
            placeholder="name"
            className="w-1/3 px-2.5 py-1.5 text-xs rounded-lg border bg-transparent transition-colors focus:ring-1 focus:ring-[var(--neon-color)] focus:border-[var(--neon-color)] outline-none"
            style={FIELD_STYLES.input}
          />
          <input
            value={typeof val === 'string' ? val : JSON.stringify(val)}
            onChange={e => updateVar(key, key, e.target.value)}
            placeholder="value"
            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border bg-transparent transition-colors focus:ring-1 focus:ring-[var(--neon-color)] focus:border-[var(--neon-color)] outline-none"
            style={FIELD_STYLES.input}
          />
          <button onClick={() => removeVar(key)} className="p-1 cursor-pointer" style={{ color: 'var(--text-500)' }}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
