interface Props {
  data: Record<string, any>;
  onUpdate: (data: Record<string, any>) => void;
}

const MODELS = [
  { value: 'mimo-v2.5', label: 'MiMo V2.5', provider: 'mimo' },
  { value: 'mimo-v2.5-pro', label: 'MiMo V2.5 Pro (Reasoning)', provider: 'mimo' },
  { value: 'mimo-v2.5-direct', label: 'MiMo V2.5 (API Key)', provider: 'mimo-direct' },
  { value: 'mimo-v2.5-pro-direct', label: 'MiMo V2.5 Pro (API Key)', provider: 'mimo-direct' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner', provider: 'deepseek' },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', provider: 'deepseek' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro (Reasoning)', provider: 'deepseek' },
];

export default function AgentNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Model</label>
        <select
          value={data.model || 'mimo-v2.5'}
          onChange={e => onUpdate({ model: e.target.value })}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        >
          {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>System Prompt</label>
        <textarea
          value={data.systemPrompt || data.instructions || ''}
          onChange={e => onUpdate({ systemPrompt: e.target.value, instructions: e.target.value })}
          placeholder="You are a helpful assistant..."
          rows={4}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent resize-none"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      </div>

      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>User Prompt</label>
        <textarea
          value={data.userPrompt || ''}
          onChange={e => onUpdate({ userPrompt: e.target.value })}
          placeholder="Use {{variable}} for dynamic values..."
          rows={3}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent resize-none"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Max Tokens</label>
          <input
            type="number"
            value={data.maxTokens || 4096}
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
            value={data.temperature || 0.7}
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
    </div>
  );
}
