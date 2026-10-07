import type { Metadata } from 'next'
import { PageHead, Section, Shot } from '@/components/Shell'

export const metadata: Metadata = { title: 'Search' }

export default function Search() {
  return (
    <>
      <PageHead
        n="02"
        label="SEARCH"
        title={
          <>
            SEARCH
            <br />
            FROM ORBIT.
          </>
        }
        lede="Google by default, your choice of provider, and an Orbit-branded search page that is honest about where results come from."
      />
      <Section
        n="01"
        label="PROVIDERS"
        title={
          <>
            YOU PICK
            <br />
            THE ENGINE.
          </>
        }
      >
        <table className="table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>How it works in X Orbit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Google (default)</td>
              <td>Queries open Google’s own results page.</td>
            </tr>
            <tr>
              <td>DuckDuckGo · Bing · Brave</td>
              <td>Queries open that provider’s own results page.</td>
            </tr>
            <tr>
              <td>Orbit Search</td>
              <td>Opens the Orbit Search page (below).</td>
            </tr>
            <tr>
              <td>Custom</td>
              <td>
                Any URL with <code>%s</code> where the query goes.
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
      <Section
        n="02"
        label="ORBIT SEARCH"
        title={
          <>
            WHERE DO YOU
            <br />
            WANT TO GO?
          </>
        }
      >
        <div className="cols">
          <div className="copy">
            <p>
              Orbit Search is a clean, black, original search interface: Web, Images, News and Maps.
            </p>
            <p>
              <strong>Where results come from.</strong> If a search API is configured — Google
              Programmable Search or the Brave Search API — results appear inside Orbit Search under
              that API’s terms. If not, the query is forwarded to Google. X Orbit never scrapes
              result pages.
            </p>
            <p>
              <strong>What it isn’t.</strong> Orbit Search has no index of the whole web, and we
              aren’t pretending it does. An experimental index for a small set of approved domains
              is planned as a separate component.
            </p>
          </div>
          <div className="vis">
            <Shot name="newtab" alt="Orbit new tab page" />
          </div>
        </div>
      </Section>
    </>
  )
}
