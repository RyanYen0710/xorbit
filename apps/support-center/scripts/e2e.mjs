// Drives the real page in Chromium with production security headers. The form service is faked, so nothing is emailed.
import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { serve } from './serve.mjs'

const server = await serve(4511)
const base = 'http://127.0.0.1:4511'
const log = (m) => console.log('✓', m)
const KEY = '12345678-aaaa-bbbb-cccc-1234567890ab'

const browser = await chromium.launch({ channel: 'chromium' })
const problems = []
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && problems.push('console: ' + m.text()))
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))

  // 1) not configured yet: honest banner, nothing is sent
  let sent = []
  await page.route('https://api.web3forms.com/**', (r) => {
    sent.push(JSON.parse(r.request().postData()))
    r.fulfill({ json: { success: true } })
  })
  const noKey = (r) =>
    r.fulfill({ contentType: 'text/javascript', body: "window.XORBIT_SUPPORT={accessKey:''}" })
  await page.route('**/config.js', noKey)
  await page.goto(base)
  assert.match(await page.locator('#banner').innerText(), /being connected|not connected/i)
  await fillValid(page)
  await page.click('#send')
  assert.match(await page.locator('#banner').innerText(), /not connected/i)
  assert.equal(sent.length, 0)
  log('without an access key the form explains it and sends nothing')

  // 2) configured (key injected the way config.js would set it)
  await page.unroute('**/config.js', noKey)
  await page.route('**/config.js', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `window.XORBIT_SUPPORT={accessKey:'${KEY}'}`,
    }),
  )
  await page.goto(base)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  assert.equal(await page.locator('#banner').isHidden(), true)

  // validation: empty submit flags every required field and sends nothing
  await page.click('#send')
  for (const n of ['title', 'category', 'product', 'impact', 'details', 'email', 'ack'])
    assert.ok((await page.locator(`#e-${n}`).innerText()).length > 3, 'error for ' + n)
  assert.equal(await page.locator('#title').getAttribute('aria-invalid'), 'true')
  assert.equal(sent.length, 0)
  log('required fields are validated with inline, accessible errors')

  // tips adapt to the category
  await page.selectOption('#category', 'Chrome extension')
  assert.match(await page.locator('#tips').innerText(), /manifest\.json/)
  log('the “what to include” tips change with the category')

  // 3) a good ticket
  await fillValid(page)
  await page.click('#send')
  await page.locator('#done').waitFor({ state: 'visible' })
  assert.equal(sent.length, 1)
  const p = sent[0]
  assert.equal(p.access_key, KEY)
  assert.match(
    p.subject,
    /^\[XO-\d{6}-[2-9A-HJKMNP-Z]{4}\] \[Downloads & installer\] Installer won’t open$/,
  )
  assert.equal(p.email, 'ryan@example.com')
  assert.equal(p.replyto, 'ryan@example.com')
  for (const s of [
    'Category: Downloads & installer',
    'Product: X Orbit for Mac',
    'Impact:',
    '--- WHAT HAPPENED ---',
    '--- STEPS TO REPRODUCE ---',
  ])
    assert.ok(p.message.includes(s), 'message has ' + s)
  assert.ok(!p.message.includes('DIAGNOSTICS'))
  assert.match(await page.locator('#done-id').innerText(), /^XO-\d{6}-[2-9A-HJKMNP-Z]{4}$/)
  assert.equal(await page.locator('#mine li').count(), 1)
  log(
    'a valid ticket is sent with ID in the subject, reply-to set, and no diagnostics unless asked',
  )

  // 4) diagnostics only when ticked, and untrusted text stays text
  await page.click('#another')
  await fillValid(page, { title: '<img src=x onerror=window.__xss=1> broken', diag: true })
  await page.click('#send')
  await page.locator('#done').waitFor({ state: 'visible' })
  assert.ok(
    sent[1].message.includes('--- DIAGNOSTICS (user opted in) ---') &&
      sent[1].message.includes('User agent:'),
  )
  assert.equal(await page.evaluate(() => window.__xss), undefined)
  assert.ok(
    (await page.locator('#mine').innerText()).includes('<img src=x onerror=window.__xss=1> broken'),
  )
  log(
    'diagnostics are attached only when ticked; HTML typed into a ticket is shown as plain text, never run',
  )

  // 5) spam trap
  await page.click('#another')
  await fillValid(page)
  await page.evaluate(() => {
    document.querySelector('#website').value = 'http://spam.example'
  })
  await page.click('#send')
  await page.locator('#done').waitFor({ state: 'visible' })
  assert.equal(sent.length, 2)
  log('the hidden spam-trap field blocks bots without sending anything')

  // 6) soft rate limit (3 per 10 min): the third counted ticket is allowed, the next refused
  await page.click('#another')
  await fillValid(page)
  await page.click('#send')
  await page.locator('#done').waitFor({ state: 'visible' })
  assert.equal(sent.length, 3)
  await page.click('#another')
  await fillValid(page)
  await page.click('#send')
  assert.match(await page.locator('#banner').innerText(), /wait a few minutes/i)
  assert.equal(sent.length, 3)
  log('sending many tickets in a row is throttled')

  // 7) network failure keeps the text and re-enables sending
  await page.evaluate(() => localStorage.removeItem('xorbit-recent'))
  await page.unroute('https://api.web3forms.com/**')
  await page.route('https://api.web3forms.com/**', (r) => r.abort())
  await page.click('#send')
  await page.waitForFunction(() => document.querySelector('#banner').dataset.kind === 'error')
  assert.equal(await page.locator('#send').isEnabled(), true)
  assert.ok((await page.inputValue('#details')).length > 20)
  log('a network failure shows an error, keeps what you typed, and lets you retry')

  // 8) security headers + no CSP violations or errors
  const res = await page.request.get(base)
  const h = res.headers()
  assert.match(h['content-security-policy'], /script-src 'self'/)
  assert.equal(h['x-frame-options'], 'DENY')
  const failures = problems.filter((x) => !/Failed to load resource|ERR_FAILED|net::/.test(x))
  assert.deepEqual(failures, [])
  log('strict CSP (no inline script/style) with no violations or page errors')

  // 9) phone width: no sideways scroll
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
    true,
  )
  log('fits a phone screen')
  console.log('\nALL SUPPORT CENTER CHECKS PASSED')
} catch (e) {
  console.error('\nFAILED:', e)
  console.error('collected page problems:', problems)
  process.exitCode = 1
} finally {
  await browser.close()
  server.close()
}

async function fillValid(page, o = {}) {
  await page.fill('#title', o.title ?? 'Installer won’t open')
  await page.selectOption('#category', 'Downloads & installer')
  await page.selectOption('#product', 'X Orbit for Mac')
  await page.selectOption('#impact', 'A feature is broken')
  await page.fill(
    '#details',
    'I downloaded the dmg, dragged it to Applications and macOS says it can’t be opened.',
  )
  await page.fill('#steps', '1. Download\n2. Drag to Applications\n3. Open')
  await page.fill('#email', 'ryan@example.com')
  await page.check('#ack')
  if (o.diag) await page.check('#diag')
}
