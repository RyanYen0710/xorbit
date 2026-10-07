import type { HistoryEntry } from '@orbit/types'
import { history, uid } from './store'

const CAP = 20000

export function addVisit(url: string, title: string) {
  if (!/^https?:/.test(url)) return
  const last = history.items[0]
  if (last && last.url === url && Date.now() - last.visitedAt < 30_000) return
  history.items.unshift({ id: uid(), url, title: title || url, visitedAt: Date.now() })
  if (history.items.length > CAP) history.items.length = CAP
  history.save()
}

export function setTitle(url: string, title: string) {
  const e = history.items[0]
  if (e && e.url === url && title) {
    e.title = title
    history.save()
  }
}

export function search(q: string, limit = 100, before = Infinity): HistoryEntry[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  const out: HistoryEntry[] = []
  for (const e of history.items) {
    if (e.visitedAt >= before) continue
    const hay = (e.title + ' ' + e.url).toLowerCase()
    if (terms.every((t) => hay.includes(t))) out.push(e)
    if (out.length >= limit) break
  }
  return out
}

export const remove = (ids: string[]) => {
  const set = new Set(ids)
  history.items.splice(0, history.items.length, ...history.items.filter((e) => !set.has(e.id)))
  history.save()
}

export const clearRange = (ms: number) => {
  const cutoff = Date.now() - ms
  history.items.splice(
    0,
    history.items.length,
    ...history.items.filter((e) => e.visitedAt < cutoff),
  )
  history.save()
}
