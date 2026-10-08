// The bookmark library: folders, adding sites, the (at most 8) homepage pins. One library for every Space.
import type { Pin } from '@orbit/types'
import { db, uid } from './store'
import { broadcast } from './registry'
import { fillIcons } from './favicons'

export const MAX_HOME = 8
const MAX_FOLDERS = 300
const MAX_DEPTH = 6

const name = (s: string) =>
  s
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
const parentOf = (path: string) => path.split(' / ').slice(0, -1).join(' / ')
const within = (path: string, folder: string) => folder === path || folder.startsWith(path + ' / ')
const save = () => {
  db.save()
  broadcast()
}

/** Every folder, including empty ones and the parents of folders (so "Work / Docs" always has a "Work"). */
export function allFolders(): string[] {
  const set = new Set<string>()
  for (const f of [...(db.data.folders ?? []), ...db.data.pins.map((p) => p.folder)]) {
    const parts = (f ?? '').split(' / ').filter(Boolean)
    for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join(' / '))
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

export function addFolder(parent: string, raw: string): string {
  const n = name(raw)
  if (!n) return '!Give the folder a name.'
  const path = parent ? `${parent} / ${n}` : n
  if (path.split(' / ').length > MAX_DEPTH) return '!Folders can only go 6 levels deep.'
  const have = allFolders()
  if (have.some((f) => f.toLowerCase() === path.toLowerCase()))
    return '!That folder already exists.'
  if (have.length >= MAX_FOLDERS) return '!That is the most folders X Orbit keeps (300).'
  ;(db.data.folders ??= []).push(path)
  save()
  return 'ok'
}

export function renameFolder(path: string, raw: string): string {
  const n = name(raw)
  if (!n) return '!Give the folder a name.'
  const next = parentOf(path) ? `${parentOf(path)} / ${n}` : n
  if (next === path) return 'ok'
  if (allFolders().some((f) => f.toLowerCase() === next.toLowerCase() && !within(path, f)))
    return '!That folder already exists.'
  const re = (f: string) => (within(path, f) ? next + f.slice(path.length) : f)
  db.data.folders = [...new Set([...(db.data.folders ?? []), path].map(re))]
  for (const p of db.data.pins) p.folder = re(p.folder)
  save()
  return 'ok'
}

/** Deletes a folder (and its sub-folders); the bookmarks inside are kept and move up one level. */
export function deleteFolder(path: string) {
  const up = parentOf(path)
  db.data.folders = (db.data.folders ?? []).filter((f) => !within(path, f))
  for (const p of db.data.pins) if (within(path, p.folder)) p.folder = up
  save()
}

export function movePinToFolder(id: string, folder: string) {
  const p = db.data.pins.find((x) => x.id === id)
  if (!p) return
  p.folder = folder.split(' / ').map(name).filter(Boolean).join(' / ')
  save()
}

export const homeCount = () => db.data.pins.filter((p) => p.home).length

export function toggleHome(id: string): string {
  const p = db.data.pins.find((x) => x.id === id)
  if (!p) return ''
  if (!p.home && homeCount() >= MAX_HOME)
    return `!You can pin up to ${MAX_HOME} sites to the homepage. Remove one first.`
  p.home = !p.home
  save()
  return 'ok'
}

export function webAddress(input: string): URL | null {
  const raw = input.trim()
  if (!raw || /\s/.test(raw)) return null
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw)
    if (!/^https?:$/.test(u.protocol)) return null
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null
    return u
  } catch {
    return null
  }
}

/** Adds a bookmark. Returns "Added", or a message starting with "!" explaining why not. */
export function addBookmark(o: {
  url: string
  title?: string
  folder?: string
  home?: boolean
  favicon?: string
}): string {
  const u = webAddress(o.url)
  if (!u) return '!That doesn’t look like a web address'
  if (db.data.pins.some((x) => x.url === u.href)) return '!Already bookmarked'
  if (o.home && homeCount() >= MAX_HOME)
    return `!You can pin up to ${MAX_HOME} sites to the homepage. Remove one first.`
  const pin: Pin = {
    id: uid(),
    spaceId: db.data.spaces[0]?.id ?? '',
    title: (o.title ?? '').trim().slice(0, 200) || u.host.replace(/^www\./, ''),
    url: u.href,
    favicon: o.favicon ?? '',
    folder: (o.folder ?? '').split(' / ').map(name).filter(Boolean).join(' / '),
    home: !!o.home,
  }
  db.data.pins.push(pin)
  save()
  void fillIcons()
  return 'Added'
}
