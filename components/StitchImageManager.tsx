import React, { useRef, useState } from 'react';
import { Image, Upload, X, Link, Plus } from 'lucide-react';
import { StitchImageRef } from '../types';

interface StitchImageManagerProps {
  images: StitchImageRef[];
  onChange: (images: StitchImageRef[]) => void;
  theme?: 'dark' | 'light';
}

const StitchImageManager: React.FC<StitchImageManagerProps> = ({ images, onChange }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImage = (url: string, label: string, mimeType?: string) => {
    const id = Math.random().toString(36).substring(2, 10);
    const newImage: StitchImageRef = { id, label: label || `image-${images.length + 1}`, url, mimeType };
    onChange([...images, newImage]);
    setUrlInput('');
    setLabelInput('');
  };

  const removeImage = (id: string) => {
    onChange(images.filter(img => img.id !== id));
  };

  const handleUrlAdd = () => {
    if (!urlInput.trim()) return;
    addImage(urlInput.trim(), labelInput.trim());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      const label = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-');
      addImage(dataUri, label, file.type);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const updateLabel = (id: string, newLabel: string) => {
    onChange(images.map(img => img.id === id ? { ...img, label: newLabel } : img));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Image size={12} style={{ color: 'var(--neon-color)' }} />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-300)' }}>
            Image References
          </span>
          {images.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
              {images.length}
            </span>
          )}
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all duration-200"
            style={{
              backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
              color: 'var(--neon-color)',
              border: '1px solid rgba(var(--neon-rgb), 0.2)',
            }}
          >
            <Plus size={10} />
            Add
          </button>
        )}
      </div>

      {isAdding && (
        <div
          className="rounded-xl p-3 mb-2 space-y-2"
          style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)' }}
        >
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste image URL..."
                className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none"
                style={{
                  backgroundColor: 'var(--bg-200)',
                  border: '1px solid var(--border-300)',
                  color: 'var(--text-100)',
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUrlAdd(); }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Label (e.g. hero-photo)"
              className="flex-1 px-3 py-1.5 rounded-lg text-[11px] outline-none"
              style={{
                backgroundColor: 'var(--bg-200)',
                border: '1px solid var(--border-300)',
                color: 'var(--text-100)',
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUrlAdd}
              disabled={!urlInput.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-30"
              style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
            >
              <Link size={10} />
              Add URL
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
              style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)' }}
            >
              <Upload size={10} />
              Upload File
            </button>
            <button
              onClick={() => { setIsAdding(false); setUrlInput(''); setLabelInput(''); }}
              className="ml-auto text-[11px] font-medium px-2 py-1 rounded-lg transition-colors"
              style={{ color: 'var(--neon-color)', backgroundColor: 'rgba(var(--neon-rgb), 0.1)' }}
            >
              Done
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {images.length > 0 && (
        <div className="space-y-1.5">
          {images.map(img => (
            <div
              key={img.id}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 group/img"
              style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)' }}
            >
              <div
                className="w-8 h-8 rounded-md flex-shrink-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${img.url})`,
                  backgroundColor: 'var(--bg-300)',
                }}
              />
              <input
                type="text"
                value={img.label}
                onChange={(e) => updateLabel(img.id, e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-[11px] font-mono outline-none"
                style={{ color: 'var(--text-300)' }}
              />
              <button
                onClick={() => removeImage(img.id)}
                className="p-1 rounded opacity-0 group-hover/img:opacity-100 transition-opacity"
                style={{ color: '#ef4444' }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && !isAdding && (
        <p className="text-[10px] py-1" style={{ color: 'var(--text-500)' }}>
          No images added. The AI will use placeholder gradients.
        </p>
      )}
    </div>
  );
};

export default StitchImageManager;
