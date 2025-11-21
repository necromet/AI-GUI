import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Plus, Trash2, Monitor, Cpu, MessageSquare } from 'lucide-react';
import { ModelConfig } from '../types';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  models: ModelConfig[];
  onAddModel: (model: ModelConfig) => void;
  onDeleteModel: (id: string) => void;
}

type Tab = 'general' | 'models';

const Settings: React.FC<SettingsProps> = ({ 
  isOpen, 
  onClose, 
  theme, 
  onToggleTheme, 
  models,
  onAddModel,
  onDeleteModel
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  
  // Form State
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newSystemPrompt, setNewSystemPrompt] = useState('');

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab('general');
      setNewModelName('');
      setNewModelId('');
      setNewSystemPrompt('');
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
      isCustom: true
    };

    onAddModel(newModel);
    setNewModelName('');
    setNewModelId('');
    setNewSystemPrompt('');
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
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-neon-purple/10 text-neon-purple' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5 dark:text-gray-400'}`}
            >
              <Monitor size={16} />
              General
            </button>
            <button 
              onClick={() => setActiveTab('models')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'models' ? 'bg-neon-purple/10 text-neon-purple' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5 dark:text-gray-400'}`}
            >
              <Cpu size={16} />
              Models
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
                      {theme === 'dark' ? <Moon size={20} className="text-neon-blue" /> : <Sun size={20} className="text-orange-500" />}
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-200">Theme</div>
                        <div className="text-sm text-gray-500 dark:text-gray-500">
                          {theme === 'dark' ? 'Neon Dark Mode' : 'Light Mode'}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={onToggleTheme}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === 'dark' ? 'bg-neon-purple' : 'bg-gray-300'}`}
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
                
                {/* Add New Model */}
                <section className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Add Custom Model</h3>
                  <form onSubmit={handleSaveModel} className="space-y-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">Display Name</label>
                        <input 
                          type="text" 
                          value={newModelName}
                          onChange={(e) => setNewModelName(e.target.value)}
                          placeholder="e.g. My Coding Helper"
                          className="w-full bg-transparent border border-gray-300 dark:border-white/20 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-neon-blue outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">Model ID</label>
                        <input 
                          type="text" 
                          value={newModelId}
                          onChange={(e) => setNewModelId(e.target.value)}
                          placeholder="e.g. gemini-1.5-flash"
                          className="w-full bg-transparent border border-gray-300 dark:border-white/20 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-neon-blue outline-none transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide flex items-center gap-2">
                        <MessageSquare size={12} />
                        System Instructions
                      </label>
                      <textarea 
                        value={newSystemPrompt}
                        onChange={(e) => setNewSystemPrompt(e.target.value)}
                        placeholder="You are an expert programmer who only speaks in Python code..."
                        className="w-full h-24 bg-transparent border border-gray-300 dark:border-white/20 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-neon-blue outline-none transition-colors resize-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button 
                        type="submit"
                        disabled={!newModelName || !newModelId}
                        className="flex items-center gap-2 px-4 py-2 bg-neon-blue/10 hover:bg-neon-blue/20 text-neon-blue border border-neon-blue/50 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus size={16} />
                        Add Model
                      </button>
                    </div>
                  </form>
                </section>

                {/* Existing Models List */}
                <section>
                  <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Your Models</h3>
                  <div className="space-y-2">
                    {models.map((model) => (
                      <div key={model.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:border-neon-purple/30 transition-colors group">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            {model.name}
                            {model.isCustom && <span className="text-[10px] bg-neon-purple/20 text-neon-purple px-1.5 py-0.5 rounded border border-neon-purple/30">CUSTOM</span>}
                            {model.systemInstruction && <span className="text-[10px] bg-neon-blue/20 text-neon-blue px-1.5 py-0.5 rounded border border-neon-blue/30">SYSTEM PROMPT</span>}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;