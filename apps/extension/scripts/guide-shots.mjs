// Screenshots of Chrome's own extensions page for the website's install guide → apps/website/public/guide/
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const mkTmp = () => (fs.mkdirSync('.tmp', { recursive: true }), path.resolve('.tmp'))
const tmp = fs.mkdtempSync(path.join(mkTmp(), 'orbit-guide-'))
const out = path.resolve('../website/public/guide')
fs.mkdirSync(out, { recursive: true })

/** Draw a numbered red box over a screen rectangle (page-level overlay, so it works above Chrome's shadow DOM). */
const mark = (page, box, n, pad = 6) =>
  page.evaluate(
    ([b, n, pad]) => {
      const d = document.createElement('div')
      const L = Math.max(4, b.x - pad),
        T = Math.max(4, b.y - pad)
      const W = Math.min(innerWidth - 4, b.x + b.width + pad) - L,
        H = b.height + pad * 2
      d.style.cssText = `position:fixed;left:${L}px;top:${T}px;width:${W}px;height:${H}px;border:3px solid #e5484d;border-radius:10px;z-index:99999;pointer-events:none;box-shadow:0 0 0 4000px rgba(0,0,0,.18)`
      const t = document.createElement('div')
      t.textContent = n
      t.style.cssText = `position:absolute;top:-16px;left:-16px;width:30px;height:30px;border-radius:50%;background:#e5484d;color:#fff;font:700 16px system-ui;display:grid;place-items:center`
      d.append(t)
      document.body.append(d)
    },
    [box, String(n), pad],
  )

const launch = (name, withExt) =>
  chromium.launchPersistentContext(path.join(tmp, name), {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1200, height: 620 },
    deviceScaleFactor: 2,
    args: withExt
      ? [
          `--disable-extensions-except=${path.resolve('dist')}`,
          `--load-extension=${path.resolve('dist')}`,
        ]
      : [],
  })
try {
  // Steps 1–2: a fresh Chrome with no extensions, exactly what a first-time visitor sees.
  const clean = await launch('clean', false)
  const page = await clean.newPage()
  await page.goto('chrome://extensions')
  const toggle = page.locator('#devMode')
  await toggle.waitFor()
  await mark(page, await toggle.boundingBox(), 1, 6)
  await page.screenshot({
    path: path.join(out, 'step-developer-mode.png'),
    clip: { x: 640, y: 0, width: 560, height: 130 },
  })
  await page.reload()
  await page.locator('#devMode').click()
  const load = page.locator('#loadUnpacked')
  await load.waitFor({ state: 'visible' })
  await new Promise((r) => setTimeout(r, 400))
  await mark(page, await load.boundingBox(), 2, 8)
  await page.screenshot({
    path: path.join(out, 'step-load-unpacked.png'),
    clip: { x: 0, y: 0, width: 640, height: 150 },
  })
  await clean.close()

  // Step 3: the extension loaded.
  const ctx = await launch('with-ext', true)
  const p3 = await ctx.newPage()
  await p3.goto('chrome://extensions')
  await p3.locator('extensions-item').first().waitFor()
  await new Promise((r) => setTimeout(r, 400))
  await mark(p3, await p3.locator('extensions-item').first().boundingBox(), 3, 6)
  await p3.screenshot({
    path: path.join(out, 'step-installed.png'),
    clip: { x: 250, y: 120, width: 560, height: 260 },
  })
  await ctx.close()
  console.log('wrote 3 screenshots to', out)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.rmSync('.tmp', { recursive: true, force: true })
}
