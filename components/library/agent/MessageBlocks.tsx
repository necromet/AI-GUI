import React, { useRef, useEffect, useState } from 'react';
import {
  CheckCircle2, CircleX, MessageSquare,
  Search, Eye, MessageCircleQuestion, Terminal, FilePenLine,
  Trash2, ListTodo, ShieldCheck, FolderOpen, FolderSearch,
  ChevronDown, ChevronRight, Wrench,
} from 'lucide-react';
import { MathCurveLoader } from '@/components/ui/math-curve-loader';
import { Badge } from '@/components/ui/badge';
import { AgentPlan, AgentTask } from '@/components/ui/agent-plan';
import { AgentMarkdown } from './AgentMarkdown';
import type { MessageBlock, AgentMessage } from './types';

const TOOL_ICON_MAP: Record<string, { icon: React.FC<any>; color: string; bg: string }> = {
  search_library:             { icon: Search,                color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  read_component:             { icon: Eye,                   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  ask_user:                   { icon: MessageCircleQuestion, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  execute_code:               { icon: Terminal,              color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  write_component_file:       { icon: FilePenLine,           color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  delete_component_file:      { icon: Trash2,                color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  create_todo_list:           { icon: ListTodo,              color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
  verify_component:           { icon: ShieldCheck,           color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  list_folders:               { icon: FolderOpen,            color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  list_folder_contents:       { icon: FolderSearch,          color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
};

function getToolMeta(name: string) {
  return TOOL_ICON_MAP[name] || { icon: Wrench, color: 'var(--neon-color)', bg: 'rgba(var(--neon-rgb),0.12)' };
}

function formatToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getStatusVisuals(status: string, hasError: boolean) {
  if (hasError) return { color: '#f87171', label: 'error' };
  if (status === 'done') return { color: '#4ade80', label: 'done' };
  return { color: 'var(--neon-color)', label: 'running' };
}

interface ToolCallBlockProps {
  block: Extract<MessageBlock, { type: 'tool_call' }>;
  blockIdx: number;
  msgId: string;
  onToggleCollapse: (msgId: string, blockIdx: number) => void;
}

export const ToolCallBlock: React.FC<ToolCallBlockProps> = ({ block, blockIdx, msgId, onToggleCollapse }) => {
  const status = block.progress ? 'running' : block.result?.error ? 'error' : block.result ? 'done' : 'running';
  const hasError = !!block.result?.error;
  const { color: statusColor, label: statusLabel } = getStatusVisuals(status, hasError);
  const toolMeta = getToolMeta(block.name);
  const ToolIcon = toolMeta.icon;
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!block.collapsed && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    } else {
      setContentHeight(0);
    }
  }, [block.collapsed, block.result]);

  return (
    <div className="flex justify-start animate-block-in">
      <div
        className="max-w-[92%] overflow-hidden"
        style={{
          borderRadius: 12,
          backgroundColor: 'var(--bg-100)',
          border: `1px solid ${status === 'running' ? `${toolMeta.color}40` : 'var(--border-300)'}`,
          boxShadow: status === 'running'
            ? `0 2px 12px ${toolMeta.color}20, 0 0 0 1px ${toolMeta.bg}`
            : `0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px ${toolMeta.bg}`,
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        <div
          className={status === 'running' ? 'animate-tool-shimmer' : ''}
          style={{
            height: 3,
            background: status === 'running'
              ? `linear-gradient(90deg, transparent 0%, ${toolMeta.color}40 25%, ${toolMeta.color} 50%, ${toolMeta.color}40 75%, transparent 100%)`
              : `linear-gradient(90deg, ${toolMeta.color}, ${toolMeta.color}88, transparent)`,
            borderRadius: '12px 12px 0 0',
            backgroundSize: status === 'running' ? '200% 100%' : undefined,
          }}
        />
        <button
          onClick={() => onToggleCollapse(msgId, blockIdx)}
          className="w-full flex items-center gap-2.5 px-3 py-2 transition-all duration-200 hover:opacity-80"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-100)' }}
        >
          <span
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: 26, height: 26, backgroundColor: toolMeta.bg }}
          >
            <ToolIcon size={14} style={{ color: toolMeta.color }} />
          </span>
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-100)', fontFamily: 'var(--font-sans)' }}>
            {formatToolName(block.name)}
          </span>
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            {status === 'running' && <MathCurveLoader size={18} color={toolMeta.color} variant="lemniscate" />}
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0" style={{ backgroundColor: `${toolMeta.color}18`, color: toolMeta.color, borderRadius: 6 }}>
              {statusLabel}
            </Badge>
          </div>
        </button>
        <div
          ref={contentRef}
          className="overflow-hidden transition-all duration-250 ease-out"
          style={{
            maxHeight: block.collapsed || (!block.result && !block.progress) ? 0 : contentHeight ? Math.min(contentHeight, 160) : 160,
            opacity: block.collapsed || (!block.result && !block.progress) ? 0 : 1,
          }}
        >
          {block.result && (
            <div className="px-3 pb-2.5 pt-0 text-[11px] font-mono" style={{ color: block.result.error ? '#f87171' : 'var(--text-500)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 150, overflowY: 'auto' }}>
              {block.result.error || (block.result.output.length > 500 ? block.result.output.substring(0, 500) + '...' : block.result.output)}
            </div>
          )}
          {block.progress && !block.result && (
            <div className="px-3 pb-2.5 pt-0 text-[11px] font-mono" style={{ color: 'var(--text-500)' }}>{block.progress}</div>
          )}
        </div>
      </div>
    </div>
  );
};

interface AgentPlanBlockProps {
  block: Extract<MessageBlock, { type: 'agent_plan' }>;
  taskStatuses: Record<string, string>;
}

export const AgentPlanBlock: React.FC<AgentPlanBlockProps> = ({ block, taskStatuses }) => (
  <div className="flex justify-start animate-block-in">
    <div
      className="max-w-[92%] overflow-hidden"
      style={{
        borderRadius: 12,
        backgroundColor: 'var(--bg-100)',
        border: '1px solid var(--border-300)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(167,139,250,0.08)',
      }}
    >
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg, #a78bfa, #a78bfa88, transparent)',
        borderRadius: '12px 12px 0 0',
      }} />
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <span className="flex items-center justify-center rounded-lg" style={{ width: 22, height: 22, backgroundColor: 'rgba(167,139,250,0.12)' }}>
          <ListTodo size={12} style={{ color: '#a78bfa' }} />
        </span>
        <span className="text-[11px] font-semibold" style={{ color: '#a78bfa', fontFamily: 'var(--font-sans)' }}>Agent Plan</span>
      </div>
      <div className="px-3 pb-2"><AgentPlan tasks={block.tasks} taskStatuses={taskStatuses} /></div>
    </div>
  </div>
);

interface AskUserBlockProps {
  block: Extract<MessageBlock, { type: 'ask_user' }>;
}

export const AskUserBlock: React.FC<AskUserBlockProps> = ({ block }) => (
  <div className="flex justify-start animate-block-in">
    <div
      className="max-w-[92%] overflow-hidden"
      style={{
        borderRadius: 12,
        backgroundColor: 'rgba(var(--neon-rgb), 0.04)',
        border: '1px solid rgba(var(--neon-rgb), 0.12)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg, var(--neon-color), rgba(var(--neon-rgb), 0.4), transparent)',
        borderRadius: '12px 12px 0 0',
      }} />
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-0">
        <span className="flex items-center justify-center rounded-lg" style={{ width: 22, height: 22, backgroundColor: 'rgba(var(--neon-rgb), 0.1)' }}>
          <MessageCircleQuestion size={12} style={{ color: 'var(--neon-color)' }} />
        </span>
        <span className="text-[11px] font-semibold" style={{ color: 'var(--neon-color)', fontFamily: 'var(--font-sans)' }}>Question</span>
      </div>
      <div className="px-3 py-2 text-xs" style={{ color: 'var(--neon-color)' }}>{block.question}</div>
    </div>
  </div>
);

interface TextBlockProps {
  content: string;
  msgId: string;
  blockIdx: number;
  collapsedCodeBlocks: Set<string>;
  toggleCodeBlock: (key: string) => void;
  copiedCode: string | null;
  handleCopyCode: (code: string, key: string) => void;
}

export const TextBlock: React.FC<TextBlockProps> = (props) => (
  <div className="flex justify-start animate-block-in">
    <div className="max-w-[92%] rounded-lg" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', wordBreak: 'break-word' }}>
      <div className="px-3.5 py-2.5 text-sm leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:my-2 [&>ol]:list-decimal [&>ol]:ml-4 [&>li]:mb-1 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mb-2 [&>h1]:mt-3 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mb-2 [&>h2]:mt-3 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mb-1 [&>h3]:mt-2 [&>blockquote]:border-l-2 [&>blockquote]:pl-3 [&>blockquote]:my-2 [&>blockquote]:italic [&>blockquote]:opacity-70" style={{ color: 'var(--text-100)' }}>
        <AgentMarkdown {...props} />
      </div>
    </div>
  </div>
);

interface MessageBubbleProps {
  msg: AgentMessage;
  taskStatuses: Record<string, string>;
  collapsedCodeBlocks: Set<string>;
  toggleCodeBlock: (key: string) => void;
  copiedCode: string | null;
  handleCopyCode: (code: string, key: string) => void;
  onToggleCollapse: (msgId: string, blockIdx: number) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg, taskStatuses, collapsedCodeBlocks, toggleCodeBlock, copiedCode, handleCopyCode, onToggleCollapse,
}) => {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end animate-message-in">
        <div className="max-w-[92%] rounded-xl text-sm leading-relaxed" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--text-100)', wordBreak: 'break-word' }}>
          <div className="px-3.5 py-2.5 whitespace-pre-wrap">{msg.content}</div>
        </div>
      </div>
    );
  }

  if (!msg.blocks || msg.blocks.length === 0) {
    if (msg.isThinking) {
      return (
        <div className="flex justify-start animate-message-in">
          <div className="rounded-xl px-4 py-3 flex items-center gap-2.5" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}>
            <MathCurveLoader size={28} variant="lemniscate" />
            <span className="text-xs" style={{ color: 'var(--text-500)' }}>Thinking...</span>
          </div>
        </div>
      );
    }
    if (msg.content) {
      return (
        <div className="flex justify-start animate-message-in">
          <div className="max-w-[92%] rounded-lg" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', wordBreak: 'break-word' }}>
            <div className="px-3.5 py-2.5 text-sm leading-relaxed" style={{ color: 'var(--text-100)' }}>
              <AgentMarkdown content={msg.content} msgId={msg.id} blockIdx={0} collapsedCodeBlocks={collapsedCodeBlocks} toggleCodeBlock={toggleCodeBlock} copiedCode={copiedCode} handleCopyCode={handleCopyCode} />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-start animate-message-in">
        <div className="max-w-[92%] rounded-lg px-3.5 py-2 text-xs" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', color: 'var(--text-500)' }}>
          No response generated.
        </div>
      </div>
    );
  }

  return (
    <>
      {msg.blocks.map((block, blockIdx) => {
        if (block.type === 'text' && block.content) {
          return <TextBlock key={blockIdx} content={block.content} msgId={msg.id} blockIdx={blockIdx} collapsedCodeBlocks={collapsedCodeBlocks} toggleCodeBlock={toggleCodeBlock} copiedCode={copiedCode} handleCopyCode={handleCopyCode} />;
        }
        if (block.type === 'tool_call') {
          return <ToolCallBlock key={blockIdx} block={block} blockIdx={blockIdx} msgId={msg.id} onToggleCollapse={onToggleCollapse} />;
        }
        if (block.type === 'agent_plan') {
          return <AgentPlanBlock key={blockIdx} block={block} taskStatuses={taskStatuses} />;
        }
        if (block.type === 'ask_user') {
          return <AskUserBlock key={blockIdx} block={block} />;
        }
        return null;
      })}
    </>
  );
};

export const ThinkingIndicator: React.FC = () => (
  <div className="flex justify-start animate-message-in">
    <div className="rounded-xl px-4 py-3 flex items-center gap-2.5" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}>
      <MathCurveLoader size={28} variant="lemniscate" />
      <span className="text-xs" style={{ color: 'var(--text-500)' }}>Thinking...</span>
    </div>
  </div>
);

export const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center py-10 text-center">
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.12), rgba(var(--neon-rgb), 0.04))' }}>
      <MessageSquare size={20} style={{ color: 'var(--neon-color)' }} />
    </div>
    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-300)' }}>Start a conversation</p>
    <p className="text-xs" style={{ color: 'var(--text-500)' }}>Ask the agent to help with your component</p>
  </div>
);
