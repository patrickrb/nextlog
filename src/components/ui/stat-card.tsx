import * as React from "react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  fraction?: React.ReactNode
  delta?: React.ReactNode
  deltaTone?: "ok" | "warn" | "bad" | "muted"
}

const deltaToneClass = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  muted: "text-fg-2",
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, label, value, fraction, delta, deltaTone = "ok", ...props }, ref) => (
    <Card
      ref={ref}
      className={cn(
        "flex flex-col gap-1.5 px-6 py-5",
        className
      )}
      {...props}
    >
      <div className="text-[13px] uppercase tracking-[0.08em] font-medium text-fg-2">
        {label}
      </div>
      <div className="font-mono text-[38px] font-semibold leading-[1.1] tracking-[-0.02em] text-fg">
        {value}
        {fraction ? (
          <span className="text-[18px] text-fg-2 font-medium ml-1">
            / {fraction}
          </span>
        ) : null}
      </div>
      {delta ? (
        <div className={cn("text-[13px] font-mono", deltaToneClass[deltaTone])}>
          {delta}
        </div>
      ) : null}
    </Card>
  )
)
StatCard.displayName = "StatCard"

export { StatCard }
