'use client'
import { useEffect, useState } from 'react'
import type { Asset } from '@/lib/site'

type OS = 'mac' | 'win' | 'other'
interface Props {
  mac: Asset | null
  macIntel: Asset | null
  win: Asset | null
  linux: Asset[]
  hasRepo: boolean
}
const size = (n: number) => `${(n / 1048576).toFixed(0)} MB`

export function DownloadCards({ mac, macIntel, win, linux, hasRepo }: Props) {
  const [os, setOs] = useState<OS>('other')
  useEffect(() => {
    const ua = navigator.userAgent
    setOs(/Mac/i.test(ua) ? 'mac' : /Win/i.test(ua) ? 'win' : 'other')
  }, [])
  const cards = [
    {
      id: 'mac' as const,
      title: 'DOWNLOAD FOR MAC',
      sub: 'Apple Silicon (M1 and newer) · macOS 12+',
      asset: mac,
      missing: hasRepo ? 'Not in the latest release' : 'No release published yet',
    },
    {
      id: 'win' as const,
      title: 'WINDOWS',
      sub: '64-bit · Windows 10+',
      asset: win,
      missing: 'Coming soon',
    },
  ].sort((a) => (a.id === os ? -1 : 1))
  return (
    <div className="dl-grid">
      {cards.map((c) => (
        <div className="dl-card" key={c.id} data-primary={c.id === os}>
          <div className="label">
            {c.id === os ? 'DETECTED / ' : ''}
            {c.id === 'mac' ? 'macOS' : 'WINDOWS'}
          </div>
          <h3 className="display">{c.title}</h3>
          <p className="muted">{c.sub}</p>
          {c.asset ? (
            // a direct link to the installer file: the browser saves it to the Downloads folder
            <a className="btn" href={c.asset.url} download>
              DOWNLOAD · {size(c.asset.size)}
            </a>
          ) : (
            <button className="btn" disabled aria-describedby={`m-${c.id}`}>
              {c.id === 'win' ? 'COMING SOON' : 'DOWNLOAD'}
            </button>
          )}
          {!c.asset && c.id !== 'win' && (
            <p className="label" id={`m-${c.id}`}>
              {c.missing}
            </p>
          )}
        </div>
      ))}
      <div className="dl-other">
        <div className="label">OTHER PLATFORMS</div>
        <ul>
          <li>
            {macIntel ? (
              <a href={macIntel.url}>macOS · Intel ({size(macIntel.size)})</a>
            ) : (
              <span className="muted">Mac with an Intel chip — not available yet</span>
            )}
          </li>
          {linux.length ? (
            linux.map((a) => (
              <li key={a.name}>
                <a href={a.url}>
                  {a.name} ({size(a.size)})
                </a>
              </li>
            ))
          ) : (
            <li className="muted">Linux — not available yet</li>
          )}
        </ul>
      </div>
    </div>
  )
}
