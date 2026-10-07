import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export interface ImportedBookmark {
  title: string
  url: string
  folder: string
}

const BROWSERS: Record<string, { label: string; mac: string; win: string; linux: string }> = {
  chrome: {
    label: 'Chrome',
    mac: 'Google/Chrome',
    win: 'Google/Chrome/User Data',
    linux: 'google-chrome',
  },
  edge: {
    label: 'Edge',
    mac: 'Microsoft Edge',
    win: 'Microsoft/Edge/User Data',
    linux: 'microsoft-edge',
  },
  brave: {
    label: 'Brave',
    mac: 'BraveSoftware/Brave-Browser',
    win: 'BraveSoftware/Brave-Browser/User Data',
    linux: 'BraveSoftware/Brave-Browser',
  },
}
export const isBrowser = (id: string) => Object.hasOwn(BROWSERS, id)

/** Only ever reads the fixed "Default" profile bookmarks file of a known browser, when the user asks. */
function bookmarksPath(id: string): string {
  if (process.env.ORBIT_TEST && process.env.ORBIT_BOOKMARKS_FILE)
    return process.env.ORBIT_BOOKMARKS_FILE
  const b = BROWSERS[id]
  const base =
    process.platform === 'darwin'
      ? path.join(app.getPath('appData'), b.mac)
      : process.platform === 'win32'
        ? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData/Local'), b.win)
        : path.join(os.homedir(), '.config', b.linux)
  return path.join(base, 'Default', 'Bookmarks')
}

export function readBookmarks(id: string): { label: string; items: ImportedBookmark[] } | null {
  let json: any
  try {
    const file = bookmarksPath(id)
    if (fs.statSync(file).size > 20_000_000) return null
    json = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
  const items: ImportedBookmark[] = []
  const walk = (n: any, folder: string) => {
    if (items.length >= 5000 || !n) return
    if (n.type === 'url' && typeof n.url === 'string' && /^https?:\/\//.test(n.url)) {
      items.push({ title: String(n.name || n.url).slice(0, 200), url: n.url, folder })
    } else for (const c of n.children ?? []) walk(c, folder)
  }
  for (const root of Object.values<any>(json.roots ?? {}))
    if (root && typeof root === 'object') walk(root, String(root.name ?? '').slice(0, 40))
  return { label: BROWSERS[id].label, items }
}
