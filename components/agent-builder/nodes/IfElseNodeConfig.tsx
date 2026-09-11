interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; }

export default function IfElseNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Condition (JavaScript)</label>
        <p className="text-[10px] mb-1" style={{ color: 'var(--text-500)' }}>
          Returns truthy → "if" branch, falsy → "else" branch
        </p>
        <textarea
          value={data.condition || ''}
          onChange={e => onUpdate({ condition: e.target.value })}
          placeholder='input.includes("yes")'
          rows={3}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent resize-none font-mono"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      </div>
    </div>
  );
}
