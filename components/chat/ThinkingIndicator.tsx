import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { MathCurveLoader } from '@/components/ui/math-curve-loader';

interface ThinkingIndicatorProps {
  isSearching?: boolean;
  thinkingContent?: string;
}

const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ isSearching, thinkingContent }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-500)' }}>
        <MathCurveLoader size={28} />
        <span className="font-medium">
          {isSearching ? 'Searching the web...' : 'Thinking...'}
        </span>
      </div>
      {thinkingContent && (
        <div
          className="prose dark:prose-invert max-w-none leading-7 text-base italic opacity-70 pl-4 mt-3"
          style={{ borderLeft: '2px solid var(--border-300)' }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, [rehypeKatex, { output: 'mathml' }]]}>
            {thinkingContent}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default ThinkingIndicator;
