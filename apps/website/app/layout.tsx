import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { Footer, Header } from '@/components/Shell'
import { GOOGLE_SITE_VERIFICATION, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'X Orbit Browser — The web, reorbited.', template: '%s — X Orbit Browser' },
  description:
    'X Orbit (also written Xorbit) is a free desktop web browser for Mac and Windows built around Spaces, vertical tabs, a bookmarks sidebar and a bottom Orbit Bar instead of a crowded toolbar.',
  applicationName: 'X Orbit',
  keywords: [
    'X Orbit',
    'Xorbit',
    'X Orbit browser',
    'Xorbit browser',
    'vertical tabs browser',
    'Mac browser',
  ],
  alternates: { canonical: '/' },
  ...(GOOGLE_SITE_VERIFICATION ? { verification: { google: GOOGLE_SITE_VERIFICATION } } : {}),
  openGraph: {
    siteName: 'X Orbit',
    title: 'X Orbit Browser — The web, reorbited.',
    description: 'A browser designed around your space, not your tabs.',
    type: 'website',
    images: ['/shots/newtab.png'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icon-192.png',
  },
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
