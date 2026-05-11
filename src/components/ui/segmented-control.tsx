"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface SegmentedControlOption<T extends string> {
  value: T
  label: React.ReactNode
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedControlOption<T>>
  value: T
  onChange: (value: T) => void
  className?: string
  size?: "default" | "sm"
}

/**
 * Segmented control for filter rows (24h/7d/30d/all, All/20m/SSB/FT8).
 * For full Tabs behavior use <Tabs variant="seg"> instead.
 */
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "default",
}: SegmentedControlProps<T>) {
  const triggerCls =
    size === "sm"
      ? "px-2.5 py-1 text-[12px]"
      : "px-3 py-1.5 text-[13px]"
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center rounded-[10px] border border-line-hi bg-bg-1 p-[3px] gap-0.5",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            type="button"
            className={cn(
              "rounded-[7px] font-medium transition-all cursor-pointer",
              triggerCls,
              active
                ? "bg-bg-3 text-fg"
                : "text-fg-2 hover:text-fg"
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedControl }
export type { SegmentedControlOption }
