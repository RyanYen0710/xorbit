// Shared types: browser state (main → renderers) and the preload API surface.

export type SearchProviderId = 'google' | 'bing' | 'duckduckgo' | 'brave' | 'orbit' | 'custom'
export type PermissionKey = 'camera' | 'microphone' | 'geolocation' | 'notifications'
export type PermissionValue = 'allow' | 'block' | 'ask'

export interface Theme {
  id: string
  name: string
  mode: 'dark' | 'light'
  background: string
  surface: string // secondary background
  surface2: string // elevated UI
  text: string
  textSecondary: string
  muted: string
  border: string
  borderStrong: string
  accent: string
  activeTab: string
  inactiveTab: string
  sidebar: string
  orbitBar: string
  selection: string
}

export interface Space {
  id: string
  name: string
  icon: string // 1–2 chars / emoji
  color: string
  container: boolean // isolated cookie/session partition
}

export interface Pin {
  id: string
  spaceId: string
  title: string
  url: string
  favicon: string
  folder: string // '' = top level
  /** legacy (the old sidebar PINNED section); no longer used */
  favorite?: boolean
  /** shown as a tile on the New Tab page (at most 8 of these) */
  home?: boolean
}

export interface TabInfo {
  id: string
  spaceId: string
  url: string
  title: string
  favicon: string
  loading: boolean
  audible: boolean
  muted: boolean
  canGoBack: boolean
  canGoForward: boolean
  archived: boolean
  discarded: boolean
  lastActive: number
}

export type DownloadState = 'progressing' | 'paused' | 'completed' | 'cancelled' | 'failed'
export interface DownloadItem {
  id: string
  url: string
  filename: string
  savePath: string
  totalBytes: number
  receivedBytes: number
  state: DownloadState
  startedAt: number
}

export interface HistoryEntry {
  id: string
  url: string
  title: string
  visitedAt: number
}

export interface Settings {
  onboarded: boolean
  restoreSession: boolean
  homepage: string // '' = New Tab page
  searchProvider: SearchProviderId
  customSearchUrl: string // contains %s
  orbitSearchUrl: string
  themeId: string
  appearance: 'theme' | 'dark' | 'light' | 'system'
  archiveAfterHours: number // 0 = never
  railPosition: 'left' | 'right'
  railWidth: number
  animations: boolean
  compact: boolean
  orbitBar: boolean
  blockThirdPartyCookies: boolean
  javascript: boolean
  popups: 'allow' | 'block'
  autoplay: boolean
  permissionDefaults: Record<PermissionKey, PermissionValue>
  askDownload: boolean
  offerToSavePasswords: boolean
  autoUpdate: boolean
  channel: 'stable' | 'beta' | 'developer'
  bookmarksPanel: boolean // the bookmarks sidebar (on the side opposite the tabs)
}

export type OverlayMode =
  'none' | 'compact' | 'bar' | 'palette' | 'site' | 'find' | 'dialog' | 'menu' | 'update'

/** The signed-in X Orbit account (tokens stay in the main process, never here). */
export interface AccountState {
  signedIn: boolean
  loading: boolean // checking a saved sign-in at startup
  busy: boolean // a request is running
  googleWaiting: boolean // waiting for the person to finish signing in with Google in their browser
  email: string
  name: string
  verified: boolean
  providers: string[] // 'password', 'google.com'
  error: string // last problem from a background step (e.g. the Google sign-in), cleared on the next try
}

/** Where the self-updater is: drives the update card (progress bar, speed, size). */
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'uptodate'
  | 'available'
  | 'downloading'
  | 'verifying'
  | 'installing'
  | 'restarting'
  | 'unsupported'
  | 'error'
export interface UpdaterState {
  phase: UpdatePhase
  version: string
  received: number // bytes
  total: number // bytes
  speed: number // bytes per second
  message: string
  visible: boolean // show the update card
}

/** An X Orbit confirmation box (replaces the system dialog). */
export interface DialogField {
  name: string
  label: string
  value?: string
  placeholder?: string
  required?: boolean
  /** when given the field is a drop-down; '' is shown as "No folder" */
  options?: string[]
}
export interface DialogSpec {
  id: string
  title: string
  message: string
  fields?: DialogField[]
  error?: string
  checkboxChecked?: boolean
  buttons: { label: string; value: string; kind?: 'primary' | 'danger' | 'ghost' }[]
  checkbox?: string
}
/** An X Orbit pop-up menu (replaces the system context menu). */
export interface MenuEntry {
  id: string
  label: string
  disabled?: boolean
  separator?: boolean
  children?: MenuEntry[]
}
export interface MenuSpec {
  id: string
  x: number
  y: number
  items: MenuEntry[]
}

export interface UIState {
  windowId: number
  private: boolean
  platform: string
  version: string
  tabs: TabInfo[]
  activeTabId: string | null
  split: { a: string; b: string; ratio: number } | null
  spaces: Space[]
  activeSpaceId: string
  pins: Pin[]
  folders: string[] // every bookmark folder path, including empty ones
  downloads: DownloadItem[]
  settings: Settings
  theme: Theme
  customThemes: Theme[]
  railExpanded: boolean
  focus: boolean
  peek: boolean
  overlay: {
    mode: OverlayMode
    text: string
    seq: number
    dialog: DialogSpec | null
    menu: MenuSpec | null
  }
  pageRect: { x: number; y: number; width: number; height: number }
  update: string
  updater: UpdaterState
  account: AccountState
  railPx: number
  panelPx: number // width of the bookmarks sidebar right now (it glides in and out)
  topPx: number
  find: { active: number; total: number }
}

export interface Suggestion {
  id: string
  kind: 'url' | 'search' | 'tab' | 'pin' | 'history' | 'command' | 'calc'
  title: string
  sub?: string
  favicon?: string
  run: { type: string; payload: Record<string, unknown> }
}

export interface SiteInfo {
  origin: string
  host: string
  secure: boolean
  internal: boolean
  cookies: number
  perms: Record<PermissionKey, PermissionValue>
}

export interface OrbitApi {
  getState(): Promise<UIState>
  onState(cb: (s: UIState) => void): () => void
  act(type: string, payload?: Record<string, unknown>): Promise<any>
  query(type: string, payload?: Record<string, unknown>): Promise<any>
}

declare global {
  interface Window {
    orbit: OrbitApi
  }
}
