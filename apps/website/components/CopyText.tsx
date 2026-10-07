'use client'
import { useState } from 'react'

/** Websites can't link to chrome:// pages, so give people a copy button instead. */
export function CopyText({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <span className="copy-row">
      <code>{text}</code>
      <button
        type="button"
        className="btn ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setDone(true)
            setTimeout(() => setDone(false), 2000)
          } catch {
            /* clipboard blocked: the text is right there to select */
          }
        }}
      >
        {done ? 'Copied ✓' : label}
      </button>
    </span>
  )
}
