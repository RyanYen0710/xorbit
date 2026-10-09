import type { Metadata } from 'next'
import { PageHead } from '@/components/Shell'

export const metadata: Metadata = { title: 'Privacy' }

const ROWS: [string, string, boolean][] = [
  [
    'Block third-party cookies',
    'Strips cookies on requests to, and responses from, sites other than the one you’re on. Doesn’t cover cookies written by scripts inside embedded frames.',
    true,
  ],
  [
    'JavaScript switch',
    'Blocks scripts on web pages with a content-security header. X Orbit’s own pages are unaffected.',
    true,
  ],
  [
    'Camera, microphone, location, notifications',
    'Ask, allow or block — as a default and per site, from the lock button in the top strip.',
    true,
  ],
  ['Clear browsing data', 'History, cache, cookies and site data, from Settings → Privacy.', true],
  [
    'Separate sessions per Space',
    'Cookies and logins isolated between Spaces that have it enabled.',
    true,
  ],
  [
    'Private windows',
    'No history is written; cookies and cache live in memory and are cleared when the window closes.',
    true,
  ],
  ['Popups and autoplay', 'Popups can be blocked; media autoplay needs a click by default.', true],
  ['Tracker and ad blocking', 'Not implemented yet.', false],
  [
    'Saved logins and cards',
    'Stored in one encrypted file, locked with the operating system’s secure storage (Keychain on Mac). Card security codes are never saved. Revealing or filling asks for Touch ID where available. There is no master password yet.',
    true,
  ],
  [
    'X Orbit account',
    'Optional. Sign in with email or Google in Settings → Account. It only identifies you; your browsing data stays on your computer.',
    true,
  ],
  [
    'Sync across devices',
    'Not implemented. Nothing leaves your computer except the pages you load, update checks and the optional account sign-in.',
    false,
  ],
]

export default function Privacy() {
  return (
    <>
      <PageHead
        n="05"
        label="PRIVACY"
        title={
          <>
            YOUR BROWSER.
            <br />
            YOUR DATA.
          </>
        }
        lede="Plain statements about what X Orbit does and doesn’t do in this version."
      />
      <div className="container">
        <table className="table">
          <thead>
            <tr>
              <th>Control</th>
              <th>What it actually does</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([a, b, yes]) => (
              <tr key={a}>
                <td>
                  {a}
                  {!yes && <span className="label"> · NOT YET</span>}
                </td>
                <td className={yes ? '' : 'no'}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="prose">
          <h3>What is stored, and where</h3>
          <p>
            History, open tabs, Spaces, bookmarks, pins, settings and download records are stored as
            files in your user profile folder on your own computer. They are not encrypted by X
            Orbit; anyone with access to your account can read them.
          </p>
          <h3>What leaves your computer</h3>
          <p>
            The sites you visit and the search provider you choose see your requests, like in any
            browser. Installed builds check GitHub Releases for updates. A bookmark’s icon is
            fetched straight from that site (never through a third-party icon service), and the X
            Orbit account, if you use one, talks to Google’s sign-in and database services. This
            version contains no analytics or telemetry code.
          </p>
          <h3>Private windows</h3>
          <p>
            Private windows keep the session’s history and cookies out of your normal browser data.
            They don’t hide your activity from websites, your network, your employer or your
            internet provider, and they aren’t an anonymity tool.
          </p>
        </div>
      </div>
    </>
  )
}
