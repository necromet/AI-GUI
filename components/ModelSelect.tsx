import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, MessageSquare, Sparkles } from 'lucide-react';
import { ModelConfig } from '../types';

interface ModelSelectProps {
  currentModel: string;
  models: ModelConfig[];
  onSelect: (modelId: string) => void;
  theme?: 'dark' | 'light';
}

const ModelSelect: React.FC<ModelSelectProps> = ({ currentModel, models, onSelect, theme = 'dark' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedConfig = models.find(m => m.id === currentModel) || models[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDark = theme === 'dark';

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-lg font-semibold text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all duration-200 group"
      >
        <span className="transition-all duration-200 group-hover:drop-shadow-[0_0_6px_rgba(var(--neon-rgb),0.4)]" style={{ color: 'inherit' }}>
          {selectedConfig.name}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-500 transition-all duration-300 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: isOpen ? 'var(--neon-color)' : undefined }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-2 w-80 rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-dropdown-in bg-white dark:bg-[#080808] border border-gray-200 dark:border-white/[0.06]"
          style={{
            backdropFilter: 'blur(20px)',
            boxShadow: isDark
              ? '0 20px 60px -15px rgba(0,0,0,0.8), 0 0 40px -10px rgba(var(--neon-rgb), 0.05)'
              : '0 20px 60px -15px rgba(0,0,0,0.15), 0 0 40px -10px rgba(var(--neon-rgb), 0.03)',
          }}
        >
          {models.map((model, index) => (
            <button
              key={model.id}
              onClick={() => { onSelect(model.id); setIsOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 group relative"
              style={{
                background: currentModel === model.id ? (isDark ? 'rgba(var(--neon-rgb), 0.06)' : 'rgba(var(--neon-rgb), 0.06)') : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (currentModel !== model.id) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = currentModel === model.id ? 'rgba(var(--neon-rgb), 0.06)' : 'transparent';
              }}
            >
              {/* Icon */}
              <div
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200"
                style={{
                  background: currentModel === model.id ? 'rgba(var(--neon-rgb), 0.1)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                  color: currentModel === model.id ? 'var(--neon-color)' : (isDark ? '#666' : '#999'),
                }}
              >
                <Sparkles size={16} />
              </div>

              {/* Info */}
              <div className="relative z-10 flex-1 min-w-0">
                <div className={`font-medium text-sm ${currentModel === model.id ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} group-hover:text-gray-900 dark:group-hover:text-white transition-colors flex items-center gap-2`}>
                  {model.name}
                  {model.isCustom && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(var(--neon-rgb), 0.1)', color: 'var(--neon-color)', border: '1px solid rgba(var(--neon-rgb), 0.2)' }}>
                      CUSTOM
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors truncate">{model.description}</div>
              </div>

              {/* Active indicator */}
              {currentModel === model.id && (
                <div className="ml-auto w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--neon-color)', boxShadow: '0 0 8px var(--neon-color)' }} />
              )}

              {/* Hover gradient */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: isDark ? 'linear-gradient(to right, rgba(var(--neon-rgb), 0.04), transparent)' : 'linear-gradient(to right, rgba(var(--neon-rgb), 0.03), transparent)' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelect;
