import { app, clipboard, ipcMain, nativeTheme, type IpcMainInvokeEvent } from 'electron'
import { PRESETS, getPreset, parseTheme } from '@orbit/themes'
import type { PermissionKey, PermissionValue, Settings, SiteInfo } from '@orbit/types'
import { db, uid } from './store'
import { byContents, broadcast } from './registry'
import { OrbitWindow } from './window'
import { TAB_PAGES, isInternalUrl, pageOf } from './internal'
import * as hist from './history'
import { clearDownloads, downloadOp } from './downloads'
import {
  checkForUpdates,
  dismissUpdate,
  downloadUpdate,
  installUpdate,
  manualDownloadUrl,
} from './updater'
import {
  clearData,
  createSpace,
  deleteSpace,
  openJson,
  pickBookmarksFile,
  paletteItems,
  pinPage,
  runCommand,
  saveJson,
  suggest,
} from './commands'
import { sessionFor } from './session'
import { isBrowser, readBookmarks, readBookmarksFile } from './bookmarks'
import * as vault from './vault'
import { copySecret } from './autofill'
import * as account from './account'

const str = (v: unknown, max = 2000): string => (typeof v === 'string' && v.length <= max ? v : '')
const bool = (v: unknown) => typeof v === 'boolean'
const oneOf =
  (...xs: unknown[]) =>
  (v: unknown) =>
    xs.includes(v)
const httpOrEmpty = (v: unknown) =>
  typeof v === 'string' &&
  v.length < 500 &&
  (v === '' || /^(https?:\/\/|orbit:\/\/(newtab|settings)\b)/.test(v))

const SETTING_RULES: { [K in keyof Settings]?: (v: unknown) => boolean } = {
  restoreSession: bool,
  homepage: httpOrEmpty,
  searchProvider: oneOf('google', 'bing', 'duckduckgo', 'brave', 'orbit', 'custom'),
  customSearchUrl: (v) =>
    typeof v === 'string' && (v === '' || (/^https?:\/\//.test(v) && v.includes('%s'))),
  orbitSearchUrl: (v) => typeof v === 'string' && /^https?:\/\//.test(v),
  appearance: oneOf('theme', 'dark', 'light', 'system'),
  archiveAfterHours: oneOf(0, 12, 24, 72, 168),
  railPosition: oneOf('left', 'right'),
  railWidth: (v) => typeof v === 'number' && v >= 200 && v <= 420,
  animations: bool,
  compact: bool,
  orbitBar: bool,
  blockThirdPartyCookies: bool,
  javascript: bool,
  popups: oneOf('allow', 'block'),
  autoplay: bool,
  askDownload: bool,
  offerToSavePasswords: bool,
  autoUpdate: bool,
  channel: oneOf('stable', 'beta', 'developer'),
  onboarded: bool,
}
const PERM_KEYS: PermissionKey[] = ['camera', 'microphone', 'geolocation', 'notifications']
const PERM_VALUES = ['allow', 'block', 'ask']

/** Only the main frame of a view we created, showing an orbit:// page, may talk to us. */
function trust(e: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>): OrbitWindow {
  const f = e.senderFrame
  const w = byContents.get(e.sender.id)
  if (!w || !f || f.parent || !f.url.startsWith('orbit://')) throw new Error('untrusted IPC sender')
  return w
}

type Payload = Record<string, any>
type Handler = (w: OrbitWindow, p: Payload, e: IpcMainInvokeEvent) => unknown
const targetTab = (w: OrbitWindow, p: Payload, e: IpcMainInvokeEvent) =>
  w.tab(str(p.tabId)) ?? w.tabByContents(e.sender.id) ?? w.activeTab

/** Adds imported bookmarks as pins in the current Space (skipping ones already there). */
function addImportedPins(
  w: OrbitWindow,
  items: { title: string; url: string; folder: string }[],
  from: string,
) {
  const have = new Set(db.data.pins.filter((x) => x.spaceId === w.activeSpaceId).map((x) => x.url))
  let n = 0
  for (const b of items) {
    if (have.has(b.url)) continue
    have.add(b.url)
    db.data.pins.push({
      id: uid(),
      spaceId: w.activeSpaceId,
      title: b.title,
      url: b.url,
      favicon: '',
      folder: b.folder,
      favorite: false,
    })
    n++
  }
  db.save()
  broadcast()
  return n
    ? `Imported ${n} bookmark${n === 1 ? '' : 's'} from ${from}`
    : `No new bookmarks in ${from}`
}

const ACT: Record<string, Handler> = {
  // tabs
  newTab: (w, p) =>
    w.newTab({ url: str(p.url) || undefined, spaceId: str(p.spaceId) || undefined }),
  closeTab: (w, p) => w.closeTab(str(p.id)),
  activateTab: (w, p) => w.activate(str(p.id)),
  duplicateTab: (w, p) => w.duplicate(str(p.id)),
  muteTab: (w, p) => w.mute(str(p.id)),
  moveTab: (w, p) => w.moveTab(str(p.id), str(p.beforeId) || null),
  moveTabToSpace: (w, p) => w.moveToSpace(str(p.id), str(p.spaceId)),
  tabMenu: (w, p) => w.tabMenu(str(p.id), (id) => pinPage(w, id)),
  reopenTab: (w) => w.reopenClosed(),
  // navigation
  navigate: (w, p, e) => {
    const tab = targetTab(w, p, e)
    if (typeof p.input === 'string') return w.input(tab, str(p.input), !!p.newTab)
    const url = str(p.url)
    if (!/^https?:\/\//.test(url) && !(isInternalUrl(url) && TAB_PAGES.includes(pageOf(url) ?? '')))
      return
    if (p.openPin) {
      const open = w.tabs.find((t) => t.spaceId === w.activeSpaceId && t.url === url)
      return open ? w.activate(open.id) : void w.newTab({ url })
    }
    if (p.newTab) w.newTab({ url })
    else w.navigate(tab, url)
  },
  back: (w) => w.back(),
  forward: (w) => w.forward(),
  reload: (w) => w.reload(),
  // split
  splitTab: (w, p) => w.splitWith(str(p.id) || undefined),
  splitRatio: (w, p) => typeof p.ratio === 'number' && w.setRatio(p.ratio),
  swapSplit: (w) => w.swapSplit(),
  detachSplit: (w) => w.detachSplit(),
  closeSplitSide: (w, p) => w.closeTab(str(p.id)),
  // ui
  toggleRail: (w) => w.toggleRail(),
  toggleFocus: (w) => w.toggleFocus(),
  peek: (w, p) => w.setPeek(!!p.on),
  overlay: (w, p) =>
    w.setOverlay(
      oneOf('compact', 'bar', 'palette', 'site', 'find', 'none')(p.mode) ? p.mode : 'compact',
      str(p.text, 200),
    ),
  closeOverlay: (w) => w.closeOverlay(),
  // X Orbit's own confirmation box and menu (pages ask; the overlay answers)
  confirm: async (w, p) =>
    (
      await w.confirm({
        title: str(p.title, 200),
        message: str(p.message, 600),
        buttons: [
          { label: str(p.cancel, 40) || 'Cancel', value: 'cancel', kind: 'ghost' },
          { label: str(p.ok, 40) || 'OK', value: 'ok', kind: p.danger ? 'danger' : 'primary' },
        ],
      })
    ).value === 'ok',
  overlayResult: (w, p) =>
    w.resolveOverlay(
      str(p.id, 64),
      typeof p.value === 'string' ? str(p.value, 64) : null,
      !!p.checked,
    ),
  openInternal: (w, p) =>
    TAB_PAGES.includes(str(p.page)) && w.openInternal(str(p.page), str(p.section, 20) || undefined),
  cmd: (w, p) => runCommand(str(p.id, 40), w, str(p.arg, 200) || undefined),
  copy: (_w, p) => clipboard.writeText(str(p.text, 5000)),
  find: (w, p) => w.findInPage(str(p.text, 200), p.forward !== false, !!p.next),
  newWindow: (_w, p) => void new OrbitWindow({ private: !!p.private }),
  // spaces & pins
  createSpace: (w, p) =>
    createSpace(w, str(p.name, 40), {
      icon: str(p.icon, 4),
      color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : undefined,
      container: !!p.container,
    }),
  switchSpace: (w, p) => w.switchSpace(str(p.id)),
  updateSpace: (_w, p) => {
    const s = db.data.spaces.find((x) => x.id === p.id)
    if (!s) return
    if (str(p.name, 40)) s.name = str(p.name, 40).toUpperCase()
    if (str(p.icon, 4)) s.icon = str(p.icon, 4)
    if (/^#[0-9a-f]{6}$/i.test(p.color)) s.color = p.color
    if (bool(p.container)) s.container = p.container // applies to tabs opened afterwards
    db.save()
    broadcast()
  },
  deleteSpace: (_w, p) => deleteSpace(str(p.id)),
  pinPage: (w, p) => pinPage(w, str(p.id) || undefined),
  addBookmark: (w, p) => {
    let u: URL
    try {
      u = new URL(
        /^https?:\/\//i.test(str(p.url, 2000)) ? str(p.url, 2000) : 'https://' + str(p.url, 2000),
      )
    } catch {
      return 'That doesn’t look like a web address'
    }
    if (!/^https?:$/.test(u.protocol) || (!u.hostname.includes('.') && u.hostname !== 'localhost'))
      return 'That doesn’t look like a web address'
    if (db.data.pins.some((x) => x.url === u.href && x.spaceId === w.activeSpaceId))
      return 'Already bookmarked'
    db.data.pins.push({
      id: uid(),
      spaceId: w.activeSpaceId,
      title: str(p.title, 200) || u.host.replace(/^www\./, ''),
      url: u.href,
      favicon: '',
      folder: '',
      favorite: false,
    })
    db.save()
    broadcast()
    return 'Added'
  },
  importBookmarks: (w, p) => {
    const id = str(p.browser, 10)
    if (!isBrowser(id)) return 'Unknown browser'
    const r = readBookmarks(id)
    const name = id[0].toUpperCase() + id.slice(1)
    if (!r)
      return `Couldn’t find ${name} bookmarks (macOS may be blocking X Orbit from reading them). Use “Import from file” instead.`
    return addImportedPins(w, r.items, r.label)
  },
  importBookmarksFile: async (w) => {
    const file = await pickBookmarksFile(w)
    if (!file) return ''
    const items = readBookmarksFile(file)
    if (!items?.length) return 'That file has no bookmarks X Orbit can read'
    return addImportedPins(w, items, 'the file')
  },
  // ── saved passwords & cards (encrypted vault; see vault.ts) ──
  vaultAddLogin: (_w, p) => {
    try {
      const u = new URL(
        /^https?:\/\//i.test(str(p.url, 2000)) ? str(p.url, 2000) : 'https://' + str(p.url, 2000),
      )
      const ok =
        u.protocol === 'https:' ||
        (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))
      if (!ok || (!u.hostname.includes('.') && u.hostname !== 'localhost'))
        return 'Enter a secure (https) site address'
      const password = str(p.password, 1024)
      if (!password) return 'Enter a password'
      vault.upsertLogin(u.origin, str(p.username, 320), password)
      return 'Saved'
    } catch (e) {
      return (e as Error).message || 'Could not save'
    }
  },
  vaultDeleteLogin: (_w, p) => {
    try {
      vault.deleteLogin(str(p.id))
    } catch {
      /* vault unavailable */
    }
  },
  vaultReveal: async (_w, p) => {
    try {
      const l = vault.getLogin(str(p.id))
      return l && (await vault.authorize('show a saved password')) ? l.password : ''
    } catch {
      return ''
    }
  },
  vaultCopy: async (_w, p) => {
    try {
      const l = vault.getLogin(str(p.id))
      if (!l || !(await vault.authorize('copy a saved password'))) return 'Cancelled'
      copySecret(l.password)
      return 'Copied. The clipboard is cleared in 30 seconds.'
    } catch {
      return 'Could not copy'
    }
  },
  vaultAddCard: (_w, p) => {
    try {
      const err = vault.addCard(
        str(p.name, 80),
        str(p.number, 40),
        Number(p.expMonth),
        Number(p.expYear),
      )
      return err || 'Added'
    } catch (e) {
      return (e as Error).message
    }
  },
  vaultDeleteCard: (_w, p) => {
    try {
      vault.deleteCard(str(p.id))
    } catch {
      /* vault unavailable */
    }
  },
  vaultNeverRemove: (_w, p) => {
    try {
      vault.setNever(str(p.origin, 300), false)
    } catch {
      /* vault unavailable */
    }
  },
  favoritePin: (_w, p) => {
    const x = db.data.pins.find((y) => y.id === p.id)
    if (!x) return
    x.favorite = x.favorite === false
    db.save()
    broadcast()
  },
  unpin: (_w, p) => {
    db.data.pins = db.data.pins.filter((x) => x.id !== p.id)
    db.save()
    broadcast()
  },
  updatePin: (_w, p) => {
    const x = db.data.pins.find((y) => y.id === p.id)
    if (!x) return
    if (typeof p.folder === 'string') x.folder = str(p.folder, 40)
    if (str(p.title, 200)) x.title = str(p.title, 200)
    db.save()
    broadcast()
  },
  movePin: (_w, p) => {
    const pins = db.data.pins
    const from = pins.findIndex((x) => x.id === p.id)
    if (from < 0 || p.id === p.beforeId) return
    const [x] = pins.splice(from, 1)
    const to = pins.findIndex((y) => y.id === p.beforeId)
    if (to >= 0) pins.splice(to, 0, x)
    else pins.push(x)
    db.save()
    broadcast()
  },
  exportPins: (w) =>
    saveJson(w, 'orbit-pins.json', {
      pins: db.data.pins.map(({ title, url, folder, spaceId }) => ({
        title,
        url,
        folder,
        space: db.data.spaces.find((s) => s.id === spaceId)?.name,
      })),
    }),
  importPins: async (w) => {
    try {
      const j: any = await openJson(w)
      if (!j) return 'cancelled'
      let n = 0
      for (const x of Array.isArray(j.pins) ? j.pins.slice(0, 5000) : []) {
        if (typeof x?.url !== 'string' || !/^https?:\/\//.test(x.url)) continue
        const space =
          db.data.spaces.find((s) => s.name === x.space) ??
          db.data.spaces.find((s) => s.id === w.activeSpaceId) ??
          db.data.spaces[0]
        db.data.pins.push({
          id: uid(),
          spaceId: space.id,
          title: str(x.title, 200) || x.url,
          url: x.url,
          favicon: '',
          folder: str(x.folder, 40),
        })
        n++
      }
      db.save()
      broadcast()
      return `Imported ${n} pins`
    } catch (err) {
      return `Import failed: ${(err as Error).message}`
    }
  },
  // settings & themes
  setSetting: (_w, p) => {
    const key = str(p.key, 40)
    const m = /^permissionDefaults\.(\w+)$/.exec(key)
    if (m && PERM_KEYS.includes(m[1] as PermissionKey) && PERM_VALUES.includes(p.value)) {
      db.data.settings.permissionDefaults[m[1] as PermissionKey] = p.value as PermissionValue
    } else if (key === 'themeId') {
      if (getPreset(p.value) || db.data.customThemes.some((t) => t.id === p.value))
        db.data.settings.themeId = p.value
    } else {
      const rule = SETTING_RULES[key as keyof Settings]
      if (!rule || !rule(p.value)) return
      ;(db.data.settings as any)[key] = p.value
    }
    db.save()
    if (key === 'railPosition' || key === 'railWidth' || key === 'orbitBar')
      for (const w of byWindows()) w.relayout()
    else broadcast()
  },
  setTheme: (_w, p) => ACT.setSetting(_w, { key: 'themeId', value: p.id }, undefined as any),
  saveTheme: (_w, p) => {
    const existing = db.data.customThemes.find((t) => t.id === p.theme?.id)
    const id = existing?.id ?? 'custom-' + uid()
    const t = parseTheme({ ...p.theme }, id)
    if (!t) return null
    if (existing) db.data.customThemes[db.data.customThemes.indexOf(existing)] = t
    else db.data.customThemes.push(t)
    db.data.settings.themeId = id
    db.save()
    broadcast()
    return id
  },
  deleteTheme: (_w, p) => {
    db.data.customThemes = db.data.customThemes.filter((t) => t.id !== p.id)
    if (db.data.settings.themeId === p.id) db.data.settings.themeId = 'zero'
    db.save()
    broadcast()
  },
  exportTheme: (w, p) => {
    const t = [...PRESETS, ...db.data.customThemes].find((x) => x.id === p.id)
    if (!t) return false
    const rest: Record<string, unknown> = { ...t }
    delete rest.id
    return saveJson(w, `orbit-theme-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`, rest)
  },
  importTheme: async (w) => {
    try {
      const j = await openJson(w)
      if (!j) return 'cancelled'
      const t = parseTheme(j, 'custom-' + uid())
      if (!t) return 'Import failed: not a valid X Orbit theme (names and #hex colours only)'
      db.data.customThemes.push(t)
      db.data.settings.themeId = t.id
      db.save()
      broadcast()
      return `Imported ${t.name}`
    } catch (err) {
      return `Import failed: ${(err as Error).message}`
    }
  },
  finishOnboarding: (w, p, e) => {
    db.data.settings.onboarded = true
    db.save()
    const t = targetTab(w, p, e)
    if (t) w.navigate(t, db.data.settings.homepage || 'orbit://newtab')
    broadcast()
  },
  // data
  clearData: (_w, p) => clearData(str(p.kind, 10), str(p.range, 10) || 'all'),
  deleteHistory: (_w, p) => {
    if (Array.isArray(p.ids))
      hist.remove(p.ids.filter((x: unknown) => typeof x === 'string').slice(0, 5000))
    broadcast()
  },
  deleteHistoryRange: (_w, p) => clearData('history', str(p.range, 10)),
  dl: (_w, p) => downloadOp(str(p.op, 10), str(p.id)),
  clearDownloads: () => clearDownloads(),
  sitePerm: (_w, p) => {
    const origin = str(p.origin, 300)
    if (
      !/^https?:\/\//.test(origin) ||
      !PERM_KEYS.includes(p.perm) ||
      !PERM_VALUES.includes(p.value)
    )
      return
    const rec = (db.data.sitePerms[origin] ??= {})
    if (p.value === db.data.settings.permissionDefaults[p.perm as PermissionKey])
      delete rec[p.perm as PermissionKey]
    else rec[p.perm as PermissionKey] = p.value
    db.save()
    broadcast()
  },
  clearSiteCookies: async (w, p) => {
    const t = w.tab(str(p.tabId)) ?? w.activeTab
    if (t?.view)
      await t.view.webContents.session.clearStorageData({
        origin: new URL(t.url).origin,
        storages: ['cookies'],
      })
    broadcast()
  },
  // app
  setDefaultBrowser: () => {
    app.setAsDefaultProtocolClient('http')
    app.setAsDefaultProtocolClient('https')
  },
  updateCheck: () => checkForUpdates(true),
  updateDownload: () => downloadUpdate(),
  updateInstall: () => installUpdate(),
  // X Orbit account (every result is "ok" or a plain message starting with "!")
  accountSignUp: (_w, p) =>
    account.signUp(str(p.email, 200), str(p.password, 200), str(p.name, 80)),
  accountSignIn: (_w, p) => account.signIn(str(p.email, 200), str(p.password, 200)),
  accountGoogle: (_w, p) => account.googleStart(!!p.link),
  accountGoogleCancel: () => account.googleCancel(),
  accountResend: () => account.resendVerification(),
  accountVerified: () => account.refreshVerified(),
  accountOpen: () => account.open(),
  accountPoll: () => account.pollVerified(),
  accountReset: (_w, p) => account.resetPassword(str(p.email, 200)),
  accountSignOut: () => account.signOut(),
  updateNow: () => downloadUpdate(),
  updateRetry: async () => {
    await checkForUpdates(true)
    downloadUpdate()
  },
  updateDismiss: () => dismissUpdate(),
  updateManual: (w) => {
    dismissUpdate()
    w.newTab({ url: manualDownloadUrl() })
  },
}
const byWindows = () => new Set(byContents.values())

const QUERY: Record<string, (w: OrbitWindow, p: Payload) => unknown> = {
  history: (_w, p) =>
    hist.search(
      str(p.q, 200),
      Math.min(Number(p.limit) || 200, 1000),
      Number(p.before) || Infinity,
    ),
  suggest: (w, p) => suggest(w, str(p.text, 300)),
  commands: (w, p) => paletteItems(w, str(p.text, 100)),
  vaultStatus: () => {
    const pr = vault.protection()
    return {
      ok: pr.ok,
      backend: pr.backend,
      auth: vault.authLevel(),
      never: pr.ok ? vault.neverList() : [],
    }
  },
  vaultLogins: () =>
    vault.protection().ok
      ? vault.listLogins().sort((a, b) => a.origin.localeCompare(b.origin))
      : [],
  vaultCards: () => (vault.protection().ok ? vault.listCards() : []),
  site: async (w, p): Promise<SiteInfo | null> => {
    const t = w.tab(str(p.tabId)) ?? w.activeTab
    if (!t) return null
    let u: URL
    try {
      u = new URL(t.url)
    } catch {
      return null
    }
    const internal = u.protocol === 'orbit:'
    const perms = { ...db.data.settings.permissionDefaults, ...(db.data.sitePerms[u.origin] ?? {}) }
    const ses = t.view?.webContents.session ?? sessionFor(t.spaceId, new Set(), w.privateId)
    const cookies = /^https?:$/.test(u.protocol)
      ? (await ses.cookies.get({ url: t.url })).length
      : 0
    return {
      origin: u.origin,
      host: internal ? 'X Orbit' : u.host,
      secure: u.protocol === 'https:',
      internal,
      cookies,
      perms,
    }
  },
}

export function initIpc() {
  ipcMain.handle('state', (e) => trust(e).state())
  // Built-in pages ask once, synchronously, at document start so they paint with the right theme on the first frame.
  ipcMain.on('state:sync', (e) => {
    try {
      e.returnValue = trust(e).state()
    } catch {
      e.returnValue = null
    }
  })
  ipcMain.handle('act', async (e, type: unknown, payload: unknown) => {
    const w = trust(e)
    const h = typeof type === 'string' && Object.hasOwn(ACT, type) ? ACT[type] : null
    if (!h) throw new Error('unknown action')
    const r = await h(w, payload && typeof payload === 'object' ? (payload as Payload) : {}, e)
    return typeof r === 'string' || typeof r === 'number' || typeof r === 'boolean' ? r : undefined // never leak main-process objects over IPC
  })
  ipcMain.handle('query', async (e, type: unknown, payload: unknown) => {
    const w = trust(e)
    const h = typeof type === 'string' && Object.hasOwn(QUERY, type) ? QUERY[type] : null
    if (!h) throw new Error('unknown query')
    return h(w, payload && typeof payload === 'object' ? (payload as Payload) : {})
  })
  nativeTheme.on('updated', broadcast)
}
