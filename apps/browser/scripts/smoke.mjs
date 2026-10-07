// End-to-end check of the MVP acceptance flow against the built app (run `pnpm build` first).
// Uses a local HTTP server so it needs no network. Launches Electron through playwright-core.
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-smoke-'))
const dl = path.join(tmp, 'downloads')
fs.mkdirSync(dl)

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  if (u.pathname === '/file.bin') {
    res.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment; filename="orbit-test.bin"',
    })
    return res.end(Buffer.alloc(200_000, 7))
  }
  res.writeHead(200, { 'content-type': 'text/html' })
  res.end(
    `<!doctype html><title>${u.pathname === '/search' ? 'Results ' + u.searchParams.get('q') : 'Hello Orbit ' + u.pathname}</title><h1>page ${u.pathname}</h1><a href="/second">second</a>`,
  )
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

import { launch as start, until } from './harness.mjs'
const log = (m) => console.log('✓', m)
const launch = () => start({ userData: path.join(tmp, 'user'), downloads: dl })
let app = await launch()
const { W } = app
const state = () => app.state()
const act = (...a) => app.act(...a)
const tabInfo = async () => {
  const s = await state()
  return s.tabs.find((t) => t.id === s.activeTabId)
}

try {
  await until(async () => (await state()).tabs.length > 0, 'first tab')
  let s = await state()
  assert.equal(s.tabs[0].url, 'orbit://welcome')
  log('first run opens the welcome page')
  await until(async () => (await tabInfo()).title === 'Welcome', 'welcome title')
  await act('finishOnboarding')
  await until(async () => (await tabInfo()).url === 'orbit://newtab', 'newtab after onboarding')
  log('onboarding finishes on the New Tab page')

  await act('newTab')
  await act('navigate', { input: `127.0.0.1:${new URL(base).port}` })
  await until(async () => (await tabInfo()).title === 'Hello Orbit /', 'page load')
  log('typed address loads a real page over HTTP')

  await act('newTab')
  await act('setSetting', { key: 'searchProvider', value: 'custom' })
  await act('setSetting', { key: 'customSearchUrl', value: base + '/search?q=%s' })
  await act('navigate', { input: 'SpaceX Starship' })
  await until(async () => (await tabInfo()).title === 'Results SpaceX Starship', 'search nav')
  await act('setSetting', { key: 'searchProvider', value: 'google' })
  log('Orbit Bar input becomes a search through the configured provider')

  await act('navigate', { url: base + '/a' })
  await until(async () => (await tabInfo()).title === 'Hello Orbit /a', 'nav a')
  await act('navigate', { url: base + '/b' })
  await until(async () => (await tabInfo()).title === 'Hello Orbit /b', 'nav b')
  await act('back')
  await until(async () => (await tabInfo()).title === 'Hello Orbit /a', 'back')
  assert.ok((await tabInfo()).canGoForward)
  await act('forward')
  await until(async () => (await tabInfo()).title === 'Hello Orbit /b', 'forward')
  await act('reload')
  await until(async () => !(await tabInfo()).loading, 'reload settle')
  log('back / forward / reload')

  await act('pinPage')
  s = await state()
  assert.equal(s.pins.length, 1)
  assert.equal(s.pins[0].url, base + '/b')
  log('pin current page')
  await act('cmd', { id: 'bookmarkPage' })
  s = await state()
  assert.equal(s.pins.length, 0) // same page again → toggles the pin off
  await act('pinPage')
  s = await state()
  assert.equal(s.pins.length, 1)
  const pinId = s.pins[0].id
  await act('favoritePin', { id: pinId })
  assert.equal((await state()).pins[0].favorite, false) // stays a bookmark, leaves the sidebar
  await act('favoritePin', { id: pinId })
  assert.equal((await state()).pins[0].favorite, true)
  log('bookmark grid data: pin toggles, favorite flag moves a bookmark in/out of the sidebar')

  await act('createSpace', { name: 'School' })
  s = await state()
  const school = s.spaces.find((x) => x.name === 'SCHOOL')
  assert.ok(school)
  await act('switchSpace', { id: s.spaces[0].id })
  s = await state()
  const tabId = s.tabs.find((t) => t.url === base + '/b').id
  await act('moveTabToSpace', { id: tabId, spaceId: school.id })
  s = await state()
  assert.equal(s.tabs.find((t) => t.id === tabId).spaceId, school.id)
  log('create Space SCHOOL and move a tab into it')

  await act('setTheme', { id: 'mars' })
  const accent = await until(
    () =>
      W(
        `return w.chrome.webContents.executeJavaScript("getComputedStyle(document.documentElement).getPropertyValue('--orbit-accent').trim()")`,
      ).then((v) => v === '#c65332' && v),
    'theme applied',
  )
  log(`theme switched ZERO → MARS (accent ${accent})`)

  await act('switchSpace', { id: school.id })
  await act('overlay', { mode: 'bar', text: '@tabs hello' })
  const n = await until(
    () =>
      W(
        `return w.overlay.webContents.executeJavaScript("document.querySelectorAll('.omni-list li').length")`,
      ).then((c) => c > 0 && c),
    'bar suggestions',
  )
  await act('closeOverlay')
  await act('overlay', { mode: 'palette', text: '' })
  await until(
    () =>
      W(
        `return w.overlay.webContents.executeJavaScript("document.querySelectorAll('.omni-list li').length")`,
      ).then((c) => c > 5),
    'palette items',
  )
  await act('closeOverlay')
  log(`Orbit Bar (${n} tab results) and command palette render`)

  await act('newTab', { url: base + '/file.bin' })
  const done = await until(
    async () => (await state()).downloads.find((d) => d.state === 'completed'),
    'download',
    15000,
  )
  assert.ok(fs.existsSync(path.join(dl, done.filename)))
  assert.equal(fs.statSync(path.join(dl, done.filename)).size, 200_000)
  log(`download completed → ${done.filename}`)

  const hist = await W(`return o.history.items.map(h=>h.url)`)
  assert.ok(hist.some((u) => u.endsWith('/a')) && hist.some((u) => u.endsWith('/b')))
  log(`history recorded ${hist.length} visits`)

  await act('openInternal', { page: 'settings' })
  await until(async () => (await tabInfo()).title === 'Settings', 'settings page')
  const h = await W(
    `return w.activeTab.view.webContents.executeJavaScript("document.querySelector('.sec-title')?.textContent")`,
  )
  assert.equal(h, 'General')
  log('Settings opens')

  await act('splitTab')
  s = await state()
  assert.ok(s.split)
  await act('splitTab')
  assert.equal((await state()).split, null)
  await act('toggleFocus')
  assert.equal((await state()).focus, true)
  await act('toggleFocus')
  log('split view and focus mode toggle')

  // private window: separate, no history
  const before = await W('return o.history.items.length')
  await W(`const p = new o.OrbitWindow({ private: true }); globalThis.__priv = p; return 1`)
  await until(() => W('return globalThis.__priv.tabs.length > 0'), 'private tab')
  await W(`globalThis.__priv.navigate(globalThis.__priv.activeTab, arg)`, base + '/private')
  await until(
    () => W('return globalThis.__priv.activeTab.title.includes("/private")'),
    'private nav',
  )
  assert.equal(await W('return o.history.items.length'), before)
  await W('globalThis.__priv.win.close(); return 1')
  log('private window browses without writing history')

  // untrusted callers: a web page must not reach the privileged API
  const leaked = await W(
    `const t = w.tabs.find(t => t.url.startsWith('http') && t.view); return t.view.webContents.executeJavaScript('typeof window.orbit')`,
  )
  assert.equal(leaked, 'undefined')
  log('web pages have no window.orbit bridge')

  const sessionTabs = (await state()).tabs.length
  const activeSpace = (await state()).activeSpaceId
  await app.quit()
  app = await launch()
  await until(async () => (await state()).tabs.length > 0, 'restored tabs')
  s = await state()
  assert.equal(s.tabs.length, sessionTabs)
  assert.equal(s.activeSpaceId, activeSpace)
  assert.equal(s.settings.themeId, 'mars')
  assert.equal(s.pins.length, 1)
  assert.equal(s.spaces.length, 2)
  log(
    `session restored (${s.tabs.length} tabs, Space ${s.spaces.find((x) => x.id === s.activeSpaceId).name}, theme mars)`,
  )
  console.log('\nALL CHECKS PASSED')
} catch (e) {
  console.error('\nFAILED:', e)
  process.exitCode = 1
} finally {
  await app.quit().catch(() => {})
  server.close()
  fs.rmSync(tmp, { recursive: true, force: true })
}
