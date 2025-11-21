import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Sparkles, Zap, MessageSquare } from 'lucide-react';
import { GeminiModel, ModelConfig } from '../types';

interface ModelSelectProps {
  currentModel: string;
  models: ModelConfig[];
  onSelect: (modelId: string) => void;
}

const ModelSelect: React.FC<ModelSelectProps> = ({ currentModel, models, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedConfig = models.find(m => m.id === currentModel) || models[0];

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
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-lg font-semibold text-gray-200 hover:bg-white/5 hover:text-neon-blue transition-all group"
      >
        <span className="group-hover:drop-shadow-[0_0_5px_rgba(0,243,255,0.5)]">{selectedConfig.name}</span>
        <ChevronDown size={16} className={`text-gray-500 group-hover:text-neon-blue transition-all duration-300 ${isOpen ? 'rotate-180' : ''}`} />
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
              <div className={`flex-shrink-0 ${currentModel === model.id ? 'text-neon-purple' : 'text-gray-500'} group-hover:text-neon-purple transition-colors`}>
                {model.isReasoning ? <Sparkles size={24} /> : <Zap size={24} />}
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
                 <div className="ml-auto w-2 h-2 rounded-full bg-neon-blue shadow-[0_0_10px_#00f3ff]"></div>
              )}
              
              {/* Hover glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-neon-purple/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelect;