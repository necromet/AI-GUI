import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface LibraryComponent {
  id: string;
  name: string;
  category: string;
  contentType: string;
  description: string;
  content: string;
  thumbnail?: string;
}

interface CanvasCatalogueCardProps {
  component: LibraryComponent;
  onAdd: () => void;
}

export const CanvasCatalogueCard: React.FC<CanvasCatalogueCardProps> = ({ component, onAdd }) => {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const isHtml = component.contentType === 'html';
  const previewHtml = isHtml ? component.content : null;

  return (
    <div
      ref={cardRef}
      className="rounded-lg overflow-hidden transition-all duration-200 group/card"
      style={{ background: 'var(--bg-200)', border: '1px solid var(--border-300)' }}
    >
      <div className="relative h-[100px] overflow-hidden" style={{ background: 'var(--bg-0)' }}>
        {isVisible && previewHtml ? (
          <iframe
            srcDoc={previewHtml}
            className="w-full h-full border-0 pointer-events-none"
            sandbox=""
            title={component.name}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-500)' }}>
              {component.contentType}
            </span>
          </div>
        )}
        <button
          onClick={onAdd}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all cursor-pointer"
          style={{ background: 'var(--neon-color)', color: '#000' }}
          title="Add to Canvas"
        >
          <Plus size={12} />
        </button>
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-100)' }}>
          {component.name}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full capitalize"
            style={{ background: 'rgba(var(--neon-rgb), 0.08)', color: 'var(--text-400)' }}
          >
            {component.category}
          </span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--bg-300)', color: 'var(--text-500)' }}
          >
            {component.contentType}
          </span>
        </div>
      </div>
    </div>
  );
};
