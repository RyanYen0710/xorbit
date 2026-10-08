// The small windows and menus of the bookmark library: add a site, add a folder, rename, move, delete.
// All of them are X Orbit's own dialogs and menus (see window.ts: confirm() and popup()).
import type { MenuItemConstructorOptions } from 'electron'
import type { Pin } from '@orbit/types'
import type { OrbitWindow } from './window'
import { db } from './store'
import { broadcast } from './registry'
import {
  MAX_HOME,
  addBookmark,
  addFolder,
  allFolders,
  deleteFolder,
  movePinToFolder,
  renameFolder,
  toggleHome,
} from './library'

const OK = [{ label: 'OK', value: 'ok', kind: 'primary' as const }]
const CANCEL_OK = (ok: string, danger = false) => [
  { label: 'Cancel', value: 'cancel', kind: 'ghost' as const },
  { label: ok, value: 'ok', kind: danger ? ('danger' as const) : ('primary' as const) },
]
const tell = (w: OrbitWindow, title: string, message: string) =>
  void w.confirm({ title, message, buttons: OK })

/** "Add site": address, name, folder, and whether it also goes on the homepage. Asks again until it is valid. */
export async function addSiteDialog(
  w: OrbitWindow,
  seed: { url?: string; title?: string; folder?: string; home?: boolean },
): Promise<string> {
  let error = ''
  let v = { url: seed.url ?? '', name: seed.title ?? '', folder: seed.folder ?? '' }
  let home = !!seed.home
  for (;;) {
    const r = await w.confirm({
      title: 'Add site',
      message: '',
      error,
      fields: [
        {
          name: 'url',
          label: 'Web address',
          value: v.url,
          placeholder: 'example.com',
          required: true,
        },
        { name: 'name', label: 'Name (optional)', value: v.name },
        { name: 'folder', label: 'Folder', value: v.folder, options: ['', ...allFolders()] },
      ],
      checkbox: `Show on the homepage (up to ${MAX_HOME})`,
      checkboxChecked: home,
      buttons: CANCEL_OK('Add'),
    })
    if (r.value !== 'ok') return ''
    v = { url: r.values.url ?? '', name: r.values.name ?? '', folder: r.values.folder ?? '' }
    home = r.checked
    const res = addBookmark({ url: v.url, title: v.name, folder: v.folder, home })
    if (res.startsWith('!')) {
      error = res.slice(1)
      continue
    }
    return 'Added'
  }
}

export async function folderDialog(w: OrbitWindow, parent: string): Promise<string> {
  let error = ''
  let name = ''
  let where = parent
  for (;;) {
    const r = await w.confirm({
      title: 'New folder',
      message: '',
      error,
      fields: [
        { name: 'name', label: 'Folder name', value: name, required: true },
        { name: 'parent', label: 'Inside', value: where, options: ['', ...allFolders()] },
      ],
      buttons: CANCEL_OK('Create'),
    })
    if (r.value !== 'ok') return ''
    name = r.values.name ?? ''
    where = r.values.parent ?? ''
    const res = addFolder(where, name)
    if (res.startsWith('!')) {
      error = res.slice(1)
      continue
    }
    return 'ok'
  }
}

async function renameBookmark(w: OrbitWindow, p: Pin) {
  const r = await w.confirm({
    title: 'Rename bookmark',
    message: '',
    fields: [{ name: 'title', label: 'Name', value: p.title, required: true }],
    buttons: CANCEL_OK('Save'),
  })
  const t = (r.values.title ?? '').trim().slice(0, 200)
  if (r.value === 'ok' && t) {
    p.title = t
    db.save()
    broadcast()
  }
}

async function renameFolderDialog(w: OrbitWindow, path: string) {
  let error = ''
  let name = path.split(' / ').pop() ?? ''
  for (;;) {
    const r = await w.confirm({
      title: 'Rename folder',
      message: '',
      error,
      fields: [{ name: 'name', label: 'Name', value: name, required: true }],
      buttons: CANCEL_OK('Save'),
    })
    if (r.value !== 'ok') return
    name = r.values.name ?? ''
    const res = renameFolder(path, name)
    if (res.startsWith('!')) {
      error = res.slice(1)
      continue
    }
    return
  }
}

const folderEntries = (
  current: string,
  pick: (f: string) => void,
): MenuItemConstructorOptions[] => [
  { label: 'No folder', enabled: current !== '', click: () => pick('') },
  ...allFolders()
    .slice(0, 60)
    .map((f) => ({ label: f, enabled: f !== current, click: () => pick(f) })),
]

export async function bookmarkMenu(w: OrbitWindow, id: string) {
  const p = db.data.pins.find((x) => x.id === id)
  if (!p) return
  await w.popup([
    {
      label: 'Open',
      click: () => (w.activeTab ? w.navigate(w.activeTab, p.url) : w.newTab({ url: p.url })),
    },
    { label: 'Open in New Tab', click: () => w.newTab({ url: p.url }) },
    { type: 'separator' },
    { label: 'Rename…', click: () => void renameBookmark(w, p) },
    { label: 'Move to Folder', submenu: folderEntries(p.folder, (f) => movePinToFolder(p.id, f)) },
    {
      label: p.home ? 'Remove from Homepage' : 'Show on Homepage',
      click: () => {
        const r = toggleHome(p.id)
        if (r.startsWith('!')) tell(w, 'The homepage is full', r.slice(1))
      },
    },
    { type: 'separator' },
    {
      label: 'Delete',
      click: async () => {
        const r = await w.confirm({
          title: `Delete “${p.title}”?`,
          message: 'This removes the bookmark.',
          buttons: CANCEL_OK('Delete', true),
        })
        if (r.value === 'ok') {
          db.data.pins = db.data.pins.filter((x) => x.id !== p.id)
          db.save()
          broadcast()
        }
      },
    },
  ])
}

export async function folderMenu(w: OrbitWindow, path: string) {
  await w.popup([
    { label: 'New Folder Inside…', click: () => void folderDialog(w, path) },
    { label: 'Add Site Here…', click: () => void addSiteDialog(w, { folder: path }) },
    { type: 'separator' },
    { label: 'Rename…', click: () => void renameFolderDialog(w, path) },
    {
      label: 'Delete Folder',
      click: async () => {
        const n = db.data.pins.filter(
          (x) => x.folder === path || x.folder.startsWith(path + ' / '),
        ).length
        const r = await w.confirm({
          title: `Delete the folder “${path.split(' / ').pop()}”?`,
          message: n
            ? `Its ${n} bookmark${n === 1 ? '' : 's'} are kept and move up one level.`
            : 'The folder is empty.',
          buttons: CANCEL_OK('Delete folder', true),
        })
        if (r.value === 'ok') deleteFolder(path)
      },
    },
  ])
}
