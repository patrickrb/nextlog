import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-[#051018] border border-accent font-semibold shadow-primary hover:bg-accent-hi hover:border-accent-hi",
        secondary:
          "bg-bg-2 text-fg border border-line-hi hover:bg-bg-3 hover:border-white/20",
        outline:
          "border border-line-hi bg-transparent text-fg hover:bg-bg-2",
        ghost:
          "border border-transparent bg-transparent text-fg-1 hover:bg-white/5 hover:text-fg",
        destructive:
          "bg-bad text-[#051018] border border-bad font-semibold hover:opacity-90",
        link:
          "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 text-[15px] rounded-[10px] [&_svg]:size-4",
        sm: "h-8 px-3 text-[13px] rounded-[8px] [&_svg]:size-3.5",
        lg: "h-12 px-[22px] text-[17px] rounded-[12px] [&_svg]:size-[18px]",
        icon: "h-[38px] w-[38px] rounded-[10px] [&_svg]:size-[18px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
