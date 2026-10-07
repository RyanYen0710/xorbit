import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { db } from './store'
import { broadcast } from './registry'

// Updates come from GitHub Releases (see electron-builder.config.cjs). Unpackaged dev builds never check.
let status = app.isPackaged ? 'idle' : 'dev build — updates disabled'
const set = (s: string) => {
  status = s
  broadcast()
}
export const checkStatus = () => status

export function initUpdater() {
  if (!app.isPackaged) return
  const s = db.data.settings
  autoUpdater.autoDownload = s.autoUpdate
  autoUpdater.autoInstallOnAppQuit = s.autoUpdate
  autoUpdater.channel = s.channel === 'stable' ? 'latest' : s.channel === 'beta' ? 'beta' : 'alpha'
  autoUpdater.allowPrerelease = s.channel !== 'stable'
  autoUpdater.on('checking-for-update', () => set('checking…'))
  autoUpdater.on('update-available', (i) =>
    set(`update ${i.version} available${autoUpdater.autoDownload ? ' — downloading' : ''}`),
  )
  autoUpdater.on('update-not-available', () => set('up to date'))
  autoUpdater.on('update-downloaded', (i) => set(`update ${i.version} ready — restart to install`))
  autoUpdater.on('error', (e) => set(`error: ${e.message.split('\n')[0]}`))
  setTimeout(() => void checkForUpdates(), 10_000)
}

export async function checkForUpdates() {
  if (!app.isPackaged) return set('dev build — updates disabled')
  autoUpdater.autoDownload = db.data.settings.autoUpdate
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    set(`error: ${(e as Error).message.split('\n')[0]}`)
  }
}
export const downloadUpdate = () => app.isPackaged && void autoUpdater.downloadUpdate()
export const installUpdate = () => app.isPackaged && autoUpdater.quitAndInstall()
