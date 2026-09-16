import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

export default function ApprovalNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Approval Message</label>
        <textarea
          value={data.message || data.approvalMessage || 'Approve to continue?'}
          onChange={e => onUpdate({ message: e.target.value, approvalMessage: e.target.value })}
          rows={3}
          className={fieldClasses.textarea}
          style={FIELD_STYLES.input}
        />
      </div>
    </div>
  );
}
