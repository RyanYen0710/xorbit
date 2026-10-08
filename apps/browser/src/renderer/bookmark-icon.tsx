import { useEffect, useState } from 'react'
import { hostOf } from './state'

/** A bookmark's website icon, or the first letter of the site when it has none (yet). */
export function BookmarkIcon({
  url,
  favicon,
  size = 16,
}: {
  url: string
  favicon: string
  size?: number
}) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [favicon])
  return favicon && !bad ? (
    <img
      className="bm-img"
      src={favicon}
      alt=""
      width={size}
      height={size}
      onError={() => setBad(true)}
    />
  ) : (
    <span className="bm-letter" style={{ width: size, height: size, fontSize: size * 0.6 }}>
      {(hostOf(url)[0] ?? '·').toUpperCase()}
    </span>
  )
}
