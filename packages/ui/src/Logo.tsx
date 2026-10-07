import type { SVGProps } from 'react'

/** X Orbit mark: two crossing orbital trajectories forming an X, one incomplete, with a planet. Uses currentColor. */
export function Logo({ size = 24, ...p }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="X Orbit"
      {...p}
    >
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(45 32 32)" />
        <ellipse
          cx="32"
          cy="32"
          rx="27"
          ry="10"
          transform="rotate(-45 32 32)"
          pathLength="100"
          strokeDasharray="86 14"
          strokeDashoffset="-4"
        />
      </g>
      <circle cx="51.1" cy="12.9" r="4.5" fill="currentColor" />
    </svg>
  )
}

export function Wordmark({ size = 14 }: { size?: number }) {
  return (
    <span
      className="orbit-display"
      style={{ fontSize: size, letterSpacing: '0.18em', fontWeight: 600 }}
    >
      X ORBIT
    </span>
  )
}
