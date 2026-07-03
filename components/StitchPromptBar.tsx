import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ModelConfig, StitchProjectType } from '../types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StitchPromptBarProps {
  onGenerate: (prompt: string) => void;
  isGenerating?: boolean;
  theme?: 'dark' | 'light';
  models?: ModelConfig[];
  selectedModelId?: string;
  onModelChange?: (id: string) => void;
  initialPrompt?: string;
  initialActiveChips?: string[];
  onPromptChange?: (prompt: string) => void;
  onActiveChipsChange?: (chips: string[]) => void;
  projectType?: StitchProjectType;
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

const IG_CAROUSEL_CHIPS: { label: string; chips: string[] }[] = [
  {
    label: 'Content',
    chips: ['Listicle', 'Before/After', 'Step-by-Step', 'Tips & Tricks', 'Story Sequence', 'Tutorial', 'Product Showcase', 'Testimonial'],
  },
  {
    label: 'Style',
    chips: ['Bold & Colorful', 'Minimalist', 'Dark Luxury', 'Pastel Aesthetic', 'Neon Pop', 'Corporate Clean', 'Hand-drawn', 'Gradient Mesh'],
  },
  {
    label: 'CTA',
    chips: ['Save This Post', 'Follow for More', 'Comment Below', 'Share with Friend', 'Link in Bio', 'DM Us', 'Tag a Friend', 'Shop Now'],
  },
];

const IG_STORY_CHIPS: { label: string; chips: string[] }[] = [
  {
    label: 'Type',
    chips: ['Announcement', 'Poll/Question', 'Countdown', 'Quote', 'Behind the Scenes', 'Promotion', 'Tutorial', 'Meme'],
  },
  {
    label: 'Style',
    chips: ['Bold Text', 'Photo-centric', 'Gradient BG', 'Minimal', 'Neon', 'Vintage', 'Monochrome'],
  },
  {
    label: 'Interactive',
    chips: ['Poll Sticker', 'Question Box', 'Quiz', 'Slider', 'Countdown Timer', 'Swipe Up', 'Link Sticker'],
  },
];

const StitchPromptBar: React.FC<StitchPromptBarProps> = ({ onGenerate, isGenerating = false, theme = 'dark', models, selectedModelId, onModelChange, initialPrompt = '', initialActiveChips = [], onPromptChange, onActiveChipsChange, projectType }) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set(initialActiveChips));
  const scrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const skipInitialChipsSync = useRef(true);
  const [overflowState, setOverflowState] = useState<Record<string, { left: boolean; right: boolean }>>({});

  const chatModels = models?.filter(m => (m.modelType || 'chat') === 'chat') || [];

  const chipCategories = projectType === 'ig-carousel'
    ? IG_CAROUSEL_CHIPS
    : projectType === 'ig-story'
      ? IG_STORY_CHIPS
      : CHIP_CATEGORIES;

  const checkOverflow = () => {
    const next: Record<string, { left: boolean; right: boolean }> = {};
    scrollRefs.current.forEach((el, label) => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      next[label] = { left, right };
    });
    setOverflowState(next);
  };

  useEffect(() => {
    checkOverflow();
    const ro = new ResizeObserver(() => checkOverflow());
    scrollRefs.current.forEach(el => ro.observe(el));
    return () => ro.disconnect();
  }, [chatModels.length]);

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

  useEffect(() => {
    if (skipInitialChipsSync.current) {
      skipInitialChipsSync.current = false;
      return;
    }
    onActiveChipsChange?.([...activeChips]);
  }, [activeChips]);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    onPromptChange?.(value);
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
      setTimeout(checkOverflow, 350);
    }
  };

  return (
    <div className="space-y-3">
      {chipCategories.map(cat => {
        const ov = overflowState[cat.label] || { left: false, right: false };
        return (
        <div key={cat.label} className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0 w-12 text-right" style={{ color: 'var(--text-500)' }}>
            {cat.label}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => scrollCategory(cat.label, 'left')}
            className="flex-shrink-0 h-6 w-6 rounded-full"
            style={{ color: 'var(--neon-color)', opacity: ov.left ? 1 : 0.2, pointerEvents: ov.left ? 'auto' : 'none' }}
          >
            <ChevronLeft size={14} />
          </Button>
          <div
            ref={el => { if (el) scrollRefs.current.set(cat.label, el); }}
            className="flex gap-1.5 overflow-x-auto scrollbar-hidden flex-1 min-w-0"
            onScroll={checkOverflow}
          >
            {cat.chips.map(chip => {
              const isActive = activeChips.has(chip);
              return isActive ? (
                <Badge
                  key={chip}
                  onClick={() => toggleChip(chip)}
                  className="flex-shrink-0 cursor-pointer text-[11px] font-medium px-2.5 py-1"
                  style={{
                    backgroundColor: 'rgba(var(--neon-rgb), 0.2)',
                    border: '1px solid rgba(var(--neon-rgb), 0.4)',
                    color: 'var(--neon-color)',
                  }}
                >
                  {chip}
                </Badge>
              ) : (
                <Button
                  key={chip}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleChip(chip)}
                  className="flex-shrink-0 text-[11px] font-medium h-auto px-2.5 py-1"
                  style={{
                    backgroundColor: 'var(--bg-200)',
                    borderColor: 'var(--border-300)',
                    color: 'var(--text-500)',
                  }}
                >
                  {chip}
                </Button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => scrollCategory(cat.label, 'right')}
            className="flex-shrink-0 h-6 w-6 rounded-full"
            style={{ color: 'var(--neon-color)', opacity: ov.right ? 1 : 0.2, pointerEvents: ov.right ? 'auto' : 'none' }}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
        );
      })}

      {chatModels.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0 w-12 text-right" style={{ color: 'var(--text-500)' }}>
            Model
          </span>
          <Select value={selectedModelId} onValueChange={onModelChange}>
            <SelectTrigger
              className="flex-1 h-8 text-[11px]"
              style={{
                backgroundColor: 'var(--bg-200)',
                borderColor: 'var(--border-300)',
                color: 'var(--text-100)',
              }}
            >
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {chatModels.map(model => (
                <SelectItem key={model.id} value={model.id} className="text-[11px]">
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            type="text"
            value={prompt}
            onChange={e => handlePromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeChips.size > 0 ? 'Add more details or press Enter to generate...' : 'Describe the HTML you want to generate...'}
            className="text-sm h-10"
            style={{
              backgroundColor: 'var(--bg-100)',
              borderColor: 'var(--border-300)',
              color: 'var(--text-100)',
            }}
            disabled={isGenerating}
          />
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={(!prompt.trim() && activeChips.size === 0) || isGenerating}
          className="h-10 w-10 rounded-xl disabled:opacity-40"
          style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
        >
          {isGenerating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} />
          )}
        </Button>
      </form>
    </div>
  );
};

export default StitchPromptBar;
