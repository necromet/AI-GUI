import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, ArrowRight, Package, Database, Workflow, Layers, Terminal, FileSearch, StickyNote } from 'lucide-react';
import NeuralBackground from './NeuralBackground';
import { TextGlitch } from './TextGlitch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const CHAT_PASSWORD = process.env.CHAT_PASSWORD;
const RAG_PASSWORD = process.env.RAG_PASSWORD;
const SKEMA_PASSWORD = process.env.SKEMA_PASSWORD;
const PYTHON_PASSWORD = process.env.PYTHON_PASSWORD;
const LIBRARY_PASSWORD = process.env.LIBRARY_PASSWORD;
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD;
const AGENT_BUILDER_PASSWORD = process.env.AGENT_BUILDER_PASSWORD;
const NOTES_PASSWORD = process.env.NOTES_PASSWORD;

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
  onUnlockChat: () => void;
  onUnlockRag: () => void;
  onUnlockSkema: () => void;
  onUnlockPython: () => void;
  onUnlockLibrary: () => void;
  onUnlockDatabase: () => void;
  onUnlockAgentBuilder: () => void;
  onUnlockNotes: () => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({
  isChatAuthenticated,
  isRagAuthenticated,
  isSkemaAuthenticated,
  isPythonAuthenticated,
  isLibraryAuthenticated,
  isDatabaseAuthenticated,
  isAgentBuilderAuthenticated,
  isNotesAuthenticated,
  onSelectChat,
  onSelectRag,
  onSelectSkema,
  onSelectPython,
  onSelectLibrary,
  onSelectDatabase,
  onSelectAgentBuilder,
  onSelectNotes,
  onUnlockChat,
  onUnlockRag,
  onUnlockSkema,
  onUnlockPython,
  onUnlockLibrary,
  onUnlockDatabase,
  onUnlockAgentBuilder,
  onUnlockNotes,
}) => {
  const [neonColor, setNeonColor] = useState('#f87171');
  const [showChatPasswordModal, setShowChatPasswordModal] = useState(false);
  const [showRagPasswordModal, setShowRagPasswordModal] = useState(false);
  const [showSkemaPasswordModal, setShowSkemaPasswordModal] = useState(false);
  const [showPythonPasswordModal, setShowPythonPasswordModal] = useState(false);
  const [showLibraryPasswordModal, setShowLibraryPasswordModal] = useState(false);
  const [showDatabasePasswordModal, setShowDatabasePasswordModal] = useState(false);
  const [showAgentBuilderPasswordModal, setShowAgentBuilderPasswordModal] = useState(false);
  const [showNotesPasswordModal, setShowNotesPasswordModal] = useState(false);

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

  const handleRagClick = () => {
    if (isRagAuthenticated) {
      onSelectRag();
    } else {
      setShowRagPasswordModal(true);
    }
  };

  const handleSkemaClick = () => {
    if (isSkemaAuthenticated) {
      onSelectSkema();
    } else {
      setShowSkemaPasswordModal(true);
    }
  };

  const handlePythonClick = () => {
    if (isPythonAuthenticated) {
      onSelectPython();
    } else {
      setShowPythonPasswordModal(true);
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

  const handleAgentBuilderClick = () => {
    if (isAgentBuilderAuthenticated) {
      onSelectAgentBuilder();
    } else {
      setShowAgentBuilderPasswordModal(true);
    }
  };

  const handleNotesClick = () => {
    if (isNotesAuthenticated) {
      onSelectNotes();
    } else {
      setShowNotesPasswordModal(true);
    }
  };

  const handleChatPasswordSuccess = () => {
    onUnlockChat();
    onSelectChat();
    setShowChatPasswordModal(false);
  };

  const handleRagPasswordSuccess = () => {
    onUnlockRag();
    onSelectRag();
    setShowRagPasswordModal(false);
  };

  const handleSkemaPasswordSuccess = () => {
    onUnlockSkema();
    onSelectSkema();
    setShowSkemaPasswordModal(false);
  };

  const handlePythonPasswordSuccess = () => {
    onUnlockPython();
    onSelectPython();
    setShowPythonPasswordModal(false);
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

  const handleAgentBuilderPasswordSuccess = () => {
    onUnlockAgentBuilder();
    onSelectAgentBuilder();
    setShowAgentBuilderPasswordModal(false);
  };

  const handleNotesPasswordSuccess = () => {
    onUnlockNotes();
    onSelectNotes();
    setShowNotesPasswordModal(false);
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
      id: 'rag' as const,
      icon: FileSearch,
      title: 'RAG',
      description: 'Retrieval-augmented generation with document upload',
      locked: !isRagAuthenticated,
      onClick: handleRagClick,
    },
    {
      id: 'skema' as const,
      icon: Layers,
      title: 'Skema',
      description: 'AI-powered visual design and HTML generator',
      locked: !isSkemaAuthenticated,
      onClick: handleSkemaClick,
    },
    {
      id: 'python' as const,
      icon: Terminal,
      title: 'Python',
      description: 'Python code executor with project management',
      locked: !isPythonAuthenticated,
      onClick: handlePythonClick,
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
    {
      id: 'agent-builder' as const,
      icon: Workflow,
      title: 'Agent Builder',
      description: 'Visual workflow builder for AI agent pipelines',
      locked: !isAgentBuilderAuthenticated,
      onClick: handleAgentBuilderClick,
    },
    {
      id: 'notes' as const,
      icon: StickyNote,
      title: 'Notes',
      description: 'Notion-style notes with blocks, pages, and markdown',
      locked: !isNotesAuthenticated,
      onClick: handleNotesClick,
    },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <NeuralBackground className="absolute inset-0 z-0" color={neonColor} trailOpacity={0.12} particleCount={600} speed={0.8} />

      <div className="relative z-10 w-full max-w-6xl mx-4 px-4">
        <div className="text-center mb-16">
          <TextGlitch text="EDWARD:LABS" />
          <p className="text-[13px] mt-4 tracking-[0.2em] uppercase" style={{ color: 'var(--text-500)' }}>
            AI-powered tools for the curious
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-5 md:gap-6 max-w-3xl mx-auto">
          {cards.map((card, index) => (
            <button
              key={card.id}
              onClick={card.onClick}
              className="group relative flex flex-col items-center text-center animate-fade-in cursor-pointer rounded-2xl p-5 transition-all duration-300"
              style={{
                opacity: 0,
                animationFillMode: 'forwards',
                animationDelay: `${index * 60}ms`,
                backgroundColor: 'rgba(12, 12, 12, 0.92)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.2)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Icon container — the hero */}
              <div className="relative mb-3">
                <div
                  className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                  style={{
                    backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
                    border: '1px solid rgba(var(--neon-rgb), 0.15)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--neon-rgb), 0.18)';
                    e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)';
                    e.currentTarget.style.boxShadow = '0 0 28px rgba(var(--neon-rgb), 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--neon-rgb), 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.15)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <card.icon size={28} strokeWidth={1.5} style={{ color: 'var(--neon-color)' }} />
                </div>

                {/* Status dot — top right corner of icon */}
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2"
                  style={{
                    backgroundColor: card.locked ? 'rgba(255,255,255,0.08)' : 'var(--neon-color)',
                    borderColor: 'var(--bg-100)',
                    boxShadow: card.locked ? 'none' : '0 0 8px rgba(var(--neon-rgb), 0.5)',
                  }}
                />
              </div>

              {/* Title */}
              <h3
                className="text-[14px] font-semibold tracking-tight leading-tight"
                style={{ color: 'var(--text-100)' }}
              >
                {card.title}
              </h3>

              {/* Description — hover only */}
              <p
                className="text-[11px] leading-snug mt-1.5 max-w-[160px] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ color: 'var(--text-500)' }}
              >
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
        isOpen={showRagPasswordModal}
        title="Unlock RAG"
        subtitle="Enter your password to access RAG chat"
        onSuccess={handleRagPasswordSuccess}
        onClose={() => setShowRagPasswordModal(false)}
        correctPassword={RAG_PASSWORD}
      />

      <InlinePasswordModal
        isOpen={showSkemaPasswordModal}
        title="Unlock Skema"
        subtitle="Enter your password to access the visual design editor"
        onSuccess={handleSkemaPasswordSuccess}
        onClose={() => setShowSkemaPasswordModal(false)}
        correctPassword={SKEMA_PASSWORD}
      />

      <InlinePasswordModal
        isOpen={showPythonPasswordModal}
        title="Unlock Python"
        subtitle="Enter your password to access the Python executor"
        onSuccess={handlePythonPasswordSuccess}
        onClose={() => setShowPythonPasswordModal(false)}
        correctPassword={PYTHON_PASSWORD}
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

      <InlinePasswordModal
        isOpen={showAgentBuilderPasswordModal}
        title="Unlock Agent Builder"
        subtitle="Enter your password to access the visual workflow builder"
        onSuccess={handleAgentBuilderPasswordSuccess}
        onClose={() => setShowAgentBuilderPasswordModal(false)}
        correctPassword={AGENT_BUILDER_PASSWORD}
      />

      <InlinePasswordModal
        isOpen={showNotesPasswordModal}
        title="Unlock Notes"
        subtitle="Enter your password to access the notes app"
        onSuccess={handleNotesPasswordSuccess}
        onClose={() => setShowNotesPasswordModal(false)}
        correctPassword={NOTES_PASSWORD}
      />
    </div>
  );
};

export default ModeSelector;
