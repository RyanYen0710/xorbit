import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { Logo } from '@orbit/ui'

/** Pages rendered inside Settings skip their own header and title. */
export const EmbedContext = createContext(false)

export function Page({
  index,
  label,
  title,
  children,
  wide,
}: {
  index: string
  label: string
  title: string
  children: ReactNode
  wide?: boolean
}) {
  const embedded = useContext(EmbedContext)
  useEffect(() => {
    if (!embedded) document.title = title
  }, [title, embedded])
  if (embedded) return <div className="embedded">{children}</div>
  return (
    <div className="page" data-wide={wide}>
      <header className="page-head">
        <Logo size={18} />
        <span className="orbit-label">X ORBIT</span>
        <span className="orbit-label dim">
          {index} / {label}
        </span>
      </header>
      <h1 className="orbit-display page-title">{title}</h1>
      {children}
    </div>
  )
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="srow">
      <div className="srow-text">
        <div className="srow-label">{label}</div>
        {hint && <div className="srow-hint">{hint}</div>}
      </div>
      <div className="srow-ctl">{children}</div>
    </div>
  )
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="toggle"
      data-on={on}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-block">
      <div className="orbit-label">{title}</div>
      {children && <p>{children}</p>}
    </div>
  )
}

export const fmtBytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(0)} KB`
      : n < 1073741824
        ? `${(n / 1048576).toFixed(1)} MB`
        : `${(n / 1073741824).toFixed(2)} GB`
