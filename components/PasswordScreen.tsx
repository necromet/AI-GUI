import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import NeuralBackground from './NeuralBackground';

const SESSION_KEY = 'edward:labs_session';
const CORRECT_PASSWORD = 'thelordismyshepherd';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function TextGlitch({ text, defaultText, className = '' }: { text: string; defaultText?: string; className?: string }) {
  const [displayText, setDisplayText] = useState(defaultText || text);
  const [hoverText, setHoverText] = useState(text);
  const hoverIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    let iteration = 0;
    if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);

    hoverIntervalRef.current = setInterval(() => {
      setHoverText(
        text
          .split('')
          .map((letter, index) => {
            if (index < iteration) return text[index];
            return LETTERS[Math.floor(Math.random() * 26)];
          })
          .join(''),
      );
      if (iteration >= text.length) {
        if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
      }
      iteration += 1 / 3;
    }, 30);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
    setHoverText(text);
  };

  useEffect(() => {
    return () => {
      if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
    };
  }, []);

  return (
    <h1
      className={`
        text-5xl font-bold leading-none tracking-tight m-0
        text-gray-900 dark:text-white
        border-b border-gray-200 dark:border-neutral-600/12
        flex flex-col items-center justify-center relative
        transition-all duration-500 ease-out
        cursor-pointer overflow-hidden
        ${className}
      `}
      style={{
        backgroundSize: isHovered ? '100%' : '0%',
        backgroundImage: 'linear-gradient(to right, var(--neon-color), var(--neon-color))',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        width: '100%',
        wordBreak: 'break-word',
        whiteSpace: 'nowrap',
        animation: 'fade-in 0.6s ease-out forwards',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {displayText}
      <span
        className="
          absolute w-full h-full
          text-black font-bold
          flex flex-col items-center justify-center
          transition-all duration-400 ease-out
          pointer-events-none overflow-hidden
        "
        style={{
          clipPath: isHovered
            ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
            : 'polygon(0 50%, 100% 50%, 100% 50%, 0 50%)',
          transformOrigin: 'center',
          backgroundColor: 'var(--neon-color)',
          maxWidth: '100%',
          whiteSpace: 'nowrap',
        }}
      >
        {hoverText}
      </span>
    </h1>
  );
}

interface PasswordScreenProps {
  onSuccess: () => void;
}

const PasswordScreen: React.FC<PasswordScreenProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [neonColor, setNeonColor] = useState('#f87171');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-color').trim();
    if (color) setNeonColor(color);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      onSuccess();
    } else {
      setError('Incorrect password');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <NeuralBackground className="absolute inset-0 z-0" color={neonColor} trailOpacity={0.12} particleCount={600} speed={0.8} />
      <div className="relative z-10 w-full max-w-md mx-4 p-8 rounded-2xl border border-white/[0.04] bg-[#0a0a0a]/80 backdrop-blur-xl shadow-xl">
        <div className="text-center mb-8">
           <TextGlitch text="EDWARD:LABS" defaultText="DRAWDE:SLAB" />
          <p className="text-sm text-gray-500 mt-4">Enter your password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 bg-white/[0.03] border border-white/[0.06] outline-none transition-all duration-200 focus:border-white/12"
          />

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-white text-black hover:opacity-90"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                Enter
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordScreen;
