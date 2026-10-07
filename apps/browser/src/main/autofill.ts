// Save/fill for logins and cards. Security rules enforced here (not trusted from the page):
//  • the site's origin comes from Electron's `senderFrame`, never from the message;
//  • only the top frame of a tab in one of our windows, on https (or localhost for development);
//  • passwords are only ever sent to a page after the user picks them from a NATIVE menu — never into page-visible UI;
//  • a login fills only on the exact origin it was saved for (re-checked at fill time);
//  • the page can't ask for a menu with a script: the preload only forwards trusted (isTrusted) focus events and
//    main throttles requests; nothing auto-submits.
import { Menu, clipboard, dialog, ipcMain, type IpcMainEvent, type WebContents } from 'electron'
import { db } from './store'
import { byContents } from './registry'
import type { OrbitWindow } from './window'
import * as vault from './vault'

const isTest = !!process.env.ORBIT_TEST
const LOCAL = new Set(['localhost', '127.0.0.1'])
const eligible = (u: URL) =>
  u.protocol === 'https:' || (u.protocol === 'http:' && LOCAL.has(u.hostname))
const host = (origin: string) => {
  try {
    return new URL(origin).host
  } catch {
    return origin
  }
}
const str = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : null)

function ctx(e: IpcMainEvent) {
  const w = byContents.get(e.sender.id)
  const f = e.senderFrame
  if (!w || !f || f.parent) return null
  let u: URL
  try {
    u = new URL(f.url)
  } catch {
    return null
  }
  if (!eligible(u)) return null
  const tab = w.tabByContents(e.sender.id)
  return tab ? { w, tab, origin: u.origin, wc: e.sender } : null
}

const asking = new WeakSet<OrbitWindow>()
async function ask(
  w: OrbitWindow,
  message: string,
  detail: string,
  buttons: string[],
): Promise<number> {
  if (isTest) return 0 // tests accept the first (save) button
  if (asking.has(w)) return -1
  asking.add(w)
  try {
    const r = await dialog.showMessageBox(w.win, {
      type: 'question',
      message,
      detail,
      buttons,
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })
    return r.response
  } finally {
    asking.delete(w)
  }
}

async function onCaptured(e: IpcMainEvent, d: any) {
  const c = ctx(e)
  if (
    !c ||
    c.w.isPrivate ||
    !db.data.settings.offerToSavePasswords ||
    !vault.protection().ok ||
    !d ||
    typeof d !== 'object'
  )
    return
  const password = str(d.password, 1024)
  const username = str(d.username, 320) ?? ''
  if (!password) return
  if (vault.isNever(c.origin)) return
  const ex = vault.findLogin(c.origin, username)
  if (ex?.password === password) return
  const update = !!ex
  const r = await ask(
    c.w,
    `${update ? 'Update' : 'Save'} password for ${host(c.origin)}?`,
    `${username ? `Username: ${username}. ` : ''}It is stored encrypted on this computer only.`,
    [update ? 'Update' : 'Save', 'Not now', 'Never for this site'],
  )
  if (r === 0) vault.upsertLogin(c.origin, username, password)
  else if (r === 2) vault.setNever(c.origin, true)
}

async function onCardCaptured(e: IpcMainEvent, d: any) {
  const c = ctx(e)
  if (!c || c.w.isPrivate || !vault.protection().ok || !d || typeof d !== 'object') return
  const number = (str(d.number, 40) ?? '').replace(/[\s-]/g, '')
  if (!vault.luhn(number)) return
  const m = Number(d.expMonth),
    y = Number(d.expYear)
  if (vault.listCards().some((x) => x.last4 === number.slice(-4) && x.expMonth === m)) return
  const r = await ask(
    c.w,
    `Save card ending ${number.slice(-4)}?`,
    `For ${host(c.origin)}. The number is stored encrypted on this computer. Your security code is never saved.`,
    ['Save', 'Not now'],
  )
  if (r === 0) vault.addCard(str(d.name, 80) ?? '', number, m, y)
}

/** Fill a saved login into the tab — only if the page is still on the origin it was saved for. */
export function fillLogin(wc: WebContents, id: string) {
  const l = vault.getLogin(id)
  if (!l || wc.isDestroyed()) return false
  let cur = ''
  try {
    cur = new URL(wc.mainFrame.url).origin
  } catch {
    return false
  }
  if (cur !== l.origin) return false
  wc.mainFrame.send('autofill:fill', { kind: 'login', username: l.username, password: l.password })
  return true
}
export async function fillCard(wc: WebContents, id: string) {
  const card = vault.getCard(id)
  if (!card || wc.isDestroyed()) return false
  let u: URL
  try {
    u = new URL(wc.mainFrame.url)
  } catch {
    return false
  }
  if (!eligible(u) || !(await vault.authorize('fill your saved card'))) return false
  wc.mainFrame.send('autofill:fill', {
    kind: 'card',
    number: card.number,
    expMonth: card.expMonth,
    expYear: card.expYear,
    name: card.name,
  })
  return true
}

let lastMenu = 0
function onMenu(e: IpcMainEvent, d: any) {
  const c = ctx(e)
  if (!c || !vault.protection().ok || !d || typeof d !== 'object') return
  const now = Date.now()
  if (now - lastMenu < 500) return
  const r = d.rect
  if (
    !r ||
    ![r.x, r.y, r.w, r.h].every((n: unknown) => typeof n === 'number' && Number.isFinite(n))
  )
    return
  const login = d.kind === 'login'
  const items = login ? vault.loginsFor(c.origin) : d.kind === 'card' ? vault.listCards() : []
  if (!items.length) return
  lastMenu = now
  const template: Electron.MenuItemConstructorOptions[] = login
    ? (items as { id: string; username: string }[]).map((l) => ({
        label: l.username || '(no username)',
        click: () => fillLogin(c.wc, l.id),
      }))
    : (items as ReturnType<typeof vault.listCards>).map((k) => ({
        label: `${k.brand} •••• ${k.last4}  ${String(k.expMonth).padStart(2, '0')}/${String(k.expYear).slice(-2)}`,
        click: () => void fillCard(c.wc, k.id),
      }))
  template.push(
    { type: 'separator' },
    {
      label: login ? 'Manage passwords…' : 'Manage payment methods…',
      click: () => c.w.openInternal('settings', login ? 'passwords' : 'payments'),
    },
  )
  if (isTest) {
    ;(globalThis as any).__orbitMenu = { kind: d.kind, labels: template.map((t) => t.label ?? '—') }
    return
  }
  const b = c.tab.view?.getBounds() ?? { x: 0, y: 0 }
  const z = c.wc.getZoomFactor()
  Menu.buildFromTemplate(template).popup({
    window: c.w.win,
    x: Math.round(b.x + r.x * z),
    y: Math.round(b.y + (r.y + r.h) * z),
  })
}

export function initAutofill() {
  ipcMain.on('autofill:captured', (e, d) => void onCaptured(e, d).catch(() => {}))
  ipcMain.on('autofill:card', (e, d) => void onCardCaptured(e, d).catch(() => {}))
  ipcMain.on('autofill:menu', onMenu)
}

/** Copy a password and clear the clipboard 30 s later if it is still there. */
export function copySecret(text: string) {
  clipboard.writeText(text)
  setTimeout(async () => {
    if ((await clipboard.readText()) === text) clipboard.clear()
  }, 30_000).unref()
}
