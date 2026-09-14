import VariableAutocomplete from '../VariableAutocomplete';
import { CHAT_MODELS } from '@/constants';
import { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE, DEFAULT_AGENT_MODEL } from '../constants';

interface Props {
  data: Record<string, any>;
  onUpdate: (data: Record<string, any>) => void;
  upstreamNodes?: { id: string; label: string }[];
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

export default function AgentNodeConfig({ data, onUpdate, upstreamNodes = [] }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Model</label>
        <select
          value={data.model || DEFAULT_AGENT_MODEL}
          onChange={e => onUpdate({ model: e.target.value })}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        >
          {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>System Prompt</label>
          <select
            className="text-[10px] px-1.5 py-0.5 rounded border bg-transparent cursor-pointer"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-500)' }}
            onChange={e => {
              const tmpl = PROMPT_TEMPLATES[parseInt(e.target.value)];
              if (tmpl) onUpdate({ systemPrompt: tmpl.system, userPrompt: tmpl.user });
              e.target.value = '';
            }}
            defaultValue=""
          >
            <option value="" disabled>Insert template...</option>
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
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>User Prompt</label>
        <VariableAutocomplete
          value={data.userPrompt || ''}
          onChange={v => onUpdate({ userPrompt: v })}
          placeholder="Use {{variable}} for dynamic values..."
          multiline
          upstreamNodes={upstreamNodes}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Max Tokens</label>
          <input
            type="number"
            value={data.maxTokens || DEFAULT_MAX_TOKENS}
            onChange={e => onUpdate({ maxTokens: parseInt(e.target.value) })}
            className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Temperature</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={data.temperature || DEFAULT_TEMPERATURE}
            onChange={e => onUpdate({ temperature: parseFloat(e.target.value) })}
            className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Output Format</label>
        <select
          value={data.outputFormat || 'text'}
          onChange={e => onUpdate({ outputFormat: e.target.value })}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        >
          <option value="text">Text</option>
          <option value="json">JSON</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-300)' }}>
        <input
          type="checkbox"
          checked={data.includeChatHistory || false}
          onChange={e => onUpdate({ includeChatHistory: e.target.checked })}
          className="rounded"
        />
        Include chat history
      </label>

      <div className="pt-1 text-[10px] rounded p-2" style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-500)' }}>
        Est. prompt tokens: ~{Math.ceil(((data.systemPrompt || '').length + (data.userPrompt || '').length) / 4)}
      </div>
    </div>
  );
}
