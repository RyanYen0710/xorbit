import { useEffect, useMemo, useState } from 'react'
import { PRESETS, isColor, themeToCssVars } from '@orbit/themes'
import type { Theme } from '@orbit/types'
import { Logo } from '@orbit/ui'
import { act, useOrbit } from '../state'
import { Page } from './shared'

const FIELDS: [keyof Theme, string][] = [
  ['background', 'Background'],
  ['surface2', 'Surface'],
  ['surface', 'Secondary surface'],
  ['text', 'Primary text'],
  ['textSecondary', 'Secondary text'],
  ['muted', 'Muted text'],
  ['border', 'Border'],
  ['accent', 'Accent'],
  ['activeTab', 'Active tab'],
  ['inactiveTab', 'Inactive tab'],
  ['sidebar', 'Sidebar'],
  ['orbitBar', 'Orbit Bar'],
  ['selection', 'Selection'],
]

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const six = /^#[0-9a-f]{6}/i.test(value) ? value.slice(0, 7) : '#000000'
  return (
    <label className="color-row">
      <span>{label}</span>
      <input
        type="color"
        value={six}
        aria-label={`${label} colour`}
        onChange={(e) => onChange(e.target.value + (value.length === 9 ? value.slice(7) : ''))}
      />
      <input
        className="field mono"
        value={text}
        aria-label={`${label} hex`}
        aria-invalid={!isColor(text)}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value)
          if (isColor(e.target.value)) onChange(e.target.value)
        }}
      />
    </label>
  )
}

function Preview({ t }: { t: Theme }) {
  const vars = themeToCssVars(t) as React.CSSProperties
  return (
    <div
      className="preview"
      style={{ ...vars, background: t.background, color: t.text, borderColor: t.border }}
      aria-label="Theme preview"
    >
      <div className="pv-rail" style={{ background: t.sidebar, borderColor: t.border }}>
        <Logo size={16} />
        <div className="pv-tab" style={{ background: t.activeTab }} />
        <div className="pv-tab" style={{ background: t.inactiveTab, borderColor: t.border }} />
        <div className="pv-tab" style={{ background: t.inactiveTab, borderColor: t.border }} />
      </div>
      <div className="pv-page">
        <div className="pv-label" style={{ color: t.muted }}>
          01 / PREVIEW
        </div>
        <div className="pv-h orbit-display">
          The web,
          <br />
          reorbited.
        </div>
        <div className="pv-p" style={{ color: t.textSecondary }}>
          Secondary text sits here.
        </div>
        <div className="pv-sel">
          <span style={{ background: t.selection }}>Selected text</span>{' '}
          <span style={{ color: t.accent }}>Accent link →</span>
        </div>
        <div className="pv-card" style={{ background: t.surface2, borderColor: t.border }}>
          Surface
        </div>
        <div className="pv-card" style={{ background: t.surface, borderColor: t.borderStrong }}>
          Secondary surface
        </div>
        <div
          className="pv-bar"
          style={{ background: t.orbitBar, borderColor: t.borderStrong, color: t.textSecondary }}
        >
          Search or enter address
        </div>
      </div>
    </div>
  )
}

export default function Themes() {
  const s = useOrbit()!
  const all = useMemo(() => [...PRESETS, ...s.customThemes], [s.customThemes])
  const [sel, setSel] = useState(s.settings.themeId)
  const original = all.find((t) => t.id === sel) ?? PRESETS[0]
  const [draft, setDraft] = useState<Theme>(original)
  const [msg, setMsg] = useState('')
  useEffect(() => setDraft(original), [original])
  const dirty = JSON.stringify(draft) !== JSON.stringify(original)
  const isCustom = s.customThemes.some((t) => t.id === original.id)
  const set = (k: keyof Theme, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const save = async (asNew: boolean) => {
    const name = asNew ? `${draft.name} COPY`.slice(0, 40) : draft.name
    const id = await act('saveTheme', {
      theme: { ...draft, name, id: asNew || !isCustom ? '' : draft.id },
    })
    if (id) {
      setSel(id)
      setMsg('Saved')
    } else setMsg('Could not save: check names and colours')
  }
  return (
    <Page index="05" label="THEME STUDIO" title="Theme Studio" wide>
      <div className="studio">
        <div className="studio-list" role="listbox" aria-label="Themes">
          <div className="orbit-label">PRESETS</div>
          {PRESETS.map((t) => (
            <button
              key={t.id}
              role="option"
              aria-selected={sel === t.id}
              data-on={sel === t.id}
              className="theme-item"
              onClick={() => setSel(t.id)}
            >
              <i style={{ background: t.background, borderColor: t.borderStrong }}>
                <b style={{ background: t.accent }} />
              </i>
              {t.name.replace('ORBIT / ', '')}
              {s.settings.themeId === t.id && <span className="orbit-label">ACTIVE</span>}
            </button>
          ))}
          <div className="orbit-label" style={{ marginTop: 16 }}>
            CUSTOM
          </div>
          {s.customThemes.length === 0 && (
            <div className="srow-hint">Edit any preset and save to create one.</div>
          )}
          {s.customThemes.map((t) => (
            <button
              key={t.id}
              role="option"
              aria-selected={sel === t.id}
              data-on={sel === t.id}
              className="theme-item"
              onClick={() => setSel(t.id)}
            >
              <i style={{ background: t.background, borderColor: t.borderStrong }}>
                <b style={{ background: t.accent }} />
              </i>
              {t.name}
              {s.settings.themeId === t.id && <span className="orbit-label">ACTIVE</span>}
            </button>
          ))}
          <div className="toolbar" style={{ marginTop: 16 }}>
            <button className="btn ghost" onClick={async () => setMsg(await act('importTheme'))}>
              Import JSON
            </button>
          </div>
        </div>

        <div className="studio-edit">
          <label className="field-row">
            <span>Name</span>
            <input
              className="field grow"
              maxLength={40}
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              aria-label="Theme name"
            />
          </label>
          <label className="field-row">
            <span>Mode</span>
            <select
              className="field"
              style={{ justifySelf: 'start' }}
              value={draft.mode}
              onChange={(e) => set('mode', e.target.value)}
              aria-label="Theme mode"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          {FIELDS.map(([k, label]) => (
            <ColorField
              key={k}
              label={label}
              value={draft[k] as string}
              onChange={(v) => set(k, v)}
            />
          ))}
          <div className="toolbar">
            <button
              className="btn"
              onClick={() => act('setTheme', { id: original.id }).then(() => setMsg('Applied'))}
              disabled={dirty || s.settings.themeId === original.id}
            >
              Apply
            </button>
            <button className="btn ghost" onClick={() => save(false)} disabled={!dirty && isCustom}>
              {isCustom ? 'Save' : 'Save as custom'}
            </button>
            <button className="btn ghost" onClick={() => save(true)}>
              Duplicate
            </button>
            <button className="btn ghost" onClick={() => setDraft(original)} disabled={!dirty}>
              Reset
            </button>
            <button className="btn ghost" onClick={() => act('exportTheme', { id: original.id })}>
              Export
            </button>
            {isCustom && (
              <button
                className="btn ghost"
                onClick={() =>
                  confirm(`Delete “${original.name}”?`) &&
                  act('deleteTheme', { id: original.id }).then(() => setSel('zero'))
                }
              >
                Delete
              </button>
            )}
            {msg && (
              <span className="orbit-label" role="status">
                {msg}
              </span>
            )}
          </div>
        </div>

        <div className="studio-preview">
          <div className="orbit-label">LIVE PREVIEW</div>
          <Preview t={draft} />
        </div>
      </div>
    </Page>
  )
}
