interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; }

export default function ExtractNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Extraction Schema (JSON)</label>
        <textarea
          value={data.schema ? JSON.stringify(data.schema, null, 2) : ''}
          onChange={e => { try { onUpdate({ schema: JSON.parse(e.target.value) }); } catch { onUpdate({ schema: e.target.value }); } }}
          placeholder='{"type": "object", "properties": {"title": {"type": "string"}}}'
          rows={5}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent resize-none font-mono"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      </div>
    </div>
  );
}
