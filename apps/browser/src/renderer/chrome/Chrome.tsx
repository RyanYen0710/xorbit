import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Logo, Wordmark } from '@orbit/ui'
import type { Pin, Space, TabInfo, UIState } from '@orbit/types'
import { Icon } from '../icons'
import { act, hostOf, useOrbit } from '../state'

const DAY = 86_400_000
const DND = 'text/orbit-tab'

function Favicon({ tab }: { tab: Pick<TabInfo, 'favicon' | 'loading' | 'url' | 'discarded'> }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [tab.favicon])
  if (tab.loading) return <span className="spin" aria-label="Loading" />
  if (tab.favicon && !bad)
    return (
      <img
        className="fav"
        src={tab.favicon}
        alt=""
        onError={() => setBad(true)}
        data-dim={tab.discarded}
      />
    )
  if (tab.url.startsWith('orbit://'))
    return (
      <span className="fav fav-orbit">
        <Logo size={14} />
      </span>
    )
  return <span className="fav fav-letter">{(hostOf(tab.url)[0] ?? '·').toUpperCase()}</span>
}

function TabRow({ t, active, expanded }: { t: TabInfo; active: boolean; expanded: boolean }) {
  const [over, setOver] = useState(false)
  const title = t.title || hostOf(t.url) || 'New Tab'
  const drag = (e: DragEvent) => {
    e.dataTransfer.setData(DND, t.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  return (
    <div
      className="tab"
      data-active={active}
      data-over={over}
      data-archived={t.archived}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={drag}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData(DND)
        if (id) void act('moveTab', { id, beforeId: t.id })
      }}
      onClick={() => act('activateTab', { id: t.id })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void act('activateTab', { id: t.id })
      }}
      onAuxClick={(e) => {
        if (e.button === 1) void act('closeTab', { id: t.id })
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        void act('tabMenu', { id: t.id })
      }}
      title={expanded ? undefined : title}
    >
      <Favicon tab={t} />
      {expanded && (
        <>
          <span className="tab-title">{title}</span>
          {(t.audible || t.muted) && (
            <button
              className="icon-btn tiny"
              aria-label={t.muted ? 'Unmute tab' : 'Mute tab'}
              onClick={(e) => {
                e.stopPropagation()
                void act('muteTab', { id: t.id })
              }}
            >
              <Icon n={t.muted ? 'muted' : 'speaker'} size={13} />
            </button>
          )}
          <button
            className="icon-btn tiny tab-close"
            aria-label="Close tab"
            onClick={(e) => {
              e.stopPropagation()
              void act('closeTab', { id: t.id })
            }}
          >
            <Icon n="close" size={13} />
          </button>
        </>
      )}
      {!expanded && (
        <button
          className="tab-close-mini"
          aria-label={`Close ${title}`}
          onClick={(e) => {
            e.stopPropagation()
            void act('closeTab', { id: t.id })
          }}
        >
          <Icon n="close" size={10} />
        </button>
      )}
    </div>
  )
}

function PinRow({ p, expanded }: { p: Pin; expanded: boolean }) {
  return (
    <div
      className="tab pin"
      role="button"
      tabIndex={0}
      draggable
      title={expanded ? p.url : p.title}
      onDragStart={(e) => e.dataTransfer.setData('text/orbit-pin', p.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const id = e.dataTransfer.getData('text/orbit-pin')
        if (id) void act('movePin', { id, beforeId: p.id })
      }}
      onClick={() => act('navigate', { url: p.url, newTab: false, openPin: true })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void act('navigate', { url: p.url })
      }}
    >
      <Favicon tab={{ favicon: p.favicon, loading: false, url: p.url, discarded: false }} />
      {expanded && (
        <>
          <span className="tab-title">{p.title}</span>
          <button
            className="icon-btn tiny tab-close"
            aria-label="Unpin"
            onClick={(e) => {
              e.stopPropagation()
              void act('unpin', { id: p.id })
            }}
          >
            <Icon n="close" size={13} />
          </button>
        </>
      )}
    </div>
  )
}

function SpaceDot({ s, active }: { s: Space; active: boolean }) {
  const [over, setOver] = useState(false)
  return (
    <button
      className="space-dot"
      data-active={active}
      data-over={over}
      aria-label={`Space ${s.name}`}
      aria-pressed={active}
      title={s.name}
      style={{ ['--c' as string]: s.color }}
      onClick={() => act('switchSpace', { id: s.id })}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData(DND)
        if (id) void act('moveTabToSpace', { id, spaceId: s.id })
      }}
    >
      {s.icon}
    </button>
  )
}

function Section({
  label,
  children,
  expanded,
}: {
  label: string
  children: React.ReactNode
  expanded: boolean
}) {
  return (
    <section className="rail-section">
      {expanded ? (
        <div className="orbit-label sect-label">{label}</div>
      ) : (
        <div className="sect-rule" />
      )}
      {children}
    </section>
  )
}

function Rail({ s }: { s: UIState }) {
  const ex = s.railExpanded
  const mac = s.platform === 'darwin'
  const now = Date.now()
  const space = s.spaces.find((x) => x.id === s.activeSpaceId)!
  const tabs = s.tabs.filter((t) => t.spaceId === s.activeSpaceId)
  const today = tabs.filter(
    (t) => !t.archived && (now - t.lastActive < DAY || t.id === s.activeTabId),
  )
  const older = tabs.filter((t) => !today.includes(t))
  const pins = s.pins.filter((p) => p.spaceId === s.activeSpaceId && p.favorite !== false)
  const dl = s.downloads.filter((d) => d.state === 'progressing').length
  const nav = (section: string) => act('openInternal', { page: 'settings', section })

  return (
    <nav
      className="rail"
      aria-label="Orbit Rail"
      data-expanded={ex}
      onMouseLeave={() => s.peek && void act('peek', { on: false })}
    >
      <div className="traffic" data-mac={mac} />
      <div className="rail-head">
        <button
          className="logo-btn"
          aria-label={ex ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={ex}
          onClick={() => act('toggleRail')}
        >
          <Logo size={22} />
        </button>
        {ex && <Wordmark size={12} />}
        {ex && s.private && <span className="orbit-label private-tag">PRIVATE</span>}
      </div>

      <div className="spaces" data-expanded={ex}>
        {!s.private &&
          s.spaces.map((sp) => <SpaceDot key={sp.id} s={sp} active={sp.id === s.activeSpaceId} />)}
        {!s.private && (
          <button
            className="icon-btn"
            aria-label="New Space"
            title="New Space"
            onClick={() => act('overlay', { mode: 'bar', text: '/newspace ' })}
          >
            <Icon n="plus" size={14} />
          </button>
        )}
      </div>
      {ex && (
        <div className="orbit-label space-name">
          <span style={{ color: 'var(--space)' }}>●</span> SPACE / {space.name}
        </div>
      )}

      <div
        className="rail-scroll"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const id = e.dataTransfer.getData(DND)
          if (id) void act('moveTab', { id, beforeId: null })
        }}
      >
        {pins.length > 0 && (
          <Section label="PINNED" expanded={ex}>
            {pins.map((p) => (
              <PinRow key={p.id} p={p} expanded={ex} />
            ))}
          </Section>
        )}
        <Section label="TODAY" expanded={ex}>
          {today.map((t) => (
            <TabRow key={t.id} t={t} active={t.id === s.activeTabId} expanded={ex} />
          ))}
          <button className="tab new" onClick={() => act('newTab')} aria-label="New tab">
            <span className="fav fav-letter">
              <Icon n="plus" size={13} />
            </span>
            {ex && <span className="tab-title">New Tab</span>}
          </button>
        </Section>
        {older.length > 0 && (
          <Section label="OLDER TABS" expanded={ex}>
            {older.map((t) => (
              <TabRow key={t.id} t={t} active={t.id === s.activeTabId} expanded={ex} />
            ))}
          </Section>
        )}
      </div>

      <div className="rail-foot" data-expanded={ex}>
        <button
          className="icon-btn"
          aria-label="Downloads"
          title="Downloads"
          onClick={() => nav('downloads')}
        >
          <Icon n="download" />
          {dl > 0 && <i className="badge" />}
        </button>
        <button
          className="icon-btn"
          aria-label="History"
          title="History"
          onClick={() => nav('history')}
        >
          <Icon n="history" />
        </button>
        <button
          className="icon-btn"
          aria-label="Pins (bookmarks)"
          title="Pins (bookmarks)"
          onClick={() => nav('pins')}
        >
          <Icon n="pin" />
        </button>
        <button
          className="icon-btn"
          aria-label="Settings"
          title="Settings"
          onClick={() => nav('general')}
        >
          <Icon n="settings" />
        </button>
        <button
          className="icon-btn"
          aria-label="Profile"
          title="Profile"
          onClick={() => nav('general')}
        >
          <Icon n={s.private ? 'private' : 'user'} />
        </button>
      </div>
    </nav>
  )
}

function TopStrip({ s }: { s: UIState }) {
  const tab = s.tabs.find((t) => t.id === s.activeTabId)
  const host = tab ? hostOf(tab.url) : ''
  const secure = tab?.url.startsWith('https:')
  const win = s.platform !== 'darwin'
  const inSplit = !!s.split && (s.activeTabId === s.split.a || s.activeTabId === s.split.b)
  return (
    <header
      className="top"
      style={{
        left: s.pageRect.x,
        width: s.pageRect.width,
        paddingRight: win && s.settings.railPosition === 'left' ? 150 : 12,
      }}
    >
      <div className="nav-btns">
        <button
          className="icon-btn"
          aria-label="Back"
          disabled={!tab?.canGoBack}
          onClick={() => act('back')}
        >
          <Icon n="back" />
        </button>
        <button
          className="icon-btn"
          aria-label="Forward"
          disabled={!tab?.canGoForward}
          onClick={() => act('forward')}
        >
          <Icon n="forward" />
        </button>
        <button
          className="icon-btn"
          aria-label={tab?.loading ? 'Stop' : 'Reload'}
          disabled={!tab}
          onClick={() => act('reload')}
        >
          <Icon n={tab?.loading ? 'stop' : 'reload'} />
        </button>
      </div>
      <button
        className="top-title"
        onClick={() => act('overlay', { mode: 'bar' })}
        aria-label="Open Orbit Bar"
      >
        {tab ? tab.title || host || 'New Tab' : 'No tab'}
      </button>
      <div className="top-right">
        {inSplit && (
          <>
            <button
              className="icon-btn"
              aria-label="Swap split sides"
              title="Swap sides"
              onClick={() => act('swapSplit')}
            >
              <Icon n="swap" />
            </button>
            <button
              className="icon-btn"
              aria-label="Detach split"
              title="Detach split"
              onClick={() => act('detachSplit')}
            >
              <Icon n="detach" />
            </button>
            <button
              className="icon-btn"
              aria-label="Close this side"
              title="Close this side"
              onClick={() => act('closeSplitSide', { id: s.activeTabId })}
            >
              <Icon n="close" />
            </button>
          </>
        )}
        {tab && host && (
          <button
            className="chip"
            aria-label="Site information and permissions"
            onClick={() => act('overlay', { mode: 'site' })}
          >
            <Icon n={secure ? 'lock' : 'unlock'} size={13} /> {host}
          </button>
        )}
        <button
          className="icon-btn"
          aria-label="Split view"
          aria-pressed={inSplit}
          title="Split view"
          onClick={() => act('splitTab')}
        >
          <Icon n="split" />
        </button>
        <button
          className="icon-btn"
          aria-label="Focus mode"
          title="Focus mode"
          onClick={() => act('toggleFocus')}
        >
          <Icon n="focus" />
        </button>
      </div>
    </header>
  )
}

function SplitDivider({ s }: { s: UIState }) {
  const ref = useRef<HTMLDivElement>(null)
  if (!s.split || !(s.activeTabId === s.split.a || s.activeTabId === s.split.b)) return null
  const r = s.pageRect
  const left = r.x + Math.floor((r.width - 6) * s.split.ratio)
  const move = (e: React.PointerEvent) => {
    if (!ref.current?.hasPointerCapture(e.pointerId)) return
    void act('splitRatio', { ratio: (e.clientX - r.x - 3) / (r.width - 6) })
  }
  return (
    <div
      ref={ref}
      className="divider"
      style={{ left, top: r.y, height: r.height }}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize split"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') void act('splitRatio', { ratio: s.split!.ratio - 0.03 })
        if (e.key === 'ArrowRight') void act('splitRatio', { ratio: s.split!.ratio + 0.03 })
      }}
      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
      onPointerMove={move}
    />
  )
}

export function Chrome() {
  const s = useOrbit()!
  const hidden = s.focus && !s.peek
  const railW = hidden ? 4 : s.railExpanded ? s.settings.railWidth : 64
  const noTab = !s.tabs.some((t) => t.id === s.activeTabId)
  return (
    <div className="shell" style={{ ['--rail' as string]: railW + 'px' }} data-hidden={hidden}>
      {hidden ? (
        <div
          className="peek-strip"
          onMouseEnter={() => act('peek', { on: true })}
          aria-hidden="true"
        />
      ) : (
        <>
          <Rail s={s} />
          <TopStrip s={s} />
        </>
      )}
      {noTab && !hidden && (
        <main
          className="empty"
          style={{
            left: s.pageRect.x,
            top: s.pageRect.y,
            width: s.pageRect.width,
            height: s.pageRect.height,
          }}
        >
          <div className="orbit-label">
            X ORBIT / {s.spaces.find((x) => x.id === s.activeSpaceId)?.name}
          </div>
          <h1 className="orbit-display">
            NO ACTIVE
            <br />
            ORBITS
          </h1>
          <p>Start somewhere.</p>
          <button className="btn" onClick={() => act('newTab')}>
            NEW TAB
          </button>
        </main>
      )}
      <SplitDivider s={s} />
    </div>
  )
}
