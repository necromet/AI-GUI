import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

export default function ExtractNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Extraction Schema (JSON)</label>
        <textarea
          value={data.schema ? JSON.stringify(data.schema, null, 2) : ''}
          onChange={e => { try { onUpdate({ schema: JSON.parse(e.target.value) }); } catch { onUpdate({ schema: e.target.value }); } }}
          placeholder='{"type": "object", "properties": {"title": {"type": "string"}}}'
          rows={5}
          className={fieldClasses.textarea}
          style={FIELD_STYLES.input}
        />
      </div>
    </div>
  );
}
