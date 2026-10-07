import type { Metadata } from 'next'
import { PageHead } from '@/components/Shell'

export const metadata: Metadata = { title: 'Changelog' }

const ENTRIES = [
  {
    v: '0.1.0',
    channel: 'Beta',
    items: [
      'First public build: Orbit Rail, Mission Control, Spaces, Orbit Bar and Orbit Command.',
      'Tabs with drag and drop, mute, duplicate, pin, move to Space, reopen closed tab, archiving and memory release.',
      'Split View (two pages), Focus Mode, find in page, private windows.',
      'Google default search with DuckDuckGo, Bing, Brave, Orbit Search and custom providers.',
      'Orbit Search page with Google Programmable Search and Brave Search API backends.',
      'Theme Studio with six presets, custom themes and JSON import/export.',
      'History, downloads manager, pins, session restore, site permissions, cookie and JavaScript controls.',
      'Mac installer (.dmg, Apple Silicon): download, drag to Applications, eject. Windows installer is coming soon. Chrome extension available as a free download.',
    ],
  },
]

export default function Changelog() {
  return (
    <>
      <PageHead n="08" label="CHANGELOG" title="CHANGELOG" />
      <div className="container" style={{ marginTop: 48 }}>
        {ENTRIES.map((e) => (
          <article className="entry" key={e.v}>
            <div>
              <div className="display" style={{ fontSize: 40 }}>
                {e.v}
              </div>
              <div className="label">{e.channel.toUpperCase()}</div>
            </div>
            <ul>
              {e.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </>
  )
}
