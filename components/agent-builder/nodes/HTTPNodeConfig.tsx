import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

export default function HTTPNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
        Request
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={fieldClasses.label} style={FIELD_STYLES.label}>Method</label>
          <select
            value={data.method || 'GET'}
            onChange={e => onUpdate({ method: e.target.value })}
            className={fieldClasses.select}
            style={FIELD_STYLES.input}
          >
            <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className={fieldClasses.label} style={FIELD_STYLES.label}>URL</label>
          <input
            value={data.url || data.httpUrl || ''}
            onChange={e => onUpdate({ url: e.target.value, httpUrl: e.target.value })}
            placeholder="https://api.example.com/..."
            className={fieldClasses.input}
            style={FIELD_STYLES.input}
          />
        </div>
      </div>
      <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
        Headers
      </div>
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Headers (JSON)</label>
        <textarea
          value={typeof data.headers === 'string' ? data.headers : JSON.stringify(data.headers || {}, null, 2)}
          onChange={e => { try { onUpdate({ headers: JSON.parse(e.target.value) }); } catch { onUpdate({ headers: e.target.value }); } }}
          placeholder='{"Authorization": "Bearer {{token}}"}'
          rows={3}
          className={fieldClasses.textarea}
          style={FIELD_STYLES.input}
        />
      </div>
      {data.method !== 'GET' && (
        <>
          <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
            Body
          </div>
          <div>
            <label className={fieldClasses.label} style={FIELD_STYLES.label}>Body</label>
            <textarea
              value={typeof data.body === 'string' ? data.body : JSON.stringify(data.body || '', null, 2)}
              onChange={e => onUpdate({ body: e.target.value })}
              rows={4}
              className={fieldClasses.textarea}
              style={FIELD_STYLES.input}
            />
          </div>
        </>
      )}
    </div>
  );
}
