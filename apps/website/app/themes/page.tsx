import type { Metadata } from 'next'
import { PageHead, Section, Shot } from '@/components/Shell'
import { ThemeGrid } from '@/components/ThemeGrid'

export const metadata: Metadata = { title: 'Themes' }

export default function Themes() {
  return (
    <>
      <PageHead
        n="03"
        label="THEMES"
        title={
          <>
            MAKE IT
            <br />
            YOURS.
          </>
        }
        lede="Black, white, graphite and silver by default. Restrained colour when you want it."
      />
      <div className="container">
        <ThemeGrid />
      </div>
      <Section
        n="01"
        label="THEME STUDIO"
        title={
          <>
            EDIT
            <br />
            EVERYTHING.
          </>
        }
      >
        <div className="cols">
          <div className="copy">
            <p>
              Background, surfaces, text, border, accent, active and inactive tabs, sidebar, Orbit
              Bar and selection colour — with a live preview as you edit.
            </p>
            <p>
              Save as custom, duplicate, rename, reset, delete, and{' '}
              <strong>export and import as JSON</strong>. A theme file can be as short as four
              colours; the rest is derived.
            </p>
            <pre
              className="shot"
              style={{
                padding: 20,
                fontFamily: 'var(--orbit-font-mono)',
                fontSize: 13,
                color: 'var(--orbit-text-2)',
                overflow: 'auto',
              }}
            >{`{
  "name": "Mars",
  "background": "#050505",
  "surface": "#111111",
  "text": "#F5F5F5",
  "accent": "#C65332"
}`}</pre>
          </div>
          <div className="vis">
            <Shot name="theme-studio" alt="Theme Studio" />
          </div>
        </div>
      </Section>
      <Section
        n="02"
        label="LIGHT"
        title={
          <>
            DARK, LIGHT,
            <br />
            OR SYSTEM.
          </>
        }
      >
        <div className="cols">
          <div className="vis" style={{ gridColumn: 'span 12' }}>
            <Shot name="newtab-lunar" alt="Lunar light theme" />
          </div>
        </div>
      </Section>
    </>
  )
}
