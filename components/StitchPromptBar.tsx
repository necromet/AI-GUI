import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModelConfig, StitchProjectType } from '../types';

interface StitchPromptBarProps {
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  theme?: 'dark' | 'light';
  models?: ModelConfig[];
  selectedModelId?: string;
  onModelChange?: (id: string) => void;
  initialActiveChips?: string[];
  onActiveChipsChange?: (chips: string[]) => void;
  projectType?: StitchProjectType;
}

const StitchPromptBar: React.FC<StitchPromptBarProps> = ({
  onGenerate,
  isGenerating,
  models,
  selectedModelId,
  onModelChange,
  projectType,
}) => {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const chatModels = models?.filter(m => (m.modelType || 'chat') === 'chat') || [];

  return (
    <div className="w-full max-w-xl mx-auto space-y-3">
      {chatModels.length > 1 && onModelChange && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hidden pb-1">
          {chatModels.map(model => {
            const isActive = model.id === selectedModelId;
            return (
              <button
                key={model.id}
                onClick={() => onModelChange(model.id)}
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 whitespace-nowrap cursor-pointer"
                style={{
                  background: isActive ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--bg-300)',
                  border: `1px solid ${isActive ? 'rgba(var(--neon-rgb), 0.4)' : 'var(--border-300)'}`,
                  color: isActive ? 'var(--neon-color)' : 'var(--text-400)',
                }}
              >
                {model.name || model.id}
              </button>
            );
          })}
        </div>
      )}

      <div
        className="relative rounded-xl overflow-hidden transition-all duration-200"
        style={{
          background: 'var(--bg-200)',
          border: '1px solid var(--border-300)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            projectType === 'ig-carousel'
              ? 'Describe your carousel slide...'
              : projectType === 'ig-story'
                ? 'Describe your story design...'
                : 'Describe your design...'
          }
          rows={2}
          className="w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm outline-none"
          style={{ color: 'var(--text-100)' }}
          disabled={isGenerating}
        />
        <div className="absolute right-2 bottom-2">
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!prompt.trim() || isGenerating}
            className="h-8 w-8 rounded-lg"
            style={{
              background: prompt.trim() && !isGenerating ? 'var(--neon-color)' : 'var(--bg-300)',
              color: '#000',
              opacity: prompt.trim() && !isGenerating ? 1 : 0.5,
            }}
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StitchPromptBar;
