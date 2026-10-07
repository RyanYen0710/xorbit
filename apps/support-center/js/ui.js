// Tiny DOM helpers. Anything coming from a user is only ever added with textContent / text nodes, never innerHTML.
export const $ = (s, r = document) => r.querySelector(s)

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue
    if (k === 'class') el.className = v
    else if (k === 'text') el.textContent = v
    else if (k.startsWith('on') && typeof v === 'function')
      el.addEventListener(k.slice(2).toLowerCase(), v)
    else if (v === true) el.setAttribute(k, '')
    else el.setAttribute(k, String(v))
  }
  for (const kid of kids.flat(Infinity))
    if (kid != null && kid !== false)
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)))
  return el
}

export function timeAgo(ms) {
  if (!ms) return ''
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const hr = Math.round(m / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const d = Math.round(hr / 24)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(ms).toLocaleDateString()
}
export const fullTime = (ms) => (ms ? new Date(ms).toLocaleString() : '')
export const ms = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0)

export function banner(text, kind = 'info') {
  return h('p', {
    class: 'banner',
    role: kind === 'error' ? 'alert' : 'status',
    'data-kind': kind,
    text,
  })
}

export function field(label, control, { hint, error } = {}) {
  const id = control.id
  return h(
    'div',
    { class: 'field' },
    h('label', { for: id }, label),
    control,
    hint && h('p', { class: 'hint' }, hint),
    h('p', { class: 'err', id: id ? `e-${id}` : null, role: 'alert' }, error || ''),
  )
}
export const setErr = (id, msg) => {
  const out = document.getElementById(`e-${id}`)
  if (out) out.textContent = msg || ''
  const el = document.getElementById(id)
  if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false')
}

export function badge(status, label) {
  return h('span', { class: 'badge', 'data-status': status, text: label })
}
