"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

export interface AgentSubtask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tools?: string[];
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  level?: number;
  dependencies?: string[];
  subtasks?: AgentSubtask[];
}

interface AgentPlanProps {
  tasks: AgentTask[];
  taskStatuses?: Record<string, string>;
}

function StatusIcon({ status, size = 18 }: { status: string; size?: number }) {
  const s = size === 18 ? "h-[18px] w-[18px]" : "h-3.5 w-3.5";
  if (status === "completed")
    return <CheckCircle2 className={s} style={{ color: "#4ade80" }} />;
  if (status === "in-progress")
    return <CircleDotDashed className={s} style={{ color: "#60a5fa" }} />;
  if (status === "need-help")
    return <CircleAlert className={s} style={{ color: "#facc15" }} />;
  if (status === "failed")
    return <CircleX className={s} style={{ color: "#f87171" }} />;
  return <Circle className={s} style={{ color: "var(--text-500)" }} />;
}

export function AgentPlan({ tasks, taskStatuses }: AgentPlanProps) {
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [expandedSubtasks, setExpandedSubtasks] = useState<
    Record<string, boolean>
  >({});

  const resolvedTasks = useMemo(() => {
    if (!taskStatuses) return tasks;
    return tasks.map((t) => ({
      ...t,
      status: taskStatuses[t.id] || t.status,
      subtasks: (t.subtasks || []).map((st) => ({
        ...st,
        status: taskStatuses[st.id] || st.status,
      })),
    }));
  }, [tasks, taskStatuses]);

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleSubtaskExpansion = (taskId: string, subtaskId: string) => {
    const key = `${taskId}-${subtaskId}`;
    setExpandedSubtasks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const taskVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -5 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: prefersReducedMotion ? "tween" : "spring",
        stiffness: 500,
        damping: 30,
        duration: prefersReducedMotion ? 0.2 : undefined,
      },
    },
    exit: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : -5,
      transition: { duration: 0.15 },
    },
  };

  const subtaskListVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" as const },
    visible: {
      height: "auto",
      opacity: 1,
      overflow: "visible" as const,
      transition: {
        duration: 0.25,
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        when: "beforeChildren" as const,
        ease: [0.2, 0.65, 0.3, 0.9],
      },
    },
    exit: {
      height: 0,
      opacity: 0,
      overflow: "hidden" as const,
      transition: { duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] },
    },
  };

  const subtaskVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: prefersReducedMotion ? "tween" : "spring",
        stiffness: 500,
        damping: 25,
        duration: prefersReducedMotion ? 0.2 : undefined,
      },
    },
    exit: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : -10,
      transition: { duration: 0.15 },
    },
  };

  const subtaskDetailsVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" as const },
    visible: {
      opacity: 1,
      height: "auto",
      overflow: "visible" as const,
      transition: { duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] },
    },
  };

  const statusBadgeStyle = (status: string) => {
    if (status === "completed")
      return { backgroundColor: "rgba(74,222,128,0.15)", color: "#4ade80" };
    if (status === "in-progress")
      return { backgroundColor: "rgba(96,165,250,0.15)", color: "#60a5fa" };
    if (status === "need-help")
      return { backgroundColor: "rgba(250,204,21,0.15)", color: "#facc15" };
    if (status === "failed")
      return { backgroundColor: "rgba(248,113,113,0.15)", color: "#f87171" };
    return {
      backgroundColor: "var(--bg-300)",
      color: "var(--text-500)",
    };
  };

  if (resolvedTasks.length === 0) return null;

  const completedCount = resolvedTasks.filter((t) => t.status === "completed").length;

  return (
    <div
      className="overflow-auto text-xs"
      style={{ color: "var(--text-100)" }}
    >
      <motion.div
        className="rounded-lg overflow-hidden"
        style={{
          backgroundColor: "var(--bg-200)",
          border: "1px solid var(--border-300)",
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: [0.2, 0.65, 0.3, 0.9] },
        }}
      >
        <LayoutGroup>
          <div className="p-3 overflow-hidden">
            <ul className="space-y-0.5 overflow-hidden">
              {resolvedTasks.map((task, index) => {
                const isExpanded = expandedTasks.includes(task.id);
                const isCompleted = task.status === "completed";

                return (
                  <motion.li
                    key={task.id}
                    className={index !== 0 ? "mt-0.5 pt-1.5" : ""}
                    initial="hidden"
                    animate="visible"
                    variants={taskVariants}
                  >
                    <motion.div
                      className="group flex items-center px-2.5 py-1.5 rounded-md cursor-pointer"
                      whileHover={{
                        backgroundColor: "var(--surface-hover)",
                        transition: { duration: 0.15 },
                      }}
                    >
                      <motion.div
                        className="mr-2 flex-shrink-0"
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.1 }}
                      >
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={task.status}
                            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                            transition={{
                              duration: 0.2,
                              ease: [0.2, 0.65, 0.3, 0.9],
                            }}
                          >
                            <StatusIcon status={task.status} />
                          </motion.div>
                        </AnimatePresence>
                      </motion.div>

                      <motion.div
                        className="flex min-w-0 flex-grow items-center justify-between"
                        onClick={() =>
                          (task.subtasks || []).length > 0 &&
                          toggleTaskExpansion(task.id)
                        }
                      >
                        <div className="mr-2 flex-1 truncate">
                          <span
                            className={isCompleted ? "line-through" : ""}
                            style={{
                              color: isCompleted
                                ? "var(--text-500)"
                                : "var(--text-100)",
                              fontSize: "12px",
                            }}
                          >
                            {task.title}
                          </span>
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          {(task.dependencies || []).length > 0 && (
                            <div className="flex items-center gap-0.5 mr-1">
                              {(task.dependencies || []).map((dep, idx) => (
                                <motion.span
                                  key={idx}
                                  className="rounded px-1 py-0.5 font-medium"
                                  style={{
                                    fontSize: "9px",
                                    backgroundColor: "var(--bg-300)",
                                    color: "var(--text-500)",
                                  }}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{
                                    duration: 0.2,
                                    delay: idx * 0.05,
                                  }}
                                >
                                  {dep}
                                </motion.span>
                              ))}
                            </div>
                          )}

                          <motion.span
                            className="rounded px-1.5 py-0.5 font-medium"
                            style={{
                              fontSize: "9px",
                              ...statusBadgeStyle(task.status),
                            }}
                            key={task.status}
                            initial={{ scale: 1 }}
                            animate={{
                              scale: prefersReducedMotion ? 1 : [1, 1.08, 1],
                              transition: {
                                duration: 0.35,
                                ease: [0.34, 1.56, 0.64, 1],
                              },
                            }}
                          >
                            {task.status}
                          </motion.span>
                        </div>
                      </motion.div>
                    </motion.div>

                    <AnimatePresence mode="wait">
                      {isExpanded && (task.subtasks || []).length > 0 && (
                        <motion.div
                          className="relative overflow-hidden"
                          variants={subtaskListVariants}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                          layout
                        >
                          <div
                            className="absolute top-0 bottom-0 left-[18px]"
                            style={{
                              borderLeft: "2px dashed var(--border-300)",
                            }}
                          />
                          <ul
                            className="mt-0.5 mr-1 mb-1 ml-2 space-y-0"
                            style={{
                              borderColor: "var(--border-300)",
                            }}
                          >
                            {(task.subtasks || []).map((subtask) => {
                              const subtaskKey = `${task.id}-${subtask.id}`;
                              const isSubtaskExpanded =
                                expandedSubtasks[subtaskKey];

                              return (
                                <motion.li
                                  key={subtask.id}
                                  className="group flex flex-col py-0.5 pl-5"
                                  onClick={() =>
                                    toggleSubtaskExpansion(
                                      task.id,
                                      subtask.id
                                    )
                                  }
                                  variants={subtaskVariants}
                                  initial="hidden"
                                  animate="visible"
                                  exit="exit"
                                  layout
                                >
                                  <motion.div
                                    className="flex flex-1 items-center rounded-md p-1"
                                    whileHover={{
                                      backgroundColor: "var(--surface-hover)",
                                      transition: { duration: 0.15 },
                                    }}
                                    layout
                                  >
                                    <motion.div
                                      className="mr-2 flex-shrink-0"
                                      whileTap={{ scale: 0.9 }}
                                      whileHover={{ scale: 1.1 }}
                                      layout
                                    >
                                      <AnimatePresence mode="wait">
                                        <motion.div
                                          key={subtask.status}
                                          initial={{
                                            opacity: 0,
                                            scale: 0.8,
                                            rotate: -10,
                                          }}
                                          animate={{
                                            opacity: 1,
                                            scale: 1,
                                            rotate: 0,
                                          }}
                                          exit={{
                                            opacity: 0,
                                            scale: 0.8,
                                            rotate: 10,
                                          }}
                                          transition={{
                                            duration: 0.2,
                                            ease: [0.2, 0.65, 0.3, 0.9],
                                          }}
                                        >
                                          <StatusIcon
                                            status={subtask.status}
                                            size={14}
                                          />
                                        </motion.div>
                                      </AnimatePresence>
                                    </motion.div>

                                    <span
                                      className="cursor-pointer"
                                      style={{
                                        fontSize: "11px",
                                        color:
                                          subtask.status === "completed"
                                            ? "var(--text-500)"
                                            : "var(--text-300)",
                                        textDecoration:
                                          subtask.status === "completed"
                                            ? "line-through"
                                            : "none",
                                      }}
                                    >
                                      {subtask.title}
                                    </span>
                                  </motion.div>

                                  <AnimatePresence mode="wait">
                                    {isSubtaskExpanded && (
                                      <motion.div
                                        className="mt-0.5 ml-1 pl-4 overflow-hidden"
                                        style={{
                                          fontSize: "10px",
                                          color: "var(--text-500)",
                                          borderLeft:
                                            "1px dashed var(--border-300)",
                                        }}
                                        variants={subtaskDetailsVariants}
                                        initial="hidden"
                                        animate="visible"
                                        exit="hidden"
                                        layout
                                      >
                                        <p className="py-1">
                                          {subtask.description}
                                        </p>
                                        {subtask.tools &&
                                          subtask.tools.length > 0 && (
                                            <div className="mt-0.5 mb-1 flex flex-wrap items-center gap-1">
                                              <span
                                                className="font-medium"
                                                style={{
                                                  color: "var(--text-500)",
                                                }}
                                              >
                                                Tools:
                                              </span>
                                              {subtask.tools.map(
                                                (tool, idx) => (
                                                  <motion.span
                                                    key={idx}
                                                    className="rounded px-1.5 py-0.5 font-medium"
                                                    style={{
                                                      fontSize: "9px",
                                                      backgroundColor:
                                                        "rgba(var(--neon-rgb), 0.1)",
                                                      color:
                                                        "var(--neon-color)",
                                                    }}
                                                    initial={{
                                                      opacity: 0,
                                                      y: -5,
                                                    }}
                                                    animate={{
                                                      opacity: 1,
                                                      y: 0,
                                                      transition: {
                                                        duration: 0.2,
                                                        delay: idx * 0.05,
                                                      },
                                                    }}
                                                  >
                                                    {tool}
                                                  </motion.span>
                                                )
                                              )}
                                            </div>
                                          )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.li>
                              );
                            })}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </LayoutGroup>
      </motion.div>
    </div>
  );
}

export default AgentPlan;
