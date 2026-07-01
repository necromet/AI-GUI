import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, Trash2, LayoutGrid } from 'lucide-react';
import { StitchProject, StitchBoard, StitchLayout, ModelConfig } from '../types';
import * as db from '../services/databaseAdapter';
import { createNewProject, createNewBoard, stitchProjectToDB, stitchDBToProject } from '../services/stitchService';
import StitchEditor, { StitchControls } from './StitchEditor';

interface StitchPanelProps {
  theme?: 'dark' | 'light';
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  modelConfig?: ModelConfig;
  models?: ModelConfig[];
  onProjectChange?: (project: StitchProject | null) => void;
  onControlsChange?: (controls: StitchControls | null) => void;
  initialProjectId?: string;
}

const LAYOUT_OPTIONS: { value: StitchLayout; label: string; desc: string }[] = [
  { value: '16:9', label: '16:9', desc: 'Landscape' },
  { value: '1:1', label: '1:1', desc: 'Square' },
  { value: '9:16', label: '9:16', desc: 'Portrait' },
];

const StitchPanel: React.FC<StitchPanelProps> = ({ theme = 'dark', onNotification, modelConfig, models, onProjectChange, onControlsChange, initialProjectId }) => {
  const [projects, setProjects] = useState<StitchProject[]>([]);
  const [activeProject, setActiveProject] = useState<StitchProject | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [projectName, setProjectName] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      const dbProjects = await db.getStitchProjects();
      setProjects(dbProjects.map(stitchDBToProject));
    } catch (err) {
      console.error('Failed to load stitch projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (initialProjectId && projects.length > 0 && !activeProject) {
      const project = projects.find(p => p.id === initialProjectId);
      if (project) {
        setActiveProject(project);
        onProjectChange?.(project);
      }
    }
  }, [initialProjectId, projects]);

  useEffect(() => {
    if (!initialProjectId && activeProject) {
      setActiveProject(null);
    }
  }, [initialProjectId]);

  const handleCreateProject = async (layout: StitchLayout) => {
    const title = projectName.trim() || `Project ${Date.now().toString(36).slice(-4)}`;
    const project = createNewProject(title);
    const board = createNewBoard(project.id, layout);
    board.title = 'Board 1';
    project.boards = [board];

    await db.saveStitchProject(stitchProjectToDB(project));
    setProjects(prev => [project, ...prev]);
    setActiveProject(project);
    onProjectChange?.(project);
    setIsCreating(false);
    setProjectName('');
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.deleteStitchProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProject?.id === id) {
      setActiveProject(null);
      onProjectChange?.(null);
    }
  };

  const handleSaveProject = async (project: StitchProject) => {
    project.updatedAt = Date.now();
    await db.saveStitchProject(stitchProjectToDB(project));
    setProjects(prev => prev.map(p => p.id === project.id ? project : p));
  };

  if (activeProject) {
    return (
      <StitchEditor
        project={activeProject}
        theme={theme}
        onNotification={onNotification}
        onBack={() => { setActiveProject(null); onProjectChange?.(null); }}
        onSave={handleSaveProject}
        modelConfig={modelConfig}
        models={models}
        onControlsChange={onControlsChange}
      />
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: 'rgba(var(--neon-rgb), 0.1)', boxShadow: '0 0 20px rgba(var(--neon-rgb), 0.08)' }}>
            <Layers size={22} style={{ color: 'var(--neon-color)' }} />
          </div>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-100)' }}>Stitch</h2>
            <p className="text-xs" style={{ color: 'var(--text-500)' }}>AI-powered HTML generator</p>
          </div>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
          style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <Plus size={16} />
          New Project
        </button>
      </div>

      {isCreating && (
        <div
          className="rounded-2xl border p-6 animate-fade-in"
          style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-100)' }}>Create New Project</h3>
          <div className="mb-4">
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name..."
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
              style={{
                backgroundColor: 'var(--bg-100)',
                border: '1px solid var(--border-300)',
                color: 'var(--text-100)',
              }}
            />
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-500)' }}>Choose a Layout</p>
          <div className="flex gap-3">
            {LAYOUT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleCreateProject(opt.value)}
                className="flex-1 p-4 rounded-xl text-center transition-all duration-200"
                style={{
                  backgroundColor: 'var(--bg-100)',
                  border: '1px solid var(--border-300)',
                  color: 'var(--text-300)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.4)';
                  e.currentTarget.style.backgroundColor = 'rgba(var(--neon-rgb), 0.08)';
                  e.currentTarget.style.color = 'var(--neon-color)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-300)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-100)';
                  e.currentTarget.style.color = 'var(--text-300)';
                }}
              >
                <div className="text-sm font-semibold">{opt.label}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-500)' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsCreating(false)}
            className="mt-4 px-4 py-2 rounded-xl text-sm transition-all duration-200"
            style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)' }}
          >
            Cancel
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-300)', borderTopColor: 'var(--neon-color)' }} />
        </div>
      ) : projects.length === 0 && !isCreating ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}
        >
          <Layers size={48} className="mx-auto mb-4" style={{ color: 'var(--text-500)' }} />
          <p className="text-sm mb-2" style={{ color: 'var(--text-300)' }}>No projects yet</p>
          <p className="text-xs" style={{ color: 'var(--text-500)' }}>Create your first HTML design project to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, idx) => (
            <div
              key={project.id}
              onClick={() => { setActiveProject(project); onProjectChange?.(project); }}
              className="group rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden animate-fade-in"
              style={{
                backgroundColor: 'var(--bg-200)',
                borderColor: 'var(--border-300)',
                opacity: 0,
                animationFillMode: 'forwards',
                animationDelay: `${idx * 60}ms`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(var(--neon-rgb), 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-300)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: 'var(--bg-300)' }}>
                {project.boards[0]?.generatedHtml ? (
                  <iframe
                    className="w-full h-full border-0 pointer-events-none"
                    sandbox=""
                    srcDoc={project.boards[0].generatedHtml}
                    title={project.title}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <LayoutGrid size={32} style={{ color: 'var(--text-500)' }} />
                  </div>
                )}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#f87171' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="absolute bottom-2 left-2">
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff' }}
                  >
                    {project.boards[0]?.layout || '16:9'}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)' }}>
                  {project.title}
                </h3>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[11px]" style={{ color: 'var(--text-500)' }}>
                    {project.boards.length} board{project.boards.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-500)' }}>
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StitchPanel;
