// X Orbit account: sign up / sign in with email + password, or with Google through the person's normal browser.
//  • Same Firebase project, and the same rules, as the Support Center and the website.
//  • Everything is done here in the main process over HTTPS. The page never sees a token or the refresh token.
//  • The refresh token is stored encrypted with the OS keychain (Electron safeStorage); ID tokens live only in memory.
//  • Google never sees an embedded sign-in window: we open https://<site>/app-sign-in in the system browser, the person
//    signs in there, and the site hands a short-lived Google ID token back to a one-shot server on 127.0.0.1.
import { app, net, safeStorage, shell } from 'electron'
import { execFile } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import type { AccountState } from '@orbit/types'
import { passwordProblems } from '../shared/password'
import { broadcast } from './registry'
import { protection } from './vault'

// The desktop app's own Firebase API key, baked in at build time from MAIN_VITE_FIREBASE_KEY (a git-ignored .env.local, or a
// CI secret). It is limited in Google Cloud to Identity Toolkit + Token Service, so it can only sign people in. It is not in
// the repo, so GitHub's secret scanner never sees it; the web key (referrer-restricted) is the one the websites use.
const PROD_SITE = 'https://xorbit-browse.vercel.app'
const EMU = process.env.ORBIT_TEST ? process.env.ORBIT_AUTH_EMULATOR : undefined // tests only
const API_KEY: string = EMU ? 'demo-key' : (import.meta.env.MAIN_VITE_FIREBASE_KEY ?? '')
const IDT = EMU
  ? `http://${EMU}/identitytoolkit.googleapis.com/v1`
  : 'https://identitytoolkit.googleapis.com/v1'
const STS = EMU
  ? `http://${EMU}/securetoken.googleapis.com/v1`
  : 'https://securetoken.googleapis.com/v1'
const siteUrl = () => (process.env.ORBIT_TEST && process.env.ORBIT_SITE_URL) || PROD_SITE

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const OUT: AccountState = {
  signedIn: false,
  loading: false,
  busy: false,
  googleWaiting: false,
  email: '',
  name: '',
  verified: false,
  providers: [],
  error: '',
}
let st: AccountState = { ...OUT }
export const accountState = () => st
const set = (p: Partial<AccountState>) => {
  st = { ...st, ...p }
  broadcast()
}

class AccountError extends Error {}
const MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: 'An account with this email already exists. Sign in instead.',
  INVALID_LOGIN_CREDENTIALS: 'Wrong email or password.',
  INVALID_PASSWORD: 'Wrong email or password.',
  EMAIL_NOT_FOUND: 'Wrong email or password.',
  INVALID_EMAIL: 'Enter a valid email address.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a few minutes and try again.',
  USER_DISABLED: 'This account has been disabled.',
  WEAK_PASSWORD: 'That password is not strong enough.',
  PASSWORD_DOES_NOT_MEET_REQUIREMENTS: 'That password is not strong enough.',
  FEDERATED_USER_ID_ALREADY_LINKED:
    'That Google account is already linked to another X Orbit account.',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'For safety, sign in again and retry.',
  TOKEN_EXPIRED: 'Your sign-in expired. Sign in again.',
}
const friendly = (e: unknown) =>
  e instanceof AccountError
    ? e.message
    : (e as { name?: string })?.name === 'TimeoutError' ||
        /fetch failed|network|ENOTFOUND/i.test(String(e))
      ? 'No connection. Check your internet and try again.'
      : 'Something went wrong. Please try again.'

async function call(url: string, body: unknown, form = false): Promise<any> {
  if (!API_KEY)
    throw new AccountError(
      'This build of X Orbit has no account key. Download the latest version from the website.',
    )
  const r = await net.fetch(url, {
    method: 'POST',
    headers: { 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
    body: form ? String(body) : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) {
    const code = String(j?.error?.message ?? 'UNKNOWN').split(/[ :]/)[0]
    throw new AccountError(MESSAGES[code] ?? 'Something went wrong. Please try again.')
  }
  return j
}
const idt = (method: string, body: unknown) => call(`${IDT}/${method}?key=${API_KEY}`, body)

// ── session + storage ───────────────────────────────────────────────────────
let sess: { idToken: string; refreshToken: string; exp: number } | null = null
const file = () => path.join(app.getPath('userData'), 'account.bin')

function persist() {
  if (!sess || !protection().ok) return // never store a token without real OS encryption
  const blob = JSON.stringify({
    v: 1,
    refreshToken: sess.refreshToken,
    profile: { ...st, busy: false },
  })
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  fs.writeFileSync(file() + '.tmp', safeStorage.encryptString(blob), { mode: 0o600 })
  fs.renameSync(file() + '.tmp', file())
}
function forget() {
  sess = null
  fs.rmSync(file(), { force: true })
}

function adopt(r: { idToken: string; refreshToken: string; expiresIn?: string }) {
  sess = {
    idToken: r.idToken,
    refreshToken: r.refreshToken,
    exp: Date.now() + (Number(r.expiresIn) || 3600) * 1000,
  }
}
/** A valid ID token, refreshed when it is about to expire. */
async function token(): Promise<string> {
  if (!sess) throw new AccountError('Sign in first.')
  if (sess.exp - Date.now() > 120_000) return sess.idToken
  try {
    const j = await call(
      `${STS}/token?key=${API_KEY}`,
      `grant_type=refresh_token&refresh_token=${encodeURIComponent(sess.refreshToken)}`,
      true,
    )
    adopt({ idToken: j.id_token, refreshToken: j.refresh_token, expiresIn: j.expires_in })
    persist()
  } catch (e) {
    if (e instanceof AccountError && !/connection/i.test(e.message)) signOutLocal()
    throw e
  }
  return sess.idToken
}
async function loadProfile() {
  const j = await idt('accounts:lookup', { idToken: await token() })
  const u = j.users?.[0]
  if (!u) throw new AccountError('Sign in again.')
  set({
    signedIn: true,
    loading: false,
    email: String(u.email ?? ''),
    name: String(u.displayName ?? ''),
    verified: !!u.emailVerified,
    providers: (u.providerUserInfo ?? []).map((p: any) => String(p.providerId)),
  })
  persist()
}
function signOutLocal() {
  closeGoogle()
  forget()
  st = { ...OUT }
  broadcast()
}

/** Runs one action, shows "busy" while it runs, and turns every failure into a plain message starting with "!". */
async function guard(fn: () => Promise<void>): Promise<string> {
  if (st.busy) return '!Please wait a moment.'
  set({ busy: true, error: '' })
  try {
    await fn()
    return 'ok'
  } catch (e) {
    return '!' + friendly(e)
  } finally {
    set({ busy: false })
  }
}

// ── email + password ────────────────────────────────────────────────────────
export const signUp = (email: string, password: string, name: string) =>
  guard(async () => {
    email = email.trim()
    if (!EMAIL_RE.test(email)) throw new AccountError('Enter a valid email address.')
    const bad = passwordProblems(password, email)
    if (bad.length) throw new AccountError(`Password needs: ${bad.join(', ')}.`)
    const r = await idt('accounts:signUp', { email, password, returnSecureToken: true })
    adopt(r)
    if (name.trim())
      await idt('accounts:update', {
        idToken: sess!.idToken,
        displayName: name.trim().slice(0, 80),
        returnSecureToken: false,
      }).catch(() => {})
    await idt('accounts:sendOobCode', {
      requestType: 'VERIFY_EMAIL',
      idToken: sess!.idToken,
    }).catch(() => {})
    lastResend = Date.now()
    await loadProfile()
  })

export const signIn = (email: string, password: string) =>
  guard(async () => {
    email = email.trim()
    if (!EMAIL_RE.test(email)) throw new AccountError('Enter a valid email address.')
    if (!password) throw new AccountError('Enter your password.')
    adopt(await idt('accounts:signInWithPassword', { email, password, returnSecureToken: true }))
    await loadProfile()
  })

let lastResend = 0
export const resendVerification = () =>
  guard(async () => {
    if (Date.now() - lastResend < 60_000)
      throw new AccountError('Please wait a minute before asking for another email.')
    lastResend = Date.now()
    await idt('accounts:sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: await token() })
  })

/** After the person clicked the link in their email. */
export const refreshVerified = () =>
  guard(async () => {
    await loadProfile()
    if (!st.verified) throw new AccountError('Not confirmed yet. Open the link in the email first.')
  })

/** Quiet background check while the "confirm your email" screen is open (no busy flag, no messages). */
export async function pollVerified() {
  if (sess && !st.busy) await loadProfile().catch(() => {})
  return 'ok'
}

/** Same answer whether or not an account exists, so this can't be used to find out who has one. */
export const resetPassword = (email: string) =>
  guard(async () => {
    email = email.trim()
    if (!EMAIL_RE.test(email)) throw new AccountError('Enter a valid email address.')
    await idt('accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email }).catch((e) => {
      if (e instanceof AccountError && /Too many|connection/i.test(e.message)) throw e
    })
  })

export function signOut() {
  signOutLocal()
  return 'ok'
}

// ── Google, through the normal browser ──────────────────────────────────────
let closeGoogle: () => void = () => {}

const PAGE = (nonce: string) => `<!doctype html><meta charset="utf-8"><title>X Orbit</title>
<body style="font:16px system-ui;background:#050505;color:#f5f5f2;display:grid;place-items:center;height:100vh;margin:0">
<p id="m">Finishing sign-in…</p>
<script nonce="${nonce}">
const body = location.hash.slice(1)
history.replaceState(null, '', '/done')
fetch('/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  .then((r) => { document.getElementById('m').textContent = r.ok ? 'You are signed in. You can close this tab and go back to X Orbit.' : 'That did not work. Go back to X Orbit and try again.' })
  .catch(() => { document.getElementById('m').textContent = 'X Orbit is not listening any more. Go back to X Orbit and try again.' })
</script>`

/** A one-shot server on 127.0.0.1 that accepts exactly one answer, carrying the secret `state` we generated. */
function loopback(state: string) {
  return new Promise<{ port: number; result: Promise<string>; close: () => void }>(
    (resolve, reject) => {
      let done!: (g: string) => void
      let fail!: (e: Error) => void
      const result = new Promise<string>((a, b) => ((done = a), (fail = b)))
      result.catch(() => {})
      let port = 0
      const server = http.createServer((req, res) => {
        const deny = (code = 400) => res.writeHead(code, { 'cache-control': 'no-store' }).end()
        if (req.headers.host !== `127.0.0.1:${port}`) return deny() // blocks DNS-rebinding tricks
        const path = (req.url ?? '').split('?')[0]
        if (req.method === 'GET' && path === '/done') {
          const nonce = crypto.randomBytes(16).toString('base64')
          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            'referrer-policy': 'no-referrer',
            'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; style-src 'unsafe-inline'`,
          })
          return void res.end(PAGE(nonce))
        }
        if (req.method === 'POST' && path === '/token') {
          if (req.headers.origin && req.headers.origin !== `http://127.0.0.1:${port}`)
            return deny(403)
          let body = ''
          req.on('data', (c) => {
            body += c
            if (body.length > 8192) req.destroy()
          })
          req.on('end', () => {
            const p = new URLSearchParams(body)
            const a = Buffer.from(p.get('state') ?? '')
            const b = Buffer.from(state)
            const gid = p.get('gid') ?? ''
            if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return deny(403)
            // a real Google ID token is a JWT (the emulator used in tests hands out plain JSON instead)
            if ((!EMU && !/^[\w-]+\.[\w-]+\.[\w-]*$/.test(gid)) || !gid || gid.length > 4096)
              return deny()
            res.writeHead(204, { 'cache-control': 'no-store' }).end()
            done(gid)
            setTimeout(close, 300)
          })
          return
        }
        deny(404)
      })
      const timer = setTimeout(() => {
        fail(new Error('timeout'))
        close()
      }, 5 * 60_000)
      const close = () => {
        clearTimeout(timer)
        server.close()
        server.closeAllConnections?.()
      }
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as { port: number }).port
        resolve({ port, result, close })
      })
    },
  )
}

/** Opens a page in a real browser (Chrome first). Never inside X Orbit itself, where Google refuses sign-in. */
export function openInOtherBrowser(url: string) {
  if (!/^https?:\/\//.test(url)) return
  if (process.env.ORBIT_TEST) {
    ;(globalThis as any).__orbitOpened = url
    return
  }
  if (process.platform !== 'darwin') return void shell.openExternal(url)
  const ids = [
    'com.google.Chrome',
    'com.microsoft.edgemac',
    'com.brave.Browser',
    'org.mozilla.firefox',
    'com.apple.Safari',
  ]
  const next = (i: number) => {
    if (i >= ids.length) return void shell.openExternal(url)
    execFile('/usr/bin/open', ['-b', ids[i], url], (err) => err && next(i + 1))
  }
  next(0)
}

export async function googleStart(link: boolean): Promise<string> {
  if (st.googleWaiting) return '!Already waiting for Google. Finish in your browser or cancel.'
  if (link && !sess) return '!Sign in first.'
  const state = crypto.randomBytes(32).toString('hex')
  const lb = await loopback(state).catch(() => null)
  if (!lb) return '!Could not start the sign-in. Please try again.'
  closeGoogle = () => {
    lb.close()
    closeGoogle = () => {}
    set({ googleWaiting: false })
  }
  set({ googleWaiting: true, error: '' })
  openInOtherBrowser(
    `${siteUrl()}/app-sign-in?port=${lb.port}&state=${state}${link ? '&mode=link' : ''}`,
  )
  lb.result
    .then(async (gid) => {
      set({ googleWaiting: false, busy: true })
      try {
        const body: Record<string, unknown> = {
          requestUri: 'http://localhost',
          postBody: `id_token=${encodeURIComponent(gid)}&providerId=google.com`,
          returnSecureToken: true,
          returnIdpCredential: true,
        }
        if (link) body.idToken = await token()
        const r = await idt('accounts:signInWithIdp', body)
        if (r.errorMessage) {
          const code = String(r.errorMessage).split(/[ :]/)[0]
          throw new AccountError(MESSAGES[code] ?? 'Something went wrong. Please try again.')
        }
        if (r.needConfirmation || (!r.idToken && !link))
          throw new AccountError(
            'An X Orbit account with this email already exists. Sign in with your password first, then link Google in Account.',
          )
        if (r.idToken) adopt(r)
        else await token() // linking can answer without new tokens: keep the current ones
        await loadProfile()
      } catch (e) {
        set({ error: friendly(e) })
      } finally {
        set({ busy: false })
        closeGoogle = () => {}
      }
    })
    .catch((e: Error) => {
      closeGoogle = () => {}
      set({
        googleWaiting: false,
        error:
          e.message === 'timeout'
            ? 'Google sign-in timed out. Try again.'
            : 'Google sign-in did not finish.',
      })
    })
  return 'ok'
}
export function googleCancel() {
  closeGoogle()
  return 'ok'
}

// ── startup ─────────────────────────────────────────────────────────────────
export async function initAccount() {
  let saved: { refreshToken?: string; profile?: Partial<AccountState> } | null = null
  try {
    if (protection().ok) saved = JSON.parse(safeStorage.decryptString(fs.readFileSync(file())))
  } catch {
    /* nothing saved, or it cannot be read: start signed out */
  }
  if (!saved?.refreshToken) return
  // Show the saved profile at once; confirm with the server in the background.
  sess = { idToken: '', refreshToken: saved.refreshToken, exp: 0 }
  const p = saved.profile ?? {}
  set({
    signedIn: true,
    loading: true,
    email: p.email ?? '',
    name: p.name ?? '',
    verified: !!p.verified,
    providers: p.providers ?? [],
  })
  try {
    await loadProfile()
  } catch {
    set({ loading: false }) // offline: keep what we showed; a revoked sign-in already signed itself out
  }
}
