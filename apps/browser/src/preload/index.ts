import { contextBridge, ipcRenderer, webFrame } from 'electron'

// The bridge only exists on orbit:// pages. The main process re-checks the sender on every call,
// so a remote page that somehow reached these channels would still be rejected.
if (location.protocol === 'orbit:') {
  // First state arrives synchronously so the page's first paint already has the right colours and content
  // (no blank/black flash while switching between built-in pages).
  let first: any = ipcRenderer.sendSync('state:sync')
  const bg = first?.theme?.background
  if (
    typeof bg === 'string' &&
    /^#[0-9a-f]{3,8}$|^transparent$/i.test(bg) &&
    location.hostname !== 'overlay'
  )
    webFrame.insertCSS(`html,body{background:${bg}}`)
  contextBridge.exposeInMainWorld('orbit', {
    getState: () => {
      const s = first
      first = null
      return s ? Promise.resolve(s) : ipcRenderer.invoke('state')
    },
    onState: (cb: (s: unknown) => void) => {
      const h = (_e: unknown, s: unknown) => cb(s)
      ipcRenderer.on('state', h)
      return () => ipcRenderer.removeListener('state', h)
    },
    act: (type: string, payload?: Record<string, unknown>) =>
      ipcRenderer.invoke('act', type, payload),
    query: (type: string, payload?: Record<string, unknown>) =>
      ipcRenderer.invoke('query', type, payload),
  })
} else if (
  location.protocol === 'https:' ||
  (location.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(location.hostname))
) {
  initAutofill()
}

// ── password / card autofill (web pages) ────────────────────────────────────────────────────────────
// Runs in the preload's isolated world: page scripts can't read this code, call ipcRenderer, or see our messages.
// The site's origin is NOT sent — main takes it from the frame itself.
function initAutofill() {
  const TEXTY = new Set(['text', 'email', 'tel', ''])
  const ac = (el: HTMLInputElement) => (el.getAttribute('autocomplete') ?? '').toLowerCase()
  const visible = (el: HTMLElement) =>
    !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
  let last: HTMLInputElement | null = null

  type Kind = 'password' | 'username' | 'cc-number' | 'cc-exp' | 'cc-name'
  function kindOf(el: HTMLInputElement): Kind | null {
    const a = ac(el)
    if (a.includes('cc-number')) return 'cc-number'
    if (a.includes('cc-exp')) return 'cc-exp'
    if (a.includes('cc-name')) return 'cc-name'
    if (el.type === 'password') return 'password'
    if (TEXTY.has(el.type) && el.form?.querySelector('input[type=password]')) return 'username'
    return null
  }

  // Offer saved items when the user focuses a recognised field. A script can fire focus events itself, so we also
  // require *user activation* (a real click or key press moments ago); only the empty field qualifies.
  document.addEventListener(
    'focusin',
    (e) => {
      if (
        !e.isTrusted ||
        !navigator.userActivation?.isActive ||
        !(e.target instanceof HTMLInputElement)
      )
        return
      const el = e.target
      const k = kindOf(el)
      if (!k || el.value) return
      last = el
      const r = el.getBoundingClientRect()
      ipcRenderer.send('autofill:menu', {
        kind: k === 'password' || k === 'username' ? 'login' : 'card',
        rect: { x: r.left, y: r.top, w: r.width, h: r.height },
      })
    },
    true,
  )

  const setValue = (el: HTMLInputElement | undefined | null, v: string) => {
    if (!el) return
    // use the native setter so frameworks that track the value (React, Vue) notice the change
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const inputs = (root: ParentNode) =>
    [...root.querySelectorAll('input')].filter((i) => visible(i) && !i.disabled && !i.readOnly)

  ipcRenderer.on('autofill:fill', (_e, d: any) => {
    const root: ParentNode = last?.form ?? document
    if (d?.kind === 'login') {
      const all = inputs(root)
      const pw = all.find((i) => i.type === 'password')
      const user = all
        .filter(
          (i) =>
            TEXTY.has(i.type) &&
            (!pw || i.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING),
        )
        .pop()
      if (d.username) setValue(user, String(d.username))
      setValue(pw, String(d.password ?? ''))
    } else if (d?.kind === 'card') {
      const byAc = (t: string) => inputs(root).find((i) => ac(i).split(/\s+/).includes(t))
      const mm = String(d.expMonth).padStart(2, '0'),
        yyyy = String(d.expYear)
      setValue(byAc('cc-number'), String(d.number))
      setValue(byAc('cc-name'), String(d.name ?? ''))
      const combined = byAc('cc-exp')
      if (combined) setValue(combined, `${mm}/${yyyy.slice(-2)}`)
      setValue(byAc('cc-exp-month'), mm)
      setValue(byAc('cc-exp-year'), yyyy)
    }
  })

  // Remember what was typed when a form is submitted (the save prompt is shown by the main process).
  document.addEventListener(
    'submit',
    (e) => {
      const form = e.target
      if (!(form instanceof HTMLFormElement)) return
      const all = inputs(form)
      const pw = all.find((i) => i.type === 'password' && i.value)
      if (pw) {
        const user = all
          .filter(
            (i) =>
              TEXTY.has(i.type) &&
              i.value &&
              i.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING,
          )
          .pop()
        ipcRenderer.send('autofill:captured', { username: user?.value ?? '', password: pw.value })
      }
      const num = all.find((i) => ac(i).includes('cc-number') && i.value)
      if (num) {
        const get = (t: string) => all.find((i) => ac(i).split(/\s+/).includes(t))?.value ?? ''
        let m = Number(get('cc-exp-month')),
          y = Number(get('cc-exp-year'))
        const comb = get('cc-exp').match(/(\d{1,2})\s*\/\s*(\d{2,4})/)
        if (comb) {
          m = Number(comb[1])
          y = Number(comb[2])
        }
        // the security code (cc-csc) is deliberately never read
        ipcRenderer.send('autofill:card', {
          number: num.value,
          expMonth: m,
          expYear: y,
          name: get('cc-name'),
        })
      }
    },
    true,
  )
}
