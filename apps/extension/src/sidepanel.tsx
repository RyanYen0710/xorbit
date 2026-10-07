import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Logo, Wordmark } from '@orbit/ui'
import './ext.css'
import { usePrefs, useStored } from './usePrefs'
import {
  GROUP_HEX,
  faviconUrl,
  getPins,
  getSpaces,
  hostOf,
  setPins,
  uid,
  type Space,
} from './shared'
import { createSpace, getActiveSpace, moveTabToSpace, spaceOf, switchSpace } from './spaces'

const DAY = 86_400_000
const x = (d: string) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <path d={d} />
  </svg>
)

function MissionControl() {
  usePrefs()
  const spaces = useStored(getSpaces, [] as Space[])
  const pins = useStored(getPins, [])
  const [winId, setWinId] = useState<number>()
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([])
  const [groups, setGroups] = useState<chrome.tabGroups.TabGroup[]>([])
  const [space, setSpace] = useState<Space>()
  const [find, setFind] = useState('')

  const load = useCallback(async () => {
    const w = await chrome.windows.getCurrent()
    setWinId(w.id)
    const [t, g, a] = await Promise.all([
      chrome.tabs.query({ windowId: w.id }),
      chrome.tabGroups.query({ windowId: w.id }),
      getActiveSpace(w.id!),
    ])
    setTabs(t)
    setGroups(g)
    setSpace(a)
  }, [])
  useEffect(() => {
    document.title = 'Mission Control'
    void load()
    let timer: ReturnType<typeof setTimeout>
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(load, 60)
    }
    const evs = [
      chrome.tabs.onCreated,
      chrome.tabs.onRemoved,
      chrome.tabs.onUpdated,
      chrome.tabs.onMoved,
      chrome.tabs.onActivated,
      chrome.tabs.onAttached,
      chrome.tabs.onDetached,
      chrome.tabGroups.onUpdated,
      chrome.tabGroups.onCreated,
      chrome.tabGroups.onRemoved,
      chrome.storage.onChanged,
    ] as chrome.events.Event<() => void>[]
    evs.forEach((e) => e.addListener(soon))
    return () => {
      evs.forEach((e) => e.removeListener(soon))
      clearTimeout(timer)
    }
  }, [load])

  if (!space || !winId) return null
  const color = GROUP_HEX[space.color]
  const mine = tabs.filter(
    (t) =>
      spaceOf(t, spaces, groups).id === space.id &&
      (!find || `${t.title} ${t.url}`.toLowerCase().includes(find.toLowerCase())),
  )
  const now = Date.now()
  const today = mine.filter((t) => t.active || now - (t.lastAccessed ?? now) < DAY)
  const older = mine.filter((t) => !today.includes(t))
  const myPins = pins.filter((p) => p.spaceId === space.id)

  const row = (t: chrome.tabs.Tab) => (
    <div
      key={t.id}
      className="tab"
      role="button"
      tabIndex={0}
      aria-current={t.active}
      draggable
      onClick={() => chrome.tabs.update(t.id!, { active: true })}
      onKeyDown={(e) => e.key === 'Enter' && chrome.tabs.update(t.id!, { active: true })}
      onAuxClick={(e) => e.button === 1 && chrome.tabs.remove(t.id!)}
      onDragStart={(e) => e.dataTransfer.setData('text/orbit-tab', String(t.id))}
    >
      {t.status === 'loading' ? (
        <span className="spin" aria-label="Loading" />
      ) : t.url ? (
        <img src={faviconUrl(t.url, 32)} alt="" />
      ) : (
        <Logo size={14} />
      )}
      <span className="ti">{t.title || hostOf(t.url ?? '') || 'New Tab'}</span>
      <span className="acts">
        {(t.audible || t.mutedInfo?.muted) && (
          <button
            className="icon-btn"
            aria-label={t.mutedInfo?.muted ? 'Unmute tab' : 'Mute tab'}
            onClick={(e) => {
              e.stopPropagation()
              void chrome.tabs.update(t.id!, { muted: !t.mutedInfo?.muted })
            }}
          >
            {x(
              t.mutedInfo?.muted
                ? 'M4 10v4h4l5 4V6l-5 4zM17 9.5l4 5M21 9.5l-4 5'
                : 'M4 10v4h4l5 4V6l-5 4zM16.5 9a4 4 0 0 1 0 6',
            )}
          </button>
        )}
        <button
          className="icon-btn"
          aria-label="Duplicate tab"
          onClick={(e) => {
            e.stopPropagation()
            void chrome.tabs.duplicate(t.id!)
          }}
        >
          {x('M8 8h11v11H8zM5 15V5h10')}
        </button>
        <button
          className="icon-btn"
          aria-label="Pin page"
          onClick={async (e) => {
            e.stopPropagation()
            if (t.url && /^https?:/.test(t.url))
              await setPins([
                ...pins,
                { id: uid(), spaceId: space.id, title: t.title || t.url, url: t.url },
              ])
          }}
        >
          {x('M7 4h10v16l-5-4-5 4z')}
        </button>
        <button
          className="icon-btn"
          aria-label="Close tab"
          onClick={(e) => {
            e.stopPropagation()
            void chrome.tabs.remove(t.id!)
          }}
        >
          {x('M7 7l10 10M17 7L7 17')}
        </button>
      </span>
    </div>
  )

  return (
    <div className="sp" style={{ ['--c' as string]: color }}>
      <div className="sp-head">
        <Logo size={20} />
        <Wordmark size={12} />
      </div>
      <div className="spaces" role="group" aria-label="Spaces">
        {spaces.map((s) => (
          <button
            key={s.id}
            className="dot"
            aria-pressed={s.id === space.id}
            aria-label={`Space ${s.name}`}
            title={s.name}
            style={{ ['--c' as string]: GROUP_HEX[s.color] }}
            onClick={() => switchSpace(winId, s.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = Number(e.dataTransfer.getData('text/orbit-tab'))
              if (id) void moveTabToSpace(id, s.id)
            }}
          >
            {[...s.name][0]}
          </button>
        ))}
        <button
          className="icon-btn"
          aria-label="New Space"
          title="New Space"
          onClick={() => {
            const n = prompt('Name your new Space')
            if (n) void createSpace(winId, n)
          }}
        >
          {x('M12 5v14M5 12h14')}
        </button>
      </div>
      <div className="orbit-label" style={{ padding: '0 14px' }}>
        <span style={{ color }}>●</span> SPACE / {space.name}
      </div>
      <input
        className="field sp-find"
        placeholder="Search tabs"
        aria-label="Search tabs"
        value={find}
        onChange={(e) => setFind(e.target.value)}
      />
      <div className="sp-scroll">
        {myPins.length > 0 && (
          <>
            <div className="orbit-label sect">PINNED</div>
            {myPins.map((p) => (
              <div
                key={p.id}
                className="tab"
                role="button"
                tabIndex={0}
                onClick={async () => {
                  const open = tabs.find(
                    (t) => t.url === p.url && spaceOf(t, spaces, groups).id === space.id,
                  )
                  if (open) await chrome.tabs.update(open.id!, { active: true })
                  else {
                    const t = await chrome.tabs.create({ url: p.url })
                    await moveTabToSpace(t.id!, space.id)
                  }
                }}
              >
                <img src={faviconUrl(p.url, 32)} alt="" />
                <span className="ti">{p.title}</span>
                <span className="acts">
                  <button
                    className="icon-btn"
                    aria-label="Unpin"
                    onClick={(e) => {
                      e.stopPropagation()
                      void setPins(pins.filter((x2) => x2.id !== p.id))
                    }}
                  >
                    {x('M7 7l10 10M17 7L7 17')}
                  </button>
                </span>
              </div>
            ))}
          </>
        )}
        <div className="orbit-label sect">TODAY</div>
        {today.map(row)}
        <div
          className="tab"
          role="button"
          tabIndex={0}
          style={{ color: 'var(--orbit-muted)' }}
          onClick={async () => {
            const t = await chrome.tabs.create({})
            await moveTabToSpace(t.id!, space.id)
          }}
        >
          {x('M12 5v14M5 12h14')}
          <span className="ti">New Tab</span>
        </div>
        {older.length > 0 && (
          <>
            <div className="orbit-label sect">OLDER TABS</div>
            {older.map(row)}
          </>
        )}
      </div>
      <div className="sp-foot">
        <button
          className="icon-btn"
          aria-label="History"
          title="History"
          onClick={() => chrome.tabs.create({ url: 'chrome://history' })}
        >
          {x('M12 7v5l3 2M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4')}
        </button>
        <button
          className="icon-btn"
          aria-label="Downloads"
          title="Downloads"
          onClick={() => chrome.tabs.create({ url: 'chrome://downloads' })}
        >
          {x('M12 4v11m0 0l-4-4m4 4l4-4M5 20h14')}
        </button>
        <button
          className="icon-btn"
          aria-label="Settings and themes"
          title="Settings and themes"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          {x('M4 7h9M17 7h3M4 17h3M11 17h9')}
        </button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MissionControl />
  </StrictMode>,
)
