// Server-side search backends for Orbit Search. Only official APIs — never scrape result pages.
export interface SearchResult {
  title: string
  url: string
  snippet: string
  displayUrl: string
  thumbnail?: string
}
export interface SearchResponse {
  provider: string
  results: SearchResult[]
  total?: number
}
export type SearchKind = 'web' | 'images' | 'news'

export interface SearchProvider {
  id: string
  /** result types this backend can serve; anything else is forwarded to Google by the caller */
  kinds: SearchKind[]
  search(query: string, opts: { kind: SearchKind; page: number }): Promise<SearchResponse>
}

type Env = Record<string, string | undefined>

const host = (u: string) => {
  try {
    return new URL(u).host
  } catch {
    return u
  }
}

async function getJson(url: string, headers: Record<string, string> = {}) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw new Error(`${new URL(url).host} responded ${r.status}`)
  return r.json() as Promise<any>
}

/** Google Programmable Search JSON API (key + cx). */
const google = (key: string, cx: string): SearchProvider => ({
  id: 'google',
  kinds: ['web', 'images'],
  async search(q, { kind, page }) {
    const p = new URLSearchParams({ key, cx, q, start: String((page - 1) * 10 + 1) })
    if (kind === 'images') p.set('searchType', 'image')
    const j = await getJson(`https://www.googleapis.com/customsearch/v1?${p}`)
    return {
      provider: 'google',
      total: Number(j.searchInformation?.totalResults) || undefined,
      results: (j.items ?? []).map((i: any) => ({
        title: i.title,
        url: i.link,
        snippet: i.snippet ?? '',
        displayUrl: i.displayLink ?? host(i.link),
        thumbnail: i.image?.thumbnailLink,
      })),
    }
  },
})

/** Brave Search API (subscription token). */
const brave = (token: string): SearchProvider => ({
  id: 'brave',
  kinds: ['web', 'images'],
  async search(q, { kind, page }) {
    const path = kind === 'images' ? 'images/search' : 'web/search'
    const p = new URLSearchParams({ q, offset: String(page - 1) })
    const j = await getJson(`https://api.search.brave.com/res/v1/${path}?${p}`, {
      'X-Subscription-Token': token,
      Accept: 'application/json',
    })
    const items = kind === 'images' ? j.results : j.web?.results
    return {
      provider: 'brave',
      results: (items ?? []).map((i: any) => ({
        title: i.title,
        url: i.url,
        snippet: i.description ?? '',
        displayUrl: host(i.url),
        thumbnail: i.thumbnail?.src,
      })),
    }
  },
})

/** Serper.dev — Google results through a paid/free-tier API (https://serper.dev). Key stays on the server. */
const serper = (key: string): SearchProvider => ({
  id: 'serper',
  kinds: ['web', 'images', 'news'],
  async search(q, { kind, page }) {
    const r = await fetch(`https://google.serper.dev/${kind === 'web' ? 'search' : kind}`, {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, page, num: 10 }),
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) throw new Error(`serper.dev responded ${r.status}`)
    const j = (await r.json()) as any
    const rows: any[] = kind === 'images' ? j.images : kind === 'news' ? j.news : j.organic
    return {
      provider: 'serper',
      results: (rows ?? []).map((i) => ({
        title: i.title,
        url: i.link,
        snippet: i.snippet ?? (i.source ? `${i.source}${i.date ? ' · ' + i.date : ''}` : ''),
        displayUrl: host(i.link),
        thumbnail: i.thumbnailUrl ?? i.imageUrl,
      })),
    }
  },
})

/** Future Orbit Index service: GET {ORBIT_INDEX_URL}/search?q=&page= → { results: SearchResult[] } */
const orbit = (base: string): SearchProvider => ({
  id: 'orbit',
  kinds: ['web'],
  async search(q, { page }) {
    const j = await getJson(
      `${base.replace(/\/$/, '')}/search?${new URLSearchParams({ q, page: String(page) })}`,
    )
    return { provider: 'orbit', results: j.results ?? [], total: j.total }
  },
})

/** Returns a configured API backend, or null → caller redirects to the provider's own site. */
export function createProvider(env: Env): SearchProvider | null {
  const all: Record<string, SearchProvider> = {}
  if (env.SERPER_API_KEY) all.serper = serper(env.SERPER_API_KEY)
  if (env.GOOGLE_PSE_API_KEY && env.GOOGLE_PSE_CX)
    all.google = google(env.GOOGLE_PSE_API_KEY, env.GOOGLE_PSE_CX)
  if (env.BRAVE_SEARCH_API_KEY) all.brave = brave(env.BRAVE_SEARCH_API_KEY)
  if (env.ORBIT_INDEX_URL) all.orbit = orbit(env.ORBIT_INDEX_URL)
  // explicit choice wins, otherwise the first configured backend in the order above
  return (
    (env.ORBIT_SEARCH_BACKEND && all[env.ORBIT_SEARCH_BACKEND]) || Object.values(all)[0] || null
  )
}
