import { useState, useEffect, useRef, useCallback } from "react";
import { Mic } from "lucide-react";
import { cn } from "../lib/utils";

interface AIVoiceInputProps {
  onStart?: () => void;
  onStop?: (duration: number) => void;
  visualizerBars?: number;
  demoMode?: boolean;
  demoInterval?: number;
  className?: string;
}

export function AIVoiceInput({
  onStart,
  onStop,
  visualizerBars = 48,
  demoMode = false,
  demoInterval = 3000,
  className,
}: AIVoiceInputProps) {
  const [submitted, setSubmitted] = useState(false);
  const [time, setTime] = useState(0);
  const [isDemoAnimating, setIsDemoAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const cleanupTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (demoTimerRef.current) {
      clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (submitted) {
      onStart?.();
      setTime(0);
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    } else {
      cleanupTimers();
      if (time > 0) {
        onStop?.(time);
      }
      setTime(0);
    }
    return cleanupTimers;
  }, [submitted]);

  useEffect(() => {
    if (!demoMode) return;

    const runDemo = () => {
      setIsDemoAnimating(true);
      demoTimerRef.current = setTimeout(() => {
        setIsDemoAnimating(false);
        demoTimerRef.current = setTimeout(runDemo, demoInterval);
      }, 2000);
    };

    demoTimerRef.current = setTimeout(runDemo, demoInterval);
    return cleanupTimers;
  }, [demoMode, demoInterval, cleanupTimers]);

  const isActive = submitted || isDemoAnimating;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-full gap-3",
        className
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (!demoMode) setSubmitted((prev) => !prev);
        }}
        className={cn(
          "group relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300",
          isActive
            ? "bg-red-500/10 border-2 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.15)]"
            : "bg-gray-100 dark:bg-white/[0.06] border-2 border-gray-300 dark:border-white/[0.08] hover:border-gray-400 dark:hover:border-white/[0.15] hover:bg-gray-200 dark:hover:bg-white/[0.08]"
        )}
        disabled={demoMode}
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full transition-transform duration-700",
            isActive && "animate-spin-slow"
          )}
          style={{
            background: isActive
              ? "conic-gradient(from 0deg, transparent, rgba(239,68,68,0.3), transparent)"
              : undefined,
          }}
        />
        <div
          className={cn(
            "relative z-10 flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300",
            isActive
              ? "bg-red-500/20"
              : "bg-gray-200 dark:bg-white/[0.04] group-hover:bg-gray-300 dark:group-hover:bg-white/[0.06]"
          )}
        >
          <Mic
            size={22}
            className={cn(
              "transition-colors duration-300",
              isActive
                ? "text-red-500"
                : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300"
            )}
          />
        </div>
      </button>

      {isActive && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-mono text-sm text-gray-700 dark:text-white/80">
            {formatTime(time)}
          </span>
        </div>
      )}

      <div className="w-full max-w-xs h-10 flex items-center justify-center gap-0.5 px-4">
        {[...Array(visualizerBars)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-0.5 rounded-full transition-all duration-300",
              isActive
                ? "bg-red-500/60 animate-pulse"
                : "bg-gray-300 dark:bg-white/20"
            )}
            style={{
              height: isActive
                ? `${Math.max(15, Math.random() * 100)}%`
                : "15%",
              animationDelay: `${i * 0.05}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>

      <span
        className={cn(
          "text-xs transition-colors duration-300",
          isActive
            ? "text-red-500 font-medium"
            : "text-gray-500 dark:text-gray-400"
        )}
      >
        {isActive ? "Listening..." : "Click to speak"}
      </span>
    </div>
  );
}
