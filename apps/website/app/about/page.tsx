import type { Metadata } from 'next'
import { PageHead } from '@/components/Shell'

export const metadata: Metadata = { title: 'About' }

export default function About() {
  return (
    <>
      <PageHead
        n="07"
        label="ABOUT"
        title={
          <>
            A BROWSER,
            <br />
            REDESIGNED.
          </>
        }
        lede="X Orbit asks what a browser would look like if you started from the page and the way people actually work, not from a row of tabs."
      />
      <div className="container prose" style={{ marginTop: 48 }}>
        <h3>Principles</h3>
        <p>
          <strong>Quiet.</strong> The interface gets out of the way. <strong>Fast.</strong>{' '}
          Animations last a fraction of a second and respect reduced-motion settings.{' '}
          <strong>Honest.</strong> We describe what is built, and what isn’t.
        </p>
        <h3>Built on</h3>
        <p>
          X Orbit is built with Electron and Chromium, TypeScript and React. Fonts are open source:
          Inter, Space Grotesk and IBM Plex Mono. The design language is original; it takes
          inspiration from aerospace interfaces but uses no one else’s marks.
        </p>
        <h3>Status</h3>
        <p>Version 0.1 beta. Expect rough edges, and expect it to change.</p>
      </div>
    </>
  )
}
