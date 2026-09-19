import { useState, useEffect } from 'react';
import { Workflow, Play, Wand2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SEMANTIC_COLORS } from './shared/colors';

interface Props {
  onNewWorkflow: () => void;
  onOpenTemplates: () => void;
}

const modalSpring = { type: "spring" as const, damping: 25, stiffness: 300 };

export default function OnboardingOverlay({ onNewWorkflow, onOpenTemplates }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('edward:labs_agentBuilderOnboardingSeen');
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem('edward:labs_agentBuilderOnboardingSeen', 'true');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="onboarding-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-30 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            key="onboarding-card"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={modalSpring}
            className="w-[440px] max-w-[calc(100vw-32px)] rounded-2xl border p-8 text-center"
            style={{
              borderColor: 'rgba(var(--neon-rgb), 0.3)',
              backgroundColor: 'var(--bg-100, #111114)',
              boxShadow: '0px 32px 40px 6px rgba(0,0,0,0.08), 0px 12px 32px 0px rgba(0,0,0,0.06)',
            }}
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
              {[
                { icon: Wand2, label: 'Start from Template', desc: 'Pre-built workflows to learn from', action: () => { dismiss(); onOpenTemplates(); }, borderColor: 'var(--border-300)', bgColor: 'var(--bg-200)' },
                { icon: Play, label: 'Build from Scratch', desc: 'Start with a blank canvas and a Start node', action: () => { dismiss(); onNewWorkflow(); }, borderColor: 'var(--neon-color)', bgColor: 'rgba(var(--neon-rgb), 0.06)' },
                { icon: Eye, label: 'Explore the Canvas', desc: 'Dismiss and look around on your own', action: dismiss, borderColor: 'var(--border-300)', bgColor: 'var(--bg-200)' },
              ].map((opt, i) => (
                <motion.button
                  key={opt.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.2 }}
                  onClick={opt.action}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left cursor-pointer"
                  style={{ borderColor: opt.borderColor, backgroundColor: opt.bgColor }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.12)' }}>
                    <opt.icon size={16} style={{ color: i === 2 ? SEMANTIC_COLORS.warning : 'var(--neon-color)' }} />
                  </div>
                  <div>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>{opt.label}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-500)' }}>{opt.desc}</div>
                  </div>
                </motion.button>
              ))}
            </div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              onClick={dismiss}
              className="mt-4 text-[10px] cursor-pointer hover:underline"
              style={{ color: 'var(--text-500)' }}
            >
              Don't show this again
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
