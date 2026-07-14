import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { Copy, Check, Download, Maximize2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export const catppuccinLatte: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': {
    color: '#4c4f69', background: '#eff1f5', textShadow: 'none',
    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
    fontSize: 'var(--app-font-size, 15px)', lineHeight: '1.5',
  },
  'pre[class*="language-"]': {
    color: '#4c4f69', background: '#eff1f5', textShadow: 'none',
    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
    fontSize: 'var(--app-font-size, 15px)', lineHeight: '1.5',
    padding: '1rem', margin: '0', overflow: 'auto',
  },
  'comment': { color: '#7c7f93', fontStyle: 'italic' }, 'prolog': { color: '#7c7f93' },
  'doctype': { color: '#7c7f93' }, 'cdata': { color: '#7c7f93' },
  'punctuation': { color: '#5c5f77' }, 'namespace': { opacity: 0.7 },
  'property': { color: '#1e66f5' }, 'tag': { color: '#d20f39' },
  'constant': { color: '#fe640b' }, 'symbol': { color: '#df8e1d' },
  'deleted': { color: '#d20f39' }, 'boolean': { color: '#fe640b' },
  'number': { color: '#fe640b' }, 'selector': { color: '#40a02b' },
  'attr-name': { color: '#df8e1d' }, 'string': { color: '#40a02b' },
  'char': { color: '#40a02b' }, 'builtin': { color: '#d20f39' },
  'inserted': { color: '#40a02b' }, 'operator': { color: '#04a5e5' },
  'entity': { color: '#df8e1d', cursor: 'help' }, 'url': { color: '#04a5e5' },
  'variable': { color: '#4c4f69' }, 'atrule': { color: '#df8e1d' },
  'attr-value': { color: '#40a02b' }, 'function': { color: '#1e66f5' },
  'class-name': { color: '#df8e1d' }, 'keyword': { color: '#8839ef' },
  'regex': { color: '#ea76cb' }, 'important': { color: '#fe640b', fontWeight: 'bold' },
  'bold': { fontWeight: 'bold' }, 'italic': { fontStyle: 'italic' },
};

export const catppuccinMocha: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': {
    color: '#cdd6f4', background: '#1e1e2e', textShadow: 'none',
    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
    fontSize: 'var(--app-font-size, 15px)', lineHeight: '1.5',
  },
  'pre[class*="language-"]': {
    color: '#cdd6f4', background: '#1e1e2e', textShadow: 'none',
    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
    fontSize: 'var(--app-font-size, 15px)', lineHeight: '1.5',
    padding: '1rem', margin: '0', overflow: 'auto',
  },
  'comment': { color: '#6c7086', fontStyle: 'italic' }, 'prolog': { color: '#6c7086' },
  'doctype': { color: '#6c7086' }, 'cdata': { color: '#6c7086' },
  'punctuation': { color: '#bac2de' }, 'namespace': { opacity: 0.7 },
  'property': { color: '#89b4fa' }, 'tag': { color: '#f38ba8' },
  'constant': { color: '#fab387' }, 'symbol': { color: '#f9e2af' },
  'deleted': { color: '#f38ba8' }, 'boolean': { color: '#fab387' },
  'number': { color: '#fab387' }, 'selector': { color: '#a6e3a1' },
  'attr-name': { color: '#f9e2af' }, 'string': { color: '#a6e3a1' },
  'char': { color: '#a6e3a1' }, 'builtin': { color: '#f38ba8' },
  'inserted': { color: '#a6e3a1' }, 'operator': { color: '#89dceb' },
  'entity': { color: '#f9e2af', cursor: 'help' }, 'url': { color: '#89dceb' },
  'variable': { color: '#cdd6f4' }, 'atrule': { color: '#f9e2af' },
  'attr-value': { color: '#a6e3a1' }, 'function': { color: '#89b4fa' },
  'class-name': { color: '#f9e2af' }, 'keyword': { color: '#cba6f7' },
  'regex': { color: '#f5c2e7' }, 'important': { color: '#fab387', fontWeight: 'bold' },
  'bold': { fontWeight: 'bold' }, 'italic': { fontStyle: 'italic' },
};

export function preprocessMarkdown(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  for (const line of lines) {
    if (line.trim().startsWith('```')) { inCodeBlock = !inCodeBlock; result.push(line); continue; }
    if (inCodeBlock) { result.push(line); continue; }
    const hasWinPath = /(?:[A-Z]:\\|[A-Z]:\/)/i.test(line) && /\\\s/.test(line.replace(/`[^`]*`/g, ''));
    const looksLikePath = /(?:^|\s)[A-Z]:\\(?:Users|Windows|Program|AppData|Documents|Desktop|Downloads|Music|Pictures|Videos|OneDrive|PerfLogs|Recovery|System|Temp|Roaming|Local|LocalLow)/i.test(line);
    if (hasWinPath || looksLikePath) {
      result.push(line.replace(/\\(?=[A-Za-z<>\s]|$)/g, '\\\\'));
      continue;
    }
    result.push(line);
  }
  return result.join('\n');
}

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  thinkingContent?: string;
  isThinking?: boolean;
  isSearching?: boolean;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content, isStreaming, thinkingContent, isThinking, isSearching, className = '',
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleCopyCode = async (code: string, language: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(language);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) { console.error('Failed to copy code:', err); }
  };

  const handleDownloadHtml = (code: string) => {
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'preview.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFullscreenHtml = (code: string) => {
    window.dispatchEvent(new CustomEvent('html-fullscreen', { detail: { code } }));
  };

  return (
    <div
      className={`prose dark:prose-invert max-w-none leading-8 break-words [&>p]:mb-4 [&>ul]:my-4 [&>ul]:space-y-2 [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:pl-0 [&>ol]:my-4 [&>ol]:space-y-2 [&>ol]:list-decimal [&>ol]:ml-10 [&>ol]:pl-0 [&>ul>li]:mb-2 [&>ul>li]:list-item [&>ul>li]:ml-0 [&>ol>li]:mb-2 [&>ol>li]:list-item [&>ol>li]:ml-0 [&>li>ul]:list-disc [&>li>ul]:ml-6 [&>li>ul]:mt-2 [&>li>ul]:pl-0 [&>li>ul>li]:list-item [&>li>ul>li]:ml-0 [&>li>ol]:list-decimal [&>li>ol]:ml-10 [&>li>ol]:mt-2 [&>li>ol]:pl-0 [&>li>ol>li]:list-item [&>li>ol>li]:ml-0 [&>pre]:my-4 [&>blockquote]:my-4 [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-6 [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:mb-3 [&>h2]:mt-5 [&>h3]:text-xl [&>h3]:font-medium [&>h3]:mb-3 [&>h3]:mt-4 [&>table]:my-4 [&>table]:border-collapse [&>table]:w-full [&>table]:text-sm [&>thead]:bg-white/[0.03] [&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:font-semibold [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wider [&>td]:px-4 [&>td]:py-3 [&>tr]:border-b [&>tr]:border-white/[0.04] ${className}`}
      style={{ color: 'var(--text-100)' }}
    >
      {thinkingContent && !isThinking && !isSearching && (
        <Collapsible open={isThinkingExpanded} onOpenChange={setIsThinkingExpanded} className="mb-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center gap-2 text-sm font-medium w-full justify-start" style={{ color: 'var(--text-500)' }}>
              <svg className={`w-3 h-3 transition-transform duration-200 ${isThinkingExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span>Reasoning</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 prose dark:prose-invert max-w-none leading-7 text-base italic opacity-60 pl-4" style={{ borderLeft: '2px solid var(--border-200)' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, [rehypeKatex, { output: 'mathml' }]]}>{thinkingContent}</ReactMarkdown>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeKatex, { output: 'mathml' }]]}
        components={{
          pre: ({ node, children, ...props }) => {
            const getCodeString = (c: any): string => {
              if (typeof c === 'string') return c;
              if (c?.props?.children) {
                const ch = c.props.children;
                if (Array.isArray(ch)) return ch.map(getCodeString).join('');
                return getCodeString(ch);
              }
              return '';
            };
            const codeString = getCodeString(children).replace(/\n$/, '');
            const lines = codeString.split('\n');
            const hasWinPath = /(?:[A-Z]:\\)/i.test(codeString) && codeString.split('\n').length <= 8;
            const codeNode = (node as any)?.children?.[0];
            const isHtmlBlock = codeNode?.properties?.className?.includes('language-html');
            if (isHtmlBlock) return <>{children}</>;
            if (hasWinPath) {
              return (
                <div className="my-4 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-300)' }}>
                  <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--bg-200)' }}>
                    <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-500)' }}>Path</span>
                    <Button variant="ghost" size="sm" onClick={() => handleCopyCode(codeString, 'path')} title="Copy path">
                      {copiedCode === 'path' ? <Check size={12} style={{ color: 'var(--neon-secondary)' }} /> : <Copy size={12} />}
                    </Button>
                  </div>
                  <div className="px-4 py-3" style={{ background: 'var(--bg-100)' }}>
                    {lines.map((line: string, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="select-none text-xs w-4 text-right flex-shrink-0" style={{ color: 'var(--text-500)' }}>{i + 1}</span>
                        <code className="text-sm break-all" style={{ fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace', color: isDark ? '#89b4fa' : '#1e66f5' }}>{line}</code>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <div className="relative my-6 mt-10 rounded-lg transition-all duration-300 min-w-0 max-w-full" style={{ border: '1px solid var(--border-300)' }}>
                <pre {...props} className="neon-code-block-container">{children}</pre>
              </div>
            );
          },
          code: ({ node, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const codeString = String(children).replace(/\n$/, '');
            const isBlock = !match ? codeString.includes('\n') : true;
            const isCopied = copiedCode === language || (!language && copiedCode === 'text');
            const headerBg = isDark ? 'bg-[#1a1a1a]/95' : 'bg-[#dce0e8]/95';
            const blockBg = isDark ? '#1e1e2e' : '#eff1f5';
            const codeTheme = isDark ? catppuccinMocha : catppuccinLatte;

            if (isBlock && language === 'html') {
              return (
                <div className="my-4 rounded-lg overflow-hidden min-w-0 max-w-full" style={{ border: '1px solid var(--border-300)' }}>
                  <div className={`flex items-center justify-between px-4 py-2 ${headerBg} backdrop-blur-sm`}>
                    <span className="text-sm font-mono" style={{ color: 'var(--text-500)', fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' }}>html</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyCode(codeString, 'html')} title="Copy code">
                        {copiedCode === 'html' ? <Check size={13} style={{ color: 'var(--neon-secondary)' }} /> : <Copy size={13} />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownloadHtml(codeString)} title="Download HTML"><Download size={13} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleFullscreenHtml(codeString)} title="Fullscreen"><Maximize2 size={13} /></Button>
                    </div>
                  </div>
                  <SyntaxHighlighter language="html" style={codeTheme} customStyle={{ margin: 0, padding: '1rem', background: blockBg, fontSize: 'var(--app-font-size, 17px)', borderRadius: '0 0 0.5rem 0.5rem', fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' }} codeTagProps={{ style: { fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' } }}>{codeString}</SyntaxHighlighter>
                </div>
              );
            }
            if (isBlock && language) {
              return (
                <>
                  <div className={`absolute -top-0 left-0 right-0 h-10 flex items-center justify-between px-4 ${headerBg} backdrop-blur-sm`}>
                    <span className="text-sm font-mono" style={{ color: 'var(--text-500)', fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' }}>{language}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyCode(codeString, language)} title="Copy code">
                      {isCopied ? <Check size={13} style={{ color: 'var(--neon-secondary)' }} /> : <Copy size={13} />}
                    </Button>
                  </div>
                  <SyntaxHighlighter language={language} style={codeTheme} customStyle={{ margin: 0, padding: '1rem', paddingTop: '1.5rem', background: blockBg, fontSize: 'var(--app-font-size, 15px)', borderRadius: '0.5rem', fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' }} codeTagProps={{ style: { fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' } }}>{codeString}</SyntaxHighlighter>
                </>
              );
            }
            if (isBlock) {
              return (
                <>
                  <div className={`absolute -top-0 left-0 right-0 h-10 flex items-center justify-between px-4 ${headerBg} backdrop-blur-sm`}>
                    <span className="text-sm font-mono" style={{ color: 'var(--text-500)', fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' }}>text</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyCode(codeString, 'text')} title="Copy code">
                      {isCopied ? <Check size={13} style={{ color: 'var(--neon-secondary)' }} /> : <Copy size={13} />}
                    </Button>
                  </div>
                  <pre style={{ margin: 0, padding: '1rem', paddingTop: '1.5rem', background: blockBg, fontSize: 'var(--app-font-size, 15px)', borderRadius: '0.5rem', fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace', color: isDark ? '#cdd6f4' : '#4c4f69', overflow: 'auto' }}>
                    <code style={{ fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' }}>{codeString}</code>
                  </pre>
                </>
              );
            }
            return <code className={className} {...props}>{children}</code>;
          },
          table: ({ node, ...props }) => (<div className="my-4 overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-300)' }}><table className="w-full text-sm border-collapse" {...props} /></div>),
          thead: ({ node, ...props }) => (<thead style={{ background: 'var(--surface-hover)' }} {...props} />),
          tbody: ({ node, ...props }) => (<tbody className="divide-y" style={{ borderColor: 'var(--border-200)' }} {...props} />),
          tr: ({ node, ...props }) => (<tr className="transition-colors" style={{ borderBottom: '1px solid var(--border-200)' }} {...props} />),
          th: ({ node, ...props }) => (<th className="px-4 py-3 text-left font-semibold text-sm uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-300)' }} {...props} />),
          td: ({ node, ...props }) => (<td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-500)' }} {...props} />),
          li: ({ node, ordered, children, ...props }) => (
            <li {...props}>{children}</li>
          ),
          p: ({ node, children, ...props }) => {
            const getTextContent = (n: any): string => {
              if (typeof n === 'string') return n;
              if (typeof n === 'number') return String(n);
              if (n?.props?.children) {
                const c = n.props.children;
                if (Array.isArray(c)) return c.map(getTextContent).join('');
                return getTextContent(c);
              }
              return '';
            };
            const text = getTextContent({ props: { children } });
            const arrowMatch = text.match(/\s*(?:→|->|-->)\s*/g);
            if (arrowMatch && arrowMatch.length >= 2) {
              const steps = text.split(/\s*(?:→|->|-->)\s*/).filter((s: string) => s.trim());
              return (
                <div className="my-5 flex flex-wrap items-center gap-2">
                  {steps.map((step: string, idx: number) => (
                    <React.Fragment key={idx}>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-[1.02]" style={{ border: '1px solid var(--border-300)', background: 'var(--bg-200)', color: 'var(--text-300)' }}>
                        <span className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}>{idx + 1}</span>
                        <span>{step.trim()}</span>
                      </div>
                      {idx < steps.length - 1 && (
                        <svg className="w-4 h-4 flex-shrink-0 opacity-40" viewBox="0 0 24 24" fill="none" stroke="var(--text-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              );
            }
            return <p {...props}>{children}</p>;
          },
        }}
      >
        {preprocessMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
