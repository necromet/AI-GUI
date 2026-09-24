export const FIELD_STYLES = {
  label: { color: 'var(--text-400)' },
  input: {
    borderColor: 'var(--border-200)',
    color: 'var(--text-100)',
    backgroundColor: 'var(--bg-200)',
  },
  helperText: { color: 'var(--text-400)' },
  sectionBg: 'var(--bg-200)',
} as const;

export const fieldClasses = {
  input: 'w-full rounded-[8px] border px-[12px] py-[10px] text-[14px] leading-[20px] outline-none transition-colors focus:border-[var(--neon-color)] focus:ring-1 focus:ring-[var(--neon-color)]',
  textarea: 'w-full resize-none rounded-[8px] border px-[12px] py-[10px] font-mono text-[14px] leading-[20px] outline-none transition-colors focus:border-[var(--neon-color)] focus:ring-1 focus:ring-[var(--neon-color)]',
  select: 'w-full rounded-[8px] border px-[12px] py-[10px] text-[14px] leading-[20px] outline-none transition-colors focus:border-[var(--neon-color)] focus:ring-1 focus:ring-[var(--neon-color)]',
  label: 'mb-[8px] block text-[13px] font-medium leading-[20px]',
  sectionLabel: 'mb-[8px] text-[13px] font-medium leading-[20px]',
  collapsibleTrigger: 'flex w-full cursor-pointer items-center gap-[6px] text-[13px] font-medium leading-[20px] transition-colors',
  tooltipIcon: 'inline-flex h-[16px] w-[16px] cursor-help items-center justify-center rounded-full transition-colors',
} as const;
