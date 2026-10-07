/** Tiny arithmetic evaluator (+ - * / ^ % parentheses). No eval(). Returns null if not a pure expression. */
export function calc(src: string): number | null {
  const s = src.replace(/\s+/g, '').replace(/^=/, '').replace(/×/g, '*').replace(/÷/g, '/')
  if (!/^[\d.+\-*/^%()]+$/.test(s) || !/[+\-*/^%]/.test(s.replace(/^-/, ''))) return null
  let i = 0
  const peek = () => s[i]
  function num(): number {
    if (peek() === '(') {
      i++
      const v = expr()
      if (s[i++] !== ')') throw 0
      return v
    }
    const m = /^\d*\.?\d+/.exec(s.slice(i))
    if (!m) throw 0
    i += m[0].length
    return parseFloat(m[0])
  }
  function unary(): number {
    if (peek() === '-') {
      i++
      return -unary()
    }
    if (peek() === '+') {
      i++
      return unary()
    }
    return pow()
  }
  function pow(): number {
    const b = num()
    if (peek() === '^') {
      i++
      return Math.pow(b, unary())
    }
    return b
  }
  function term(): number {
    let v = unary()
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = s[i++]
      const r = unary()
      v = op === '*' ? v * r : op === '/' ? v / r : v % r
    }
    return v
  }
  function expr(): number {
    let v = term()
    while (peek() === '+' || peek() === '-') v = s[i++] === '+' ? v + term() : v - term()
    return v
  }
  try {
    const v = expr()
    return i === s.length && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}
