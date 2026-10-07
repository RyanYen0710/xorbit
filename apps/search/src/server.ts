// Orbit Search: a small original search front end. Results come only from official APIs
// (Google Programmable Search, Brave Search API, or a future Orbit Index); with none configured
// every query is forwarded to the user's chosen provider's own site. No scraping.
import http from 'node:http'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { buildSearchUrl, createProvider } from '@orbit/search'
import { page } from './page'

const port = Number(process.env.ORBIT_SEARCH_PORT ?? 4400)
const provider = createProvider(process.env)
const req = createRequire(import.meta.url)
const fontFile = (pkg: string, file: string) =>
  path.join(path.dirname(req.resolve(`${pkg}/package.json`)), 'files', file)
const FONTS: Record<string, string> = {
  'inter.woff2': fontFile('@fontsource-variable/inter', 'inter-latin-wght-normal.woff2'),
  'space-grotesk.woff2': fontFile(
    '@fontsource-variable/space-grotesk',
    'space-grotesk-latin-wght-normal.woff2',
  ),
  'plex-mono.woff2': fontFile('@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff2'),
}
const googleCfg = (q: string) =>
  buildSearchUrl(q, { provider: 'google', customUrl: '', orbitUrl: '' })

const server = http.createServer(async (rq, rs) => {
  const url = new URL(rq.url ?? '/', 'http://localhost')
  const json = (code: number, body: unknown) => {
    rs.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    rs.end(JSON.stringify(body))
  }
  try {
    if (url.pathname.startsWith('/fonts/')) {
      const f = FONTS[url.pathname.slice(7)]
      if (!f) return json(404, { error: 'not found' })
      rs.writeHead(200, {
        'content-type': 'font/woff2',
        'cache-control': 'public, max-age=31536000, immutable',
      })
      return fs.createReadStream(f).pipe(rs)
    }
    if (url.pathname === '/api/search') {
      const q = (url.searchParams.get('q') ?? '').trim().slice(0, 300)
      const type = url.searchParams.get('type') ?? 'web'
      if (!q) return json(400, { error: 'missing q' })
      // Maps has no API backend here; other types fall back to Google when the backend can't serve them.
      if (type === 'maps')
        return json(200, {
          redirect: `https://www.google.com/maps/search/${encodeURIComponent(q)}`,
        })
      const kind = type === 'images' ? 'images' : type === 'news' ? 'news' : 'web'
      if (!provider || !provider.kinds.includes(kind)) {
        const redirect = googleCfg(q) + (kind === 'news' ? '&tbm=nws' : '')
        return json(200, {
          redirect,
          reason: provider ? `${provider.id} does not serve ${kind}` : 'no search API configured',
        })
      }
      const page = Math.max(1, Math.min(10, Number(url.searchParams.get('page')) || 1))
      try {
        return json(200, await provider.search(q, { kind, page }))
      } catch (e) {
        // quota used up, bad key, outage… never leave the user without a search
        console.warn('[orbit-search] backend failed:', (e as Error).message)
        return json(200, {
          redirect: googleCfg(q) + (kind === 'news' ? '&tbm=nws' : ''),
          reason: 'backend unavailable',
        })
      }
    }
    if (url.pathname === '/' || url.pathname === '/orbit-search') {
      rs.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy':
          "default-src 'self'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      })
      return rs.end(page(provider?.id ?? null))
    }
    json(404, { error: 'not found' })
  } catch (e) {
    json(502, { error: (e as Error).message })
  }
})
server.listen(port, '127.0.0.1', () =>
  console.log(
    `Orbit Search → http://localhost:${port}/orbit-search  (backend: ${provider?.id ?? 'none — forwards to Google'})`,
  ),
)
