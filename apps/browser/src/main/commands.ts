import { app, dialog, session } from 'electron'
import fs from 'node:fs'
import { PROVIDERS, calc, fuzzy, resolveInput } from '@orbit/search'
import { PRESETS } from '@orbit/themes'
import type { Pin, Space, Suggestion } from '@orbit/types'
import { db, history, uid } from './store'
import { focusedWindow, windows, broadcast } from './registry'
import * as hist from './history'
import { OrbitWindow } from './window'
import { checkForUpdates } from './updater'
import { mainSession } from './session'
import { isInternalUrl } from './internal'

const SPACE_COLORS = ['#9cb4d8', '#c65332', '#2f6fe0', '#3ddc84', '#d8b86a', '#b6a9e8', '#c9ccd1']

/** pinned=true → also shown in the sidebar; false → bookmark only (New Tab grid). Calling again removes it. */
export function pinPage(w: OrbitWindow, tabId?: string, pinned = true) {
  const t = w.tab(tabId) ?? w.activeTab
  if (!t || !/^https?:/.test(t.url)) return
  const existing = db.data.pins.find((p) => p.url === t.url && p.spaceId === t.spaceId)
  if (existing) db.data.pins = db.data.pins.filter((p) => p !== existing)
  else
    db.data.pins.push({
      id: uid(),
      spaceId: t.spaceId,
      title: t.title || new URL(t.url).host,
      url: t.url,
      favicon: t.favicon,
      folder: '',
    })
  db.save()
  broadcast()
}

export function createSpace(w: OrbitWindow, name: string, extra: Partial<Space> = {}) {
  const n = name.trim().toUpperCase().slice(0, 24)
  if (!n) return
  const sp: Space = {
    id: uid(),
    name: n,
    icon: extra.icon || [...n][0],
    color: extra.color || SPACE_COLORS[db.data.spaces.length % SPACE_COLORS.length],
    container: !!extra.container,
  }
  db.data.spaces.push(sp)
  db.save()
  w.switchSpace(sp.id)
  broadcast()
}

export function deleteSpace(id: string) {
  if (db.data.spaces.length < 2) return
  db.data.spaces = db.data.spaces.filter((s) => s.id !== id)
  db.data.pins = db.data.pins.filter((p) => p.spaceId !== id)
  for (const w of windows) {
    for (const t of w.tabs.filter((t) => t.spaceId === id)) w.closeTab(t.id)
    if (w.activeSpaceId === id) w.switchSpace(db.data.spaces[0].id)
  }
  db.save()
  broadcast()
}

const RANGE: Record<string, number> = { hour: 3.6e6, day: 8.64e7, week: 6.048e8, all: Infinity }
export async function clearData(kind: string, range = 'all') {
  const sessions = [
    mainSession(),
    session.defaultSession,
    ...db.data.spaces
      .filter((s) => s.container)
      .map((s) => session.fromPartition(`persist:space-${s.id}`)),
  ]
  if (kind === 'history' || kind === 'all') {
    if (range === 'all') {
      history.items.length = 0
      history.save()
    } else hist.clearRange(RANGE[range] ?? Infinity)
  }
  if (kind === 'cookies' || kind === 'all')
    for (const s of sessions)
      await s.clearStorageData({
        storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'],
      })
  if (kind === 'cache' || kind === 'all') for (const s of sessions) await s.clearCache()
  if (kind === 'all') {
    db.data.sitePerms = {}
    db.save()
  }
  broadcast()
}

// ── command registry (palette, slash commands, menu all route through here) ──────────────────
export interface Command {
  id: string
  title: string
  kbd?: string
  slash?: string
  run: (w: OrbitWindow, arg?: string) => void | Promise<void>
}
const open = (page: string) => (w: OrbitWindow) => w.openInternal(page)

export const COMMANDS: Command[] = [
  { id: 'newTab', title: 'New Tab', kbd: 'Mod+T', run: (w) => void w.newTab() },
  { id: 'newWindow', title: 'New Window', kbd: 'Mod+N', run: () => void new OrbitWindow() },
  {
    id: 'newPrivate',
    title: 'Private Window',
    kbd: 'Mod+Shift+N',
    slash: 'private',
    run: () => void new OrbitWindow({ private: true }),
  },
  {
    id: 'closeTab',
    title: 'Close Tab',
    kbd: 'Mod+W',
    run: (w) => (w.activeId ? w.closeTab(w.activeId) : w.win.close()),
  },
  { id: 'reopenTab', title: 'Reopen Closed Tab', kbd: 'Mod+Shift+T', run: (w) => w.reopenClosed() },
  {
    id: 'duplicateTab',
    title: 'Duplicate Tab',
    run: (w) => void (w.activeId && w.duplicate(w.activeId)),
  },
  { id: 'reload', title: 'Reload', kbd: 'Mod+R', run: (w) => w.reload() },
  { id: 'hardReload', title: 'Hard Reload', kbd: 'Mod+Shift+R', run: (w) => w.reload(true) },
  { id: 'back', title: 'Back', kbd: 'Mod+[', run: (w) => w.back() },
  { id: 'forward', title: 'Forward', kbd: 'Mod+]', run: (w) => w.forward() },
  { id: 'focusBar', title: 'Open Orbit Bar', kbd: 'Mod+L', run: (w) => w.setOverlay('bar') },
  { id: 'palette', title: 'Orbit Command', kbd: 'Mod+K', run: (w) => w.setOverlay('palette') },
  { id: 'find', title: 'Find in Page', kbd: 'Mod+F', run: (w) => w.setOverlay('find') },
  {
    id: 'bookmarkPage',
    title: 'Bookmark Page',
    kbd: 'Mod+Shift+D',
    slash: 'bookmark',
    run: (w) => pinPage(w, undefined, false),
  },
  { id: 'pinPage', title: 'Pin Page', kbd: 'Mod+D', slash: 'pin', run: (w) => pinPage(w) },
  {
    id: 'newSpace',
    title: 'New Space',
    slash: 'newspace',
    run: (w, arg) => (arg?.trim() ? createSpace(w, arg) : w.setOverlay('bar', '/newspace ')),
  },
  { id: 'nextSpace', title: 'Next Space', kbd: 'Mod+Alt+Right', run: (w) => w.cycleSpace(1) },
  { id: 'prevSpace', title: 'Previous Space', kbd: 'Mod+Alt+Left', run: (w) => w.cycleSpace(-1) },
  { id: 'nextTab', title: 'Next Tab', kbd: 'Ctrl+Tab', run: (w) => w.cycleTab(1) },
  { id: 'prevTab', title: 'Previous Tab', kbd: 'Ctrl+Shift+Tab', run: (w) => w.cycleTab(-1) },
  {
    id: 'history',
    title: 'History',
    kbd: 'Mod+Y',
    slash: 'history',
    run: (w) => w.openInternal('settings', 'history'),
  },
  {
    id: 'downloads',
    title: 'Downloads',
    kbd: 'Mod+Shift+J',
    slash: 'downloads',
    run: (w) => w.openInternal('settings', 'downloads'),
  },
  { id: 'settings', title: 'Settings', kbd: 'Mod+,', slash: 'settings', run: open('settings') },
  { id: 'themes', title: 'Theme Studio', slash: 'themes', run: open('themes') },
  {
    id: 'pins',
    title: 'Pins (Bookmarks)',
    slash: 'pins',
    run: (w) => w.openInternal('settings', 'pins'),
  },
  {
    id: 'clearData',
    title: 'Clear Browsing Data',
    slash: 'clear',
    run: (w) => w.openInternal('settings', 'privacy'),
  },
  { id: 'toggleRail', title: 'Toggle Sidebar', kbd: 'Mod+B', run: (w) => w.toggleRail() },
  {
    id: 'focusMode',
    title: 'Focus Mode',
    kbd: 'Mod+Shift+F',
    slash: 'focus',
    run: (w) => w.toggleFocus(),
  },
  {
    id: 'splitView',
    title: 'Split View',
    kbd: 'Mod+\\',
    slash: 'split',
    run: (w) => w.splitWith(),
  },
  { id: 'devTools', title: 'Developer Tools', kbd: 'Mod+Alt+I', run: (w) => w.devTools() },
  { id: 'zoomIn', title: 'Zoom In', kbd: 'Mod+=', run: (w) => w.zoom(0.5) },
  { id: 'zoomOut', title: 'Zoom Out', kbd: 'Mod+-', run: (w) => w.zoom(-0.5) },
  { id: 'zoomReset', title: 'Actual Size', kbd: 'Mod+0', run: (w) => w.zoom(0) },
  { id: 'checkUpdates', title: 'Check for Updates', run: () => void checkForUpdates() },
  {
    id: 'setTheme',
    title: 'Theme',
    slash: 'theme',
    run: (_w, arg) => {
      const q = (arg ?? '').toLowerCase()
      const t = [...PRESETS, ...db.data.customThemes].find(
        (x) => x.id === q || x.name.toLowerCase().includes(q),
      )
      if (t) {
        db.data.settings.themeId = t.id
        db.save()
        broadcast()
      }
    },
  },
  { id: 'switchSpace', title: 'Switch Space', run: (w, arg) => void (arg && w.switchSpace(arg)) },
]
const byId = new Map(COMMANDS.map((c) => [c.id, c]))

export const runCommand = (
  id: string,
  w: OrbitWindow | undefined = focusedWindow(),
  arg?: string,
) => {
  if (w) void byId.get(id)?.run(w, arg)
}

// ── suggestions ─────────────────────────────────────────────────────────────
const cmdItem = (c: Command, arg?: string, title?: string, sub?: string): Suggestion => ({
  id: 'cmd:' + c.id + (arg ?? ''),
  kind: 'command',
  title: title ?? c.title,
  sub: sub ?? c.kbd,
  run: { type: 'cmd', payload: { id: c.id, arg } },
})

/** Palette entries: every command, plus one per Space and theme. */
export function paletteItems(w: OrbitWindow, text: string): Suggestion[] {
  const all: Suggestion[] = COMMANDS.filter(
    (c) => c.id !== 'setTheme' && c.id !== 'switchSpace',
  ).map((c) => cmdItem(c))
  for (const s of w.spaces)
    if (s.id !== w.activeSpaceId)
      all.push({
        id: 'space:' + s.id,
        kind: 'command',
        title: `Switch to ${s.name}`,
        sub: 'Space',
        run: { type: 'cmd', payload: { id: 'switchSpace', arg: s.id } },
      })
  for (const t of [...PRESETS, ...db.data.customThemes])
    all.push({
      id: 'theme:' + t.id,
      kind: 'command',
      title: `Theme: ${t.name}`,
      sub: 'Appearance',
      run: { type: 'cmd', payload: { id: 'setTheme', arg: t.id } },
    })
  if (!text.trim()) return all.slice(0, 40)
  return all
    .map((i) => ({ i, s: fuzzy(text, i.title) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => b.s! - a.s!)
    .slice(0, 40)
    .map((x) => x.i)
}

const tabItem = (t: { id: string; title: string; url: string; favicon: string }): Suggestion => ({
  id: 'tab:' + t.id,
  kind: 'tab',
  title: t.title || t.url,
  sub: `Switch to tab · ${t.url}`,
  favicon: t.favicon,
  run: { type: 'activateTab', payload: { id: t.id } },
})
const pinItem = (p: Pin): Suggestion => ({
  id: 'pin:' + p.id,
  kind: 'pin',
  title: p.title,
  sub: p.url,
  favicon: p.favicon,
  run: { type: 'navigate', payload: { url: p.url } },
})
const histItem = (e: { id: string; title: string; url: string }): Suggestion => ({
  id: 'h:' + e.id,
  kind: 'history',
  title: e.title,
  sub: e.url,
  run: { type: 'navigate', payload: { url: e.url } },
})
const rank = <T>(items: T[], q: string, text: (x: T) => string) =>
  items
    .map((x) => ({ x, s: fuzzy(q, text(x)) }))
    .filter((r) => r.s !== null)
    .sort((a, b) => b.s! - a.s!)
    .map((r) => r.x)

export function suggest(w: OrbitWindow, raw: string): Suggestion[] {
  const text = raw.trim()
  const tabs = w.tabs.filter((t) => !isInternalUrl(t.url) || t.title)
  const pins = db.data.pins.filter((p) => p.spaceId === w.activeSpaceId)

  const pre = /^@(tabs|history|pins)\b\s*(.*)$/i.exec(text)
  if (pre) {
    const q = pre[2]
    if (pre[1].toLowerCase() === 'tabs')
      return rank(tabs, q, (t) => t.title + ' ' + t.url)
        .slice(0, 12)
        .map(tabItem)
    if (pre[1].toLowerCase() === 'pins')
      return rank(db.data.pins, q, (p) => p.title + ' ' + p.url)
        .slice(0, 12)
        .map(pinItem)
    return hist.search(q, 12).map(histItem)
  }
  if (text.startsWith('/')) {
    const [name, ...rest] = text.slice(1).split(/\s+/)
    const arg = rest.join(' ')
    const hits = COMMANDS.filter((c) => c.slash && c.slash.startsWith(name.toLowerCase()))
    return hits.map((c) =>
      cmdItem(
        c,
        arg,
        arg && c.slash === 'newspace'
          ? `New Space “${arg.toUpperCase()}”`
          : arg && c.slash === 'theme'
            ? `Theme: ${arg}`
            : c.title,
        `/${c.slash}${c.kbd ? ' · ' + c.kbd : ''}`,
      ),
    )
  }

  const out: Suggestion[] = []
  if (!text) {
    out.push(
      ...[...tabs]
        .filter((t) => t.id !== w.activeId)
        .sort((a, b) => b.lastActive - a.lastActive)
        .slice(0, 6)
        .map(tabItem),
    )
    out.push(...pins.slice(0, 4).map(pinItem))
    return out
  }
  const v = calc(text)
  if (v !== null)
    out.push({
      id: 'calc',
      kind: 'calc',
      title: `= ${v}`,
      sub: 'Enter to copy',
      run: { type: 'copy', payload: { text: String(v) } },
    })
  const r = resolveInput(text, w.searchCfg())
  if (r) {
    const label = PROVIDERS[db.data.settings.searchProvider].label
    out.push({
      id: 'go',
      kind: r.kind,
      title: text,
      sub: r.kind === 'url' ? `Go to ${r.url}` : `Search ${label}`,
      run: { type: 'navigate', payload: { input: text } },
    })
  }
  const seen = new Set(out.map((o) => o.sub))
  const add = (items: Suggestion[]) =>
    items.forEach((i) => {
      if (!seen.has(i.sub)) {
        seen.add(i.sub)
        out.push(i)
      }
    })
  add(
    rank(tabs, text, (t) => t.title + ' ' + t.url)
      .slice(0, 3)
      .map(tabItem),
  )
  add(
    rank(pins, text, (p) => p.title + ' ' + p.url)
      .slice(0, 3)
      .map(pinItem),
  )
  add(hist.search(text, 4).map(histItem))
  return out
}

// ── JSON import/export dialogs ───────────────────────────────────────────────
export async function saveJson(w: OrbitWindow, name: string, data: unknown) {
  const r = await dialog.showSaveDialog(w.win, {
    defaultPath: `${app.getPath('downloads')}/${name}`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (!r.canceled && r.filePath) fs.writeFileSync(r.filePath, JSON.stringify(data, null, 2))
  return !r.canceled
}
/** The "Import from file" picker. (A normal file chooser: macOS always allows reading a file the person picked.) */
export async function pickBookmarksFile(w: OrbitWindow): Promise<string | null> {
  if (process.env.ORBIT_TEST && process.env.ORBIT_PICK_FILE) return process.env.ORBIT_PICK_FILE
  const r = await dialog.showOpenDialog(w.win, {
    title: 'Choose a bookmarks file',
    defaultPath: app.getPath('downloads'),
    properties: ['openFile'],
    filters: [
      { name: 'Bookmarks (.html or Chrome file)', extensions: ['html', 'htm', 'json'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]
}
export async function openJson(w: OrbitWindow): Promise<unknown | null> {
  const r = await dialog.showOpenDialog(w.win, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (r.canceled || !r.filePaths[0]) return null
  const st = fs.statSync(r.filePaths[0])
  if (st.size > 2_000_000) throw new Error('File too large')
  return JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'))
}
