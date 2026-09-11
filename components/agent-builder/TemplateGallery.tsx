import { useState, useEffect } from 'react';
import { FileCode, Clock, Tag, ChevronRight } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  estimatedTime: string;
  tags: string[];
  nodes: any[];
  edges: any[];
}

interface Props {
  onSelect: (template: Template) => void;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  scraping: '#fbbf24',
  ai: '#818cf8',
  data: '#60a5fa',
  workflow: '#ec4899',
  logic: '#fb923c',
};

export default function TemplateGallery({ onSelect, onClose }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/workflows/templates')
      .then(r => r.json())
      .then(data => { setTemplates(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const categories = [...new Set(templates.map(t => t.category))];
  const filtered = selectedCategory ? templates.filter(t => t.category === selectedCategory) : templates;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-[700px] max-h-[80vh] rounded-xl border shadow-2xl overflow-hidden flex flex-col"
        style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100, #111114)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-300)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>Template Gallery</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-500)' }}>Start from a pre-built workflow template</p>
          </div>
          <button onClick={onClose} className="text-xs cursor-pointer" style={{ color: 'var(--text-500)' }}>✕</button>
        </div>

        <div className="flex gap-2 px-6 py-3 border-b" style={{ borderColor: 'var(--border-300)' }}>
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-2 py-1 rounded text-[11px] cursor-pointer transition-colors ${!selectedCategory ? 'font-medium' : ''}`}
            style={{
              backgroundColor: !selectedCategory ? 'var(--neon-color)' : 'var(--bg-200)',
              color: !selectedCategory ? '#000' : 'var(--text-300)',
            }}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="px-2 py-1 rounded text-[11px] cursor-pointer transition-colors capitalize"
              style={{
                backgroundColor: selectedCategory === cat ? (CATEGORY_COLORS[cat] || '#6b7280') + '30' : 'var(--bg-200)',
                color: selectedCategory === cat ? CATEGORY_COLORS[cat] || '#6b7280' : 'var(--text-300)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-xs" style={{ color: 'var(--text-500)' }}>Loading templates...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-xs" style={{ color: 'var(--text-500)' }}>No templates found</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(template => (
                <button
                  key={template.id}
                  onClick={() => onSelect(template)}
                  className="text-left p-4 rounded-lg border transition-all hover:scale-[1.02] cursor-pointer"
                  style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileCode size={14} style={{ color: CATEGORY_COLORS[template.category] || '#6b7280' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>{template.name}</span>
                    </div>
                    <ChevronRight size={12} style={{ color: 'var(--text-500)' }} />
                  </div>
                  <p className="text-[11px] mb-2" style={{ color: 'var(--text-500)' }}>{template.description}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Clock size={10} style={{ color: 'var(--text-500)' }} />
                      <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>{template.estimatedTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Tag size={10} style={{ color: 'var(--text-500)' }} />
                      <span className="text-[10px] capitalize" style={{ color: 'var(--text-500)' }}>{template.difficulty}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>{template.nodes?.length || 0} nodes</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
