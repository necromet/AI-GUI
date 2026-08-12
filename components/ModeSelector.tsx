import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, FlaskConical, Lock, CheckCircle2, ArrowRight, Package, Database } from 'lucide-react';
import NeuralBackground from './NeuralBackground';
import { TextGlitch } from './TextGlitch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const CHAT_PASSWORD = 'thelordismyshepherd';
const EXPERIMENTS_PASSWORD = 'ilacknothing';
const LIBRARY_PASSWORD = 'psalm23';
const DATABASE_PASSWORD = 'heleadsmebesidestillwaters';

interface InlinePasswordModalProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  onSuccess: () => void;
  onClose: () => void;
  correctPassword: string;
}

const InlinePasswordModal: React.FC<InlinePasswordModalProps> = ({ isOpen, title, subtitle, onSuccess, onClose, correctPassword }) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (password === correctPassword) {
      onSuccess();
    } else {
      setError('Incorrect password');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-center">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Password"
          />

          {error && (
            <p className="text-sm animate-shake" style={{ color: '#f87171' }}>{error}</p>
          )}

          <Button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full"
            style={{
              backgroundColor: 'var(--neon-color)',
              color: '#000',
            }}
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
  isExperimentsAuthenticated: boolean;
  isLibraryAuthenticated: boolean;
  isDatabaseAuthenticated: boolean;
  onSelectChat: () => void;
  onSelectExperiments: () => void;
  onSelectLibrary: () => void;
  onSelectDatabase: () => void;
  onUnlockChat: () => void;
  onUnlockExperiments: () => void;
  onUnlockLibrary: () => void;
  onUnlockDatabase: () => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({
  isChatAuthenticated,
  isExperimentsAuthenticated,
  isLibraryAuthenticated,
  isDatabaseAuthenticated,
  onSelectChat,
  onSelectExperiments,
  onSelectLibrary,
  onSelectDatabase,
  onUnlockChat,
  onUnlockExperiments,
  onUnlockLibrary,
  onUnlockDatabase,
}) => {
  const [neonColor, setNeonColor] = useState('#f87171');
  const [showChatPasswordModal, setShowChatPasswordModal] = useState(false);
  const [showExperimentsPasswordModal, setShowExperimentsPasswordModal] = useState(false);
  const [showLibraryPasswordModal, setShowLibraryPasswordModal] = useState(false);
  const [showDatabasePasswordModal, setShowDatabasePasswordModal] = useState(false);

  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-color').trim();
    if (color) setNeonColor(color);
  }, []);

  const handleChatClick = () => {
    if (isChatAuthenticated) {
      onSelectChat();
    } else {
      setShowChatPasswordModal(true);
    }
  };

  const handleExperimentsClick = () => {
    if (isExperimentsAuthenticated) {
      onSelectExperiments();
    } else {
      setShowExperimentsPasswordModal(true);
    }
  };

  const handleLibraryClick = () => {
    if (isLibraryAuthenticated) {
      onSelectLibrary();
    } else {
      setShowLibraryPasswordModal(true);
    }
  };

  const handleDatabaseClick = () => {
    if (isDatabaseAuthenticated) {
      onSelectDatabase();
    } else {
      setShowDatabasePasswordModal(true);
    }
  };

  const handleChatPasswordSuccess = () => {
    onUnlockChat();
    onSelectChat();
    setShowChatPasswordModal(false);
  };

  const handleExperimentsPasswordSuccess = () => {
    onUnlockExperiments();
    onSelectExperiments();
    setShowExperimentsPasswordModal(false);
  };

  const handleLibraryPasswordSuccess = () => {
    onUnlockLibrary();
    onSelectLibrary();
    setShowLibraryPasswordModal(false);
  };

  const handleDatabasePasswordSuccess = () => {
    onUnlockDatabase();
    onSelectDatabase();
    setShowDatabasePasswordModal(false);
  };

  const cards = [
    {
      id: 'chat' as const,
      icon: MessageSquare,
      title: 'Chat',
      description: 'AI-powered conversation with MiMo',
      locked: !isChatAuthenticated,
      onClick: handleChatClick,
    },
    {
      id: 'experiments' as const,
      icon: FlaskConical,
      title: 'Experiments',
      description: 'RAG, Plugin Agent, Skema, Python, and experimental tools',
      locked: !isExperimentsAuthenticated,
      onClick: handleExperimentsClick,
    },
    {
      id: 'library' as const,
      icon: Package,
      title: 'Library',
      description: 'Component library with AI agent — reusable widgets, templates, and tools',
      locked: !isLibraryAuthenticated,
      onClick: handleLibraryClick,
    },
    {
      id: 'database' as const,
      icon: Database,
      title: 'Database',
      description: 'Connect to PostgreSQL databases and explore with SQL',
      locked: !isDatabaseAuthenticated,
      onClick: handleDatabaseClick,
    },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <NeuralBackground className="absolute inset-0 z-0" color={neonColor} trailOpacity={0.12} particleCount={600} speed={0.8} />

      <div className="relative z-10 w-full max-w-7xl mx-4 px-4">
        <div className="text-center mb-12">
          <TextGlitch text="EDWARD:LABS" />
          <p className="text-base mt-4" style={{ color: 'var(--text-500)' }}>
            AI-powered tools for the curious
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {cards.map((card, index) => (
            <button
              key={card.id}
              onClick={card.onClick}
              className="group relative p-6 md:p-8 rounded-2xl border text-left transition-all duration-300 animate-fade-in"
              style={{
                backgroundColor: 'rgba(20, 20, 20, 0.7)',
                backdropFilter: 'blur(20px)',
                borderColor: 'rgba(255, 255, 255, 0.06)',
                opacity: 0,
                animationFillMode: 'forwards',
                animationDelay: `${index * 100}ms`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)';
                e.currentTarget.style.boxShadow = '0 8px 40px rgba(var(--neon-rgb), 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="p-3 rounded-xl"
                  style={{ background: 'rgba(var(--neon-rgb), 0.1)' }}
                >
                  <card.icon size={24} style={{ color: 'var(--neon-color)' }} />
                </div>
                {card.locked ? (
                  <Lock size={16} style={{ color: 'var(--text-500)' }} />
                ) : (
                  <CheckCircle2 size={16} style={{ color: 'var(--neon-color)' }} />
                )}
              </div>

              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-100)' }}>
                {card.title}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-500)' }}>
                {card.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <InlinePasswordModal
        isOpen={showChatPasswordModal}
        title="Unlock Chat"
        subtitle="Enter your password to access AI chat"
        onSuccess={handleChatPasswordSuccess}
        onClose={() => setShowChatPasswordModal(false)}
        correctPassword={CHAT_PASSWORD}
      />

      <InlinePasswordModal
        isOpen={showExperimentsPasswordModal}
        title="Unlock Experiments"
        subtitle="Enter your password to access experimental tools"
        onSuccess={handleExperimentsPasswordSuccess}
        onClose={() => setShowExperimentsPasswordModal(false)}
        correctPassword={EXPERIMENTS_PASSWORD}
      />

      <InlinePasswordModal
        isOpen={showLibraryPasswordModal}
        title="Unlock Library"
        subtitle="Enter your password to access the component library"
        onSuccess={handleLibraryPasswordSuccess}
        onClose={() => setShowLibraryPasswordModal(false)}
        correctPassword={LIBRARY_PASSWORD}
      />

      <InlinePasswordModal
        isOpen={showDatabasePasswordModal}
        title="Unlock Database"
        subtitle="Enter your password to access the database explorer"
        onSuccess={handleDatabasePasswordSuccess}
        onClose={() => setShowDatabasePasswordModal(false)}
        correctPassword={DATABASE_PASSWORD}
      />
    </div>
  );
};

export default ModeSelector;
