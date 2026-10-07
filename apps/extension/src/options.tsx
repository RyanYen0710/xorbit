import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Logo } from '@orbit/ui'
import { PRESETS, parseTheme } from '@orbit/themes'
import { PROVIDERS } from '@orbit/search'
import type { SearchProviderId } from '@orbit/types'
import './ext.css'
import { usePrefs, useStored } from './usePrefs'
import {
  GROUP_COLORS,
  GROUP_HEX,
  asChromeColor,
  getSpaces,
  setPrefs,
  setSpaces,
  uid,
  type Space,
} from './shared'

function Options() {
  const prefs = usePrefs()
  const spaces = useStored(getSpaces, [] as Space[])
  const [msg, setMsg] = useState('')
  const themes = [...PRESETS, ...prefs.customThemes]
  const importTheme = async (file?: File) => {
    if (!file) return
    try {
      const t = parseTheme(JSON.parse(await file.text()), 'custom-' + uid())
      if (!t) return setMsg('Not a valid X Orbit theme (names and #hex colours only)')
      await setPrefs({ customThemes: [...prefs.customThemes, t], themeId: t.id })
      setMsg(`Imported ${t.name}`)
    } catch {
      setMsg('Could not read that file')
    }
  }
  const exportTheme = () => {
    const t = themes.find((x) => x.id === prefs.themeId)!
    const { id: _id, ...rest } = t
    const a = document.createElement('a')
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(rest, null, 2)], { type: 'application/json' }),
    )
    a.download = `orbit-theme-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
    a.click()
  }
  const setSpace = (id: string, patch: Partial<Space>) =>
    setSpaces(spaces.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  return (
    <main className="opt">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Logo size={20} />
        <span className="orbit-label">X ORBIT · SETTINGS</span>
      </div>
      <h1 className="orbit-display">Settings</h1>

      <h2>Themes</h2>
      <div className="theme-grid">
        {themes.map((t) => (
          <button
            key={t.id}
            className="theme-card"
            aria-pressed={prefs.themeId === t.id}
            onClick={() => setPrefs({ themeId: t.id })}
            style={{
              background: t.background,
              color: t.text,
              borderColor: prefs.themeId === t.id ? t.accent : t.border,
            }}
          >
            <i style={{ background: t.accent }} />
            {t.name.replace('ORBIT / ', '')}
          </button>
        ))}
      </div>
      <p style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="btn ghost">
          Import theme JSON
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => importTheme(e.target.files?.[0])}
          />
        </label>
        <button className="btn ghost" onClick={exportTheme}>
          Export current
        </button>
        {msg && (
          <span className="orbit-label" role="status">
            {msg}
          </span>
        )}
      </p>

      <h2>Search</h2>
      <div className="row">
        <div>
          <div>Default search provider</div>
          <div className="hint">Used by the Orbit Bar and the new tab page.</div>
        </div>
        <select
          className="field"
          value={prefs.searchProvider}
          aria-label="Default search provider"
          onChange={(e) => setPrefs({ searchProvider: e.target.value as SearchProviderId })}
        >
          {(['google', 'orbit', 'duckduckgo', 'bing', 'brave', 'custom'] as const).map((p) => (
            <option key={p} value={p}>
              {PROVIDERS[p].label}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <div>
          <div>Custom search URL</div>
          <div className="hint">Use %s for the query.</div>
        </div>
        <input
          className="field"
          defaultValue={prefs.customSearchUrl}
          placeholder="https://…%s"
          aria-label="Custom search URL"
          onBlur={(e) => setPrefs({ customSearchUrl: e.target.value.trim() })}
        />
      </div>
      <div className="row">
        <div>
          <div>Orbit Search URL</div>
          <div className="hint">Where your Orbit Search page is served.</div>
        </div>
        <input
          className="field"
          defaultValue={prefs.orbitSearchUrl}
          aria-label="Orbit Search URL"
          onBlur={(e) =>
            /^https?:\/\//.test(e.target.value) &&
            setPrefs({ orbitSearchUrl: e.target.value.trim() })
          }
        />
      </div>

      <h2>Spaces</h2>
      <p className="hint">
        Each Space is a Chrome tab group with its own name and colour. Switching Spaces collapses
        the others.
      </p>
      {spaces.map((s) => (
        <div className="space-row" key={s.id}>
          <input
            className="field"
            style={{ flex: 1 }}
            defaultValue={s.name}
            aria-label="Space name"
            onBlur={async (e) => {
              const n = e.target.value.trim().toUpperCase()
              if (!n || n === s.name) return
              for (const g of await chrome.tabGroups.query({ title: s.name }))
                await chrome.tabGroups.update(g.id, { title: n })
              await setSpace(s.id, { name: n })
            }}
          />
          <select
            className="field"
            value={s.color}
            aria-label={`${s.name} colour`}
            onChange={async (e) => {
              const c = e.target.value as Space['color']
              for (const g of await chrome.tabGroups.query({ title: s.name }))
                await chrome.tabGroups.update(g.id, { color: asChromeColor(c) })
              await setSpace(s.id, { color: c })
            }}
          >
            {GROUP_COLORS.map((c) => (
              <option key={c} value={c} style={{ color: GROUP_HEX[c] }}>
                {c}
              </option>
            ))}
          </select>
          <button
            className="btn ghost"
            disabled={spaces.length < 2}
            onClick={() =>
              confirm(`Delete ${s.name}? Its tabs stay open, ungrouped.`) &&
              setSpaces(spaces.filter((x2) => x2.id !== s.id))
            }
          >
            Delete
          </button>
        </div>
      ))}

      <h2>Shortcuts</h2>
      <p className="hint">
        Alt+O Orbit Bar · Alt+S Mission Control · Alt+Shift+←/→ switch Space. Change them at
        chrome://extensions/shortcuts.
      </p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
)
