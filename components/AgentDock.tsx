"use client";

import React, { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  MessageSquare,
  Send,
  ChevronDown,
  ChevronRight,
  Check,
  Copy,
  Square,
  Trash2,
  CheckCircle2,
  CircleX,
  Loader,
  ArrowUp,
  Globe,
  BrainCog,
  ChevronUp,
  MoreVertical,
  Plus,
  ListTodo,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AgentPlan, type AgentTask } from "@/components/ui/agent-plan";

function stripToolBlocks(content: string): string {
  return content.replace(/```(?:tool|json)\s*\n?[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export interface AgentDockMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isThinking?: boolean;
  blocks?: Array<
    | { type: 'text'; content: string }
    | { type: 'tool_call'; name: string; arguments: Record<string, any>; result?: { output: string; error?: string }; collapsed?: boolean; progress?: string }
    | { type: 'ask_user'; question: string }
  >;
  toolCalls?: Array<{ name: string; arguments: Record<string, any>; collapsed?: boolean }>;
  toolResults?: Array<{ name: string; output: string; error?: string; collapsed?: boolean }>;
  toolProgress?: Record<string, string>;
  askUser?: string;
}

type AgentDockProps = {
  agentName: string;
  componentName?: string;
  componentCategory?: string;
  componentFileCount?: number;
  className?: string;
  messages: AgentDockMessage[];
  isStreaming: boolean;
  pendingAskUser?: string | null;
  onSendMessage: (message: string) => void | Promise<void>;
  onStopGeneration?: () => void;
  onToggleToolCall?: (msgId: string, idx: number) => void;
  onToggleToolResult?: (msgId: string, idx: number) => void;
  onUpdateMessages?: (updater: (prev: AgentDockMessage[]) => AgentDockMessage[]) => void;
  sessions?: Array<{ id: string; title: string | null; createdAt: string; updatedAt: string }>;
  activeSessionId?: string | null;
  onSwitchSession?: (sessionId: string) => void;
  onNewSession?: () => void;
  onDeleteSession?: (sessionId: string) => void;
  onClose?: () => void;
  models?: Array<{ id: string; name: string }>;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
  todoTasks?: AgentTask[];
  taskStatuses?: Record<string, string>;
};

export function AgentDock({
  agentName,
  componentName,
  componentCategory,
  componentFileCount,
  className,
  messages,
  isStreaming,
  pendingAskUser,
  onSendMessage,
  onStopGeneration,
  onToggleToolCall,
  onToggleToolResult,
  onUpdateMessages,
  sessions,
  activeSessionId,
  onSwitchSession,
  onNewSession,
  onDeleteSession,
  onClose,
  models,
  selectedModelId,
  onModelChange,
  todoTasks,
  taskStatuses,
}: AgentDockProps) {
  const [message, setMessage] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showThink, setShowThink] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [collapsedCodeBlocks, setCollapsedCodeBlocks] = useState<Set<string>>(new Set());
  const [planExpanded, setPlanExpanded] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submitMessage() {
    const nextMessage = message.trim();
    if (!nextMessage) return;
    let prefix = "";
    if (showSearch) prefix = "[Search: ";
    else if (showThink) prefix = "[Think: ";
    const formatted = prefix ? `${prefix}${nextMessage}]` : nextMessage;
    setMessage("");
    setShowSearch(false);
    setShowThink(false);
    await onSendMessage(formatted);
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submitMessage();
  }

  const handleCopyCode = async (code: string, key: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(key);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {}
  };

  const toggleCodeBlock = (key: string) => {
    setCollapsedCodeBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div
      className={`flex flex-col h-full ${className || ""}`}
    >
      {/* Session Tabs */}
      {sessions && sessions.length > 0 && (
        <div className="flex-shrink-0 px-3 pt-2 pb-0" style={{ borderBottom: "1px solid var(--border-300)" }}>
          <div className="flex items-end gap-0.5 overflow-x-auto">
            {sessions.slice(0, 3).map((session) => {
              const isActive = activeSessionId === session.id;
              return (
                <div
                  key={session.id}
                  className="flex items-center gap-0.5 group/session flex-shrink-0"
                >
                  <button
                    onClick={() => onSwitchSession?.(session.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] transition-colors truncate max-w-[110px] rounded-t-lg"
                    style={{
                      backgroundColor: isActive ? "var(--bg-200)" : "transparent",
                      color: isActive ? "var(--neon-color)" : "var(--text-500)",
                      borderBottom: isActive ? "2px solid var(--neon-color)" : "2px solid transparent",
                    }}
                    title={session.title || "New chat"}
                  >
                    <MessageSquare size={10} style={{ flexShrink: 0, opacity: 0.6 }} />
                    <span className="truncate">{session.title || "New chat"}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center transition-opacity opacity-0 group-hover/session:opacity-100 flex-shrink-0"
                        style={{ color: "var(--text-500)", marginBottom: 2 }}
                      >
                        <MoreVertical size={10} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      side="bottom"
                      style={{ backgroundColor: "var(--bg-100)", borderColor: "var(--border-300)" }}
                    >
                      <DropdownMenuItem
                        onClick={() => onDeleteSession?.(session.id)}
                        className="text-xs cursor-pointer"
                        style={{ color: "#ef4444" }}
                      >
                        <Trash2 size={11} className="mr-1.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
            {sessions.length < 3 && (
              <button
                onClick={onNewSession}
                className="flex items-center justify-center w-7 h-7 rounded-t-lg transition-colors flex-shrink-0 hover:opacity-80"
                style={{ color: "var(--text-500)", marginBottom: 2 }}
                title="New chat"
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* To-Do Plan */}
      {todoTasks && todoTasks.length > 0 && (
        <div className="flex-shrink-0 px-3 pt-2" style={{ borderBottom: "1px solid var(--border-300)" }}>
          <button
            onClick={() => setPlanExpanded((v) => !v)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:opacity-80"
            style={{ color: "var(--text-300)" }}
          >
            <ListTodo size={12} style={{ color: "var(--neon-color)" }} />
            <span className="text-xs font-medium flex-1 text-left">
              Plan
            </span>
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0"
              style={{
                backgroundColor: "rgba(var(--neon-rgb), 0.1)",
                color: "var(--neon-color)",
              }}
            >
              {todoTasks.filter((t) => (taskStatuses?.[t.id] || t.status) === "completed").length}/{todoTasks.length}
            </Badge>
            {planExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          {planExpanded && (
            <div className="pb-2 max-h-[200px] overflow-y-auto">
              <AgentPlan tasks={todoTasks} taskStatuses={taskStatuses} />
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-2 min-h-0">
        <div className="space-y-3 pb-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{
                  background: "linear-gradient(135deg, rgba(var(--neon-rgb), 0.12), rgba(var(--neon-rgb), 0.04))",
                }}
              >
                <MessageSquare size={20} style={{ color: "var(--neon-color)" }} />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-300)" }}>
                Start a conversation
              </p>
              <p className="text-xs" style={{ color: "var(--text-500)" }}>
                Ask the agent to help with your component
              </p>
            </div>
          )}
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[92%] rounded-2xl text-sm leading-relaxed"
                  style={{
                    backgroundColor: isUser
                      ? "rgba(var(--neon-rgb), 0.15)"
                      : "var(--bg-200)",
                    color: "var(--text-100)",
                    wordBreak: "break-word",
                    border: isUser ? "none" : "1px solid var(--border-300)",
                  }}
                >
                  {msg.isThinking && !msg.content && !msg.blocks?.length && !msg.toolCalls?.length && (
                    <div className="px-3.5 py-2.5 flex items-center gap-2">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full animate-pulse"
                            style={{
                              backgroundColor: "var(--neon-color)",
                              animationDelay: `${i * 200}ms`,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-500)" }}>
                        Thinking...
                      </span>
                    </div>
                  )}
                  {msg.blocks ? (
                    msg.blocks.map((block, blockIdx) => {
                      if (block.type === 'text') {
                        const cleanContent = stripToolBlocks(block.content);
                        if (!cleanContent) return null;
                        if (isUser) {
                          return <div key={blockIdx} className="px-3.5 py-2.5 whitespace-pre-wrap">{cleanContent}</div>;
                        }
                        return (
                          <div
                            key={blockIdx}
                            className="px-3.5 py-2.5 [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:my-2 [&>ol]:list-decimal [&>ol]:ml-4 [&>li]:mb-1 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mb-2 [&>h1]:mt-3 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mb-2 [&>h2]:mt-3 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mb-1 [&>h3]:mt-2 [&>blockquote]:border-l-2 [&>blockquote]:pl-3 [&>blockquote]:my-2 [&>blockquote]:italic [&>blockquote]:opacity-70 [&>table]:my-2 [&>table]:text-xs [&>table]:w-full [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-semibold [&>td]:px-2 [&>td]:py-1.5 [&>tr]:border-b"
                            style={{ borderColor: "var(--border-300)" }}
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeRaw, [rehypeKatex, { output: "mathml" }]]}
                              components={{
                                pre: ({ children, ...props }) => {
                                  const getCodeString = (c: any): string => {
                                    if (typeof c === "string") return c;
                                    if (c?.props?.children) {
                                      const ch = c.props.children;
                                      if (Array.isArray(ch)) return ch.map(getCodeString).join("");
                                      return getCodeString(ch);
                                    }
                                    return "";
                                  };
                                  const codeString = getCodeString(children).replace(/\n$/, "");
                                  const codeNode = (children as any)?.props;
                                  const language = codeNode?.className?.replace("language-", "") || "";
                                  const blockKey = `${msg.id}-b${blockIdx}-${language}-${codeString.substring(0, 30)}`;
                                  const isCollapsed = collapsedCodeBlocks.has(blockKey);
                                  const isCopied = copiedCode === blockKey;
                                  return (
                                    <div className="my-2 rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-300)" }}>
                                      <div className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer" style={{ backgroundColor: "var(--bg-100)" }} onClick={() => toggleCodeBlock(blockKey)}>
                                        <div className="flex items-center gap-1.5">
                                          {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                                          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-500)" }}>{language || "code"}</span>
                                          <span className="text-[10px]" style={{ color: "var(--text-500)" }}>{codeString.split("\n").length} lines</span>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); handleCopyCode(codeString, blockKey); }} className="p-1 rounded transition-colors hover:opacity-80" style={{ color: isCopied ? "var(--neon-color)" : "var(--text-500)" }} title="Copy code">
                                          {isCopied ? <Check size={11} /> : <Copy size={11} />}
                                        </button>
                                      </div>
                                      {!isCollapsed && (
                                        <div style={{ maxHeight: 300, overflow: "auto" }}>
                                          <SyntaxHighlighter language={language || "text"} style={vscDarkPlus} customStyle={{ margin: 0, padding: "0.75rem", background: "#1e1e2e", fontSize: 11, borderRadius: 0, fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' }} codeTagProps={{ style: { fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' } }}>
                                            {codeString}
                                          </SyntaxHighlighter>
                                        </div>
                                      )}
                                    </div>
                                  );
                                },
                                code: ({ className, children, ...props }: any) => {
                                  const match = /language-(\w+)/.exec(className || "");
                                  if (match) return <code className={className} {...props}>{children}</code>;
                                  return <code className="px-1 py-0.5 rounded text-[11px]" style={{ backgroundColor: "var(--bg-100)", color: "var(--neon-color)" }} {...props}>{children}</code>;
                                },
                              }}
                            >
                              {cleanContent}
                            </ReactMarkdown>
                          </div>
                        );
                      }

                      if (block.type === 'tool_call') {
                        const status = block.progress ? "in-progress" : block.result?.error ? "failed" : block.result ? "completed" : "in-progress";
                        return (
                          <motion.div
                            key={blockIdx}
                            className="px-3 py-1"
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                          >
                            <motion.div
                              className="flex items-center rounded-md px-2 py-1 cursor-pointer"
                              style={{ backgroundColor: "transparent" }}
                              whileHover={{ backgroundColor: "rgba(var(--neon-rgb), 0.04)" }}
                              onClick={() => {
                                onUpdateMessages?.(prev => prev.map(m => {
                                  if (m.id !== msg.id || !m.blocks) return m;
                                  const newBlocks = m.blocks.map((b, i) => i === blockIdx && b.type === 'tool_call' ? { ...b, collapsed: !b.collapsed } : b);
                                  return { ...m, blocks: newBlocks };
                                }));
                              }}
                            >
                              <motion.div className="mr-2 flex-shrink-0" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                                {status === "completed" ? <CheckCircle2 size={14} style={{ color: block.result?.error ? "#f87171" : "#4ade80" }} /> : status === "failed" ? <CircleX size={14} style={{ color: "#f87171" }} /> : (
                                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                                    <Loader size={14} style={{ color: "var(--neon-color)" }} />
                                  </motion.div>
                                )}
                              </motion.div>
                              <div className="flex min-w-0 flex-1 items-center justify-between">
                                <span className="text-xs font-medium truncate" style={{ color: "var(--text-100)" }}>{block.name}</span>
                                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                  {block.progress && <span className="text-[10px] animate-pulse" style={{ color: "var(--text-500)" }}>{block.progress}</span>}
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0" style={{ backgroundColor: status === "completed" ? (block.result?.error ? "rgba(239,68,68,0.12)" : "rgba(74,222,128,0.12)") : status === "failed" ? "rgba(239,68,68,0.12)" : "rgba(var(--neon-rgb), 0.1)", color: status === "completed" ? (block.result?.error ? "#f87171" : "#4ade80") : status === "failed" ? "#f87171" : "var(--neon-color)" }}>
                                    {status === "completed" ? (block.result?.error ? "error" : "done") : status === "failed" ? "error" : "running"}
                                  </Badge>
                                </div>
                              </div>
                            </motion.div>
                            <AnimatePresence>
                              {!block.collapsed && block.result && (
                                <motion.div className="ml-[26px] overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}>
                                  <div className="border-l-2 border-dashed pl-3 py-1.5 text-[11px] font-mono" style={{ borderColor: "var(--border-300)", color: block.result.error ? "#f87171" : "var(--text-500)", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word", maxHeight: 150, overflowY: "auto" }}>
                                    {block.result.error || (block.result.output.length > 500 ? block.result.output.substring(0, 500) + "..." : block.result.output)}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      }

                      if (block.type === 'ask_user') {
                        return (
                          <div key={blockIdx} className="mx-3 mb-2 p-2.5 rounded-lg text-xs" style={{ backgroundColor: "rgba(var(--neon-rgb), 0.08)", border: "1px solid rgba(var(--neon-rgb), 0.15)" }}>
                            <span style={{ color: "var(--neon-color)" }}>{block.question}</span>
                          </div>
                        );
                      }

                      return null;
                    })
                  ) : (
                    <>
                      {msg.content && (() => {
                        const cleanContent = isUser ? msg.content : stripToolBlocks(msg.content);
                        if (!cleanContent) return null;
                        return isUser ? (
                          <div className="px-3.5 py-2.5 whitespace-pre-wrap">{cleanContent}</div>
                        ) : (
                          <div className="px-3.5 py-2.5 [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:my-2 [&>ol]:list-decimal [&>ol]:ml-4 [&>li]:mb-1" style={{ borderColor: "var(--border-300)" }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, [rehypeKatex, { output: "mathml" }]]} components={{ code: ({ className, children, ...props }: any) => { const match = /language-(\w+)/.exec(className || ""); if (match) return <code className={className} {...props}>{children}</code>; return <code className="px-1 py-0.5 rounded text-[11px]" style={{ backgroundColor: "var(--bg-100)", color: "var(--neon-color)" }} {...props}>{children}</code>; } }}>
                              {cleanContent}
                            </ReactMarkdown>
                          </div>
                        );
                      })()}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="px-3 pt-2">
                          <ul className="space-y-0.5 overflow-hidden">
                            {msg.toolCalls.map((tc, i) => {
                              const hasResult = msg.toolResults?.some(r => r.name === tc.name);
                              const result = msg.toolResults?.find(r => r.name === tc.name);
                              const status = msg.toolProgress?.[tc.name] ? "in-progress" : result?.error ? "failed" : hasResult ? "completed" : "in-progress";
                              return (
                                <motion.li key={i} className="group flex flex-col py-0.5" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 500, damping: 25, delay: i * 0.05 }}>
                                  <motion.div className="flex items-center rounded-md px-2 py-1 cursor-pointer" style={{ backgroundColor: "transparent" }} whileHover={{ backgroundColor: "rgba(var(--neon-rgb), 0.04)" }} onClick={() => onToggleToolCall?.(msg.id, i)}>
                                    <motion.div className="mr-2 flex-shrink-0" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                                      {status === "completed" ? <CheckCircle2 size={14} style={{ color: "#4ade80" }} /> : status === "failed" ? <CircleX size={14} style={{ color: "#f87171" }} /> : <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Loader size={14} style={{ color: "var(--neon-color)" }} /></motion.div>}
                                    </motion.div>
                                    <div className="flex min-w-0 flex-1 items-center justify-between">
                                      <span className="text-xs font-medium truncate" style={{ color: "var(--text-100)" }}>{tc.name}</span>
                                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-2" style={{ backgroundColor: status === "completed" ? "rgba(74,222,128,0.12)" : status === "failed" ? "rgba(239,68,68,0.12)" : "rgba(var(--neon-rgb), 0.1)", color: status === "completed" ? "#4ade80" : status === "failed" ? "#f87171" : "var(--neon-color)" }}>{status === "completed" ? "done" : status === "failed" ? "error" : "running"}</Badge>
                                    </div>
                                  </motion.div>
                                </motion.li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                      {msg.askUser && (
                        <div className="mx-3 mb-2 p-2.5 rounded-lg text-xs" style={{ backgroundColor: "rgba(var(--neon-rgb), 0.08)", border: "1px solid rgba(var(--neon-rgb), 0.15)" }}>
                          <span style={{ color: "var(--neon-color)" }}>{msg.askUser}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3" style={{ borderTop: "1px solid var(--border-300)" }}>
        {pendingAskUser && (
          <div
            className="px-3 py-1.5 rounded-lg text-xs mb-2"
            style={{
              backgroundColor: "rgba(var(--neon-rgb), 0.06)",
              color: "var(--text-300)",
            }}
          >
            <span style={{ color: "var(--neon-color)", fontWeight: 600 }}>Question: </span>
            {pendingAskUser}
          </div>
        )}
        <div
          className="rounded-2xl p-2 transition-all duration-300"
          style={{
            backgroundColor: "var(--bg-200)",
            border: "1px solid var(--border-300)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          }}
        >
          <textarea
            aria-label="Message agent"
            className="w-full bg-transparent text-sm leading-5 outline-none resize-none min-h-[36px] max-h-[120px] px-2 py-1.5"
            style={{ color: "var(--text-100)" }}
            onChange={(event) => {
              setMessage(event.target.value);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleTextareaKeyDown}
            placeholder={
              showSearch
                ? "Search the web..."
                : showThink
                ? "Think deeply..."
                : pendingAskUser
                ? "Type your answer..."
                : componentName
                ? `Ask about ${componentName}...`
                : "Ask the agent..."
            }
            ref={textareaRef}
            rows={1}
            value={message}
            disabled={isStreaming}
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1">
              {/* Search Toggle */}
              <button
                type="button"
                onClick={() => {
                  setShowSearch((v) => !v);
                  setShowThink(false);
                }}
                className={cn(
                  "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-7",
                  showSearch
                    ? "border-[#1EAEDB] text-[#1EAEDB]"
                    : "border-transparent text-[var(--text-500)] hover:text-[var(--text-300)]"
                )}
                style={{
                  backgroundColor: showSearch ? "rgba(30,174,219,0.12)" : "transparent",
                }}
              >
                <motion.div
                  animate={{ rotate: showSearch ? 360 : 0, scale: showSearch ? 1.1 : 1 }}
                  whileHover={{ rotate: showSearch ? 360 : 15, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 10 }}
                >
                  <Globe size={14} />
                </motion.div>
                <AnimatePresence>
                  {showSearch && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs overflow-hidden whitespace-nowrap"
                    >
                      Search
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              {/* Divider */}
              <div className="relative h-5 w-[1px] mx-0.5" style={{ backgroundColor: "var(--border-300)" }} />

              {/* Think Toggle */}
              <button
                type="button"
                onClick={() => {
                  setShowThink((v) => !v);
                  setShowSearch(false);
                }}
                className={cn(
                  "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-7",
                  showThink
                    ? "border-[#8B5CF6] text-[#8B5CF6]"
                    : "border-transparent text-[var(--text-500)] hover:text-[var(--text-300)]"
                )}
                style={{
                  backgroundColor: showThink ? "rgba(139,92,246,0.12)" : "transparent",
                }}
              >
                <motion.div
                  animate={{ rotate: showThink ? 360 : 0, scale: showThink ? 1.1 : 1 }}
                  whileHover={{ rotate: showThink ? 360 : 15, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 10 }}
                >
                  <BrainCog size={14} />
                </motion.div>
                <AnimatePresence>
                  {showThink && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs overflow-hidden whitespace-nowrap"
                    >
                      Think
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              {/* Divider */}
              {models && models.length > 1 && (
                <div className="relative h-5 w-[1px] mx-0.5" style={{ backgroundColor: "var(--border-300)" }} />
              )}

              {/* Model Picker */}
              {models && models.length > 1 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowModelPicker((v) => !v)}
                    className="rounded-full transition-all flex items-center gap-1 px-2 py-1 h-7 text-[var(--text-500)] hover:text-[var(--text-300)]"
                  >
                    <span className="text-xs truncate max-w-[80px]">
                      {models.find((m) => m.id === selectedModelId)?.name || "Model"}
                    </span>
                    <ChevronUp size={10} className={cn("transition-transform", showModelPicker ? "" : "rotate-180")} />
                  </button>
                  {showModelPicker && (
                    <div
                      className="absolute bottom-full left-0 mb-1 py-1 rounded-lg shadow-lg z-50 min-w-[160px]"
                      style={{
                        backgroundColor: "var(--bg-100)",
                        border: "1px solid var(--border-300)",
                      }}
                    >
                      {models.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onModelChange?.(m.id);
                            setShowModelPicker(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:opacity-80"
                          style={{
                            color: m.id === selectedModelId ? "var(--neon-color)" : "var(--text-300)",
                            backgroundColor: m.id === selectedModelId ? "rgba(var(--neon-rgb), 0.08)" : "transparent",
                          }}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Send / Stop */}
            <button
              type="button"
              onClick={() => {
                if (isStreaming) {
                  onStopGeneration?.();
                } else {
                  submitMessage();
                }
              }}
              disabled={!isStreaming && !message.trim()}
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200",
                isStreaming
                  ? "text-red-400"
                  : message.trim()
                  ? "text-[var(--text-100)]"
                  : "text-[var(--text-500)] opacity-50"
              )}
              style={{
                backgroundColor: isStreaming
                  ? "rgba(239,68,68,0.15)"
                  : message.trim()
                  ? "var(--neon-color)"
                  : "var(--bg-300)",
              }}
            >
              {isStreaming ? (
                <Square size={11} className="fill-current" />
              ) : message.trim() ? (
                <ArrowUp size={14} style={{ color: "#000" }} />
              ) : (
                <Send size={11} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentDock;
