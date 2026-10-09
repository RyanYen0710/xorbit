import Link from 'next/link'
import { ArrowLink, Section, Shot } from '@/components/Shell'
import { Reviews } from '@/components/Reviews'
import { ThemeGrid } from '@/components/ThemeGrid'
import { CHANNEL, VERSION } from '@/lib/site'

const APP_JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'X Orbit',
  alternateName: ['Xorbit', 'X Orbit Browser'],
  applicationCategory: 'BrowserApplication',
  operatingSystem: 'macOS, Windows',
  description: 'A desktop web browser built around Spaces, vertical tabs and a bottom Orbit Bar.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
}).replace(/</g, '\\u003c')

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: APP_JSON_LD }} />
      <section className="hero">
        <div className="container">
          <div className="label">X ORBIT · DESKTOP BROWSER</div>
          <h1 className="display">
            THE WEB,
            <br />
            REORBITED.
          </h1>
          <p className="lede">A browser designed around your space, not your tabs.</p>
          <div className="cta">
            <Link className="btn" href="/download">
              Download X Orbit
            </Link>
            <Link className="btn ghost" href="/features">
              Explore features
            </Link>
          </div>
          <div className="label spec">
            <span>X ORBIT</span>
            <span>BUILD {VERSION}</span>
            <span>CHANNEL / {CHANNEL}</span>
            <span>MACOS · WINDOWS</span>
          </div>
          <div className="hero-shot">
            <Shot
              name="mission-control"
              alt="X Orbit with the Mission Control sidebar open beside a web page and the Orbit Bar at the bottom"
            />
          </div>
        </div>
      </section>

      <Section
        n="★"
        label="REVIEWS"
        id="reviews"
        title={
          <>
            WHAT PEOPLE
            <br />
            SAY.
          </>
        }
      >
        <Reviews />
      </Section>

      <Section
        n="01"
        label="BROWSER"
        title={
          <>
            BROWSE
            <br />
            DIFFERENTLY.
          </>
        }
      >
        <div className="cols">
          <div className="copy">
            <p>
              <strong>The Orbit Rail</strong> is a narrow strip down the side: your Spaces,
              downloads, history and settings. Click the logo and it opens into{' '}
              <strong>Mission Control</strong>, with tabs stacked vertically under Today and Older.
              Your bookmarks get their own sidebar on the other side, with folders and each site’s
              icon.
            </p>
            <p>
              Drag tabs to reorder them or drop them on a Space. Tabs you haven’t touched in a while
              archive themselves and give their memory back.
            </p>
            <ArrowLink href="/features">All browser features</ArrowLink>
          </div>
          <div className="vis">
            <Shot name="mission-control" alt="Mission Control tab list" />
          </div>
        </div>
      </Section>

      <Section
        n="02"
        label="SPACES"
        title={
          <>
            YOUR WEB
            <br />
            HAS SPACES.
          </>
        }
      >
        <div className="spaces-row" aria-label="Example Spaces">
          <span>PERSONAL</span>
          <span>SCHOOL</span>
          <span>WORK</span>
          <span>DEVELOPMENT</span>
        </div>
        <div className="cols">
          <div className="copy">
            <p>
              A Space is a workspace with its own tabs and its own accent colour. Switch with the
              Rail or <strong>Ctrl/⌘ + Alt + ←/→</strong>.
            </p>
            <p>
              Turn on <strong>separate session</strong> for a Space and its cookies and logins stay
              isolated from every other Space — two accounts on one site, side by side.
            </p>
          </div>
        </div>
      </Section>

      <Section
        n="03"
        label="ORBIT BAR"
        title={
          <>
            THE ADDRESS BAR,
            <br />
            WITHOUT THE BAR.
          </>
        }
      >
        <div className="cols">
          <div className="copy">
            <p>
              No permanent toolbar eating your screen. The Orbit Bar floats at the bottom of the
              page as a small pill. Press <strong>Ctrl/⌘ + L</strong> and it opens into part address
              bar, part command palette.
            </p>
            <div className="barline" aria-label="Orbit Bar examples">
              <span>github.com</span>
              <span>best laptops 2026</span>
              <span>@tabs youtube</span>
              <span>@history orbit</span>
              <span>/settings</span>
              <span>/newspace School</span>
            </div>
          </div>
          <div className="vis">
            <Shot name="orbit-bar" alt="The expanded Orbit Bar over a web page" />
          </div>
        </div>
      </Section>

      <Section
        n="04"
        label="SEARCH"
        title={
          <>
            SEARCH
            <br />
            FROM ORBIT.
          </>
        }
      >
        <div className="cols">
          <div className="copy">
            <p>
              <strong>Google is the default provider</strong> for anything you type that isn’t an
              address. Switch to DuckDuckGo, Bing, Brave, Orbit Search or your own URL in Settings.
            </p>
            <p>
              <strong>Orbit Search</strong> is X Orbit’s own search page. It shows results from an
              official search API when you configure one and otherwise hands your query to Google.
              It does not have an independent index of the web — that’s a long-term experiment, not
              something we claim today.
            </p>
            <ArrowLink href="/search">How Orbit Search works</ArrowLink>
          </div>
          <div className="vis">
            <Shot name="newtab" alt="The X Orbit new tab page with a single search field" />
          </div>
        </div>
      </Section>

      <Section
        n="05"
        label="THEMES"
        title={
          <>
            MAKE IT
            <br />
            YOURS.
          </>
        }
      >
        <ThemeGrid />
        <div className="cols">
          <div className="copy">
            <p>
              Six presets, and <strong>Theme Studio</strong> for the rest: edit every surface and
              text colour with live preview, then save, duplicate, rename, export and import themes
              as plain JSON.
            </p>
            <ArrowLink href="/themes">Theme Studio</ArrowLink>
          </div>
          <div className="vis">
            <Shot name="theme-studio" alt="Theme Studio with colour editors and live preview" />
          </div>
        </div>
      </Section>

      <Section
        n="06"
        label="FOCUS"
        title={
          <>
            FOCUS ON
            <br />
            THE PAGE.
          </>
        }
      >
        <div className="cols">
          <div className="copy">
            <p>
              Focus Mode hides the Rail and the top strip so only the page remains. Move to the left
              edge to peek at the Rail again. Open two pages side by side with{' '}
              <strong>Split View</strong> and drag the divider to resize.
            </p>
          </div>
          <div className="vis">
            <Shot name="split" alt="Two pages side by side in Split View" />
          </div>
        </div>
      </Section>

      <Section
        n="07"
        label="PRIVACY"
        title={
          <>
            YOUR BROWSER.
            <br />
            YOUR DATA.
          </>
        }
      >
        <div className="cols">
          <div className="copy">
            <p>
              History, tabs, bookmarks, pins and settings are stored on your computer. This version
              has no analytics or telemetry code. Controls that exist today: blocking third-party
              cookies, a JavaScript switch, per-site camera, microphone, location and notification
              permissions, clearing history, cache and cookies, and private windows that don’t write
              history.
            </p>
            <p>
              What it doesn’t do yet: block trackers or ads, or sync your browsing between devices.
              We’ll say so on the privacy page rather than imply otherwise.
            </p>
            <ArrowLink href="/privacy">Read the privacy details</ArrowLink>
          </div>
        </div>
      </Section>

      <section className="final">
        <div className="container">
          <div className="rule" />
          <div className="label sec-meta">READY FOR LAUNCH?</div>
          <h2 className="display h2">
            DOWNLOAD
            <br />X ORBIT
          </h2>
          <div className="os-row">
            <Link className="btn" href="/download">
              macOS
            </Link>
            <Link className="btn" href="/download#windows-install">
              Windows · Early test build
            </Link>
            <span className="label">BETA · {VERSION}</span>
          </div>
        </div>
      </section>
    </>
  )
}
