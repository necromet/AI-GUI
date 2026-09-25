"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

const ThemedSelect = SelectPrimitive.Root

const ThemedSelectGroup = SelectPrimitive.Group

const ThemedSelectValue = SelectPrimitive.Value

const ThemedSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-8 w-full min-w-0 max-w-full items-center justify-between gap-2 overflow-hidden rounded-lg border px-2.5 py-2 text-xs outline-none",
      "transition-colors cursor-pointer",
      "focus:border-[var(--neon-color)] focus:ring-1 focus:ring-inset focus:ring-[var(--neon-color)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "[&>span]:min-w-0 [&>span]:truncate",
      className,
    )}
    style={{
      borderColor: 'var(--border-300)',
      color: 'var(--text-100)',
      backgroundColor: 'transparent',
    }}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
ThemedSelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const ThemedSelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="h-3.5 w-3.5" style={{ color: 'var(--text-500)' }} />
  </SelectPrimitive.ScrollUpButton>
))
ThemedSelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const ThemedSelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--text-500)' }} />
  </SelectPrimitive.ScrollDownButton>
))
ThemedSelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

const ThemedSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-72 min-w-[8rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      style={{
        borderColor: 'rgba(var(--neon-rgb), 0.3)',
        backgroundColor: 'var(--bg-200)',
        color: 'var(--text-100)',
      }}
      position={position}
      collisionPadding={8}
      {...props}
    >
      <ThemedSelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <ThemedSelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
ThemedSelectContent.displayName = SelectPrimitive.Content.displayName

const ThemedSelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      "px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider",
      className,
    )}
    style={{ color: 'var(--text-500)' }}
    {...props}
  />
))
ThemedSelectLabel.displayName = SelectPrimitive.Label.displayName

const ThemedSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & { displayText?: string }
>(({ className, children, displayText, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full min-w-0 cursor-default select-none items-center overflow-hidden rounded-md py-1.5 pl-7 pr-2 text-xs outline-none",
      "focus:bg-[var(--bg-300)] focus:text-[var(--text-100)]",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "transition-colors",
      displayText !== undefined && "items-start",
      className,
    )}
    style={{ color: 'var(--text-300)' }}
    {...props}
  >
    <span className="absolute left-1.5 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5" style={{ color: 'var(--neon-color)' }} />
      </SelectPrimitive.ItemIndicator>
    </span>
    {displayText !== undefined ? (
      <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
        <SelectPrimitive.ItemText>{displayText}</SelectPrimitive.ItemText>
        {children && <span className="truncate text-[9px] leading-tight opacity-60">{children}</span>}
      </div>
    ) : (
      <SelectPrimitive.ItemText>
        <span className="block min-w-0 truncate">{children}</span>
      </SelectPrimitive.ItemText>
    )}
  </SelectPrimitive.Item>
))
ThemedSelectItem.displayName = SelectPrimitive.Item.displayName

const ThemedSelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px", className)}
    style={{ backgroundColor: 'var(--border-300)' }}
    {...props}
  />
))
ThemedSelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  ThemedSelect,
  ThemedSelectGroup,
  ThemedSelectValue,
  ThemedSelectTrigger,
  ThemedSelectContent,
  ThemedSelectLabel,
  ThemedSelectItem,
  ThemedSelectSeparator,
  ThemedSelectScrollUpButton,
  ThemedSelectScrollDownButton,
}
