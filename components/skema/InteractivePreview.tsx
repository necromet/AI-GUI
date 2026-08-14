import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { INSPECTOR_SCRIPT } from './inspectorScript';

export interface SelectedElement {
  tag: string;
  id: string | null;
  classes: string | null;
  text: string;
  path: string;
  rect: { top: number; left: number; width: number; height: number };
  styles: Record<string, string>;
  isTextEditable: boolean;
  childCount: number;
}

export interface InteractivePreviewRef {
  sendToInspector: (type: string, data: Record<string, any>) => void;
  getIframe: () => HTMLIFrameElement | null;
}

interface InteractivePreviewProps {
  html: string;
  width: number;
  height: number;
  zoom: number;
  theme?: 'dark' | 'light';
  onElementSelect?: (element: SelectedElement | null) => void;
  onElementHover?: (element: SelectedElement | null) => void;
  onHtmlChange?: (html: string) => void;
  isStreaming?: boolean;
}

const DEBOUNCE_MS = 300;

const InteractivePreview = React.forwardRef<InteractivePreviewRef, InteractivePreviewProps>(
  (
    {
      html,
      width,
      height,
      zoom,
      theme = 'dark',
      onElementSelect,
      onElementHover,
      onHtmlChange,
      isStreaming = false,
    },
    ref,
  ) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const modifiedHtml = useMemo(() => {
      if (!html) return '';
      if (isStreaming) return html;

      const injection = `<script>${INSPECTOR_SCRIPT}<\/script>`;
      if (html.includes('</body>')) {
        return html.replace('</body>', `${injection}</body>`);
      }
      return html + injection;
    }, [html, isStreaming]);

    const sendToInspector = useCallback(
      (action: string, data: Record<string, any>) => {
        const message = '__skema__:' + JSON.stringify({ type: action, data });
        iframeRef.current?.contentWindow?.postMessage(message, '*');
      },
      [],
    );

    React.useImperativeHandle(
      ref,
      () => ({
        sendToInspector,
        getIframe: () => iframeRef.current,
      }),
      [sendToInspector],
    );

    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        const raw = event.data;
        if (typeof raw !== 'string') return;
        if (!raw.startsWith('__skema__:')) return;

        let parsed: { type: string; data: any };
        try {
          parsed = JSON.parse(raw.slice('__skema__:'.length));
        } catch {
          return;
        }

        const { type, data } = parsed;

        switch (type) {
          case 'select':
            onElementSelect?.(data as SelectedElement);
            break;
          case 'deselect':
            onElementSelect?.(null);
            break;
          case 'hover':
            onElementHover?.(data as SelectedElement);
            break;
          case 'mutate': {
            const cleanHtml = data?.html;
            if (cleanHtml && onHtmlChange) {
              if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
              debounceTimerRef.current = setTimeout(() => {
                onHtmlChange(cleanHtml);
              }, DEBOUNCE_MS);
            }
            break;
          }
          case 'ready':
            console.log('[InteractivePreview] Inspector ready');
            break;
          default:
            break;
        }
      };

      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      };
    }, [onElementSelect, onElementHover, onHtmlChange]);

    if (!html) return null;

    return (
      <div
        style={{
          width: `${width}px`,
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        <iframe
          ref={iframeRef}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            border: 0,
            backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
            boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
            borderRadius: '12px',
          }}
          sandbox="allow-scripts"
          srcDoc={modifiedHtml}
          title="Interactive Preview"
        />
      </div>
    );
  },
);

InteractivePreview.displayName = 'InteractivePreview';

export default InteractivePreview;
