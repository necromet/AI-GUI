import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import VariableAutocomplete from '../VariableAutocomplete';
import { CHAT_MODELS } from '@/constants';
import { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE, DEFAULT_AGENT_MODEL } from '../constants';
import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';

interface Props {
  data: Record<string, any>;
  onUpdate: (data: Record<string, any>) => void;
  upstreamNodes?: { id: string; label: string }[];
  accentColor?: string;
}

const MODELS = CHAT_MODELS.map(m => ({
  value: m.id,
  label: m.name,
  provider: m.provider,
}));

const PROMPT_TEMPLATES = [
  { label: 'Summarizer', system: 'You are a text summarizer. Provide concise summaries.', user: 'Summarize the following:\n\n{{input}}' },
  { label: 'Classifier', system: 'You are a text classifier. Classify into the given categories.', user: 'Classify this text:\n\n{{input}}' },
  { label: 'Extractor', system: 'You extract structured data from unstructured text.', user: 'Extract key information from:\n\n{{input}}' },
  { label: 'Translator', system: 'You are a professional translator.', user: 'Translate the following:\n\n{{input}}' },
  { label: 'Code Generator', system: 'You write clean, efficient code.', user: 'Write code for:\n\n{{input}}' },
];

export default function AgentNodeConfig({ data, onUpdate, upstreamNodes = [], accentColor }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const accentStyle = { '--accent': accentColor || 'var(--neon-color)' } as React.CSSProperties;

  return (
    <div className="space-y-4" style={accentStyle}>
      <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
        Model
      </div>
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Model</label>
        <select
          value={data.model || DEFAULT_AGENT_MODEL}
          onChange={e => onUpdate({ model: e.target.value })}
          className={fieldClasses.select}
          style={FIELD_STYLES.input}
        >
          {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
        Prompt
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium" style={FIELD_STYLES.label}>System Prompt</label>
          <select
            className="text-[10px] px-1.5 py-0.5 rounded-lg border bg-transparent cursor-pointer transition-colors"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-500)' }}
            onChange={e => {
              const tmpl = PROMPT_TEMPLATES[parseInt(e.target.value)];
              if (tmpl) onUpdate({ systemPrompt: tmpl.system, userPrompt: tmpl.user });
              e.target.value = '';
            }}
            defaultValue=""
          >
            <option value="" disabled>Template...</option>
            {PROMPT_TEMPLATES.map((t, i) => (
              <option key={i} value={i}>{t.label}</option>
            ))}
          </select>
        </div>
        <VariableAutocomplete
          value={data.systemPrompt || data.instructions || ''}
          onChange={v => onUpdate({ systemPrompt: v, instructions: v })}
          placeholder="You are a helpful assistant..."
          multiline
          upstreamNodes={upstreamNodes}
        />
      </div>

      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>User Prompt</label>
        <VariableAutocomplete
          value={data.userPrompt || ''}
          onChange={v => onUpdate({ userPrompt: v })}
          placeholder="Use {{variable}} for dynamic values..."
          multiline
          upstreamNodes={upstreamNodes}
        />
      </div>

      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 w-full text-[10px] font-medium uppercase tracking-wider cursor-pointer"
          style={{ color: 'var(--text-500)' }}
        >
          {showAdvanced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Advanced
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={fieldClasses.label} style={FIELD_STYLES.label}>Max Tokens</label>
                <input
                  type="number"
                  value={data.maxTokens || DEFAULT_MAX_TOKENS}
                  onChange={e => onUpdate({ maxTokens: parseInt(e.target.value) })}
                  className={fieldClasses.input}
                  style={FIELD_STYLES.input}
                />
              </div>
              <div>
                <label className={fieldClasses.label} style={FIELD_STYLES.label}>Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={data.temperature || DEFAULT_TEMPERATURE}
                  onChange={e => onUpdate({ temperature: parseFloat(e.target.value) })}
                  className={fieldClasses.input}
                  style={FIELD_STYLES.input}
                />
              </div>
            </div>

            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Output Format</label>
              <select
                value={data.outputFormat || 'text'}
                onChange={e => onUpdate({ outputFormat: e.target.value })}
                className={fieldClasses.select}
                style={FIELD_STYLES.input}
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer" style={FIELD_STYLES.label}>
              <input
                type="checkbox"
                checked={data.includeChatHistory || false}
                onChange={e => onUpdate({ includeChatHistory: e.target.checked })}
                className="rounded"
              />
              Include chat history
            </label>
          </div>
        )}
      </div>

      <div className="text-[10px] rounded-lg px-2.5 py-2" style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-500)' }}>
        ~{Math.ceil(((data.systemPrompt || '').length + (data.userPrompt || '').length) / 4)} tokens
      </div>
    </div>
  );
}
