export const FIELD_STYLES = {
  label: { color: 'var(--text-300)' },
  input: {
    borderColor: 'var(--border-300)',
    color: 'var(--text-100)',
    backgroundColor: 'transparent',
  },
  helperText: { color: 'var(--text-500)' },
  sectionBg: 'var(--bg-200)',
} as const;

export const fieldClasses = {
  input: 'w-full px-2.5 py-2 text-xs rounded-lg border bg-transparent transition-colors focus:ring-1 focus:ring-[var(--neon-color)] focus:border-[var(--neon-color)] outline-none',
  textarea: 'w-full px-2.5 py-2 text-xs rounded-lg border bg-transparent resize-none font-mono transition-colors focus:ring-1 focus:ring-[var(--neon-color)] focus:border-[var(--neon-color)] outline-none',
  select: 'w-full px-2.5 py-2 text-xs rounded-lg border bg-transparent transition-colors focus:ring-1 focus:ring-[var(--neon-color)] focus:border-[var(--neon-color)] outline-none',
  label: 'text-xs font-medium block mb-1.5',
  sectionLabel: 'text-[10px] font-medium uppercase tracking-wider mb-2',
} as const;
