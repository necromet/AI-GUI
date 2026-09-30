import React, { useRef, useEffect } from 'react';
import type { HarnessMessage, PendingState } from './types';
import { ToolBlock, TaskTreeBlock, QuestionBlock, PermissionBlock, ErrorBlock, TextBlock } from './blocks/HarnessBlocks';

interface HarnessMessageListProps {
  messages: HarnessMessage[];
  pending: PendingState | null;
  onToggleCollapse: (msgId: string, blockIdx: number) => void;
  onQuestionAnswer: (pendingId: string, answer: string) => void;
  onPermissionDecision: (pendingId: string, decision: 'allow' | 'allow_always' | 'deny') => void;
}

export const HarnessMessageList: React.FC<HarnessMessageListProps> = ({
  messages,
  onToggleCollapse,
  onQuestionAnswer,
  onPermissionDecision,
}) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3" style={{ minHeight: 0 }}>
      {messages.map(msg => (
        <div key={msg.id} className="space-y-2">
          {msg.role === 'user' && (
            <div className="flex justify-end">
              <div className="max-w-[85%] px-3 py-2 text-sm rounded-2xl" style={{ backgroundColor: 'var(--neon-color)', color: '#fff', borderBottomRightRadius: 4 }}>
                {msg.content}
              </div>
            </div>
          )}
          {msg.role === 'assistant' && (
            <div className="flex flex-col gap-2">
              {msg.blocks.map((block, idx) => {
                switch (block.type) {
                  case 'text':
                    return <TextBlock key={idx} text={block.text} />;
                  case 'tool_call':
                    return <ToolBlock key={block.id} block={block} onToggleCollapse={() => onToggleCollapse(msg.id, idx)} />;
                  case 'task_tree':
                    return <TaskTreeBlock key={idx} tasks={block.tasks} />;
                  case 'question':
                    return <QuestionBlock key={block.id} block={block} onAnswer={answer => onQuestionAnswer(block.id, answer)} />;
                  case 'permission':
                    return <PermissionBlock key={block.id} block={block} onDecision={decision => onPermissionDecision(block.id, decision)} />;
                  case 'error':
                    return <ErrorBlock key={idx} message={block.message} />;
                  default:
                    return null;
                }
              })}
              {msg.isStreaming && msg.blocks.length === 0 && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-400)' }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--neon-color)' }} />
                  Thinking...
                </div>
              )}
              {msg.usage && (
                <div className="text-[10px] px-1" style={{ color: 'var(--text-400)' }}>
                  {msg.usage.prompt} prompt + {msg.usage.completion} completion = {msg.usage.total} tokens
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};
