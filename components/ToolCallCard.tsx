import React, { useState, useEffect } from 'react';
import { Loader2, Check, X, ChevronDown, ChevronRight, Copy, Eye, Code } from 'lucide-react';
import type { ToolResult } from '../services/agentService';

interface ToolCallCardProps {
  toolCall: ToolResult;
  isRunning?: boolean;
  startTime?: number;
}

const TOOL_LABELS: Record<string, string> = {
  generate_html: 'Generate HTML',
  edit_html: 'Edit HTML',
  generate_spec: 'Generate Spec',
  edit_spec: 'Edit Spec',
  search_library: 'Search Library',
  web_browse: 'Browse URL',
  execute_code: 'Execute Code',
  search_web: 'Web Search',
};

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.substring(0, max) + '...';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall, isRunning, startTime }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const isComplete = !!toolCall.output;
  const isError = !!toolCall.error;
  const label = TOOL_LABELS[toolCall.name] || toolCall.name.replace(/_/g, ' ');
  const isHtmlTool = toolCall.name === 'generate_html' || toolCall.name === 'edit_html';
  const isSpecTool = toolCall.name === 'generate_spec' || toolCall.name === 'edit_spec';

  useEffect(() => {
    if (isRunning && startTime) {
      const interval = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 100);
      return () => clearInterval(interval);
    } else if (isComplete || isError) {
      if (startTime) setElapsed(Date.now() - startTime);
    }
  }, [isRunning, startTime, isComplete, isError]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const outputPreview = (() => {
    if (!toolCall.output) return null;
    if (isHtmlTool) {
      try {
        const parsed = JSON.parse(toolCall.output);
        return parsed.html || toolCall.output;
      } catch {
        return toolCall.output;
      }
    }
    return toolCall.output;
  })();

  return (
    <div
      className="rounded-lg overflow-hidden transition-all duration-200"
      style={{
        backgroundColor: isError
          ? 'rgba(239, 68, 68, 0.08)'
          : isComplete
            ? 'rgba(74, 222, 128, 0.06)'
            : 'rgba(var(--neon-rgb), 0.06)',
        border: `1px solid ${isError ? 'rgba(239, 68, 68, 0.2)' : isComplete ? 'rgba(74, 222, 128, 0.15)' : 'var(--border-300)'}`,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        {isRunning && !isComplete && !isError ? (
          <Loader2 size={10} className="animate-spin flex-shrink-0" style={{ color: 'var(--neon-color)' }} />
        ) : isError ? (
          <X size={10} className="flex-shrink-0" style={{ color: '#ef4444' }} />
        ) : (
          <Check size={10} className="flex-shrink-0" style={{ color: '#4ade80' }} />
        )}
        <span className="text-xs font-medium flex-1" style={{ color: isError ? '#ef4444' : isComplete ? '#4ade80' : 'var(--text-200)' }}>
          {label}
        </span>
        {elapsed !== null && (
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-500)' }}>
            {formatDuration(elapsed)}
          </span>
        )}
        {(isComplete || isError) && (
          expanded ? <ChevronDown size={10} style={{ color: 'var(--text-500)' }} /> : <ChevronRight size={10} style={{ color: 'var(--text-500)' }} />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (isComplete || isError) && (
        <div className="px-2.5 pb-2 space-y-1.5">
          {/* Input */}
          {toolCall.input && Object.keys(toolCall.input).length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>Input</span>
              <pre
                className="mt-0.5 text-[10px] leading-relaxed rounded px-2 py-1 overflow-x-auto max-h-24 overflow-y-auto"
                style={{
                  backgroundColor: 'var(--bg-200)',
                  color: 'var(--text-300)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}

          {/* Output */}
          {isError ? (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#ef4444' }}>Error</span>
              <p className="mt-0.5 text-[10px] leading-relaxed" style={{ color: '#fca5a5' }}>{toolCall.error}</p>
            </div>
          ) : outputPreview ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>Output</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopy(toolCall.output); }}
                  className="p-0.5 rounded transition-colors hover:bg-white/[0.05]"
                  style={{ color: copied ? '#4ade80' : 'var(--text-500)' }}
                >
                  <Copy size={9} />
                </button>
              </div>

              {/* Mini HTML preview for HTML tools */}
              {isHtmlTool && outputPreview.length > 200 && (
                <div className="mt-1 rounded overflow-hidden" style={{ border: '1px solid var(--border-300)' }}>
                  <iframe
                    srcDoc={outputPreview.startsWith('<!doctype') || outputPreview.startsWith('<!DOCTYPE') || outputPreview.startsWith('<html')
                      ? outputPreview
                      : undefined}
                    sandbox=""
                    style={{
                      width: '100%',
                      height: '120px',
                      border: '0',
                      pointerEvents: 'none',
                      backgroundColor: 'var(--bg-200)',
                    }}
                    title="Tool output preview"
                  />
                </div>
              )}

              {/* Text output */}
              <pre
                className="mt-1 text-[10px] leading-relaxed rounded px-2 py-1 overflow-x-auto max-h-32 overflow-y-auto"
                style={{
                  backgroundColor: 'var(--bg-200)',
                  color: 'var(--text-300)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {isSpecTool
                  ? truncate(outputPreview, 500)
                  : isHtmlTool
                    ? `${outputPreview.length.toLocaleString()} chars of HTML`
                    : truncate(outputPreview, 300)}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ToolCallCard;
