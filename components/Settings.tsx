import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Plus, Trash2, Monitor, Cpu, MessageSquare, Palette } from 'lucide-react';
import { ModelConfig } from '../types';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  neonColor: string;
  onChangeNeonColor: (color: string) => void;
  models: ModelConfig[];
  onAddModel: (model: ModelConfig) => void;
  onDeleteModel: (id: string) => void;
}

type Tab = 'general' | 'models' | 'theme';

const Settings: React.FC<SettingsProps> = ({ 
  isOpen, 
  onClose, 
  theme, 
  onToggleTheme, 
  neonColor,
  onChangeNeonColor,
  models,
  onAddModel,
  onDeleteModel
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  
  // Form State
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newSystemPrompt, setNewSystemPrompt] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newProvider, setNewProvider] = useState('gemini');

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab('general');
      setNewModelName('');
      setNewModelId('');
      setNewSystemPrompt('');
      setNewApiKey('');
      setNewProvider('gemini');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName || !newModelId) return;

    const newModel: ModelConfig = {
      id: newModelId.trim(), // Allow custom IDs
      name: newModelName.trim(),
      description: "Custom configured model",
      isReasoning: false, // Default to false for custom models
      systemInstruction: newSystemPrompt.trim() || undefined,
      isCustom: true,
      apiKey: newApiKey.trim() || undefined,
      provider: newProvider
    };

    onAddModel(newModel);
    setNewModelName('');
    setNewModelId('');
    setNewSystemPrompt('');
    setNewApiKey('');
    setNewProvider('gemini');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-[#101010] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[600px] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/5">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors text-gray-600 dark:text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-gray-50 dark:bg-transparent border-r border-gray-200 dark:border-white/5 p-2 flex flex-col gap-1">
            <button 
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5 dark:text-gray-400' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5 dark:text-gray-400'}`}
              style={{ backgroundColor: activeTab === 'general' ? 'rgba(var(--neon-rgb), 0.1)' : undefined, color: activeTab === 'general' ? 'var(--neon-color)' : undefined }}
            >
              <Monitor size={16} />
              General
            </button>
            <button 
              onClick={() => setActiveTab('models')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'models' ? 'text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5 dark:text-gray-400' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5 dark:text-gray-400'}`}
              style={{ backgroundColor: activeTab === 'models' ? 'rgba(var(--neon-rgb), 0.1)' : undefined, color: activeTab === 'models' ? 'var(--neon-color)' : undefined }}
            >
              <Cpu size={16} />
              Models
            </button>
            <button 
              onClick={() => setActiveTab('theme')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'theme' ? 'text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5 dark:text-gray-400' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5 dark:text-gray-400'}`}
              style={{ backgroundColor: activeTab === 'theme' ? 'rgba(var(--neon-rgb), 0.1)' : undefined, color: activeTab === 'theme' ? 'var(--neon-color)' : undefined }}
            >
              <Palette size={16} />
              Theme Colors
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-[#050505]">
            
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <section>
                  <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Appearance</h3>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? <Moon size={20} style={{ color: 'var(--neon-color)' }} /> : <Sun size={20} className="text-orange-500" />}
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-200">Theme</div>
                        <div className="text-sm text-gray-500 dark:text-gray-500">
                          {theme === 'dark' ? 'Neon Dark Mode' : 'Light Mode'}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={onToggleTheme}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === 'dark' ? '' : 'bg-gray-300'}`}
                      style={{ backgroundColor: theme === 'dark' ? 'var(--neon-color)' : undefined }}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </section>
              </div>
            )}

            {/* Models Settings */}
            {activeTab === 'models' && (
              <div className="space-y-8">

                {/* Existing Models List */}
                <section>
                  <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Your Models</h3>
                  <div className="space-y-2">
                    {models.map((model) => (
                      <div key={model.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:border-red-400/30 transition-colors group">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            {model.name}
                            {model.isCustom && <span className="text-[10px] bg-red-400/20 text-red-400 px-1.5 py-0.5 rounded border border-red-400/30">CUSTOM</span>}
                            {model.systemInstruction && <span className="text-[10px] bg-red-300/20 text-red-300 px-1.5 py-0.5 rounded border border-red-300/30">SYSTEM PROMPT</span>}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500 font-mono mt-1">{model.id}</div>
                        </div>
                        {model.isCustom && (
                          <button 
                            onClick={() => onDeleteModel(model.id)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* Theme Settings */}
            {activeTab === 'theme' && (
              <div className="space-y-6">
                <section>
                  <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Neon Color Theme</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Choose your neon accent color for the dark theme interface.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'red', name: 'Red', rgb: 'rgb(248, 113, 113)', shadow: '0 0 20px rgba(248, 113, 113, 0.6)' },
                      { id: 'orange', name: 'Orange', rgb: 'rgb(251, 146, 60)', shadow: '0 0 20px rgba(251, 146, 60, 0.6)' },
                      { id: 'yellow', name: 'Yellow', rgb: 'rgb(250, 204, 21)', shadow: '0 0 20px rgba(250, 204, 21, 0.6)' },
                      { id: 'lime', name: 'Lime', rgb: 'rgb(163, 230, 53)', shadow: '0 0 20px rgba(163, 230, 53, 0.6)' },
                      { id: 'green', name: 'Green', rgb: 'rgb(74, 222, 128)', shadow: '0 0 20px rgba(74, 222, 128, 0.6)' },
                      { id: 'cyan', name: 'Cyan', rgb: 'rgb(34, 211, 238)', shadow: '0 0 20px rgba(34, 211, 238, 0.6)' },
                      { id: 'blue', name: 'Blue', rgb: 'rgb(96, 165, 250)', shadow: '0 0 20px rgba(96, 165, 250, 0.6)' },
                      { id: 'indigo', name: 'Indigo', rgb: 'rgb(129, 140, 248)', shadow: '0 0 20px rgba(129, 140, 248, 0.6)' },
                      { id: 'purple', name: 'Purple', rgb: 'rgb(192, 132, 252)', shadow: '0 0 20px rgba(192, 132, 252, 0.6)' },
                      { id: 'pink', name: 'Pink', rgb: 'rgb(244, 114, 182)', shadow: '0 0 20px rgba(244, 114, 182, 0.6)' },
                      { id: 'rose', name: 'Rose', rgb: 'rgb(251, 113, 133)', shadow: '0 0 20px rgba(251, 113, 133, 0.6)' },
                      { id: 'teal', name: 'Teal', rgb: 'rgb(45, 212, 191)', shadow: '0 0 20px rgba(45, 212, 191, 0.6)' },
                    ].map((color) => (
                      <button
                        key={color.id}
                        onClick={() => onChangeNeonColor(color.id)}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          neonColor === color.id
                            ? 'border-white/30 bg-white/10'
                            : 'border-white/5 bg-white/5 hover:border-white/10'
                        }`}
                        style={{
                          boxShadow: neonColor === color.id ? color.shadow : 'none',
                        }}
                      >
                        <div
                          className="w-12 h-12 rounded-full mx-auto mb-3"
                          style={{
                            backgroundColor: color.rgb,
                            boxShadow: color.shadow,
                          }}
                        />
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {color.name}
                        </div>
                        {neonColor === color.id && (
                          <div className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: color.rgb }} />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;