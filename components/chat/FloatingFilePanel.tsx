import { X, FileText, Download } from 'lucide-react';
import type { Attachment } from '../../types';

interface Props {
  attachment: Attachment | null;
  onClose: () => void;
}

export default function FloatingFilePanel({ attachment, onClose }: Props) {
  if (!attachment) return null;

  const isImage = attachment.mimeType?.startsWith('image/');

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = attachment.data;
    a.download = attachment.name;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[85vh] rounded-xl border shadow-2xl overflow-hidden flex flex-col"
        style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100, #111114)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border-300)' }}
        >
          <div className="flex items-center gap-2">
            <FileText size={14} style={{ color: 'var(--neon-color)' }} />
            <span className="text-xs font-medium truncate max-w-[300px]" style={{ color: 'var(--text-100)' }}>
              {attachment.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-md hover:bg-[var(--bg-200)] transition-colors cursor-pointer"
              style={{ color: 'var(--text-300)' }}
              title="Download"
            >
              <Download size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-[var(--bg-200)] transition-colors cursor-pointer"
              style={{ color: 'var(--text-300)' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isImage ? (
            <img
              src={attachment.data}
              alt={attachment.name}
              className="max-w-full max-h-[70vh] object-contain mx-auto rounded-lg"
            />
          ) : attachment.textContent ? (
            <pre
              className="text-xs whitespace-pre-wrap font-mono p-4 rounded-lg overflow-auto max-h-[70vh]"
              style={{ color: 'var(--text-200)', backgroundColor: 'var(--bg-200)' }}
            >
              {attachment.textContent}
            </pre>
          ) : (
            <div className="text-center py-12">
              <FileText size={32} className="mx-auto mb-3" style={{ color: 'var(--text-500)' }} />
              <p className="text-xs" style={{ color: 'var(--text-500)' }}>
                {attachment.mimeType || 'Unknown file type'} — {attachment.name}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
