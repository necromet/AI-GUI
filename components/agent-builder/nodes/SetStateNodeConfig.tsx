import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';
import {
  ThemedSelect,
  ThemedSelectTrigger,
  ThemedSelectValue,
  ThemedSelectContent,
  ThemedSelectItem,
} from '../shared/ThemedSelect';
import { VARIABLE_TYPE_COLORS } from '../shared/colors';
import VariableAutocomplete from '../VariableAutocomplete';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; upstreamNodes?: { id: string; label: string }[]; accentColor?: string; }

const VALUE_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'json', label: 'JSON' },
  { value: 'expression', label: 'Expression' },
] as const;

interface VarEntry {
  key: string;
  value: any;
  type: string;
}

export default function SetStateNodeConfig({ data, onUpdate, upstreamNodes = [] }: Props) {
  const vars: Record<string, any> = data.variables || {};
  const varTypes: Record<string, string> = data.variableTypes || {};
  const entries: VarEntry[] = Object.entries(vars).map(([key, val]) => ({
    key,
    value: val,
    type: varTypes[key] || 'string',
  }));

  const addVar = () => onUpdate({ variables: { ...vars, '': '' }, variableTypes: { ...varTypes, '': 'string' } });
  const updateVar = (oldKey: string, newKey: string, value: any, type: string) => {
    const updated = { ...vars };
    const types = { ...varTypes };
    delete updated[oldKey];
    delete types[oldKey];
    updated[newKey] = value;
    types[newKey] = type;
    onUpdate({ variables: updated, variableTypes: types });
  };
  const removeVar = (key: string) => {
    const updated = { ...vars };
    const types = { ...varTypes };
    delete updated[key];
    delete types[key];
    onUpdate({ variables: updated, variableTypes: types });
  };
  const updateType = (key: string, type: string) => {
    onUpdate({ variableTypes: { ...varTypes, [key]: type } });
  };

  const getTypeBadgeStyle = (type: string) => {
    const color = VARIABLE_TYPE_COLORS[type as keyof typeof VARIABLE_TYPE_COLORS] || VARIABLE_TYPE_COLORS.any;
    return { backgroundColor: `${color}20`, color };
  };

  return (
    <div className="space-y-4">
      <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
        Variables
      </div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium" style={FIELD_STYLES.label}>Variables to Set</label>
        <button onClick={addVar} className="text-xs flex items-center gap-1 cursor-pointer transition-colors hover:scale-105 active:scale-95" style={{ color: 'var(--neon-color)' }}>
          <Plus size={12} /> Add
        </button>
      </div>
      <AnimatePresence>
        {entries.map((entry, i) => (
          <motion.div
            key={`${entry.key}-${i}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 p-2 rounded-lg mb-2" style={{ backgroundColor: 'var(--bg-200)' }}>
              <div className="flex gap-2 items-center">
                <input
                  value={entry.key}
                  onChange={e => updateVar(entry.key, e.target.value, entry.value, entry.type)}
                  placeholder="name"
                  className="w-1/3 px-2.5 py-1.5 text-xs rounded-lg border bg-transparent transition-colors focus:ring-1 focus:ring-[var(--neon-color)] focus:border-[var(--neon-color)] outline-none"
                  style={FIELD_STYLES.input}
                />
                <div className="w-24 shrink-0">
                  <ThemedSelect
                    value={entry.type}
                    onValueChange={v => updateType(entry.key, v)}
                  >
                    <ThemedSelectTrigger className="h-7 text-[10px]">
                      <ThemedSelectValue>
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={getTypeBadgeStyle(entry.type)}>
                          {entry.type}
                        </span>
                      </ThemedSelectValue>
                    </ThemedSelectTrigger>
                    <ThemedSelectContent>
                      {VALUE_TYPES.map(t => (
                        <ThemedSelectItem key={t.value} value={t.value}>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: VARIABLE_TYPE_COLORS[t.value as keyof typeof VARIABLE_TYPE_COLORS] || VARIABLE_TYPE_COLORS.any }} />
                            {t.label}
                          </span>
                        </ThemedSelectItem>
                      ))}
                    </ThemedSelectContent>
                  </ThemedSelect>
                </div>
                <button onClick={() => removeVar(entry.key)} className="p-1 cursor-pointer transition-colors hover:bg-[var(--bg-300)] rounded" style={{ color: 'var(--text-500)' }}>
                  <X size={12} />
                </button>
              </div>
              <AnimatePresence mode="wait">
                {entry.type === 'boolean' ? (
                  <motion.div key="boolean" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <ThemedSelect
                      value={String(entry.value)}
                      onValueChange={v => updateVar(entry.key, entry.key, v === 'true', entry.type)}
                    >
                      <ThemedSelectTrigger className="h-7 text-xs">
                        <ThemedSelectValue />
                      </ThemedSelectTrigger>
                      <ThemedSelectContent>
                        <ThemedSelectItem value="true">true</ThemedSelectItem>
                        <ThemedSelectItem value="false">false</ThemedSelectItem>
                      </ThemedSelectContent>
                    </ThemedSelect>
                  </motion.div>
                ) : entry.type === 'json' || entry.type === 'expression' ? (
                  <motion.div key="textarea" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <VariableAutocomplete
                      value={typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value, null, 2)}
                      onChange={value => updateVar(entry.key, entry.key, value, entry.type)}
                      placeholder={entry.type === 'json' ? '{"key": "value"}' : 'lastOutput.result * 2'}
                      multiline
                      rows={2}
                      upstreamNodes={upstreamNodes}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    {entry.type === 'number' ? (
                      <input
                        value={typeof entry.value === 'number' ? entry.value : Number(entry.value) || 0}
                        onChange={e => updateVar(entry.key, entry.key, Number(e.target.value), entry.type)}
                        placeholder="0"
                        type="number"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border bg-transparent transition-colors focus:ring-1 focus:ring-[var(--neon-color)] focus:border-[var(--neon-color)] outline-none"
                        style={FIELD_STYLES.input}
                      />
                    ) : (
                      <VariableAutocomplete
                        value={typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)}
                        onChange={value => updateVar(entry.key, entry.key, value, entry.type)}
                        placeholder="value or {{variable}}"
                        upstreamNodes={upstreamNodes}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
