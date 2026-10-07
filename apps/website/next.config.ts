import type { NextConfig } from 'next'

// Security headers for every page. 'unsafe-inline' scripts/styles are needed by Next's own inline bootstrap until
// nonce-based CSP is added; everything else (objects, framing, foreign forms, foreign base URLs) is locked down.
// Reviews use Firebase (Google sign-in + Firestore): their hosts are allowed for scripts, connections and the sign-in frame.
const emulator = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1' // local tests only
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com${emulator ? ' http://127.0.0.1:*' : ''}`,
  `frame-src https://*.firebaseapp.com https://*.web.app https://accounts.google.com${emulator ? ' http://127.0.0.1:9099' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const config: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
  transpilePackages: ['@orbit/ui', '@orbit/themes', '@orbit/types'],
  poweredByHeader: false,
}
export default config
