import type { NextConfig } from 'next'

// Security headers for every page. The Content-Security-Policy is set per request (with a nonce) in proxy.ts.
const config: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
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
