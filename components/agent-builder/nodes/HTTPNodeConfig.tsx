interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; }

export default function HTTPNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Method</label>
          <select
            value={data.method || 'GET'}
            onChange={e => onUpdate({ method: e.target.value })}
            className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          >
            <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>URL</label>
          <input
            value={data.url || data.httpUrl || ''}
            onChange={e => onUpdate({ url: e.target.value, httpUrl: e.target.value })}
            placeholder="https://api.example.com/..."
            className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Headers (JSON)</label>
        <textarea
          value={typeof data.headers === 'string' ? data.headers : JSON.stringify(data.headers || {}, null, 2)}
          onChange={e => { try { onUpdate({ headers: JSON.parse(e.target.value) }); } catch { onUpdate({ headers: e.target.value }); } }}
          placeholder='{"Authorization": "Bearer {{token}}"}'
          rows={3}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent resize-none font-mono"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      </div>
      {data.method !== 'GET' && (
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Body</label>
          <textarea
            value={typeof data.body === 'string' ? data.body : JSON.stringify(data.body || '', null, 2)}
            onChange={e => onUpdate({ body: e.target.value })}
            rows={4}
            className="w-full px-2 py-1.5 text-xs rounded border bg-transparent resize-none font-mono"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          />
        </div>
      )}
    </div>
  );
}
