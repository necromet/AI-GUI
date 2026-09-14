import { useState, useEffect } from 'react';
import { Workflow, Play, Wand2, Eye } from 'lucide-react';
import { SEMANTIC_COLORS } from './shared/colors';

interface Props {
  onNewWorkflow: () => void;
  onOpenTemplates: () => void;
}

export default function OnboardingOverlay({ onNewWorkflow, onOpenTemplates }: Props) {
  const [visible, setVisible] = useState(false);
  const [animState, setAnimState] = useState<'enter' | 'visible' | 'hidden'>('enter');

  useEffect(() => {
    const dismissed = localStorage.getItem('edward:labs_agentBuilderOnboardingSeen');
    if (!dismissed) {
      setVisible(true);
      requestAnimationFrame(() => setAnimState('visible'));
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem('edward:labs_agentBuilderOnboardingSeen', 'true');
    setAnimState('hidden');
    setTimeout(() => setVisible(false), 200);
  };

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center transition-all duration-200"
      style={{
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        opacity: animState === 'visible' ? 1 : 0,
      }}
    >
      <div
        className="w-[440px] max-w-[calc(100vw-32px)] rounded-2xl border p-8 text-center"
        style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100, #111114)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.12)' }}
        >
          <Workflow size={28} style={{ color: 'var(--neon-color)' }} />
        </div>

        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-100)' }}>
          Welcome to Agent Builder
        </h2>
        <p className="text-xs mb-6 leading-relaxed" style={{ color: 'var(--text-500)' }}>
          Build AI agent workflows visually. Drag nodes, connect them, and run your pipeline — no code required.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => { dismiss(); onOpenTemplates(); }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition-all cursor-pointer"
            style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.4)'; e.currentTarget.style.backgroundColor = 'var(--bg-300)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-300)'; e.currentTarget.style.backgroundColor = 'var(--bg-200)'; }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.12)' }}>
              <Wand2 size={16} style={{ color: 'var(--neon-color)' }} />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>Start from Template</div>
              <div className="text-[10px]" style={{ color: 'var(--text-500)' }}>Pre-built workflows to learn from</div>
            </div>
          </button>

          <button
            onClick={() => { dismiss(); onNewWorkflow(); }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition-all cursor-pointer"
            style={{ borderColor: 'var(--neon-color)', backgroundColor: 'rgba(var(--neon-rgb), 0.06)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(var(--neon-rgb), 0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(var(--neon-rgb), 0.06)'; }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.12)' }}>
              <Play size={16} style={{ color: 'var(--neon-color)' }} />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>Build from Scratch</div>
              <div className="text-[10px]" style={{ color: 'var(--text-500)' }}>Start with a blank canvas and a Start node</div>
            </div>
          </button>

          <button
            onClick={dismiss}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition-all cursor-pointer"
            style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--bg-200)'; }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(251,191,36,0.12)' }}>
              <Eye size={16} style={{ color: SEMANTIC_COLORS.warning }} />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>Explore the Canvas</div>
              <div className="text-[10px]" style={{ color: 'var(--text-500)' }}>Dismiss and look around on your own</div>
            </div>
          </button>
        </div>

        <button
          onClick={dismiss}
          className="mt-4 text-[10px] cursor-pointer"
          style={{ color: 'var(--text-500)' }}
        >
          Don't show this again
        </button>
      </div>
    </div>
  );
}
