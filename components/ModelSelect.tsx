import React from 'react';
import { ChevronDown, MessageSquare, Volume2, Mic, Copy, Wand2, Sparkles } from 'lucide-react';
import { ModelConfig, ModelType } from '../types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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
  const selectedConfig = models.find(m => m.id === currentModel) || models[0];
  const isDark = theme === 'dark';

  const mimoModels = models.filter(m => m.provider === 'mimo');
  const apiKeyModels = models.filter(m => m.provider === 'mimo-direct');
  const deepseekModels = models.filter(m => m.provider === 'deepseek');

  const renderModel = (model: ModelConfig) => {
    const Icon = getModelIcon(model);
    const isActive = currentModel === model.id;
    return (
      <button
        key={model.id}
        onClick={() => onSelect(model.id)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-150 group relative"
        style={{
          background: isActive ? 'var(--bg-300)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isActive ? 'var(--bg-300)' : 'transparent';
        }}
      >
        <div
          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors duration-150"
          style={{
            background: isActive ? 'rgba(var(--neon-rgb), 0.1)' : 'var(--bg-200)',
            color: isActive ? 'var(--neon-color)' : 'var(--text-500)',
          }}
        >
          <Icon size={13} />
        </div>

        <div className="relative z-10 flex-1 min-w-0">
          <div
            className="font-medium text-sm transition-colors flex items-center gap-1.5"
            style={{ color: isActive ? 'var(--text-100)' : 'var(--text-300)' }}
          >
            {model.name}
            {model.isCustom && (
              <Badge
                variant="outline"
                className="text-[10px] font-bold px-1 py-0.5 rounded-md"
                style={{ background: 'rgba(var(--neon-rgb), 0.1)', color: 'var(--neon-color)', borderColor: 'rgba(var(--neon-rgb), 0.12)' }}
              >
                CUSTOM
              </Badge>
            )}
          </div>
        </div>

        {isActive && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--neon-color)' }} />
        )}
      </button>
    );
  };

  const renderSection = (label: string, sectionModels: ModelConfig[], showSeparatorBefore: boolean) => {
    if (sectionModels.length === 0) return null;
    return (
      <div key={label}>
        {showSeparatorBefore && (
          <Separator className="my-1" style={{ backgroundColor: 'var(--border-300)' }} />
        )}
        <div className="px-3 pt-2 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>
            {label}
          </span>
        </div>
        {sectionModels.map(renderModel)}
      </div>
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 px-2 py-1 h-auto rounded-lg text-sm font-medium"
          style={{ color: 'var(--text-100)' }}
        >
          <span className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center" style={{ color: 'var(--neon-color)' }}>
            {(() => {
              const Icon = getModelIcon(selectedConfig);
              return <Icon size={14} />;
            })()}
          </span>
          <span>{selectedConfig.name}</span>
          <ChevronDown size={14} style={{ color: 'var(--text-500)' }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-72 p-1 overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-200)',
          border: '1px solid var(--border-300)',
          boxShadow: isDark ? '0 20px 60px -15px rgba(0,0,0,0.8)' : '0 20px 60px -15px rgba(0,0,0,0.15)',
          maxHeight: 'calc(4 * 40px + 2 * 32px + 8px)',
          overflowY: 'auto',
        }}
      >
        {renderSection('MiMo Token Plan', mimoModels, false)}
        {renderSection('MiMo API Key', apiKeyModels, mimoModels.length > 0)}
        {renderSection('DeepSeek', deepseekModels, (mimoModels.length + apiKeyModels.length) > 0)}
      </PopoverContent>
    </Popover>
  );
};

export default ModelSelect;
