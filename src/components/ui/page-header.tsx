import * as React from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode
  sub?: React.ReactNode
  action?: React.ReactNode
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, sub, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-start justify-between gap-4 mb-7", className)}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="text-[32px] font-semibold tracking-[-0.02em] leading-tight text-fg mb-1">
          {title}
        </h1>
        {sub ? (
          <div className="text-[16px] text-fg-2 leading-relaxed">{sub}</div>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-3 shrink-0">{action}</div> : null}
    </div>
  )
)
PageHeader.displayName = "PageHeader"

export { PageHeader }
