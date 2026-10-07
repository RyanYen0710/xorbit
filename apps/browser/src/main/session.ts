import { app, session, type Session, type WebContents } from 'electron'
import type { PermissionKey, PermissionValue } from '@orbit/types'
import { db } from './store'
import { handleOrbitProtocol } from './internal'
import { hookDownloads } from './downloads'
import { byContents } from './registry'

const done = new WeakSet<Session>()
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'])

// ponytail: crude registrable-domain match (last two labels, three for co.uk-style). Swap for a public-suffix list if it matters.
function site(url: string) {
  try {
    const parts = new URL(url).hostname.split('.')
    const n = parts.length > 2 && SECOND_LEVEL.has(parts[parts.length - 2]) ? 3 : 2
    return parts.slice(-n).join('.')
  } catch {
    return ''
  }
}
function thirdParty(d: { url: string; resourceType: string; webContents?: WebContents | null }) {
  if (d.resourceType === 'mainFrame' || !d.webContents) return false
  const top = d.webContents.getURL()
  return /^https?:/.test(top) && site(top) !== site(d.url)
}

const LABEL: Record<PermissionKey, string> = {
  camera: 'your camera',
  microphone: 'your microphone',
  geolocation: 'your location',
  notifications: 'send notifications',
}
const ALWAYS = new Set(['clipboard-sanitized-write', 'fullscreen', 'pointerLock'])

function keysFor(permission: string, details: any): PermissionKey[] | null {
  if (permission === 'media') {
    const t: string[] = details?.mediaTypes ?? []
    const k: PermissionKey[] = []
    if (t.includes('video')) k.push('camera')
    if (t.includes('audio')) k.push('microphone')
    return k.length ? k : null
  }
  if (permission === 'geolocation' || permission === 'notifications') return [permission]
  return null
}
const decision = (origin: string, k: PermissionKey): PermissionValue =>
  db.data.sitePerms[origin]?.[k] ?? db.data.settings.permissionDefaults[k]

function hookPermissions(ses: Session) {
  ses.setPermissionCheckHandler((_wc, permission, origin, details) => {
    if (ALWAYS.has(permission)) return true
    const keys = keysFor(permission, details)
    return !!keys && keys.every((k) => decision(origin, k) === 'allow')
  })
  ses.setPermissionRequestHandler(async (wc, permission, cb, details: any) => {
    if (ALWAYS.has(permission)) return cb(true)
    const keys = keysFor(permission, details)
    let origin = ''
    try {
      origin = new URL(details.requestingUrl).origin
    } catch {
      return cb(false)
    }
    if (!keys || !/^https?:/.test(origin)) return cb(false)
    const ds = keys.map((k) => decision(origin, k))
    if (ds.includes('block')) return cb(false)
    if (ds.every((d) => d === 'allow')) return cb(true)
    const owner = wc && byContents.get(wc.id)
    if (!owner) return cb(false)
    const r = await owner.confirm({
      title: `${new URL(origin).host} wants to use ${keys.map((k) => LABEL[k]).join(' and ')}`,
      message: 'You can change this later in the site panel.',
      checkbox: 'Remember my choice for this site',
      buttons: [
        { label: 'Block', value: 'block', kind: 'ghost' },
        { label: 'Allow', value: 'allow', kind: 'primary' },
      ],
    })
    const allow = r.value === 'allow'
    if (r.checked) {
      const rec = (db.data.sitePerms[origin] ??= {})
      for (const k of keys) rec[k] = allow ? 'allow' : 'block'
      db.save()
    }
    cb(allow)
  })
}

export function setupSession(ses: Session) {
  if (done.has(ses)) return
  done.add(ses)
  // Present as a normal Chromium browser: sites (Google sign-in in particular) reject "Electron/x" user agents.
  const own = new RegExp(`\\s${app.getName().replace(/\s/g, '')}\\/\\S+`, 'i')
  ses.setUserAgent(
    ses
      .getUserAgent()
      .replace(/\sElectron\/\S+/, '')
      .replace(own, ''),
  )
  handleOrbitProtocol(ses)
  hookDownloads(ses)
  hookPermissions(ses)

  const web = { urls: ['http://*/*', 'https://*/*'] }
  ses.webRequest.onBeforeSendHeaders(web, (d, cb) => {
    if (db.data.settings.blockThirdPartyCookies && thirdParty(d)) {
      for (const k of Object.keys(d.requestHeaders))
        if (k.toLowerCase() === 'cookie') delete d.requestHeaders[k]
    }
    cb({ requestHeaders: d.requestHeaders })
  })
  ses.webRequest.onHeadersReceived(web, (d, cb) => {
    const h = d.responseHeaders ?? {}
    if (db.data.settings.blockThirdPartyCookies && thirdParty(d)) {
      for (const k of Object.keys(h)) if (k.toLowerCase() === 'set-cookie') delete h[k]
    }
    if (
      !db.data.settings.javascript &&
      (d.resourceType === 'mainFrame' || d.resourceType === 'subFrame')
    ) {
      h['Content-Security-Policy'] = [...(h['Content-Security-Policy'] ?? []), "script-src 'none'"]
    }
    cb({ responseHeaders: h })
  })
}

export const mainSession = () => session.fromPartition('persist:orbit')
export const sessionFor = (
  spaceId: string,
  containerSpaces: Set<string>,
  privateId: number | null,
) => {
  const s =
    privateId !== null
      ? session.fromPartition(`orbit-private-${privateId}`)
      : containerSpaces.has(spaceId)
        ? session.fromPartition(`persist:space-${spaceId}`)
        : mainSession()
  setupSession(s)
  return s
}
