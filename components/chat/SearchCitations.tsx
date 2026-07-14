import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, Globe, ExternalLink } from 'lucide-react';
import { SearchAnnotation } from '../../types';
import { Card } from '@/components/ui/card';

const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
];

interface SearchCitationsProps {
  annotations: SearchAnnotation[];
}

const SearchCitations: React.FC<SearchCitationsProps> = ({ annotations }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const citations = annotations.filter((a) => a.type === 'url_citation');
  if (citations.length === 0) return null;

  return (
    <div className="mt-5 mb-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <div
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg transition-all duration-300"
          style={{
            border: '1px solid var(--border-300)',
            background: 'var(--bg-200)',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-500)' }} />
          <span className="text-sm font-bold tracking-wide" style={{ color: 'var(--text-300)' }}>
            {citations.length} source{citations.length !== 1 ? 's' : ''} found
          </span>
          {!isExpanded && (
            <div className="flex items-center -space-x-1.5 ml-1">
              {citations.slice(0, 4).map((_, i) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                  style={{
                    background: GRADIENTS[i % GRADIENTS.length],
                    borderColor: 'var(--bg-200)',
                  }}
                />
              ))}
              {citations.length > 4 && (
                <div
                  className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: 'var(--bg-300)',
                    borderColor: 'var(--bg-200)',
                    color: 'var(--text-500)',
                  }}
                >
                  +{citations.length - 4}
                </div>
              )}
            </div>
          )}
          <ChevronDown
            size={14}
            className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-500)' }}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {citations.map((annotation, idx) => (
            <Card
              key={idx}
              className="group flex items-start gap-3.5 px-4 py-3.5 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
              style={{
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              }}
              onClick={() => window.open(annotation.url, '_blank', 'noopener,noreferrer')}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.15)';
                e.currentTarget.style.background = 'var(--surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-300)';
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)';
              }}
            >
              <div
                className="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white mt-0.5"
                style={{ background: GRADIENTS[idx % GRADIENTS.length] }}
              >
                {(annotation.site_name || new URL(annotation.url).hostname.replace('www.', '')).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold transition-colors line-clamp-2 leading-snug tracking-tight" style={{ color: 'var(--text-100)' }}>
                  {annotation.title || annotation.url}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {annotation.logo_url ? (
                    <img src={annotation.logo_url} alt="" className="w-3.5 h-3.5 rounded flex-shrink-0 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <Globe size={11} style={{ color: 'var(--text-500)' }} />
                  )}
                  <span className="text-xs font-medium truncate tracking-wide uppercase" style={{ color: 'var(--text-500)' }}>
                    {annotation.site_name || new URL(annotation.url).hostname.replace('www.', '')}
                  </span>
                  {annotation.publish_time && (
                    <>
                      <span className="text-xs" style={{ color: 'var(--text-500)' }}>&middot;</span>
                      <span className="text-xs truncate" style={{ color: 'var(--text-500)' }}>
                        {annotation.publish_time}
                      </span>
                    </>
                  )}
                </div>
                {annotation.summary && (
                  <div className="text-sm mt-2 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-500)' }}>
                    {annotation.summary}
                  </div>
                )}
              </div>
              <ExternalLink size={13} className="flex-shrink-0 mt-1 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: 'var(--text-500)' }} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchCitations;
