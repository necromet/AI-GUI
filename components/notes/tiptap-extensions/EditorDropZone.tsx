import React from 'react';
import { Upload, FileIcon } from 'lucide-react';

interface EditorDropZoneProps {
  isDragOver: boolean;
}

export const EditorDropZone: React.FC<EditorDropZoneProps> = ({ isDragOver }) => {
  if (!isDragOver) return null;

  return (
    <div className="tiptap-drop-zone">
      <div
        className="flex flex-col items-center justify-center gap-3 p-8"
        style={{ color: 'var(--neon-color)' }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.15), rgba(var(--neon-rgb), 0.05))',
            boxShadow: '0 0 20px rgba(var(--neon-rgb), 0.1)',
          }}
        >
          <Upload size={24} style={{ color: 'var(--neon-color)' }} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--text-100)' }}>
            Drop image or file here
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-500)' }}>
            Images will be embedded, files inserted as links
          </p>
        </div>
      </div>
    </div>
  );
};
