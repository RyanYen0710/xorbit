import { act, useOrbit } from '../state'
import { Empty, Page, fmtBytes } from './shared'

export default function Downloads() {
  const s = useOrbit()!
  const op = (op: string, id: string) => act('dl', { op, id })
  return (
    <Page index="03" label="DOWNLOADS" title="Downloads">
      {s.downloads.length > 0 && (
        <div className="toolbar">
          <button className="btn ghost" onClick={() => act('clearDownloads')}>
            Clear download history
          </button>
        </div>
      )}
      {s.downloads.length === 0 && (
        <Empty title="NO DOWNLOADS">Files you download will appear here.</Empty>
      )}
      {s.downloads.map((d) => {
        const pct = d.totalBytes > 0 ? Math.round((d.receivedBytes / d.totalBytes) * 100) : 0
        const live = d.state === 'progressing' || d.state === 'paused'
        return (
          <div className="dl-row" key={d.id}>
            <div className="dl-main">
              <div className="dl-name">{d.filename || 'Download'}</div>
              <div className="dl-meta">
                {live
                  ? `${fmtBytes(d.receivedBytes)}${d.totalBytes ? ' of ' + fmtBytes(d.totalBytes) : ''} · ${d.state === 'paused' ? 'Paused' : d.totalBytes ? pct + '%' : 'Downloading'}`
                  : d.state === 'completed'
                    ? `${fmtBytes(d.totalBytes || d.receivedBytes)} · Completed`
                    : d.state === 'cancelled'
                      ? 'Cancelled'
                      : 'Failed'}
                <span className="dl-url"> · {d.url.slice(0, 80)}</span>
              </div>
              {live && (
                <div
                  className="bar"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <i style={{ width: d.totalBytes ? pct + '%' : '30%' }} />
                </div>
              )}
            </div>
            <div className="dl-actions">
              {d.state === 'progressing' && (
                <button className="btn ghost" onClick={() => op('pause', d.id)}>
                  Pause
                </button>
              )}
              {d.state === 'paused' && (
                <button className="btn ghost" onClick={() => op('resume', d.id)}>
                  Resume
                </button>
              )}
              {live && (
                <button className="btn ghost" onClick={() => op('cancel', d.id)}>
                  Cancel
                </button>
              )}
              {(d.state === 'failed' || d.state === 'cancelled') && (
                <button className="btn ghost" onClick={() => op('retry', d.id)}>
                  Retry
                </button>
              )}
              {d.state === 'completed' && (
                <button className="btn ghost" onClick={() => op('open', d.id)}>
                  Open
                </button>
              )}
              {d.savePath && d.state === 'completed' && (
                <button className="btn ghost" onClick={() => op('show', d.id)}>
                  Show in folder
                </button>
              )}
              {!live && (
                <button className="btn ghost" onClick={() => op('remove', d.id)}>
                  Remove
                </button>
              )}
            </div>
          </div>
        )
      })}
    </Page>
  )
}
