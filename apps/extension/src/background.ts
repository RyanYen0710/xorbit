import { PROVIDERS, calc, fuzzy, resolveInput } from '@orbit/search'
import { PRESETS, themeToCssVars } from '@orbit/themes'
import type { Suggestion } from '@orbit/types'
import {
  createSpace,
  cycleSpace,
  getActiveSpace,
  moveTabToSpace,
  spaceOf,
  switchSpace,
} from './spaces'
import {
  faviconUrl,
  getPins,
  getPrefs,
  getSpaces,
  searchCfg,
  setPins,
  setPrefs,
  themeOf,
  uid,
} from './shared'

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

// ── commands (shared by keyboard shortcuts and the Orbit Bar) ───────────────────────────────────
const win = async () => (await chrome.windows.getLastFocused()).id!
const activeTab = async () =>
  (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]

async function pinPage() {
  const t = await activeTab()
  if (!t?.url || !/^https?:/.test(t.url)) return
  const space = await getActiveSpace(t.windowId)
  const pins = await getPins()
  const ex = pins.find((p) => p.url === t.url && p.spaceId === space.id)
  await setPins(
    ex
      ? pins.filter((p) => p !== ex)
      : [...pins, { id: uid(), spaceId: space.id, title: t.title || t.url, url: t.url }],
  )
}

interface Cmd {
  id: string
  title: string
  slash?: string
  run: (arg?: string) => Promise<unknown> | unknown
}
const COMMANDS: Cmd[] = [
  {
    id: 'newTab',
    title: 'New Tab',
    run: async () => {
      const t = await chrome.tabs.create({})
      await moveTabToSpace(t.id!, (await getActiveSpace(t.windowId)).id)
    },
  },
  {
    id: 'newSpace',
    title: 'New Space',
    slash: 'newspace',
    run: async (a) => a && createSpace(await win(), a),
  },
  { id: 'nextSpace', title: 'Next Space', run: async () => cycleSpace(await win(), 1) },
  { id: 'prevSpace', title: 'Previous Space', run: async () => cycleSpace(await win(), -1) },
  {
    id: 'missionControl',
    title: 'Open Mission Control',
    slash: 'tabs',
    run: async () => chrome.sidePanel.open({ windowId: await win() }),
  },
  { id: 'pinPage', title: 'Pin Page', slash: 'pin', run: pinPage },
  {
    id: 'closeTab',
    title: 'Close Tab',
    run: async () => {
      const t = await activeTab()
      if (t) await chrome.tabs.remove(t.id!)
    },
  },
  { id: 'reopenTab', title: 'Reopen Closed Tab', run: () => chrome.sessions.restore() },
  {
    id: 'duplicateTab',
    title: 'Duplicate Tab',
    run: async () => {
      const t = await activeTab()
      if (t) await chrome.tabs.duplicate(t.id!)
    },
  },
  {
    id: 'history',
    title: 'History',
    slash: 'history',
    run: () => chrome.tabs.create({ url: 'chrome://history' }),
  },
  {
    id: 'downloads',
    title: 'Downloads',
    slash: 'downloads',
    run: () => chrome.tabs.create({ url: 'chrome://downloads' }),
  },
  {
    id: 'settings',
    title: 'Settings',
    slash: 'settings',
    run: () => chrome.runtime.openOptionsPage(),
  },
  { id: 'themes', title: 'Themes', slash: 'themes', run: () => chrome.runtime.openOptionsPage() },
  {
    id: 'setTheme',
    title: 'Theme',
    slash: 'theme',
    run: async (a) => {
      const t = [...PRESETS, ...(await getPrefs()).customThemes].find(
        (x) => x.id === a || x.name.toLowerCase().includes((a ?? '').toLowerCase()),
      )
      if (t) await setPrefs({ themeId: t.id })
    },
  },
  { id: 'switchSpace', title: 'Switch Space', run: async (a) => a && switchSpace(await win(), a) },
]
const byId = new Map(COMMANDS.map((c) => [c.id, c]))

chrome.commands.onCommand.addListener(async (c) => {
  if (c === 'open-orbit-bar') await openBar()
  else if (c === 'toggle-mission-control') await chrome.sidePanel.open({ windowId: await win() })
  else if (c === 'next-space') await cycleSpace(await win(), 1)
  else if (c === 'prev-space') await cycleSpace(await win(), -1)
})

async function openBar() {
  const t = await activeTab()
  try {
    if (!t?.id) throw new Error('no tab')
    await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['assets/bar.js'] })
  } catch {
    // chrome:// pages, the Web Store and PDFs can't be scripted — open the Orbit new tab page instead.
    await chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') + '#bar' })
  }
}

// keep new tabs inside the Space you're working in
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.groupId !== -1 || tab.openerTabId) return
  const spaces = await getSpaces()
  const cur = await getActiveSpace(tab.windowId)
  if (cur.id !== spaces[0].id) await moveTabToSpace(tab.id!, cur.id)
})

// ── suggestions for the Orbit Bar ───────────────────────────────────────────────────────────────
async function suggest(raw: string): Promise<Suggestion[]> {
  const text = raw.trim()
  const [prefs, spaces, tabs, groups, pins] = await Promise.all([
    getPrefs(),
    getSpaces(),
    chrome.tabs.query({}),
    chrome.tabGroups.query({}),
    getPins(),
  ])
  const cur = await activeTab()
  const tabItem = (t: chrome.tabs.Tab): Suggestion => ({
    id: 'tab' + t.id,
    kind: 'tab',
    title: t.title || t.url || '',
    sub: `Switch to tab · ${spaceOf(t, spaces, groups).name}`,
    favicon: t.url ? faviconUrl(t.url, 16) : undefined,
    run: { type: 'activateTab', payload: { id: t.id!, windowId: t.windowId } },
  })
  const rank = <T>(xs: T[], q: string, f: (x: T) => string) =>
    xs
      .map((x) => ({ x, s: fuzzy(q, f(x)) }))
      .filter((r) => r.s !== null)
      .sort((a, b) => b.s! - a.s!)
      .map((r) => r.x)
  const cmdItem = (c: Cmd, arg?: string, title?: string): Suggestion => ({
    id: 'cmd' + c.id + (arg ?? ''),
    kind: 'command',
    title: title ?? c.title,
    sub: c.slash ? '/' + c.slash : 'Command',
    run: { type: 'cmd', payload: { id: c.id, arg } },
  })

  const pre = /^@(tabs|history|pins)\b\s*(.*)$/i.exec(text)
  if (pre) {
    const q = pre[2],
      k = pre[1].toLowerCase()
    if (k === 'tabs')
      return rank(tabs, q, (t) => `${t.title} ${t.url}`)
        .slice(0, 12)
        .map(tabItem)
    if (k === 'pins')
      return rank(pins, q, (p) => `${p.title} ${p.url}`)
        .slice(0, 12)
        .map((p) => ({
          id: p.id,
          kind: 'pin',
          title: p.title,
          sub: p.url,
          favicon: faviconUrl(p.url, 16),
          run: { type: 'navigate', payload: { url: p.url } },
        }))
    return (await chrome.history.search({ text: q, maxResults: 12 })).map((h) => ({
      id: h.id,
      kind: 'history',
      title: h.title || h.url!,
      sub: h.url,
      favicon: faviconUrl(h.url!, 16),
      run: { type: 'navigate', payload: { url: h.url! } },
    }))
  }
  if (text.startsWith('/') || text.startsWith('>')) {
    const [name, ...rest] = text.slice(1).trim().split(/\s+/)
    const arg = rest.join(' ')
    const hits = COMMANDS.filter((c) =>
      c.slash ? c.slash.startsWith(name.toLowerCase()) : fuzzy(name, c.title) !== null,
    )
    const spaceHits = !name
      ? spaces.map((s) => ({
          id: 's' + s.id,
          kind: 'command' as const,
          title: `Switch to ${s.name}`,
          sub: 'Space',
          run: { type: 'cmd', payload: { id: 'switchSpace', arg: s.id } },
        }))
      : []
    return [
      ...hits.map((c) =>
        cmdItem(
          c,
          arg,
          c.id === 'newSpace' && arg ? `New Space “${arg.toUpperCase()}”` : undefined,
        ),
      ),
      ...spaceHits,
    ]
  }
  if (!text)
    return [
      ...tabs
        .filter((t) => t.id !== cur?.id)
        .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
        .slice(0, 6)
        .map(tabItem),
      ...COMMANDS.slice(0, 4).map((c) => cmdItem(c)),
    ]

  const out: Suggestion[] = []
  const v = calc(text)
  if (v !== null)
    out.push({
      id: 'calc',
      kind: 'calc',
      title: `= ${v}`,
      sub: 'Enter to copy',
      run: { type: 'copy', payload: { text: String(v) } },
    })
  const r = resolveInput(text, searchCfg(prefs))
  if (r)
    out.push({
      id: 'go',
      kind: r.kind,
      title: text,
      sub: r.kind === 'url' ? `Go to ${r.url}` : `Search ${PROVIDERS[prefs.searchProvider].label}`,
      run: { type: 'navigate', payload: { input: text } },
    })
  const seen = new Set(out.map((o) => o.sub))
  const add = (xs: Suggestion[]) =>
    xs.forEach((x) => {
      if (!seen.has(x.sub)) {
        seen.add(x.sub)
        out.push(x)
      }
    })
  add(
    rank(tabs, text, (t) => `${t.title} ${t.url}`)
      .slice(0, 3)
      .map(tabItem),
  )
  add(
    (await chrome.history.search({ text, maxResults: 4 })).map((h) => ({
      id: h.id,
      kind: 'history' as const,
      title: h.title || h.url!,
      sub: h.url,
      favicon: faviconUrl(h.url!, 16),
      run: { type: 'navigate', payload: { url: h.url! } },
    })),
  )
  add(
    rank(COMMANDS, text, (c) => c.title)
      .slice(0, 2)
      .map((c) => cmdItem(c)),
  )
  return out
}

async function run(
  run: { type: string; payload: Record<string, any> },
  senderTab?: chrome.tabs.Tab,
) {
  const p = run.payload
  if (run.type === 'activateTab') {
    await chrome.tabs.update(p.id, { active: true })
    await chrome.windows.update(p.windowId, { focused: true })
  } else if (run.type === 'cmd')
    await byId.get(String(p.id))?.run(typeof p.arg === 'string' ? p.arg : undefined)
  else if (run.type === 'navigate') {
    const prefs = await getPrefs()
    const url =
      typeof p.input === 'string'
        ? resolveInput(p.input, searchCfg(prefs))?.url
        : /^https?:\/\//.test(p.url)
          ? p.url
          : undefined
    if (!url) return
    if (p.newTab || !senderTab?.id) await chrome.tabs.create({ url })
    else await chrome.tabs.update(senderTab.id, { url })
  }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // Only our own pages and our injected script talk to us.
  if (sender.id !== chrome.runtime.id) return
  ;(async () => {
    if (msg.type === 'init') {
      const p = await getPrefs()
      reply({ vars: themeToCssVars(themeOf(p)) })
    } else if (msg.type === 'suggest') reply(await suggest(String(msg.text ?? '').slice(0, 300)))
    else if (msg.type === 'run') {
      await run(msg.run, sender.tab)
      reply(true)
    } else reply(null)
  })().catch(() => reply(null))
  return true
})
