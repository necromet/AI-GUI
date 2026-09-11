interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; }

export default function WhileNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Continue Condition (JavaScript)</label>
        <p className="text-[10px] mb-1" style={{ color: 'var(--text-500)' }}>
          Returns true → loop, false → exit. Available: input, state, lastOutput, variables, iteration
        </p>
        <textarea
          value={data.condition || data.whileCondition || ''}
          onChange={e => onUpdate({ condition: e.target.value, whileCondition: e.target.value })}
          placeholder='iteration < 5'
          rows={3}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent resize-none font-mono"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      </div>
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Max Iterations</label>
        <input
          type="number"
          min={1}
          max={100}
          value={data.maxIterations || 10}
          onChange={e => onUpdate({ maxIterations: parseInt(e.target.value) })}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      </div>
    </div>
  );
}
