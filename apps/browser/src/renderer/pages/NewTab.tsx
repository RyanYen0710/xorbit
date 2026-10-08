import { useEffect, useState } from 'react'
import { Logo } from '@orbit/ui'
import { PROVIDERS } from '@orbit/search'
import { BookmarkIcon } from '../bookmark-icon'
import { act, useOrbit } from '../state'

const MAX_PINS = 8

export default function NewTab() {
  const s = useOrbit()!
  const [q, setQ] = useState('')
  useEffect(() => {
    document.title = 'New Tab'
  }, [])
  const pins = s.pins.filter((p) => p.home).slice(0, MAX_PINS)
  const space = s.spaces.find((x) => x.id === s.activeSpaceId)
  const provider = s.settings.searchProvider
  const mod = s.platform === 'darwin' ? '⌘' : 'Ctrl+'
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

        <section className="bm" aria-label="Pins">
          <div className="orbit-label bm-count-label">
            PINS · {pins.length}/{MAX_PINS}
          </div>
          <div className="bm-grid">
            {pins.map((p) => (
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
                    <BookmarkIcon url={p.url} favicon={p.favicon} size={28} />
                  </span>
                  <span className="bm-title">{p.title}</span>
                </a>
                <button
                  className="bm-pin"
                  aria-label={`Remove ${p.title} from the pins`}
                  title="Remove from pins"
                  onClick={() => act('bookmarkHome', { id: p.id })}
                >
                  ×
                </button>
              </div>
            ))}
            {pins.length < MAX_PINS && (
              <button
                className="bm-tile bm-add"
                onClick={() => act('bookmarkAddDialog', { home: true })}
                aria-label="Add a pin"
              >
                <span className="bm-ico">+</span>
                <span className="bm-title">Add pin</span>
              </button>
            )}
          </div>
          <p className="orbit-label bm-empty" role="status">
            {pins.length >= MAX_PINS
              ? `The homepage is full (${MAX_PINS} pins). Remove one to add another.`
              : `Pin up to ${MAX_PINS} sites here · ${mod}⇧D pins the page you are on · all your bookmarks live in the sidebar`}
          </p>
        </section>
      </div>
    </main>
  )
}
