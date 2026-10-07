import { useState } from 'react'
import { Icon } from '../icons'
import { act, hostOf, useOrbit } from '../state'
import { Empty, Page } from './shared'

export default function Pins() {
  const s = useOrbit()!
  const [msg, setMsg] = useState('')
  return (
    <Page index="04" label="PINS" title="Pins">
      <p className="lede">
        Pins are X Orbit’s bookmarks. Pin the current page with{' '}
        {s.platform === 'darwin' ? '⌘D' : 'Ctrl+D'}; each Space keeps its own pins.
      </p>
      <div className="toolbar">
        <button className="btn ghost" onClick={() => act('exportPins')}>
          Export JSON
        </button>
        <button className="btn ghost" onClick={async () => setMsg(await act('importPins'))}>
          Import JSON
        </button>
        {(['chrome', 'edge', 'brave'] as const).map((b) => (
          <button
            key={b}
            className="btn ghost"
            onClick={async () => setMsg(await act('importBookmarks', { browser: b }))}
          >
            Import from {b[0].toUpperCase() + b.slice(1)}
          </button>
        ))}
        {msg && <span className="orbit-label">{msg}</span>}
      </div>
      {s.pins.length === 0 && (
        <Empty title="NO PINS YET">Pin a page to keep it one click away.</Empty>
      )}
      {s.spaces.map((sp) => {
        const pins = s.pins.filter((p) => p.spaceId === sp.id)
        if (!pins.length) return null
        return (
          <section key={sp.id} className="hist-group">
            <div className="orbit-label hist-label">
              <span style={{ color: sp.color }}>●</span> {sp.name}
            </div>
            {pins.map((p) => (
              <div
                className="hist-row"
                key={p.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/pin', p.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('text/pin')
                  if (id) void act('movePin', { id, beforeId: p.id })
                }}
              >
                <span className="hist-time">
                  {p.favicon && <img src={p.favicon} alt="" width={14} height={14} />}
                </span>
                <a
                  href="#"
                  className="hist-title"
                  onClick={(e) => {
                    e.preventDefault()
                    void act('navigate', { url: p.url, newTab: true })
                  }}
                >
                  {p.title}
                </a>
                <span className="hist-host">{hostOf(p.url)}</span>
                <button
                  className="icon-btn"
                  aria-pressed={p.favorite !== false}
                  aria-label={`${p.favorite !== false ? 'Unpin from' : 'Pin to'} sidebar: ${p.title}`}
                  title={p.favorite !== false ? 'Pinned to the sidebar' : 'Pin to the sidebar'}
                  onClick={() => act('favoritePin', { id: p.id })}
                  style={{ color: p.favorite !== false ? 'var(--orbit-accent)' : undefined }}
                >
                  <Icon n="pin" size={14} />
                </button>
                <input
                  className="field folder"
                  placeholder="Folder"
                  aria-label={`Folder for ${p.title}`}
                  defaultValue={p.folder}
                  onBlur={(e) =>
                    e.target.value !== p.folder &&
                    act('updatePin', { id: p.id, folder: e.target.value })
                  }
                />
                <button
                  className="icon-btn"
                  aria-label={`Unpin ${p.title}`}
                  onClick={() => act('unpin', { id: p.id })}
                >
                  <Icon n="close" size={14} />
                </button>
              </div>
            ))}
          </section>
        )
      })}
    </Page>
  )
}
