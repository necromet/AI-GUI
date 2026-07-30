import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, Trash2, LayoutGrid, Globe } from 'lucide-react';
import { SkemaProject, SkemaBoard, SkemaLayout, SkemaProjectType, ModelConfig } from '../types';
import * as db from '../services/apiDatabaseAdapter';
import { createNewProject, createNewBoard, skemaProjectToDB, skemaDBToProject } from '../services/skemaService';
import SkemaEditor, { SkemaControls } from './SkemaEditor';
import { CanvasEditor, CanvasControls } from './canvas';
import { RESOLUTIONS } from './canvas/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface SkemaPanelProps {
  theme?: 'dark' | 'light';
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  modelConfig?: ModelConfig;
  models?: ModelConfig[];
  onProjectChange?: (project: SkemaProject | null) => void;
  onControlsChange?: (controls: SkemaControls | CanvasControls | null) => void;
  initialProjectId?: string;
}

const LAYOUT_OPTIONS: { value: SkemaLayout; label: string; desc: string; category: string }[] = [
  { value: '1:1', label: '1:1', desc: 'Square', category: 'Social' },
  { value: '4:5', label: '4:5', desc: 'IG Feed', category: 'Social' },
  { value: '9:16', label: '9:16', desc: 'Reels/Story', category: 'Social' },
  { value: '1.91:1', label: '1.91:1', desc: 'FB/LinkedIn', category: 'Social' },
  { value: '16:9', label: '16:9', desc: 'Landscape', category: 'Web' },
  { value: '4:3', label: '4:3', desc: 'Tablet', category: 'Web' },
  { value: '3:4', label: '3:4', desc: 'Mobile', category: 'Web' },
  { value: '32:9', label: '32:9', desc: 'Ultrawide', category: 'Web' },
];

const PROJECT_TYPES: { value: SkemaProjectType; label: string; desc: string; icon: React.ReactNode; layout: SkemaLayout; layoutLabel: string }[] = [
  { value: 'canvas', label: 'Canvas', desc: 'Freeform canvas for any visual design', icon: <Globe size={28} />, layout: '16:9', layoutLabel: 'Choose layout' },
];

const SkemaPanel: React.FC<SkemaPanelProps> = ({ theme = 'dark', onNotification, modelConfig, models, onProjectChange, onControlsChange, initialProjectId }) => {
  const [projects, setProjects] = useState<SkemaProject[]>([]);
  const [activeProject, setActiveProject] = useState<SkemaProject | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [selectedType, setSelectedType] = useState<SkemaProjectType | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const dbProjects = await db.getSkemaProjects();
      setProjects(dbProjects.map(skemaDBToProject));
    } catch (err) {
      console.error('Failed to load skema projects:', err);
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

  const handleCreateProject = async (projectType: SkemaProjectType, layout: SkemaLayout) => {
    const title = projectName.trim() || `Project ${Date.now().toString(36).slice(-4)}`;
    const project = createNewProject(title, projectType);

    const board = createNewBoard(project.id, layout);
    board.title = 'Board 1';
    project.boards = [board];

    await db.saveSkemaProject(skemaProjectToDB(project));
    setProjects(prev => [project, ...prev]);
    setActiveProject(project);
    onProjectChange?.(project);
    setIsCreating(false);
    setProjectName('');
    setSelectedType(null);
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.deleteSkemaProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProject?.id === id) {
      setActiveProject(null);
      onProjectChange?.(null);
    }
  };

  const handleSaveProject = async (updatedProject: SkemaProject) => {
    const projectToSave = { ...updatedProject, updatedAt: Date.now() };
    await db.saveSkemaProject(skemaProjectToDB(projectToSave));
    setProjects(prev => prev.map(p => p.id === projectToSave.id ? projectToSave : p));
    setActiveProject(prev => prev?.id === projectToSave.id ? projectToSave : prev);
  };

  const resetCreation = () => {
    setIsCreating(false);
    setSelectedType(null);
    setProjectName('');
  };

  if (activeProject) {
    if (activeProject.projectType === 'canvas') {
      return (
        <CanvasEditor
          project={activeProject}
          theme={theme}
          onNotification={onNotification}
          onSave={handleSaveProject}
          onBack={() => { setActiveProject(null); onProjectChange?.(null); }}
          modelConfig={modelConfig}
          models={models}
          onControlsChange={onControlsChange as any}
        />
      );
    }
    return (
      <SkemaEditor
        project={activeProject}
        theme={theme}
        onNotification={onNotification}
        onSave={handleSaveProject}
        onBack={() => { setActiveProject(null); onProjectChange?.(null); }}
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
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-100)' }}>Skema</h2>
            <p className="text-xs" style={{ color: 'var(--text-500)' }}>AI-powered HTML generator</p>
          </div>
        </div>
        <Button
          onClick={() => setIsCreating(true)}
          className="gap-2 rounded-xl"
          style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
        >
          <Plus size={16} />
          New Project
        </Button>
      </div>

      {isCreating && (
        <Card
          className="rounded-2xl animate-fade-in"
          style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}
        >
          <CardContent className="p-6">
            {!selectedType ? (
              <>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-100)' }}>Create New Project</h3>
                <p className="text-xs mb-4" style={{ color: 'var(--text-500)' }}>What do you want to create?</p>
                <div className="mb-4">
                  <Input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name..."
                    className="rounded-xl"
                    style={{
                      backgroundColor: 'var(--bg-100)',
                      border: '1px solid var(--border-300)',
                      color: 'var(--text-100)',
                    }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {PROJECT_TYPES.map(pt => (
                    <Button
                      key={pt.value}
                      variant="outline"
                      onClick={() => setSelectedType(pt.value)}
                      className="p-5 rounded-xl h-auto flex-col gap-2"
                      style={{
                        backgroundColor: 'var(--bg-100)',
                        borderColor: 'var(--border-300)',
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
                      <div style={{ color: 'var(--neon-color)' }}>{pt.icon}</div>
                      <div className="text-sm font-semibold">{pt.label}</div>
                      <div className="text-[10px] leading-tight" style={{ color: 'var(--text-500)' }}>{pt.desc}</div>
                    </Button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  onClick={resetCreation}
                  className="rounded-xl"
                  style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)' }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedType(null)}
                    className="text-xs h-auto p-0"
                    style={{ color: 'var(--neon-color)' }}
                  >
                    &larr; Back
                  </Button>
                </div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-100)' }}>
                  {PROJECT_TYPES.find(p => p.value === selectedType)?.label}
                </h3>
                <p className="text-xs mb-4" style={{ color: 'var(--text-500)' }}>
                  {PROJECT_TYPES.find(p => p.value === selectedType)?.desc}
                </p>
                <div className="mb-4">
                  <Input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name..."
                    className="rounded-xl"
                    style={{
                      backgroundColor: 'var(--bg-100)',
                      border: '1px solid var(--border-300)',
                      color: 'var(--text-100)',
                    }}
                  />
                </div>

                {selectedType === 'canvas' && (
                  <>
                    <p className="text-xs mb-3" style={{ color: 'var(--text-500)' }}>Choose a Template</p>
                    {[
                      { category: 'Desktop', keys: ['desktop-1080p', 'desktop-1440p', 'desktop-2k', 'desktop-4k', 'macbook-14', 'macbook-16', 'ultrawide'] },
                      { category: 'Mobile', keys: ['tablet', 'mobile'] },
                    ].map(({ category, keys }) => (
                      <div key={category} className="mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-500)' }}>
                          {category}
                        </span>
                        <div className="flex gap-2 flex-wrap">
                          {keys.map(key => {
                            const res = RESOLUTIONS[key as keyof typeof RESOLUTIONS];
                            if (!res) return null;
                            return (
                              <Button
                                key={key}
                                variant="outline"
                                onClick={() => {
                                  const proj = createNewProject(projectName.trim() || `Project ${Date.now().toString(36).slice(-4)}`, 'canvas');
                                  const board = createNewBoard(proj.id, '16:9');
                                  board.title = proj.title;
                                  board.generatedHtml = `__canvas__:${JSON.stringify({ version: '1.0', template: key, components: [], pageTitle: proj.title })}`;
                                  proj.boards = [board];
                                  db.saveSkemaProject(skemaProjectToDB(proj)).then(() => {
                                    setProjects(prev => [proj, ...prev]);
                                    setActiveProject(proj);
                                    onProjectChange?.(proj);
                                    setIsCreating(false);
                                    setProjectName('');
                                    setSelectedType(null);
                                  });
                                }}
                                className="flex-1 min-w-[100px] p-3 rounded-xl h-auto cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--bg-100)',
                                  borderColor: 'var(--border-300)',
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
                                <div className="text-center">
                                  <div className="text-xs font-semibold">{res.label}</div>
                                  <div className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text-500)' }}>{res.width}×{res.height}</div>
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </>
                )}


                <Button
                  variant="secondary"
                  onClick={resetCreation}
                  className="mt-2 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)' }}
                >
                  Cancel
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-300)', borderTopColor: 'var(--neon-color)' }} />
        </div>
      ) : projects.length === 0 && !isCreating ? (
        <Card
          className="rounded-2xl"
          style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}
        >
          <CardContent className="p-12 text-center">
            <Layers size={48} className="mx-auto mb-4" style={{ color: 'var(--text-500)' }} />
            <p className="text-sm mb-2" style={{ color: 'var(--text-300)' }}>No projects yet</p>
            <p className="text-xs" style={{ color: 'var(--text-500)' }}>Create your first HTML design project to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, idx) => (
            <Card
              key={project.id}
              onClick={() => { setActiveProject(project); onProjectChange?.(project); }}
              className="group rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden animate-fade-in"
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    className="h-7 w-7 p-1.5 rounded-lg"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#f87171' }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full border-0"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff' }}
                  >
                    {project.boards[0]?.layout || '16:9'}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SkemaPanel;
