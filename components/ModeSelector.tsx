import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, ArrowRight, Package, Database, Workflow, Layers, Terminal, FileSearch, StickyNote } from 'lucide-react';
import NeuralBackground from './NeuralBackground';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function rgbToHex(rgb: string): string {
  const parts = rgb.split(',').map(s => parseInt(s.trim(), 10));
  if (parts.length !== 3 || parts.some(isNaN)) return '#818cf8';
  return '#' + parts.map(n => n.toString(16).padStart(2, '0')).join('');
}

function lighten(rgb: string, amount: number): string {
  const parts = rgb.split(',').map(s => parseInt(s.trim(), 10));
  if (parts.length !== 3 || parts.some(isNaN)) return rgb;
  return parts.map(n => Math.min(255, Math.round(n + (255 - n) * amount))).join(', ');
}

interface InlinePasswordModalProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  onVerify: (password: string) => Promise<boolean>;
  onSuccess: () => void;
  onClose: () => void;
  accentHex: string;
}

const InlinePasswordModal: React.FC<InlinePasswordModalProps> = ({ isOpen, title, subtitle, onVerify, onSuccess, onClose, accentHex }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const ok = await onVerify(password);
    if (ok) {
      onSuccess();
    } else {
      setError('Incorrect password');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm" style={{ background: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)' }}>
        <DialogHeader className="text-center">
          <DialogTitle style={{ color: '#f8fafc' }}>{title}</DialogTitle>
          <DialogDescription style={{ color: '#94a3b8' }}>{subtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Password"
            style={{ background: 'rgba(30, 41, 59, 0.7)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc' }}
          />

          {error && (
            <p className="text-sm animate-shake" style={{ color: '#f87171' }}>{error}</p>
          )}

          <Button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full font-semibold"
            style={{ backgroundColor: accentHex, color: '#0f172a' }}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                Unlock
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface ModeSelectorProps {
  isChatAuthenticated: boolean;
  isRagAuthenticated: boolean;
  isSkemaAuthenticated: boolean;
  isPythonAuthenticated: boolean;
  isLibraryAuthenticated: boolean;
  isDatabaseAuthenticated: boolean;
  isAgentBuilderAuthenticated: boolean;
  isNotesAuthenticated: boolean;
  onSelectChat: () => void;
  onSelectRag: () => void;
  onSelectSkema: () => void;
  onSelectPython: () => void;
  onSelectLibrary: () => void;
  onSelectDatabase: () => void;
  onSelectAgentBuilder: () => void;
  onSelectNotes: () => void;
  onUnlockChat: (password: string) => Promise<boolean>;
  onUnlockRag: (password: string) => Promise<boolean>;
  onUnlockSkema: (password: string) => Promise<boolean>;
  onUnlockPython: (password: string) => Promise<boolean>;
  onUnlockLibrary: (password: string) => Promise<boolean>;
  onUnlockDatabase: (password: string) => Promise<boolean>;
  onUnlockAgentBuilder: (password: string) => Promise<boolean>;
  onUnlockNotes: (password: string) => Promise<boolean>;
}

const ModeSelector: React.FC<ModeSelectorProps> = (props) => {
  const {
    isChatAuthenticated, isRagAuthenticated, isSkemaAuthenticated, isPythonAuthenticated,
    isLibraryAuthenticated, isDatabaseAuthenticated, isAgentBuilderAuthenticated, isNotesAuthenticated,
    onSelectChat, onSelectRag, onSelectSkema, onSelectPython,
    onSelectLibrary, onSelectDatabase, onSelectAgentBuilder, onSelectNotes,
    onUnlockChat, onUnlockRag, onUnlockSkema, onUnlockPython,
    onUnlockLibrary, onUnlockDatabase, onUnlockAgentBuilder, onUnlockNotes,
  } = props;

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [neonColor, setNeonColor] = useState('248, 113, 113');
  const [neonSecondary, setNeonSecondary] = useState('34, 211, 238');
  const [neonAccent, setNeonAccent] = useState('192, 132, 252');

  useEffect(() => {
    const root = document.documentElement;
    const primary = root.style.getPropertyValue('--neon-rgb').trim();
    const secondary = root.style.getPropertyValue('--neon-secondary-rgb').trim();
    const accent = root.style.getPropertyValue('--neon-accent-rgb').trim();
    if (primary) setNeonColor(primary);
    if (secondary) setNeonSecondary(secondary);
    if (accent) setNeonAccent(accent);
  }, []);

  const accentColors = useMemo(() => {
    const bases = [neonColor, neonSecondary, neonAccent];
    return bases.map((rgb, i) => ({
      rgb,
      hex: rgbToHex(rgb),
      lightRgb: lighten(rgb, 0.3),
      lightHex: rgbToHex(lighten(rgb, 0.3)),
    }));
  }, [neonColor, neonSecondary, neonAccent]);

  const cards = [
    { id: 'chat', icon: MessageSquare, title: 'Chat', desc: 'AI-powered conversation', locked: !isChatAuthenticated, onSelect: onSelectChat, onUnlock: onUnlockChat, modalSubtitle: 'Enter your password to access AI chat' },
    { id: 'rag', icon: FileSearch, title: 'RAG', desc: 'Document-augmented generation', locked: !isRagAuthenticated, onSelect: onSelectRag, onUnlock: onUnlockRag, modalSubtitle: 'Enter your password to access RAG' },
    { id: 'skema', icon: Layers, title: 'Skema', desc: 'Visual design editor', locked: !isSkemaAuthenticated, onSelect: onSelectSkema, onUnlock: onUnlockSkema, modalSubtitle: 'Enter your password to access Skema' },
    { id: 'python', icon: Terminal, title: 'Python', desc: 'Code executor', locked: !isPythonAuthenticated, onSelect: onSelectPython, onUnlock: onUnlockPython, modalSubtitle: 'Enter your password to access Python' },
    { id: 'library', icon: Package, title: 'Library', desc: 'Component library', locked: !isLibraryAuthenticated, onSelect: onSelectLibrary, onUnlock: onUnlockLibrary, modalSubtitle: 'Enter your password to access Library' },
    { id: 'database', icon: Database, title: 'Database', desc: 'SQL explorer', locked: !isDatabaseAuthenticated, onSelect: onSelectDatabase, onUnlock: onUnlockDatabase, modalSubtitle: 'Enter your password to access Database' },
    { id: 'agent-builder', icon: Workflow, title: 'Agent Builder', desc: 'Workflow builder', locked: !isAgentBuilderAuthenticated, onSelect: onSelectAgentBuilder, onUnlock: onUnlockAgentBuilder, modalSubtitle: 'Enter your password to access Agent Builder' },
    { id: 'notes', icon: StickyNote, title: 'Notes', desc: 'Markdown notes', locked: !isNotesAuthenticated, onSelect: onSelectNotes, onUnlock: onUnlockNotes, modalSubtitle: 'Enter your password to access Notes' },
  ];

  const handleCardClick = (card: typeof cards[number]) => {
    if (card.locked) {
      setActiveModal(card.id);
    } else {
      card.onSelect();
    }
  };

  const handlePasswordSuccess = (card: typeof cards[number]) => {
    card.onSelect();
    setActiveModal(null);
  };

  const activeCard = cards.find(c => c.id === activeModal);
  const activeCardIndex = activeCard ? cards.indexOf(activeCard) : 0;
  const activeAccent = accentColors[activeCardIndex % accentColors.length];

  return (
    <>
      <style>{`
        @keyframes selector-fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .selector-card {
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          padding: 2rem 1.5rem 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          height: 200px;
          position: relative;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          overflow: hidden;
          opacity: 0;
          animation: selector-fade-in 0.5s ease forwards;
        }
        .selector-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          border-radius: 1.5rem;
          opacity: 0;
          transition: opacity 0.4s ease;
          z-index: 0;
          background: radial-gradient(circle at center, var(--glow-color) 0%, transparent 70%);
        }
        .selector-card:hover {
          transform: translateY(-10px) scale(1.02);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
          border-color: var(--glow-color);
        }
        .selector-card:hover::before {
          opacity: 0.2;
        }
        .selector-card .card-icon {
          transition: all 0.4s ease;
        }
        .selector-card:hover .card-icon {
          transform: translateY(-20px) scale(0.85);
        }
        .selector-card .card-text {
          position: absolute;
          bottom: 1.25rem;
          left: 0;
          right: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          opacity: 0;
          transform: translateY(12px);
          transition: all 0.4s ease;
        }
        .selector-card:hover .card-text {
          opacity: 1;
          transform: translateY(0);
        }
        .selector-card .card-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: #f8fafc;
          line-height: 1.2;
        }
        .selector-card .card-desc {
          font-size: 0.7rem;
          color: #94a3b8;
          line-height: 1.3;
          max-width: 140px;
        }
      `}</style>

      <div className="relative flex min-h-screen items-center justify-center" style={{ background: '#0f172a' }}>
        <NeuralBackground className="absolute inset-0 z-0" color={rgbToHex(neonColor)} trailOpacity={0.12} particleCount={600} speed={0.8} />

        <div className="relative z-10 w-full max-w-6xl mx-4 px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight" style={{ background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              EDWARD<span style={{ WebkitTextFillColor: accentColors[0].hex }}>:</span>LABS
            </h1>
            <p className="mt-2 text-sm tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              AI-powered tools for the curious
            </p>
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 md:gap-6 max-w-3xl mx-auto">
            {cards.map((card, index) => {
              const accent = accentColors[index % accentColors.length];
              return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card)}
                  className="selector-card"
                  style={{
                    '--glow-color': accent.hex,
                    animationDelay: `${index * 60}ms`,
                  } as React.CSSProperties}
                >
                  <div className="card-icon relative z-10">
                    <card.icon
                      size={42}
                      strokeWidth={1.5}
                      style={{ color: accent.hex }}
                    />
                    {!card.locked && (
                      <div
                        className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: '#ef4444', boxShadow: '0 0 10px #ef4444' }}
                      />
                    )}
                  </div>
                  <div className="card-text z-10">
                    <div className="card-title">{card.title}</div>
                    <div className="card-desc">{card.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {activeCard && (
          <InlinePasswordModal
            isOpen={true}
            title={`Unlock ${activeCard.title}`}
            subtitle={activeCard.modalSubtitle}
            onVerify={activeCard.onUnlock}
            onSuccess={() => handlePasswordSuccess(activeCard)}
            onClose={() => setActiveModal(null)}
            accentHex={activeAccent.hex}
          />
        )}
      </div>
    </>
  );
};

export default ModeSelector;
