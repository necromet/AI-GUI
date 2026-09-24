import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface AgentMarkdownProps {
  content: string;
  msgId: string;
  blockIdx: number;
  collapsedCodeBlocks: Set<string>;
  toggleCodeBlock: (key: string) => void;
  copiedCode: string | null;
  handleCopyCode: (code: string, key: string) => void;
}

export const AgentMarkdown: React.FC<AgentMarkdownProps> = ({
  content, msgId, blockIdx, collapsedCodeBlocks, toggleCodeBlock, copiedCode, handleCopyCode,
}) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children }) => {
          const getCodeString = (c: any): string => {
            if (typeof c === 'string') return c;
            if (c?.props?.children) {
              const ch = c.props.children;
              return Array.isArray(ch) ? ch.map(getCodeString).join('') : getCodeString(ch);
            }
            return '';
          };
          const codeString = getCodeString(children).replace(/\n$/, '');
          const codeNode = (children as any)?.props;
          const language = codeNode?.className?.replace('language-', '') || '';
          const blockKey = `${msgId}-b${blockIdx}-${language}-${codeString.substring(0, 30)}`;
          const isCollapsed = collapsedCodeBlocks.has(blockKey);
          const isCopied = copiedCode === blockKey;
          return (
            <div className="code-block-shell my-2">
              <div className="code-block-toolbar flex items-center justify-between px-3 py-1.5 cursor-pointer" onClick={() => toggleCodeBlock(blockKey)}>
                <div className="flex items-center gap-1.5">
                  {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                  <span className="code-block-language">{language || 'code'}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>{codeString.split('\n').length} lines</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleCopyCode(codeString, blockKey); }} className="code-block-action h-7 w-7 rounded flex items-center justify-center transition-colors" style={{ color: isCopied ? 'var(--neon-color)' : undefined }} title="Copy code">
                  {isCopied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
              {!isCollapsed && (
                <pre className="code-block-content p-3 overflow-auto text-[11px] font-mono" style={{ maxHeight: 300, margin: 0 }}><code>{codeString}</code></pre>
              )}
            </div>
          );
        },
        code: ({ className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          if (match) return <code className={className} {...props}>{children}</code>;
          return <code className="px-1 py-0.5 rounded text-[11px]" style={{ backgroundColor: 'var(--bg-100)', color: 'var(--neon-color)' }} {...props}>{children}</code>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
