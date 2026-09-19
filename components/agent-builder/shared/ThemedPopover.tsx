"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"

const ThemedPopover = PopoverPrimitive.Root

const ThemedPopoverTrigger = PopoverPrimitive.Trigger

const ThemedPopoverAnchor = PopoverPrimitive.Anchor

const ThemedPopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-lg border p-3 shadow-lg outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1",
        "data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      style={{
        borderColor: 'rgba(var(--neon-rgb), 0.3)',
        backgroundColor: 'var(--bg-200)',
        color: 'var(--text-100)',
      }}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
ThemedPopoverContent.displayName = PopoverPrimitive.Content.displayName

export {
  ThemedPopover,
  ThemedPopoverTrigger,
  ThemedPopoverContent,
  ThemedPopoverAnchor,
}
