import { useRef, useEffect, useCallback } from "react";

export function useTextareaResize(value: string, minRows: number = 1) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20;
    const minHeight = lineHeight * minRows;
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minRows]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return ref;
}
