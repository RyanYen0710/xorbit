import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  DownloadItem,
  HistoryEntry,
  PermissionKey,
  PermissionValue,
  Pin,
  Settings,
  Space,
  Theme,
} from '@orbit/types'

export const uid = () => randomUUID().slice(0, 8)

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  restoreSession: true,
  homepage: '',
  searchProvider: 'google',
  customSearchUrl: '',
  orbitSearchUrl: process.env.ORBIT_SEARCH_URL || 'http://localhost:4400/orbit-search',
  themeId: 'zero',
  appearance: 'theme',
  archiveAfterHours: 24,
  railPosition: 'left',
  railWidth: 264,
  animations: true,
  compact: false,
  orbitBar: true,
  blockThirdPartyCookies: false,
  javascript: true,
  popups: 'allow',
  autoplay: false,
  permissionDefaults: {
    camera: 'ask',
    microphone: 'ask',
    geolocation: 'ask',
    notifications: 'ask',
  },
  askDownload: false,
  autoUpdate: true,
  channel: 'beta',
}

export interface SavedTab {
  id: string
  spaceId: string
  url: string
  title: string
  favicon: string
  lastActive: number
  archived: boolean
}
export interface Persisted {
  settings: Settings
  spaces: Space[]
  pins: Pin[]
  customThemes: Theme[]
  downloads: DownloadItem[]
  sitePerms: Record<string, Partial<Record<PermissionKey, PermissionValue>>>
  session: { tabs: SavedTab[]; activeTabId: string | null; activeSpaceId: string } | null
  bounds: { x?: number; y?: number; width: number; height: number; maximized: boolean }
}

// ponytail: JSON files with atomic debounced writes instead of SQLite — no native module to rebuild
// per Electron version. Swap in better-sqlite3 behind this same `db`/`history` surface if history grows past ~100k rows.
class JsonFile<T extends object> {
  data: T
  private file: string
  private timer?: NodeJS.Timeout
  constructor(name: string, defaults: T) {
    this.file = path.join(app.getPath('userData'), name)
    let loaded: Partial<T> = {}
    try {
      loaded = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    } catch {
      /* first run or corrupt → defaults */
    }
    this.data = { ...defaults, ...loaded }
  }
  save() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), 400)
  }
  flush() {
    clearTimeout(this.timer)
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.data))
      fs.renameSync(this.file + '.tmp', this.file)
    } catch (e) {
      console.error('[store] write failed', e)
    }
  }
}

export const DEFAULT_SPACE: Space = {
  id: 'personal',
  name: 'PERSONAL',
  icon: 'P',
  color: '#9cb4d8',
  container: false,
}

let _db: JsonFile<Persisted>
let _history: JsonFile<{ items: HistoryEntry[] }>

export function initStore() {
  _db = new JsonFile<Persisted>('state.json', {
    settings: DEFAULT_SETTINGS,
    spaces: [DEFAULT_SPACE],
    pins: [],
    customThemes: [],
    downloads: [],
    sitePerms: {},
    session: null,
    bounds: { width: 1360, height: 860, maximized: false },
  })
  const d = _db.data
  d.settings = {
    ...DEFAULT_SETTINGS,
    ...d.settings,
    permissionDefaults: {
      ...DEFAULT_SETTINGS.permissionDefaults,
      ...d.settings?.permissionDefaults,
    },
  }
  if (!d.spaces?.length) d.spaces = [DEFAULT_SPACE]
  // anything that was mid-download when we last quit did not finish
  for (const x of d.downloads)
    if (x.state === 'progressing' || x.state === 'paused') x.state = 'failed'
  _history = new JsonFile('history.json', { items: [] })
}

export const db = {
  get data() {
    return _db.data
  },
  save: () => _db.save(),
  flush: () => _db.flush(),
}
export const history = {
  get items() {
    return _history.data.items
  },
  save: () => _history.save(),
  flush: () => _history.flush(),
}
