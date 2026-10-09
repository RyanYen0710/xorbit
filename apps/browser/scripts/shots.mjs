// Captures real screenshots of the running browser for docs / the website. Usage: node scripts/shots.mjs <outDir>
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { launch, until } from './harness.mjs'

const out = path.resolve(process.argv[2] ?? 'shots')
fs.mkdirSync(out, { recursive: true })
// scratch files stay inside the project (git-ignored), not in the system temp folder
const mkTmp = () => (fs.mkdirSync('.tmp', { recursive: true }), path.resolve('.tmp'))
const tmp = fs.mkdtempSync(path.join(mkTmp(), 'orbit-shots-'))

const PAGES = {
  '/': ['Flight notes', 'Notes', 'Ascent profile, margins, open questions.'],
  '/docs': ['Reference — Orbital mechanics', 'Reference', 'Hohmann transfers and delta-v budgets.'],
  '/mail': ['Inbox', 'Mail', 'Nothing urgent.'],
  '/code': ['orbit/browser — source', 'Code', 'src/main/window.ts'],
  '/video': ['Launch replay', 'Media', 'Playback paused.'],
}
const server = http.createServer((req, res) => {
  const [title, kicker, body] = PAGES[new URL(req.url, 'http://x').pathname] ?? PAGES['/']
  res.writeHead(200, { 'content-type': 'text/html' })
  res.end(
    `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="margin:0;background:#f4f4f0;color:#0a0a0a;font:16px/1.6 system-ui"><main style="max-width:680px;margin:12vh auto;padding:0 24px"><p style="font:12px ui-monospace;letter-spacing:.08em;text-transform:uppercase;color:#777">${kicker}</p><h1 style="font-size:56px;letter-spacing:-.04em;line-height:1;margin:.2em 0">${title}</h1><p style="color:#555;font-size:20px">${body}</p></main>`,
  )
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

const app = await launch({ userData: path.join(tmp, 'user') })
// screencapture needs OS screen-recording permission, so composite each view's own pixels instead.
const shot = async (name) => {
  await new Promise((r) => setTimeout(r, 600))
  const dataUrl = await app.W(`
    const { BrowserWindow } = o.electron
    const [W, H] = w.win.getContentSize()
    const views = [w.chrome, ...[...w.mounted], ...(w.overlay.getVisible() ? [w.overlay] : [])]
    const layers = []
    for (const v of views) {
      const img = await v.webContents.capturePage()
      layers.push({ url: img.toDataURL(), b: v.getBounds() })
    }
    const off = new BrowserWindow({ show: false, width: 100, height: 100 })
    await off.loadURL('about:blank')
    const res = await off.webContents.executeJavaScript('(async (layers, W, H) => {' +
      'const c = document.createElement("canvas"); c.width = W * 2; c.height = H * 2; const g = c.getContext("2d");' +
      'for (const l of layers) { const i = new Image(); i.src = l.url; await i.decode(); g.drawImage(i, l.b.x * 2, l.b.y * 2, l.b.width * 2, l.b.height * 2) }' +
      'return c.toDataURL("image/png") })(' + JSON.stringify(layers) + ',' + W + ',' + H + ')')
    off.destroy()
    return res`)
  fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log('captured', name)
}
try {
  await app.W('w.win.setSize(1360, 860); w.win.center(); w.win.show(); w.win.focus(); return 1')
  await until(async () => (await app.state()).tabs.length > 0, 'tab')
  await app.act('finishOnboarding')
  await until(async () => (await app.tab()).url === 'orbit://newtab', 'newtab')
  const newtabId = (await app.state()).activeTabId
  await shot('newtab-empty')
  for (const p of ['/', '/docs', '/mail', '/code', '/video']) {
    await app.act('newTab', { url: base + p })
    await until(
      async () => ((await app.tab()).title ?? '') !== '' && !(await app.tab()).loading,
      'title ' + p,
    )
    await app.act('pinPage')
  }
  // pins on the new tab page are separate from bookmarks now: promote the bookmarks to home pins
  for (const pin of (await app.state()).pins) await app.act('bookmarkHome', { id: pin.id })
  await app.act('activateTab', { id: newtabId })
  await shot('newtab')
  await app.act('createSpace', { name: 'School' })
  await app.act('createSpace', { name: 'Work' })
  await app.act('switchSpace', { id: (await app.state()).spaces[0].id })
  await app.act('activateTab', {
    id: (await app.state()).tabs.find((t) => t.url.endsWith('/docs')).id,
  })
  await until(async () => (await app.tab()).title.startsWith('Reference'), 'title')
  await app.act('pinPage')
  await shot('mission-control')
  await app.act('overlay', { mode: 'bar', text: 'starship' })
  await shot('orbit-bar')
  await app.act('closeOverlay')
  await app.act('overlay', { mode: 'palette' })
  await shot('palette')
  await app.act('closeOverlay')
  await app.act('splitTab')
  await shot('split')
  await app.act('splitTab')
  await app.act('openInternal', { page: 'themes' })
  await shot('theme-studio')
  await app.act('setTheme', { id: 'mars' })
  await app.act('openInternal', { page: 'settings', section: 'downloads' })
  await shot('settings-mars')
  await app.act('setTheme', { id: 'lunar' })
  await app.act('openInternal', { page: 'newtab' })
  await shot('newtab-lunar')
  await app.act('setTheme', { id: 'zero' })
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await app.quit()
  server.close()
  fs.rmSync(tmp, { recursive: true, force: true })
}
