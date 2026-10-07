import { useEffect, useState } from 'react'
import { Logo } from '@orbit/ui'
import { PRESETS } from '@orbit/themes'
import { act, useOrbit } from '../state'

const LOOKS = PRESETS.slice(0, 4)

export default function Welcome() {
  const s = useOrbit()!
  const [step, setStep] = useState(0)
  useEffect(() => {
    document.title = 'Welcome'
  }, [])
  const next = () => setStep((n) => n + 1)
  return (
    <main className="welcome">
      <div className="orbit-label wl-step">0{step + 1} / 05</div>
      {step === 0 && (
        <section>
          <Logo size={56} />
          <div className="orbit-label">X ORBIT</div>
          <h1 className="orbit-display">
            WELCOME
            <br />
            TO ORBIT.
          </h1>
          <button className="btn" autoFocus onClick={next}>
            BEGIN
          </button>
        </section>
      )}
      {step === 1 && (
        <section>
          <h1 className="orbit-display">
            CHOOSE
            <br />
            YOUR LOOK
          </h1>
          <div className="looks">
            {LOOKS.map((t) => (
              <button
                key={t.id}
                className="look"
                data-on={s.settings.themeId === t.id}
                onClick={() => act('setTheme', { id: t.id })}
                style={{
                  background: t.background,
                  color: t.text,
                  borderColor: s.settings.themeId === t.id ? t.accent : t.border,
                }}
              >
                <i style={{ background: t.accent }} />
                {t.name.replace('ORBIT / ', '')}
              </button>
            ))}
          </div>
          <p className="dim">More themes, and a full editor, live in Theme Studio.</p>
          <button className="btn" onClick={next}>
            CONTINUE
          </button>
        </section>
      )}
      {step === 2 && (
        <section>
          <h1 className="orbit-display">SEARCH</h1>
          <p>Pick your default search engine. Both are free to use.</p>
          <div className="looks">
            {(['google', 'bing'] as const).map((id) => (
              <button
                key={id}
                className="look"
                data-on={s.settings.searchProvider === id}
                aria-pressed={s.settings.searchProvider === id}
                onClick={() => act('setSetting', { key: 'searchProvider', value: id })}
                style={{
                  borderColor:
                    s.settings.searchProvider === id
                      ? 'var(--orbit-accent)'
                      : 'var(--orbit-border)',
                }}
              >
                <i style={{ background: 'var(--orbit-accent)' }} />
                {id === 'google' ? 'Google' : 'Bing'}
              </button>
            ))}
          </div>
          <p className="dim">
            DuckDuckGo, Brave, Orbit Search or a custom engine are available any time in Settings →
            Search.
          </p>
          <button className="btn" onClick={next}>
            CONTINUE
          </button>
        </section>
      )}
      {step === 3 && (
        <section>
          <h1 className="orbit-display">IMPORT</h1>
          <p>
            Importing bookmarks from Chrome, Edge and Brave isn’t available in this version yet.
          </p>
          <p className="dim">You can export and import Pins as JSON from the Pins page.</p>
          <button className="btn" onClick={next}>
            SKIP FOR NOW
          </button>
        </section>
      )}
      {step === 4 && (
        <section>
          <h1 className="orbit-display">
            READY FOR
            <br />
            LAUNCH
          </h1>
          <button className="btn" autoFocus onClick={() => act('finishOnboarding')}>
            OPEN X ORBIT
          </button>
        </section>
      )}
    </main>
  )
}
