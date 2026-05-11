"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface PillProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

/**
 * Pill is the toggle-style button used for band/mode selectors on the
 * new contact page. For status indicators, use <Chip> instead.
 */
const Pill = React.forwardRef<HTMLButtonElement, PillProps>(
  ({ className, active, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      data-state={active ? "on" : "off"}
      className={cn(
        "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border font-mono text-[14px] transition-colors cursor-pointer",
        active
          ? "bg-accent-soft border-accent-glow text-accent-hi"
          : "bg-bg-1 border-line-hi text-fg-1 hover:bg-bg-3 hover:text-fg",
        className
      )}
      {...props}
    />
  )
)
Pill.displayName = "Pill"

const PillGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="group"
    className={cn("flex flex-wrap gap-2", className)}
    {...props}
  />
))
PillGroup.displayName = "PillGroup"

export { Pill, PillGroup }
