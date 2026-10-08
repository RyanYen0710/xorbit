import { useState } from 'react'
import { BookmarkIcon } from '../bookmark-icon'
import { Icon } from '../icons'
import { act, groupByFolder, hostOf, useFolderMemory, useOrbit } from '../state'
import { Empty, Page } from './shared'

const MAX_PINS = 8

export default function Pins() {
  const s = useOrbit()!
  const [closed, toggle] = useFolderMemory('orbit.pins.closedFolders')
  const [msg, setMsg] = useState('')
  const homeCount = s.pins.filter((p) => p.home).length
  return (
    <Page index="04" label="BOOKMARKS" title="Bookmarks" wide>
      <p className="lede">
        Your bookmarks live in the sidebar on the{' '}
        {s.settings.railPosition === 'right' ? 'left' : 'right'} (
        {s.platform === 'darwin' ? '⌘⇧B' : 'Ctrl+Shift+B'} shows or hides it). Pin up to {MAX_PINS}{' '}
        of them to the homepage: {homeCount}/{MAX_PINS} pinned.
      </p>
      <div className="toolbar">
        <button
          className="btn ghost accent"
          onClick={async () => setMsg(await act('importBookmarksFile'))}
        >
          Import from file…
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
        <button className="btn ghost" onClick={() => act('bookmarkAddDialog', { current: true })}>
          Add site
        </button>
        <button className="btn ghost" onClick={() => act('folderAddDialog', { parent: '' })}>
          New folder
        </button>
        <button className="btn ghost" onClick={() => act('exportPins')}>
          Export JSON
        </button>
        <button className="btn ghost" onClick={async () => setMsg(await act('importPins'))}>
          Import JSON
        </button>
        {msg && <span className="orbit-label">{msg}</span>}
      </div>
      <p className="srow-hint">
        Chrome bookmarks: in Chrome open the Bookmark Manager (⌥⌘B), choose ⋮ → Export bookmarks,
        then use “Import from file…” and pick the saved file.
      </p>
      {s.pins.length === 0 && s.folders.length === 0 && (
        <Empty title="NO BOOKMARKS YET">Add a site, or import your bookmarks from Chrome.</Empty>
      )}
      {groupByFolder([
        ...s.folders.map((f) => ({ folder: f, empty: true as const })),
        ...s.pins,
      ]).map(([folder, items]) => {
        const pins = items.filter((x): x is (typeof s.pins)[number] => !('empty' in x))
        return (
          <section key={folder} className="hist-group">
            {folder !== '' && (
              <button
                className="folder-head"
                aria-expanded={!closed.has(folder)}
                onClick={() => toggle(folder)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  void act('folderMenu', { path: folder })
                }}
              >
                <span className="folder-chev" data-open={!closed.has(folder)}>
                  <Icon n="chevron" size={14} />
                </span>
                <Icon n="folder" size={14} />
                <span className="folder-name">{folder}</span>
                <span className="folder-count">{pins.length}</span>
              </button>
            )}
            {(folder === '' || !closed.has(folder)) &&
              pins.map((p) => (
                <div
                  className="hist-row"
                  key={p.id}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    void act('bookmarkMenu', { id: p.id })
                  }}
                >
                  <span className="hist-time">
                    <BookmarkIcon url={p.url} favicon={p.favicon} />
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
                    aria-pressed={!!p.home}
                    aria-label={`${p.home ? 'Remove from' : 'Show on'} the homepage: ${p.title}`}
                    title={p.home ? 'Pinned to the homepage' : 'Pin to the homepage'}
                    onClick={async () => {
                      const r = (await act('bookmarkHome', { id: p.id })) as string
                      setMsg(r.startsWith('!') ? r.slice(1) : '')
                    }}
                    style={{ color: p.home ? 'var(--orbit-accent)' : undefined }}
                  >
                    <Icon n="pin" size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Delete ${p.title}`}
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
