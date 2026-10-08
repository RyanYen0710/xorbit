// Tests the self-updater against a REAL packaged copy of the app: a throttled local "release server" offers a newer
// version, the app downloads it with progress and speed, verifies it, swaps itself and reopens as the new version.
// Needs a packaged build first (apps/browser/release.noindex/mac-arm64/X Orbit.app). Run: node scripts/update.e2e.mjs
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { launch, until } from './harness.mjs'

const SRC = path.resolve('release.noindex/mac-arm64/X Orbit.app')
assert.ok(fs.existsSync(SRC), 'build a packaged app first')
fs.mkdirSync('.tmp', { recursive: true })
const tmp = fs.mkdtempSync(path.resolve('.tmp/upd-'))
const log = (m) => console.log('✓', m)
const sh = (c, a) => execFileSync(c, a, { stdio: 'pipe' }).toString().trim()
const plist = (app, k) =>
  sh('/usr/bin/plutil', ['-extract', k, 'raw', '-o', '-', `${app}/Contents/Info.plist`])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const version = plist(SRC, 'CFBundleShortVersionString')

// ── a pretend newer release (the next patch number, e.g. 0.1.4 -> 0.1.5): same app, re-signed, zipped ──
const feedDir = path.join(tmp, 'feed')
fs.mkdirSync(feedDir)
const NEW = version.replace(/\d+$/, (n) => String(Number(n) + 1))
const stage = path.join(tmp, 'stage')
fs.mkdirSync(stage)
sh('/usr/bin/ditto', [SRC, `${stage}/X Orbit.app`])
for (const k of ['CFBundleShortVersionString', 'CFBundleVersion'])
  sh('/usr/bin/plutil', ['-replace', k, '-string', NEW, `${stage}/X Orbit.app/Contents/Info.plist`])
// sign the pretend update the same way the real build is (same local identity if present, else ad-hoc)
const kc = path.resolve('../../.tools/signing/orbit-signing.keychain-db')
let signArgs = ['--sign', '-']
if (fs.existsSync(kc)) {
  sh('security', [
    'unlock-keychain',
    '-p',
    fs.readFileSync(path.resolve('../../.tools/signing/keychain-password.txt'), 'utf8').trim(),
    kc,
  ])
  const id = /([0-9A-F]{40}) "X Orbit Code Signing"/.exec(
    sh('security', ['find-identity', '-p', 'codesigning', kc]),
  )[1]
  signArgs = ['--sign', id, '--keychain', kc]
}
sh('/usr/bin/codesign', ['--force', '--deep', ...signArgs, `${stage}/X Orbit.app`])
const zip = `X-Orbit-${NEW}-arm64.zip`
sh('/usr/bin/ditto', ['-c', '-k', '--keepParent', `${stage}/X Orbit.app`, path.join(feedDir, zip)])
const zbuf = fs.readFileSync(path.join(feedDir, zip))
// a look-alike update signed by someone else (ad-hoc), for the "different publisher" check
const strangerStage = path.join(tmp, 'stranger')
fs.mkdirSync(strangerStage)
sh('/usr/bin/ditto', [`${stage}/X Orbit.app`, `${strangerStage}/X Orbit.app`])
sh('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', `${strangerStage}/X Orbit.app`])
sh('/usr/bin/ditto', [
  '-c',
  '-k',
  '--keepParent',
  `${strangerStage}/X Orbit.app`,
  path.join(tmp, 'stranger.zip'),
])
const sbuf = fs.readFileSync(path.join(tmp, 'stranger.zip'))
let serveStranger = false
const sha = (b) => crypto.createHash('sha512').update(b).digest('base64')
const yml = (hash, size = zbuf.length) =>
  `version: ${NEW}\nfiles:\n  - url: ${zip}\n    sha512: ${hash}\n    size: ${size}\npath: ${zip}\nsha512: ${hash}\nreleaseDate: '2026-01-01T00:00:00.000Z'\n`
let goodHash = sha(zbuf)
const strangerHash = sha(sbuf)
let feedHash = goodHash
const RATE = 24 * 1048576 // bytes per second
const server = http.createServer((req, res) => {
  if (req.url.endsWith('latest-mac.yml'))
    return res.end(
      yml(serveStranger ? strangerHash : feedHash, serveStranger ? sbuf.length : zbuf.length),
    )
  if (req.url.endsWith(zip)) {
    const body = serveStranger ? sbuf : zbuf
    res.writeHead(200, { 'content-type': 'application/zip', 'content-length': body.length })
    let off = 0
    const tick = () => {
      if (off >= body.length || res.destroyed) return res.end()
      const n = Math.floor(RATE / 20)
      res.write(body.subarray(off, off + n))
      off += n
      setTimeout(tick, 50)
    }
    return tick()
  }
  res.writeHead(404).end()
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
process.env.ORBIT_UPDATE_FEED = `http://127.0.0.1:${server.address().port}/`

const install = (name) => {
  const dir = path.join(tmp, name)
  fs.mkdirSync(dir)
  sh('/usr/bin/ditto', [SRC, `${dir}/X Orbit.app`])
  return `${dir}/X Orbit.app`
}
const run = async (appPath, user) => {
  process.env.ORBIT_APP_BIN = `${appPath}/Contents/MacOS/X Orbit`
  return launch({ userData: user, downloads: path.join(user, 'dl') })
}
const upd = (app) => app.W(`return w.state().updater`)
let failed = false
let app
try {
  // 1) bad checksum: the download is thrown away and the installed app is left untouched
  feedHash = 'AAAA' + goodHash.slice(4)
  const bad = install('bad')
  app = await run(bad, path.join(tmp, 'ubad'))
  await until(async () => (await upd(app)).phase === 'error', 'checksum error', 60000)
  const e = await upd(app)
  assert.match(e.message, /checksum/)
  assert.equal(plist(bad, 'CFBundleShortVersionString'), version)
  assert.equal(await app.W(`return w.state().overlay.mode`), 'update') // the card tells the person
  await app.W(
    `return w.overlay.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(b => b.textContent === 'Later').click()")`,
  )
  await until(
    async () => (await app.W(`return w.state().overlay.mode`)) === 'compact',
    'Later hides the card',
  )
  log(
    'a download that does not match its checksum is refused, the app is untouched, and Later hides the card',
  )
  await app.quit()

  // 1b) an update signed by a different publisher is refused (only meaningful once the app has a certificate identity)
  if (fs.existsSync(kc)) {
    serveStranger = true
    const other = install('other')
    app = await run(other, path.join(tmp, 'uother'))
    await until(async () => (await upd(app)).phase === 'error', 'publisher error', 60000)
    assert.match((await upd(app)).message, /not signed by the same publisher/)
    assert.equal(plist(other, 'CFBundleShortVersionString'), version)
    log('an update signed by a different publisher is refused and the app is untouched')
    await app.quit()
    serveStranger = false
  }

  // 2) the real thing
  feedHash = goodHash
  const real = install('real')
  const user = path.join(tmp, 'ureal')
  app = await run(real, user)
  await until(async () => (await upd(app)).phase === 'downloading', 'download starts', 30000)
  await until(async () => (await upd(app)).received > 8 * 1048576, 'bytes arriving', 30000)
  const mid = await upd(app)
  assert.ok(mid.speed > 1048576, `speed is measured (${mid.speed})`)
  assert.equal(mid.total, zbuf.length)
  assert.equal(await app.W(`return w.state().overlay.mode`), 'update')
  await sleep(300)
  const text = await app.W(
    `return w.overlay.webContents.executeJavaScript("document.querySelector('.upd').innerText")`,
  )
  assert.match(text, new RegExp(`Updating X Orbit to ${NEW.replaceAll('.', '\\.')}`))
  assert.match(text, /\d+(\.\d)? MB\/s/)
  assert.match(text, /\d+\.\d MB \/ \d+\.\d MB/)
  // a picture of the card is a nice-to-have: it cannot be captured while the screen is locked or asleep
  try {
    const png = await app.W(
      `return (await w.overlay.webContents.capturePage()).toPNG().toString('base64')`,
    )
    fs.writeFileSync(path.resolve('.tmp/update-card.png'), Buffer.from(png, 'base64'))
  } catch {
    /* no picture this time */
  }
  // the bar keeps moving forward smoothly
  const readings = []
  for (let i = 0; i < 6; i++) {
    readings.push((await upd(app)).received)
    await sleep(120)
  }
  assert.ok(
    readings.every((v, i) => i === 0 || v >= readings[i - 1]),
    'progress only moves forward',
  )
  log(`progress card shows speed and sizes while downloading (${text.replace(/\n+/g, ' | ')})`)

  // the app verifies, installs, quits and reopens as the new version
  await until(
    async () => plist(real, 'CFBundleShortVersionString') === NEW,
    'new version in place',
    60000,
  )
  await sleep(2500)
  assert.equal(fs.readFileSync(path.join(user, 'update-result'), 'utf8').trim(), 'ok')
  const running = sh('/bin/sh', ['-c', `pgrep -f '${real}/Contents/MacOS' | head -1 || true`])
  assert.ok(running, 'the new version was reopened')
  log(`downloaded, verified, swapped in and reopened as ${NEW} (was ${version})`)
  execFileSync('/usr/bin/pkill', ['-f', `${real}/Contents/MacOS`], { stdio: 'ignore' })
  console.log('\nALL UPDATE CHECKS PASSED')
} catch (e) {
  failed = true
  console.error('\nFAILED:', e)
} finally {
  await app?.quit().catch(() => {})
  try {
    execFileSync('/usr/bin/pkill', ['-f', tmp], { stdio: 'ignore' })
  } catch {
    /* nothing left running */
  }
  server.close()
  fs.rmSync(tmp, { recursive: true, force: true })
  process.exit(failed ? 1 : 0)
}
