import { useEffect, useState } from 'react'
import { Logo } from '@orbit/ui'
import { PROVIDERS } from '@orbit/search'
import { act, hostOf, useOrbit } from '../state'

const SHOWN = 18

function Fav({ url, src }: { url: string; src: string }) {
  const [bad, setBad] = useState(false)
  return src && !bad ? (
    <img src={src} alt="" width={24} height={24} onError={() => setBad(true)} />
  ) : (
    <span className="mono">{(hostOf(url)[0] ?? '·').toUpperCase()}</span>
  )
}

export default function NewTab() {
  const s = useOrbit()!
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  useEffect(() => {
    document.title = 'New Tab'
  }, [])
  const bookmarks = s.pins.filter((p) => p.spaceId === s.activeSpaceId)
  const shown = all ? bookmarks : bookmarks.slice(0, SHOWN)
  const recent = s.tabs
    .filter((t) => !t.url.startsWith('orbit://') && t.spaceId === s.activeSpaceId)
    .sort((a, b) => b.lastActive - a.lastActive)
    .slice(0, 4)
  const space = s.spaces.find((x) => x.id === s.activeSpaceId)
  const provider = s.settings.searchProvider
  return (
    <main className="newtab">
      <div className="horizon" aria-hidden="true" />
      <div className="nt-center">
        <Logo size={44} />
        <div className="orbit-display nt-word">X ORBIT</div>
        {s.private && (
          <p className="nt-private">
            <b>ORBIT PRIVATE.</b> Pages you visit here are not written to your local browsing
            history and cookies are discarded when the window closes. Websites, your network and
            your internet provider can still see your activity.
          </p>
        )}
        <form
          className="nt-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim()) void act('navigate', { input: q })
          }}
          role="search"
        >
          <input
            autoFocus
            className="nt-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search or enter address"
            aria-label="Search or enter address"
            spellCheck={false}
          />
        </form>
        <div className="nt-engines" role="group" aria-label="Search engine">
          <span className="orbit-label">SEARCH /</span>
          {(['google', 'bing'] as const).map((id) => (
            <button
              key={id}
              aria-pressed={provider === id}
              onClick={() => act('setSetting', { key: 'searchProvider', value: id })}
            >
              {PROVIDERS[id].label}
            </button>
          ))}
          {provider !== 'google' && provider !== 'bing' && (
            <span className="orbit-label">· {PROVIDERS[provider].label.toUpperCase()}</span>
          )}
          {space && <span className="orbit-label">&nbsp;·&nbsp; SPACE / {space.name}</span>}
        </div>

        {bookmarks.length > 0 ? (
          <section className="bm" aria-label="Bookmarks">
            <div className="bm-grid">
              {shown.map((p) => {
                const fav = p.favorite !== false
                return (
                  <div className="bm-tile" key={p.id}>
                    <a
                      href="#"
                      title={p.url}
                      onClick={(e) => {
                        e.preventDefault()
                        void act('navigate', { url: p.url })
                      }}
                    >
                      <span className="bm-ico">
                        <Fav url={p.url} src={p.favicon} />
                      </span>
                      <span className="bm-title">{p.title}</span>
                    </a>
                    <button
                      className="bm-pin"
                      aria-pressed={fav}
                      aria-label={
                        fav ? `Unpin ${p.title} from the sidebar` : `Pin ${p.title} to the sidebar`
                      }
                      title={fav ? 'Pinned to the sidebar' : 'Pin to the sidebar'}
                      onClick={() => act('favoritePin', { id: p.id })}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill={fav ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      >
                        <path d="M7 4h10v16l-5-4-5 4z" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
            {bookmarks.length > SHOWN && (
              <button className="bm-more orbit-label" onClick={() => setAll(!all)}>
                {all ? 'SHOW LESS' : `SHOW ALL ${bookmarks.length}`}
              </button>
            )}
          </section>
        ) : (
          <p className="orbit-label bm-empty">
            Press {s.platform === 'darwin' ? '⌘' : 'Ctrl+'}D to pin a page ·{' '}
            {s.platform === 'darwin' ? '⌘⇧' : 'Ctrl+Shift+'}D to bookmark it
          </p>
        )}

        {bookmarks.length === 0 && recent.length > 0 && (
          <div className="nt-recent">
            <div className="orbit-label">RECENT TABS</div>
            {recent.map((t) => (
              <a
                key={t.id}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  void act('activateTab', { id: t.id })
                }}
              >
                {t.title || hostOf(t.url)} <span>{hostOf(t.url)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
