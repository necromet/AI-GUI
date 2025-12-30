import React from 'react';
import { Image, X } from 'lucide-react';

export interface ImageGenOptions {
  enabled: boolean;
  aspectRatio: string;
  numberOfImages: number;
}

interface ImageGenerationOptionsProps {
  options: ImageGenOptions;
  onOptionsChange: (options: ImageGenOptions) => void;
  disabled?: boolean;
}

const ASPECT_RATIOS = [
  { value: '1:1', label: 'Square (1:1)', width: 1024, height: 1024 },
  { value: '16:9', label: 'Landscape (16:9)', width: 1792, height: 1024 },
  { value: '9:16', label: 'Portrait (9:16)', width: 1024, height: 1792 },
  { value: '21:9', label: 'Ultra Wide (21:9)', width: 2048, height: 1024 },
  { value: '4:3', label: 'Classic (4:3)', width: 1536, height: 1024 },
  { value: '3:4', label: 'Tall (3:4)', width: 1024, height: 1536 },
];

const ImageGenerationOptions: React.FC<ImageGenerationOptionsProps> = ({ 
  options, 
  onOptionsChange,
  disabled = false 
}) => {
  
  const toggleEnabled = () => {
    onOptionsChange({ ...options, enabled: !options.enabled });
  };

  const handleAspectRatioChange = (aspectRatio: string) => {
    onOptionsChange({ ...options, aspectRatio });
  };

  const handleNumberChange = (numberOfImages: number) => {
    onOptionsChange({ ...options, numberOfImages });
  };

  if (!options.enabled) {
    return (
      <div className="flex items-center px-4 py-2">
        <button
          onClick={toggleEnabled}
          disabled={disabled}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-gray-300 dark:hover:border-white/20"
          title="Enable image generation mode"
          onMouseEnter={(e) => !disabled && (e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
        >
          <Image size={14} />
          <span>Generate Image Mode</span>
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image size={16} className="text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Image Generation</span>
            </div>
            <button
              onClick={toggleEnabled}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-colors"
              title="Disable image generation"
            >
              <X size={16} />
            </button>
          </div>

          {/* Aspect Ratio Selection */}
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
              Aspect Ratio
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.value}
                  onClick={() => handleAspectRatioChange(ratio.value)}
                  className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                    options.aspectRatio === ratio.value
                      ? 'border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-black font-medium'
                      : 'border-gray-200 dark:border-white/20 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-white/40 hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                  style={
                    options.aspectRatio === ratio.value
                      ? {
                          boxShadow: '0 0 10px rgba(var(--neon-rgb), 0.3)',
                          borderColor: 'var(--neon-color)',
                          backgroundColor: 'var(--neon-color)',
                          color: '#000',
                        }
                      : undefined
                  }
                >
                  <div>{ratio.label.split(' ')[0]}</div>
                  <div className="text-[10px] opacity-70">{ratio.value}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Number of Images */}
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
              Number of Images: {options.numberOfImages}
            </label>
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={options.numberOfImages}
              onChange={(e) => handleNumberChange(parseInt(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-white/10"
              style={{
                accentColor: 'var(--neon-color)',
              }}
            />
            <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-500 mt-1">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
            </div>
          </div>

          {/* Info Text */}
          <div className="text-[11px] text-gray-500 dark:text-gray-500 italic">
            Powered by Nano Banana Pro - Multimodal reasoning model
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGenerationOptions;
