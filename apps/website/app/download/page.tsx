import type { Metadata } from 'next'
import { DownloadCards } from '@/components/DownloadCards'
import { PageHead } from '@/components/Shell'
import { CHANNEL, CHROME_STORE_URL, REPO, VERSION, fmtSize, getRelease, pick } from '@/lib/site'

export const metadata: Metadata = { title: 'Download' }
export const revalidate = 1800

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
        lede="Free desktop browser for macOS and Windows."
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
          <ol className="prose" style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>Unzip the file. You get a folder (keep it somewhere permanent).</li>
            <li>
              In Chrome, open <code>chrome://extensions</code>.
            </li>
            <li>
              Turn on <strong>Developer mode</strong> (top right).
            </li>
            <li>
              Click <strong>Load unpacked</strong> and pick the unzipped folder.
            </li>
            <li>
              Pin it from the puzzle-piece menu, then press <strong>Alt+S</strong> for Mission
              Control or <strong>Alt+O</strong> for the Orbit Bar.
            </li>
          </ol>
          <p className="muted small">
            Chrome may remind you at startup that a developer-mode extension is installed;
            that&rsquo;s normal for extensions installed outside the Chrome Web Store. To update,
            download the new zip and click the reload icon on the extension. The extension
            can&rsquo;t replace Chrome&rsquo;s own toolbar or tab strip; Spaces use Chrome tab
            groups.
          </p>
        </section>
        {!rel && (
          <p className="muted small" role="status">
            {REPO
              ? 'No release could be fetched from GitHub right now.'
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
              <td>Windows 10 or later · 64-bit</td>
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
