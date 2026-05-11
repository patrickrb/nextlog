import * as React from "react"

import { cn } from "@/lib/utils"

const Kbd = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      "inline-flex items-center font-mono text-[12px] px-1.5 py-0.5 rounded-[5px] border border-line-hi bg-bg-2 text-fg-2",
      className
    )}
    {...props}
  />
))
Kbd.displayName = "Kbd"

export { Kbd }
