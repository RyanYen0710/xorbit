import { PRESETS } from '@orbit/themes'

const NAMES: Record<string, string> = {
  zero: 'ZERO',
  lunar: 'LUNAR',
  mars: 'MARS',
  earth: 'EARTH',
  terminal: 'TERMINAL',
  titanium: 'TITANIUM',
}

export function ThemeGrid() {
  return (
    <div className="theme-grid" role="list">
      {PRESETS.map((t, i) => (
        <div
          role="listitem"
          className="theme-chip"
          key={t.id}
          style={{ background: t.background, color: t.text, borderColor: t.borderStrong }}
        >
          <i style={{ background: t.accent }} />
          <span>
            {String(i + 1).padStart(2, '0')} / {NAMES[t.id]}
            <br />
            <small style={{ color: t.textSecondary }}>{t.mode.toUpperCase()}</small>
          </span>
        </div>
      ))}
    </div>
  )
}
