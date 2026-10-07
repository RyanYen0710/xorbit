import { CopyText } from './CopyText'

const Img = ({ name, alt, w, h }: { name: string; alt: string; w: number; h: number }) => (
  <img
    className="shot guide-img"
    src={`/guide/${name}.png`}
    alt={alt}
    width={w}
    height={h}
    loading="lazy"
    decoding="async"
  />
)

export function ExtensionGuide() {
  return (
    <section id="extension-guide" className="guide" aria-labelledby="guide-h">
      <div className="label">CHROME EXTENSION · INSTALL GUIDE · ABOUT 1 MINUTE</div>
      <h3 className="display" id="guide-h">
        HOW TO INSTALL
      </h3>
      <p className="guide-tldr">
        <strong>In short:</strong> download → unzip → open <code>chrome://extensions</code> → turn
        on Developer mode → Load unpacked → pick the folder.
      </p>

      <ol className="guide-steps">
        <li>
          <div>
            <h4>Download and unzip</h4>
            <p>
              Click <strong>Download extension</strong> above; <code>x-orbit-extension.zip</code>{' '}
              lands in your Downloads folder.
            </p>
            <p>
              <strong>Mac:</strong> double-click the zip. &nbsp; <strong>Windows:</strong>{' '}
              right-click → Extract All.
            </p>
            <p className="note">
              Move the new folder somewhere permanent, like Documents. Chrome runs the extension
              from it, so don&rsquo;t delete it.
            </p>
          </div>
        </li>
        <li>
          <div>
            <h4>Open the extensions page</h4>
            <p>
              Web pages can&rsquo;t open it for you. Copy this, open a new tab, paste it in the
              address bar, press Enter:
            </p>
            <CopyText text="chrome://extensions" label="Copy" />
            <p className="note">
              Or: ⋮ menu → Extensions → Manage Extensions. Edge and Brave: use{' '}
              <code>edge://extensions</code> or <code>brave://extensions</code>.
            </p>
          </div>
        </li>
        <li>
          <div>
            <h4>Turn on Developer mode</h4>
            <p>The switch is at the top right of that page.</p>
          </div>
          <Img
            w={1120}
            h={260}
            name="step-developer-mode"
            alt="Chrome's Extensions page with the Developer mode switch at the top right highlighted"
          />
        </li>
        <li>
          <div>
            <h4>Click Load unpacked</h4>
            <p>
              Choose the unzipped <code>x-orbit-extension</code> folder (the one holding{' '}
              <code>manifest.json</code>), then <strong>Select</strong> (Windows:{' '}
              <strong>Select Folder</strong>).
            </p>
          </div>
          <Img
            w={1280}
            h={300}
            name="step-load-unpacked"
            alt="Chrome's Extensions page with the Load unpacked button highlighted"
          />
        </li>
        <li>
          <div>
            <h4>Pin it and go</h4>
            <p>
              An <strong>X Orbit</strong> card appears, switched on. Click the puzzle-piece icon in
              the toolbar and pin it. Open a new tab to see your Orbit page.
            </p>
            <ul className="guide-keys">
              <li>
                <kbd>Alt</kbd> <kbd>S</kbd> Mission Control
              </li>
              <li>
                <kbd>Alt</kbd> <kbd>O</kbd> Orbit Bar, on any page
              </li>
              <li>
                <kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>←</kbd>
                <kbd>→</kbd> switch Spaces
              </li>
            </ul>
            <p className="note">On a Mac, Alt is the Option (⌥) key.</p>
          </div>
          <Img
            w={1120}
            h={520}
            name="step-installed"
            alt="Chrome's Extensions page showing the X Orbit extension installed and switched on"
          />
        </li>
      </ol>

      <div className="faq" aria-label="Troubleshooting">
        <div className="label">TROUBLESHOOTING</div>
        <details>
          <summary>“Manifest file is missing or unreadable”</summary>
          <p>
            You picked the wrong folder or the zip itself. Choose the folder that directly contains{' '}
            <code>manifest.json</code> (if it holds only another folder, open that one).
          </p>
        </details>
        <details>
          <summary>It switched off or disappeared</summary>
          <p>
            The folder was moved or deleted. Put it back, or repeat steps 2 and 4 with its new
            location.
          </p>
        </details>
        <details>
          <summary>Chrome says “Disable developer mode extensions” at startup</summary>
          <p>
            Normal for extensions installed this way. Close it (or choose Cancel) and X Orbit stays
            on.
          </p>
        </details>
        <details>
          <summary>The shortcuts don&rsquo;t work</summary>
          <p>
            Another app may use the same keys. Set your own at{' '}
            <code>chrome://extensions/shortcuts</code>.
          </p>
        </details>
        <details>
          <summary>Update or remove it</summary>
          <p>
            <strong>Update:</strong> unzip the new zip over the old folder, then click ↻ on the X
            Orbit card. <strong>Remove:</strong> click Remove on that card, then delete the folder.
          </p>
        </details>
      </div>
    </section>
  )
}
