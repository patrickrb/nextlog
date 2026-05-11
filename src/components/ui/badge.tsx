import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badge maps to the new design's `.chip` pattern: a rounded pill with
 * optional leading dot, mono font, and tone variants. Backwards-compatible
 * with the previous shadcn Badge API; new variants `accent`/`ok`/`warn`/`bad`
 * map directly to the new design.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium font-mono whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-bg-2 border-line-hi text-fg-1",
        secondary:
          "bg-bg-2 border-line-hi text-fg-1",
        accent:
          "bg-accent-soft border-accent-glow text-accent-hi",
        ok:
          "bg-ok/10 border-ok/25 text-ok",
        warn:
          "bg-warn/10 border-warn/25 text-warn",
        bad:
          "bg-bad/10 border-bad/25 text-bad",
        info:
          "bg-info/10 border-info/25 text-info",
        outline:
          "border-line-hi bg-transparent text-fg",
        destructive:
          "bg-bad/10 border-bad/25 text-bad",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
