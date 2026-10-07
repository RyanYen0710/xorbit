import { useCallback, useEffect, useState } from 'react'
import type { HistoryEntry } from '@orbit/types'
import { Icon } from '../icons'
import { act, hostOf, query } from '../state'
import { Empty, Page } from './shared'

const DAY = 86_400_000
function group(e: HistoryEntry, now: number) {
  const start = new Date(now).setHours(0, 0, 0, 0)
  if (e.visitedAt >= start) return 'TODAY'
  if (e.visitedAt >= start - DAY) return 'YESTERDAY'
  if (e.visitedAt >= start - 7 * DAY) return 'PREVIOUS 7 DAYS'
  return 'OLDER'
}

export default function History() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<HistoryEntry[] | null>(null)
  const load = useCallback(() => query('history', { q, limit: 500 }).then(setItems), [q])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])
  const del = async (ids: string[]) => {
    await act('deleteHistory', { ids })
    void load()
  }
  const clear = async (range: string) => {
    await act('deleteHistoryRange', { range })
    void load()
  }
  const now = Date.now()
  const groups = new Map<string, HistoryEntry[]>()
  for (const e of items ?? []) {
    const g = group(e, now)
    groups.set(g, [...(groups.get(g) ?? []), e])
  }
  return (
    <Page index="02" label="HISTORY" title="History">
      <div className="toolbar">
        <input
          className="field grow"
          placeholder="Search history"
          aria-label="Search history"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn ghost" onClick={() => clear('hour')}>
          Delete last hour
        </button>
        <button className="btn ghost" onClick={() => clear('day')}>
          Delete last 24 hours
        </button>
        <button
          className="btn ghost"
          onClick={() => confirm('Delete all history?') && clear('all')}
        >
          Clear all
        </button>
      </div>
      {items && items.length === 0 && (
        <Empty title="NO HISTORY YET">
          {q ? 'Nothing matches that search.' : 'Pages you visit will appear here.'}
        </Empty>
      )}
      {[...groups].map(([g, list]) => (
        <section key={g} className="hist-group">
          <div className="orbit-label hist-label">{g}</div>
          {list.map((e) => (
            <div className="hist-row" key={e.id}>
              <span className="hist-time">
                {new Date(e.visitedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <a
                href="#"
                className="hist-title"
                onClick={(ev) => {
                  ev.preventDefault()
                  void act('navigate', { url: e.url })
                }}
              >
                {e.title}
              </a>
              <span className="hist-host">{hostOf(e.url)}</span>
              <button
                className="icon-btn"
                aria-label={`Delete ${e.title}`}
                onClick={() => del([e.id])}
              >
                <Icon n="close" size={14} />
              </button>
            </div>
          ))}
        </section>
      ))}
    </Page>
  )
}
