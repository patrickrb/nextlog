import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Chip is the canonical pill-shaped status indicator from the new design.
 * Use this for callsign chips, QSL status, propagation indicators, etc.
 * For non-status decorative pills (band/mode selectors), use <Pill> instead.
 */
const chipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap transition-colors font-mono",
  {
    variants: {
      variant: {
        default: "bg-bg-2 border-line-hi text-fg-1",
        accent: "bg-accent-soft border-accent-glow text-accent-hi",
        ok: "bg-ok/10 border-ok/25 text-ok",
        warn: "bg-warn/10 border-warn/25 text-warn",
        bad: "bg-bad/10 border-bad/25 text-bad",
        info: "bg-info/10 border-info/25 text-info",
      },
      size: {
        default: "px-2.5 py-1 text-[13px] font-medium",
        sm: "px-2 py-0.5 text-[12px] font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {
  asChild?: boolean
}

const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, variant, size, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(chipVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Chip.displayName = "Chip"

export { Chip, chipVariants }
