import React from "react";
import { ArrowUp, Paperclip, Square, X, Mic, Globe, BrainCog, ImageOff, FileText, Table } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AIVoiceInput } from "./AIVoiceInput";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import ModelSelect from "./ModelSelect";

import { cn } from "@/lib/utils";

interface ImageViewDialogProps {
  imageUrl: string | null;
  onClose: () => void;
}
const ImageViewDialog: React.FC<ImageViewDialogProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent hideCloseButton className="p-0 border-none bg-transparent shadow-none max-w-[90vw] md:max-w-[800px] place-items-center">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative bg-white dark:bg-[#1F2023] rounded-2xl overflow-hidden shadow-2xl"
        >
          <img src={imageUrl} alt="Full preview" className="w-full max-h-[80vh] object-contain rounded-2xl" />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
});
function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  ({ className, isLoading = false, maxHeight = 200, value, onValueChange, onSubmit, children, disabled = false, onDragOver, onDragLeave, onDrop }, ref) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
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
              "rounded-2xl overflow-hidden transition-all duration-300",
              isLoading && "border-red-500/50",
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

const PromptInputTextarea: React.FC<{ disableAutosize?: boolean; placeholder?: string } & React.ComponentProps<typeof Textarea>> = ({
  className,
  onKeyDown,
  disableAutosize = false,
  placeholder,
  ...props
}) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn("text-base border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[44px] resize-none", className)}
      style={{ color: 'var(--text-100)' }}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
};

const PromptInputActions: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}
const PromptInputAction: React.FC<PromptInputActionProps> = ({ tooltip, children, className, side = "top", ...props }) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

const CustomDivider: React.FC = () => (
  <div className="relative h-6 w-[1.5px] mx-1">
    <div
      className="absolute inset-0 rounded-full"
      style={{ background: 'var(--border-300)' }}
    />
  </div>
);

interface PromptInputBoxProps {
  onSend?: (message: string, options?: { files?: File[]; search?: boolean; think?: boolean }) => void;
  isLoading?: boolean;
  onStop?: () => void;
  placeholder?: string;
  className?: string;
  theme?: "dark" | "light";
  externalFiles?: File[];
  onExternalFilesConsumed?: () => void;
  currentModel?: string;
  models?: Array<{ id: string; name: string; modelType?: string; provider?: string; apiModelId?: string }>;
  onSelectModel?: (modelId: string) => void;
  supportsThinking?: boolean;
  supportsSearch?: boolean;
  supportsVision?: boolean;
}
export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>((props, ref) => {
  const { onSend = () => {}, isLoading = false, onStop, placeholder = "Message edward:labs...", className, theme = "dark", externalFiles, onExternalFilesConsumed, currentModel, models, onSelectModel, supportsThinking = true, supportsSearch = true, supportsVision = true } = props;
  const [input, setInput] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [filePreviews, setFilePreviews] = React.useState<{ [key: string]: string }>({});
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showThink, setShowThink] = React.useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const promptBoxRef = React.useRef<HTMLDivElement>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);

  const handleToggleChange = (value: string) => {
    if (value === "search") {
      setShowSearch((prev) => !prev);
      setShowThink(false);
    } else if (value === "think") {
      setShowThink((prev) => !prev);
      setShowSearch(false);
    }
  };

  const isImageFile = (file: File) => file.type.startsWith("image/");

  const isDocumentFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return ['pdf', 'docx', 'xlsx', 'txt', 'csv', 'md', 'html', 'json', 'log', 'xml', 'yaml', 'yml'].includes(ext);
  };

  const isAllowedFile = (file: File) => isImageFile(file) || isDocumentFile(file);

  const processFile = (file: File) => {
    if (!isAllowedFile(file)) return;
    if (file.size > 20 * 1024 * 1024) return;
    setFiles(prev => [...prev, file]);
    if (isImageFile(file)) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreviews(prev => ({ ...prev, [file.name]: e.target?.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const processFiles = (newFiles: File[]) => {
    for (const file of newFiles) {
      if (!isAllowedFile(file)) continue;
      if (file.size > 20 * 1024 * 1024) continue;
      setFiles(prev => [...prev, file]);
      if (isImageFile(file)) {
        const reader = new FileReader();
        reader.onload = (e) => setFilePreviews(prev => ({ ...prev, [file.name]: e.target?.result as string }));
        reader.readAsDataURL(file);
      }
    }
  };

  React.useEffect(() => {
    if (externalFiles && externalFiles.length > 0) {
      processFiles(externalFiles);
      onExternalFilesConsumed?.();
    }
  }, [externalFiles]);

  React.useEffect(() => {
    if (!supportsSearch && showSearch) setShowSearch(false);
    if (!supportsThinking && showThink) setShowThink(false);
  }, [supportsSearch, supportsThinking]);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const allowedFiles = droppedFiles.filter((file) => isAllowedFile(file));
    if (allowedFiles.length > 0) processFiles(allowedFiles);
  }, []);

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[files[index]?.name];
      return newPreviews;
    });
  };

  const openImageModal = (imageUrl: string) => setSelectedImage(imageUrl);

  const handlePaste = React.useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile();
      if (file && isAllowedFile(file)) {
        e.preventDefault();
        processFile(file);
        break;
      }
    }
  }, []);

  React.useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleSubmit = () => {
    if (input.trim() || files.length > 0) {
      onSend(input.trim(), { files, search: showSearch, think: showThink });
      setInput("");
      setFiles([]);
      setFilePreviews({});
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.start();
    } catch (err) {
      console.error("Microphone access denied:", err);
      setIsRecording(false);
    }
  };

  const handleStopRecording = (duration: number) => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        onSend(`[Voice message - ${duration}s]`, { files: [audioFile] });
      };
    }
    setIsRecording(false);
  };

  const hasContent = input.trim() !== "" || files.length > 0;

  const borderStyle = {
    background: "var(--bg-200)",
    border: "1px solid var(--border-300)",
  };

  return (
    <>
      <PromptInput
        value={input}
        onValueChange={setInput}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        className={cn(
          "w-full transition-all duration-300 ease-in-out",
          isRecording && "border-red-500/50",
          className
        )}
        disabled={isLoading || isRecording}
        ref={ref || promptBoxRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div style={borderStyle} className="rounded-2xl p-2">
          {files.length > 0 && !isRecording && (
            <div className="flex flex-wrap gap-2 p-0 pb-1 transition-all duration-300">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative group">
                  {file.type.startsWith("image/") && filePreviews[file.name] ? (
                    <div
                      className="w-16 h-16 rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
                      onClick={() => openImageModal(filePreviews[file.name])}
                    >
                      <img src={filePreviews[file.name]} alt={file.name} className="h-full w-full object-cover" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(index);
                        }}
                        className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ) : isDocumentFile(file) ? (
                    <div
                      className="flex items-center gap-2 h-10 px-3 rounded-xl transition-all duration-300 max-w-[200px]"
                      style={{ background: 'var(--bg-300)', border: '1px solid var(--border-300)' }}
                    >
                      {(() => {
                        const ext = file.name.split('.').pop()?.toLowerCase();
                        if (ext === 'xlsx' || ext === 'csv') return <Table className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--neon-color)' }} />;
                        return <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--neon-color)' }} />;
                      })()}
                      <span className="text-xs truncate" style={{ color: 'var(--text-300)' }}>{file.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(index);
                        }}
                        className="rounded-full p-0.5 hover:bg-[var(--bg-400)] transition-colors flex-shrink-0"
                      >
                        <X className="h-3 w-3" style={{ color: 'var(--text-500)' }} />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <div className={cn("transition-all duration-300", isRecording ? "h-0 overflow-hidden opacity-0" : "opacity-100")}>
            <PromptInputTextarea
              placeholder={
                showSearch
                  ? "Search the web..."
                  : showThink
                  ? "Think deeply..."
                  : placeholder
              }
              className="text-base"
            />
          </div>

          {isRecording && (
            <AIVoiceInput
              onStart={handleStartRecording}
              onStop={(duration) => handleStopRecording(duration)}
              visualizerBars={32}
              className="py-3"
            />
          )}

          <PromptInputActions className="flex items-center justify-between gap-2 p-0 pt-2">
            <div
              className={cn(
                "flex items-center gap-1 transition-opacity duration-300",
                isRecording ? "opacity-0 invisible h-0" : "opacity-100 visible"
              )}
            >
              {currentModel && models && onSelectModel && (
                <div className="mr-1">
                  <ModelSelect currentModel={currentModel} models={models} onSelect={onSelectModel} theme={theme} />
                </div>
              )}
              {supportsVision ? (
              <PromptInputAction tooltip="Upload image or document">
                  <button
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors"
                  style={{ color: 'var(--text-500)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; e.currentTarget.style.color = 'var(--text-300)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-500)'; }}
                  disabled={isRecording}
                >
                  <Paperclip className="h-5 w-5 transition-colors" />
                  <input
                    ref={uploadInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) processFiles(Array.from(e.target.files));
                      if (e.target) e.target.value = "";
                    }}
                    accept="image/*,.pdf,.doc,.docx,.xlsx,.txt,.csv,.md,.html,.json,.log,.xml,.yaml,.yml"
                  />
                </button>
              </PromptInputAction>
              ) : (
              <PromptInputAction tooltip="Upload document">
                  <button
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors"
                  style={{ color: 'var(--text-500)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; e.currentTarget.style.color = 'var(--text-300)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-500)'; }}
                  disabled={isRecording}
                >
                  <Paperclip className="h-5 w-5 transition-colors" />
                  <input
                    ref={uploadInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) processFiles(Array.from(e.target.files));
                      if (e.target) e.target.value = "";
                    }}
                    accept=".pdf,.doc,.docx,.xlsx,.txt,.csv,.md,.html,.json,.log,.xml,.yaml,.yml"
                  />
                </button>
              </PromptInputAction>
              )}

              <div className="flex items-center">
                {supportsSearch && (
                <button
                  type="button"
                  onClick={() => handleToggleChange("search")}
                  className={cn(
                    "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                    showSearch
                      ? "bg-[#1EAEDB]/15 border-[#1EAEDB] text-[#1EAEDB]"
                      : "bg-transparent border-transparent hover:text-[var(--text-300)]"
                  )}
                  style={!showSearch ? { color: 'var(--text-500)' } : undefined}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <motion.div
                      animate={{ rotate: showSearch ? 360 : 0, scale: showSearch ? 1.1 : 1 }}
                      whileHover={{ rotate: showSearch ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                    >
                      <Globe className={cn("w-4 h-4", showSearch ? "text-[#1EAEDB]" : "text-inherit")} />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {showSearch && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-sm overflow-hidden whitespace-nowrap text-[#1EAEDB] flex-shrink-0"
                      >
                        Search
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
                )}

                {supportsSearch && supportsThinking && <CustomDivider />}

                {supportsThinking && (
                <button
                  type="button"
                  onClick={() => handleToggleChange("think")}
                  className={cn(
                    "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                    showThink
                      ? "bg-[#8B5CF6]/15 border-[#8B5CF6] text-[#8B5CF6]"
                      : "bg-transparent border-transparent hover:text-[var(--text-300)]"
                  )}
                  style={!showThink ? { color: 'var(--text-500)' } : undefined}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <motion.div
                      animate={{ rotate: showThink ? 360 : 0, scale: showThink ? 1.1 : 1 }}
                      whileHover={{ rotate: showThink ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                    >
                      <BrainCog className={cn("w-4 h-4", showThink ? "text-[#8B5CF6]" : "text-inherit")} />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {showThink && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-sm overflow-hidden whitespace-nowrap text-[#8B5CF6] flex-shrink-0"
                      >
                        Think
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
                )}
              </div>
            </div>

            <PromptInputAction
              tooltip={
                isLoading
                  ? "Stop generation"
                  : isRecording
                  ? "Stop recording"
                  : hasContent
                  ? "Send message"
                  : "Voice message"
              }
            >
              <Button
                variant="default"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full transition-all duration-200",
                  isRecording
                    ? "bg-transparent hover:bg-gray-200 dark:hover:bg-gray-600/30 text-red-500 hover:text-red-400"
                    : hasContent
                    ? "bg-white hover:bg-white/80 text-[#1F2023]"
                    : "bg-transparent hover:bg-[var(--bg-300)]"
                )}
                style={
                  hasContent && !isRecording
                    ? {
                        background: "var(--neon-color)",
                        color: "#000",
                      }
                    : { color: "var(--text-500)" }
                }
                onClick={() => {
                  if (isLoading) {
                    onStop?.();
                  } else if (isRecording) {
                    setIsRecording(false);
                  } else if (hasContent) {
                    handleSubmit();
                  } else {
                    setIsRecording(true);
                  }
                }}
                disabled={isLoading && !hasContent}
              >
                {isLoading ? (
                  <Square className="h-4 w-4 fill-[var(--text-100)] animate-pulse" />
                ) : isRecording ? (
                  <StopCircle className="h-5 w-5 text-red-500" />
                ) : hasContent ? (
                  <ArrowUp className="h-4 w-4 text-[#1F2023]" />
                ) : (
                  <Mic className="h-5 w-5" style={{ color: "var(--text-500)" }} />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </div>
      </PromptInput>

      <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </>
  );
});
PromptInputBox.displayName = "PromptInputBox";
