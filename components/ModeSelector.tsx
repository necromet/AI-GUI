import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, FlaskConical, Lock, CheckCircle2, ArrowRight, X } from 'lucide-react';
import NeuralBackground from './NeuralBackground';
import { TextGlitch } from './TextGlitch';

const CHAT_PASSWORD = 'thelordismyshepherd';
const EXPERIMENTS_PASSWORD = 'ilacknothing';

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 p-6 rounded-2xl border animate-fade-in"
        style={{
          backgroundColor: 'var(--bg-200)',
          borderColor: 'var(--border-300)',
          boxShadow: '0 0 40px rgba(var(--neon-rgb), 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-500)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-100)' }}>
            {title}
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-500)' }}>
            {subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
            style={{
              backgroundColor: 'var(--bg-100)',
              border: '1px solid var(--border-300)',
              color: 'var(--text-100)',
            }}
          />

          {error && (
            <p className="text-sm animate-shake" style={{ color: '#f87171' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
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
          </button>
        </form>
      </div>
    </div>
  );
};

interface ModeSelectorProps {
  isChatAuthenticated: boolean;
  isExperimentsAuthenticated: boolean;
  onSelectChat: () => void;
  onSelectExperiments: () => void;
  onUnlockChat: () => void;
  onUnlockExperiments: () => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({
  isChatAuthenticated,
  isExperimentsAuthenticated,
  onSelectChat,
  onSelectExperiments,
  onUnlockChat,
  onUnlockExperiments,
}) => {
  const [neonColor, setNeonColor] = useState('#f87171');
  const [showChatPasswordModal, setShowChatPasswordModal] = useState(false);
  const [showExperimentsPasswordModal, setShowExperimentsPasswordModal] = useState(false);

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
      description: 'RAG, Plugin Agent, Stitch, and experimental tools',
      locked: !isExperimentsAuthenticated,
      onClick: handleExperimentsClick,
    },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <NeuralBackground className="absolute inset-0 z-0" color={neonColor} trailOpacity={0.12} particleCount={600} speed={0.8} />

      <div className="relative z-10 w-full max-w-2xl mx-4 px-4">
        <div className="text-center mb-12">
          <TextGlitch text="EDWARD:LABS" />
          <p className="text-sm mt-4" style={{ color: 'var(--text-500)' }}>
            AI-powered tools for the curious
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
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
              <p className="text-xs" style={{ color: 'var(--text-500)' }}>
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
    </div>
  );
};

export default ModeSelector;
