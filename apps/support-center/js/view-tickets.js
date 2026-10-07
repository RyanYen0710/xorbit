import { h, banner, field, setErr, timeAgo, fullTime, badge } from './ui.js'
import {
  CATEGORIES,
  PRODUCTS,
  IMPACTS,
  FREQUENCIES,
  STATUS,
  ADMIN_STATUS,
  TIPS,
  CANNED,
} from './schema.js'
import * as A from './auth.js'
import * as T from './tickets.js'

const opts = (list, placeholder = 'Choose...') => [
  h('option', { value: '' }, placeholder),
  ...list.map((v) => h('option', { value: v }, v)),
]
const denied = (e) => e && (e.code === 'permission-denied' || /permission/i.test(e.message || ''))

// ── my tickets ────────────────────────────────────────────────────────────────────────────────────
export function dashboardView() {
  const list = h(
    'div',
    { class: 'tickets', 'aria-live': 'polite' },
    h('p', { class: 'hint' }, 'Loading your tickets...'),
  )
  const el = h(
    'div',
    {},
    h(
      'div',
      { class: 'head-row' },
      h(
        'div',
        {},
        h('div', { class: 'label' }, 'YOUR TICKETS'),
        h('h2', {}, 'Your conversations with support'),
      ),
      h('a', { class: 'btn', href: '#/new' }, 'New ticket'),
    ),
    list,
  )
  const stop = T.watchMine(
    A.state.user.uid,
    (items) => {
      list.replaceChildren(
        ...(items.length
          ? items.map((t) => ticketRow(t, `#/t/${t.id}`, 'admin'))
          : [
              h(
                'div',
                { class: 'empty' },
                h('p', {}, 'No tickets yet.'),
                h(
                  'p',
                  { class: 'hint' },
                  'When you open one, the whole conversation with us lives here.',
                ),
              ),
            ]),
      )
    },
    () => list.replaceChildren(banner('Could not load your tickets. Please reload.', 'error')),
  )
  return { el, cleanup: stop }
}

export function ticketRow(t, href, otherRole) {
  const fresh = T.hasUnseen(t, otherRole === 'admin' ? 'user' : 'admin')
  return h(
    'a',
    { class: 'ticket-row', href },
    h(
      'div',
      { class: 'tr-main' },
      h(
        'div',
        { class: 'tr-top' },
        h('span', { class: 'mono' }, t.id),
        badge(t.status, ADMIN_STATUS[t.status] || t.status),
        fresh &&
          h(
            'span',
            { class: 'badge', 'data-status': 'new' },
            otherRole === 'admin' ? 'New reply' : 'New message',
          ),
      ),
      h('div', { class: 'tr-title' }, t.title),
      h('div', { class: 'hint' }, `${t.category} · updated ${timeAgo(t.last)}`),
    ),
  )
}

// ── new ticket ────────────────────────────────────────────────────────────────────────────────────
export function newTicketView(navigate) {
  const u = A.state.user
  const msg = h('div', { 'aria-live': 'polite' })
  const tips = h('ul', { class: 'tips' })
  const showTips = (c) => tips.replaceChildren(...(TIPS[c] || TIPS['']).map((t) => h('li', {}, t)))
  const f = {
    title: h('input', {
      id: 'title',
      maxlength: '120',
      required: true,
      placeholder: 'One line, e.g. "Downloads panel stays empty"',
    }),
    category: h('select', { id: 'category', required: true }, ...opts(CATEGORIES)),
    product: h('select', { id: 'product', required: true }, ...opts(PRODUCTS)),
    impact: h('select', { id: 'impact', required: true }, ...opts(IMPACTS)),
    details: h('textarea', {
      id: 'details',
      rows: '5',
      maxlength: '5000',
      placeholder: 'Describe it in your own words. What were you trying to do?',
    }),
    steps: h('textarea', {
      id: 'steps',
      rows: '4',
      maxlength: '3000',
      placeholder: '1. Open a new tab\n2. ...\n3. ...',
    }),
    expected: h('textarea', { id: 'expected', rows: '2', maxlength: '2000' }),
    frequency: h('select', { id: 'frequency' }, ...opts(FREQUENCIES, 'Not sure')),
    url: h('input', {
      id: 'url',
      type: 'url',
      maxlength: '500',
      placeholder: 'https://... (if it is one website)',
    }),
    version: h('input', {
      id: 'version',
      maxlength: '100',
      placeholder: 'Settings > About X Orbit, e.g. 0.1.0',
    }),
    system: h('input', {
      id: 'system',
      maxlength: '100',
      placeholder: 'e.g. MacBook Air, macOS 14',
    }),
    browser: h('input', { id: 'browser', maxlength: '100', placeholder: 'e.g. Chrome 152' }),
    diag: h('input', { id: 'diag', type: 'checkbox' }),
    ack: h('input', { id: 'ack', type: 'checkbox' }),
  }
  const platform =
    (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''
  f.system.value = /mac/i.test(platform) ? 'Mac' : /win/i.test(platform) ? 'Windows' : ''
  f.category.addEventListener('change', () => showTips(f.category.value))
  showTips('')
  const send = h('button', { class: 'btn', type: 'submit' }, 'Send ticket')

  const form = h(
    'form',
    {
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault()
        msg.replaceChildren()
        const v = Object.fromEntries(
          Object.entries(f).map(([k, el]) => [
            k,
            el.type === 'checkbox' ? el.checked : el.value.trim(),
          ]),
        )
        const problems = {}
        if (v.title.length < 6) problems.title = 'Give it a short title (at least 6 characters).'
        if (!v.category) problems.category = 'Choose what it is about.'
        if (!v.product) problems.product = 'Choose a product.'
        if (!v.impact) problems.impact = 'Tell us how much it affects you.'
        if (v.details.length < 20)
          problems.details = 'Please describe it in a sentence or two (20+ characters).'
        if (v.url) {
          try {
            if (!/^https?:$/.test(new URL(v.url).protocol)) throw 0
          } catch {
            problems.url = 'Use a full address starting with http:// or https://'
          }
        }
        if (!v.ack) problems.ack = 'Please confirm you left out passwords and card numbers.'
        for (const k of ['title', 'category', 'product', 'impact', 'details', 'url', 'ack'])
          setErr(k, problems[k] || '')
        const first = Object.keys(problems)[0]
        if (first) return f[first].focus()
        const diagnostics = v.diag
          ? `User agent: ${navigator.userAgent}\nLanguage: ${navigator.language}\nScreen: ${screen.width}x${screen.height} @${window.devicePixelRatio}x\nTime zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`.slice(
              0,
              1500,
            )
          : ''
        send.disabled = true
        send.textContent = 'Sending...'
        try {
          const id = await T.createTicket(u, {
            name: (u.displayName || '').slice(0, 80),
            title: v.title,
            category: v.category,
            product: v.product,
            impact: v.impact,
            details: v.details,
            steps: v.steps,
            expected: v.expected,
            frequency: v.frequency,
            url: v.url,
            version: v.version,
            system: v.system,
            browser: v.browser,
            diagnostics,
          })
          T.notifyInbox(id, v.category, v.product)
          navigate(`#/t/${id}`)
        } catch (err) {
          msg.replaceChildren(
            banner(
              denied(err)
                ? 'We could not save that. You can open one ticket per minute, and every field must be filled in as asked. Wait a moment and try again.'
                : 'Something went wrong sending your ticket. Your text is still here; please try again.',
              'error',
            ),
          )
          send.disabled = false
          send.textContent = 'Send ticket'
        }
      },
    },
    h(
      'fieldset',
      {},
      h('legend', {}, '1 / The problem'),
      field('Title', f.title),
      h(
        'div',
        { class: 'row' },
        field('What is it about?', f.category),
        field('Which product?', f.product),
      ),
      field('How much does it affect you?', f.impact),
      field('What happened?', f.details),
      field('Steps to reproduce (optional)', f.steps),
      field('What did you expect to happen? (optional)', f.expected),
      h(
        'div',
        { class: 'row' },
        field('How often? (optional)', f.frequency),
        field('Page address (optional)', f.url),
      ),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, '2 / Your setup'),
      h(
        'div',
        { class: 'row' },
        field('X Orbit version (optional)', f.version),
        field('Computer (optional)', f.system),
      ),
      field('Browser and version (for the Chrome extension)', f.browser),
      h(
        'div',
        { class: 'check' },
        f.diag,
        h(
          'label',
          { for: 'diag' },
          'Attach basic diagnostic info',
          h(
            'span',
            { class: 'hint' },
            "Sends your browser's user-agent text, language, screen size and time zone. Nothing else.",
          ),
        ),
      ),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, '3 / Before you send'),
      h(
        'p',
        { class: 'hint' },
        'We will reply here, in the ticket. You are signed in as ',
        h('strong', {}, u.email),
        '.',
      ),
      h(
        'div',
        { class: 'check' },
        f.ack,
        h(
          'label',
          { for: 'ack' },
          'I have ',
          h('strong', {}, 'not'),
          ' put passwords, card numbers or recovery codes in this ticket.',
          h('span', { class: 'hint' }, 'We will never ask for them.'),
        ),
      ),
      h('p', { class: 'err', id: 'e-ack', role: 'alert' }),
    ),
    h('div', { class: 'actions' }, send, h('a', { class: 'btn ghost', href: '#/' }, 'Cancel')),
    msg,
  )

  return {
    el: h(
      'div',
      { class: 'grid' },
      h(
        'div',
        {},
        h('div', { class: 'label' }, 'NEW TICKET'),
        h('h2', {}, 'Tell us what is going on'),
        form,
      ),
      h('aside', {}, h('div', { class: 'label' }, 'WHAT TO INCLUDE'), tips),
    ),
    cleanup() {},
  }
}

// ── a conversation (customer view, or admin view when role === 'admin') ────────────────────────────
export function threadView(id, role, navigate) {
  const uid = A.state.user.uid
  const mine = role === 'user'
  const body = h('div', { 'aria-live': 'polite' }, h('p', { class: 'hint' }, 'Loading...'))
  let ticket = null,
    messages = []
  let busy = false

  const text = h('textarea', {
    id: 'reply',
    rows: '3',
    maxlength: '5000',
    placeholder: mine ? 'Write a reply...' : 'Write your answer to the customer...',
    'aria-label': 'Reply',
  })
  const err = h('div', { 'aria-live': 'polite' })
  const afterStatus = h(
    'select',
    { id: 'after', 'aria-label': 'After sending, set status' },
    h('option', { value: 'pending' }, 'then: Waiting on customer'),
    h('option', { value: 'open' }, 'then: Keep open'),
    h('option', { value: 'solved' }, 'then: Mark solved'),
  )
  const canned = h(
    'select',
    {
      id: 'canned',
      'aria-label': 'Insert a saved reply',
      onchange: () => {
        if (canned.value) {
          text.value = (text.value ? text.value + '\n\n' : '') + canned.value
          canned.value = ''
          text.focus()
        }
      },
    },
    h('option', { value: '' }, 'Insert a saved reply...'),
    ...CANNED.map(([l, v]) => h('option', { value: v }, l)),
  )
  const sendBtn = h('button', { class: 'btn', type: 'button', onclick: send }, 'Send')
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      send()
    }
  })

  async function send() {
    const t = text.value.trim()
    if (!t || busy) return
    busy = true
    sendBtn.disabled = true
    err.replaceChildren()
    try {
      await T.sendMessage(
        id,
        uid,
        mine ? 'user' : 'admin',
        t,
        mine
          ? ticket.status === 'pending' || ticket.status === 'solved'
            ? 'open'
            : null
          : afterStatus.value,
      )
      text.value = ''
    } catch (e) {
      err.replaceChildren(
        banner(
          denied(e)
            ? mine
              ? 'Please wait a few seconds between messages (or the ticket is closed).'
              : 'The server refused that. If your login is older than 8 hours, sign in again.'
            : 'Could not send. Please try again.',
          'error',
        ),
      )
    } finally {
      busy = false
      sendBtn.disabled = false
    }
  }

  const bubble = (who, content, at, label) =>
    h(
      'div',
      { class: `bubble ${who}` },
      h(
        'div',
        { class: 'b-meta' },
        h('strong', {}, label),
        h('span', { title: fullTime(at) }, ` · ${timeAgo(at)}`),
      ),
      h('div', { class: 'b-text' }, content),
    )

  function draw() {
    if (ticket === undefined) return
    // keep the cursor where it was if someone is typing while a new message arrives
    const hadFocus = document.activeElement === text
    const sel = [text.selectionStart, text.selectionEnd]
    if (!ticket) {
      body.replaceChildren(
        banner('That ticket does not exist, or you do not have access to it.', 'error'),
        h('p', {}, h('a', { href: mine ? '#/' : '#/admin' }, 'Back')),
      )
      return
    }
    T.markSeen(id, ticket.last)
    const meta = [
      ['Category', ticket.category],
      ['Product', ticket.product],
      ['Impact', ticket.impact],
      ['How often', ticket.frequency],
      ['Version', ticket.version],
      ['Computer', ticket.system],
      ['Browser', ticket.browser],
      ['Page', ticket.url],
    ].filter(([, v]) => v)
    const closed = ticket.status === 'closed'
    body.replaceChildren(
      h(
        'p',
        {},
        h('a', { href: mine ? '#/' : '#/admin' }, mine ? '< Your tickets' : '< All tickets'),
      ),
      h(
        'div',
        { class: 'thread-head' },
        h('div', {}, h('div', { class: 'mono hint' }, ticket.id), h('h2', {}, ticket.title)),
        h(
          'div',
          { class: 'th-side' },
          badge(ticket.status, (mine ? STATUS : ADMIN_STATUS)[ticket.status]),
          !mine &&
            h(
              'select',
              {
                id: 'status',
                'aria-label': 'Ticket status',
                onchange: async (e) => {
                  try {
                    await T.setStatus(id, e.target.value)
                  } catch {
                    err.replaceChildren(banner('Could not change the status.', 'error'))
                  }
                },
              },
              ...Object.entries(ADMIN_STATUS).map(([v, l]) =>
                h('option', { value: v, selected: v === ticket.status }, l),
              ),
            ),
        ),
      ),
      h(
        'dl',
        { class: 'meta' },
        !mine && [
          h('dt', {}, 'Customer'),
          h('dd', {}, `${ticket.name || '(no name)'} <${ticket.email}>`),
        ],
        meta.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]),
        h('dt', {}, 'Opened'),
        h('dd', {}, fullTime(ticket.created)),
      ),
      h(
        'div',
        { class: 'chat' },
        bubble(
          'user',
          [
            h('p', {}, ticket.details),
            ticket.steps && h('p', { class: 'sub' }, h('strong', {}, 'Steps: '), ticket.steps),
            ticket.expected &&
              h('p', { class: 'sub' }, h('strong', {}, 'Expected: '), ticket.expected),
            ticket.diagnostics &&
              h(
                'details',
                {},
                h('summary', {}, 'Diagnostic info'),
                h('pre', {}, ticket.diagnostics),
              ),
          ],
          ticket.created,
          mine ? 'You' : ticket.name || 'Customer',
        ),
        messages.map((m) =>
          bubble(
            m.role === 'admin' ? 'admin' : 'user',
            m.text,
            m.at,
            m.role === 'admin' ? 'X Orbit Support' : mine ? 'You' : ticket.name || 'Customer',
          ),
        ),
      ),
      closed && mine
        ? h(
            'div',
            { class: 'composer' },
            h('p', { class: 'hint' }, 'This ticket is closed.'),
            h(
              'button',
              { class: 'btn ghost', type: 'button', onclick: () => T.setStatus(id, 'open') },
              'Reopen ticket',
            ),
          )
        : h(
            'div',
            { class: 'composer' },
            text,
            h('div', { class: 'comp-row' }, !mine && canned, !mine && afterStatus, sendBtn),
            err,
          ),
      h(
        'div',
        { class: 'danger-row' },
        mine &&
          !closed &&
          h(
            'button',
            { class: 'btn ghost', type: 'button', onclick: () => T.setStatus(id, 'closed') },
            'Close ticket',
          ),
        h(
          'button',
          {
            class: 'btn ghost danger',
            type: 'button',
            onclick: async () => {
              if (
                !confirm(
                  mine
                    ? 'Delete this ticket and the whole conversation? This cannot be undone.'
                    : 'Delete this ticket and its messages permanently?',
                )
              )
                return
              try {
                await T.deleteTicket(id)
                navigate(mine ? '#/' : '#/admin')
              } catch {
                err.replaceChildren(banner('Could not delete it.', 'error'))
              }
            },
          },
          mine ? 'Delete ticket' : 'Delete (spam)',
        ),
      ),
    )
    if (hadFocus) {
      text.focus()
      text.setSelectionRange(sel[0], sel[1])
    }
  }

  const fail = (e) => {
    ticket = null
    body.replaceChildren(
      banner(
        denied(e)
          ? 'You do not have access to this ticket' +
              (mine ? '.' : ' (or your admin login has expired: sign in again).')
          : 'Could not load this ticket.',
        'error',
      ),
    )
  }
  const stops = [
    T.watchTicket(
      id,
      (t) => {
        ticket = t
        draw()
      },
      fail,
    ),
    T.watchMessages(
      id,
      (m) => {
        messages = m
        draw()
      },
      () => {},
    ),
  ]
  return { el: body, cleanup: () => stops.forEach((s) => s()) }
}
