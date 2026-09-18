"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"

const ThemedTooltipProvider = TooltipPrimitive.Provider

const ThemedTooltip = TooltipPrimitive.Root

const ThemedTooltipTrigger = TooltipPrimitive.Trigger

const ThemedTooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-xs rounded-md px-2.5 py-1.5 text-[11px] shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      style={{
        backgroundColor: 'var(--bg-300)',
        color: 'var(--text-200, var(--text-300))',
        border: '1px solid var(--border-300)',
      }}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
ThemedTooltipContent.displayName = TooltipPrimitive.Content.displayName

export {
  ThemedTooltipProvider,
  ThemedTooltip,
  ThemedTooltipTrigger,
  ThemedTooltipContent,
}
