// X Orbit Support Center. Plain browser JavaScript, no build step, no inline scripts (the CSP forbids them).
// Untrusted text is only ever put on the page with textContent, never innerHTML.
'use strict'

const ENDPOINT = 'https://api.web3forms.com/submit'
const cfg = window.XORBIT_SUPPORT || {}
const configured = typeof cfg.accessKey === 'string' && /^[0-9a-f-]{20,}$/i.test(cfg.accessKey)

const $ = (s) => document.querySelector(s)
const form = $('#ticket')
const banner = $('#banner')
const send = $('#send')

// ── what to include, per category ───────────────────────────────────────────────────────────────
const TIPS = {
  '': [
    'Pick a category and this list adapts.',
    'One problem per ticket is easiest to fix.',
    'Screenshots help: describe what you see; you can reply to our email with images.',
  ],
  'Bug or crash': [
    'What you were doing right before it broke.',
    'Does it happen every time? After a restart?',
    'On Mac: Console → Crash Reports → “X Orbit”, if one exists. Mention it; we may ask for it.',
    'Does it also happen in a Private window?',
  ],
  'Performance or memory': [
    'How many tabs were open, and which sites.',
    'Activity Monitor (Mac) or Task Manager (Windows): memory used by X Orbit.',
    'Did it start after an update or a certain site?',
    'Does it still happen with Focus Mode or Split View off?',
  ],
  'Website doesn’t work in X Orbit': [
    'The exact page address.',
    'Does the same page work in Chrome?',
    'What breaks: loading, sign-in, video, layout, a button?',
    'Settings → Privacy: is third-party cookie blocking or JavaScript turned off?',
  ],
  'Passwords, cards & autofill': [
    'The site address, not the password. Never send passwords or card numbers.',
    'Did the save prompt appear? Did the fill menu open when you clicked the box?',
    'Is it a normal form, or an embedded payment box?',
    'Mac: is Touch ID asked for?',
  ],
  'Downloads & installer': [
    'Mac with Apple Silicon (M1 or newer) or Intel? Only Apple Silicon is available today.',
    'The exact message macOS shows (“can’t be opened…”).',
    'Did you try System Settings → Privacy & Security → Open Anyway?',
    'The file name you downloaded and where from.',
  ],
  'Chrome extension': [
    'Chrome (or Edge/Brave) version: chrome://version.',
    'Did you pick the unzipped folder that contains manifest.json?',
    'A red “Errors” button on the extension card? Say what it shows.',
    'Which shortcut or feature fails: new tab, side panel, Orbit Bar?',
  ],
  'Privacy question': [
    'What you want to know: what is stored, what is sent, how to clear it.',
    'Which product: Mac app, extension or website.',
    'We will answer from what the software actually does, and say so if we don’t know.',
  ],
  'Feature request': [
    'The problem you want solved, not only the solution.',
    'How you work around it today.',
    'How often you would use it.',
  ],
  'Account or something else': [
    'Describe it plainly; we’ll route it.',
    'X Orbit has no accounts yet. Tell us what you were trying to do.',
  ],
}
function renderTips() {
  const list = TIPS[form.category.value] || TIPS['']
  const ul = $('#tips')
  ul.replaceChildren(
    ...list.map((t) => Object.assign(document.createElement('li'), { textContent: t })),
  )
}

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────
const store = {
  get(k, d) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d
    } catch {
      return d
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v))
    } catch {
      /* private mode: fine */
    }
  },
}
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
function ticketId() {
  const d = new Date()
  const ymd =
    String(d.getFullYear()).slice(2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  const r = crypto.getRandomValues(new Uint8Array(4))
  return `XO-${ymd}-${[...r].map((n) => ALPHABET[n % ALPHABET.length]).join('')}`
}
function showBanner(text, kind) {
  banner.textContent = text
  banner.dataset.kind = kind
  banner.hidden = !text
}
function setError(name, msg) {
  const el = form.elements[name]
  const out = $(`#e-${name}`)
  if (out) out.textContent = msg
  if (el && el.setAttribute) el.setAttribute('aria-invalid', msg ? 'true' : 'false')
}

// ── validation ──────────────────────────────────────────────────────────────────────────────────
function validate() {
  const v = (n) => String(form.elements[n].value || '').trim()
  const problems = {}
  if (v('title').length < 6) problems.title = 'Give it a short title (at least 6 characters).'
  if (!v('category')) problems.category = 'Choose what it is about.'
  if (!v('product')) problems.product = 'Choose a product.'
  if (!v('impact')) problems.impact = 'Tell us how much it affects you.'
  if (v('details').length < 20)
    problems.details = 'Please describe it in at least a sentence or two (20+ characters).'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email')))
    problems.email = 'Enter a valid email so we can reply.'
  if (v('url')) {
    try {
      if (!/^https?:$/.test(new URL(v('url')).protocol)) throw 0
    } catch {
      problems.url = 'Use a full address starting with http:// or https://'
    }
  }
  if (!form.elements.ack.checked)
    problems.ack = 'Please confirm you left out passwords and card numbers.'
  for (const n of ['title', 'category', 'product', 'impact', 'details', 'email', 'url', 'ack'])
    setError(n, problems[n] || '')
  return problems
}

// ── message ─────────────────────────────────────────────────────────────────────────────────────
function buildMessage(id, withDiagnostics) {
  const v = (n) => String(form.elements[n].value || '').trim()
  const line = (k, val) => (val ? `${k}: ${val}\n` : '')
  let m =
    `Ticket: ${id}\n` +
    line('Category', v('category')) +
    line('Product', v('product')) +
    line('Impact', v('impact')) +
    line('How often', v('frequency')) +
    line('X Orbit version', v('version')) +
    line('Computer', v('system')) +
    line('Browser', v('browser')) +
    line('Page', v('url'))
  m += `\n--- WHAT HAPPENED ---\n${v('details')}\n`
  if (v('steps')) m += `\n--- STEPS TO REPRODUCE ---\n${v('steps')}\n`
  if (v('expected')) m += `\n--- EXPECTED ---\n${v('expected')}\n`
  if (withDiagnostics) {
    m +=
      `\n--- DIAGNOSTICS (user opted in) ---\nUser agent: ${navigator.userAgent}\nLanguage: ${navigator.language}\n` +
      `Screen: ${screen.width}x${screen.height} @${window.devicePixelRatio}x\nTime zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n`
  }
  return m
}

// ── my tickets (this browser only) ──────────────────────────────────────────────────────────────
function renderMine() {
  const items = store.get('xorbit-tickets', [])
  const ul = $('#mine')
  ul.replaceChildren(
    ...items.map((t) => {
      const li = document.createElement('li')
      const id = Object.assign(document.createElement('div'), {
        className: 'id',
        textContent: t.id,
      })
      const title = Object.assign(document.createElement('div'), { textContent: t.title })
      const meta = Object.assign(document.createElement('div'), {
        className: 'hint',
        textContent: `${t.category} · ${new Date(t.at).toLocaleDateString()}`,
      })
      li.append(id, title, meta)
      return li
    }),
  )
  $('#mine-empty').hidden = items.length > 0
}

// ── submit ──────────────────────────────────────────────────────────────────────────────────────
let busy = false
form.addEventListener('submit', async (e) => {
  e.preventDefault()
  if (busy) return
  showBanner('', '')
  const problems = validate()
  const first = Object.keys(problems)[0]
  if (first) {
    form.elements[first].focus()
    return
  }
  if (!configured) {
    showBanner(
      'The ticket form is not connected to our support inbox yet, so it can’t send. Please check back soon.',
      'info',
    )
    return
  }

  // spam trap filled in → pretend it worked, send nothing
  if (form.elements.website.value) return finish(ticketId(), true)

  // soft client limit (the form service enforces the real one): 3 tickets per 10 minutes
  const now = Date.now()
  const recent = store.get('xorbit-recent', []).filter((t) => now - t < 600_000)
  if (recent.length >= 3) {
    showBanner(
      'You’ve sent a few tickets just now. Please wait a few minutes before sending another.',
      'error',
    )
    return
  }

  const id = ticketId()
  const v = (n) => String(form.elements[n].value || '').trim()
  busy = true
  send.disabled = true
  send.textContent = 'Sending…'
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: cfg.accessKey,
        subject: `[${id}] [${v('category')}] ${v('title')}`.slice(0, 200),
        from_name: v('name') || 'X Orbit user',
        email: v('email'),
        replyto: v('email'),
        message: buildMessage(id, form.elements.diag.checked),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success)
      throw new Error(data.message || `The form service answered ${res.status}`)
    store.set('xorbit-recent', [...recent, now])
    const mine = store.get('xorbit-tickets', [])
    store.set(
      'xorbit-tickets',
      [{ id, title: v('title'), category: v('category'), at: now }, ...mine].slice(0, 20),
    )
    finish(id, false)
  } catch (err) {
    showBanner(
      `We couldn’t send your ticket (${err.message}). Your text is still here, so try again in a moment.`,
      'error',
    )
  } finally {
    busy = false
    send.disabled = false
    send.textContent = 'Send ticket'
  }
})

function finish(id, fake) {
  if (!fake) renderMine()
  $('#done-id').textContent = id
  $('#done-email').textContent = String(form.elements.email.value).trim()
  form.hidden = true
  const done = $('#done')
  done.hidden = false
  done.focus()
  window.scrollTo({ top: 0 })
}
$('#copy-id').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#done-id').textContent)
    $('#copy-id').textContent = 'Copied ✓'
  } catch {
    /* select-able text is right there */
  }
})
$('#another').addEventListener('click', () => {
  form.reset()
  prefill()
  renderTips()
  $('#copy-id').textContent = 'Copy ID'
  $('#done').hidden = true
  form.hidden = false
  form.elements.title.focus()
})

// ── setup ───────────────────────────────────────────────────────────────────────────────────────
function prefill() {
  const p =
    (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''
  if (!form.elements.system.value)
    form.elements.system.value = /mac/i.test(p) ? 'Mac' : /win/i.test(p) ? 'Windows' : ''
  const prod = $('#product')
  if (!prod.value && /[?&]product=extension/.test(location.search))
    prod.value = 'X Orbit Chrome extension'
}
form.category.addEventListener('change', renderTips)
for (const n of ['title', 'category', 'product', 'impact', 'details', 'email', 'url']) {
  form.elements[n].addEventListener('input', () => setError(n, ''))
}
form.elements.ack.addEventListener('change', () => setError('ack', ''))
if (!configured)
  showBanner(
    'The ticket form is being connected to our support inbox. You can fill it in, but it can’t send yet.',
    'info',
  )
prefill()
renderTips()
renderMine()
