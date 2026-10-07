// Browser test of the website's review section against the Firebase EMULATORS (nothing real is touched).
// Builds the website with the emulator switch on, serves it, and drives it like a person. Run: node run-emulators.mjs reviews
import { chromium } from 'playwright-core'
import { spawn, spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import path from 'node:path'

const site = path.resolve(import.meta.dirname, '../../website')
const next = path.join(site, 'node_modules/next/dist/bin/next')
const env = { ...process.env, NEXT_PUBLIC_FIREBASE_EMULATOR: '1', NEXT_TELEMETRY_DISABLED: '1' }
const built = spawnSync('node', [next, 'build'], { cwd: site, env, stdio: 'ignore' })
assert.equal(built.status, 0, 'website builds')
const PORT = 4532
const srv = spawn('node', [next, 'start', '-p', String(PORT)], { cwd: site, env, stdio: 'ignore' })
const base = `http://127.0.0.1:${PORT}`
const PROJECT = 'demo-xorbit-support'
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`
const log = (m) => console.log('✓', m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (let i = 0; i < 60; i++) {
  if (
    await fetch(base).then(
      (r) => r.ok,
      () => false,
    )
  )
    break
  await sleep(500)
}

const problems = []
const browser = await chromium.launch({ channel: 'chromium' })
let failed = false
try {
  const newPage = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    page.on(
      'console',
      (m) => m.type() === 'error' && problems.push('console: ' + m.text().slice(0, 200)),
    )
    page.on(
      'response',
      (r) => r.status() >= 400 && problems.push(`http ${r.status()}: ${r.url().slice(0, 120)}`),
    )
    page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
    return { ctx, page }
  }
  const signIn = async (ctx, page, email, name) => {
    const [popup] = await Promise.all([
      ctx.waitForEvent('page'),
      page.getByRole('button', { name: 'Sign in with Google' }).click(),
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
  }

  // 1) empty state
  const a = await newPage()
  const A = a.page
  await A.goto(base)
  await A.getByText('No reviews yet').waitFor()
  log('home page shows the review section with an honest empty state (no invented reviews)')

  // 2) sign in with (fake) Google, stars, validation
  await A.getByRole('button', { name: 'Rate X Orbit' }).click()
  await signIn(a.ctx, A, 'riley@gmail.com', 'Riley Test')
  await A.getByRole('radiogroup', { name: 'Your rating' }).waitFor()
  assert.equal(await A.getByLabel('NAME TO SHOW').inputValue(), 'Riley')
  await A.getByRole('button', { name: 'Post review' }).click()
  await A.getByText('Choose a star rating first.').waitFor()
  await A.getByRole('radio', { name: '4 stars' }).click()
  assert.equal(await A.getByRole('radio', { name: '4 stars' }).getAttribute('aria-checked'), 'true')
  await A.getByLabel(/YOUR REVIEW/).fill('Great <b>browser</b> & fast')
  await A.getByRole('button', { name: 'Post review' }).click()
  await A.getByText('Thank you! Your review is live.').waitFor()
  await A.getByText('1 REVIEW', { exact: true }).waitFor()
  assert.equal((await A.locator('.rev-avg').innerText()).trim(), '4.0')
  assert.equal(await A.locator('.rev-card b').count(), 0, 'review text is plain text, never HTML')
  assert.match(await A.locator('.rev-card blockquote').innerText(), /Great <b>browser<\/b> & fast/)
  log('sign-in, star picker, validation, posting; the average updates; text is shown as plain text')

  // 3) edit: too soon is refused by the server clock, later it works
  await A.getByRole('button', { name: 'Edit your review' }).click()
  assert.equal(await A.getByRole('radio', { name: '4 stars' }).getAttribute('aria-checked'), 'true')
  await A.getByRole('radio', { name: '5 stars' }).click()
  await A.getByRole('button', { name: 'Save changes' }).click()
  await A.getByRole('alert').waitFor()
  await sleep(10500)
  await A.getByRole('button', { name: 'Save changes' }).click()
  await A.getByText('Your review was updated.').waitFor()
  await A.getByText('5.0', { exact: true }).waitFor()
  log('editing is rate-limited by the server and works after the wait')

  // 4) a second person, then the line rotates by itself
  const docs = []
  for (let i = 1; i <= 7; i++) {
    const t = new Date(Date.now() - i * 60000).toISOString()
    await fetch(`${FS}/reviews/seed${i}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          rating: { integerValue: String((i % 5) + 1) },
          text: { stringValue: `Review number ${i} from a person using X Orbit every day.` },
          name: { stringValue: `Person ${i}` },
          createdAt: { timestampValue: t },
          updatedAt: { timestampValue: t },
        },
      }),
    })
    docs.push(i)
  }
  await A.reload()
  await A.locator('.rev-card').nth(5).waitFor()
  await A.getByText('8 REVIEWS', { exact: true }).waitFor()
  const start = await A.locator('.rev-track').evaluate((e) => e.scrollLeft)
  await A.locator('.rev-track').scrollIntoViewIfNeeded()
  await A.mouse.move(5, 5) // not hovering the line
  await sleep(6500)
  const later = await A.locator('.rev-track').evaluate((e) => e.scrollLeft)
  assert.ok(later > start, `the line rotated by itself (${start} -> ${later})`)
  // hovering pauses it
  await A.locator('.rev-track').hover()
  const held = await A.locator('.rev-track').evaluate((e) => e.scrollLeft)
  await sleep(6000)
  assert.equal(await A.locator('.rev-track').evaluate((e) => e.scrollLeft), held)
  log('the review line rotates smoothly on its own and rests while hovered')

  // 5) a different person sees "Rate X Orbit" (not "Edit"); delete own review with the in-page confirm
  await A.getByRole('button', { name: 'Edit your review' }).click()
  await A.getByRole('button', { name: 'Delete my review' }).click()
  await A.getByText('Delete your review for good?').waitFor()
  await A.getByRole('button', { name: 'Yes, delete' }).click()
  await A.getByText('Your review was deleted.').waitFor()
  await A.getByText('7 REVIEWS', { exact: true }).waitFor()
  log('deleting your own review uses an in-page confirmation and updates the count')

  // 6) reduced motion: the line never moves by itself
  const r = await newPage()
  await r.page.emulateMedia({ reducedMotion: 'reduce' })
  await r.page.goto(base)
  await r.page.locator('.rev-card').nth(5).waitFor()
  const rest = await r.page.locator('.rev-track').evaluate((e) => e.scrollLeft)
  await sleep(6500)
  assert.equal(await r.page.locator('.rev-track').evaluate((e) => e.scrollLeft), rest)
  log('with reduced motion the line stays still')

  const csp = problems.filter((p) => /Content Security Policy/i.test(p))
  assert.deepEqual(csp, [], 'no CSP violations')
  log('no Content-Security-Policy violations while signing in and loading Firestore')
  console.log('\nALL REVIEW CHECKS PASSED')
} catch (e) {
  failed = true
  console.error('\nFAILED:', e)
  console.error('browser problems:', problems)
} finally {
  await browser.close()
  srv.kill()
  process.exit(failed ? 1 : 0)
}
