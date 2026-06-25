import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Plus, Trash2, Monitor, Cpu, Palette, Shield } from 'lucide-react';
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
  defaultModelId: string;
  onChangeDefaultModel: (id: string) => void;
  maxOutputTokens: number | undefined;
  onChangeMaxOutputTokens: (value: number | undefined) => void;
  fontSize: string;
  onChangeFontSize: (size: string) => void;
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
  onDeleteModel,
  defaultModelId,
  onChangeDefaultModel,
  maxOutputTokens,
  onChangeMaxOutputTokens,
  fontSize,
  onChangeFontSize
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [maxTokensInput, setMaxTokensInput] = useState(maxOutputTokens?.toString() || '');
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newSystemPrompt, setNewSystemPrompt] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newProvider, setNewProvider] = useState('gemini');
  const [newMaxTokens, setNewMaxTokens] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('general');
      setNewModelName('');
      setNewModelId('');
      setNewSystemPrompt('');
      setNewApiKey('');
      setNewProvider('gemini');
      setNewMaxTokens('');
      setMaxTokensInput(maxOutputTokens?.toString() || '');
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName || !newModelId) return;
    const newModel: ModelConfig = {
      id: newModelId.trim(),
      name: newModelName.trim(),
      description: "Custom configured model",
      isReasoning: false,
      systemInstruction: newSystemPrompt.trim() || undefined,
      isCustom: true,
      apiKey: newApiKey.trim() || undefined,
      provider: newProvider,
      maxTokens: newMaxTokens ? parseInt(newMaxTokens, 10) : undefined,
    };
    onAddModel(newModel);
    setNewModelName(''); setNewModelId(''); setNewSystemPrompt(''); setNewApiKey(''); setNewProvider('gemini'); setNewMaxTokens('');
  };

  const tabs: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'general', label: 'General', icon: Monitor },
    { id: 'models', label: 'Models', icon: Cpu },
    { id: 'theme', label: 'Theme', icon: Palette },
  ];

  const resetPassword = () => {
    sessionStorage.removeItem('edward:labs_session');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div
        className={`w-full max-w-2xl bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[600px] border border-gray-300 dark:border-white/[0.06] transition-all duration-300 ${mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        style={{ boxShadow: '0 0 80px -20px rgba(var(--neon-rgb), 0.1), 0 25px 50px -12px rgba(0,0,0,0.5)' }}
      >
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, var(--neon-color), transparent)`, boxShadow: `0 0 20px rgba(var(--neon-rgb), 0.5)` }} />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-300 dark:border-white/[0.06]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-gray-300 dark:border-white/[0.04] p-3 flex flex-col gap-1 bg-gray-50/50 dark:bg-transparent">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={{
                  background: activeTab === id ? 'rgba(var(--neon-rgb), 0.08)' : 'transparent',
                  color: activeTab === id ? 'var(--neon-color)' : undefined,
                  border: activeTab === id ? '1px solid rgba(var(--neon-rgb), 0.12)' : '1px solid transparent',
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* General */}
            {activeTab === 'general' && (
              <div className="space-y-6 animate-fade-in">
                <section>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Appearance</h3>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-gray-300 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? (
                        <Moon size={18} style={{ color: 'var(--neon-color)' }} />
                      ) : (
                        <Sun size={18} className="text-orange-500" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">Theme</div>
                        <div className="text-xs text-gray-500">
                          {theme === 'dark' ? 'Neon Dark Mode' : 'Light Mode'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={onToggleTheme}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                      style={{ backgroundColor: theme === 'dark' ? 'var(--neon-color)' : '#d1d5db' }}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Default Model</h3>
                  <p className="text-xs text-gray-500 mb-3">Choose which model is selected when the app starts.</p>
                  <select
                    value={defaultModelId}
                    onChange={(e) => onChangeDefaultModel(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-white/[0.03] border border-gray-300 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-gray-900 dark:text-white text-sm outline-none transition-all duration-200 focus:border-gray-400 dark:focus:border-white/20"
                  >
                    {models.map((model) => (
                      <option key={model.id} value={model.id} className="bg-white dark:bg-[#0a0a0a]">
                        {model.name}
                      </option>
                    ))}
                  </select>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Output Token Limit</h3>
                  <p className="text-xs text-gray-500 mb-3">Limit the maximum number of tokens in AI responses. Leave empty for no limit.</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={maxTokensInput}
                      onChange={(e) => {
                        setMaxTokensInput(e.target.value);
                        const val = parseInt(e.target.value, 10);
                        onChangeMaxOutputTokens(isNaN(val) || val <= 0 ? undefined : val);
                      }}
                      placeholder="No limit"
                      min="1"
                      max="128000"
                      className="w-48 bg-gray-50 dark:bg-white/[0.03] border border-gray-300 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none text-sm transition-all duration-200 focus:border-gray-400 dark:focus:border-white/20"
                    />
                    <span className="text-xs text-gray-500">tokens</span>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Font Size</h3>
                  <p className="text-xs text-gray-500 mb-3">Adjust the font size across the application.</p>
                  <div className="flex items-center gap-2">
                    {[
                      { id: 'xs', label: 'XS' },
                      { id: 'sm', label: 'SM' },
                      { id: 'base', label: 'Base' },
                      { id: 'lg', label: 'LG' },
                      { id: 'xl', label: 'XL' },
                    ].map((size) => (
                      <button
                        key={size.id}
                        onClick={() => onChangeFontSize(size.id)}
                        className="px-4 py-2 rounded-xl text-xs font-medium border transition-all duration-200"
                        style={{
                          background: fontSize === size.id ? 'rgba(var(--neon-rgb), 0.08)' : 'transparent',
                          borderColor: fontSize === size.id ? 'rgba(var(--neon-rgb), 0.2)' : (theme === 'dark' ? 'rgba(var(--neon-rgb), 0.06)' : 'rgba(0,0,0,0.1)'),
                          color: fontSize === size.id ? 'var(--neon-color)' : undefined,
                        }}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                    <Shield size={14} />
                    Security
                  </h3>
                  <button
                    onClick={resetPassword}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-300 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 transition-all duration-200"
                  >
                    Lock Screen
                  </button>
                  <p className="text-[11px] text-gray-400 mt-2">You'll need to re-enter your password.</p>
                </section>
              </div>
            )}

            {/* Models */}
            {activeTab === 'models' && (
              <div className="space-y-6 animate-fade-in">
                <section>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Your Models</h3>
                  <div className="space-y-2">
                    {models.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-gray-300 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] hover:border-gray-400 dark:hover:border-white/[0.1] transition-all duration-200 group"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            {model.name}
                            {model.isCustom && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(var(--neon-rgb), 0.1)', color: 'var(--neon-color)', border: '1px solid rgba(var(--neon-rgb), 0.2)' }}>
                                CUSTOM
                              </span>
                            )}
                            {model.systemInstruction && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                SYSTEM PROMPT
                              </span>
                            )}
                            {model.maxTokens && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                MAX: {model.maxTokens.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 font-mono mt-1">{model.id}</div>
                        </div>
                        {model.isCustom && (
                          <button
                            onClick={() => onDeleteModel(model.id)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* Theme */}
            {activeTab === 'theme' && (
              <div className="space-y-6 animate-fade-in">
                <section>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 uppercase tracking-wider">Neon Color Theme</h3>
                  <p className="text-xs text-gray-500 mb-6">Choose your neon accent color for the dark theme interface.</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'red', name: 'Red', rgb: 'rgb(248, 113, 113)' },
                      { id: 'orange', name: 'Orange', rgb: 'rgb(251, 146, 60)' },
                      { id: 'yellow', name: 'Yellow', rgb: 'rgb(250, 204, 21)' },
                      { id: 'lime', name: 'Lime', rgb: 'rgb(163, 230, 53)' },
                      { id: 'green', name: 'Green', rgb: 'rgb(74, 222, 128)' },
                      { id: 'cyan', name: 'Cyan', rgb: 'rgb(34, 211, 238)' },
                      { id: 'blue', name: 'Blue', rgb: 'rgb(96, 165, 250)' },
                      { id: 'indigo', name: 'Indigo', rgb: 'rgb(129, 140, 248)' },
                      { id: 'purple', name: 'Purple', rgb: 'rgb(192, 132, 252)' },
                      { id: 'pink', name: 'Pink', rgb: 'rgb(244, 114, 182)' },
                      { id: 'rose', name: 'Rose', rgb: 'rgb(251, 113, 133)' },
                      { id: 'teal', name: 'Teal', rgb: 'rgb(45, 212, 191)' },
                    ].map((color) => {
                      const isActive = neonColor === color.id;
                      return (
                        <button
                          key={color.id}
                          onClick={() => onChangeNeonColor(color.id)}
                          className={`relative p-4 rounded-xl border transition-all duration-300 hover:scale-[1.02] ${
                            isActive
                              ? 'border-gray-300 dark:border-white/20 bg-gray-50 dark:bg-white/[0.06]'
                              : 'border-gray-200 dark:border-white/[0.04] bg-white dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-white/[0.08]'
                          }`}
                          style={{
                            boxShadow: isActive ? `0 0 25px ${color.rgb.replace('rgb', 'rgba').replace(')', ', 0.3)')}` : 'none',
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-full mx-auto mb-2.5 transition-shadow duration-300"
                            style={{
                              backgroundColor: color.rgb,
                              boxShadow: isActive ? `0 0 20px ${color.rgb.replace('rgb', 'rgba').replace(')', ', 0.5)')}` : `0 0 10px ${color.rgb.replace('rgb', 'rgba').replace(')', ', 0.2)')}`,
                            }}
                          />
                          <div className="text-xs font-medium text-gray-900 dark:text-white">{color.name}</div>
                          {isActive && (
                            <div
                              className="absolute top-2 right-2 w-2 h-2 rounded-full"
                              style={{ backgroundColor: color.rgb, boxShadow: `0 0 6px ${color.rgb}` }}
                            />
                          )}
                        </button>
                      );
                    })}
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
