import { NextResponse, type NextRequest } from 'next/server'

// Orbit Search for everyone: no search API key is configured here, so a query is forwarded to Google
// (the fixed destination, so this can never be used as an open redirect).
export function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 500)
  const to = q
    ? `https://www.google.com/search?q=${encodeURIComponent(q)}`
    : 'https://www.google.com/'
  const res = NextResponse.redirect(to, 302)
  res.headers.set('Referrer-Policy', 'no-referrer')
  res.headers.set('Cache-Control', 'no-store')
  return res
}
