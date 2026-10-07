// Tiny static server for local development that applies the same security headers as vercel.json.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const headers = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).headers[0].headers.map(
    (h) => [h.key, h.value],
  ),
)
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

// Tests add the local emulator hosts to the production policy (EXTRA_CONNECT / EXTRA_FRAME); nothing else is loosened.
const extra = (k, v) => (v ? ` ${v}` : '')
if (process.env.EXTRA_CONNECT)
  headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace(
    "connect-src 'self'",
    `connect-src 'self'${extra('c', process.env.EXTRA_CONNECT)}`,
  )
if (process.env.EXTRA_FRAME)
  headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace(
    'frame-src',
    `frame-src ${process.env.EXTRA_FRAME}`,
  )

export function serve(port = 4500) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    const rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)
    const file = path.resolve(root, '.' + rel)
    const allowed =
      ['/index.html', '/app.css', '/config.js', '/firebase-config.js', '/favicon.svg'].includes(
        rel,
      ) || /^\/(fonts|js|vendor)\//.test(rel)
    if (!allowed || !file.startsWith(root + path.sep) || !fs.existsSync(file)) {
      res.writeHead(404)
      return res.end('not found')
    }
    res.writeHead(200, {
      ...headers,
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}
if (process.argv[1] === import.meta.filename)
  serve(Number(process.env.PORT ?? 4500)).then(() =>
    console.log('Support Center → http://127.0.0.1:' + (process.env.PORT ?? 4500)),
  )
