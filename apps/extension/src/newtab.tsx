import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Logo } from '@orbit/ui'
import { PROVIDERS, resolveInput } from '@orbit/search'
import './ext.css'
import { usePrefs, useStored } from './usePrefs'
import { faviconUrl, getPins, hostOf, searchCfg, setPins, setPrefs, uid } from './shared'
import { getActiveSpace } from './spaces'

interface Bm {
  id: string
  title: string
  url: string
  folder: string
}
const SHOWN = 18

/** Every http(s) bookmark, tagged with its top-level Chrome folder (Bookmarks bar, Other bookmarks…). */
async function loadBookmarks(): Promise<Bm[]> {
  const [root] = await chrome.bookmarks.getTree()
  const seen = new Set<string>()
  const out: Bm[] = []
  const walk = (n: chrome.bookmarks.BookmarkTreeNode, folder: string) => {
    if (n.url) {
      if (/^https?:/.test(n.url) && !seen.has(n.url)) {
        seen.add(n.url)
        out.push({ id: n.id, title: n.title || hostOf(n.url), url: n.url, folder })
      }
      return
    }
    n.children?.forEach((c) => walk(c, folder))
  }
  root.children?.forEach((top) => walk(top, top.title))
  return out
}

function AddTile({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [err, setErr] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    let u: URL
    try {
      u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : 'https://' + url.trim())
    } catch {
      return setErr('That doesn’t look like a web address')
    }
    if (!/^https?:$/.test(u.protocol) || (!u.hostname.includes('.') && u.hostname !== 'localhost'))
      return setErr('That doesn’t look like a web address')
    await chrome.bookmarks.create({
      parentId: '1',
      title: title.trim() || hostOf(u.href),
      url: u.href,
    }) // Bookmarks bar
    setOpen(false)
    setUrl('')
    setTitle('')
    setErr('')
    onAdded()
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
      {err && (
        <span className="orbit-label" role="alert">
          {err}
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

function NewTab() {
  const prefs = usePrefs()
  const pins = useStored(getPins, [])
  const [bms, setBms] = useState<Bm[]>([])
  const [folder, setFolder] = useState('All')
  const [all, setAll] = useState(false)
  const [spaceId, setSpaceId] = useState('')
  const [recent, setRecent] = useState<chrome.tabs.Tab[]>([])
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => void loadBookmarks().then(setBms), [])
  useEffect(() => {
    document.title = 'New Tab'
    input.current?.focus()
    refresh()
    void chrome.windows
      .getCurrent()
      .then((w) => getActiveSpace(w.id!))
      .then((s) => setSpaceId(s.id))
    void chrome.tabs.query({}).then((t) =>
      setRecent(
        t
          .filter((x) => x.url && !x.url.startsWith('chrome') && !x.url.includes(chrome.runtime.id))
          .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
          .slice(0, 4),
      ),
    )
    const evs = [
      chrome.bookmarks.onCreated,
      chrome.bookmarks.onRemoved,
      chrome.bookmarks.onChanged,
      chrome.bookmarks.onMoved,
    ] as chrome.events.Event<() => void>[]
    evs.forEach((e) => e.addListener(refresh))
    return () => evs.forEach((e) => e.removeListener(refresh))
  }, [refresh])

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const r = resolveInput(q, searchCfg(prefs))
    if (r) location.replace(r.url)
  }
  const isPinned = (url: string) => pins.some((p) => p.url === url && p.spaceId === spaceId)
  const togglePin = async (b: Bm) => {
    const ex = pins.find((p) => p.url === b.url && p.spaceId === spaceId)
    await setPins(
      ex
        ? pins.filter((p) => p !== ex)
        : [...pins, { id: uid(), spaceId, title: b.title, url: b.url }],
    )
  }

  const folders = ['All', ...new Set(bms.map((b) => b.folder))]
  const list = bms.filter((b) => folder === 'All' || b.folder === folder)
  const shown = all ? list : list.slice(0, SHOWN)
  return (
    <main className="newtab">
      <div className="horizon" aria-hidden="true" />
      <div className="nt">
        <Logo size={44} />
        <div className="orbit-display nt-word">X ORBIT</div>
        <form onSubmit={go} role="search" className="nt-form">
          <input
            ref={input}
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
              aria-pressed={prefs.searchProvider === id}
              onClick={() => setPrefs({ searchProvider: id })}
            >
              {PROVIDERS[id].label}
            </button>
          ))}
          {prefs.searchProvider !== 'google' && prefs.searchProvider !== 'bing' && (
            <span className="orbit-label">
              · {PROVIDERS[prefs.searchProvider].label.toUpperCase()}
            </span>
          )}
        </div>

        {
          <section className="bm" aria-label="Bookmarks">
            {bms.length > 0 && (
              <div className="bm-head">
                <div className="bm-chips" role="group" aria-label="Bookmark folders">
                  {folders.map((f) => (
                    <button
                      key={f}
                      aria-pressed={folder === f}
                      onClick={() => {
                        setFolder(f)
                        setAll(false)
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="bm-grid">
              {shown.map((b) => (
                <div className="bm-tile" key={b.id}>
                  <a href={b.url} title={b.url}>
                    <span className="bm-ico">
                      <img src={faviconUrl(b.url, 32)} alt="" width={24} height={24} />
                    </span>
                    <span className="bm-title">{b.title}</span>
                  </a>
                  <button
                    className="bm-pin"
                    aria-pressed={isPinned(b.url)}
                    aria-label={
                      isPinned(b.url)
                        ? `Unpin ${b.title} from the side panel`
                        : `Pin ${b.title} to the side panel`
                    }
                    title={isPinned(b.url) ? 'Pinned to the side panel' : 'Pin to the side panel'}
                    onClick={() => togglePin(b)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill={isPinned(b.url) ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    >
                      <path d="M7 4h10v16l-5-4-5 4z" />
                    </svg>
                  </button>
                </div>
              ))}
              <AddTile onAdded={refresh} />
            </div>
            {list.length > SHOWN && (
              <button className="bm-more orbit-label" onClick={() => setAll(!all)}>
                {all ? 'SHOW LESS' : `SHOW ALL ${list.length}`}
              </button>
            )}
            {bms.length === 0 && (
              <p className="orbit-label bm-empty">
                Bookmarks you save in Chrome appear here, or add one with +
              </p>
            )}
          </section>
        }

        {bms.length === 0 && recent.length > 0 && (
          <div className="nt-recent">
            <div className="orbit-label">RECENT TABS</div>
            {recent.map((t) => (
              <a
                key={t.id}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  void chrome.tabs.update(t.id!, { active: true })
                  void chrome.windows.update(t.windowId, { focused: true })
                }}
              >
                {t.title} <span>{hostOf(t.url!)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="nt-hint orbit-label">ALT+O ORBIT BAR · ALT+S MISSION CONTROL</div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NewTab />
  </StrictMode>,
)
