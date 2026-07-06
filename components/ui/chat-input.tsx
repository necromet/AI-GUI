"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTextareaResize } from "@/hooks/use-textarea-resize";
import { ArrowUp, Square } from "lucide-react";
import type React from "react";
import { createContext, useContext } from "react";

interface ChatInputContextValue {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onSubmit?: () => void;
  loading?: boolean;
  onStop?: () => void;
  variant?: "default" | "unstyled";
  rows?: number;
}

const ChatInputContext = createContext<ChatInputContextValue>({});

interface ChatInputProps extends Omit<ChatInputContextValue, "variant"> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "unstyled";
  rows?: number;
}

function ChatInput({
  children,
  className,
  variant = "default",
  value,
  onChange,
  onSubmit,
  loading,
  onStop,
  rows = 1,
}: ChatInputProps) {
  const contextValue: ChatInputContextValue = {
    value,
    onChange,
    onSubmit,
    loading,
    onStop,
    variant,
    rows,
  };

  return (
    <ChatInputContext.Provider value={contextValue}>
      <div
        className={cn(
          variant === "default" &&
            "flex flex-col items-end w-full p-2 rounded-xl border border-[var(--border-300)] bg-transparent transition-all duration-200 focus-within:border-[rgba(var(--neon-rgb),0.3)] focus-within:shadow-[0_0_0_2px_rgba(var(--neon-rgb),0.06)]",
          variant === "unstyled" && "flex items-start gap-2 w-full",
          className,
        )}
        style={{ backgroundColor: "var(--bg-200)" }}
      >
        {children}
      </div>
    </ChatInputContext.Provider>
  );
}

ChatInput.displayName = "ChatInput";

interface ChatInputTextAreaProps extends React.ComponentProps<typeof Textarea> {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onSubmit?: () => void;
  variant?: "default" | "unstyled";
}

function ChatInputTextArea({
  onSubmit: onSubmitProp,
  value: valueProp,
  onChange: onChangeProp,
  className,
  variant: variantProp,
  ...props
}: ChatInputTextAreaProps) {
  const context = useContext(ChatInputContext);
  const value = valueProp ?? context.value ?? "";
  const onChange = onChangeProp ?? context.onChange;
  const onSubmit = onSubmitProp ?? context.onSubmit;
  const rows = context.rows ?? 1;

  const variant =
    variantProp ?? (context.variant === "default" ? "unstyled" : "default");

  const textareaRef = useTextareaResize(value, rows);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!onSubmit) return;
    if (e.key === "Enter" && !e.shiftKey) {
      if (typeof value !== "string" || value.trim().length === 0) return;
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Textarea
      ref={textareaRef}
      {...props}
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      className={cn(
        "max-h-[100px] min-h-0 resize-none overflow-x-hidden text-sm leading-snug placeholder:opacity-50 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:[box-shadow:none] p-0",
        variant === "unstyled" &&
          "border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none",
        className,
      )}
      style={{ color: "var(--text-100)", backgroundColor: "transparent" }}
      rows={rows}
    />
  );
}

ChatInputTextArea.displayName = "ChatInputTextArea";

interface ChatInputSubmitProps extends React.ComponentProps<typeof Button> {
  onSubmit?: () => void;
  loading?: boolean;
  onStop?: () => void;
}

function ChatInputSubmit({
  onSubmit: onSubmitProp,
  loading: loadingProp,
  onStop: onStopProp,
  className,
  ...props
}: ChatInputSubmitProps) {
  const context = useContext(ChatInputContext);
  const loading = loadingProp ?? context.loading;
  const onStop = onStopProp ?? context.onStop;
  const onSubmit = onSubmitProp ?? context.onSubmit;

  if (loading && onStop) {
    return (
      <Button
        onClick={onStop}
        className={cn(
          "shrink-0 w-6 h-6 rounded-lg p-0 flex items-center justify-center",
          className,
        )}
        variant="ghost"
        style={{ color: "#ef4444" }}
        {...props}
      >
        <Square size={12} className="fill-current" />
      </Button>
    );
  }

  const isDisabled =
    typeof context.value !== "string" || context.value.trim().length === 0;

  return (
    <Button
      className={cn(
        "shrink-0 w-6 h-6 rounded-lg p-0 flex items-center justify-center transition-all duration-200",
        className,
      )}
      variant="ghost"
      disabled={isDisabled}
      style={
        !isDisabled
          ? { backgroundColor: "var(--neon-color)", color: "#000" }
          : { color: "var(--text-500)", opacity: 0.4 }
      }
      onClick={(event) => {
        event.preventDefault();
        if (!isDisabled) onSubmit?.();
      }}
      {...props}
    >
      <ArrowUp size={12} />
    </Button>
  );
}

ChatInputSubmit.displayName = "ChatInputSubmit";

export { ChatInput, ChatInputTextArea, ChatInputSubmit };
