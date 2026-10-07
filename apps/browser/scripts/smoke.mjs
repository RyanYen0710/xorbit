// End-to-end check of the MVP acceptance flow against the built app (run `pnpm build` first).
// Uses a local HTTP server so it needs no network. Launches Electron through playwright-core.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

// scratch files stay inside the project (git-ignored), not in the system temp folder
const mkTmp = () => (fs.mkdirSync('.tmp', { recursive: true }), path.resolve('.tmp'))
const tmp = fs.mkdtempSync(path.join(mkTmp(), 'orbit-smoke-'))
const dl = path.join(tmp, 'downloads')
fs.mkdirSync(dl)
// A Chrome-format bookmarks file for the import test (the app only reads it because ORBIT_TEST is set).
const bm = path.join(tmp, 'Bookmarks')
fs.writeFileSync(
  bm,
  JSON.stringify({
    roots: {
      bookmark_bar: {
        name: 'Bookmarks bar',
        type: 'folder',
        children: [
          { type: 'url', name: 'Alpha', url: 'https://alpha.example/' },
          {
            type: 'folder',
            name: 'Sub',
            children: [{ type: 'url', name: 'Beta', url: 'https://beta.example/x' }],
          },
          { type: 'url', name: 'Evil', url: 'javascript:alert(1)' },
        ],
      },
      other: { name: 'Other bookmarks', type: 'folder', children: [] },
    },
  }),
)
process.env.ORBIT_BOOKMARKS_FILE = bm

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  if (u.pathname === '/file.bin') {
    res.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment; filename="orbit-test.bin"',
    })
    return res.end(Buffer.alloc(200_000, 7))
  }
  if (u.pathname === '/login' || u.pathname === '/pay') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    return res.end(
      u.pathname === '/login'
        ? `<!doctype html><title>Login</title><form id="f" action="/x" method="post"><input id="u" type="text" name="u"><input id="p" type="password" name="p"><button>Go</button></form><script>f.addEventListener('submit',e=>e.preventDefault())</script>`
        : `<!doctype html><title>Pay</title><form id="f" action="/x" method="post"><input id="cn" autocomplete="cc-name"><input id="num" autocomplete="cc-number"><input id="exp" autocomplete="cc-exp"><input id="csc" autocomplete="cc-csc"><button>Pay</button></form><script>f.addEventListener('submit',e=>e.preventDefault())</script>`,
    )
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

  const tabsBefore = (await state()).tabs.length
  await act('openInternal', { page: 'settings' })
  await until(async () => (await tabInfo()).title === 'Settings', 'settings page')
  assert.equal((await state()).tabs.length, tabsBefore) // opened in place, no new tab
  const h = await W(
    `return w.activeTab.view.webContents.executeJavaScript("document.querySelector('.sec-title')?.textContent")`,
  )
  assert.equal(h, 'General')
  log('Settings opens in the current tab (no new tab)')
  for (const [section, title] of [
    ['downloads', 'Downloads'],
    ['history', 'History'],
    ['pins', 'Pins & Bookmarks'],
  ]) {
    await act('openInternal', { page: 'settings', section })
    await until(
      () =>
        W(
          `return w.activeTab.view.webContents.executeJavaScript("document.querySelector('.sec-title')?.textContent")`,
        ).then((t) => t === title),
      `settings section ${title}`,
    )
  }
  assert.equal((await state()).tabs.length, tabsBefore)
  log('Downloads, History and Pins are sections inside Settings (still no new tabs)')

  // switching sections must be an in-page change: same document (a marker survives), no loading state, no reload
  const secTitle = () =>
    W(
      `return w.activeTab.view.webContents.executeJavaScript("document.querySelector('.sec-title')?.textContent")`,
    )
  await W(`return w.activeTab.view.webContents.executeJavaScript("window.__keep = 42")`)
  for (const [section, title] of [
    ['history', 'History'],
    ['pins', 'Pins & Bookmarks'],
    ['downloads', 'Downloads'],
    ['privacy', 'Privacy'],
  ]) {
    await act('openInternal', { page: 'settings', section })
    await until(() => secTitle().then((t) => t === title), `in-page switch to ${title}`)
    assert.equal(
      await W(`return w.activeTab.view.webContents.executeJavaScript("window.__keep")`),
      42,
    )
    const st = await state()
    assert.equal(st.tabs.find((t) => t.id === st.activeTabId).loading, false) // built-in pages never show a spinner
  }
  log('switching Downloads / History / Pins / Privacy is an in-page change: no reload, so no flash')
  const pinsBefore = (await state()).pins.length
  assert.match(
    await act('importBookmarks', { browser: 'chrome' }),
    /Imported 2 bookmarks from Chrome/,
  )
  assert.match(await act('importBookmarks', { browser: 'chrome' }), /No new bookmarks/)
  assert.equal((await state()).pins.length, pinsBefore + 2) // javascript: bookmark skipped
  assert.equal(await act('addBookmark', { url: 'example.com/page', title: 'Ex' }), 'Added')
  assert.equal(await act('addBookmark', { url: 'example.com/page' }), 'Already bookmarked')
  assert.match(await act('addBookmark', { url: 'javascript:alert(1)' }), /doesn.t look like/)
  assert.ok((await state()).pins.every((p) => /^https?:/.test(p.url)))
  log(
    'bookmarks: import from a browser file (unsafe URLs skipped), add by address, duplicates refused',
  )

  // ── password + card vault ──
  const page = (js) => W(`return w.activeTab.view.webContents.executeJavaScript(arg)`, js)
  const goTo = async (url, title) => {
    await act('navigate', { url })
    await until(
      async () => (await tabInfo()).title === title && !(await tabInfo()).loading,
      'load ' + title,
    )
  }
  assert.equal(await W('return o.vault.protection().ok'), true)
  await goTo(base + '/login', 'Login')
  await page(`u.value='ryan@example.com'; p.value='correct horse battery'; f.requestSubmit()`)
  await until(
    () => W(`return o.vault.loginsFor(arg).length === 1`, base),
    'login saved after submit',
  )
  const saved = await W(`return o.vault.loginsFor(arg)[0]`, base)
  assert.equal(saved.username, 'ryan@example.com')
  assert.equal(await W(`return o.vault.getLogin(arg).password`, saved.id), 'correct horse battery')
  const vaultBytes = fs.readFileSync(path.join(tmp, 'user', 'vault.bin'))
  assert.ok(
    !vaultBytes.includes('correct horse') &&
      !vaultBytes.includes('ryan@example.com') &&
      !vaultBytes.includes('127.0.0.1'),
  )
  log(
    'submitting a login form saves it; the vault file on disk contains no readable site, username or password',
  )

  await goTo(base + '/login', 'Login')
  await W(`delete globalThis.__orbitMenu; return 1`)
  await page(`u.focus(); u.blur()`)
  await new Promise((r) => setTimeout(r, 700))
  assert.equal(await W(`return !!globalThis.__orbitMenu`), false) // scripted focus is ignored
  // a genuine mouse click into the box (script-driven focus is deliberately ignored by the page script)
  const r = JSON.parse(await page(`JSON.stringify(u.getBoundingClientRect())`))
  await W(
    `const wc = w.activeTab.view.webContents; wc.focus(); const x = Math.round(arg.x + arg.width / 2), y = Math.round(arg.y + arg.height / 2);
     wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 }); wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 }); return 1`,
    r,
  )
  await until(() => W(`return !!globalThis.__orbitMenu`), 'fill menu requested')
  assert.deepEqual((await W(`return globalThis.__orbitMenu`)).labels.slice(0, 1), [
    'ryan@example.com',
  ])
  assert.equal(await W(`return o.fillLogin(w.activeTab.view.webContents, arg)`, saved.id), true)
  await until(async () => (await page(`p.value`)) === 'correct horse battery', 'password filled')
  assert.equal(await page(`u.value`), 'ryan@example.com')
  log('focusing the username box offers the saved login; choosing it fills username and password')

  await goTo(base.replace('127.0.0.1', 'localhost') + '/login', 'Login')
  assert.equal(await W(`return o.fillLogin(w.activeTab.view.webContents, arg)`, saved.id), false) // different origin → refused
  assert.equal(await page(`p.value`), '')
  log('a saved login is refused on any other origin')

  await W(`const p = new o.OrbitWindow({ private: true }); globalThis.__p2 = p; return 1`)
  await until(() => W(`return globalThis.__p2.tabs.length > 0`), 'private tab 2')
  await W(`globalThis.__p2.navigate(globalThis.__p2.activeTab, arg); return 1`, base + '/login')
  await until(() => W(`return globalThis.__p2.activeTab.title === 'Login'`), 'private login page')
  await W(
    `return globalThis.__p2.activeTab.view.webContents.executeJavaScript("u.value='priv@example.com'; p.value='secret-private'; f.requestSubmit()")`,
  )
  await new Promise((r) => setTimeout(r, 1500))
  assert.equal(await W(`return o.vault.loginsFor(arg).length`, base), 1) // nothing new saved from the private window
  await W(`globalThis.__p2.win.close(); return 1`)
  log('private windows never offer to save passwords')

  assert.match(
    await W(`return o.vault.addCard('Ryan', '1234 5678 9012 3456', 4, 2030)`),
    /isn.t valid/,
  )
  assert.equal(await W(`return o.vault.addCard('Ryan Y', '4242 4242 4242 4242', 4, 2030)`), '')
  const card = (await W(`return o.vault.listCards()`))[0]
  assert.deepEqual([card.brand, card.last4], ['Visa', '4242'])
  assert.ok(!('number' in card))
  await goTo(base + '/pay', 'Pay')
  await W(`return o.fillCard(w.activeTab.view.webContents, arg)`, card.id)
  await until(async () => (await page(`num.value`)) === '4242424242424242', 'card filled')
  assert.equal(await page(`exp.value`), '04/30')
  assert.equal(await page(`csc.value`), '') // the security code is never filled or stored
  await page(
    `cn.value='New Person'; num.value='5555 5555 5555 4444'; exp.value='11/29'; csc.value='123'; f.requestSubmit()`,
  )
  await until(() => W(`return o.vault.listCards().length === 2`), 'second card saved after submit')
  const raw = await W(`return JSON.stringify(o.vault.getCard(o.vault.listCards()[1].id))`)
  assert.ok(!raw.includes('123"') && !/csc|cvv|cvc/i.test(raw))
  const vault2 = fs.readFileSync(path.join(tmp, 'user', 'vault.bin'))
  assert.ok(!vault2.includes('4242424242424242') && !vault2.includes('5555555555554444'))
  log(
    'cards: Luhn check, masked list, fill without security code, saved on submit, encrypted at rest',
  )

  await act('openInternal', { page: 'settings', section: 'passwords' })
  await until(
    () =>
      W(
        `return w.activeTab.view.webContents.executeJavaScript("document.querySelector('.vrow .vsite')?.textContent")`,
      ).then((t) => t === '127.0.0.1:' + new URL(base).port),
    'passwords list in settings',
  )
  log('Settings → Passwords lists saved logins')
  assert.equal((await state()).railExpanded, true)
  log('sidebar shows tab names by default')

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
  // X Orbit's own confirmation box and pop-up menu (no system dialogs), driven through the real overlay page
  {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const click = (sel) =>
      W(
        `return w.overlay.webContents.executeJavaScript(${JSON.stringify(`document.querySelector(${JSON.stringify(sel)}).click()`)})`,
      )
    await W(
      `globalThis.__d = w.confirm({ title: 'Delete all history?', message: 'Gone for good.', checkbox: 'Remember', buttons: [{ label: 'Cancel', value: 'cancel', kind: 'ghost' }, { label: 'Delete', value: 'ok', kind: 'danger' }] }); return 1`,
    )
    await until(async () => (await state()).overlay.mode === 'dialog', 'dialog shown')
    await sleep(150)
    assert.equal(
      await W(
        `return w.overlay.webContents.executeJavaScript("document.querySelector('.dlg-title').textContent + '|' + document.activeElement.textContent")`,
      ),
      'Delete all history?|Cancel', // a destructive question starts on the safe button
    )
    await click('.dlg-actions .btn[data-kind="danger"]')
    assert.deepEqual(await W(`return await globalThis.__d`), { value: 'ok', checked: false })
    await until(async () => (await state()).overlay.mode === 'compact', 'dialog closed')
    await W(
      `globalThis.__d = w.confirm({ title: 'Allow?', message: '', buttons: [{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes', kind: 'primary' }] }); return 1`,
    )
    await until(async () => (await state()).overlay.mode === 'dialog', 'second dialog shown')
    await sleep(200)
    await W(
      `return w.overlay.webContents.executeJavaScript("document.querySelector('.dlg').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")`,
    )
    assert.equal((await W(`return await globalThis.__d`)).value, null) // Esc cancels
    log('confirmation boxes are X Orbit overlays: safe button focused, buttons answer, Esc cancels')

    await W(
      `globalThis.__m = ''; w.popup([{ label: 'Alpha', click: () => (globalThis.__m += 'A') }, { type: 'separator' }, { label: 'More', submenu: [{ label: 'Beta', click: () => (globalThis.__m += 'B') }] }, { label: 'Off', enabled: false }], { x: 100000, y: 100000 }); return 1`,
    )
    await until(async () => (await state()).overlay.mode === 'menu', 'menu shown')
    await sleep(150)
    const inside = await W(
      `return w.overlay.webContents.executeJavaScript("(() => { const r = document.querySelector('.pm').getBoundingClientRect(); return r.right <= innerWidth && r.bottom <= innerHeight && r.left >= 0 && r.top >= 0 })()")`,
    )
    assert.equal(inside, true) // a menu asked for far off-screen is pulled back inside the window
    await click('.pm-item:nth-of-type(1)')
    await until(async () => (await state()).overlay.mode === 'compact', 'menu closed')
    assert.equal(await W(`return globalThis.__m`), 'A')
    await W(
      `w.popup([{ label: 'More', submenu: [{ label: 'Beta', click: () => (globalThis.__m += 'B') }] }], { x: 40, y: 40 }); return 1`,
    )
    await until(async () => (await state()).overlay.mode === 'menu', 'submenu menu shown')
    await sleep(100)
    await click('.pm-item')
    await sleep(100)
    await W(
      `return w.overlay.webContents.executeJavaScript("[...document.querySelectorAll('.pm-item')].find(b => b.textContent === 'Beta').click()")`,
    )
    await until(async () => (await W(`return globalThis.__m`)) === 'AB', 'submenu item ran')
    log('pop-up menus are X Orbit overlays: items, submenus and off-screen clamping work')
  }

  const leaked = await W(
    `const t = w.tabs.find(t => t.url.startsWith('http') && t.view); return t.view.webContents.executeJavaScript('typeof window.orbit')`,
  )
  assert.equal(leaked, 'undefined')
  log('web pages have no window.orbit bridge')

  const sessionTabs = (await state()).tabs.length
  const activeSpace = (await state()).activeSpaceId
  const pinCountAtQuit = (await state()).pins.length
  await app.quit()
  app = await launch()
  await until(async () => (await state()).tabs.length > 0, 'restored tabs')
  s = await state()
  assert.equal(s.tabs.length, sessionTabs)
  assert.equal(s.activeSpaceId, activeSpace)
  assert.equal(s.settings.themeId, 'mars')
  assert.equal(s.pins.length, pinCountAtQuit)
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
