import * as React from "react"

import { cn } from "@/lib/utils"

interface Pin {
  /** percentage from left (0-100) */
  x: number
  /** percentage from top (0-100) */
  y: number
  tone?: "accent" | "ok" | "muted"
}

interface Arc {
  /** SVG path d attribute (assumes the SVG has the same dimensions as the container) */
  d: string
  tone?: "accent" | "ok"
}

interface WorldBackdropProps extends React.HTMLAttributes<HTMLDivElement> {
  pins?: Pin[]
  arcs?: Arc[]
  /** Renders an additional dotted grid overlay on top of the world silhouette. */
  grid?: boolean
}

const pinTone = {
  accent: {
    bg: "var(--accent)",
    halo: "var(--accent-soft)",
    glow: "var(--accent-glow)",
    size: "0 0 0 4px var(--accent-soft), 0 0 16px var(--accent-glow)",
  },
  ok: {
    bg: "var(--ok)",
    halo: "rgba(94,234,212,0.12)",
    glow: "rgba(94,234,212,0.4)",
    size: "0 0 0 4px rgba(94,234,212,0.12), 0 0 14px rgba(94,234,212,0.4)",
  },
  muted: {
    bg: "var(--fg-3)",
    halo: "rgba(255,255,255,0.04)",
    glow: "transparent",
    size: "0 0 0 3px rgba(255,255,255,0.04)",
  },
} as const

/**
 * Decorative SVG world silhouette + grid overlay used by landing preview,
 * dashboard map, new-contact mini-map. Pins and arcs are positioned via
 * percentages relative to the container.
 */
const WorldBackdrop = React.forwardRef<HTMLDivElement, WorldBackdropProps>(
  ({ className, pins = [], arcs = [], grid = true, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden",
        className
      )}
      style={{
        background:
          "radial-gradient(circle at 30% 40%, rgba(77,208,255,0.10), transparent 50%), radial-gradient(circle at 70% 60%, rgba(167,139,250,0.08), transparent 50%), linear-gradient(180deg, #0d1320, #0a0e16)",
      }}
      {...props}
    >
      <svg
        viewBox="0 0 1000 500"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full opacity-[0.13]"
        aria-hidden="true"
      >
        <g fill="#7fdfff">
          <path d="M150 120 q40 -30 100 -10 q60 20 110 5 q50 30 -10 70 q-40 20 -90 0 q-60 -10 -110 -15 z" />
          <path d="M280 220 q30 -10 80 30 q40 60 -20 110 q-60 30 -100 -10 q-30 -50 40 -130 z" />
          <path d="M480 100 q60 -10 110 20 q50 30 30 80 q-40 50 -120 30 q-60 -10 -80 -60 q0 -50 60 -70 z" />
          <path d="M560 220 q40 -10 80 10 q50 40 40 100 q-40 60 -100 50 q-50 -20 -50 -90 q0 -50 30 -70 z" />
          <path d="M780 140 q60 -20 120 10 q40 40 0 90 q-50 40 -120 20 q-50 -20 -40 -70 q10 -40 40 -50 z" />
          <path d="M820 340 q40 -10 80 20 q20 30 -20 50 q-50 20 -80 0 q-20 -30 20 -70 z" />
        </g>
      </svg>

      {grid ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent 0 39px, rgba(255,255,255,0.025) 39px 40px), repeating-linear-gradient(90deg, transparent 0 39px, rgba(255,255,255,0.025) 39px 40px)",
          }}
        />
      ) : null}

      {arcs.length > 0 ? (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          {arcs.map((arc, i) => (
            <path
              key={i}
              d={arc.d}
              fill="none"
              stroke={arc.tone === "ok" ? "var(--ok)" : "var(--accent)"}
              strokeWidth="1.2"
              strokeDasharray="3 4"
              opacity="0.4"
            />
          ))}
        </svg>
      ) : null}

      {pins.map((pin, i) => {
        const tone = pinTone[pin.tone ?? "accent"]
        return (
          <span
            key={i}
            aria-hidden="true"
            className="absolute w-2.5 h-2.5 rounded-full"
            style={{
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              transform: "translate(-50%, -50%)",
              background: tone.bg,
              boxShadow: tone.size,
            }}
          />
        )
      })}

      {children}
    </div>
  )
)
WorldBackdrop.displayName = "WorldBackdrop"

export { WorldBackdrop }
export type { Pin, Arc }
