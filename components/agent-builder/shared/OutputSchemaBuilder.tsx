"use client"

import { useState } from 'react';
import { Plus, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ThemedSelect,
  ThemedSelectTrigger,
  ThemedSelectValue,
  ThemedSelectContent,
  ThemedSelectItem,
} from './ThemedSelect';
import {
  ThemedCollapsible,
  ThemedCollapsibleTrigger,
  ThemedCollapsibleContent,
} from './ThemedCollapsible';

interface SchemaField {
  name: string;
  type: string;
  required: boolean;
}

interface Props {
  schema: string; // raw JSON string
  onSchemaChange: (json: string) => void;
}

const FIELD_TYPES = ['string', 'number', 'boolean', 'array', 'object'];

function parseFieldsFromSchema(schemaStr: string): SchemaField[] {
  try {
    const parsed = JSON.parse(schemaStr);
    if (parsed?.properties) {
      return Object.entries(parsed.properties).map(([name, def]: [string, any]) => ({
        name,
        type: def.type || 'string',
        required: Array.isArray(parsed.required) && parsed.required.includes(name),
      }));
    }
  } catch { /* ignore */ }
  return [];
}

function buildSchemaFromFields(fields: SchemaField[]): string {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  fields.forEach(f => {
    if (f.name) {
      properties[f.name] = { type: f.type };
      if (f.required) required.push(f.name);
    }
  });

  const schema: any = { type: 'object', properties };
  if (required.length > 0) schema.required = required;
  return JSON.stringify(schema, null, 2);
}

export default function OutputSchemaBuilder({ schema, onSchemaChange }: Props) {
  const [fields, setFields] = useState<SchemaField[]>(() => parseFieldsFromSchema(schema));
  const [showRaw, setShowRaw] = useState(false);

  const updateFields = (newFields: SchemaField[]) => {
    setFields(newFields);
    onSchemaChange(buildSchemaFromFields(newFields));
  };

  const addField = () => {
    updateFields([...fields, { name: '', type: 'string', required: false }]);
  };

  const removeField = (index: number) => {
    updateFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, patch: Partial<SchemaField>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...patch };
    updateFields(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>
          Output Schema Builder
        </label>
        <button
          onClick={addField}
          className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md cursor-pointer transition-colors hover:scale-[1.02] active:scale-[0.98]"
          style={{
            backgroundColor: 'var(--neon-color)',
            color: '#000',
          }}
        >
          <Plus size={10} />
          Add Field
        </button>
      </div>

      {/* Field list */}
      <AnimatePresence>
        {fields.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 rounded-lg border text-center"
            style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)' }}
          >
            <p className="text-[10px]" style={{ color: 'var(--text-500)' }}>
              No fields added yet
            </p>
            <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-500)' }}>
              Click &quot;Add Field&quot; to define your output schema
            </p>
          </motion.div>
        ) : (
          <div
            className="p-2 rounded-lg border space-y-2"
            style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)' }}
          >
            {fields.map((field, index) => (
              <motion.div
                key={`field-${index}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={field.name}
                  onChange={e => updateField(index, { name: e.target.value })}
                  placeholder="field_name"
                  className="flex-1 min-w-0 text-[11px] px-2 py-1 rounded border bg-transparent outline-none transition-colors focus:ring-1 focus:ring-[var(--neon-color)] font-mono"
                  style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
                />
                <div className="w-20 shrink-0">
                  <ThemedSelect
                    value={field.type}
                    onValueChange={v => updateField(index, { type: v })}
                  >
                    <ThemedSelectTrigger className="h-7 text-[10px] px-1.5">
                      <ThemedSelectValue />
                    </ThemedSelectTrigger>
                    <ThemedSelectContent>
                      {FIELD_TYPES.map(t => (
                        <ThemedSelectItem key={t} value={t}>{t}</ThemedSelectItem>
                      ))}
                    </ThemedSelectContent>
                  </ThemedSelect>
                </div>
                <button
                  onClick={() => updateField(index, { required: !field.required })}
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer shrink-0",
                    field.required
                      ? "bg-[var(--neon-color)] text-black"
                      : "border",
                  )}
                  style={!field.required ? { borderColor: 'var(--border-300)', color: 'var(--text-500)' } : undefined}
                  title={field.required ? 'Required' : 'Optional — click to mark required'}
                >
                  {field.required ? 'REQ' : 'OPT'}
                </button>
                <button
                  onClick={() => removeField(index)}
                  className="p-0.5 rounded transition-colors cursor-pointer shrink-0 hover:bg-[var(--bg-300)]"
                  style={{ color: 'var(--text-500)' }}
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Raw JSON toggle */}
      <ThemedCollapsible open={showRaw} onOpenChange={setShowRaw}>
        <ThemedCollapsibleTrigger>
          <span className="text-[10px]">View Raw JSON</span>
        </ThemedCollapsibleTrigger>
        <ThemedCollapsibleContent>
          <textarea
            value={schema}
            onChange={e => {
              onSchemaChange(e.target.value);
              setFields(parseFieldsFromSchema(e.target.value));
            }}
            rows={5}
            className="w-full text-[11px] px-2.5 py-2 rounded-lg border bg-transparent font-mono resize-y outline-none transition-colors focus:ring-1 focus:ring-[var(--neon-color)]"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-300)', backgroundColor: 'var(--bg-100)' }}
            placeholder='{"type": "object", "properties": {...}}'
          />
        </ThemedCollapsibleContent>
      </ThemedCollapsible>
    </div>
  );
}
