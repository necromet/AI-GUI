import React from 'react';
import { Database, FileText, Search, Upload } from 'lucide-react';

interface RAGPanelProps {
  theme?: 'dark' | 'light';
}

const RAGPanel: React.FC<RAGPanelProps> = ({ theme = 'dark' }) => {
  const features = [
    { icon: Upload, label: 'Upload Documents', description: 'Add PDFs, text files, or web pages as knowledge sources' },
    { icon: Search, label: 'Semantic Search', description: 'Query your documents using natural language' },
    { icon: FileText, label: 'Source Citations', description: 'Get answers with references back to source material' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(var(--neon-rgb), 0.1)', boxShadow: '0 0 20px rgba(var(--neon-rgb), 0.08)' }}>
          <Database size={22} style={{ color: 'var(--neon-color)' }} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">RAG</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Retrieval-Augmented Generation</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.04] bg-gray-50 dark:bg-white/[0.02] p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
          Connect your own knowledge base to the AI. Upload documents, and the model will retrieve relevant context before generating responses — grounding answers in your data.
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

      <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-gray-200 dark:border-white/[0.06] text-gray-400 dark:text-gray-600 text-xs">
        <span>Coming soon</span>
      </div>
    </div>
  );
};

export default RAGPanel;
