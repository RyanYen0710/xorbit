// X Orbit account, end to end, against the Firebase emulators (nothing real is touched). Run (needs `pnpm build` first):
//   node ../support-center/dev/run-emulators.mjs account      (from apps/browser)
import { chromium } from '../../support-center/dev/node_modules/playwright-core/index.mjs'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import assert from 'node:assert/strict'

const browserDir = path.resolve(import.meta.dirname, '..')
const siteDir = path.resolve(browserDir, '../website')
process.chdir(browserDir)
const next = path.join(siteDir, 'node_modules/next/dist/bin/next')
const siteEnv = { ...process.env, NEXT_PUBLIC_FIREBASE_EMULATOR: '1', NEXT_TELEMETRY_DISABLED: '1' }
assert.equal(
  spawnSync('node', [next, 'build'], { cwd: siteDir, env: siteEnv, stdio: 'ignore' }).status,
  0,
  'website builds',
)
const SITE_PORT = 4540
const site = spawn('node', [next, 'start', '-p', String(SITE_PORT)], {
  cwd: siteDir,
  env: siteEnv,
  stdio: 'ignore',
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (
  let i = 0;
  i < 60 &&
  !(await fetch(`http://127.0.0.1:${SITE_PORT}`).then(
    (r) => r.ok,
    () => false,
  ));
  i++
)
  await sleep(500)

process.env.ORBIT_AUTH_EMULATOR = '127.0.0.1:9099'
process.env.ORBIT_SITE_URL = `http://127.0.0.1:${SITE_PORT}`
const { launch, until } = await import('./harness.mjs')
fs.mkdirSync('.tmp', { recursive: true })
const tmp = fs.mkdtempSync(path.resolve('.tmp/acct-'))
const AUTH = 'http://127.0.0.1:9099/emulator/v1/projects/demo-xorbit-support'
const log = (m) => console.log('✓', m)
const app = await launch({ userData: path.join(tmp, 'user'), downloads: tmp })
const { W } = app
const acct = () => W(`return w.state().account`)
const act = (...a) => app.act(...a)
const STRONG = 'Sturdy-pass-42'
let failed = false
let pw
try {
  await until(async () => (await app.state()).tabs.length > 0, 'tab')
  assert.equal((await acct()).signedIn, false)
  assert.equal(
    await W(`return globalThis.__orbitKeychainTouches ?? 0`),
    0,
    'a fresh start makes no keychain access',
  )

  // ── email + password, with the same rules as the website ──
  assert.match(
    await act('accountSignUp', { email: 'pat@example.com', password: 'weak' }),
    /^!Password needs: at least 8 characters/,
  )
  assert.match(
    await act('accountSignUp', { email: 'bad', password: STRONG }),
    /^!Enter a valid email/,
  )
  assert.match(
    await act('accountSignUp', {
      email: 'patrick.longname@example.com',
      password: 'Xpatrick.longname1',
    }),
    /^!Password needs: no part of your email/,
  )
  assert.equal(
    await act('accountSignUp', { email: 'pat@example.com', password: STRONG, name: 'Pat' }),
    'ok',
  )
  let a = await acct()
  assert.deepEqual(
    [a.signedIn, a.email, a.name, a.verified, a.providers],
    [true, 'pat@example.com', 'Pat', false, ['password']],
  )
  assert.match(
    await act('accountSignUp', { email: 'pat@example.com', password: STRONG }),
    /already exists/,
  )
  assert.match(await act('accountVerified'), /^!Not confirmed yet/)
  const { oobCodes } = await (await fetch(`${AUTH}/oobCodes`)).json()
  const mail = oobCodes
    .filter((o) => o.email === 'pat@example.com' && o.requestType === 'VERIFY_EMAIL')
    .pop()
  assert.ok(mail, 'a confirmation email was sent')
  assert.match(await act('accountResend'), /^!Please wait a minute/) // the first one just went out
  await fetch(mail.oobLink, { redirect: 'manual' })
  assert.equal(await act('accountVerified'), 'ok')
  assert.equal((await acct()).verified, true)
  log(
    'sign-up refuses weak passwords, bad emails and email-based passwords; sends a confirmation; confirming works',
  )

  // the saved sign-in is encrypted and survives a restart; tokens never reach the page
  const file = path.join(tmp, 'user', 'account.bin')
  assert.ok(fs.existsSync(file))
  assert.ok(
    !fs.readFileSync(file).toString('latin1').includes('pat@example.com'),
    'account file is encrypted',
  )
  assert.ok(
    !JSON.stringify(await W(`return w.state()`)).match(/refreshToken|idToken/),
    'no token in UI state',
  )
  await app.quit()
  const app2 = await launch({ userData: path.join(tmp, 'user'), downloads: tmp })
  await sleep(1500)
  // Starting up must never touch the OS keychain (an update changes the app's signature and macOS then asks for
  // permission, freezing the app behind that prompt). The saved sign-in is only unlocked when the Account page opens.
  assert.equal(
    await app2.W(`return globalThis.__orbitKeychainTouches ?? 0`),
    0,
    'startup made no keychain access',
  )
  assert.equal(await app2.W(`return w.state().account.signedIn`), true) // shown from the plain hint file
  assert.equal(await app2.W(`return w.state().account.email`), 'pat@example.com')
  assert.equal(await app2.act('accountOpen'), 'ok')
  await until(
    async () => await app2.W(`return !w.state().account.loading`),
    'sign-in unlocked',
    15000,
  )
  assert.ok(
    (await app2.W(`return globalThis.__orbitKeychainTouches ?? 0`)) > 0,
    'unlocked on demand',
  )
  assert.equal(await app2.W(`return w.state().account.email`), 'pat@example.com')
  assert.equal(await app2.W(`return w.state().account.verified`), true)
  log(
    'startup never touches the keychain; a saved sign-in is shown at once and unlocked only when the Account page opens',
  )
  assert.equal(await app2.act('accountSignOut'), 'ok')
  assert.ok(!fs.existsSync(file))
  assert.match(
    await app2.act('accountSignIn', { email: 'pat@example.com', password: 'Wrong-pass-42' }),
    /^!Wrong email or password/,
  )
  assert.equal(
    await app2.act('accountSignIn', { email: 'pat@example.com', password: STRONG }),
    'ok',
  )
  assert.equal(await app2.act('accountSignOut'), 'ok')
  await app2.quit()

  // ── the page: live checklist and the green tick ──
  pw = await launch({ userData: path.join(tmp, 'user2'), downloads: tmp })
  const P = pw
  await until(async () => (await P.state()).tabs.length > 0, 'tab')
  await P.act('finishOnboarding')
  await P.act('navigate', { url: 'orbit://settings#account' })
  const js = (code) => P.W(`return w.activeTab.view.webContents.executeJavaScript(arg)`, code)
  await until(async () => await js(`!!document.querySelector('.acct-tabs')`), 'account page')
  const set = (sel, v, i = 0) =>
    js(
      `(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })) })()`,
    )
  const click = (text) =>
    js(
      `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)}).click()`,
    )
  await click('Create account')
  await until(
    async () => (await js(`document.querySelectorAll('.acct input.field').length`)) === 4,
    'sign-up form',
  )
  await set('.acct input.field', 'qaz@example.com', 1)
  await set('.acct input.field', 'weak', 2)
  const marks = () =>
    js(`JSON.stringify([...document.querySelectorAll('.rules li')].map((l) => l.dataset.ok))`)
  assert.equal(await marks(), JSON.stringify(['false', 'false', 'true', 'false']))
  await set('.acct input.field', 'Sturdy-pass-42', 2)
  assert.equal(await marks(), JSON.stringify(['true', 'true', 'true', 'true']))
  await set('.acct input.field', 'Sturdy-pass-42', 3)
  await js(`document.querySelector('.acct form').requestSubmit()`)
  await until(
    async () => await js(`!!document.querySelector('.success-mark')`),
    'success tick',
    15000,
  )
  assert.match(
    await js(`document.querySelector('.acct').innerText`),
    /Account created[\s\S]*Confirm your email/,
  )
  log(
    'the page shows a live red/green password checklist and the green circle tick after creating an account',
  )
  assert.equal(await P.act('accountSignOut'), 'ok')

  // ── Google, through the browser ──
  const chrome = await chromium.launch({ channel: 'chromium' })
  const googleVia = async (email, name) => {
    const url = await P.W(`return globalThis.__orbitOpened`)
    const ctx = await chrome.newContext()
    const page = await ctx.newPage()
    await page.goto(url)
    const [popup] = await Promise.all([
      ctx.waitForEvent('page'),
      page.getByRole('button', { name: 'Continue with Google' }).click(),
    ])
    for (let i = 0; i < 8 && !(await popup.locator('#email-input').isVisible()); i++) {
      await popup
        .getByRole('button', { name: /Add new account/ })
        .click({ timeout: 2000 })
        .catch(() => {})
      await sleep(600)
    }
    await popup.fill('#email-input', email)
    await popup.fill('#display-name-input', name)
    await popup.click('#sign-in')
    await page.getByText('You are signed in. You can close this tab').waitFor({ timeout: 20000 })
    await ctx.close()
  }
  await P.W(`delete globalThis.__orbitOpened; return 1`)
  assert.equal(await P.act('accountGoogle'), 'ok')
  assert.equal((await acct2(P)).googleWaiting, true)
  assert.match(
    await P.W(`return globalThis.__orbitOpened`),
    new RegExp(`^http://127\\.0\\.0\\.1:${SITE_PORT}/app-sign-in\\?port=\\d+&state=[0-9a-f]{64}$`),
  )
  // attacks on the one-shot local listener
  const [, port, state] = /port=(\d+)&state=([0-9a-f]+)/.exec(
    await P.W(`return globalThis.__orbitOpened`),
  )
  const post = (body, headers = {}) =>
    fetch(`http://127.0.0.1:${port}/token`, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    })
  assert.equal((await post('state=' + '0'.repeat(64) + '&gid=a.b.c')).status, 403)
  assert.equal((await post(`state=${state}&gid=`)).status, 400)
  assert.equal(
    (await post(`state=${state}&gid=a.b.c`, { origin: 'https://evil.example' })).status,
    403,
  )
  const spoofed = await new Promise((res) => {
    const r = http.request(
      { host: '127.0.0.1', port, path: '/done', headers: { host: 'evil.example' } },
      (x) => res(x.statusCode),
    )
    r.on('error', () => res(0))
    r.end()
  })
  assert.equal(spoofed, 400) // a spoofed Host (DNS-rebinding style) is refused
  assert.equal((await acct2(P)).signedIn, false)
  log(
    'the local callback refuses a wrong secret, a malformed token, a foreign origin and a spoofed host',
  )
  assert.equal(await P.act('accountGoogleCancel'), 'ok')
  assert.equal((await acct2(P)).googleWaiting, false)
  await P.W(`delete globalThis.__orbitOpened; return 1`)
  assert.equal(await P.act('accountGoogle'), 'ok')
  await googleVia('gina@gmail.com', 'Gina Lee')
  await until(async () => (await acct2(P)).signedIn, 'google sign-in completes', 15000)
  a = await acct2(P)
  assert.deepEqual(
    [a.email, a.name, a.verified, a.providers.includes('google.com'), a.googleWaiting],
    ['gina@gmail.com', 'Gina Lee', true, true, false],
  )
  log('Continue with Google: the browser round trip signs the app in (verified, Google linked)')
  await P.act('accountSignOut')

  // link Google to an email account (different address)
  assert.equal(await P.act('accountSignIn', { email: 'pat@example.com', password: STRONG }), 'ok')
  assert.equal((await acct2(P)).providers.includes('google.com'), false)
  await P.W(`delete globalThis.__orbitOpened; return 1`)
  assert.equal(await P.act('accountGoogle', { link: true }), 'ok')
  await googleVia('pat.work@gmail.com', 'Pat Work')
  await until(
    async () => (await acct2(P)).providers.includes('google.com') || (await acct2(P)).error,
    'google link finished',
    15000,
  )
  await until(async () => (await acct2(P)).providers.includes('google.com'), 'google linked', 3000)
  a = await acct2(P)
  assert.deepEqual([a.email, a.providers.sort()], ['pat@example.com', ['google.com', 'password']])
  log('an email account can link a Google account (both sign-in methods on one X Orbit account)')
  await chrome.close()
  console.log('\nALL ACCOUNT CHECKS PASSED')
} catch (e) {
  failed = true
  console.error('\nFAILED:', e)
} finally {
  await pw?.quit().catch(() => {})
  site.kill()
  fs.rmSync(tmp, { recursive: true, force: true })
  process.exit(failed ? 1 : 0)
}
async function acct2(p) {
  return p.W(`return w.state().account`)
}
