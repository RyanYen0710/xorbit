// Screenshot of the extension's new tab page with sample bookmarks → apps/website/public/shots/ext-newtab.png
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-ext-shot-'))
const ctx = await chromium.launchPersistentContext(path.join(tmp, 'p'), {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1360, height: 860 },
  deviceScaleFactor: 2,
  args: [
    `--disable-extensions-except=${path.resolve('dist')}`,
    `--load-extension=${path.resolve('dist')}`,
  ],
})
try {
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
  await sw.evaluate(async () => {
    const bar = ['Flight notes', 'Reference', 'Inbox', 'Source', 'Launch replay', 'Calendar']
    for (const t of bar)
      await chrome.bookmarks.create({
        parentId: '1',
        title: t,
        url: `https://example.com/${t.toLowerCase().replace(/\s/g, '-')}`,
      })
    for (const t of ['Reading list', 'Recipes'])
      await chrome.bookmarks.create({
        parentId: '2',
        title: t,
        url: `https://example.org/${t.toLowerCase().replace(/\s/g, '-')}`,
      })
  })
  const page = await ctx.newPage()
  await page.goto('chrome://newtab')
  await page.waitForSelector('.bm-tile')
  await page.locator('.bm-tile').nth(1).locator('.bm-pin').click({ force: true })
  await page.mouse.move(5, 5)
  await new Promise((r) => setTimeout(r, 400))
  const out = path.resolve('../website/public/shots/ext-newtab.png')
  await page.screenshot({ path: out })
  console.log('wrote', out)
} finally {
  await ctx.close()
  fs.rmSync(tmp, { recursive: true, force: true })
}
