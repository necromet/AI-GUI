import React from 'react';
import {
  FileCode, Edit3, Trash2, Search, Globe, Terminal, Shield,
  MessageCircleQuestion, ListTodo, FolderOpen, FolderSearch,
  ChevronDown, ChevronRight, Wrench, BookOpen, Eye,
} from 'lucide-react';
import { MathCurveLoader } from '@/components/ui/math-curve-loader';
import type { HarnessBlock } from '../types';

const TOOL_META: Record<string, { icon: React.FC<any>; color: string; bg: string }> = {
  read:          { icon: Eye,           color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  write:         { icon: FileCode,      color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  edit:          { icon: Edit3,         color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  glob:          { icon: Search,        color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  grep:          { icon: Search,        color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
  bash:          { icon: Terminal,      color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  webfetch:      { icon: Globe,         color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  websearch:     { icon: Globe,         color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  memory:        { icon: BookOpen,      color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  skill:         { icon: Shield,        color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  skill_search:  { icon: Search,        color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  task:          { icon: ListTodo,      color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  question:      { icon: MessageCircleQuestion, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  subagent:      { icon: Wrench,        color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
};

function getMeta(name: string) {
  return TOOL_META[name] || { icon: Wrench, color: 'var(--neon-color)', bg: 'rgba(var(--neon-rgb),0.12)' };
}

function formatToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface ToolBlockProps {
  block: Extract<HarnessBlock, { type: 'tool_call' }>;
  onToggleCollapse: () => void;
}

export const ToolBlock: React.FC<ToolBlockProps> = ({ block, onToggleCollapse }) => {
  const meta = getMeta(block.name);
  const Icon = meta.icon;
  const isRunning = block.status === 'running';
  const hasError = block.status === 'error';
  const statusColor = hasError ? '#f87171' : isRunning ? meta.color : '#4ade80';
  const statusLabel = hasError ? 'error' : isRunning ? 'running' : 'done';

  return (
    <div className="flex justify-start animate-block-in">
      <div
        className="max-w-[92%] overflow-hidden"
        style={{
          borderRadius: 12,
          backgroundColor: 'var(--bg-100)',
          border: `1px solid ${isRunning ? meta.color + '40' : 'var(--border-300)'}`,
          boxShadow: isRunning ? `0 2px 12px ${meta.color}20, 0 0 0 1px ${meta.bg}` : `0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px ${meta.bg}`,
          transition: 'border-color 0.3s, box-shadow 0.3s',
        }}
      >
        <div style={{ height: 3, background: isRunning ? `linear-gradient(90deg, transparent, ${meta.color}40, ${meta.color}, ${meta.color}40, transparent)` : `linear-gradient(90deg, ${meta.color}, ${meta.color}88, transparent)`, borderRadius: '12px 12px 0 0', backgroundSize: isRunning ? '200% 100%' : undefined }} className={isRunning ? 'animate-tool-shimmer' : ''} />
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center gap-2.5 px-3 py-2 transition-all hover:opacity-80"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-100)' }}
        >
          <span className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 26, height: 26, backgroundColor: meta.bg }}>
            <Icon size={14} style={{ color: meta.color }} />
          </span>
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-100)' }}>{formatToolName(block.name)}</span>
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            {isRunning && <MathCurveLoader size={18} color={meta.color} variant="lemniscate" />}
            <span className="text-[9px] px-1.5 py-0 rounded-md font-medium" style={{ backgroundColor: meta.color + '18', color: statusColor }}>{statusLabel}</span>
          </div>
        </button>
        {!block.collapsed && (block.output || block.error) && (
          <div className="px-3 pb-2.5 pt-0 text-[11px] font-mono" style={{ color: block.error ? '#f87171' : 'var(--text-500)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 150, overflowY: 'auto' }}>
            {block.error || (block.output && block.output.length > 500 ? block.output.substring(0, 500) + '...' : block.output)}
          </div>
        )}
      </div>
    </div>
  );
};

interface TaskTreeBlockProps {
  tasks: TaskNode[];
}

const statusIcon: Record<string, string> = { done: '✓', in_progress: '●', blocked: '◐', abandoned: '✗' };
const statusColorMap: Record<string, string> = { done: '#4ade80', in_progress: 'var(--neon-color)', blocked: '#fbbf24', abandoned: '#f87171' };

export const TaskTreeBlock: React.FC<TaskTreeBlockProps> = ({ tasks }) => {
  const byParent = new Map<string | null, TaskNode[]>();
  for (const t of tasks) {
    const list = byParent.get(t.parentId) ?? [];
    list.push(t);
    byParent.set(t.parentId, list);
  }

  const render = (parentId: string | null, depth: number): React.ReactNode => {
    const children = byParent.get(parentId) ?? [];
    return children.map(t => (
      <React.Fragment key={t.id}>
        <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 16 }}>
          <span style={{ color: statusColorMap[t.status] || 'var(--text-400)', fontSize: 10, width: 14, textAlign: 'center' }}>
            {statusIcon[t.status] || '○'}
          </span>
          <span className="text-xs font-mono" style={{ color: 'var(--text-300)' }}>{t.id}</span>
          <span className="text-xs" style={{ color: 'var(--text-100)' }}>{t.summary}</span>
        </div>
        {render(t.id, depth + 1)}
      </React.Fragment>
    ));
  };

  return (
    <div className="flex justify-start animate-block-in">
      <div className="max-w-[92%] overflow-hidden p-2.5 rounded-xl" style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)' }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <ListTodo size={12} style={{ color: '#a78bfa' }} />
          <span className="text-[11px] font-semibold" style={{ color: '#a78bfa' }}>Tasks</span>
        </div>
        <div className="space-y-0.5">{render(null, 0)}</div>
      </div>
    </div>
  );
};

interface QuestionBlockProps {
  block: Extract<HarnessBlock, { type: 'question' }>;
  onAnswer: (answer: string) => void;
}

export const QuestionBlock: React.FC<QuestionBlockProps> = ({ block, onAnswer }) => (
  <div className="flex justify-start animate-block-in">
    <div className="max-w-[92%] overflow-hidden p-3 rounded-xl" style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
      <div className="flex items-center gap-2 mb-2">
        <MessageCircleQuestion size={14} style={{ color: '#fbbf24' }} />
        <span className="text-xs font-semibold" style={{ color: '#fbbf24' }}>Question</span>
      </div>
      <p className="text-sm mb-2" style={{ color: 'var(--text-100)' }}>{block.question}</p>
      {block.answered ? (
        <div className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>Answered: {block.answered}</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {(block.options || []).map(opt => (
            <button
              key={opt}
              onClick={() => onAnswer(opt)}
              className="text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-colors hover:scale-[1.02]"
              style={{ backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
            >
              {opt}
            </button>
          ))}
          <input
            placeholder="Type answer..."
            onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { onAnswer(e.currentTarget.value.trim()); e.currentTarget.value = ''; } }}
            className="text-xs px-2 py-1 rounded-lg flex-1 min-w-[100px]"
            style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-100)', border: '1px solid var(--border-300)', outline: 'none' }}
          />
        </div>
      )}
    </div>
  </div>
);

interface PermissionBlockProps {
  block: Extract<HarnessBlock, { type: 'permission' }>;
  onDecision: (decision: 'allow' | 'allow_always' | 'deny') => void;
}

export const PermissionBlock: React.FC<PermissionBlockProps> = ({ block, onDecision }) => (
  <div className="flex justify-start animate-block-in">
    <div className="max-w-[92%] overflow-hidden p-3 rounded-xl" style={{ backgroundColor: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Shield size={14} style={{ color: '#f87171' }} />
        <span className="text-xs font-semibold" style={{ color: '#f87171' }}>Permission Required</span>
      </div>
      <p className="text-sm mb-1" style={{ color: 'var(--text-100)' }}>
        Tool <span className="font-mono font-semibold">{block.tool}</span> requires approval.
      </p>
      {block.pattern && <p className="text-xs mb-2" style={{ color: 'var(--text-400)' }}>Path: {block.pattern}</p>}
      {block.decision ? (
        <div className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: block.decision === 'deny' ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)', color: block.decision === 'deny' ? '#f87171' : '#4ade80' }}>
          {block.decision === 'deny' ? 'Denied' : block.decision === 'allow_always' ? 'Always allowed' : 'Allowed once'}
        </div>
      ) : (
        <div className="flex gap-1.5">
          {(['allow', 'allow_always', 'deny'] as const).map(d => (
            <button
              key={d}
              onClick={() => onDecision(d)}
              className="text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-colors hover:scale-[1.02]"
              style={{
                backgroundColor: d === 'deny' ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)',
                color: d === 'deny' ? '#f87171' : '#4ade80',
                border: `1px solid ${d === 'deny' ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.3)'}`,
              }}
            >
              {d === 'allow' ? 'Allow Once' : d === 'allow_always' ? 'Always Allow' : 'Deny'}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

export const ErrorBlock: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex justify-start animate-block-in">
    <div className="max-w-[92%] px-3 py-2 rounded-xl text-xs font-mono" style={{ backgroundColor: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
      {message}
    </div>
  </div>
);

export const TextBlock: React.FC<{ text: string }> = ({ text }) => {
  if (!text.trim()) return null;
  return (
    <div className="text-sm leading-relaxed" style={{ color: 'var(--text-100)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {text}
    </div>
  );
};
