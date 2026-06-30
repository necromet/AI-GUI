import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ModelConfig } from '../types';

interface StitchPromptBarProps {
  onGenerate: (prompt: string) => void;
  isGenerating?: boolean;
  theme?: 'dark' | 'light';
  models?: ModelConfig[];
  selectedModelId?: string;
  onModelChange?: (id: string) => void;
}

const CHIP_CATEGORIES: { label: string; chips: string[] }[] = [
  {
    label: 'Type',
    chips: ['Landing Page', 'Portfolio', 'Dashboard', 'Hero Section', 'Card Grid', 'Pricing Table', 'Contact Form', 'Testimonial', 'Footer', 'Navigation Bar'],
  },
  {
    label: 'Style',
    chips: ['Modern', 'Minimalist', 'Glassmorphism', 'Neomorphic', 'Dark Theme', 'Colorful', 'Corporate', 'Playful'],
  },
  {
    label: 'Color',
    chips: ['Blue Gradient', 'Purple/Pink', 'Green/Nature', 'Warm Sunset', 'Monochrome', 'Neon', 'Earth Tones'],
  },
  {
    label: 'Layout',
    chips: ['Centered Content', 'Full Width', 'Split Screen', 'Sidebar Layout', 'Grid Layout', 'Single Column'],
  },
];

const StitchPromptBar: React.FC<StitchPromptBarProps> = ({ onGenerate, isGenerating = false, theme = 'dark', models, selectedModelId, onModelChange }) => {
  const [prompt, setPrompt] = useState('');
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  const scrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const chatModels = models?.filter(m => (m.modelType || 'chat') === 'chat') || [];

  const toggleChip = (chip: string) => {
    setActiveChips(prev => {
      const next = new Set(prev);
      if (next.has(chip)) {
        next.delete(chip);
      } else {
        next.add(chip);
      }
      return next;
    });
  };

  const buildFullPrompt = (): string => {
    const parts: string[] = [];
    if (activeChips.size > 0) {
      parts.push([...activeChips].join(', '));
    }
    if (prompt.trim()) {
      parts.push(prompt.trim());
    }
    return parts.join('. ');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const full = buildFullPrompt();
    if (!full || isGenerating) return;
    onGenerate(full);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const scrollCategory = (label: string, dir: 'left' | 'right') => {
    const el = scrollRefs.current.get(label);
    if (el) {
      el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-3">
      {/* Chip categories */}
      {CHIP_CATEGORIES.map(cat => (
        <div key={cat.label} className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0 w-12 text-right" style={{ color: 'var(--text-500)' }}>
            {cat.label}
          </span>
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => scrollCategory(cat.label, 'left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-500)' }}
            >
              <ChevronLeft size={14} />
            </button>
            <div
              ref={el => { if (el) scrollRefs.current.set(cat.label, el); }}
              className="flex gap-1.5 overflow-x-auto scrollbar-hidden px-5"
            >
              {cat.chips.map(chip => {
                const isActive = activeChips.has(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => toggleChip(chip)}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 whitespace-nowrap"
                    style={{
                      backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.2)' : 'var(--bg-200)',
                      border: isActive ? '1px solid rgba(var(--neon-rgb), 0.4)' : '1px solid var(--border-300)',
                      color: isActive ? 'var(--neon-color)' : 'var(--text-500)',
                    }}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => scrollCategory(cat.label, 'right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-500)' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ))}

      {/* Model chips */}
      {chatModels.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0 w-12 text-right" style={{ color: 'var(--text-500)' }}>
            Model
          </span>
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => scrollCategory('Model', 'left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-500)' }}
            >
              <ChevronLeft size={14} />
            </button>
            <div
              ref={el => { if (el) scrollRefs.current.set('Model', el); }}
              className="flex gap-1.5 overflow-x-auto scrollbar-hidden px-5"
            >
              {chatModels.map(model => {
                const isActive = selectedModelId === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => onModelChange?.(model.id)}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 whitespace-nowrap"
                    style={{
                      backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.2)' : 'var(--bg-200)',
                      border: isActive ? '1px solid rgba(var(--neon-rgb), 0.4)' : '1px solid var(--border-300)',
                      color: isActive ? 'var(--neon-color)' : 'var(--text-500)',
                    }}
                  >
                    {model.name}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => scrollCategory('Model', 'right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-500)' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Input + Generate */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeChips.size > 0 ? 'Add more details or press Enter to generate...' : 'Describe the HTML you want to generate...'}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
            style={{
              backgroundColor: 'var(--bg-100)',
              border: '1px solid var(--border-300)',
              color: 'var(--text-100)',
            }}
            disabled={isGenerating}
          />
        </div>
        <button
          type="submit"
          disabled={(!prompt.trim() && activeChips.size === 0) || isGenerating}
          className="p-2.5 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
        >
          {isGenerating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} />
          )}
        </button>
      </form>
    </div>
  );
};

export default StitchPromptBar;
