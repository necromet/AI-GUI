import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';
import { ThemedSwitch } from '../shared/ThemedSwitch';
import {
  ThemedSelect,
  ThemedSelectTrigger,
  ThemedSelectValue,
  ThemedSelectContent,
  ThemedSelectItem,
} from '../shared/ThemedSelect';
import {
  ThemedTooltip,
  ThemedTooltipTrigger,
  ThemedTooltipContent,
  ThemedTooltipProvider,
} from '../shared/ThemedTooltip';
import { motion } from 'framer-motion';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

const CHECKS = [
  { key: 'pii', label: 'PII Detection', desc: 'Email, phone, SSN, credit card, IP' },
  { key: 'moderation', label: 'Content Moderation', desc: 'Flagged/violative terms' },
  { key: 'jailbreak', label: 'Jailbreak Detection', desc: 'Prompt injection patterns' },
] as const;

export default function GuardrailsNodeConfig({ data, onUpdate }: Props) {
  const checks = data.checks || { pii: true, moderation: true, jailbreak: true };
  const action = data.action || 'block';

  const toggleCheck = (key: string) => {
    onUpdate({ checks: { ...checks, [key]: !checks[key] } });
  };

  return (
    <ThemedTooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div>
          <label className={fieldClasses.label} style={FIELD_STYLES.label}>Safety Checks</label>
          <div className="space-y-1.5 mt-1.5">
            {CHECKS.map((c, i) => (
              <motion.div
                key={c.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.2 }}
                className="flex items-center justify-between p-2.5 rounded-lg transition-colors"
                style={{ backgroundColor: checks[c.key] ? 'var(--bg-200)' : 'transparent' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>{c.label}</span>
                    <ThemedTooltip>
                      <ThemedTooltipTrigger asChild>
                        <span className="text-[10px] cursor-help" style={{ color: 'var(--text-500)' }}>?</span>
                      </ThemedTooltipTrigger>
                      <ThemedTooltipContent side="right">
                        {c.desc}
                      </ThemedTooltipContent>
                    </ThemedTooltip>
                  </div>
                </div>
                <ThemedSwitch
                  checked={!!checks[c.key]}
                  onCheckedChange={() => toggleCheck(c.key)}
                />
              </motion.div>
            ))}
          </div>
        </div>

        <div>
          <label className={fieldClasses.label} style={FIELD_STYLES.label}>On Violation</label>
          <ThemedSelect
            value={action}
            onValueChange={v => onUpdate({ action: v })}
          >
            <ThemedSelectTrigger>
              <ThemedSelectValue />
            </ThemedSelectTrigger>
            <ThemedSelectContent>
              <ThemedSelectItem value="block">Block — fail the workflow</ThemedSelectItem>
              <ThemedSelectItem value="warn">Warn — continue with warning</ThemedSelectItem>
              <ThemedSelectItem value="log">Log — continue silently</ThemedSelectItem>
            </ThemedSelectContent>
          </ThemedSelect>
        </div>
      </div>
    </ThemedTooltipProvider>
  );
}
