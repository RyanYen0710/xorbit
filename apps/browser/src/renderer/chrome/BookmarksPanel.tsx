import { useEffect, useMemo, useState } from 'react'
import type { Pin, UIState } from '@orbit/types'
import { BookmarkIcon } from '../bookmark-icon'
import { Icon } from '../icons'
import { act, hostOf, useFolderMemory } from '../state'

interface Node {
  name: string
  path: string
  children: Node[]
  items: Pin[]
  total: number
}

/** Folders and bookmarks as a tree: every folder path becomes a node, every bookmark sits in its folder. */
function buildTree(folders: string[], pins: Pin[]): Node {
  const root: Node = { name: '', path: '', children: [], items: [], total: 0 }
  const byPath = new Map<string, Node>([['', root]])
  const node = (path: string): Node => {
    const have = byPath.get(path)
    if (have) return have
    const parts = path.split(' / ')
    const n: Node = { name: parts[parts.length - 1], path, children: [], items: [], total: 0 }
    byPath.set(path, n)
    node(parts.slice(0, -1).join(' / ')).children.push(n)
    return n
  }
  for (const f of folders) if (f) node(f)
  for (const p of pins) node(p.folder || '').items.push(p)
  const count = (n: Node): number =>
    (n.total = n.items.length + n.children.reduce((a, c) => a + count(c), 0))
  count(root)
  return root
}

function Row({ p }: { p: Pin }) {
  return (
    <div
      className="bm-row"
      role="treeitem"
      tabIndex={0}
      draggable
      title={`${p.title}\n${p.url}`}
      onDragStart={(e) => e.dataTransfer.setData('text/orbit-bookmark', p.id)}
      onClick={() => act('navigate', { url: p.url })}
      onAuxClick={(e) => e.button === 1 && void act('navigate', { url: p.url, newTab: true })}
      onContextMenu={(e) => {
        e.preventDefault()
        void act('bookmarkMenu', { id: p.id })
      }}
      onKeyDown={(e) => e.key === 'Enter' && void act('navigate', { url: p.url })}
    >
      <BookmarkIcon url={p.url} favicon={p.favicon} />
      <span className="bm-row-title">{p.title}</span>
      {p.home && (
        <span className="bm-home" title="Shown on the homepage">
          <Icon n="pin" size={12} />
        </span>
      )}
    </div>
  )
}

function Folder({
  n,
  depth,
  open,
  toggle,
}: {
  n: Node
  depth: number
  open: Set<string>
  toggle: (p: string) => void
}) {
  const isOpen = open.has(n.path)
  const [over, setOver] = useState(false)
  return (
    <div role="group">
      <button
        className="bm-folder"
        data-over={over}
        aria-expanded={isOpen}
        style={{ paddingLeft: 6 + depth * 12 }}
        onClick={() => toggle(n.path)}
        onContextMenu={(e) => {
          e.preventDefault()
          void act('folderMenu', { path: n.path })
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOver(false)
          const id = e.dataTransfer.getData('text/orbit-bookmark')
          if (id) void act('bookmarkMove', { id, folder: n.path })
        }}
      >
        <span className="folder-chev" data-open={isOpen}>
          <Icon n="chevron" size={13} />
        </span>
        <span className="bm-folder-ico">
          <Icon n="folder" size={15} />
        </span>
        <span className="bm-folder-name">{n.name}</span>
        <span className="folder-count">{n.total}</span>
      </button>
      {isOpen && (
        <div className="bm-children" style={{ marginLeft: 12 + depth * 12 }}>
          {n.children.map((c) => (
            <Folder key={c.path} n={c} depth={depth + 1} open={open} toggle={toggle} />
          ))}
          {n.items.map((p) => (
            <Row key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  )
}

/** The bookmarks sidebar: on the side opposite the tabs. It scrolls on its own and glides in and out. */
export function BookmarksPanel({ s }: { s: UIState }) {
  const [open, toggle] = useFolderMemory('orbit.bm.openFolders')
  const [q, setQ] = useState('')
  const tree = useMemo(() => buildTree(s.folders, s.pins), [s.folders, s.pins])
  // ask the main process to fetch website icons for bookmarks that have none yet
  const missing = s.pins.filter((p) => !p.favicon).length
  useEffect(() => {
    if (missing) void act('bookmarkIcons')
  }, [missing])
  const needle = q.trim().toLowerCase()
  const hits = needle
    ? s.pins.filter((p) => (p.title + ' ' + p.url + ' ' + p.folder).toLowerCase().includes(needle))
    : []
  const side = s.settings.railPosition === 'right' ? 'left' : 'right'
  return (
    <aside
      className="bm-panel"
      aria-label="Bookmarks"
      data-side={side}
      style={{ width: s.panelPx }}
    >
      <div className="bm-inner">
        <header className="bm-head">
          <span className="orbit-label">BOOKMARKS</span>
          <span className="folder-count">{s.pins.length}</span>
          <div className="bm-tools">
            <button
              className="icon-btn"
              aria-label="New folder"
              title="New folder"
              onClick={() => act('folderAddDialog', { parent: '' })}
            >
              <Icon n="folderPlus" size={16} />
            </button>
            <button
              className="icon-btn"
              aria-label="Add site"
              title="Add site (the page you are on is filled in)"
              onClick={() => act('bookmarkAddDialog', { current: true })}
            >
              <Icon n="plus" size={16} />
            </button>
            <button
              className="icon-btn"
              aria-label="Hide bookmarks"
              title="Hide bookmarks"
              onClick={() => act('toggleBookmarks')}
            >
              <Icon n="close" size={15} />
            </button>
          </div>
        </header>
        <div className="bm-search">
          <Icon n="search" size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search bookmarks"
            aria-label="Search bookmarks"
            spellCheck={false}
          />
        </div>
        <div
          className="bm-list"
          role="tree"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData('text/orbit-bookmark')
            if (id) void act('bookmarkMove', { id, folder: '' })
          }}
        >
          {needle ? (
            hits.length ? (
              hits.map((p) => <Row key={p.id} p={p} />)
            ) : (
              <p className="bm-empty">No bookmark matches “{q}”.</p>
            )
          ) : s.pins.length === 0 && s.folders.length === 0 ? (
            <div className="bm-empty">
              <p>No bookmarks yet.</p>
              <button
                className="btn ghost"
                onClick={() => act('bookmarkAddDialog', { current: true })}
              >
                Add this site
              </button>
              <button
                className="btn ghost"
                onClick={() => act('openInternal', { page: 'settings', section: 'pins' })}
              >
                Import from Chrome…
              </button>
            </div>
          ) : (
            <>
              {tree.children.map((c) => (
                <Folder key={c.path} n={c} depth={0} open={open} toggle={toggle} />
              ))}
              {tree.items.map((p) => (
                <Row key={p.id} p={p} />
              ))}
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

export { hostOf }
