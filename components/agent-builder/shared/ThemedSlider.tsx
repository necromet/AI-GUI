"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

const ThemedSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center h-5",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track
      className="relative h-1.5 w-full grow rounded-full"
      style={{ backgroundColor: 'var(--bg-300)' }}
    >
      <SliderPrimitive.Range
        className="absolute h-full rounded-full"
        style={{ backgroundColor: 'var(--neon-color)' }}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-4 w-4 rounded-full shadow-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--neon-color)] disabled:pointer-events-none disabled:opacity-50"
      style={{
        backgroundColor: 'white',
        border: '2px solid var(--neon-color)',
      }}
    />
  </SliderPrimitive.Root>
))
ThemedSlider.displayName = SliderPrimitive.Root.displayName

export { ThemedSlider }
