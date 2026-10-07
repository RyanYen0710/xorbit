// Loads the built extension into Chromium and exercises it. Run `pnpm build` first.
import { chromium } from 'playwright-core'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-ext-'))
// Test copy of dist with host access to 127.0.0.1, standing in for the user gesture that grants activeTab.
const ext = path.join(tmp, 'ext')
fs.cpSync('dist', ext, { recursive: true })
const mf = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'))
mf.host_permissions = ['http://127.0.0.1/*']
fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(mf))

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(
    `<!doctype html><title>${u.pathname === '/search' ? 'Results ' + u.searchParams.get('q') : 'Page ' + u.pathname}</title><h1>${u.pathname}</h1>`,
  )
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
const log = (m) => console.log('✓', m)

const ctx = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
})
try {
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
  const id = new URL(sw.url()).host
  log(`extension loaded (${id.slice(0, 8)}…), service worker running`)
  const manifest = await sw.evaluate(() => chrome.runtime.getManifest())
  assert.equal(manifest.manifest_version, 3)

  // new tab override
  const nt = await ctx.newPage()
  await nt.goto('chrome://newtab')
  await nt.waitForSelector('.nt-input', { timeout: 8000 })
  assert.equal(await nt.title(), 'New Tab')
  assert.equal(
    await nt.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--orbit-accent').trim(),
    ),
    '#9cb4d8',
  )
  log('Orbit new tab page replaces chrome://newtab, ZERO theme applied')

  // search via the custom provider → real navigation
  await sw.evaluate(
    async (b) =>
      chrome.storage.local.set({
        prefs: { searchProvider: 'custom', customSearchUrl: b + '/search?q=%s' },
      }),
    base,
  )
  await nt.fill('.nt-input', 'SpaceX Starship')
  await Promise.all([nt.waitForURL(/\/search\?q=/), nt.press('.nt-input', 'Enter')])
  assert.equal(await nt.title(), 'Results SpaceX Starship')
  log('typing in the new tab page searches with the configured provider')

  // theme switch propagates live
  const opt = await ctx.newPage()
  await opt.goto(`chrome-extension://${id}/options.html`)
  await opt.click('button.theme-card:has-text("MARS")')
  await opt.waitForFunction(
    () =>
      getComputedStyle(document.documentElement).getPropertyValue('--orbit-accent').trim() ===
      '#c65332',
  )
  log('Settings → MARS changes the theme')

  // bookmarks grid on the new tab, pin to the side panel
  await sw.evaluate(async (b) => {
    await chrome.bookmarks.create({ parentId: '1', title: 'Orbit Docs', url: b + '/docs' })
    await chrome.bookmarks.create({ parentId: '2', title: 'Orbit Notes', url: b + '/notes' })
  }, base)
  const nt2 = await ctx.newPage()
  await nt2.goto('chrome://newtab')
  await nt2.waitForSelector('.bm-tile')
  assert.equal(await nt2.locator('.bm-tile').count(), 2)
  assert.equal(await nt2.locator('.bm-chips button').count(), 3) // All + two Chrome folders
  await nt2.locator('.bm-chips button', { hasText: 'Other bookmarks' }).click()
  assert.equal(await nt2.locator('.bm-tile').count(), 1)
  await nt2.locator('.bm-chips button', { hasText: 'All' }).click()
  log('new tab shows the Chrome bookmarks as a grid with folder filters')
  await nt2.locator('.bm-tile', { hasText: 'Orbit Docs' }).hover()
  await nt2.locator('.bm-tile', { hasText: 'Orbit Docs' }).locator('.bm-pin').click()
  await nt2.waitForSelector('.bm-pin[aria-pressed="true"]')
  const pins = await sw.evaluate(async () => (await chrome.storage.local.get('pins')).pins)
  assert.equal(pins.length, 1)
  assert.ok(pins[0].url.endsWith('/docs'))
  log('pinning a bookmark stores it for the side panel')
  await nt2.locator('.nt-engines button', { hasText: 'Bing' }).click()
  await nt2.waitForSelector('.nt-engines button[aria-pressed="true"]:has-text("Bing")')
  assert.equal(
    await sw.evaluate(async () => (await chrome.storage.local.get('prefs')).prefs.searchProvider),
    'bing',
  )
  await nt2.locator('.nt-engines button', { hasText: 'Google' }).click()
  log('Google / Bing toggle on the new tab changes the search provider')
  await sw.evaluate(
    async (b) =>
      chrome.storage.local.set({
        prefs: { searchProvider: 'custom', customSearchUrl: b + '/search?q=%s' },
      }),
    base,
  ) // back to the local test engine
  await nt2.close()

  // Spaces = tab groups, via the same command path the Orbit Bar uses
  const run = (p, type = 'cmd') =>
    opt.evaluate(
      ([type, p]) => chrome.runtime.sendMessage({ type: 'run', run: { type, payload: p } }),
      [type, p],
    )
  const page = await ctx.newPage()
  await page.goto(base + '/a')
  await run({ id: 'newSpace', arg: 'School' })
  const spaces = await sw.evaluate(async () => (await chrome.storage.local.get('spaces')).spaces)
  assert.ok(spaces?.some((s) => s.name === 'SCHOOL'))
  const groups = await sw.evaluate(() => chrome.tabGroups.query({}))
  assert.ok(groups.some((g) => g.title === 'SCHOOL'))
  log('/newspace School creates a Space and its Chrome tab group')

  // Mission Control renders the active Space's tabs
  const sp = await ctx.newPage()
  await sp.goto(`chrome-extension://${id}/sidepanel.html`)
  await sp.waitForSelector('.dot')
  assert.equal(await sp.locator('.dot').count(), 2)
  assert.ok((await sp.locator('.orbit-label', { hasText: 'SPACE / SCHOOL' }).count()) === 1)
  log('Mission Control shows both Spaces and the active one')
  await sp.locator('.dot').first().click()
  await sp.locator('.orbit-label', { hasText: 'SPACE / PERSONAL' }).waitFor()
  log('switching Space updates Mission Control')
  await sp.locator('.orbit-label', { hasText: 'PINNED' }).waitFor()
  assert.ok((await sp.locator('.tab', { hasText: 'Orbit Docs' }).count()) === 1)
  log('the pinned bookmark appears under PINNED in Mission Control')

  // suggestions
  const sug = await opt.evaluate(() =>
    chrome.runtime.sendMessage({ type: 'suggest', text: '@tabs page' }),
  )
  assert.ok(sug.some((s) => s.kind === 'tab' && s.title.startsWith('Page')))
  const calc = await opt.evaluate(() =>
    chrome.runtime.sendMessage({ type: 'suggest', text: '2+2*3' }),
  )
  assert.equal(calc[0].title, '= 8')
  const web = await opt.evaluate(() =>
    chrome.runtime.sendMessage({ type: 'suggest', text: 'github.com' }),
  )
  assert.equal(web[0].run.payload.input, 'github.com')
  log('Orbit Bar suggestions: @tabs, calculator, address')

  // injected Orbit Bar
  const web1 = await ctx.newPage()
  await web1.goto(base + '/b')
  await web1.bringToFront()
  await sw.evaluate(async () => {
    const t = (await chrome.tabs.query({})).find((x) => x.url?.endsWith('/b'))
    await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['assets/bar.js'] })
  })
  await web1.waitForSelector('#orbit-bar-host', { state: 'attached' })
  await web1.keyboard.type('hello world')
  await Promise.all([web1.waitForURL(/\/search\?q=hello%20world/), web1.keyboard.press('Enter')])
  log('Orbit Bar overlay opens on a page, types and runs a search')
  await web1.bringToFront()
  await sw.evaluate(async () => {
    const t = (await chrome.tabs.query({})).find((x) => x.url?.includes('hello%20world'))
    await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['assets/bar.js'] })
  })
  await web1.waitForSelector('#orbit-bar-host', { state: 'attached' })
  await web1.keyboard.press('Escape')
  await web1.waitForSelector('#orbit-bar-host', { state: 'detached' })
  log('Escape closes the Orbit Bar')

  console.log('\nALL EXTENSION CHECKS PASSED')
} catch (e) {
  console.error('\nFAILED:', e)
  process.exitCode = 1
} finally {
  await ctx.close().catch(() => {})
  server.close()
  fs.rmSync(tmp, { recursive: true, force: true })
}
