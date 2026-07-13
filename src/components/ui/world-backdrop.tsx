import * as React from "react"

import { cn } from "@/lib/utils"

interface Pin {
  /** map x in viewBox units (0-1000). Use projectLonLat() to convert from longitude. */
  x: number
  /** map y in viewBox units (0-500). Use projectLonLat() to convert from latitude. */
  y: number
  tone?: "accent" | "ok" | "muted"
}

interface Arc {
  /** SVG path d attribute in map viewBox units (0-1000 x 0-500) */
  d: string
  tone?: "accent" | "ok"
}

interface WorldBackdropProps extends React.HTMLAttributes<HTMLDivElement> {
  pins?: Pin[]
  arcs?: Arc[]
  /** Renders an additional dotted grid overlay on top of the world map. */
  grid?: boolean
}

/** Equirectangular projection: lon/lat degrees -> map viewBox units (0-1000 x 0-500). Inputs are clamped to [-180,180] / [-90,90]. */
function projectLonLat(lon: number, lat: number): { x: number; y: number } {
  const clampedLon = Math.min(180, Math.max(-180, lon))
  const clampedLat = Math.min(90, Math.max(-90, lat))
  return {
    x: ((clampedLon + 180) * 1000) / 360,
    y: ((90 - clampedLat) * 500) / 180,
  }
}

const pinTone = {
  accent: {
    core: "var(--accent)",
    halo: "var(--accent-soft)",
    glow: "var(--accent-glow)",
  },
  ok: {
    core: "var(--ok)",
    halo: "rgba(94,234,212,0.12)",
    glow: "rgba(94,234,212,0.4)",
  },
  muted: {
    core: "var(--fg-3)",
    halo: "rgba(255,255,255,0.04)",
    glow: "transparent",
  },
} as const

/**
 * Simplified equirectangular world landmasses, hand-traced in a
 * 1000x500 viewBox (x = (lon+180)/360 * 1000, y = (90-lat)/180 * 500).
 * Low-poly on purpose — rendered dim with rounded joins as a backdrop.
 */
const LAND_PATHS = [
  // North & Central America
  "M33 67 L67 53 L108 58 L144 56 L181 47 L236 47 L272 61 L286 75 L244 92 L261 103 L281 97 L306 83 L331 94 L347 108 L317 128 L294 142 L278 161 L278 178 L269 169 L253 168 L233 175 L231 192 L247 196 L258 187 L262 199 L272 210 L281 225 L272 228 L264 214 L236 206 L208 194 L192 186 L183 167 L175 158 L156 139 L156 117 L128 92 L78 89 L47 97 Z",
  // Greenland
  "M333 39 L375 19 L431 19 L444 39 L439 56 L381 83 L353 67 L333 47 Z",
  // Cuba / Antilles
  "M264 186 L281 188 L292 192 L289 196 L272 192 L262 189 Z",
  // South America
  "M292 219 L322 219 L356 236 L378 258 L403 272 L392 292 L386 314 L367 331 L344 350 L328 364 L317 383 L308 400 L294 397 L294 378 L300 353 L303 319 L306 300 L289 292 L275 267 L278 250 L286 233 L283 225 Z",
  // Africa
  "M475 161 L483 151 L508 147 L528 146 L531 156 L556 160 L589 163 L594 172 L603 194 L619 218 L642 217 L628 244 L611 261 L608 294 L597 317 L592 331 L572 346 L553 347 L547 331 L533 300 L536 281 L528 256 L525 239 L500 233 L478 238 L464 225 L453 210 L453 192 L472 169 Z",
  // Madagascar
  "M625 288 L633 283 L638 292 L636 310 L628 322 L621 314 L622 297 Z",
  // Eurasia (incl. Arabia, India, SE Asia, Scandinavia); Black Sea and
  // Caspian are evenodd hole subpaths
  "M475 131 L475 147 L486 150 L500 141 L511 131 L531 126 L544 143 L540 127 L553 140 L563 148 L570 140 L583 150 L600 149 L594 161 L597 172 L608 192 L620 216 L653 204 L667 187 L660 176 L683 181 L700 195 L714 228 L725 209 L750 190 L762 203 L770 220 L780 240 L787 247 L789 218 L795 226 L805 215 L800 196 L806 190 L825 185 L837 167 L839 148 L846 140 L852 148 L858 154 L862 133 L875 124 L890 105 L905 85 L930 110 L948 90 L970 73 L1000 66 L1000 52 L960 55 L889 47 L806 37 L760 34 L708 47 L660 57 L622 60 L610 66 L600 58 L580 52 L556 57 L534 68 L517 79 L518 89 L536 96 L558 69 L569 83 L583 83 L567 88 L553 99 L533 101 L524 92 L521 99 L514 103 L500 114 L494 117 L497 127 Z M583 126 L604 124 L612 130 L596 134 L584 132 Z M636 122 L646 126 L648 142 L640 145 L634 133 Z",
  // Great Britain
  "M494 89 L500 94 L502 103 L497 111 L490 108 L493 100 L488 95 Z",
  // Ireland
  "M474 99 L481 97 L483 104 L477 107 L473 104 Z",
  // Iceland
  "M431 69 L444 66 L448 72 L438 76 L430 73 Z",
  // Japan
  "M899 123 L906 127 L901 134 L894 129 Z",
  "M894 136 L897 143 L884 152 L869 162 L864 157 L878 148 L890 139 Z",
  // Philippines
  "M834 201 L840 206 L841 216 L836 220 L832 210 Z",
  // Sumatra
  "M764 242 L767 236 L776 244 L790 258 L787 265 L774 252 Z",
  // Borneo
  "M810 240 L822 234 L830 244 L824 258 L811 255 L804 247 Z",
  // Java
  "M791 271 L810 271 L818 274 L816 278 L797 275 Z",
  // New Guinea
  "M866 262 L884 257 L902 263 L916 271 L912 278 L893 272 L874 270 Z",
  // Australia
  "M817 311 L817 344 L864 339 L883 347 L908 356 L917 353 L925 328 L906 303 L897 281 L892 297 L878 283 L867 281 L850 289 L839 300 Z",
  // Tasmania
  "M905 364 L913 362 L915 370 L906 372 Z",
  // New Zealand
  "M978 349 L985 355 L979 363 L973 356 Z",
  "M975 363 L981 368 L972 379 L967 372 Z",
  // Antarctica (cropped strip along the bottom)
  "M0 462 L120 458 L260 464 L420 458 L560 465 L700 459 L840 464 L1000 459 L1000 500 L0 500 Z",
]

/**
 * Decorative equirectangular world map used by the landing preview.
 * Pins and arcs are drawn inside the map's SVG viewBox (0-1000 x 0-500)
 * so they stay anchored to real locations however the container crops;
 * convert coordinates with projectLonLat().
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
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <g
          fill="#7fdfff"
          fillRule="evenodd"
          stroke="#7fdfff"
          strokeWidth="3"
          strokeLinejoin="round"
          opacity="0.15"
        >
          {LAND_PATHS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>

        {arcs.map((arc, i) => (
          <path
            key={i}
            d={arc.d}
            fill="none"
            stroke={arc.tone === "ok" ? "var(--ok)" : "var(--accent)"}
            strokeWidth="1.5"
            strokeDasharray="4 5"
            opacity="0.4"
          />
        ))}

        {pins.map((pin, i) => {
          const tone = pinTone[pin.tone ?? "accent"]
          return (
            <g key={i} aria-hidden="true">
              <circle cx={pin.x} cy={pin.y} r="16" fill={tone.glow} opacity="0.35" />
              <circle cx={pin.x} cy={pin.y} r="10" fill={tone.halo} />
              <circle cx={pin.x} cy={pin.y} r="4.5" fill={tone.core} />
            </g>
          )
        })}
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

      {children}
    </div>
  )
)
WorldBackdrop.displayName = "WorldBackdrop"

export { WorldBackdrop, projectLonLat }
export type { Pin, Arc }
