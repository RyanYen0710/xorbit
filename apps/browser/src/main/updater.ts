import { app, net } from 'electron'
import { autoUpdater } from 'electron-updater'
import { execFile, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { once } from 'node:events'
import type { UpdaterState } from '@orbit/types'
import { db } from './store'
import { broadcast } from './registry'

const SITE = process.env.ORBIT_SITE_URL ?? 'https://xorbit-browse.vercel.app'
const REPO = 'RyanYen0710/xorbit'
const MAC = process.platform === 'darwin'
const APP_ID = 'app.xorbit.browser'
/** Where releases are fetched from. Tests may point it at a local server; nothing else can. */
const FEED =
  (process.env.ORBIT_TEST && process.env.ORBIT_UPDATE_FEED) ||
  `https://github.com/${REPO}/releases/latest/download/`

const blank: UpdaterState = {
  phase: 'idle',
  version: '',
  received: 0,
  total: 0,
  speed: 0,
  message: '',
  visible: false,
}
let st: UpdaterState = { ...blank }
let dismissed = false
let busy = false
let status = app.isPackaged ? 'idle' : 'dev build — updates disabled'

const set = (patch: Partial<UpdaterState>, text?: string) => {
  st = { ...st, ...patch }
  const showing = [
    'available',
    'downloading',
    'verifying',
    'installing',
    'restarting',
    'unsupported',
    'error',
  ]
  st.visible = showing.includes(st.phase) && !dismissed
  if (text !== undefined) status = text
  broadcast()
}
export const checkStatus = () => status
export const updaterState = () => st

// ── version + feed ───────────────────────────────────────────────────────────
const parts = (v: string) =>
  v
    .split('-')[0]
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0)
export function isNewer(a: string, b: string) {
  const x = parts(a)
  const y = parts(b)
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}

interface Feed {
  version: string
  file: string
  sha512: string
  size: number
}
/** Reads the `latest-mac.yml` that electron-builder writes next to every release. */
export function parseFeed(text: string): Feed | null {
  const version = /^version:\s*['"]?([0-9][\w.-]*)/m.exec(text)?.[1]
  const file = /^path:\s*['"]?([^\s'"]+)/m.exec(text)?.[1]
  if (!version || !file || !/^\d+\.\d+\.\d+$/.test(version) || !/^[\w.-]+\.zip$/.test(file))
    return null
  const block = new RegExp(
    `url:\\s*${file.replace(/[.]/g, '\\.')}\\s+sha512:\\s*(\\S+)\\s+size:\\s*(\\d+)`,
  ).exec(text)
  const sha512 = block?.[1] ?? /^sha512:\s*(\S+)/m.exec(text)?.[1]
  const size = Number(block?.[2] ?? 0)
  if (!sha512 || !/^[A-Za-z0-9+/=]+$/.test(sha512) || size > 1_500_000_000) return null
  return { version, file, sha512, size }
}

// ── where this copy of the app lives ─────────────────────────────────────────
function bundle(): string | null {
  const p = path.resolve(app.getPath('exe'), '../../..')
  return p.endsWith('.app') ? p : null
}
/** Self-update needs a normal, writable install (not a disk image or a quarantined Downloads copy). */
function installProblem(): string | null {
  const b = bundle()
  if (!b) return 'This copy of X Orbit cannot update itself.'
  if (b.startsWith('/Volumes/') || b.includes('/AppTranslocation/'))
    return 'Move X Orbit to your Applications folder (drag it there), open it from there, and it will update itself.'
  try {
    fs.accessSync(path.dirname(b), fs.constants.W_OK)
    fs.accessSync(b, fs.constants.W_OK)
  } catch {
    return 'X Orbit is installed where this account cannot change it, so it cannot update itself.'
  }
  return null
}

const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) =>
    execFile(cmd, args, { maxBuffer: 1 << 20 }, (e, out, err) =>
      e
        ? rej(new Error((err || e.message).toString().trim().split('\n')[0]))
        : res(String(out).trim()),
    ),
  )
const plist = (appPath: string, key: string) =>
  run('/usr/bin/plutil', [
    '-extract',
    key,
    'raw',
    '-o',
    '-',
    path.join(appPath, 'Contents/Info.plist'),
  ])

// ── check ────────────────────────────────────────────────────────────────────
let feed: Feed | null = null

export async function checkForUpdates(manual = false) {
  if (!MAC) return legacyCheck()
  if (!app.isPackaged) return set({}, 'dev build — updates disabled')
  if (busy) return
  dismissed = false
  set({ ...blank, phase: 'checking' }, 'checking…')
  try {
    const res = await net.fetch(FEED + 'latest-mac.yml', {
      signal: AbortSignal.timeout(15_000),
      headers: { 'cache-control': 'no-cache' },
    })
    if (!res.ok) throw new Error(`update feed answered ${res.status}`)
    const f = parseFeed(await res.text())
    if (!f) throw new Error('the update feed could not be read')
    if (!isNewer(f.version, app.getVersion())) {
      feed = null
      return set({ ...blank, phase: 'uptodate' }, 'up to date')
    }
    feed = f
    const problem = installProblem()
    if (problem)
      return set(
        { ...blank, phase: 'unsupported', version: f.version, message: problem },
        `update ${f.version} available`,
      )
    set(
      { ...blank, phase: 'available', version: f.version, total: f.size },
      `update ${f.version} available`,
    )
    if (db.data.settings.autoUpdate) void startUpdate()
  } catch (e) {
    // A failed *background* check stays quiet; a check the person asked for says what happened.
    set(
      manual
        ? {
            ...blank,
            phase: 'error',
            message: `Could not check for updates. ${(e as Error).message}`,
          }
        : { ...blank },
      `couldn’t check: ${(e as Error).message}`,
    )
  }
}

// ── download → verify → install ──────────────────────────────────────────────
const updatesDir = () => path.join(app.getPath('userData'), 'updates')

export async function startUpdate() {
  if (!MAC) return void autoUpdater.downloadUpdate().catch(() => {})
  if (busy || !feed) return
  busy = true
  dismissed = false
  const f = feed
  const dir = updatesDir()
  try {
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const zip = path.join(dir, f.file)
    set(
      { phase: 'downloading', received: 0, total: f.size, speed: 0, message: '' },
      `downloading ${f.version}…`,
    )
    await download(f, zip)
    set({ phase: 'verifying', speed: 0 }, 'verifying…')
    await install(f, zip, dir)
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true })
    busy = false
    set(
      { phase: 'error', speed: 0, message: (e as Error).message },
      `error: ${(e as Error).message}`,
    )
  }
}

async function download(f: Feed, dest: string) {
  const ctl = new AbortController()
  let stall = setTimeout(() => ctl.abort(), 30_000)
  const res = await net.fetch(FEED + f.file, { signal: ctl.signal })
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`)
  const total = f.size || Number(res.headers.get('content-length')) || 0
  const out = fs.createWriteStream(dest)
  const hash = crypto.createHash('sha512')
  const samples: { t: number; b: number }[] = []
  let received = 0
  let speed = 0
  let lastEmit = 0
  const reader = res.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      clearTimeout(stall)
      stall = setTimeout(() => ctl.abort(), 30_000)
      hash.update(value)
      if (!out.write(value)) await once(out, 'drain')
      received += value.length
      const now = Date.now()
      samples.push({ t: now, b: received })
      while (samples.length > 2 && now - samples[0].t > 2000) samples.shift()
      const span = now - samples[0].t
      if (span >= 250)
        speed = speed
          ? speed * 0.6 + ((received - samples[0].b) / span) * 1000 * 0.4
          : ((received - samples[0].b) / span) * 1000
      if (now - lastEmit >= 100) {
        lastEmit = now
        set({ received, total, speed })
      }
    }
  } finally {
    clearTimeout(stall)
  }
  out.end()
  await once(out, 'close')
  set({ received, total: total || received, speed: 0 })
  if (f.size && received !== f.size) throw new Error('the download was incomplete')
  if (hash.digest('base64') !== f.sha512)
    throw new Error('the download did not match its checksum, so it was discarded')
}

// Replaces the app after this process has exited, puts the old one back if anything fails, then reopens X Orbit.
const APPLY = `#!/bin/sh
pid="$1"; new="$2"; target="$3"; backup="$4"; result="$5"
shift 5
i=0
while kill -0 "$pid" 2>/dev/null && [ "$i" -lt 100 ]; do sleep 0.2; i=$((i+1)); done
rm -rf "$backup"
if mv "$target" "$backup" 2>/dev/null; then
  if mv "$new" "$target" 2>/dev/null; then
    echo ok > "$result"; rm -rf "$backup"
  else
    mv "$backup" "$target"; echo fail > "$result"
  fi
else
  echo fail > "$result"
fi
open "$@" "$target"
`

async function install(f: Feed, zip: string, dir: string) {
  const target = bundle()
  if (!target) throw new Error('This copy of X Orbit cannot update itself.')
  const stage = path.join(dir, 'stage')
  fs.mkdirSync(stage, { recursive: true })
  set({ phase: 'installing' }, 'installing…')
  await run('/usr/bin/ditto', ['-x', '-k', zip, stage])
  const apps = fs.readdirSync(stage).filter((n) => n.endsWith('.app'))
  if (apps.length !== 1) throw new Error('the update package is not what was expected')
  const fresh = path.join(stage, apps[0])
  if ((await plist(fresh, 'CFBundleIdentifier')) !== APP_ID)
    throw new Error('the update is for a different app')
  if ((await plist(fresh, 'CFBundleShortVersionString')) !== f.version)
    throw new Error('the update has the wrong version')
  await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', fresh]).catch(() => {
    throw new Error('the update’s signature is not valid, so it was not installed')
  })
  const script = path.join(dir, 'apply.sh')
  fs.writeFileSync(script, APPLY, { mode: 0o700 })
  const result = path.join(app.getPath('userData'), 'update-result')
  fs.rmSync(result, { force: true })
  const backup = path.join(dir, 'previous.app')
  set({ phase: 'restarting', speed: 0 }, `update ${f.version} ready — restarting`)
  // (tests pass the environment on so the reopened copy stays in the test sandbox)
  const reopen = process.env.ORBIT_TEST
    ? [
        '--env',
        'ORBIT_TEST=1',
        '--env',
        `ORBIT_USER_DATA=${process.env.ORBIT_USER_DATA ?? ''}`,
        '--env',
        `ORBIT_UPDATE_FEED=${FEED}`,
      ]
    : []
  spawn('/bin/sh', [script, String(process.pid), fresh, target, backup, result, ...reopen], {
    detached: true,
    stdio: 'ignore',
  }).unref()
  setTimeout(() => app.quit(), 700)
  setTimeout(() => app.exit(0), 5000) // never leave the helper waiting on a stuck shutdown
}

// ── startup ──────────────────────────────────────────────────────────────────
export function initUpdater() {
  if (!MAC) return legacyInit()
  if (!app.isPackaged) return
  // If the last update could not be swapped in (e.g. macOS refused to let X Orbit change itself), say so once.
  const result = path.join(app.getPath('userData'), 'update-result')
  try {
    if (fs.readFileSync(result, 'utf8').trim() === 'fail')
      set(
        {
          phase: 'error',
          message:
            'macOS did not let X Orbit update itself. Download the new version from the website.',
        },
        'the last update could not be installed',
      )
    fs.rmSync(result, { force: true })
    fs.rmSync(updatesDir(), { recursive: true, force: true })
  } catch {
    /* no earlier update: nothing to report */
  }
  setTimeout(() => void checkForUpdates(false), 3000)
  setInterval(() => void checkForUpdates(false), 4 * 3600_000).unref()
}

export function dismissUpdate() {
  dismissed = true
  set({})
}
export const manualDownloadUrl = () => `${SITE}/download`
export const downloadUpdate = () => void startUpdate()
export function installUpdate() {
  if (!MAC && app.isPackaged) autoUpdater.quitAndInstall()
}

// ── Windows/Linux keep the standard updater (those builds are not shipped yet) ───
function legacyInit() {
  if (!app.isPackaged) return
  const s = db.data.settings
  autoUpdater.autoDownload = s.autoUpdate
  autoUpdater.autoInstallOnAppQuit = s.autoUpdate
  autoUpdater.channel = s.channel === 'stable' ? 'latest' : s.channel === 'beta' ? 'beta' : 'alpha'
  autoUpdater.allowPrerelease = s.channel !== 'stable'
  autoUpdater.on('checking-for-update', () => set({}, 'checking…'))
  autoUpdater.on('update-available', (i) => set({}, `update ${i.version} available`))
  autoUpdater.on('update-not-available', () => set({}, 'up to date'))
  autoUpdater.on('update-downloaded', (i) =>
    set({}, `update ${i.version} ready — restart to install`),
  )
  autoUpdater.on('error', (e) => set({}, `error: ${e.message.split('\n')[0]}`))
  setTimeout(() => void legacyCheck(), 10_000)
}
async function legacyCheck() {
  if (!app.isPackaged) return set({}, 'dev build — updates disabled')
  autoUpdater.autoDownload = db.data.settings.autoUpdate
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    set({}, `error: ${(e as Error).message.split('\n')[0]}`)
  }
}
