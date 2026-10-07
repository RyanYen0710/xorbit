const P: Record<string, string> = {
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  reload: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.8h-4.8',
  stop: 'M6 6l12 12M18 6L6 18',
  close: 'M7 7l10 10M17 7L7 17',
  plus: 'M12 5v14M5 12h14',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  unlock: 'M7 11V8a5 5 0 0 1 9.5-2M6 11h12v9H6z',
  speaker: 'M4 10v4h4l5 4V6l-5 4zM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11',
  muted: 'M4 10v4h4l5 4V6l-5 4zM17 9.5l4 5M21 9.5l-4 5',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  history: 'M12 7v5l3 2M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4',
  pin: 'M7 4h10v16l-5-4-5 4z',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9',
  split: 'M4 5h16v14H4zM12 5v14',
  focus: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  theme:
    'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5-1-1.5-1-3 0-1 1-2 2-2h2.5A3.5 3.5 0 0 0 21 10.5C21 6.4 17 3 12 3z',
  private: 'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  swap: 'M4 8h14l-3-3M20 16H6l3 3',
  detach: 'M14 4h6v6M20 4l-8 8M10 6H5v13h13v-5',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  folder: 'M3 6h6l2 2h10v11H3z',
  chevron: 'M8 10l4 4 4-4',
  panel: 'M4 5h16v14H4zM9 5v14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
}

export function Icon({ n, size = 16 }: { n: keyof typeof P | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={P[n] ?? ''} />
      {n === 'settings' && (
        <>
          <circle cx="15.5" cy="7" r="2" />
          <circle cx="8.5" cy="17" r="2" />
        </>
      )}
      {n === 'history' && null}
    </svg>
  )
}
