import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { GridComponent, ResolutionConfig, ProjectFile } from './types';
import { SECTION_TYPES, COLORS } from './constants';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlightCode(code: string, lang: 'html' | 'react' | 'tailwind' | 'tsx'): string {
  const escaped = escapeHtml(code);
  if (lang === 'tsx') {
    return escaped
      .replace(/(\/\/.*?)(?=\n|$)/g, '<span class="lc-c">$1</span>')
      .replace(/\b(const|let|var|function|return|export|default|import|from|interface|type|extends|implements|class|if|else|for|while|switch|case|break|continue|new|this|super|throw|try|catch|finally|typeof|instanceof|void|null|undefined|true|false|as|async|await|yield)\b/g, '<span class="lc-t">$1</span>')
      .replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, '<span class="lc-v">$1</span>')
      .replace(/(&lt;\/?)([\w.]+)/g, '<span class="lc-t">$1$2</span>');
  }
  if (lang === 'html' || lang === 'tailwind') {
    return escaped
      .replace(/(&lt;\/?)([\w-]+)/g, '<span class="lc-t">$1$2</span>')
      .replace(/([\w-]+)(=)(&quot;)(.*?)(&quot;)/g, '<span class="lc-a">$1</span>$2<span class="lc-v">$3$4$5</span>')
      .replace(/(&lt;!--.*?--&gt;)/gs, '<span class="lc-c">$1</span>')
      .replace(/(\/&gt;)/g, '<span class="lc-t">$1</span>');
  }
  return escaped
    .replace(/(\/\/.*?)(?=\n|$)/g, '<span class="lc-c">$1</span>')
    .replace(/\b(const|let|var|function|return|export|default|import|from|style)\b/g, '<span class="lc-t">$1</span>')
    .replace(/('(?:[^'\\]|\\.)*')/g, '<span class="lc-v">$1</span>');
}

interface CanvasExportModalProps {
  open: boolean;
  onClose: () => void;
  components: GridComponent[];
  resolution: ResolutionConfig;
  pageTitle: string;
  projectFiles?: ProjectFile[];
}

type ExportTab = 'tsx' | 'html' | 'react' | 'tailwind';

export const CanvasExportModal: React.FC<CanvasExportModalProps> = ({
  open,
  onClose,
  components,
  resolution,
  pageTitle,
  projectFiles = [],
}) => {
  const [activeTab, setActiveTab] = useState<ExportTab>('tsx');
  const [copied, setCopied] = useState(false);
  const [activeFileIdx, setActiveFileIdx] = useState(0);

  const sorted = useMemo(
    () => [...components],
    [components]
  );

  const code = useMemo(() => {
    if (activeTab === 'tsx') {
      if (projectFiles.length === 0) return '// No TSX files generated yet';
      const file = projectFiles[activeFileIdx];
      if (!file) return '// Select a file';
      return file.content;
    }
    if (!sorted.length) return '<!-- Add sections to generate code -->';
    const { cols, cellW } = resolution;

    if (activeTab === 'html') {
      return generateHtml(sorted, cols, cellW, pageTitle);
    } else if (activeTab === 'react') {
      return generateReact(sorted, cols, cellW, pageTitle);
    } else {
      return generateTailwind(sorted, cols, cellW, pageTitle);
    }
  }, [activeTab, sorted, resolution, pageTitle, projectFiles, activeFileIdx]);

  const highlightedCode = useMemo(() => highlightCode(code, activeTab), [code, activeTab]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: { key: ExportTab; label: string }[] = [
    { key: 'tsx', label: 'TSX Codebase' },
    { key: 'html', label: 'HTML + CSS Grid' },
    { key: 'react', label: 'React JSX' },
    { key: 'tailwind', label: 'Tailwind' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-[700px] max-h-[80vh] flex flex-col rounded-2xl"
        style={{ background: 'var(--bg-100)', borderColor: 'var(--border-300)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
            Export Code
          </DialogTitle>
        </DialogHeader>

        <div className="flex border-b" style={{ borderColor: 'var(--border-200)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-3.5 py-2.5 text-[11.5px] font-medium transition-colors border-b-2 cursor-pointer"
              style={{
                color: activeTab === tab.key ? 'var(--neon-color)' : 'var(--text-400)',
                borderBottomColor: activeTab === tab.key ? 'var(--neon-color)' : 'transparent',
                background: 'transparent',
                border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'tsx' && projectFiles.length > 0 && (
          <div className="flex gap-1 px-3.5 py-2 overflow-x-auto border-b" style={{ borderColor: 'var(--border-200)' }}>
            {projectFiles.map((file, idx) => (
              <button
                key={file.path}
                onClick={() => setActiveFileIdx(idx)}
                className="px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap transition-colors cursor-pointer"
                style={{
                  background: activeFileIdx === idx ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--bg-200)',
                  color: activeFileIdx === idx ? 'var(--neon-color)' : 'var(--text-400)',
                  border: activeFileIdx === idx ? '1px solid rgba(var(--neon-rgb), 0.3)' : '1px solid var(--border-300)',
                }}
              >
                {file.path.split('/').pop()}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3.5">
          <pre
            className="rounded-lg p-3.5 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre"
            style={{
              background: 'var(--bg-0)',
              borderColor: 'var(--border-200)',
              color: 'var(--text-300)',
              border: '1px solid var(--border-200)',
            }}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </div>

        <DialogFooter className="flex justify-end gap-1.5 p-2.5 border-t" style={{ borderColor: 'var(--border-200)' }}>
          <Button
            variant="outline"
            onClick={handleCopy}
            className="gap-1.5 cursor-pointer"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            onClick={onClose}
            className="gap-1.5 cursor-pointer"
            style={{ background: 'var(--neon-color)', color: '#000' }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function generateHtml(components: GridComponent[], cols: number, cellW: number, title: string): string {
  let out = `<!-- Canvas — ${cols}-col grid, ${cellW}px cells -->\n\n`;
  out += `<style>\n`;
  out += `  .page { display: grid; grid-template-columns: repeat(${cols}, ${cellW}px); max-width: ${cols * cellW}px; margin: 0 auto; }\n`;
  components.forEach((c) => {
    out += `  .${c.type} { grid-column: ${c.cs} / ${c.ce + 1}; grid-row: ${c.rs} / ${c.re + 1}; }\n`;
  });
  out += `</style>\n\n`;
  out += `<div class="page">\n`;
  components.forEach((c) => {
    const tag = c.type === 'navbar' ? 'nav' : c.type === 'footer' ? 'footer' : 'section';
    out += `  <${tag} class="${c.type}"><!-- cols ${c.cs}–${c.ce} --></${tag}>\n`;
  });
  out += `</div>`;
  return out;
}

function generateReact(components: GridComponent[], cols: number, cellW: number, title: string): string {
  let out = `// Canvas — ${cols}-col grid\n\n`;
  out += `const grid = { display: 'grid', gridTemplateColumns: 'repeat(${cols}, ${cellW}px)', maxWidth: '${cols * cellW}px', margin: '0 auto' };\n\n`;
  components.forEach((c) => {
    const name = c.type.charAt(0).toUpperCase() + c.type.slice(1);
    out += `function ${name}() {\n  return <div style={{ gridColumn: '${c.cs} / ${c.ce + 1}', gridRow: '${c.rs} / ${c.re + 1}' }}>{/* ${c.type} */}</div>;\n}\n\n`;
  });
  out += `export default function Page() {\n  return <div style={grid}>\n`;
  components.forEach((c) => {
    const name = c.type.charAt(0).toUpperCase() + c.type.slice(1);
    out += `    <${name} />\n`;
  });
  out += `  </div>;\n}`;
  return out;
}

function generateTailwind(components: GridComponent[], cols: number, cellW: number, title: string): string {
  let out = `<!-- Tailwind — ${cols}-col grid -->\n\n`;
  out += `<div class="grid grid-cols-${cols} max-w-[${cols * cellW}px] mx-auto">\n`;
  components.forEach((c) => {
    out += `  <section class="[grid-column:${c.cs}/${c.ce + 1}] [grid-row:${c.rs}/${c.re + 1}]"><!-- ${c.type} --></section>\n`;
  });
  out += `</div>`;
  return out;
}
