interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; }

export default function ApprovalNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Approval Message</label>
        <textarea
          value={data.message || data.approvalMessage || 'Approve to continue?'}
          onChange={e => onUpdate({ message: e.target.value, approvalMessage: e.target.value })}
          rows={3}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent resize-none"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      </div>
    </div>
  );
}
