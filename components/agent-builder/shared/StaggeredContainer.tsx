"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

interface StaggeredContainerProps {
  children: React.ReactNode
  className?: string
  staggerDelay?: number
  initialDelay?: number
}

export function StaggeredContainer({
  children,
  className,
  staggerDelay = 0.04,
  initialDelay = 0,
}: StaggeredContainerProps) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: initialDelay + index * staggerDelay,
            duration: 0.2,
            ease: [0.25, 0.1, 0.25, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}

interface AnimatedItemProps {
  children: React.ReactNode
  index: number
  staggerDelay?: number
  initialDelay?: number
  className?: string
}

export function AnimatedItem({
  children,
  index,
  staggerDelay = 0.04,
  initialDelay = 0,
  className,
}: AnimatedItemProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: initialDelay + index * staggerDelay,
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
