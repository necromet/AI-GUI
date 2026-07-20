import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Role, Message } from '../types';
import { Paperclip, Pencil, X, Check, UserRound, FlaskConical, FileText, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ThinkingIndicator from './chat/ThinkingIndicator';
import MarkdownRenderer from './chat/MarkdownRenderer';
import SearchCitations from './chat/SearchCitations';
import MessageActions from './chat/MessageActions';

interface ChatMessageProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  onFeedback?: (messageId: string, feedback: 'good' | 'bad') => void;
  onReattach?: (data: string, name: string, mimeType: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  isStreaming?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRegenerate, onFeedback, onReattach, onEdit, isStreaming }) => {
  const isUser = message.role === Role.User;
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const closeAttachment = useCallback(() => setSelectedAttachment(null), []);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(editRef.current.value.length, editRef.current.value.length);
      editRef.current.style.height = 'auto';
      editRef.current.style.height = editRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) setEditContent(message.content);
  }, [message.content, isEditing]);

  const handleStartEdit = () => {
    setEditContent(message.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  const handleSubmitEdit = () => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== message.content && onEdit) {
      onEdit(message.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitEdit();
    }
    if (e.key === 'Escape') handleCancelEdit();
  };

  React.useEffect(() => {
    if (!selectedAttachment) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAttachment();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [selectedAttachment, closeAttachment]);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleFeedback = (type: 'good' | 'bad') => {
    if (onFeedback) onFeedback(message.id, type);
  };

  const handleRegenerate = () => {
    if (onRegenerate) onRegenerate(message.id);
  };

  const showActions = !isUser && !message.isThinking && !message.isSearching;

  return (
    <div className="group w-full animate-message-in">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-3">
        <div className="text-sm font-medium mb-2 select-none flex items-center gap-2" style={{ color: isUser ? 'var(--text-500)' : 'var(--neon-color)' }}>
          {isUser ? <><UserRound size={14} className="opacity-70" /> You</> : <><FlaskConical size={14} className="opacity-80" /> Labs</>}
          {isUser && !isEditing && onEdit && (
            <button
              onClick={handleStartEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--bg-300)]"
              style={{ color: 'var(--text-500)' }}
              title="Edit message"
            >
              <Pencil size={13} />
            </button>
          )}
        </div>

        <div className="relative overflow-hidden">
          {message.isThinking || message.isSearching ? (
            <ThinkingIndicator
              isSearching={message.isSearching}
              thinkingContent={message.thinkingContent}
            />
          ) : isEditing ? (
            <div className="space-y-2">
              <Textarea
                ref={editRef}
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={handleEditKeyDown}
                className="text-base min-h-[120px] resize-y"
                style={{ background: 'var(--bg-200)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
              />
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-7 px-3 text-xs"
                  style={{ color: 'var(--text-500)' }}
                >
                  <X size={13} className="mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitEdit}
                  disabled={!editContent.trim() || editContent.trim() === message.content}
                  className="h-7 px-3 text-xs"
                  style={{ background: 'var(--neon-color)', color: '#000' }}
                >
                  <Check size={13} className="mr-1" />
                  Send
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {message.attachments && message.attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {message.attachments.map((att, idx) => (
                    att.data && att.mimeType?.startsWith('image/') ? (
                      <div key={idx} className="relative group/att">
                        <button
                          onClick={() => setSelectedAttachment(att.data)}
                          className="relative rounded-lg overflow-hidden transition-all duration-200 hover:scale-[1.02] block"
                          style={{ border: '1px solid var(--border-300)' }}
                        >
                          <img
                            src={att.data}
                            alt={att.name}
                            className="max-h-40 max-w-[280px] object-contain"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm px-2 py-1 opacity-0 group-hover/att:opacity-100 transition-opacity">
                            <span className="text-xs text-white truncate block">{att.name}</span>
                          </div>
                        </button>
                        {onReattach && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onReattach(att.data, att.name, att.mimeType);
                            }}
                            className="absolute top-1 right-1 z-10 rounded-full p-1.5 opacity-0 group-hover/att:opacity-100 transition-all duration-200 hover:scale-110"
                            style={{ background: 'var(--bg-400)' }}
                            title="Attach to new message"
                          >
                            <Paperclip size={12} className="text-white" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div
                        key={idx}
                        className="flex items-center gap-2.5 h-10 px-3 rounded-lg transition-all duration-200"
                        style={{ background: 'var(--bg-200)', border: '1px solid var(--border-300)' }}
                      >
                        {(() => {
                          const ext = att.name.split('.').pop()?.toLowerCase();
                          if (ext === 'xlsx' || ext === 'csv') return <Table className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--neon-color)' }} />;
                          return <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--neon-color)' }} />;
                        })()}
                        <span className="text-xs truncate max-w-[180px]" style={{ color: 'var(--text-300)' }}>{att.name}</span>
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-300)', color: 'var(--text-500)' }}>
                          {att.name.split('.').pop()?.toLowerCase() || 'file'}
                        </span>
                      </div>
                    )
                  ))}
                </div>
              )}

              <Dialog open={!!selectedAttachment} onOpenChange={(open) => !open && closeAttachment()}>
                <DialogContent hideCloseButton className="max-w-[90vw] md:max-w-[800px] p-0 border-none bg-transparent shadow-none">
                  <DialogTitle className="sr-only">Image Preview</DialogTitle>
                  <img src={selectedAttachment ?? undefined} alt="Full size preview" className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg" style={{ border: '1px solid var(--border-300)' }} />
                </DialogContent>
              </Dialog>

              <MarkdownRenderer
                content={message.content}
                isStreaming={isStreaming}
                thinkingContent={message.thinkingContent}
                isThinking={message.isThinking}
                isSearching={message.isSearching}
              />

              {showActions && (
                <>
                  <SearchCitations annotations={message.annotations || []} />

                  {message.usageMetadata && (
                    <div className="text-xs mt-3 flex items-center gap-3" style={{ color: 'var(--text-500)' }}>
                      <span title="Total tokens used">
                        <span className="font-bold" style={{ color: 'var(--neon-accent)' }}>
                          {message.usageMetadata.totalTokens.toLocaleString()}
                        </span>
                        {' '}tokens
                      </span>
                      {message.usageMetadata.promptTokens > 0 && (
                        <span title="Input tokens" className="font-semibold" style={{ color: 'var(--neon-accent)' }}>
                          ({message.usageMetadata.promptTokens.toLocaleString()} in
                          {message.usageMetadata.candidatesTokens > 0 && `, ${message.usageMetadata.candidatesTokens.toLocaleString()} out`})
                        </span>
                      )}
                    </div>
                  )}

                  <MessageActions
                    onCopy={handleCopyMessage}
                    onGood={() => handleFeedback('good')}
                    onBad={() => handleFeedback('bad')}
                    onRegenerate={handleRegenerate}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(ChatMessage);
