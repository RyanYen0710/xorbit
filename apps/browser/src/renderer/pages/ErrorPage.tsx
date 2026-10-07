import { useEffect } from 'react'
import { Logo } from '@orbit/ui'
import { act } from '../state'

export default function ErrorPage() {
  const q = new URLSearchParams(location.search)
  const url = q.get('url') ?? ''
  useEffect(() => {
    document.title = 'Connection lost'
  }, [])
  return (
    <main className="errpage">
      <div className="err-head">
        <Logo size={22} />
        <span className="orbit-label">X ORBIT</span>
      </div>
      <h1 className="orbit-display">
        CONNECTION
        <br />
        LOST.
      </h1>
      <p>We couldn’t reach this page.</p>
      <div className="orbit-label err-url">{url}</div>
      <button className="btn" autoFocus onClick={() => act('navigate', { url })}>
        TRY AGAIN
      </button>
      <details>
        <summary className="orbit-label">TECHNICAL DETAILS</summary>
        <pre>{`Error:  ${q.get('desc') ?? 'unknown'}\nCode:   ${q.get('code') ?? '?'}\nURL:    ${url}`}</pre>
      </details>
    </main>
  )
}
