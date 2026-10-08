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

/**
 * Only reads bookmark files of a known browser, when the user asks. Every profile ("Default", "Profile 1", ...) is
 * checked, and both the classic `Bookmarks` file and `AccountBookmarks` (where Chrome keeps the bookmarks of a signed-in
 * Google account) are used.
 */
function bookmarkFiles(id: string): string[] {
  if (process.env.ORBIT_TEST && process.env.ORBIT_BOOKMARKS_FILE)
    return [process.env.ORBIT_BOOKMARKS_FILE]
  const b = BROWSERS[id]
  const base =
    process.env.ORBIT_TEST && process.env.ORBIT_BOOKMARKS_DIR
      ? process.env.ORBIT_BOOKMARKS_DIR
      : process.platform === 'darwin'
        ? path.join(app.getPath('appData'), b.mac)
        : process.platform === 'win32'
          ? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData/Local'), b.win)
          : path.join(os.homedir(), '.config', b.linux)
  let profiles: string[] = []
  try {
    profiles = fs.readdirSync(base).filter((n) => /^(Default|Profile \d+)$/.test(n))
  } catch {
    return []
  }
  const files: string[] = []
  for (const p of profiles)
    for (const f of ['Bookmarks', 'AccountBookmarks']) {
      const file = path.join(base, p, f)
      if (fs.existsSync(file)) files.push(file)
    }
  return files
}

const MAX_FILE = 20_000_000
const FOLDER_MAX = 80
const join = (path: string, name: unknown) =>
  [path, String(name ?? '').trim()].filter(Boolean).join(' / ').slice(0, FOLDER_MAX)
/** Walks Chrome's JSON tree and keeps every bookmark's full folder path ("Work / Docs"). */
function collector(items: ImportedBookmark[], seen: Set<string>) {
  const walk = (n: any, path: string) => {
    if (items.length >= 5000 || !n) return
    if (n.type === 'url') {
      if (typeof n.url !== 'string' || !/^https?:\/\//.test(n.url) || seen.has(n.url)) return
      seen.add(n.url)
      items.push({ title: String(n.name || n.url).slice(0, 200), url: n.url, folder: path })
    } else
      for (const c of n.children ?? []) walk(c, c?.type === 'folder' ? join(path, c.name) : path)
  }
  // "Bookmarks bar" is the top level, so its folders show up directly; the other roots keep their own name
  return (json: any) => {
    for (const [key, root] of Object.entries<any>(json?.roots ?? {}))
      if (root && typeof root === 'object' && Array.isArray(root.children))
        walk(root, key === 'bookmark_bar' ? '' : join('', root.name))
  }
}

export function readBookmarks(id: string): { label: string; items: ImportedBookmark[] } | null {
  const items: ImportedBookmark[] = []
  const add = collector(items, new Set())
  let found = false
  for (const file of bookmarkFiles(id)) {
    try {
      if (fs.statSync(file).size > MAX_FILE) continue
      add(JSON.parse(fs.readFileSync(file, 'utf8')))
      found = true
    } catch {
      continue
    }
  }
  return found ? { label: BROWSERS[id].label, items } : null
}

const decode = (t: string) =>
  t
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')

const TOP = /^(bookmarks (bar|toolbar|menu)|favou?rites bar)$/i
/** "Bookmarks bar" is the top level, so the folder path starts below it. */
const folderOf = (stack: string[]) => {
  const names = stack.filter(Boolean)
  if (names.length && TOP.test(names[0])) names.shift()
  return names.join(' / ').slice(0, FOLDER_MAX)
}

/** Reads the HTML bookmarks file every browser can export ("Export bookmarks"). Only http(s) links are kept. */
export function parseBookmarksHtml(html: string): ImportedBookmark[] {
  const items: ImportedBookmark[] = []
  const seen = new Set<string>()
  const stack: string[] = []
  let pending = ''
  const re =
    /<H3[^>]*>([\s\S]*?)<\/H3>|<DL[^>]*>|<\/DL>|<A\s[^>]*?HREF\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/A>/gi
  for (let m = re.exec(html); m && items.length < 5000; m = re.exec(html)) {
    const tag = m[0].slice(0, 3).toUpperCase()
    if (tag === '<H3') pending = decode(m[1]).trim()
    else if (tag === '<DL') {
      stack.push(pending)
      pending = ''
    } else if (tag === '</D') stack.pop()
    else {
      const url = decode(m[2]).trim()
      if (!/^https?:\/\//.test(url) || seen.has(url)) continue
      seen.add(url)
      items.push({
        title: (decode(m[3]).trim() || url).slice(0, 200),
        url,
        folder: folderOf(stack),
      })
    }
  }
  return items
}

/** A file the person picked: Chrome's own `Bookmarks` / `AccountBookmarks` (JSON) or an exported .html file. */
export function readBookmarksFile(file: string): ImportedBookmark[] | null {
  try {
    if (fs.statSync(file).size > MAX_FILE) return null
    const text = fs.readFileSync(file, 'utf8')
    if (text.trimStart().startsWith('{')) {
      const items: ImportedBookmark[] = []
      collector(items, new Set())(JSON.parse(text))
      return items
    }
    return parseBookmarksHtml(text)
  } catch {
    return null
  }
}
