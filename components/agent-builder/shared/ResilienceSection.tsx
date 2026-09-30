import { Info, ShieldCheck } from 'lucide-react';
import { FIELD_STYLES, fieldClasses } from './formStyles';
import { ThemedSwitch } from './ThemedSwitch';
import { ThemedSlider } from './ThemedSlider';
import {
  ThemedTooltip,
  ThemedTooltipTrigger,
  ThemedTooltipContent,
  ThemedTooltipProvider,
} from './ThemedTooltip';
import {
  ThemedCollapsible,
  ThemedCollapsibleTrigger,
  ThemedCollapsibleContent,
} from './ThemedCollapsible';
import { DEFAULT_RETRY_POLICY, normalizeRetryPolicy, type RetryPolicy } from '../../../lib/workflow/retry';

interface Props {
  data: Record<string, any>;
  onUpdate: (data: Record<string, any>) => void;
}

function isEnabled(retry: RetryPolicy): boolean {
  return retry.maxAttempts > 1;
}

export default function ResilienceSection({ data, onUpdate }: Props) {
  const policy = normalizeRetryPolicy(data.retry);
  const enabled = isEnabled(policy);

  const setRetry = (next: Partial<RetryPolicy>, enable?: boolean) => {
    const shouldEnable = enable ?? enabled;
    if (!shouldEnable) {
      onUpdate({ retry: { ...DEFAULT_RETRY_POLICY } });
      return;
    }
    const merged = normalizeRetryPolicy({ ...policy, ...next, maxAttempts: Math.max(2, next.maxAttempts ?? policy.maxAttempts) });
    onUpdate({ retry: merged });
  };

  return (
    <ThemedTooltipProvider delayDuration={300}>
      <ThemedCollapsible className="rounded-[8px] border" style={{ borderColor: 'var(--border-200)', backgroundColor: 'var(--bg-200)' }}>
        <ThemedCollapsibleTrigger label="Resilience" className="px-[12px] py-[10px]" />
        <ThemedCollapsibleContent className="px-[12px] pb-[12px]">
          <div className="space-y-3 pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1.5">
                <ShieldCheck size={12} style={{ color: 'var(--text-400)' }} />
                <div>
                  <div className="text-[12px] font-medium" style={{ color: 'var(--text-100)' }}>Retry on failure</div>
                  <div className="text-[10px] leading-[14px]" style={{ color: 'var(--text-400)' }}>
                    Network, rate-limit, and 5xx errors only
                  </div>
                </div>
                <ThemedTooltip>
                  <ThemedTooltipTrigger asChild>
                    <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
                  </ThemedTooltipTrigger>
                  <ThemedTooltipContent side="top" className="max-w-[260px]">
                    Config and validation errors are never retried. When retry is on, HTTP 429/5xx responses also count as failures.
                  </ThemedTooltipContent>
                </ThemedTooltip>
              </div>
              <ThemedSwitch
                checked={enabled}
                onCheckedChange={checked => {
                  if (checked) setRetry({ maxAttempts: 3 }, true);
                  else onUpdate({ retry: { ...DEFAULT_RETRY_POLICY } });
                }}
              />
            </div>

            {enabled && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>Max attempts</label>
                      <ThemedTooltip>
                        <ThemedTooltipTrigger asChild>
                          <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
                        </ThemedTooltipTrigger>
                        <ThemedTooltipContent side="top">Total tries including the first (1–5)</ThemedTooltipContent>
                      </ThemedTooltip>
                    </div>
                    <input
                      type="number"
                      min={2}
                      max={5}
                      value={policy.maxAttempts}
                      onChange={e => setRetry({ maxAttempts: parseInt(e.target.value) || 3 })}
                      className="w-14 text-right text-xs px-1.5 py-0.5 rounded border bg-transparent outline-none transition-colors focus:ring-1 focus:ring-[var(--neon-color)]"
                      style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
                    />
                  </div>
                  <ThemedSlider
                    min={2}
                    max={5}
                    step={1}
                    value={[policy.maxAttempts]}
                    onValueChange={([v]) => setRetry({ maxAttempts: v })}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>Backoff (ms)</label>
                      <ThemedTooltip>
                        <ThemedTooltipTrigger asChild>
                          <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
                        </ThemedTooltipTrigger>
                        <ThemedTooltipContent side="top">Delay before the first retry</ThemedTooltipContent>
                      </ThemedTooltip>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={30000}
                      step={100}
                      value={policy.backoffMs}
                      onChange={e => setRetry({ backoffMs: parseInt(e.target.value) || 0 })}
                      className="w-16 text-right text-xs px-1.5 py-0.5 rounded border bg-transparent outline-none transition-colors focus:ring-1 focus:ring-[var(--neon-color)]"
                      style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
                    />
                  </div>
                  <ThemedSlider
                    min={0}
                    max={10000}
                    step={100}
                    value={[Math.min(policy.backoffMs, 10000)]}
                    onValueChange={([v]) => setRetry({ backoffMs: v })}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>Backoff multiplier</label>
                      <ThemedTooltip>
                        <ThemedTooltipTrigger asChild>
                          <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
                        </ThemedTooltipTrigger>
                        <ThemedTooltipContent side="top">
                          Each retry waits longer: delay × multiplier^(attempt−1), capped at 30s
                        </ThemedTooltipContent>
                      </ThemedTooltip>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      step={0.5}
                      value={policy.backoffMultiplier}
                      onChange={e => setRetry({ backoffMultiplier: parseFloat(e.target.value) || 2 })}
                      className="w-14 text-right text-xs px-1.5 py-0.5 rounded border bg-transparent outline-none transition-colors focus:ring-1 focus:ring-[var(--neon-color)]"
                      style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
                    />
                  </div>
                  <ThemedSlider
                    min={1}
                    max={5}
                    step={0.5}
                    value={[policy.backoffMultiplier]}
                    onValueChange={([v]) => setRetry({ backoffMultiplier: v })}
                  />
                </div>
              </>
            )}
          </div>
        </ThemedCollapsibleContent>
      </ThemedCollapsible>
    </ThemedTooltipProvider>
  );
}
