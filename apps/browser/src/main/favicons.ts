// Website icons for bookmarks. They are fetched straight from each saved site (never through a third party such as
// Google's icon service, which would tell it every site you bookmark), stored with the bookmark as a small data URL, and
// shown even when offline.
import { net } from 'electron'
import { db } from './store'
import { broadcast } from './registry'

const MAX_BYTES = 60_000
const TYPES = /^image\/(png|x-icon|vnd\.microsoft\.icon|svg\+xml|jpeg|gif|webp)/i

/** Skips this computer and private networks: a saved link must not make X Orbit poke at your own network. */
function isPrivateHost(host: string) {
  if (process.env.ORBIT_TEST && process.env.ORBIT_ALLOW_PRIVATE_ICONS) return false // tests serve icons from 127.0.0.1
  const h = host.toLowerCase()
  return (
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === '[::1]' ||
    h.startsWith('[fc') ||
    h.startsWith('[fd') ||
    h.startsWith('[fe80')
  )
}

async function get(url: string, accept: string): Promise<Response | null> {
  // tests never reach out to the internet: they only fetch from the local test server (when allowed)
  if (process.env.ORBIT_TEST && !process.env.ORBIT_ALLOW_PRIVATE_ICONS) return null
  try {
    const u = new URL(url)
    if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) return null
    const r = await net.fetch(u.href, {
      credentials: 'omit',
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
      headers: { accept },
    })
    // also checks where a redirect ended up (when the response says)
    if (!r.ok || (r.url && isPrivateHost(new URL(r.url).hostname))) return null
    return r
  } catch {
    return null
  }
}

async function asDataUrl(url: string): Promise<string> {
  const r = await get(url, 'image/*')
  if (!r) return ''
  const type = (r.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!TYPES.test(type)) return ''
  const buf = Buffer.from(await r.arrayBuffer())
  if (!buf.length || buf.length > MAX_BYTES) return ''
  return `data:${type};base64,${buf.toString('base64')}`
}

/** The icon a page declares (<link rel="icon">), best size first, resolved against the page address. */
async function declaredIcons(pageUrl: string): Promise<string[]> {
  const r = await get(pageUrl, 'text/html')
  if (!r) return []
  const html = (await r.text()).slice(0, 200_000)
  const out: { href: string; size: number }[] = []
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/\brel\s*=\s*["'][^"']*\b(icon|apple-touch-icon)\b/i.test(tag)) continue
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
    if (!href) continue
    const size = Number(/\bsizes\s*=\s*["'](\d+)x/i.exec(tag)?.[1] ?? 0)
    try {
      out.push({ href: new URL(href, r.url || pageUrl).href, size })
    } catch {
      /* skip a broken link */
    }
  }
  // prefer a 32-64 px icon: sharp on any screen without being large
  const score = (n: number) => (n === 0 ? 40 : Math.abs(48 - n))
  return out.sort((a, b) => score(a.size) - score(b.size)).map((x) => x.href)
}

const cache = new Map<string, { icon: string; at: number }>() // origin -> icon ('' = none found; tried again after 30 minutes)
const RETRY_MS = 30 * 60_000

export async function faviconFor(pageUrl: string): Promise<string> {
  let origin: string
  try {
    origin = new URL(pageUrl).origin
  } catch {
    return ''
  }
  const hit = cache.get(origin)
  if (hit && (hit.icon || Date.now() - hit.at < RETRY_MS) && !process.env.ORBIT_TEST)
    return hit.icon
  let icon = await asDataUrl(`${origin}/favicon.ico`)
  if (!icon)
    for (const href of (await declaredIcons(origin + '/')).slice(0, 3))
      if ((icon = await asDataUrl(href))) break
  cache.set(origin, { icon, at: Date.now() })
  return icon
}

let running = false
let again = false
/** Fills in icons for bookmarks that have none (4 at a time, in the background). */
export async function fillIcons() {
  if (running) {
    again = true // something was added while icons were being fetched: go round again afterwards
    return
  }
  running = true
  try {
    const todo = db.data.pins.filter((p) => !p.favicon || !p.favicon.startsWith('data:'))
    const origins = [...new Set(todo.map((p) => p.url))].slice(0, 400)
    let i = 0
    const worker = async () => {
      while (i < origins.length) {
        const url = origins[i++]
        const icon = await faviconFor(url)
        if (!icon) continue
        for (const p of db.data.pins) if (p.url === url || sameOrigin(p.url, url)) p.favicon = icon
        db.save()
        broadcast()
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
  } finally {
    running = false
    if (again) {
      again = false
      void fillIcons()
    }
  }
}
function sameOrigin(a: string, b: string) {
  try {
    return new URL(a).origin === new URL(b).origin
  } catch {
    return false
  }
}
