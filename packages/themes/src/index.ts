import type { Theme } from '@orbit/types'

export type { Theme }

export const PRESETS: Theme[] = [
  {
    id: 'zero',
    name: 'ORBIT / ZERO',
    mode: 'dark',
    background: '#050505',
    surface: '#0d0d0d',
    surface2: '#151515',
    text: '#f5f5f2',
    textSecondary: '#a0a0a0',
    muted: '#686868',
    border: '#ffffff1f',
    borderStrong: '#ffffff38',
    accent: '#9cb4d8',
    activeTab: '#1a1a1a',
    inactiveTab: 'transparent',
    sidebar: '#0a0a0a',
    orbitBar: '#111111',
    selection: '#9cb4d840',
  },
  {
    id: 'lunar',
    name: 'LUNAR',
    mode: 'light',
    background: '#f4f4f0',
    surface: '#ebebe6',
    surface2: '#ffffff',
    text: '#0a0a0a',
    textSecondary: '#5c5c58',
    muted: '#8e8e89',
    border: '#0000001f',
    borderStrong: '#00000038',
    accent: '#33363b',
    activeTab: '#ffffff',
    inactiveTab: 'transparent',
    sidebar: '#ecece7',
    orbitBar: '#ffffff',
    selection: '#33363b26',
  },
  {
    id: 'mars',
    name: 'MARS',
    mode: 'dark',
    background: '#050505',
    surface: '#0e0a09',
    surface2: '#181110',
    text: '#f5efea',
    textSecondary: '#a89a93',
    muted: '#6e5f58',
    border: '#ffffff1f',
    borderStrong: '#ffffff38',
    accent: '#c65332',
    activeTab: '#241512',
    inactiveTab: 'transparent',
    sidebar: '#090605',
    orbitBar: '#140e0c',
    selection: '#c6533340',
  },
  {
    id: 'earth',
    name: 'EARTH',
    mode: 'dark',
    background: '#04060a',
    surface: '#080c14',
    surface2: '#101725',
    text: '#eef3fa',
    textSecondary: '#93a2b8',
    muted: '#5b6b82',
    border: '#ffffff1f',
    borderStrong: '#ffffff38',
    accent: '#2f6fe0',
    activeTab: '#142038',
    inactiveTab: 'transparent',
    sidebar: '#05080e',
    orbitBar: '#0c1320',
    selection: '#2f6fe040',
  },
  {
    id: 'terminal',
    name: 'TERMINAL',
    mode: 'dark',
    background: '#030504',
    surface: '#070b08',
    surface2: '#0d140f',
    text: '#d7f5de',
    textSecondary: '#7fa88a',
    muted: '#4b6b54',
    border: '#3ddc8433',
    borderStrong: '#3ddc8455',
    accent: '#3ddc84',
    activeTab: '#10241a',
    inactiveTab: 'transparent',
    sidebar: '#040706',
    orbitBar: '#09100b',
    selection: '#3ddc8440',
  },
  {
    id: 'titanium',
    name: 'TITANIUM',
    mode: 'dark',
    background: '#17181a',
    surface: '#1e1f22',
    surface2: '#27282c',
    text: '#e6e7e9',
    textSecondary: '#a7a9ad',
    muted: '#75777c',
    border: '#ffffff1f',
    borderStrong: '#ffffff38',
    accent: '#c9ccd1',
    activeTab: '#2f3034',
    inactiveTab: 'transparent',
    sidebar: '#141517',
    orbitBar: '#222326',
    selection: '#c9ccd140',
  },
]

export const DEFAULT_THEME = PRESETS[0]
export const getPreset = (id: string) => PRESETS.find((t) => t.id === id)

// ── colour helpers (hex only: #rgb #rrggbb #rrggbbaa) ───────────────────────
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
export const isColor = (v: unknown): v is string =>
  typeof v === 'string' && (v === 'transparent' || HEX.test(v))

function rgb(hex: string): [number, number, number] {
  if (hex === 'transparent') return [0, 0, 0]
  let h = hex.slice(1)
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}
const toHex = (c: number[]) =>
  '#' +
  c
    .map((n) =>
      Math.round(Math.max(0, Math.min(255, n)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')

/** t=0 → a, t=1 → b */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)]
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}
export const withAlpha = (hex: string, alpha: number) =>
  toHex(rgb(hex)) +
  Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
export const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Fill in every missing field of a partial theme (e.g. an imported 4-colour JSON). */
export function completeTheme(p: Partial<Theme> & { name: string }, id: string): Theme {
  const bg = p.background ?? DEFAULT_THEME.background
  const text = p.text ?? DEFAULT_THEME.text
  const mode = p.mode ?? (luminance(bg) > 0.5 ? 'light' : 'dark')
  const surface = p.surface ?? mix(bg, text, 0.04)
  const surface2 = p.surface2 ?? mix(bg, text, 0.08)
  const accent = p.accent ?? DEFAULT_THEME.accent
  return {
    id,
    name: p.name,
    mode,
    background: bg,
    surface,
    surface2,
    text,
    textSecondary: p.textSecondary ?? mix(text, bg, 0.35),
    muted: p.muted ?? mix(text, bg, 0.6),
    border: p.border ?? withAlpha(text, 0.12),
    borderStrong: p.borderStrong ?? withAlpha(text, 0.22),
    accent,
    activeTab: p.activeTab ?? surface2,
    inactiveTab: p.inactiveTab ?? 'transparent',
    sidebar: p.sidebar ?? mix(bg, mode === 'dark' ? '#000000' : '#000000', 0.15),
    orbitBar: p.orbitBar ?? surface2,
    selection: p.selection ?? withAlpha(accent, 0.25),
  }
}

/** Validate untrusted JSON (theme import). Only hex colours are accepted — no CSS injection. */
export function parseTheme(json: unknown, id: string): Theme | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  if (typeof o.name !== 'string' || !o.name.trim() || o.name.length > 40) return null
  const p: Record<string, unknown> = { name: o.name.trim() }
  for (const k of Object.keys(DEFAULT_THEME)) {
    if (k === 'id' || k === 'name' || k === 'mode' || !(k in o)) continue
    if (!isColor(o[k])) return null
    p[k] = o[k]
  }
  if (o.mode === 'dark' || o.mode === 'light') p.mode = o.mode
  return completeTheme(p as Partial<Theme> & { name: string }, id)
}

/** Dark/light/system override: swap to the ZERO/LUNAR counterpart when the mode disagrees. */
export function resolveTheme(
  theme: Theme,
  appearance: 'theme' | 'dark' | 'light' | 'system',
  systemDark: boolean,
): Theme {
  if (appearance === 'theme') return theme
  const want = appearance === 'system' ? (systemDark ? 'dark' : 'light') : appearance
  if (theme.mode === want) return theme
  return want === 'dark' ? PRESETS[0] : PRESETS[1]
}

export function themeToCssVars(t: Theme): Record<string, string> {
  return {
    '--orbit-bg': t.background,
    '--orbit-surface': t.surface,
    '--orbit-surface-2': t.surface2,
    '--orbit-text': t.text,
    '--orbit-text-2': t.textSecondary,
    '--orbit-muted': t.muted,
    '--orbit-border': t.border,
    '--orbit-border-strong': t.borderStrong,
    '--orbit-accent': t.accent,
    '--orbit-tab-active': t.activeTab,
    '--orbit-tab-inactive': t.inactiveTab,
    '--orbit-sidebar': t.sidebar,
    '--orbit-bar': t.orbitBar,
    '--orbit-selection': t.selection,
    'color-scheme': t.mode,
  }
}

export function applyTheme(el: HTMLElement, t: Theme) {
  for (const [k, v] of Object.entries(themeToCssVars(t))) el.style.setProperty(k, v)
}
