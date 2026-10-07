import * as electron from 'electron'
import { app, session } from 'electron'
import { initStore, db, history } from './store'
import { registerScheme } from './internal'
import { setupSession, mainSession } from './session'
import { OrbitWindow } from './window'
import { windows, focusedWindow, byContents } from './registry'
import { initIpc } from './ipc'
import { buildMenu } from './menu'
import { initUpdater } from './updater'
import { initAccount } from './account'
import { resolveInput } from '@orbit/search'
import { initAutofill, fillLogin, fillCard } from './autofill'
import * as vault from './vault'

app.setName('X Orbit')
if (process.env.ORBIT_USER_DATA) app.setPath('userData', process.env.ORBIT_USER_DATA)
if (process.env.ORBIT_DOWNLOADS) app.setPath('downloads', process.env.ORBIT_DOWNLOADS)
registerScheme()
// Tests must never touch the real OS keychain (it would pop a permission dialog).
if (process.env.ORBIT_TEST) app.commandLine.appendSwitch('use-mock-keychain')

if (!app.requestSingleInstanceLock() && !process.env.ORBIT_USER_DATA) app.quit()

const openUrl = (url: string) => {
  const w = focusedWindow()
  const r = resolveInput(url, {
    provider: db.data.settings.searchProvider,
    customUrl: '',
    orbitUrl: db.data.settings.orbitSearchUrl,
  })
  if (!r || r.kind !== 'url' || !/^https?:/.test(r.url)) return
  if (w) {
    w.newTab({ url: r.url })
    w.win.show()
    w.win.focus()
  } else new OrbitWindow()
}
app.on('open-url', (e, url) => {
  e.preventDefault()
  if (app.isReady()) openUrl(url)
})
app.on('second-instance', (_e, argv) => {
  const w = focusedWindow()
  if (w?.win.isMinimized()) w.win.restore()
  w?.win.focus()
  argv.filter((a) => /^https?:\/\//.test(a)).forEach(openUrl)
})

// Defence in depth for *every* webContents we or a page create.
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', (e) => e.preventDefault())
})

void app.whenReady().then(() => {
  initStore()
  setupSession(session.defaultSession)
  setupSession(mainSession())
  buildMenu()
  initIpc()
  initAutofill()
  initUpdater()
  void initAccount()
  new OrbitWindow()
  setInterval(() => windows.forEach((w) => w.sweep()), 60_000)
  app.on('activate', () => {
    if (!windows.size) new OrbitWindow()
  })
  if (process.env.ORBIT_TEST)
    (globalThis as any).__orbit = {
      windows,
      db,
      history,
      byContents,
      OrbitWindow,
      app,
      electron,
      vault,
      fillLogin,
      fillCard,
    }
})

app.on('before-quit', () => {
  windows.forEach((w) => w.flushSession())
  db.flush()
  history.flush()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
