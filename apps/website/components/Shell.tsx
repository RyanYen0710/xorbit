import Link from 'next/link'
import { Logo } from '@orbit/ui'
import { CHANNEL, NAV, VERSION } from '@/lib/site'

export function Header() {
  return (
    <header className="site-header">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="container bar">
        <Link href="/" className="brand" aria-label="X Orbit home">
          <Logo size={22} />
          <span>X ORBIT</span>
        </Link>
        <nav aria-label="Primary">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="foot-grid">
          <div>
            <div className="brand">
              <Logo size={22} />
              <span>X ORBIT</span>
            </div>
            <p className="muted small">A browser designed around your space, not your tabs.</p>
          </div>
          <nav aria-label="Footer">
            <Link href="/features">Browser</Link>
            <Link href="/search">Search</Link>
            <Link href="/themes">Themes</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/download">Download</Link>
            <Link href="/changelog">Changelog</Link>
            <Link href="/support">Support</Link>
            <Link href="/about">About</Link>
          </nav>
        </div>
        <div className="rule" />
        <div className="label spec">
          <span>X ORBIT</span>
          <span>BUILD {VERSION}</span>
          <span>CHANNEL / {CHANNEL}</span>
        </div>
      </div>
    </footer>
  )
}

export function Section({
  n,
  label,
  title,
  children,
  id,
}: {
  n: string
  label: string
  title: React.ReactNode
  children?: React.ReactNode
  id?: string
}) {
  return (
    <section className="section" id={id}>
      <div className="container">
        <div className="rule" />
        <div className="label sec-meta">
          <span>
            {n} / {label}
          </span>
        </div>
        <h2 className="display h2">{title}</h2>
        {children}
      </div>
    </section>
  )
}

export function Shot({
  name,
  alt,
  w = 1800,
  h = 1139,
}: {
  name: string
  alt: string
  w?: number
  h?: number
}) {
  return (
    <img
      className="shot"
      src={`/shots/${name}.png`}
      alt={alt}
      width={w}
      height={h}
      loading="lazy"
      decoding="async"
    />
  )
}

export function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="arrow-link">
      {children} <span aria-hidden="true">→</span>
    </Link>
  )
}

export function PageHead({
  n,
  label,
  title,
  lede,
}: {
  n: string
  label: string
  title: React.ReactNode
  lede?: React.ReactNode
}) {
  return (
    <section className="page-head">
      <div className="container">
        <div className="label">
          {n} / {label}
        </div>
        <h1 className="display">{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
    </section>
  )
}
