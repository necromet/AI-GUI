import React from 'react';
import { Puzzle, Globe, Code, Wrench } from 'lucide-react';

interface PluginAgentPanelProps {
  theme?: 'dark' | 'light';
}

const PluginAgentPanel: React.FC<PluginAgentPanelProps> = ({ theme = 'dark' }) => {
  const features = [
    { icon: Globe, label: 'Web Browsing', description: 'Search and retrieve live web content during conversations' },
    { icon: Code, label: 'Code Interpreter', description: 'Execute code snippets and return computed results' },
    { icon: Wrench, label: 'Custom Tools', description: 'Define and register your own function-calling tools' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(var(--neon-rgb), 0.1)', boxShadow: '0 0 20px rgba(var(--neon-rgb), 0.08)' }}>
          <Puzzle size={22} style={{ color: 'var(--neon-color)' }} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Plug-in Agent</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tool-augmented AI agent</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.04] bg-gray-50 dark:bg-white/[0.02] p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
          Extend the model with external tools and plugins. The agent can call APIs, browse the web, execute code, and use custom functions to fulfill complex tasks.
        </p>

        <div className="grid gap-3">
          {features.map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-white/[0.04] bg-white dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all duration-200 cursor-default"
            >
              <div className="p-2 rounded-lg" style={{ background: 'rgba(var(--neon-rgb), 0.08)' }}>
                <f.icon size={18} style={{ color: 'var(--neon-color)' }} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{f.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.04] bg-gray-50 dark:bg-white/[0.02] p-6">
        <p className="text-sm text-gray-500 dark:text-gray-500 text-center">
          Tool registration and agent configuration coming soon.
        </p>
      </div>
    </div>
  );
};

export default PluginAgentPanel;
