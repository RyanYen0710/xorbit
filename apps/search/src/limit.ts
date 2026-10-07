// Protects the paid/quota'd search API key: per-visitor limits plus a global daily cap, counted on the server.
// ponytail: in-memory counters (reset on restart, per instance). Use Redis/Upstash/KV if you run several instances.
export interface LimitConfig {
  perMinute: number
  perDay: number
  globalPerDay: number
}
export type Verdict =
  { ok: true } | { ok: false; reason: 'minute' | 'day' | 'global'; retryAfter: number }

export function createLimiter(cfg: LimitConfig, now: () => number = Date.now) {
  const hits = new Map<string, number[]>() // visitor → timestamps within the last 24 h
  let day = Math.floor(now() / 864e5)
  let global = 0

  return {
    check(visitor: string): Verdict {
      const t = now()
      const d = Math.floor(t / 864e5)
      if (d !== day) {
        day = d
        global = 0
      }
      if (global >= cfg.globalPerDay)
        return {
          ok: false,
          reason: 'global',
          retryAfter: Math.ceil(((day + 1) * 864e5 - t) / 1000),
        }
      const list = (hits.get(visitor) ?? []).filter((x) => t - x < 864e5)
      const lastMinute = list.filter((x) => t - x < 6e4)
      if (lastMinute.length >= cfg.perMinute)
        return {
          ok: false,
          reason: 'minute',
          retryAfter: Math.ceil((6e4 - (t - lastMinute[0])) / 1000),
        }
      if (list.length >= cfg.perDay)
        return { ok: false, reason: 'day', retryAfter: Math.ceil((864e5 - (t - list[0])) / 1000) }
      list.push(t)
      hits.set(visitor, list)
      global++
      if (hits.size > 50_000)
        for (const [k, v] of hits) if (t - v[v.length - 1] > 864e5) hits.delete(k) // bound memory
      return { ok: true }
    },
  }
}
