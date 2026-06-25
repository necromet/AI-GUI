import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, MessageSquare, Volume2, Mic, Copy, Wand2, Sparkles } from 'lucide-react';
import { ModelConfig, ModelType } from '../types';

interface ModelSelectProps {
  currentModel: string;
  models: ModelConfig[];
  onSelect: (modelId: string) => void;
  theme?: 'dark' | 'light';
}

const MODEL_TYPE_ICONS: Record<ModelType, React.ComponentType<any>> = {
  'chat': MessageSquare,
  'tts': Volume2,
  'asr': Mic,
  'tts-voiceclone': Copy,
  'tts-voicedesign': Wand2,
};

function getModelIcon(model: ModelConfig): React.ComponentType<any> {
  const t = model.modelType || 'chat';
  return MODEL_TYPE_ICONS[t] || Sparkles;
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

  const tokenPlanModels = models.filter(m => m.provider !== 'mimo-direct');
  const apiKeyModels = models.filter(m => m.provider === 'mimo-direct');

  const renderModel = (model: ModelConfig) => {
    const Icon = getModelIcon(model);
    const isActive = currentModel === model.id;
    return (
      <button
        key={model.id}
        onClick={() => { onSelect(model.id); setIsOpen(false); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-200 group relative"
        style={{
          background: isActive ? (isDark ? 'rgba(var(--neon-rgb), 0.06)' : 'rgba(var(--neon-rgb), 0.06)') : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isActive ? 'rgba(var(--neon-rgb), 0.06)' : 'transparent';
        }}
      >
        <div
          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors duration-200"
          style={{
            background: isActive ? 'rgba(var(--neon-rgb), 0.1)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
            color: isActive ? 'var(--neon-color)' : (isDark ? '#666' : '#999'),
          }}
        >
          <Icon size={13} />
        </div>

        <div className="relative z-10 flex-1 min-w-0">
          <div className={`font-medium text-xs ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} group-hover:text-gray-900 dark:group-hover:text-white transition-colors flex items-center gap-1.5`}>
            {model.name}
            {model.isCustom && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded-md" style={{ background: 'rgba(var(--neon-rgb), 0.1)', color: 'var(--neon-color)', border: '1px solid rgba(var(--neon-rgb), 0.2)' }}>
                CUSTOM
              </span>
            )}
          </div>
        </div>

        {isActive && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--neon-color)', boxShadow: '0 0 6px var(--neon-color)' }} />
        )}

        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ background: isDark ? 'linear-gradient(to right, rgba(var(--neon-rgb), 0.04), transparent)' : 'linear-gradient(to right, rgba(var(--neon-rgb), 0.03), transparent)' }}
        />
      </button>
    );
  };

  const renderSection = (label: string, sectionModels: ModelConfig[]) => {
    if (sectionModels.length === 0) return null;
    return (
      <div key={label}>
        <div className="px-3 pt-2 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isDark ? '#555' : '#aaa' }}>
            {label}
          </span>
        </div>
        {sectionModels.map(renderModel)}
      </div>
    );
  };

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-medium text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all duration-200 group"
      >
        {(() => {
          const Icon = getModelIcon(selectedConfig);
          return (
            <span className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center" style={{ color: 'var(--neon-color)' }}>
              <Icon size={14} />
            </span>
          );
        })()}
        <span className="transition-all duration-200 group-hover:drop-shadow-[0_0_6px_rgba(var(--neon-rgb),0.4)]" style={{ color: 'inherit' }}>
          {selectedConfig.name}
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-500 transition-all duration-300 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: isOpen ? 'var(--neon-color)' : undefined }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-2 w-72 rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-dropdown-in bg-white dark:bg-[#080808] border border-gray-200 dark:border-white/[0.06]"
          style={{
            backdropFilter: 'blur(20px)',
            boxShadow: isDark
              ? '0 20px 60px -15px rgba(0,0,0,0.8), 0 0 40px -10px rgba(var(--neon-rgb), 0.05)'
              : '0 20px 60px -15px rgba(0,0,0,0.15), 0 0 40px -10px rgba(var(--neon-rgb), 0.03)',
            maxHeight: 'calc(4 * 40px + 2 * 32px + 8px)',
            overflowY: 'auto',
          }}
        >
          {renderSection('Token Plan', tokenPlanModels)}
          {renderSection('API Key', apiKeyModels)}
        </div>
      )}
    </div>
  );
};

export default ModelSelect;