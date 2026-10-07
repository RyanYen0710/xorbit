import { PRESETS, getPreset, type Theme } from '@orbit/themes'
import type { SearchProviderId } from '@orbit/types'

export interface Prefs {
  themeId: string
  customThemes: Theme[]
  searchProvider: SearchProviderId
  customSearchUrl: string
  orbitSearchUrl: string
}
export type GroupColor =
  'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange'
export interface Space {
  id: string
  name: string
  color: GroupColor
}
export interface Pin {
  id: string
  spaceId: string
  title: string
  url: string
}

export const DEFAULT_PREFS: Prefs = {
  themeId: 'zero',
  customThemes: [],
  searchProvider: 'google',
  customSearchUrl: '',
  orbitSearchUrl: 'http://localhost:4400/orbit-search',
}
export const DEFAULT_SPACES: Space[] = [{ id: 'personal', name: 'PERSONAL', color: 'blue' }]
/** chrome tab-group colours → a hex for our own UI */
export const GROUP_HEX: Record<string, string> = {
  grey: '#a0a0a0',
  blue: '#9cb4d8',
  red: '#c65332',
  yellow: '#d8b86a',
  green: '#3ddc84',
  pink: '#e08fb5',
  purple: '#b6a9e8',
  cyan: '#6fd0d8',
  orange: '#e0894a',
}
export const GROUP_COLORS = Object.keys(GROUP_HEX) as GroupColor[]
/** @types/chrome models tab-group colours as an enum; our stored strings are the same values. */
export const asChromeColor = (c: GroupColor) => c as unknown as chrome.tabGroups.Color

const get = async <T>(key: string, fallback: T): Promise<T> =>
  ((await chrome.storage.local.get(key))[key] as T) ?? fallback
export const getPrefs = async (): Promise<Prefs> => ({
  ...DEFAULT_PREFS,
  ...(await get<Partial<Prefs>>('prefs', {})),
})
export const setPrefs = async (p: Partial<Prefs>) =>
  chrome.storage.local.set({ prefs: { ...(await getPrefs()), ...p } })
export const getSpaces = async () => {
  const s = await get<Space[]>('spaces', [])
  return s.length ? s : DEFAULT_SPACES
}
export const setSpaces = (s: Space[]) => chrome.storage.local.set({ spaces: s })
export const getPins = () => get<Pin[]>('pins', [])
export const setPins = (p: Pin[]) => chrome.storage.local.set({ pins: p })

export const themeOf = (p: Prefs): Theme =>
  getPreset(p.themeId) ?? p.customThemes.find((t) => t.id === p.themeId) ?? PRESETS[0]
export const searchCfg = (p: Prefs) => ({
  provider: p.searchProvider,
  customUrl: p.customSearchUrl,
  orbitUrl: p.orbitSearchUrl,
})

export const faviconUrl = (pageUrl: string, size = 32) =>
  `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`
export const uid = () => crypto.randomUUID().slice(0, 8)
export const hostOf = (u: string) => {
  try {
    return new URL(u).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}
