/** Subsequence fuzzy score: higher is better, null = no match. Rewards prefix, word-start and contiguous hits. */
export function fuzzy(query: string, text: string): number | null {
  const q = query.toLowerCase().trim()
  const t = text.toLowerCase()
  if (!q) return 0
  let score = 0,
    ti = 0,
    run = 0
  for (const ch of q) {
    const at = t.indexOf(ch, ti)
    if (at < 0) return null
    run = at === ti && ti > 0 ? run + 1 : 0
    score += 1 + run * 2 + (at === 0 || /[\s/._-]/.test(t[at - 1]) ? 4 : 0)
    ti = at + 1
  }
  return score - t.length * 0.01
}
