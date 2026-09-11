interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; }

export default function TransformNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>
          JavaScript Code
        </label>
        <p className="text-[10px] mb-1" style={{ color: 'var(--text-500)' }}>
          Available: input, lastOutput, state, variables
        </p>
        <textarea
          value={data.code || data.transformScript || 'return input;'}
          onChange={e => onUpdate({ code: e.target.value, transformScript: e.target.value })}
          rows={8}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent resize-none font-mono"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      </div>
    </div>
  );
}
