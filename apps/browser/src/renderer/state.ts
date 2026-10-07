import { useSyncExternalStore } from 'react'
import { applyTheme } from '@orbit/themes'
import type { UIState } from '@orbit/types'

let state: UIState | null = null
const subs = new Set<() => void>()

function set(s: UIState) {
  state = s
  const el = document.documentElement
  applyTheme(el, s.theme)
  el.dataset.animations = s.settings.animations ? 'on' : 'off'
  el.dataset.compact = String(s.settings.compact)
  el.dataset.platform = s.platform
  el.dataset.private = String(s.private)
  el.dataset.side = s.settings.railPosition
  const sp = s.spaces.find((x) => x.id === s.activeSpaceId)
  if (sp) el.style.setProperty('--space', sp.color)
  subs.forEach((f) => f())
}

export function initState() {
  window.orbit.onState(set)
  return window.orbit.getState().then(set)
}
export const useOrbit = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
  )
export const act = (type: string, payload?: Record<string, unknown>) =>
  window.orbit.act(type, payload)
/** X Orbit's own confirmation box (never the system one). Resolves true when the person confirms. */
export const confirmBox = (o: {
  title: string
  message?: string
  ok?: string
  danger?: boolean
}): Promise<boolean> => act('confirm', o) as Promise<boolean>
export const query = (type: string, payload?: Record<string, unknown>) =>
  window.orbit.query(type, payload)

export function hostOf(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === 'orbit:' ? '' : u.host.replace(/^www\./, '')
  } catch {
    return ''
  }
}
export const kbdLabel = (k: string | undefined, mac: boolean) =>
  (k ?? '')
    .replace('Mod', mac ? '⌘' : 'Ctrl')
    .replace('Shift', mac ? '⇧' : 'Shift')
    .replace('Alt', mac ? '⌥' : 'Alt')
    .replace(/\+/g, mac ? '' : '+')
