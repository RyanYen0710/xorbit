import { useEffect, useRef, useState } from 'react'
import type { PermissionKey, SiteInfo, Suggestion, UIState } from '@orbit/types'
import { Icon } from '../icons'
import { act, hostOf, kbdLabel, query, useOrbit } from '../state'

const KIND_ICON: Record<string, string> = {
  url: 'external',
  search: 'search',
  tab: 'panel',
  pin: 'pin',
  history: 'history',
  command: 'chevron',
  calc: 'check',
}

function Omni({ s, palette }: { s: UIState; palette: boolean }) {
  const [text, setText] = useState(s.overlay.text)
  const [items, setItems] = useState<Suggestion[]>([])
  const [sel, setSel] = useState(0)
  const [itemsFor, setItemsFor] = useState('')
  const seq = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  const mac = s.platform === 'darwin'

  useEffect(() => {
    setText(s.overlay.text)
    input.current?.focus()
    input.current?.setSelectionRange(9999, 9999)
  }, [s.overlay.seq, s.overlay.text])
  useEffect(() => {
    const n = ++seq.current
    void query(palette ? 'commands' : 'suggest', { text }).then((r: Suggestion[]) => {
      if (n === seq.current) {
        setItemsFor(text)
        setItems(r)
        setSel(0)
      }
    })
  }, [text, palette, s.overlay.seq])

  const run = async (it: Suggestion | undefined, newTab: boolean) => {
    await act('closeOverlay')
    if (it) {
      const payload = it.run.type === 'navigate' ? { ...it.run.payload, newTab } : it.run.payload
      await act(it.run.type, payload)
    } else if (text.trim() && !palette) await act('navigate', { input: text, newTab })
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      void act('closeOverlay')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void run(itemsFor === text || palette ? items[sel] : undefined, e.metaKey || e.ctrlKey)
    }
  }
  const list = (
    <ul className="omni-list" role="listbox" aria-label={palette ? 'Commands' : 'Suggestions'}>
      {items.map((it, i) => (
        <li
          key={it.id}
          role="option"
          aria-selected={i === sel}
          data-sel={i === sel}
          onMouseMove={() => setSel(i)}
          onClick={() => run(it, false)}
        >
          {it.favicon ? (
            <img className="fav" src={it.favicon} alt="" />
          ) : (
            <span className="omni-ico">
              <Icon n={KIND_ICON[it.kind] ?? 'search'} size={14} />
            </span>
          )}
          <span className="omni-title">{it.title}</span>
          <span className="omni-sub">
            {palette && it.sub?.includes('+') ? kbdLabel(it.sub, mac) : it.sub}
          </span>
        </li>
      ))}
    </ul>
  )
  return (
    <div
      className="scrim"
      data-palette={palette}
      onMouseDown={(e) => e.target === e.currentTarget && void act('closeOverlay')}
    >
      <div
        className="omni"
        data-palette={palette}
        role="dialog"
        aria-label={palette ? 'Orbit Command' : 'Orbit Bar'}
      >
        {palette && <div className="orbit-label omni-head">ORBIT COMMAND</div>}
        {palette && list}
        <div className="omni-input">
          <Icon n={palette ? 'chevron' : 'search'} size={16} />
          <input
            ref={input}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder={
              palette ? 'Type a command…' : 'Search, enter address, @tabs, @history, /settings'
            }
            aria-label={palette ? 'Command' : 'Search or enter address'}
          />
          <kbd>esc</kbd>
        </div>
        {!palette && list}
      </div>
    </div>
  )
}

function Compact({ s }: { s: UIState }) {
  const tab = s.tabs.find((t) => t.id === s.activeTabId)
  const host = tab ? hostOf(tab.url) : ''
  const secure = tab?.url.startsWith('https:')
  return (
    <button
      className="pill"
      onClick={() => act('overlay', { mode: 'bar' })}
      aria-label="Open Orbit Bar"
    >
      {host ? <Icon n={secure ? 'lock' : 'unlock'} size={13} /> : <Icon n="search" size={13} />}
      <span className="pill-text">{host || 'Search or enter address'}</span>
      <kbd>{kbdLabel('Mod+L', s.platform === 'darwin')}</kbd>
    </button>
  )
}

const PERMS: [PermissionKey, string][] = [
  ['camera', 'Camera'],
  ['microphone', 'Microphone'],
  ['geolocation', 'Location'],
  ['notifications', 'Notifications'],
]

function Site({ s }: { s: UIState }) {
  const [info, setInfo] = useState<SiteInfo | null>(null)
  const load = () => query('site', {}).then(setInfo)
  useEffect(() => {
    void load()
  }, [s.overlay.seq, s.settings, s.tabs.length])
  const close = () => act('closeOverlay')
  return (
    <div
      className="scrim site-scrim"
      onMouseDown={(e) => e.target === e.currentTarget && void close()}
    >
      <div
        className="site-panel"
        style={{ right: s.settings.railPosition === 'right' ? s.pageRect.width - 380 : 16 }}
        role="dialog"
        aria-label="Site information"
      >
        {info ? (
          <>
            <div className="site-host">
              <span className="orbit-display">x</span> {info.host}
            </div>
            <div className="orbit-label">CONNECTION</div>
            <div className="site-row">
              <span>
                {info.internal
                  ? 'Built-in page'
                  : info.secure
                    ? 'Secure (HTTPS)'
                    : 'Not secure (HTTP)'}
              </span>
            </div>
            {!info.internal && (
              <>
                <div className="orbit-label">PERMISSIONS</div>
                {PERMS.map(([k, label]) => (
                  <label className="site-row" key={k}>
                    <span>{label}</span>
                    <select
                      value={info.perms[k]}
                      onChange={(e) =>
                        act('sitePerm', { origin: info.origin, perm: k, value: e.target.value })
                      }
                      aria-label={`${label} permission`}
                    >
                      <option value="allow">Allow</option>
                      <option value="ask">Ask</option>
                      <option value="block">Blocked</option>
                    </select>
                  </label>
                ))}
                <div className="orbit-label">DATA</div>
                <div className="site-row">
                  <span>
                    {info.cookies} cookie{info.cookies === 1 ? '' : 's'}
                  </span>
                  <button
                    className="link"
                    onClick={async () => {
                      await act('clearSiteCookies', {})
                      void load()
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="site-note">
                  Third-party cookies: {s.settings.blockThirdPartyCookies ? 'blocked' : 'allowed'}.
                  JavaScript: {s.settings.javascript ? 'on' : 'off'}.
                </div>
              </>
            )}
          </>
        ) : (
          <div className="site-row">No page</div>
        )}
      </div>
    </div>
  )
}

function Find({ s }: { s: UIState }) {
  const [q, setQ] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [s.overlay.seq])
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') void act('closeOverlay')
    if (e.key === 'Enter') void act('find', { text: q, forward: !e.shiftKey, next: true })
  }
  return (
    <div className="find" role="search">
      <input
        ref={ref}
        value={q}
        placeholder="Find in page"
        aria-label="Find in page"
        onKeyDown={key}
        onChange={(e) => {
          setQ(e.target.value)
          void act('find', { text: e.target.value })
        }}
      />
      <span className="orbit-label">{q ? `${s.find.active}/${s.find.total}` : ''}</span>
      <button
        className="icon-btn"
        aria-label="Previous match"
        onClick={() => act('find', { text: q, forward: false, next: true })}
      >
        <Icon n="back" size={14} />
      </button>
      <button
        className="icon-btn"
        aria-label="Next match"
        onClick={() => act('find', { text: q, forward: true, next: true })}
      >
        <Icon n="forward" size={14} />
      </button>
      <button className="icon-btn" aria-label="Close find" onClick={() => act('closeOverlay')}>
        <Icon n="close" size={14} />
      </button>
    </div>
  )
}

export function Overlay() {
  const s = useOrbit()!
  switch (s.overlay.mode) {
    case 'compact':
      return <Compact s={s} />
    case 'bar':
      return <Omni s={s} palette={false} />
    case 'palette':
      return <Omni s={s} palette />
    case 'site':
      return <Site s={s} />
    case 'find':
      return <Find s={s} />
    default:
      return null
  }
}
