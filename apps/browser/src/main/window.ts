import {
  app,
  BrowserWindow,
  clipboard,
  nativeTheme,
  screen,
  shell,
  WebContentsView,
  type MenuItemConstructorOptions,
} from 'electron'
import path from 'node:path'
import { buildSearchUrl, resolveInput } from '@orbit/search'
import { getPreset, resolveTheme, completeTheme, type Theme } from '@orbit/themes'
import type { DialogSpec, MenuEntry, OverlayMode, Space, TabInfo, UIState } from '@orbit/types'
import { db, DEFAULT_SPACE, uid, type SavedTab } from './store'
import { canon, isInternalUrl, isTabPage, pageOf } from './internal'
import { sessionFor, setupSession } from './session'
import { byContents, windows } from './registry'
import * as hist from './history'
import { checkStatus, updaterState } from './updater'
import { accountState, openInOtherBrowser } from './account'

const PRELOAD = path.join(__dirname, '../preload/index.js')
const SHELL_PREFS = {
  preload: PRELOAD,
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
} as const
const IDLE_DISCARD_MS = 15 * 60_000
const RAIL_COLLAPSED = 64
const TOP_H = 36
const GAP = 6
/** The page Google shows when it refuses a browser. */
const GOOGLE_BLOCK = /^https:\/\/accounts\.google\.com\/.*\/signin\/rejected/
const BAR = { w: 380, h: 44, bottom: 18 }
const EXIT_W = 112
const PRIVATE_THEME: Partial<Theme> = {
  name: 'ORBIT PRIVATE',
  mode: 'dark',
  background: '#161618',
  surface: '#1c1c1f',
  surface2: '#242428',
  text: '#ececee',
  accent: '#b6a9e8',
  sidebar: '#121214',
  activeTab: '#2b2b30',
  orbitBar: '#202023',
}

interface Tab {
  id: string
  spaceId: string
  url: string
  title: string
  favicon: string
  loading: boolean
  audible: boolean
  muted: boolean
  archived: boolean
  lastActive: number
  view: WebContentsView | null
}
interface NewTabOpts {
  url?: string
  spaceId?: string
  activate?: boolean
  afterId?: string
}

let privateCounter = 0
interface AskResult {
  value: string | null
  checked: boolean
}

export class OrbitWindow {
  readonly win: BrowserWindow
  readonly chrome: WebContentsView
  readonly overlay: WebContentsView
  readonly privateId: number | null
  tabs: Tab[] = []
  activeId: string | null = null
  activeSpaceId: string
  split: { a: string; b: string; ratio: number } | null = null
  closed: { url: string; title: string; spaceId: string }[] = []
  railExpanded = true
  focus = false
  peek = false
  overlayMode: OverlayMode = 'compact'
  overlayText = ''
  overlaySeq = 0
  private dialogSpec: DialogSpec | null = null
  private menuSpec: { id: string; x: number; y: number; items: MenuEntry[] } | null = null
  private ask: { id: string; mode: 'dialog' | 'menu'; done: (r: AskResult) => void } | null = null
  private askQueue: Promise<unknown> = Promise.resolve()
  find = { active: 0, total: 0 }
  private mounted = new Set<WebContentsView>()
  private htmlFs = false
  private pending: NodeJS.Timeout | null = null
  private saveTimer: NodeJS.Timeout | null = null
  private closing = false
  private rect = { x: 0, y: 0, width: 0, height: 0 }
  /** Rail width and top-strip height as currently drawn; they glide to their goals instead of jumping. */
  railPx = 0
  topPx = 0
  private chromeGoal = { rail: -1, top: -1 }
  private chromeAnim: NodeJS.Timeout | null = null
  private peekWatch: NodeJS.Timeout | null = null
  private peekOutSince = 0

  constructor(opts: { private?: boolean; restore?: boolean } = {}) {
    this.privateId = opts.private ? ++privateCounter : null
    this.activeSpaceId = this.isPrivate ? 'private' : db.data.spaces[0].id
    const b = db.data.bounds
    const theme = this.theme()
    const mac = process.platform === 'darwin'
    this.win = new BrowserWindow({
      width: b.width,
      height: b.height,
      x: this.isPrivate ? undefined : b.x,
      y: this.isPrivate ? undefined : b.y,
      minWidth: 720,
      minHeight: 480,
      show: false,
      backgroundColor: theme.background,
      title: this.isPrivate ? 'X Orbit Private' : 'X Orbit',
      titleBarStyle: 'hidden',
      autoHideMenuBar: true,
      ...(mac
        ? { trafficLightPosition: { x: 22, y: 14 } }
        : { titleBarOverlay: { color: theme.background, symbolColor: theme.text, height: TOP_H } }),
      webPreferences: { sandbox: true, contextIsolation: true },
    })
    if (b.maximized && !this.isPrivate) this.win.maximize()

    this.chrome = new WebContentsView({ webPreferences: SHELL_PREFS })
    this.overlay = new WebContentsView({ webPreferences: SHELL_PREFS })
    this.chrome.setBackgroundColor(theme.background)
    this.overlay.setBackgroundColor('#00000000')
    for (const v of [this.chrome, this.overlay]) {
      byContents.set(v.webContents.id, this)
      v.webContents.on('will-navigate', (e) => e.preventDefault())
      v.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    }
    setupSession(this.chrome.webContents.session)
    this.win.contentView.addChildView(this.chrome)
    this.win.contentView.addChildView(this.overlay)
    void this.chrome.webContents.loadURL('orbit://chrome/')
    void this.overlay.webContents.loadURL('orbit://overlay/')
    windows.add(this)

    this.win.on('resize', () => this.relayout())
    this.win.on('enter-full-screen', () => this.changed())
    this.win.on('leave-full-screen', () => this.changed())
    this.win.on('move', () => this.saveBoundsSoon())
    this.win.on('resize', () => this.saveBoundsSoon())
    this.win.on('close', () => {
      this.closing = true
      if (this.ask) this.endAsk(this.ask, { value: null, checked: false })
      this.saveBounds()
      this.flushSession()
    })
    this.win.on('closed', () => this.dispose())
    this.win.on('focus', () =>
      this.overlayMode !== 'compact' && this.overlayMode !== 'none' && this.overlayMode !== 'update'
        ? this.overlay.webContents.focus()
        : this.focusPage(),
    )
    nativeTheme.on('updated', () => this.changed())

    if (this.isPrivate) {
      this.newTab({ url: 'orbit://newtab' })
    } else if (opts.restore !== false) {
      this.restore()
    }
    this.relayout()
    this.chrome.webContents.once('did-finish-load', () => this.win.show())
  }

  get isPrivate() {
    return this.privateId !== null
  }
  private get primary() {
    return !this.isPrivate && [...windows].find((w) => !w.isPrivate) === this
  }
  get spaces(): Space[] {
    return this.isPrivate
      ? [{ id: 'private', name: 'PRIVATE', icon: '◐', color: '#b6a9e8', container: false }]
      : db.data.spaces
  }
  get activeTab() {
    return this.tabs.find((t) => t.id === this.activeId) ?? null
  }
  tab = (id: string | null | undefined) => this.tabs.find((t) => t.id === id)
  tabByContents = (id: number) => this.tabs.find((t) => t.view?.webContents.id === id)

  theme(): Theme {
    const s = db.data.settings
    const base =
      getPreset(s.themeId) ??
      db.data.customThemes.find((t) => t.id === s.themeId) ??
      getPreset('zero')!
    const t = resolveTheme(base, s.appearance, nativeTheme.shouldUseDarkColors)
    return this.isPrivate
      ? completeTheme({ ...PRIVATE_THEME, text: t.text, name: t.name } as any, 'private')
      : t
  }

  // ── state sync ────────────────────────────────────────────────────────────
  state(): UIState {
    const s = db.data.settings
    return {
      windowId: this.win.id,
      private: this.isPrivate,
      platform: process.platform,
      version: app.getVersion(),
      tabs: this.tabs.map((t): TabInfo => {
        const nav = t.view?.webContents.navigationHistory
        return {
          id: t.id,
          spaceId: t.spaceId,
          url: t.url,
          title: t.title,
          favicon: t.favicon,
          loading: t.loading && !isInternalUrl(t.url), // built-in pages load locally; a spinner would only flicker
          audible: t.audible,
          muted: t.muted,
          canGoBack: nav?.canGoBack() ?? false,
          canGoForward: nav?.canGoForward() ?? false,
          archived: t.archived,
          discarded: !t.view,
          lastActive: t.lastActive,
        }
      }),
      activeTabId: this.activeId,
      split: this.split,
      spaces: this.spaces,
      activeSpaceId: this.activeSpaceId,
      pins: db.data.pins,
      downloads: db.data.downloads,
      settings: s,
      theme: this.theme(),
      customThemes: db.data.customThemes,
      railExpanded: this.railExpanded,
      focus: this.focus,
      peek: this.peek,
      overlay: {
        mode: this.overlayMode,
        text: this.overlayText,
        seq: this.overlaySeq,
        dialog: this.dialogSpec,
        menu: this.menuSpec,
      },
      pageRect: this.rect,
      update: checkStatus(),
      updater: updaterState(),
      account: accountState(),
      railPx: this.railPx,
      topPx: this.topPx,
      find: this.find,
    }
  }

  /** Coalesce state pushes to one per frame. */
  changed() {
    if (this.win.isDestroyed()) return
    this.syncUpdateCard()
    if (this.pending) return
    this.pending = setTimeout(() => {
      this.pending = null
      if (this.win.isDestroyed()) return
      const st = this.state()
      const targets = [
        this.chrome.webContents,
        this.overlay.webContents,
        ...this.tabs.flatMap((t) =>
          t.view && isInternalUrl(t.view.webContents.getURL()) ? [t.view.webContents] : [],
        ),
      ]
      for (const wc of targets) if (!wc.isDestroyed() && !wc.isLoading()) wc.send('state', st)
      const th = st.theme
      if (process.platform !== 'darwin')
        this.win.setTitleBarOverlay({ color: th.background, symbolColor: th.text, height: TOP_H })
      this.win.setBackgroundColor(th.background)
      this.chrome.setBackgroundColor(th.background)
    }, 16)
    this.scheduleSave()
  }

  // ── layout ───────────────────────────────────────────────────────────────
  private get chromeHidden() {
    return this.htmlFs || (this.focus && !this.peek)
  }
  relayout() {
    if (this.win.isDestroyed()) return
    const [W, H] = this.win.getContentSize()
    this.chrome.setBounds({ x: 0, y: 0, width: W, height: H })
    const st = db.data.settings
    const rail = this.chromeHidden
      ? this.htmlFs
        ? 0
        : 4
      : this.railExpanded
        ? st.railWidth
        : RAIL_COLLAPSED
    const top = this.chromeHidden ? 0 : TOP_H
    const g = this.chromeGoal
    if (g.rail < 0 || this.htmlFs || !st.animations || !this.win.isVisible()) {
      this.stopChromeAnim()
      this.chromeGoal = { rail, top }
      this.railPx = rail
      this.topPx = top
    } else if (g.rail !== rail || g.top !== top) {
      this.chromeGoal = { rail, top }
      this.animateChrome(rail, top)
    }
    this.applyChrome()
  }
  private stopChromeAnim() {
    if (this.chromeAnim) clearInterval(this.chromeAnim)
    this.chromeAnim = null
  }
  /** Slides the rail and top strip to their new size (about 0.2 s, easing out) so nothing pops. */
  private animateChrome(rail: number, top: number) {
    this.stopChromeAnim()
    const from = { rail: this.railPx, top: this.topPx }
    const t0 = Date.now()
    this.chromeAnim = setInterval(() => {
      if (this.win.isDestroyed()) return this.stopChromeAnim()
      const k = Math.min(1, (Date.now() - t0) / 200)
      const e = 1 - Math.pow(1 - k, 3)
      this.railPx = Math.round(from.rail + (rail - from.rail) * e)
      this.topPx = Math.round(from.top + (top - from.top) * e)
      this.applyChrome()
      if (k >= 1) this.stopChromeAnim()
    }, 16)
  }
  private applyChrome() {
    if (this.win.isDestroyed()) return
    const [W, H] = this.win.getContentSize()
    const right = db.data.settings.railPosition === 'right'
    this.rect = {
      x: right ? 0 : this.railPx,
      y: this.topPx,
      width: W - this.railPx,
      height: H - this.topPx,
    }
    this.syncViews()
    this.layoutOverlay()
    this.changed()
  }

  private syncViews() {
    const want: { tab: Tab; r: { x: number; y: number; width: number; height: number } }[] = []
    const act = this.activeTab
    const r = this.rect
    if (act && this.split && (act.id === this.split.a || act.id === this.split.b)) {
      const wa = Math.floor((r.width - GAP) * this.split.ratio)
      const a = this.tab(this.split.a),
        b = this.tab(this.split.b)
      if (a) want.push({ tab: a, r: { ...r, width: wa } })
      if (b) want.push({ tab: b, r: { ...r, x: r.x + wa + GAP, width: r.width - wa - GAP } })
    } else if (act) want.push({ tab: act, r })
    const views = new Set<WebContentsView>()
    for (const { tab } of want) {
      this.ensureView(tab)
      views.add(tab.view!)
    }
    for (const v of [...this.mounted])
      if (!views.has(v)) {
        this.win.contentView.removeChildView(v)
        this.mounted.delete(v)
      }
    for (const { tab, r: rr } of want) {
      if (!this.mounted.has(tab.view!)) {
        this.win.contentView.addChildView(tab.view!)
        this.mounted.add(tab.view!)
      }
      tab.view!.setBounds(rr)
    }
    this.win.contentView.addChildView(this.overlay) // re-adding moves it to the top
  }

  private layoutOverlay() {
    const [W, H] = this.win.getContentSize()
    const r = this.rect
    const m = this.overlayMode
    let b = { x: 0, y: 0, width: W, height: H }
    let visible = true
    if (m === 'compact' || m === 'none') {
      // In Focus mode an "Exit focus" button sits beside the Orbit Bar pill (or alone when the pill is off).
      const bar = db.data.settings.orbitBar
      const pill = bar ? Math.min(BAR.w, r.width - 24) : 0
      const w = pill + (this.focus ? (bar ? 8 : 0) + EXIT_W : 0)
      b = {
        x: r.x + Math.round((r.width - w) / 2),
        y: H - BAR.bottom - BAR.h,
        width: w,
        height: BAR.h,
      }
      visible = m === 'compact' && (bar || this.focus) && !this.htmlFs
    } else if (m === 'update') {
      const big = ['available', 'unsupported', 'error'].includes(updaterState().phase)
      const w = Math.min(360, r.width - 32)
      const h = big ? 156 : 112
      b = { x: r.x + r.width - w - 16, y: H - h - 16, width: w, height: h }
    } else if (m === 'find') {
      b = { x: r.x + r.width - 396, y: r.y + 12, width: 380, height: 52 }
    }
    this.overlay.setBounds(b)
    this.overlay.setVisible(visible)
  }

  // ── overlay / chrome flags ────────────────────────────────────────────────
  setOverlay(mode: OverlayMode, text = '') {
    const a = this.ask
    if (a && mode !== a.mode) this.endAsk(a, { value: null, checked: false }) // something else took the overlay: cancel
    this.overlayMode = mode
    this.overlayText = text
    this.overlaySeq++
    this.layoutOverlay()
    if (mode === 'compact' || mode === 'none' || mode === 'update') this.focusPage()
    else this.overlay.webContents.focus()
    this.changed()
  }
  private endAsk(a: NonNullable<OrbitWindow['ask']>, r: AskResult) {
    this.ask = null
    this.dialogSpec = null
    this.menuSpec = null
    a.done(r)
  }
  /** One X Orbit dialog or menu at a time; others wait their turn. */
  private overlayAsk(mode: 'dialog' | 'menu', set: (id: string) => void): Promise<AskResult> {
    const run = () =>
      new Promise<AskResult>((done) => {
        const id = uid()
        set(id)
        this.setOverlay(mode)
        this.ask = { id, mode, done }
      })
    const p = this.askQueue.then(run, run)
    this.askQueue = p
    return p
  }
  /** Called by the overlay page with the chosen button / menu item (or null when dismissed). */
  resolveOverlay(id: string, value: string | null, checked: boolean) {
    const a = this.ask
    if (!a || a.id !== id) return
    this.endAsk(a, { value, checked })
    this.closeOverlay()
  }
  confirm(spec: Omit<DialogSpec, 'id'>): Promise<AskResult> {
    return this.overlayAsk('dialog', (id) => (this.dialogSpec = { ...spec, id }))
  }
  /** Pop-up menu drawn by X Orbit at the mouse position (or `at`, in window coordinates). */
  async popup(template: MenuItemConstructorOptions[], at?: { x: number; y: number }) {
    const acts = new Map<string, () => void>()
    const conv = (t: MenuItemConstructorOptions[]): MenuEntry[] =>
      t.map((it) => {
        const id = uid()
        if (it.type === 'separator') return { id, label: '', separator: true }
        const e: MenuEntry = { id, label: it.label ?? '', disabled: it.enabled === false }
        if (Array.isArray(it.submenu)) e.children = conv(it.submenu)
        else if (it.click) acts.set(id, () => (it.click as () => void)())
        return e
      })
    const items = conv(template)
    let { x, y } = at ?? { x: 0, y: 0 }
    if (!at) {
      const c = screen.getCursorScreenPoint()
      const b = this.win.getContentBounds()
      x = c.x - b.x
      y = c.y - b.y
    }
    const r = await this.overlayAsk('menu', (id) => (this.menuSpec = { id, x, y, items }))
    if (r.value) acts.get(r.value)?.()
  }
  /** The update card shows in the overlay's resting slot while an update is in progress, and gives way to anything else. */
  private syncUpdateCard() {
    if (!this.overlay || this.overlay.webContents.isDestroyed()) return
    const want = updaterState().visible
    if (want && this.overlayMode === 'compact') this.setOverlay('update')
    else if (!want && this.overlayMode === 'update') this.setOverlay('compact')
  }
  closeOverlay() {
    if (this.overlayMode === 'find')
      this.activeTab?.view?.webContents.stopFindInPage('clearSelection')
    this.setOverlay('compact')
  }
  focusPage() {
    if (
      this.overlayMode === 'compact' ||
      this.overlayMode === 'none' ||
      this.overlayMode === 'update'
    )
      this.activeTab?.view?.webContents.focus()
  }
  toggleRail() {
    this.railExpanded = !this.railExpanded
    this.relayout()
  }
  toggleFocus() {
    this.focus = !this.focus
    this.peek = false
    if (this.focus) this.watchPeek()
    this.relayout()
  }
  /**
   * In Focus mode the page covers the window, so it never sees the mouse near the edge. Watch the pointer instead:
   * touching the rail's edge slides the Rail and top bar back in; moving away lets them slide out again.
   */
  private watchPeek() {
    if (this.peekWatch) return
    this.peekWatch = setInterval(() => {
      if (!this.focus || this.win.isDestroyed()) {
        if (this.peekWatch) clearInterval(this.peekWatch)
        this.peekWatch = null
        return
      }
      if (!this.win.isFocused() || this.overlayMode !== 'compact') return
      const c = screen.getCursorScreenPoint()
      const b = this.win.getContentBounds()
      const [W, H] = this.win.getContentSize()
      const x = c.x - b.x
      const y = c.y - b.y
      const inside = x >= 0 && y >= 0 && x < W && y < H
      const edge = db.data.settings.railPosition === 'right' ? W - x : x
      if (inside && edge <= (this.peek ? this.railPx + 12 : 7)) {
        this.peekOutSince = 0
        if (!this.peek) this.setPeek(true)
      } else if (this.peek) {
        if (!this.peekOutSince) this.peekOutSince = Date.now()
        else if (Date.now() - this.peekOutSince > 350) {
          this.peekOutSince = 0
          this.setPeek(false)
        }
      }
    }, 80)
  }
  setPeek(on: boolean) {
    if (this.focus && this.peek !== on) {
      this.peek = on
      this.relayout()
    }
  }

  // ── tabs ─────────────────────────────────────────────────────────────────
  newTab(o: NewTabOpts = {}): Tab {
    const s = db.data.settings
    const url =
      o.url ??
      (!s.onboarded && !this.isPrivate ? 'orbit://welcome' : s.homepage || 'orbit://newtab')
    const tab: Tab = {
      id: uid(),
      spaceId: o.spaceId ?? this.activeSpaceId,
      url,
      title: '',
      favicon: '',
      loading: false,
      audible: false,
      muted: false,
      archived: false,
      lastActive: Date.now(),
      view: null,
    }
    const at = o.afterId ? this.tabs.findIndex((t) => t.id === o.afterId) : -1
    if (at >= 0) this.tabs.splice(at + 1, 0, tab)
    else this.tabs.push(tab)
    if (o.activate !== false) this.activate(tab.id)
    else this.changed()
    return tab
  }

  activate(id: string) {
    const t = this.tab(id)
    if (!t) return
    this.activeId = id
    t.lastActive = Date.now()
    t.archived = false
    this.activeSpaceId = t.spaceId
    if (this.split && id !== this.split.a && id !== this.split.b) this.split = null
    if (this.overlayMode !== 'compact' && this.overlayMode !== 'update') this.setOverlay('compact')
    this.relayout()
    this.focusPage()
  }

  closeTab(id: string) {
    const i = this.tabs.findIndex((t) => t.id === id)
    if (i < 0) return
    const t = this.tabs[i]
    if (!this.isPrivate && isTabPage(t.url) === false && /^https?:/.test(t.url)) {
      this.closed.unshift({ url: t.url, title: t.title, spaceId: t.spaceId })
      this.closed.length = Math.min(this.closed.length, 25)
    }
    this.destroyView(t)
    this.tabs.splice(i, 1)
    if (this.split && (this.split.a === id || this.split.b === id)) this.split = null
    if (this.activeId === id) {
      const same = this.tabs.filter((x) => x.spaceId === t.spaceId && !x.archived)
      const next = same.find((x) => this.tabs.indexOf(x) >= i) ?? same[same.length - 1]
      this.activeId = null
      if (next) this.activate(next.id)
      else this.relayout()
    } else this.changed()
  }

  reopenClosed() {
    const c = this.closed.shift()
    if (c)
      this.newTab({
        url: c.url,
        spaceId: db.data.spaces.some((s) => s.id === c.spaceId) ? c.spaceId : this.activeSpaceId,
      })
  }
  duplicate(id: string) {
    const t = this.tab(id)
    if (t) this.newTab({ url: t.url, spaceId: t.spaceId, afterId: id })
  }
  mute(id: string) {
    const t = this.tab(id)
    if (!t) return
    t.muted = !t.muted
    t.view?.webContents.setAudioMuted(t.muted)
    this.changed()
  }
  moveTab(id: string, beforeId: string | null) {
    const from = this.tabs.findIndex((t) => t.id === id)
    if (from < 0 || id === beforeId) return
    const [t] = this.tabs.splice(from, 1)
    const to = beforeId ? this.tabs.findIndex((x) => x.id === beforeId) : -1
    if (to >= 0) {
      t.spaceId = this.tabs[to].spaceId
      this.tabs.splice(to, 0, t)
    } else this.tabs.push(t)
    this.changed()
  }
  moveToSpace(id: string, spaceId: string) {
    const t = this.tab(id)
    if (!t || !this.spaces.some((s) => s.id === spaceId) || t.spaceId === spaceId) return
    // containers use different sessions, so a moved tab has to be rebuilt in the right one
    const wasActive = this.activeId === id
    this.destroyView(t)
    t.spaceId = spaceId
    if (this.split && (this.split.a === id || this.split.b === id)) this.split = null
    if (wasActive) {
      const rest = this.tabs.find(
        (x) => x.spaceId === this.activeSpaceId && x.id !== id && !x.archived,
      )
      this.activeId = null
      if (rest) this.activate(rest.id)
      else this.relayout()
    } else this.changed()
  }

  navigate(tab: Tab | null | undefined, url: string) {
    if (isInternalUrl(url) && !isTabPage(url)) return
    if (!tab) tab = this.newTab({ url: 'about:blank' })
    tab.url = url
    tab.archived = false
    if (!tab.view) this.ensureView(tab)
    else void tab.view.webContents.loadURL(url).catch(() => {})
    if (this.activeId !== tab.id && !this.split) this.activate(tab.id)
    this.changed()
  }
  input(tab: Tab | null | undefined, raw: string, newTab = false) {
    const r = resolveInput(raw, this.searchCfg())
    if (!r) return
    if (newTab || !tab) this.newTab({ url: r.url })
    else this.navigate(tab, r.url)
  }
  searchCfg() {
    const s = db.data.settings
    return { provider: s.searchProvider, customUrl: s.customSearchUrl, orbitUrl: s.orbitSearchUrl }
  }

  private wc() {
    return this.activeTab?.view?.webContents
  }
  back() {
    this.wc()?.navigationHistory.goBack()
  }
  forward() {
    this.wc()?.navigationHistory.goForward()
  }
  reload(hard = false) {
    const t = this.activeTab
    if (!t) return
    if (!t.view) return void this.ensureView(t)
    if (t.loading) return void t.view.webContents.stop()
    if (hard) t.view.webContents.reloadIgnoringCache()
    else t.view.webContents.reload()
  }
  zoom(delta: number) {
    const wc = this.wc()
    if (wc) wc.setZoomLevel(delta === 0 ? 0 : Math.max(-4, Math.min(4, wc.getZoomLevel() + delta)))
  }
  findInPage(text: string, forward = true, next = false) {
    const wc = this.wc()
    if (!wc) return
    if (!text) {
      wc.stopFindInPage('clearSelection')
      this.find = { active: 0, total: 0 }
      return this.changed()
    }
    wc.findInPage(text, { forward, findNext: next })
  }
  devTools() {
    this.wc()?.openDevTools({ mode: 'detach' })
  }

  // ── split view ────────────────────────────────────────────────────────────
  splitWith(otherId?: string) {
    if (this.split) {
      this.split = null
      return this.relayout()
    }
    const a = this.activeTab
    if (!a) return
    const b =
      otherId && otherId !== a.id
        ? this.tab(otherId)
        : this.newTab({ url: 'orbit://newtab', activate: false, afterId: a.id })
    if (!b) return
    this.split = { a: a.id, b: b.id, ratio: 0.5 }
    this.activate(b.id)
  }
  setRatio(r: number) {
    if (this.split) {
      this.split.ratio = Math.max(0.2, Math.min(0.8, r))
      this.relayout()
    }
  }
  swapSplit() {
    if (this.split) {
      this.split = { ...this.split, a: this.split.b, b: this.split.a, ratio: 1 - this.split.ratio }
      this.relayout()
    }
  }
  detachSplit() {
    this.split = null
    this.relayout()
  }

  // ── spaces ────────────────────────────────────────────────────────────────
  switchSpace(id: string) {
    if (!this.spaces.some((s) => s.id === id)) return
    this.activeSpaceId = id
    const inSpace = this.tabs.filter((t) => t.spaceId === id && !t.archived)
    const last = inSpace.sort((x, y) => y.lastActive - x.lastActive)[0]
    this.activeId = null
    this.split = null
    if (last) this.activate(last.id)
    else this.relayout()
  }
  cycleSpace(dir: 1 | -1) {
    const ids = this.spaces.map((s) => s.id)
    this.switchSpace(ids[(ids.indexOf(this.activeSpaceId) + dir + ids.length) % ids.length])
  }
  cycleTab(dir: 1 | -1) {
    const list = this.tabs.filter((t) => t.spaceId === this.activeSpaceId)
    if (!list.length) return
    const i = list.findIndex((t) => t.id === this.activeId)
    this.activate(list[(i + dir + list.length) % list.length].id)
  }
  tabAt(n: number) {
    const list = this.tabs.filter((t) => t.spaceId === this.activeSpaceId)
    const t = n === 9 ? list[list.length - 1] : list[n - 1]
    if (t) this.activate(t.id)
  }
  openInternal(page: string, section?: string) {
    // Open in the tab you're on (Back returns to your page) instead of piling up new tabs.
    // Only the #fragment changes when you're already on that page, so it's an in-page navigation:
    // nothing reloads and nothing flashes.
    const url = `orbit://${page}${section ? `#${section}` : ''}`
    const t = this.activeTab
    if (!t) return void this.newTab({ url })
    if (pageOf(t.url) === page && t.view && !t.url.includes('?')) {
      t.url = url
      void t.view.webContents.loadURL(url).catch(() => {})
      return this.changed()
    }
    this.navigate(t, url)
  }

  // ── views ─────────────────────────────────────────────────────────────────
  private ensureView(tab: Tab) {
    if (tab.view) return
    const s = db.data.settings
    const ses = sessionFor(
      tab.spaceId,
      new Set(db.data.spaces.filter((x) => x.container).map((x) => x.id)),
      this.privateId,
    )
    const view = new WebContentsView({
      webPreferences: {
        ...SHELL_PREFS,
        session: ses,
        autoplayPolicy: s.autoplay
          ? 'no-user-gesture-required'
          : 'document-user-activation-required',
      },
    })
    tab.view = view
    view.setBackgroundColor(this.theme().background)
    const wc = view.webContents
    byContents.set(wc.id, this)
    wc.setAudioMuted(tab.muted)
    this.bindTab(tab, wc)
    void wc.loadURL(tab.url).catch(() => {})
  }

  private destroyView(tab: Tab) {
    const v = tab.view
    if (!v) return
    tab.view = null
    tab.loading = false
    tab.audible = false
    if (this.mounted.delete(v) && !this.win.isDestroyed()) this.win.contentView.removeChildView(v)
    byContents.delete(v.webContents.id)
    if (!v.webContents.isDestroyed()) v.webContents.close()
  }

  private bindTab(tab: Tab, wc: Electron.WebContents) {
    const current = () => wc.getURL()
    wc.setWindowOpenHandler(({ url, disposition }) => {
      if (/^(mailto|tel):/.test(url)) {
        void shell.openExternal(url)
        return { action: 'deny' }
      }
      if (!/^https?:/.test(url)) return { action: 'deny' }
      if (disposition === 'foreground-tab' || disposition === 'background-tab') {
        this.newTab({
          url,
          spaceId: tab.spaceId,
          afterId: tab.id,
          activate: disposition === 'foreground-tab',
        })
        return { action: 'deny' }
      }
      if (db.data.settings.popups === 'block') return { action: 'deny' }
      // real popup window so window.opener works (OAuth/sign-in flows)
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 520, height: 720 },
      }
    })
    wc.on('will-navigate', (e, url) => {
      if (/^(mailto|tel):/.test(url)) {
        e.preventDefault()
        void shell.openExternal(url)
        return
      }
      const ok =
        /^https?:/.test(url) ||
        (isInternalUrl(url) && isInternalUrl(current()) && isTabPage(url)) ||
        url === 'about:blank'
      if (!ok) e.preventDefault()
    })
    wc.on('page-title-updated', (_e, title) => {
      tab.title = title
      hist.setTitle(tab.url, title)
      this.changed()
    })
    wc.on('page-favicon-updated', (_e, favs) => {
      tab.favicon = favs[0] ?? ''
      this.changed()
    })
    wc.on('did-start-loading', () => {
      tab.loading = true
      this.changed()
    })
    wc.on('did-stop-loading', () => {
      tab.loading = false
      this.changed()
    })
    wc.on('audio-state-changed', (e) => {
      tab.audible = e.audible
      this.changed()
    })
    const nav = (_e: unknown, raw: string, ..._r: unknown[]) => {
      const url = canon(raw)
      if (GOOGLE_BLOCK.test(url)) this.googleBlocked(tab.url)
      if (pageOf(url) === 'error') {
        tab.url = new URL(url).searchParams.get('url') || tab.url
        return this.changed()
      }
      tab.url = url
      tab.favicon = isInternalUrl(url) ? '' : tab.favicon
      if (!this.isPrivate) hist.addVisit(url, wc.getTitle())
      this.find = { active: 0, total: 0 }
      this.changed()
    }
    wc.on('did-navigate', nav as any)
    wc.on(
      'did-navigate-in-page',
      ((e: unknown, url: string, isMain: boolean) => isMain && nav(e, url)) as any,
    )
    wc.on('did-fail-load', (_e, code, desc, url, isMain) => {
      if (!isMain || code === -3) return
      const q = new URLSearchParams({ code: String(code), desc, url })
      void wc.loadURL(`orbit://error?${q}`)
    })
    wc.on('render-process-gone', () => {
      this.destroyView(tab)
      this.changed()
    })
    wc.on('found-in-page', (_e, r) => {
      this.find = { active: r.activeMatchOrdinal, total: r.matches }
      this.changed()
    })
    wc.on('enter-html-full-screen', () => {
      this.htmlFs = true
      this.win.setFullScreen(true)
      this.relayout()
    })
    wc.on('leave-html-full-screen', () => {
      this.htmlFs = false
      this.win.setFullScreen(false)
      this.relayout()
    })
    wc.on('context-menu', (_e, p) => this.pageMenu(tab, wc, p))
  }

  /** Google refuses sign-in in browsers it does not recognise. Say so plainly and offer a way forward. */
  private blockShownAt = 0
  private googleBlocked(from: string) {
    if (Date.now() - this.blockShownAt < 5000) return // one notice per refusal
    this.blockShownAt = Date.now()
    const back =
      /^https:\/\/accounts\.google\.com\//.test(from) && !GOOGLE_BLOCK.test(from)
        ? from
        : 'https://accounts.google.com/'
    void this.confirm({
      title: 'Google does not allow sign-in in this browser',
      message:
        'Google only lets browsers it recognises sign in to Google accounts. Open this page in Chrome to sign in there, or use your X Orbit account here.',
      buttons: [
        { label: 'Cancel', value: 'cancel', kind: 'ghost' },
        { label: 'Use X Orbit account', value: 'account', kind: 'ghost' },
        { label: 'Open in Chrome', value: 'chrome', kind: 'primary' },
      ],
    }).then((r) => {
      if (r.value === 'chrome') openInOtherBrowser(back)
      else if (r.value === 'account') this.openInternal('settings', 'account')
    })
  }

  private pageMenu(tab: Tab, wc: Electron.WebContents, p: Electron.ContextMenuParams) {
    const cfg = this.searchCfg()
    const T: MenuItemConstructorOptions[] = []
    if (p.linkURL) {
      T.push(
        {
          label: 'Open Link in New Tab',
          click: () =>
            this.newTab({ url: p.linkURL, spaceId: tab.spaceId, afterId: tab.id, activate: false }),
        },
        {
          label: 'Open Link in Split View',
          click: () => {
            const n = this.newTab({
              url: p.linkURL,
              spaceId: tab.spaceId,
              afterId: tab.id,
              activate: false,
            })
            this.split = null
            this.activate(tab.id)
            this.splitWith(n.id)
          },
        },
        { label: 'Copy Link Address', click: () => clipboard.writeText(p.linkURL) },
        { type: 'separator' },
      )
    }
    if (p.mediaType === 'image' && p.srcURL) {
      T.push(
        {
          label: 'Open Image in New Tab',
          click: () => this.newTab({ url: p.srcURL, spaceId: tab.spaceId, afterId: tab.id }),
        },
        { label: 'Save Image As…', click: () => wc.downloadURL(p.srcURL) },
        { type: 'separator' },
      )
    }
    if (p.isEditable)
      T.push(
        { label: 'Cut', click: () => wc.cut() },
        { label: 'Copy', click: () => wc.copy() },
        { label: 'Paste', click: () => wc.paste() },
        { label: 'Select All', click: () => wc.selectAll() },
        { type: 'separator' },
      )
    else if (p.selectionText) {
      const q = p.selectionText.trim().slice(0, 80)
      T.push(
        { label: 'Copy', click: () => wc.copy() },
        {
          label: `Search for “${q.length > 24 ? q.slice(0, 24) + '…' : q}”`,
          click: () =>
            this.newTab({ url: buildSearchUrl(q, cfg), spaceId: tab.spaceId, afterId: tab.id }),
        },
        { type: 'separator' },
      )
    }
    T.push(
      {
        label: 'Back',
        enabled: wc.navigationHistory.canGoBack(),
        click: () => wc.navigationHistory.goBack(),
      },
      {
        label: 'Forward',
        enabled: wc.navigationHistory.canGoForward(),
        click: () => wc.navigationHistory.goForward(),
      },
      { label: 'Reload', click: () => wc.reload() },
      { type: 'separator' },
      {
        label: 'Inspect Element',
        click: () => {
          wc.inspectElement(p.x, p.y)
          if (wc.isDevToolsOpened()) wc.devToolsWebContents?.focus()
        },
      },
    )
    void this.popup(T)
  }

  tabMenu(id: string, pin: (id: string) => void) {
    const t = this.tab(id)
    if (!t) return
    const others = this.spaces.filter((s) => s.id !== t.spaceId)
    void this.popup([
      { label: 'Duplicate Tab', click: () => this.duplicate(id) },
      { label: 'Pin Page', click: () => pin(id) },
      { label: t.muted ? 'Unmute Tab' : 'Mute Tab', click: () => this.mute(id) },
      {
        label: 'Open in Split View',
        click: () => {
          this.activate(this.split ? t.id : (this.activeId ?? t.id))
          this.split = null
          this.splitWith(id)
        },
      },
      {
        label: 'Move to Space',
        enabled: others.length > 0,
        submenu: others.map((s) => ({ label: s.name, click: () => this.moveToSpace(id, s.id) })),
      },
      { label: 'Copy URL', click: () => clipboard.writeText(t.url) },
      { type: 'separator' },
      { label: 'Close Tab', click: () => this.closeTab(id) },
    ])
  }

  // ── lifecycle: archive / discard / persistence ────────────────────────────
  sweep() {
    const hours = db.data.settings.archiveAfterHours
    const now = Date.now()
    const visible = new Set([this.activeId, this.split?.a, this.split?.b])
    let dirty = false
    for (const t of this.tabs) {
      if (visible.has(t.id) || t.audible) continue
      if (!this.isPrivate && hours > 0 && now - t.lastActive > hours * 3_600_000 && !t.archived) {
        t.archived = true
        this.destroyView(t)
        dirty = true
      } else if (t.view && now - t.lastActive > IDLE_DISCARD_MS) {
        this.destroyView(t)
        dirty = true
      }
    }
    if (dirty) this.changed()
  }

  private restore() {
    const s = db.data
    const sess = s.session
    if (s.settings.restoreSession && sess?.tabs.length) {
      this.tabs = sess.tabs
        .filter((t) => s.spaces.some((sp) => sp.id === t.spaceId))
        .map((t: SavedTab): Tab => ({
          ...t,
          loading: false,
          audible: false,
          muted: false,
          view: null,
        }))
      this.activeSpaceId = s.spaces.some((x) => x.id === sess.activeSpaceId)
        ? sess.activeSpaceId
        : s.spaces[0].id
      const a = this.tab(sess.activeTabId)
      if (a) return void this.activate(a.id)
      const first = this.tabs.find((t) => t.spaceId === this.activeSpaceId)
      if (first) return void this.activate(first.id)
    }
    this.newTab()
  }

  private scheduleSave() {
    if (!this.primary || this.closing) return
    clearTimeout(this.saveTimer!)
    this.saveTimer = setTimeout(() => this.flushSession(), 800)
  }
  flushSession() {
    if (!this.primary) return
    clearTimeout(this.saveTimer!)
    db.data.session = {
      tabs: this.tabs
        .filter((t) => t.url !== 'about:blank')
        .map((t) => ({
          id: t.id,
          spaceId: t.spaceId,
          url: t.url,
          title: t.title,
          favicon: t.favicon,
          lastActive: t.lastActive,
          archived: t.archived,
        })),
      activeTabId: this.activeId,
      activeSpaceId: this.activeSpaceId,
    }
    db.save()
  }
  private boundsTimer: NodeJS.Timeout | null = null
  private saveBoundsSoon() {
    if (this.primary) {
      clearTimeout(this.boundsTimer!)
      this.boundsTimer = setTimeout(() => this.saveBounds(), 500)
    }
  }
  private saveBounds() {
    if (!this.primary || this.win.isDestroyed()) return
    const max = this.win.isMaximized()
    const b = max ? db.data.bounds : this.win.getBounds()
    const visible = screen.getAllDisplays().some((d) => {
      const w = d.workArea
      return (
        b.x === undefined || (b.x! < w.x + w.width && b.x! + b.width > w.x && b.y! < w.y + w.height)
      )
    })
    if (visible)
      db.data.bounds = { x: b.x, y: b.y, width: b.width, height: b.height, maximized: max }
    else db.data.bounds = { width: b.width, height: b.height, maximized: max }
    db.save()
  }

  private dispose() {
    this.stopChromeAnim()
    if (this.peekWatch) clearInterval(this.peekWatch)
    for (const t of this.tabs) this.destroyView(t)
    for (const v of [this.chrome, this.overlay]) {
      byContents.delete(v.webContents.id)
      if (!v.webContents.isDestroyed()) v.webContents.close()
    }
    windows.delete(this)
    if (this.privateId !== null)
      void sessionFor('private', new Set(), this.privateId).clearStorageData()
  }
}

export { DEFAULT_SPACE }
