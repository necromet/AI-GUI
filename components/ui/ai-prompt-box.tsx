"use client";

import React, { useState, useRef, useEffect, createContext, useContext } from "react";
import { ArrowUp, Square, Mic, StopCircle } from "lucide-react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number;
  onSubmit?: () => void;
  disabled?: boolean;
}

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 120,
  onSubmit: undefined,
  disabled: false,
});

function usePromptInput() {
  const context = useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  ({ className, isLoading = false, maxHeight = 120, value, onValueChange, onSubmit, children, disabled = false }, ref) => {
    const [internalValue, setInternalValue] = useState(value || "");
    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              "rounded-xl transition-all duration-300 flex items-end gap-1",
              isLoading && "border-red-500/70",
              className
            )}
            style={{
              backgroundColor: "var(--bg-200)",
              border: "1px solid var(--border-300)",
            }}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

interface PromptInputTextareaProps {
  placeholder?: string;
}

const PromptInputTextarea: React.FC<PromptInputTextareaProps & React.ComponentProps<"textarea">> = ({
  className,
  onKeyDown,
  placeholder,
  ...props
}) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex-1 bg-transparent px-3 py-2.5 text-sm placeholder:opacity-50 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[38px] max-h-[120px] resize-none border-0",
        className
      )}
      style={{ color: "var(--text-100)" }}
      rows={1}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
};

interface AgentPromptInputBoxProps {
  onSend?: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onStop?: () => void;
}

export const AgentPromptInputBox = React.forwardRef<HTMLDivElement, AgentPromptInputBoxProps>(
  (props, ref) => {
    const { onSend = () => {}, isLoading = false, placeholder = "Type your message...", className, disabled = false, onStop } = props;
    const [input, setInput] = useState("");

    const handleSubmit = () => {
      if (input.trim()) {
        onSend(input.trim());
        setInput("");
      }
    };

    const hasContent = input.trim() !== "";

    return (
      <PromptInput
        value={input}
        onValueChange={setInput}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        className={cn("w-full", className)}
        disabled={disabled}
        ref={ref}
      >
        <PromptInputTextarea placeholder={placeholder} />

        <div className="flex items-center gap-1 pb-2 pr-2 flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center transition-all duration-200"
                )}
                style={
                  hasContent
                    ? { backgroundColor: "var(--neon-color)", color: "#000" }
                    : { color: "var(--text-500)" }
                }
                onClick={() => {
                  if (isLoading) onStop?.();
                  else if (hasContent) handleSubmit();
                }}
                disabled={disabled && !hasContent}
              >
                {isLoading ? (
                  <Square className="h-3.5 w-3.5 fill-current animate-pulse" />
                ) : hasContent ? (
                  <ArrowUp className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isLoading ? "Stop generation" : hasContent ? "Send message" : "Voice message"}
            </TooltipContent>
          </Tooltip>
        </div>
      </PromptInput>
    );
  }
);
AgentPromptInputBox.displayName = "AgentPromptInputBox";
