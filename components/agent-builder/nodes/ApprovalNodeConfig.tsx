import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';
import {
  ThemedTooltip,
  ThemedTooltipTrigger,
  ThemedTooltipContent,
  ThemedTooltipProvider,
} from '../shared/ThemedTooltip';
import { Info } from 'lucide-react';
import VariableAutocomplete from '../VariableAutocomplete';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; upstreamNodes?: { id: string; label: string }[]; accentColor?: string; }

export default function ApprovalNodeConfig({ data, onUpdate, upstreamNodes = [] }: Props) {
  return (
    <ThemedTooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div>
          <label className={fieldClasses.label} style={FIELD_STYLES.label}>Approval Message</label>
          <VariableAutocomplete
            value={data.message || data.approvalMessage || 'Approve to continue?'}
            onChange={value => onUpdate({ message: value, approvalMessage: value })}
            placeholder="Use {{variable}} to include workflow data"
            multiline
            rows={3}
            upstreamNodes={upstreamNodes}
          />
        </div>

        <div className="p-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-200)' }}>
          <div className="flex items-center gap-1.5 text-[10px] font-medium mb-2" style={{ color: 'var(--text-300)' }}>
            Output Paths
            <ThemedTooltip>
              <ThemedTooltipTrigger asChild>
                <span style={{ color: 'var(--text-500)' }}><Info size={10} /></span>
              </ThemedTooltipTrigger>
              <ThemedTooltipContent side="top">
                Human reviewers choose to approve or reject. Each path can lead to different nodes.
              </ThemedTooltipContent>
            </ThemedTooltip>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span style={{ color: 'var(--text-300)' }}>
                <strong>Approve</strong> — continues to the approve path
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span style={{ color: 'var(--text-300)' }}>
                <strong>Reject</strong> — continues to the reject path
              </span>
            </div>
          </div>
        </div>
      </div>
    </ThemedTooltipProvider>
  );
}
