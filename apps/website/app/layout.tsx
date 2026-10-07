import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { Footer, Header } from '@/components/Shell'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'X Orbit — The web, reorbited.', template: '%s — X Orbit' },
  description:
    'X Orbit is a desktop browser built around Spaces, a vertical Orbit Rail and a bottom Orbit Bar instead of a crowded toolbar.',
  openGraph: {
    title: 'X Orbit — The web, reorbited.',
    description: 'A browser designed around your space, not your tabs.',
    type: 'website',
    images: ['/shots/newtab.png'],
  },
  icons: { icon: '/icon.svg' },
}
export const viewport: Viewport = { themeColor: '#050505', colorScheme: 'dark' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers() // dynamic rendering: every page is built per request so Next can put the CSP nonce on its scripts
  return (
    <html lang="en">
      <body>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
