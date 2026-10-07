import type { SearchProviderId } from '@orbit/types'

export const PROVIDERS: Record<SearchProviderId, { label: string; template: string }> = {
  google: { label: 'Google', template: 'https://www.google.com/search?q=%s' },
  bing: { label: 'Bing', template: 'https://www.bing.com/search?q=%s' },
  duckduckgo: { label: 'DuckDuckGo', template: 'https://duckduckgo.com/?q=%s' },
  brave: { label: 'Brave Search', template: 'https://search.brave.com/search?q=%s' },
  orbit: { label: 'Orbit Search', template: '' }, // filled from orbitSearchUrl
  custom: { label: 'Custom', template: '' }, // filled from customSearchUrl
}

export interface SearchConfig {
  provider: SearchProviderId
  customUrl: string
  orbitUrl: string
}

export function buildSearchUrl(query: string, cfg: SearchConfig): string {
  let tpl = PROVIDERS[cfg.provider]?.template ?? PROVIDERS.google.template
  if (cfg.provider === 'orbit') tpl = `${cfg.orbitUrl}?q=%s`
  if (cfg.provider === 'custom')
    tpl = cfg.customUrl.includes('%s') ? cfg.customUrl : PROVIDERS.google.template
  return tpl.replace('%s', encodeURIComponent(query))
}

const ALLOWED_SCHEMES = /^(https?|file|orbit):/i
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i
const DOMAIN = /^[^\s/?#]+\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?([/?#]\S*)?$/
const LOCAL = /^(localhost|[^\s/]+\.(local|test|localhost))(:\d+)?([/?#]\S*)?$/i

/** Turn whatever was typed into a navigable URL or a search. Never yields javascript:/data: URLs. */
export function resolveInput(
  raw: string,
  cfg: SearchConfig,
): { kind: 'url' | 'search'; url: string } | null {
  const input = raw.trim()
  if (!input) return null
  if (ALLOWED_SCHEMES.test(input) && !/\s/.test(input)) return { kind: 'url', url: input }
  const bare = !/\s/.test(input) && !input.includes('://')
  const hasOtherScheme = ANY_SCHEME.test(input) && !/^[\w.-]+:\d+/.test(input)
  if (bare && !hasOtherScheme) {
    if (LOCAL.test(input) || IPV4.test(input)) return { kind: 'url', url: 'http://' + input }
    if (DOMAIN.test(input)) return { kind: 'url', url: 'https://' + input }
  }
  return { kind: 'search', url: buildSearchUrl(input, cfg) }
}
