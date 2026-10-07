// Full browser test of the Support Center against the Firebase Auth + Firestore EMULATORS (nothing real is touched).
// Run: node run-emulators.mjs app
process.env.EXTRA_CONNECT = 'http://127.0.0.1:9099 http://127.0.0.1:8080 ws://127.0.0.1:8080'
process.env.EXTRA_FRAME = 'http://127.0.0.1:9099'
const { serve } = await import('../scripts/serve.mjs')
import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'

const PROJECT = 'demo-xorbit-support'
const server = await serve(4531)
const base = 'http://127.0.0.1:4531'
const AUTH = `http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}`
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`
const log = (m) => console.log('✓', m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CONFIG = `window.XORBIT_FIREBASE={apiKey:'fake-key',authDomain:'127.0.0.1:9099',projectId:'${PROJECT}',appId:'1:1:web:1',emulator:{auth:'http://127.0.0.1:9099',firestore:['127.0.0.1',8080]}}`
const KEY = '12345678-aaaa-bbbb-cccc-1234567890ab'

// helpers that talk to the emulators directly (what clicking the emailed link / using the console would do)
const verifyEmail = async (email) => {
  const { oobCodes } = await (await fetch(`${AUTH}/oobCodes`)).json()
  const c = oobCodes.filter((o) => o.email === email && o.requestType === 'VERIFY_EMAIL').pop()
  assert.ok(c, 'a verification email was issued')
  await fetch(c.oobLink, { redirect: 'manual' })
}
const asOwner = (method, path, body) =>
  fetch(`${FS}/${path}`, {
    method,
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const browser = await chromium.launch({ channel: 'chromium' })
const problems = []
let failed = false
try {
  const newCtx = async (viewport = { width: 1280, height: 900 }) => {
    const ctx = await browser.newContext({ viewport })
    const page = await ctx.newPage()
    page.on(
      'console',
      (m) => m.type() === 'error' && problems.push('console: ' + m.text().slice(0, 200)),
    )
    page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
    await ctx.route('**/config.js', (r) =>
      r.fulfill({
        contentType: 'text/javascript',
        body: `window.XORBIT_SUPPORT={accessKey:'${KEY}'}`,
      }),
    )
    return { ctx, page }
  }

  // 0) before the Firebase project exists the page says so
  {
    const { ctx, page } = await newCtx()
    await ctx.route('**/firebase-config.js', (r) =>
      r.fulfill({ contentType: 'text/javascript', body: 'window.XORBIT_FIREBASE={}' }),
    )
    await page.goto(base)
    await page.getByText('being set up').waitFor()
    log('without Firebase settings the page says it is being set up (no broken UI)')
    await ctx.close()
  }

  // 1) customer: sign up
  const mails = []
  const cust = await newCtx()
  const P = cust.page
  await cust.ctx.route('**/firebase-config.js', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: CONFIG }),
  )
  await cust.ctx.route('https://api.web3forms.com/**', (r) => {
    mails.push(JSON.parse(r.request().postData()))
    r.fulfill({ json: { success: true } })
  })
  await P.goto(base)
  await P.locator('.auth').waitFor()
  await P.getByRole('tab', { name: 'Create account' }).click()
  await P.fill('#su-email', 'pat@example.com')
  await P.fill('#su-pw', 'weak')
  await P.fill('#su-pw2', 'weak')
  await P.getByRole('button', { name: 'Create account' }).click()
  assert.match(await P.locator('#e-su-pw').innerText(), /at least 8 characters.*uppercase.*number/)
  // live checklist: 'weak' meets only the lowercase rule
  assert.deepEqual(await P.locator('#su-rules li').evaluateAll((l) => l.map((e) => e.dataset.ok)), [
    'false',
    'false',
    'true',
    'false',
  ])
  await P.fill('#su-pw', 'Sturdy-pass-42')
  await P.fill('#su-pw2', 'Different-pass-42')
  await P.getByRole('button', { name: 'Create account' }).click()
  assert.match(await P.locator('#e-su-pw2').innerText(), /do not match/)
  await P.fill('#su-email', 'patrick.longname@example.com')
  await P.fill('#su-pw', 'Xpatrick.longname1')
  await P.fill('#su-pw2', 'Xpatrick.longname1')
  await P.getByRole('button', { name: 'Create account' }).click()
  assert.match(await P.locator('#e-su-pw').innerText(), /email address/)
  log(
    'weak passwords, mismatches and passwords built from the email are refused before any request',
  )
  await P.fill('#su-email', 'pat@example.com')
  await P.fill('#su-name', 'Pat')
  await P.fill('#su-pw', 'Sturdy-pass-42')
  await P.fill('#su-pw2', 'Sturdy-pass-42')
  await P.getByRole('button', { name: 'Create account' }).click()
  await P.getByRole('heading', { name: 'Confirm your email' }).waitFor()
  assert.equal(await P.locator('.success-mark').count(), 1, 'success tick shows after sign-up')
  log('password checklist turns red/green and the account-created tick appears')
  log('a strong password creates the account and asks for email confirmation')

  // 2) unverified users are locked out until they click the link
  await P.getByRole('button', { name: 'I have confirmed' }).click()
  await P.getByText('Not confirmed yet').waitFor()
  await verifyEmail('pat@example.com')
  await P.getByRole('button', { name: 'I have confirmed' }).click()
  await P.getByRole('heading', { name: 'Your conversations with support' }).waitFor()
  log('after clicking the emailed link the customer reaches their ticket list (not before)')

  // 3) open a ticket
  await P.getByRole('link', { name: 'New ticket' }).first().click()
  await P.getByRole('button', { name: 'Send ticket' }).click()
  assert.ok((await P.locator('#e-title').innerText()).length > 3)
  await P.fill('#title', '<img src=x onerror=window.__xss=1> Installer will not open')
  await P.selectOption('#category', 'Downloads and installer')
  await P.selectOption('#product', 'X Orbit for Mac')
  await P.selectOption('#impact', 'A feature is broken')
  await P.fill('#details', 'I downloaded the dmg and macOS refuses to open it at all.')
  await P.fill('#steps', '1. Download\n2. Open')
  await P.check('#ack')
  await P.getByRole('button', { name: 'Send ticket' }).click()
  await P.locator('.thread-head').waitFor()
  const id = (await P.locator('.thread-head .mono').innerText()).trim()
  assert.match(id, /^XO-\d{6}-[2-9A-HJKMNP-Z]{4}$/)
  assert.ok(
    (await P.locator('h2').first().innerText()).includes('<img src=x onerror=window.__xss=1>'),
  )
  assert.equal(await P.evaluate(() => window.__xss), undefined)
  log(`the ticket is saved (${id}); HTML in its title is shown as plain text and never runs`)
  await sleep(500)
  assert.equal(mails.length, 1)
  assert.ok(
    mails[0].message.includes(id) &&
      !mails[0].message.includes('pat@example.com') &&
      !mails[0].message.includes('macOS refuses'),
  )
  log(
    'the inbox heads-up email carries only the ID, category and a link: no ticket text, no personal data',
  )

  // 4) rate limit on tickets
  await P.getByRole('link', { name: 'New ticket' }).first().click()
  await P.fill('#title', 'Second ticket right away')
  await P.selectOption('#category', 'Bug or crash')
  await P.selectOption('#product', 'Not sure')
  await P.selectOption('#impact', 'Just a question or suggestion')
  await P.fill('#details', 'Trying to open another ticket immediately after the first.')
  await P.check('#ack')
  await P.getByRole('button', { name: 'Send ticket' }).click()
  await P.getByText('one ticket per minute').waitFor()
  log('opening a second ticket within a minute is refused by the server')

  // 5) conversation (customer side)
  await P.goto(`${base}/#/t/${id}`)
  await P.locator('.thread-head').waitFor()
  await sleep(5200) // the server allows one message per 5 seconds
  await P.fill('#reply', 'Any update on this? Thanks!')
  await P.getByRole('button', { name: 'Send', exact: true }).click()
  await P.locator('.bubble.user', { hasText: 'Any update on this' }).waitFor()
  await P.waitForFunction(() => !document.querySelector('.comp-row .btn').disabled) // first send fully confirmed by the server
  await P.fill('#reply', 'Too quick')
  await P.getByRole('button', { name: 'Send', exact: true }).click()
  await P.getByText('wait a few seconds').waitFor()
  log(
    'the customer can reply in the ticket; sending faster than one message per 5 seconds is refused',
  )

  // 6) administrator signs in with (fake) Google
  const adm = await newCtx()
  const A = adm.page
  await adm.ctx.route('**/firebase-config.js', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: CONFIG }),
  )
  await A.goto(base)
  await A.locator('.auth').waitFor()
  const [popup] = await Promise.all([
    adm.ctx.waitForEvent('page'),
    A.getByRole('button', { name: 'Continue with Google' }).click(),
  ])
  // the emulator's fake account chooser can ignore a click that lands while it is still drawing: retry until the form shows
  for (let i = 0; i < 8 && !(await popup.locator('#email-input').isVisible()); i++) {
    await popup
      .getByRole('button', { name: /Add new account/ })
      .click({ timeout: 2000 })
      .catch(() => {})
    await sleep(600)
  }
  await popup.fill('#email-input', 'boss@gmail.com')
  await popup.fill('#display-name-input', 'The Boss')
  await popup.click('#sign-in')
  await A.getByRole('heading', { name: 'Your conversations with support' }).waitFor()
  assert.equal(await A.getByRole('link', { name: 'Admin' }).count(), 0)
  log('Google sign-in works, and a Google account that is not listed gets no admin access')
  await A.goto(`${base}/#/admin`)
  await A.reload()
  await A.getByText('This area is for X Orbit administrators').waitFor()
  log('typing /#/admin does nothing for a non-admin')

  // list the Google user as admin (what you do once in the Firebase console), then reload
  await A.goto(`${base}/#/account`)
  await A.locator('#uid').waitFor()
  const bossUid = (await A.locator('#uid').innerText()).trim()
  assert.ok(bossUid.length > 10)
  assert.equal(
    (await asOwner('PATCH', `admins/${bossUid}`, { fields: { ok: { booleanValue: true } } }))
      .status,
    200,
  )
  await A.goto(base)
  await A.reload()
  await A.getByRole('link', { name: 'Admin' }).click()
  await A.getByRole('heading', { name: 'All tickets' }).waitFor()
  await A.locator('.ticket-row').first().waitFor()
  assert.equal(await A.locator('.ticket-row').count(), 1)
  assert.ok((await A.locator('.ticket-row').first().innerText()).includes('pat@example.com'))
  assert.match(await A.locator('.ticket-row').first().innerText(), /needs reply/i) // badges are upper-cased by CSS
  log('the listed Google account sees the admin area with every ticket, flagged "Needs reply"')

  // 7) admin answers
  await A.locator('.ticket-row').first().click()
  await A.locator('.thread-head').waitFor()
  assert.ok((await A.locator('dl.meta').innerText()).includes('pat@example.com'))
  await A.selectOption('#canned', { index: 3 }) // the "can't be opened" saved reply
  await A.getByRole('button', { name: 'Send', exact: true }).click()
  await A.locator('.bubble.admin').waitFor()
  assert.match(await A.locator('.th-side .badge').innerText(), /Waiting on customer/i)
  log('the admin replies with a saved answer; the ticket moves to "Waiting on customer"')

  // 8) the customer sees it live
  await P.locator('.bubble.admin', { hasText: 'Open Anyway' }).waitFor({ timeout: 15000 })
  assert.match(await P.locator('.th-side .badge').innerText(), /Waiting for your reply/i)
  log('the customer sees the answer appear live, like a chat')

  // 9) status changes show up for the customer; delete
  await A.selectOption('#status', 'solved')
  await A.locator('.th-side .badge', { hasText: 'Solved' }).waitFor()
  await P.locator('.th-side .badge', { hasText: 'Solved' }).waitFor({ timeout: 15000 })
  log('changing the status as admin shows up for the customer right away')
  P.once('dialog', (d) => d.accept())
  await P.getByRole('button', { name: 'Delete ticket' }).click()
  await P.getByText('No tickets yet.').waitFor()
  log('a customer can delete their own ticket and conversation')

  // 10) sign-in errors reveal nothing about which emails have accounts
  await P.getByRole('link', { name: 'pat@example.com' }).click()
  await P.getByRole('button', { name: 'Sign out' }).click()
  await P.locator('.auth').waitFor()
  await P.fill('#si-email', 'nobody@example.com')
  await P.fill('#si-pw', 'Whatever-123')
  await P.getByRole('button', { name: 'Sign in', exact: true }).click()
  await P.getByText('Incorrect email or password.').waitFor()
  await P.fill('#si-email', 'pat@example.com')
  await P.fill('#si-pw', 'Wrong-pass-123')
  await P.getByRole('button', { name: 'Sign in', exact: true }).click()
  await P.getByText('Incorrect email or password.').waitFor()
  log('wrong email and wrong password give the same message')

  // 11) security headers, no CSP/script errors in the whole session, phone layout
  const h = (await P.request.get(base)).headers()
  assert.match(h['content-security-policy'], /script-src 'self' https:\/\/apis\.google\.com/)
  assert.equal(h['x-frame-options'], 'DENY')
  const real = problems.filter(
    (x) => !/Failed to load resource|ERR_|net::|\(auth\/|FirebaseError|403|400|permission/i.test(x),
  )
  assert.deepEqual(real, [])
  log('strict security headers, no CSP violations and no script errors during the whole session')
  const phone = await newCtx({ width: 390, height: 844 })
  await phone.ctx.route('**/firebase-config.js', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: CONFIG }),
  )
  await phone.page.goto(base)
  await phone.page.locator('.auth').waitFor()
  assert.equal(
    await phone.page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
    true,
  )
  log('the sign-in page fits a phone screen')
  console.log('\nALL SUPPORT CENTER APP CHECKS PASSED')
} catch (e) {
  failed = true
  console.error('\nFAILED:', e)
  console.error('browser problems:', problems.slice(0, 8))
} finally {
  await browser.close()
  server.close()
  process.exit(failed ? 1 : 0)
}
