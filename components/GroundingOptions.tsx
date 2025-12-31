import React from 'react';
import { Search, X } from 'lucide-react';

export interface GroundingOptions {
  enabled: boolean;
}

interface GroundingOptionsProps {
  options: GroundingOptions;
  onOptionsChange: (options: GroundingOptions) => void;
  disabled?: boolean;
}

const GroundingOptions: React.FC<GroundingOptionsProps> = ({ 
  options, 
  onOptionsChange,
  disabled = false 
}) => {
  
  const toggleEnabled = () => {
    onOptionsChange({ ...options, enabled: !options.enabled });
  };

  return (
    <div className="flex items-center px-4 py-2">
      <button
        onClick={toggleEnabled}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border ${
          options.enabled
            ? 'text-black border-transparent'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 border-transparent hover:border-gray-300 dark:hover:border-white/20'
        }`}
        style={options.enabled ? { backgroundColor: 'var(--neon-color)' } : undefined}
        title={options.enabled ? "Disable grounding with Google Search" : "Enable grounding with Google Search"}
        onMouseEnter={(e) => !disabled && !options.enabled && (e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)')}
        onMouseLeave={(e) => !options.enabled && (e.currentTarget.style.borderColor = '')}
      >
        <Search size={14} />
        <span>Ground with Google Search</span>
      </button>
    </div>
  );
};

export default GroundingOptions;
