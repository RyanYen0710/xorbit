import type { Metadata } from 'next'
import { PageHead, Section, Shot } from '@/components/Shell'

export const metadata: Metadata = { title: 'Browser' }

const FEATURES: [string, string][] = [
  [
    'Orbit Rail',
    'A narrow side strip with Spaces, pins, downloads, history and settings. Opens into Mission Control.',
  ],
  [
    'Mission Control',
    'Vertical tabs grouped as Pinned, Today and Older. Favicon, loading state, audio indicator, mute, close, drag and drop.',
  ],
  [
    'Spaces',
    'Workspaces with their own tabs, pins and accent colour. Optional separate session per Space.',
  ],
  [
    'Orbit Bar',
    'A floating bottom bar for URLs, searches, open tabs, history, pins, commands and quick maths.',
  ],
  [
    'Bookmarks grid',
    'Your bookmarks as a grid on the new tab page, under the search box. Pin any of them to the side panel.',
  ],
  [
    'Google or Bing',
    'Choose Google or Bing (or DuckDuckGo, Brave, your own) as the search engine, right from the new tab page.',
  ],
  ['Orbit Command', 'Ctrl/⌘ + K. Fuzzy-search every command, Space and theme.'],
  ['Split View', 'Two pages side by side. Resize, swap, detach or close either side.'],
  ['Focus Mode', 'Hide everything except the page. Peek at the Rail from the edge.'],
  [
    'Private windows',
    'A graphite window whose history isn’t written to disk and whose cookies are discarded on close.',
  ],
  ['Downloads', 'Progress, pause and resume, cancel, retry, open and show in folder.'],
  [
    'History & Pins',
    'Searchable history grouped by day. Pins are bookmarks, per Space, with folders and JSON import/export.',
  ],
  [
    'Session restore',
    'Tabs, Spaces, the active tab, window size and position come back when you reopen X Orbit.',
  ],
  [
    'Tab archiving',
    'Inactive tabs archive after 12 hours to 7 days (or never) and idle tabs release memory.',
  ],
]
const SHORTCUTS: [string, string][] = [
  ['New tab · close · reopen', 'Ctrl/⌘ T · W · Shift+T'],
  ['Orbit Bar', 'Ctrl/⌘ L'],
  ['Orbit Command', 'Ctrl/⌘ K'],
  ['Find in page', 'Ctrl/⌘ F'],
  ['Toggle sidebar', 'Ctrl/⌘ B'],
  ['Focus Mode', 'Ctrl/⌘ Shift F'],
  ['Split View', 'Ctrl/⌘ \\'],
  ['Pin page', 'Ctrl/⌘ D'],
]

export default function Features() {
  return (
    <>
      <PageHead
        n="01"
        label="BROWSER"
        title={
          <>
            BUILT FOR
            <br />
            THE PAGE.
          </>
        }
        lede="X Orbit keeps the toolbar thin so the website gets the screen. Everything else lives in the Rail and the Orbit Bar."
      />
      <div className="container" style={{ marginTop: 64 }}>
        <Shot name="mission-control" alt="X Orbit window" />
      </div>
      <Section
        n="02"
        label="FEATURES"
        title={
          <>
            WHAT’S
            <br />
            IN IT.
          </>
        }
      >
        <ul className="list">
          {FEATURES.map(([a, b]) => (
            <li key={a}>
              <b>{a}</b>
              <span style={{ maxWidth: '58ch', textAlign: 'right' }}>{b}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section
        n="03"
        label="PALETTE"
        title={
          <>
            FAST BY
            <br />
            KEYBOARD.
          </>
        }
      >
        <div className="cols">
          <div className="copy">
            <p>Familiar shortcuts work the way you expect.</p>
            <ul className="list">
              {SHORTCUTS.map(([a, b]) => (
                <li key={a}>
                  <b>{a}</b>
                  <span className="label">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="vis">
            <Shot name="palette" alt="Orbit Command palette" />
          </div>
        </div>
      </Section>
      <Section
        n="04"
        label="NOT YET"
        title={
          <>
            HONEST
            <br />
            LIMITS.
          </>
        }
      >
        <div className="prose">
          <p>
            This is a 0.1 beta. Not built yet: extensions, sync across devices, a password manager
            (when it arrives it will use the OS keychain), tracker and ad blocking, importing
            bookmarks from other browsers, and more than two pages in Split View. X Orbit is built
            on Electron and Chromium, so web compatibility is Chromium’s.
          </p>
        </div>
      </Section>
    </>
  )
}
