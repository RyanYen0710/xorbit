import { h, banner } from './ui.js'
import { ADMIN_STATUS, CATEGORIES } from './schema.js'
import * as T from './tickets.js'
import { ticketRow } from './view-tickets.js'

/** All tickets, newest activity first. Only an administrator's session can read this collection (enforced by the database rules). */
export function adminView(signOut) {
  let all = []
  let status = 'active',
    category = '',
    q = ''
  const list = h(
    'div',
    { class: 'tickets', 'aria-live': 'polite' },
    h('p', { class: 'hint' }, 'Loading tickets...'),
  )
  const counts = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by status' })
  const search = h('input', {
    type: 'search',
    placeholder: 'Search title, ID, email...',
    'aria-label': 'Search tickets',
    oninput: () => {
      q = search.value.trim().toLowerCase()
      draw()
    },
  })
  const cat = h(
    'select',
    {
      'aria-label': 'Filter by category',
      onchange: () => {
        category = cat.value
        draw()
      },
    },
    h('option', { value: '' }, 'All categories'),
    ...CATEGORIES.map((c) => h('option', { value: c }, c)),
  )

  const needsReply = (t) =>
    t.lastMessageBy === 'user' && (t.status === 'open' || t.status === 'pending')
  const matchStatus = (t) =>
    status === 'all'
      ? true
      : status === 'active'
        ? t.status === 'open' || t.status === 'pending'
        : t.status === status

  function draw() {
    const chip = (id, label, n) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(status === id),
          onclick: () => {
            status = id
            draw()
          },
        },
        `${label} `,
        h('span', { class: 'n' }, String(n)),
      )
    counts.replaceChildren(
      chip(
        'active',
        'Needs attention',
        all.filter((t) => t.status === 'open' || t.status === 'pending').length,
      ),
      ...Object.entries(ADMIN_STATUS)
        .filter(([k]) => k === 'solved' || k === 'closed')
        .map(([k, l]) => chip(k, l, all.filter((t) => t.status === k).length)),
      chip('all', 'All', all.length),
    )
    const rows = all
      .filter(matchStatus)
      .filter((t) => !category || t.category === category)
      .filter((t) => !q || `${t.id} ${t.title} ${t.email} ${t.name}`.toLowerCase().includes(q))
    list.replaceChildren(
      ...(rows.length
        ? rows.map((t) => {
            const row = ticketRow(t, `#/admin/t/${t.id}`, 'user')
            const top = row.querySelector('.tr-top')
            top.append(
              h('span', { class: 'hint' }, t.email),
              needsReply(t) && h('span', { class: 'badge', 'data-status': 'needs' }, 'Needs reply'),
            )
            return row
          })
        : [
            h(
              'div',
              { class: 'empty' },
              h('p', {}, all.length ? 'No tickets match this filter.' : 'No tickets yet.'),
            ),
          ]),
    )
  }

  const el = h(
    'div',
    {},
    h(
      'div',
      { class: 'head-row' },
      h('div', {}, h('div', { class: 'label' }, 'ADMINISTRATOR'), h('h2', {}, 'All tickets')),
    ),
    counts,
    h('div', { class: 'row filters' }, search, cat),
    list,
  )
  const stop = T.watchAll(
    (items) => {
      all = items
      draw()
    },
    (e) => {
      list.replaceChildren(
        banner(
          e && e.code === 'permission-denied'
            ? 'The server did not accept your admin session. Admin logins last 8 hours: please sign in again with your Google account.'
            : 'Could not load tickets.',
          'error',
        ),
        h(
          'p',
          {},
          h('button', { class: 'btn ghost', type: 'button', onclick: signOut }, 'Sign out'),
        ),
      )
    },
  )
  return { el, cleanup: stop }
}
