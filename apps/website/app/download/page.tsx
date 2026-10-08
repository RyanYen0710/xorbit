import type { Metadata } from 'next'
import { DownloadCards } from '@/components/DownloadCards'
import { ExtensionGuide } from '@/components/ExtensionGuide'
import { PageHead } from '@/components/Shell'
import { CHANNEL, CHROME_STORE_URL, REPO, VERSION, fmtSize, getRelease, pick } from '@/lib/site'

export const metadata: Metadata = { title: 'Download' }
export const revalidate = 300

export default async function Download() {
  const rel = await getRelease()
  const mac = pick(rel, /arm64\.dmg$/i)
  const macIntel = pick(rel, /x64\.dmg$/i)
  const win = pick(rel, /setup.*\.exe$/i)
  const linux = rel?.assets.filter((a) => /\.(AppImage|deb)$/i.test(a.name)) ?? []
  const date = rel ? new Date(rel.date).toLocaleDateString('en-CA') : '—'
  return (
    <>
      <PageHead
        n="06"
        label="DOWNLOAD"
        title={
          <>
            DOWNLOAD
            <br />X ORBIT
          </>
        }
        lede="Free desktop browser. The Mac version is ready; Windows is an early test build."
      />
      <div className="container">
        <DownloadCards
          mac={mac}
          macIntel={macIntel}
          win={win}
          linux={linux}
          hasRepo={Boolean(REPO)}
        />
        <section
          id="mac-install"
          className="prose"
          aria-labelledby="mac-h"
          style={{ marginTop: 32 }}
        >
          <div className="label">MAC · HOW TO INSTALL</div>
          <h3 id="mac-h">Installing on a Mac</h3>
          <ol style={{ paddingLeft: 20 }}>
            <li>
              Click <strong>Download</strong>, then open the <code>.dmg</code> from your Downloads
              folder.
            </li>
            <li>
              <strong>Drag X Orbit onto Applications</strong>, then eject the disk (the{' '}
              <strong>⏏</strong> next to &ldquo;X Orbit&rdquo; in Finder).
            </li>
            <li>
              Open X Orbit from Applications. The first time, macOS says it can&rsquo;t verify the
              developer. Click <strong>Done</strong> (not &ldquo;Move to Trash&rdquo;).
            </li>
            <li>
              Open <strong>System Settings → Privacy &amp; Security</strong>, scroll down to the X
              Orbit message and click <strong>Open Anyway</strong>, then <strong>Open</strong>. You
              only do this once.
            </li>
          </ol>
          <p className="muted small">
            Why the extra step? X Orbit is free and not yet signed with a paid Apple Developer ID,
            so macOS asks you to confirm it. Only do this for the file from this page. If you see
            &ldquo;X Orbit is damaged&rdquo;, you have the old 0.1.0 file &mdash; download it again.
          </p>
        </section>
        <section
          id="windows-install"
          className="prose"
          aria-labelledby="win-h"
          style={{ marginTop: 32 }}
        >
          <div className="label">WINDOWS · EARLY TEST BUILD</div>
          <h3 id="win-h">Installing on Windows</h3>
          <ol style={{ paddingLeft: 20 }}>
            <li>
              Click <strong>Download</strong> on the Windows card above and open the{' '}
              <code>.exe</code> file.
            </li>
            <li>
              Windows may say <strong>&ldquo;Windows protected your PC&rdquo;</strong>. Click{' '}
              <strong>More info</strong>, then <strong>Run anyway</strong>.
            </li>
            <li>Follow the installer, then open X Orbit from the Start menu.</li>
          </ol>
          <p className="muted small">
            This is the first Windows build and it hasn&rsquo;t been checked on many computers yet.
            If something doesn&rsquo;t work, please tell us on the{' '}
            <a href="/support">Support page</a> with what you saw. The warning appears because the
            free build isn&rsquo;t signed with a paid Windows certificate yet. Only install the file
            from this page.
          </p>
        </section>
        <section
          id="chrome"
          className="dl-card"
          style={{ marginTop: 40, padding: '40px 0' }}
          aria-labelledby="ext-h"
        >
          <div className="label">CHROME · FREE · ANY DESKTOP OS</div>
          <h3 className="display" id="ext-h" style={{ fontSize: 'clamp(26px,3.5vw,44px)' }}>
            X ORBIT FOR CHROME
          </h3>
          <p className="muted">
            Don&rsquo;t want a new browser? Get Spaces, the Mission Control side panel, the Orbit
            Bar (Alt+O) and the Orbit new tab inside the Chrome you already use.
          </p>
          <a className="btn" href="/downloads/x-orbit-extension.zip" download>
            DOWNLOAD EXTENSION · .ZIP
          </a>
          {CHROME_STORE_URL && (
            <a className="btn ghost" href={CHROME_STORE_URL}>
              ADD FROM CHROME WEB STORE
            </a>
          )}
          <a className="arrow-link" href="#extension-guide">
            Step-by-step install guide ↓
          </a>
          <p className="muted small">
            The extension can&rsquo;t replace Chrome&rsquo;s own toolbar or tab strip; Spaces use
            Chrome tab groups.
          </p>
          <p className="muted small">
            <strong>School, work or supervised (Family Link) Chrome?</strong> Those accounts block
            Developer mode, so the extension can&rsquo;t be installed there. Use the Mac app instead
            &mdash; it needs no Chrome settings.
          </p>
        </section>
        <ExtensionGuide />
        {!rel && (
          <p className="muted small" role="status">
            {REPO
              ? 'The Mac installer is coming to GitHub Releases soon. The Chrome extension below works today.'
              : 'Installers are published through GitHub Releases. Set NEXT_PUBLIC_GITHUB_REPO and publish a release (see docs/distribution.md) and these buttons point at the real files.'}
          </p>
        )}
        <dl className="meta-grid">
          <div>
            <dt>Version</dt>
            <dd>{rel?.version ?? VERSION}</dd>
          </div>
          <div>
            <dt>Channel</dt>
            <dd>{CHANNEL}</dd>
          </div>
          <div>
            <dt>Released</dt>
            <dd>{date}</dd>
          </div>
          <div>
            <dt>File size</dt>
            <dd>{mac ? fmtSize(mac.size) : win ? fmtSize(win.size) : '—'}</dd>
          </div>
        </dl>
        <h2 className="display" style={{ fontSize: 40, marginTop: 80 }}>
          System requirements
        </h2>
        <table className="table">
          <tbody>
            <tr>
              <td>macOS</td>
              <td>macOS 12 or later · Apple Silicon (Intel build available per release)</td>
            </tr>
            <tr>
              <td>Windows</td>
              <td>Windows 10 or 11, 64-bit (early test build)</td>
            </tr>
            <tr>
              <td>Memory</td>
              <td>4 GB RAM minimum, 8 GB recommended</td>
            </tr>
          </tbody>
        </table>
        <h2 className="display" style={{ fontSize: 40, marginTop: 80 }}>
          Release notes
        </h2>
        <div className="prose">
          {rel?.notes ? (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--orbit-font-mono)',
                fontSize: 13,
                color: 'var(--orbit-text-2)',
              }}
            >
              {rel.notes}
            </pre>
          ) : (
            <p>
              See the <a href="/changelog">changelog</a>.
            </p>
          )}
        </div>
        <p className="muted small" style={{ marginTop: 40 }}>
          Early builds may not be code-signed yet. If your OS warns about an unidentified developer,
          that is why; only install files from this page or the project’s GitHub Releases.
        </p>
      </div>
    </>
  )
}
