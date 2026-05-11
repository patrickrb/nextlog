import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

interface BrandMarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg"
}

const sizes = {
  sm: { box: "w-6 h-6 text-xs rounded-[6px]" },
  default: { box: "w-7 h-7 text-sm rounded-[8px]" },
  lg: { box: "w-9 h-9 text-base rounded-[10px]" },
}

const BrandMark = React.forwardRef<HTMLDivElement, BrandMarkProps>(
  ({ className, size = "default", ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "grid place-items-center font-mono font-bold text-[#051018] shadow-glow",
        sizes[size].box,
        className
      )}
      style={{
        background: "linear-gradient(135deg, var(--accent), #7a9bff)",
      }}
      {...props}
    >
      N
    </div>
  )
)
BrandMark.displayName = "BrandMark"

interface BrandLockupProps extends React.HTMLAttributes<HTMLAnchorElement> {
  href?: string
  size?: "sm" | "default" | "lg"
}

const BrandLockup = React.forwardRef<HTMLAnchorElement, BrandLockupProps>(
  ({ className, href = "/", size = "default", ...props }, ref) => (
    <Link
      ref={ref}
      href={href}
      className={cn(
        "flex items-center gap-3 font-semibold text-[18px] tracking-[-0.01em] text-fg",
        className
      )}
      {...props}
    >
      <BrandMark size={size} />
      <span>nextlog</span>
    </Link>
  )
)
BrandLockup.displayName = "BrandLockup"

export { BrandMark, BrandLockup }
