import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const dotVariants = cva(
  "inline-block rounded-full shrink-0",
  {
    variants: {
      tone: {
        default: "bg-fg-2",
        accent: "bg-accent",
        ok: "bg-ok",
        warn: "bg-warn",
        bad: "bg-bad",
        info: "bg-info",
        muted: "bg-fg-3",
      },
      size: {
        sm: "h-1.5 w-1.5",
        default: "h-2 w-2",
        lg: "h-2.5 w-2.5",
      },
    },
    defaultVariants: {
      tone: "default",
      size: "default",
    },
  }
)

export interface DotProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof dotVariants> {
  live?: boolean
}

const Dot = React.forwardRef<HTMLSpanElement, DotProps>(
  ({ className, tone, size, live, style, ...props }, ref) => (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn(dotVariants({ tone, size }), className)}
      style={live ? { animation: "pulse-dot 1.8s infinite", ...style } : style}
      {...props}
    />
  )
)
Dot.displayName = "Dot"

export { Dot, dotVariants }
