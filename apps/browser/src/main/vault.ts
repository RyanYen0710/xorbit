// Local, encrypted store for saved logins and payment cards.
//  • The whole vault is one blob encrypted with Electron's safeStorage → the OS keychain (macOS Keychain,
//    Windows DPAPI, Linux Secret Service). It lives in the user's profile folder, never in the repo, never uploaded.
//  • Refuses to store anything if the OS can't provide real encryption (e.g. Linux "basic_text").
//  • Card security codes (CVV/CVC) are never accepted or stored.
//  • No master password yet: anyone who can run code as the signed-in OS user can read it, same as other browsers'
//    built-in managers. Revealing/copying a password or filling a card asks for Touch ID where the OS offers it.
import { app, safeStorage, systemPreferences } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { uid } from './store'

export interface Login {
  id: string
  origin: string
  username: string
  password: string
  createdAt: number
  updatedAt: number
}
export interface Card {
  id: string
  name: string
  number: string
  expMonth: number
  expYear: number
  createdAt: number
}
interface Data {
  v: 1
  logins: Login[]
  cards: Card[]
  never: string[]
}

const file = () => path.join(app.getPath('userData'), 'vault.bin')
let cache: Data | null = null

export function protection(): { ok: boolean; backend: string } {
  try {
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, backend: 'none' }
    if (process.platform === 'linux') {
      const b = (safeStorage as any).getSelectedStorageBackend?.() as string | undefined
      return { ok: !!b && b !== 'basic_text' && b !== 'unknown', backend: b ?? 'unknown' }
    }
    return { ok: true, backend: process.platform === 'darwin' ? 'macOS Keychain' : 'Windows DPAPI' }
  } catch {
    return { ok: false, backend: 'none' }
  }
}
export const authLevel = (): 'touchid' | 'none' =>
  process.platform === 'darwin' && systemPreferences.canPromptTouchID() ? 'touchid' : 'none'

/** Ask the OS to confirm the user is present (Touch ID). Where the OS offers nothing, this cannot add protection. */
export async function authorize(reason: string): Promise<boolean> {
  if (process.env.ORBIT_TEST) return true
  if (authLevel() === 'touchid') {
    try {
      await systemPreferences.promptTouchID(reason)
      return true
    } catch {
      return false
    }
  }
  return true
}

function load(): Data {
  if (cache) return cache
  if (!protection().ok) throw new Error('Secure storage is not available on this computer')
  try {
    cache = JSON.parse(safeStorage.decryptString(fs.readFileSync(file()))) as Data
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
      console.error('[vault] could not read vault', (e as Error).message)
    cache = { v: 1, logins: [], cards: [], never: [] }
  }
  return cache
}
function save() {
  const enc = safeStorage.encryptString(JSON.stringify(cache))
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  fs.writeFileSync(file() + '.tmp', enc, { mode: 0o600 })
  fs.renameSync(file() + '.tmp', file())
}

// ── logins ────────────────────────────────────────────────────────────────────────────────────────
export const listLogins = () => load().logins.map(({ password: _p, ...rest }) => rest)
export const loginsFor = (origin: string) =>
  load()
    .logins.filter((l) => l.origin === origin)
    .map((l) => ({ id: l.id, username: l.username }))
export const getLogin = (id: string) => load().logins.find((l) => l.id === id)
export const findLogin = (origin: string, username: string) =>
  load().logins.find((l) => l.origin === origin && l.username === username)

export function upsertLogin(origin: string, username: string, password: string) {
  const d = load()
  const now = Date.now()
  const ex = d.logins.find((l) => l.origin === origin && l.username === username)
  if (ex) {
    ex.password = password
    ex.updatedAt = now
  } else d.logins.push({ id: uid(), origin, username, password, createdAt: now, updatedAt: now })
  save()
}
export function deleteLogin(id: string) {
  const d = load()
  d.logins = d.logins.filter((l) => l.id !== id)
  save()
}

export const isNever = (origin: string) => load().never.includes(origin)
export const neverList = () => [...load().never]
export function setNever(origin: string, on: boolean) {
  const d = load()
  d.never = on ? [...new Set([...d.never, origin])] : d.never.filter((o) => o !== origin)
  save()
}

// ── cards ─────────────────────────────────────────────────────────────────────────────────────────
export const luhn = (n: string) => {
  if (!/^\d{12,19}$/.test(n)) return false
  let sum = 0
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i])
    if (i % 2) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}
export const brandOf = (n: string) =>
  /^4/.test(n)
    ? 'Visa'
    : /^(5[1-5]|2[2-7])/.test(n)
      ? 'Mastercard'
      : /^3[47]/.test(n)
        ? 'Amex'
        : /^(6011|65|64[4-9])/.test(n)
          ? 'Discover'
          : 'Card'
export const listCards = () =>
  load().cards.map((c) => ({
    id: c.id,
    name: c.name,
    brand: brandOf(c.number),
    last4: c.number.slice(-4),
    expMonth: c.expMonth,
    expYear: c.expYear,
  }))
export const getCard = (id: string) => load().cards.find((c) => c.id === id)

/** Returns an error message, or '' on success. There is deliberately no CVV/CVC field. */
export function addCard(
  name: string,
  rawNumber: string,
  expMonth: number,
  expYear: number,
): string {
  const number = rawNumber.replace(/[\s-]/g, '')
  const y = expYear < 100 ? 2000 + expYear : expYear
  if (!luhn(number)) return 'That card number isn’t valid'
  if (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12)
    return 'Expiry month must be 1–12'
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return 'Expiry year isn’t valid'
  const d = load()
  if (d.cards.some((c) => c.number === number && c.expMonth === expMonth && c.expYear === y))
    return 'That card is already saved'
  d.cards.push({
    id: uid(),
    name: name.slice(0, 80),
    number,
    expMonth,
    expYear: y,
    createdAt: Date.now(),
  })
  save()
  return ''
}
export function deleteCard(id: string) {
  const d = load()
  d.cards = d.cards.filter((c) => c.id !== id)
  save()
}

/** Test helper: forget the in-memory copy so the next call re-reads (and re-decrypts) the file. */
export const _resetCache = () => {
  cache = null
}
