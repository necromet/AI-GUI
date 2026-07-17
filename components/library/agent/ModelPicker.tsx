import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ModelPickerProps {
  models: Array<{ id: string; name: string }>;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({ models, selectedModelId, onModelChange }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-full transition-all flex items-center gap-1 px-2 py-1 h-7 cursor-pointer text-[var(--text-500)] hover:text-[var(--text-300)]">
          <span className="text-xs truncate max-w-[80px]">{models.find(m => m.id === selectedModelId)?.name || 'Model'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-48 p-1" style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)' }}>
        {models.map(m => (
          <button key={m.id} type="button" onClick={() => onModelChange?.(m.id)} className="w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer hover:opacity-80" style={{ color: m.id === selectedModelId ? 'var(--neon-color)' : 'var(--text-300)', backgroundColor: m.id === selectedModelId ? 'rgba(var(--neon-rgb), 0.08)' : 'transparent' }}>
            {m.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
