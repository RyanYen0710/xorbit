import type { Metadata } from 'next'
import { PageHead } from '@/components/Shell'
import { REPO } from '@/lib/site'

export const metadata: Metadata = { title: 'Support' }

export default function Support() {
  return (
    <>
      <PageHead
        n="09"
        label="SUPPORT"
        title="SUPPORT"
        lede="Quick answers, and where to report problems."
      />
      <div className="container prose" style={{ marginTop: 48 }}>
        <h3>Reporting a problem</h3>
        <p>
          {REPO ? (
            <>
              Open an issue at{' '}
              <a href={`https://github.com/${REPO}/issues`}>github.com/{REPO}/issues</a> with your
              OS, the X Orbit version (Settings → About) and what you did.
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
