import React, { useState } from 'react';
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MessageActionsProps {
  onCopy: () => void;
  onGood: () => void;
  onBad: () => void;
  onRegenerate?: () => void;
}

const MessageActions: React.FC<MessageActionsProps> = ({ onCopy, onGood, onBad, onRegenerate }) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGood = () => {
    setFeedback('good');
    onGood();
  };

  const handleBad = () => {
    setFeedback('bad');
    onBad();
  };

  return (
    <div className="flex items-center gap-1 mt-3 pb-2 mb-2 opacity-0 group-hover:opacity-100 hover:!opacity-100 transition-all duration-300">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        style={{ color: copied ? 'var(--neon-color)' : 'var(--text-500)' }}
        title={copied ? "Copied!" : "Copy message"}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleGood}
        style={{ color: feedback === 'good' ? 'var(--neon-color)' : 'var(--text-500)' }}
        title="Good response"
      >
        <ThumbsUp size={15} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBad}
        style={{ color: feedback === 'bad' ? 'var(--neon-color)' : 'var(--text-500)' }}
        title="Bad response"
      >
        <ThumbsDown size={15} />
      </Button>
      {onRegenerate && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRegenerate}
          style={{ color: 'var(--text-500)' }}
          title="Regenerate response"
        >
          <RefreshCw size={15} />
        </Button>
      )}
    </div>
  );
};

export default MessageActions;
