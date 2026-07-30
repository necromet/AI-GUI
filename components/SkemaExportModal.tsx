import React from 'react';
import { FileText } from 'lucide-react';
import { SkemaProject } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SkemaExportModalProps {
  project: SkemaProject;
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
}

const SkemaExportModal: React.FC<SkemaExportModalProps> = ({ project, isOpen, onClose, onNotification }) => {
  const boardsWithHtml = project.boards.filter(b => b.generatedHtml);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
            Export HTML
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SkemaExportModal;
