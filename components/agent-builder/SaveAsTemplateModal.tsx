import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { FIELD_STYLES, fieldClasses } from './shared/formStyles';

interface Props {
  workflowId?: string;
  name: string;
  nodes: any[];
  edges: any[];
  onClose: () => void;
}

const CATEGORIES = ['AI', 'Data', 'Workflow', 'Logic', 'Scraping', 'Research', 'Automation'];

export default function SaveAsTemplateModal({ workflowId, name, nodes, edges, onClose }: Props) {
  const [templateName, setTemplateName] = useState(name);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Workflow');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [estimatedTime, setEstimatedTime] = useState('5 min');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const workflowNodes = nodes.map(n => ({
        id: n.id,
        type: n.data?.nodeType || 'agent',
        position: n.position,
        data: n.data,
        label: n.data?.label,
      }));
      const res = await fetch('/api/workflows/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description,
          category,
          difficulty,
          estimatedTime,
          nodes: workflowNodes,
          edges,
          isTemplate: true,
          isPublic: false,
        }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      toast.success('Template saved');
      onClose();
    } catch (err: any) {
      toast.error('Failed to save template: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [templateName, description, category, difficulty, estimatedTime, nodes, edges, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        ref={ref}
        className="rounded-xl border shadow-2xl w-[400px] max-h-[80vh] overflow-y-auto"
        style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100)' }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-300)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>Save as Template</h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-500)' }}>Create a reusable template from this workflow</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={fieldClasses.label} style={FIELD_STYLES.label}>Template Name</label>
            <input
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              className={fieldClasses.input}
              style={FIELD_STYLES.input}
            />
          </div>

          <div>
            <label className={fieldClasses.label} style={FIELD_STYLES.label}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this template do?"
              rows={2}
              className={fieldClasses.textarea}
              style={FIELD_STYLES.input}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={fieldClasses.select}
                style={FIELD_STYLES.input}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Difficulty</label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value)}
                className={fieldClasses.select}
                style={FIELD_STYLES.input}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div>
            <label className={fieldClasses.label} style={FIELD_STYLES.label}>Estimated Time</label>
            <input
              value={estimatedTime}
              onChange={e => setEstimatedTime(e.target.value)}
              placeholder="e.g. 5 min"
              className={fieldClasses.input}
              style={FIELD_STYLES.input}
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border-300)' }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs cursor-pointer"
            style={{ color: 'var(--text-400)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !templateName.trim()}
            className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
