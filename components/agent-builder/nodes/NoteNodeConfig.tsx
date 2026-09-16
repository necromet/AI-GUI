import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

export default function NoteNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Note Text</label>
        <textarea
          value={data.text || data.noteText || ''}
          onChange={e => onUpdate({ text: e.target.value, noteText: e.target.value })}
          placeholder="Add your notes here..."
          rows={4}
          className={fieldClasses.textarea}
          style={FIELD_STYLES.input}
        />
      </div>
    </div>
  );
}
