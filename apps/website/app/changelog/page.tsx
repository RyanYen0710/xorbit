import type { Metadata } from 'next'
import { PageHead } from '@/components/Shell'

export const metadata: Metadata = { title: 'Changelog' }

const ENTRIES = [
  {
    v: '0.1.5',
    channel: 'Beta',
    items: [
      'Fixes X Orbit not opening after an update: macOS asked for Keychain permission and the app waited behind that prompt. X Orbit is now signed with one fixed certificate, so macOS keeps trusting it across updates. After installing 0.1.5 you may see the prompt one last time: enter your Mac password and choose Always Allow.',
      'The app no longer touches the Keychain at startup, and an update must be signed by the same certificate as the installed app.',
    ],
  },
  {
    v: '0.1.4',
    channel: 'Beta',
    items: [
      'X Orbit account in the app (Settings → Account): create an account with email and password, or continue with Google through your normal browser, and link Google to an email account. Same security as the website: strong passwords, email confirmation, server-side checks.',
      'When Google refuses sign-in inside X Orbit, a dialog offers to open the page in Chrome or use your X Orbit account.',
      'Stricter security policy for X Orbit’s own pages, and a nonce-based policy on the website.',
    ],
  },
  {
    v: '0.1.3',
    channel: 'Beta',
    items: [
      'Automatic updates: when you open X Orbit it checks for a new version and installs it by itself, with a progress bar showing the speed and size. Turn it off in Settings.',
      'Focus mode has an always-visible Exit focus button, and the sidebar and top bar now slide smoothly.',
      'Bookmark import finds Chrome bookmarks saved with a Google account and in every profile.',
    ],
  },
  {
    v: '0.1.2',
    channel: 'Beta',
    items: [
      'X Orbit now uses its own dialogs and menus instead of system ones: confirmations, camera / microphone / location prompts, save-password and save-card prompts, and right-click menus.',
      'Reviews on the website: rate X Orbit with stars and a short note.',
    ],
  },
  {
    v: '0.1.1',
    channel: 'Beta',
    items: [
      'Fixes the Mac installer: the app is now properly signed, so macOS no longer says it is "damaged" and offers to move it to the Trash. Instead you confirm once with Open Anyway.',
      'No more flashing when switching between Settings, History, Downloads and Pins.',
      'Simpler install steps on the Download page.',
    ],
  },
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
