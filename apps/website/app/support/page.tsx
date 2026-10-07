import type { Metadata } from 'next'
import { PageHead } from '@/components/Shell'
import { REPO, SUPPORT_URL } from '@/lib/site'

export const metadata: Metadata = { title: 'Support' }

const CATEGORIES: [string, string][] = [
  ['Bug or crash', 'Something broke, froze or closed by itself.'],
  ['Performance', 'Slow, high memory or battery use, laggy tabs.'],
  ['Site compatibility', 'A website looks wrong or doesn’t work in X Orbit.'],
  ['Passwords & autofill', 'Saving, filling or managing logins and cards.'],
  ['Downloads & installer', 'The .dmg, the zip, updates, “can’t be opened” warnings.'],
  ['Chrome extension', 'Install problems, the side panel, the Orbit Bar, shortcuts.'],
  ['Privacy question', 'What is stored, what is sent, how to clear it.'],
  ['Feature request', 'Something you’d like X Orbit to do.'],
]

export default function Support() {
  return (
    <>
      <PageHead
        n="09"
        label="SUPPORT"
        title="SUPPORT"
        lede="Quick answers, and a ticket form for everything else."
      />
      <div className="container prose" style={{ marginTop: 48 }}>
        <h3 id="ticket">Create a ticket</h3>
        <p>
          Stuck, or found a bug? Open a ticket in the Support Center. It takes about two minutes,
          and we reply by email.
        </p>
        <p>
          <a className="btn" href={SUPPORT_URL} rel="noopener">
            Create a ticket →
          </a>
        </p>

        <h3>What a good ticket includes</h3>
        <ul>
          <li>
            <strong>A clear title</strong>, e.g. “Downloads panel stays empty after a PDF download”.
          </li>
          <li>
            <strong>Version and system:</strong> the X Orbit version (Settings → About X Orbit, or{' '}
            <code>chrome://extensions</code> for the extension) and your macOS or Windows version.
          </li>
          <li>
            <strong>Steps to reproduce</strong>, numbered, starting from a fresh tab.
          </li>
          <li>
            <strong>What you expected</strong> and <strong>what happened instead</strong>.
          </li>
          <li>
            <strong>How often:</strong> every time, sometimes, or once. Does it happen in a Private
            window, or in another browser?
          </li>
          <li>
            <strong>The page address</strong> if it only happens on one website.
          </li>
        </ul>
        <p>
          <strong>Never include passwords, card numbers or recovery codes.</strong> We will never
          ask for them. Security vulnerabilities should go through the private channel in{' '}
          <a href={REPO ? `https://github.com/${REPO}/security/policy` : '/privacy'}>
            our security policy
          </a>
          , not a ticket.
        </p>

        <h3>What the form covers</h3>
        <table className="table">
          <tbody>
            {CATEGORIES.map(([a, b]) => (
              <tr key={a}>
                <td>{a}</td>
                <td>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          X Orbit is a small beta, so there is no guaranteed response time yet. Replies come from
          the support inbox.
        </p>

        <h3>Reporting a problem publicly</h3>
        <p>
          {REPO ? (
            <>
              Prefer the open tracker? Use{' '}
              <a href={`https://github.com/${REPO}/issues`}>github.com/{REPO}/issues</a> with your
              OS, the X Orbit version and what you did.
            </>
          ) : (
            'A public issue tracker will be linked here when the project is published.'
          )}
        </p>

        <h3>Common questions</h3>
        <p>
          <strong>Where is my data?</strong> In X Orbit’s folder inside your user profile. See
          Privacy.
        </p>
        <p>
          <strong>My OS says the app is from an unidentified developer.</strong> Early builds may
          not be signed yet. Only install files from the official download page.
        </p>
        <p>
          <strong>Where is the address bar?</strong> Press Ctrl/⌘ + L, or click the pill at the
          bottom of the page.
        </p>
        <p>
          <strong>Can I make it look like Chrome again?</strong> No — but Compact mode, sidebar
          position and the Orbit Bar toggle are in Settings → Appearance.
        </p>
      </div>
    </>
  )
}
