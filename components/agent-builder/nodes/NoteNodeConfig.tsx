interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; }

export default function NoteNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Note Text</label>
        <textarea
          value={data.text || data.noteText || ''}
          onChange={e => onUpdate({ text: e.target.value, noteText: e.target.value })}
          placeholder="Add your notes here..."
          rows={4}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent resize-none"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      </div>
    </div>
  );
}
