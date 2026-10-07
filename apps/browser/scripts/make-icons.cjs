// Rasterises assets/branding/app-icon.svg → PNGs. electron-builder derives .icns/.ico from resources/icon.png.
// Run: pnpm --filter @orbit/browser icons
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../../..')
const svg = fs.readFileSync(path.join(root, 'assets/branding/app-icon.svg'), 'utf8')
// Other sizes: `sips -z 256 256 resources/icon.png --out assets/icons/icon-256.png` (macOS) — see docs/distribution.md.
const targets = [[1024, path.join(__dirname, '../resources/icon.png')]]

app.whenReady().then(async () => {
  app.dock?.hide()
  for (const [size, file] of targets) {
    const win = new BrowserWindow({
      show: false,
      width: size,
      height: size,
      useContentSize: true,
      transparent: true,
      frame: false,
      webPreferences: { offscreen: true },
    })
    await win.loadURL(
      'data:text/html,' +
        encodeURIComponent(
          `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
        ),
    )
    await new Promise((r) => setTimeout(r, 300))
    const img = await win.webContents.capturePage()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, img.resize({ width: size, height: size }).toPNG())
    win.destroy()
    console.log('wrote', path.relative(root, file))
  }
  app.quit()
})
