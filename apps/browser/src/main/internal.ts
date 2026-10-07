import { net, protocol, type Session } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** Pages a tab may show via orbit://<page>. `chrome` and `overlay` are the shell views, never tabs. */
export const TAB_PAGES = [
  'newtab',
  'settings',
  'history',
  'downloads',
  'themes',
  'pins',
  'welcome',
  'error',
]

export const isInternalUrl = (u: string) => u.startsWith('orbit://')
export function pageOf(u: string): string | null {
  try {
    const x = new URL(u)
    return x.protocol === 'orbit:' ? x.hostname : null
  } catch {
    return null
  }
}
/** orbit://settings/ → orbit://settings (Chromium appends the root slash). */
export const canon = (u: string) => u.replace(/^(orbit:\/\/[\w-]+)\/(?=$|[?#])/, '$1')
export const isTabPage = (u: string) => TAB_PAGES.includes(pageOf(u) ?? '')

/** Must run before app 'ready'. */
export function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'orbit',
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
    },
  ])
}

const DEV = process.env.ELECTRON_RENDERER_URL
const root = path.join(__dirname, '../renderer')

/** Serves the renderer bundle (or the Vite dev server) under orbit://<page>/. The hostname selects the page. */
export function handleOrbitProtocol(ses: Session) {
  ses.protocol.handle('orbit', (req) => {
    const u = new URL(req.url)
    const doc = u.pathname === '/' || u.pathname === ''
    if (DEV) return net.fetch(DEV + (doc ? '/index.html' : u.pathname + u.search))
    const file = path.resolve(root, doc ? 'index.html' : '.' + decodeURIComponent(u.pathname))
    if (!file.startsWith(root + path.sep)) return new Response('forbidden', { status: 403 })
    return net.fetch(pathToFileURL(file).toString())
  })
}
