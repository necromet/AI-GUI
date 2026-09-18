"use client"

import * as React from "react"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const ThemedCollapsible = CollapsiblePrimitive.Root

const ThemedCollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger> & {
    label?: string
  }
>(({ className, label, children, ...props }, ref) => (
  <CollapsiblePrimitive.Trigger
    ref={ref}
    className={cn(
      "flex items-center gap-1.5 w-full text-[10px] font-medium uppercase tracking-wider cursor-pointer transition-colors",
      className,
    )}
    style={{ color: 'var(--text-500)' }}
    {...props}
  >
    <ChevronRight
      size={12}
      className="transition-transform duration-200 [[data-state=open]>&]:rotate-90"
    />
    {label || children}
  </CollapsiblePrimitive.Trigger>
))
ThemedCollapsibleTrigger.displayName = "ThemedCollapsibleTrigger"

const ThemedCollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden",
      "data-[state=closed]:animate-[collapsible-up_200ms_ease-out]",
      "data-[state=open]:animate-[collapsible-down_200ms_ease-out]",
      className,
    )}
    {...props}
  >
    <div className="pt-3 space-y-4">
      {children}
    </div>
  </CollapsiblePrimitive.Content>
))
ThemedCollapsibleContent.displayName = "ThemedCollapsibleContent"

export {
  ThemedCollapsible,
  ThemedCollapsibleTrigger,
  ThemedCollapsibleContent,
}
