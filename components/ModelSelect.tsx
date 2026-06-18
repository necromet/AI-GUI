import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { ModelConfig } from '../types';

interface ModelSelectProps {
  currentModel: string;
  models: ModelConfig[];
  onSelect: (modelId: string) => void;
}

const ModelSelect: React.FC<ModelSelectProps> = ({ currentModel, models, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedConfig = models.find(m => m.id === currentModel) || models[0];

  const getModelIcon = (model: ModelConfig) => {
    return <MessageSquare size={24} />;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-lg font-semibold text-gray-200 hover:bg-white/5 transition-all group"
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--neon-color)';
          const span = e.currentTarget.querySelector('span');
          if (span) (span as HTMLElement).style.filter = 'drop-shadow(0 0 5px rgba(var(--neon-rgb), 0.5))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '';
          const span = e.currentTarget.querySelector('span');
          if (span) (span as HTMLElement).style.filter = '';
        }}
      >
        <span className="transition-all">{selectedConfig.name}</span>
        <ChevronDown 
          size={16} 
          className={`text-gray-500 transition-all duration-300 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: isOpen ? 'var(--neon-color)' : undefined }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--neon-color)'}
          onMouseLeave={(e) => !isOpen && (e.currentTarget.style.color = '')}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 rounded-xl bg-[#0a0a0a] border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] z-50 overflow-hidden py-1 backdrop-blur-xl">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onSelect(model.id);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors group relative"
            >
              <div 
                className={`flex-shrink-0 ${currentModel === model.id ? '' : 'text-gray-500'} transition-colors`} 
                style={{ color: currentModel === model.id ? 'var(--neon-color)' : undefined }}
                onMouseEnter={(e) => {
                  if (currentModel !== model.id) {
                    e.currentTarget.style.color = 'rgba(var(--neon-rgb), 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentModel !== model.id) {
                    e.currentTarget.style.color = '';
                  }
                }}
              >
                {getModelIcon(model)}
              </div>
              <div className="relative z-10 flex-1">
                <div className={`font-medium ${currentModel === model.id ? 'text-white' : 'text-gray-300'} group-hover:text-white transition-colors flex items-center gap-2`}>
                    {model.name}
                    {model.systemInstruction && (
                      <MessageSquare size={12} className="text-neon-blue" />
                    )}
                </div>
                <div className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{model.description}</div>
              </div>
              {currentModel === model.id && (
                 <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--neon-color)', boxShadow: '0 0 10px var(--neon-color)' }}></div>
              )}
              
              {/* Hover glow effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: `linear-gradient(to right, rgba(var(--neon-rgb), 0.1), transparent)` }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelect;