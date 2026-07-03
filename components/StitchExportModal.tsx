import React, { useState, useCallback } from 'react';
import { Download, Image, FileText, Loader2, Check } from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { StitchProject, StitchBoard } from '../types';
import { getLayoutDimensions } from '../services/stitchService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface StitchExportModalProps {
  project: StitchProject;
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
}

const StitchExportModal: React.FC<StitchExportModalProps> = ({ project, isOpen, onClose, onNotification }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [exported, setExported] = useState(false);

  const isIgContent = project.projectType === 'ig-carousel' || project.projectType === 'ig-story';
  const boardsWithHtml = project.boards.filter(b => b.generatedHtml);

  const renderHtmlToImage = useCallback(async (html: string, board: StitchBoard, format: 'png' | 'jpeg'): Promise<Blob | null> => {
    const dims = getLayoutDimensions(board.layout);

    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-99999px';
    wrapper.style.top = '0';
    wrapper.style.width = `${dims.width}px`;
    wrapper.style.height = `${dims.height}px`;
    wrapper.style.overflow = 'hidden';
    wrapper.style.backgroundColor = '#ffffff';

    const inner = document.createElement('div');
    inner.style.width = `${dims.width}px`;
    inner.style.height = `${dims.height}px`;
    inner.style.position = 'relative';
    inner.style.overflow = 'hidden';

    const shadow = inner.attachShadow({ mode: 'open' });

    const htmlContent = html.replace(/<meta[^>]*viewport[^>]*>/i, '');
    shadow.innerHTML = `
      <style>
        :host { all: initial; display: block; width: ${dims.width}px; height: ${dims.height}px; overflow: hidden; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: ${dims.width}px; height: ${dims.height}px; overflow: hidden; }
      </style>
      ${htmlContent}
    `;

    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);

    await new Promise(r => setTimeout(r, 800));

    try {
      const opts = {
        width: dims.width,
        height: dims.height,
        pixelRatio: 1,
        style: {
          transform: 'none',
          transformOrigin: 'top left',
        },
      };

      let dataUrl: string;
      if (format === 'jpeg') {
        dataUrl = await toJpeg(inner, { ...opts, quality: 0.92 });
      } else {
        dataUrl = await toPng(inner, opts);
      }

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      document.body.removeChild(wrapper);
      return blob;
    } catch (err) {
      console.error('Export error:', err);
      document.body.removeChild(wrapper);
      return null;
    }
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSingle = async (board: StitchBoard, idx: number, format: 'png' | 'jpeg') => {
    if (!board.generatedHtml) return;
    setIsExporting(true);
    setExportProgress(`Exporting slide ${idx + 1}...`);
    setProgressPercent(50);

    const blob = await renderHtmlToImage(board.generatedHtml, board, format);
    if (blob) {
      const safeName = project.title.replace(/\s+/g, '-').toLowerCase();
      downloadBlob(blob, `${safeName}-slide-${idx + 1}.${format}`);
      setProgressPercent(100);
      onNotification?.('Export complete', 'success');
    } else {
      onNotification?.('Export failed', 'error');
    }

    setIsExporting(false);
    setExportProgress('');
    setProgressPercent(0);
  };

  const handleExportAll = async (format: 'png' | 'jpeg') => {
    if (boardsWithHtml.length === 0) return;
    setIsExporting(true);
    setExported(false);
    setProgressPercent(0);

    const safeName = project.title.replace(/\s+/g, '-').toLowerCase();
    let successCount = 0;

    for (let i = 0; i < project.boards.length; i++) {
      const b = project.boards[i];
      if (!b.generatedHtml) continue;

      setExportProgress(`Exporting slide ${i + 1} of ${project.boards.length}...`);
      setProgressPercent(Math.round(((i + 1) / project.boards.length) * 100));
      const blob = await renderHtmlToImage(b.generatedHtml, b, format);
      if (blob) {
        downloadBlob(blob, `${safeName}-slide-${i + 1}.${format}`);
        successCount++;
        await new Promise(r => setTimeout(r, 400));
      }
    }

    setIsExporting(false);
    setExportProgress('');
    setProgressPercent(0);
    setExported(true);
    setTimeout(() => setExported(false), 3000);

    if (successCount === boardsWithHtml.length) {
      onNotification?.(`Exported ${successCount} slides`, 'success');
    } else {
      onNotification?.(`Exported ${successCount}/${boardsWithHtml.length} slides`, 'error');
    }
  };

  const handleExportHtml = () => {
    const boards = project.boards.filter(b => b.generatedHtml);
    if (boards.length === 1) {
      const blob = new Blob([boards[0].generatedHtml!], { type: 'text/html' });
      downloadBlob(blob, `${project.title.replace(/\s+/g, '-').toLowerCase()}.html`);
    } else {
      boards.forEach((b, i) => {
        const blob = new Blob([b.generatedHtml!], { type: 'text/html' });
        downloadBlob(blob, `${project.title.replace(/\s+/g, '-').toLowerCase()}-slide-${i + 1}.html`);
      });
    }
    onNotification?.('HTML exported', 'success');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
            Export {isIgContent ? 'for Instagram' : 'HTML'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isIgContent ? (
            <>
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-300)' }}>
                  Export as Images
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleExportAll('png')}
                    disabled={isExporting || boardsWithHtml.length === 0}
                    className="gap-2 rounded-xl text-xs font-medium"
                    style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)', border: '1px solid rgba(var(--neon-rgb), 0.3)' }}
                  >
                    <Image size={14} />
                    All as PNG
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExportAll('jpeg')}
                    disabled={isExporting || boardsWithHtml.length === 0}
                    className="gap-2 rounded-xl text-xs font-medium"
                    style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)', border: '1px solid var(--border-300)' }}
                  >
                    <Image size={14} />
                    All as JPEG
                  </Button>
                </div>
              </div>

              {project.boards.length > 1 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-300)' }}>
                    Export Individual Slides
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {project.boards.map((b, idx) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)' }}
                      >
                        <span className="text-[11px]" style={{ color: b.generatedHtml ? 'var(--text-300)' : 'var(--text-500)' }}>
                          {b.title || `Slide ${idx + 1}`}
                          {!b.generatedHtml && ' (empty)'}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleExportSingle(b, idx, 'png')}
                            disabled={!b.generatedHtml || isExporting}
                            className="px-2 py-1 rounded text-[10px] font-medium h-auto"
                            style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)' }}
                          >
                            PNG
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleExportSingle(b, idx, 'jpeg')}
                            disabled={!b.generatedHtml || isExporting}
                            className="px-2 py-1 rounded text-[10px] font-medium h-auto"
                            style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)' }}
                          >
                            JPEG
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-300)' }}>
              Export as HTML
            </p>
            <Button
              variant="outline"
              onClick={handleExportHtml}
              disabled={boardsWithHtml.length === 0}
              className="w-full gap-2 rounded-xl text-xs font-medium"
              style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)', border: '1px solid var(--border-300)' }}
            >
              <FileText size={14} />
              Download HTML{project.boards.filter(b => b.generatedHtml).length > 1 ? ' (all slides)' : ''}
            </Button>
          </div>

          {isExporting && (
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-2" />
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-100)' }}>
                <Loader2 size={12} className="animate-spin" style={{ color: 'var(--neon-color)' }} />
                <span className="text-[11px]" style={{ color: 'var(--text-300)' }}>{exportProgress}</span>
              </div>
            </div>
          )}
          {exported && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(74, 222, 128, 0.1)' }}>
              <Check size={12} style={{ color: '#4ade80' }} />
              <span className="text-[11px]" style={{ color: '#4ade80' }}>Export complete</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StitchExportModal;
