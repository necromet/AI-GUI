import { useEffect, useMemo } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { motion } from 'framer-motion';

export interface ConfirmCardRequest {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  anchor?: { x: number; y: number };
  onConfirm: () => void | Promise<void>;
}

interface Props extends ConfirmCardRequest {
  onCancel: () => void;
  busy?: boolean;
}

export default function FlyingConfirmCard({
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'danger',
  anchor,
  onConfirm,
  onCancel,
  busy = false,
}: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  const position = useMemo(() => {
    if (typeof window === 'undefined' || !anchor) return null;
    return {
      left: Math.max(16, Math.min(anchor.x - 290, window.innerWidth - 356)),
      top: Math.max(16, Math.min(anchor.y + 10, window.innerHeight - 210)),
    };
  }, [anchor]);

  const accent = variant === 'danger' ? '#f87171' : '#fbbf24';
  const Icon = variant === 'danger' ? Trash2 : AlertTriangle;

  return (
    <div className="fixed inset-0 z-[100]" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-card-title"
        initial={{ opacity: 0, y: -8, scale: 0.94, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -6, scale: 0.96, filter: 'blur(3px)' }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        className={position ? 'fixed w-[340px] rounded-2xl border p-4' : 'absolute left-1/2 top-1/2 w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-4'}
        style={{
          ...position,
          borderColor: `${accent}55`,
          background: 'color-mix(in srgb, var(--bg-100) 94%, transparent)',
          boxShadow: `0 24px 70px rgba(0,0,0,.38), 0 0 0 1px ${accent}18`,
          backdropFilter: 'blur(18px)',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ color: accent, backgroundColor: `${accent}18` }}>
            <Icon size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-card-title" className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>{title}</h3>
            <p className="text-[11px] leading-relaxed mt-1" style={{ color: 'var(--text-500)' }}>{description}</p>
          </div>
          <button onClick={onCancel} disabled={busy} className="p-1 rounded-lg cursor-pointer disabled:opacity-40 hover:bg-[var(--bg-300)]" style={{ color: 'var(--text-500)' }} aria-label="Close confirmation"><X size={14} /></button>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs cursor-pointer disabled:opacity-40" style={{ color: 'var(--text-300)', backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}>Cancel</button>
          <button onClick={() => void onConfirm()} disabled={busy} autoFocus className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50" style={{ color: '#080808', backgroundColor: accent, boxShadow: `0 6px 18px ${accent}28` }}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </motion.div>
    </div>
  );
}
