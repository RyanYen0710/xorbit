import { NextResponse, type NextRequest } from 'next/server'

// Content-Security-Policy with a fresh nonce per request: only scripts that carry the nonce (Next's own, and anything
// they load) may run, so injected inline script cannot execute even if some page ever echoed user text unsafely.
const emulator = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1' // local tests only

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
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
  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', csp)
  const res = NextResponse.next({ request: { headers } })
  res.headers.set('Content-Security-Policy', csp)
  return res
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|icon.svg|shots/|guide/|downloads/|install.sh).*)',
    },
  ],
}
