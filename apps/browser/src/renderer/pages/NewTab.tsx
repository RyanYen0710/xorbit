import { useEffect, useState } from 'react'
import { Logo } from '@orbit/ui'
import { PROVIDERS } from '@orbit/search'
import { act, hostOf, useOrbit } from '../state'

const SHOWN = 17 // + the Add tile = one tidy block

function Fav({ url, src }: { url: string; src: string }) {
  const [bad, setBad] = useState(false)
  return src && !bad ? (
    <img src={src} alt="" width={24} height={24} onError={() => setBad(true)} />
  ) : (
    <span className="mono">{(hostOf(url)[0] ?? '·').toUpperCase()}</span>
  )
}

function AddTile() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [msg, setMsg] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const r = (await act('addBookmark', { url, title })) as string
    if (r === 'Added') {
      setOpen(false)
      setUrl('')
      setTitle('')
      setMsg('')
    } else setMsg(r)
  }
  if (!open)
    return (
      <button className="bm-tile bm-add" onClick={() => setOpen(true)} aria-label="Add bookmark">
        <span className="bm-ico">+</span>
        <span className="bm-title">Add bookmark</span>
      </button>
    )
  return (
    <form className="bm-tile bm-form" onSubmit={submit}>
      <input
        autoFocus
        className="field"
        placeholder="Web address"
        aria-label="Web address"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <input
        className="field"
        placeholder="Name (optional)"
        aria-label="Name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {msg && (
        <span className="orbit-label" role="alert">
          {msg}
        </span>
      )}
      <span className="bm-form-btns">
        <button type="submit" className="btn ghost">
          Add
        </button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </span>
    </form>
  )
}

export default function NewTab() {
  const s = useOrbit()!
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    document.title = 'New Tab'
  }, [])
  const bookmarks = s.pins.filter((p) => p.spaceId === s.activeSpaceId)
  const shown = all ? bookmarks : bookmarks.slice(0, SHOWN)
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
            <AddTile />
          </div>
          {bookmarks.length > SHOWN && (
            <button className="bm-more orbit-label" onClick={() => setAll(!all)}>
              {all ? 'SHOW LESS' : `SHOW ALL ${bookmarks.length}`}
            </button>
          )}
          {bookmarks.length === 0 && (
            <div className="bm-import">
              <span className="orbit-label">IMPORT BOOKMARKS FROM</span>
              {(['chrome', 'edge', 'brave'] as const).map((b) => (
                <button
                  key={b}
                  className="btn ghost"
                  onClick={async () =>
                    setMsg((await act('importBookmarks', { browser: b })) as string)
                  }
                >
                  {b[0].toUpperCase() + b.slice(1)}
                </button>
              ))}
            </div>
          )}
          {(msg || bookmarks.length === 0) && (
            <p className="orbit-label bm-empty" role="status">
              {msg ||
                `Or open a page and press ${mod}D to pin it · ${s.platform === 'darwin' ? '⌘⇧' : 'Ctrl+Shift+'}D to bookmark it`}
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
