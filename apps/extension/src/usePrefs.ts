import { useEffect, useState } from 'react'
import { applyTheme } from '@orbit/themes'
import { DEFAULT_PREFS, getPrefs, themeOf, type Prefs } from './shared'

/** Loads preferences, applies the active theme to the page and live-updates when they change anywhere. */
export function usePrefs(): Prefs {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  useEffect(() => {
    const load = () => void getPrefs().then(setPrefs)
    load()
    chrome.storage.onChanged.addListener(load)
    return () => chrome.storage.onChanged.removeListener(load)
  }, [])
  useEffect(() => applyTheme(document.documentElement, themeOf(prefs)), [prefs])
  return prefs
}

export function useStored<T>(read: () => Promise<T>, initial: T): T {
  const [v, setV] = useState<T>(initial)
  useEffect(() => {
    const load = () => void read().then(setV)
    load()
    chrome.storage.onChanged.addListener(load)
    return () => chrome.storage.onChanged.removeListener(load)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return v
}
