import VariablePicker from '../VariablePicker';

interface Props {
  data: Record<string, any>;
  onUpdate: (data: Record<string, any>) => void;
}

export default function AgentPanel({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Model</span>
        <select
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs"
          style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
          value={data.model || ''}
          onChange={(e) => onUpdate({ model: e.target.value })}
        >
          <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
          <option value="claude-haiku-4-20250514">Claude Haiku 4</option>
          <option value="gpt-4o">GPT-4o</option>
          <option value="gpt-4o-mini">GPT-4o Mini</option>
          <option value="o3-mini">o3-mini</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>System Prompt</span>
        <textarea
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs resize-y min-h-[60px]"
          style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
          value={data.systemPrompt || ''}
          onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant..."
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>User Prompt</span>
        <textarea
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs resize-y min-h-[60px]"
          style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
          value={data.userPrompt || ''}
          onChange={(e) => onUpdate({ userPrompt: e.target.value })}
          placeholder="{{input.text}}"
        />
      </label>

      <div>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-500)' }}>Insert variable</span>
        <div className="mt-1">
          <VariablePicker onSelect={(v) => onUpdate({ userPrompt: (data.userPrompt || '') + v })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Max Tokens</span>
          <input
            type="number"
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs"
            style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
            value={data.maxTokens || 4096}
            onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value) || 4096 })}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Temperature</span>
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs"
            style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
            value={data.temperature ?? 0.7}
            onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) || 0.7 })}
          />
        </label>
      </div>
    </div>
  );
}
