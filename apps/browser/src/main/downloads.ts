import { app, session, shell, type Session } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { DownloadItem as Rec } from '@orbit/types'
import { db, uid } from './store'
import { broadcast } from './registry'

const live = new Map<string, Electron.DownloadItem>()

function uniquePath(dir: string, name: string) {
  const { name: base, ext } = path.parse(name)
  let p = path.join(dir, name),
    n = 1
  while (fs.existsSync(p)) p = path.join(dir, `${base} (${n++})${ext}`)
  return p
}

export function hookDownloads(ses: Session) {
  ses.on('will-download', (_e, item) => {
    if (!db.data.settings.askDownload)
      item.setSavePath(uniquePath(app.getPath('downloads'), item.getFilename()))
    const rec: Rec = {
      id: uid(),
      url: item.getURL(),
      filename: item.getFilename(),
      savePath: item.getSavePath(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'progressing',
      startedAt: Date.now(),
    }
    db.data.downloads.unshift(rec)
    live.set(rec.id, item)
    const sync = () => {
      rec.receivedBytes = item.getReceivedBytes()
      rec.totalBytes = item.getTotalBytes()
      rec.savePath = item.getSavePath() || rec.savePath
      if (rec.savePath) rec.filename = path.basename(rec.savePath)
      broadcast()
    }
    item.on('updated', (_e, state) => {
      rec.state = state === 'interrupted' ? 'failed' : item.isPaused() ? 'paused' : 'progressing'
      sync()
    })
    item.once('done', (_e, state) => {
      rec.state =
        state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'failed'
      live.delete(rec.id)
      sync()
      db.save()
    })
    broadcast()
  })
}

export function downloadOp(op: string, id: string) {
  const rec = db.data.downloads.find((d) => d.id === id)
  if (!rec) return
  const item = live.get(id)
  if (op === 'pause') item?.pause()
  else if (op === 'resume' && item?.canResume()) item.resume()
  else if (op === 'cancel') item?.cancel()
  else if (op === 'retry') session.fromPartition('persist:orbit').downloadURL(rec.url)
  else if (op === 'open' && rec.state === 'completed') void shell.openPath(rec.savePath)
  else if (op === 'show' && rec.savePath) shell.showItemInFolder(rec.savePath)
  else if (op === 'remove') db.data.downloads = db.data.downloads.filter((d) => d.id !== id)
  db.save()
  broadcast()
}

export function clearDownloads() {
  db.data.downloads = db.data.downloads.filter(
    (d) => d.state === 'progressing' || d.state === 'paused',
  )
  db.save()
  broadcast()
}
