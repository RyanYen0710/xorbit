import * as A from './auth.js'
import { h, banner, $ } from './ui.js'
import { authView, verifyView } from './view-auth.js'
import { dashboardView, newTicketView, threadView } from './view-tickets.js'
import { adminView } from './view-admin.js'
import { ID_RE } from './tickets.js'

const app = $('#app')
const nav = $('#nav')
$('#skip').addEventListener('click', () => app.focus())
let cleanup = null

const navigate = (hash) => {
  if (location.hash === hash) render()
  else location.hash = hash
}
const mount = (node, title) => {
  app.replaceChildren(node)
  document.title = title ? `${title} — X Orbit Support` : 'Support Center — X Orbit'
  window.scrollTo({ top: 0 })
}

function drawNav() {
  const u = A.state.user
  nav.replaceChildren(
    ...(u && u.emailVerified
      ? [
          h('a', { href: '#/' }, 'My tickets'),
          h('a', { href: '#/new' }, 'New ticket'),
          A.state.admin && h('a', { href: '#/admin', class: 'admin-link' }, 'Admin'),
          h('a', { href: '#/account', class: 'who', title: u.email }, u.email),
        ]
      : [h('a', { href: 'https://xorbit-browse.vercel.app/support' }, 'FAQ')]),
  )
}

function landing() {
  return h(
    'div',
    { class: 'landing' },
    h(
      'section',
      { class: 'hero' },
      h('div', { class: 'label' }, 'SUPPORT CENTER'),
      h('h1', { class: 'display' }, 'HOW CAN', h('br'), 'WE HELP?'),
      h(
        'p',
        { class: 'lede' },
        'Sign in to open a ticket and follow the whole conversation here. Your tickets are saved to your account.',
      ),
      h(
        'ul',
        { class: 'points' },
        h('li', {}, 'Sign in with Google, or create an account with your email.'),
        h('li', {}, 'Reply to us and see our answers in the same place.'),
        h('li', {}, 'Only you and X Orbit support can see your tickets.'),
      ),
    ),
    authView(() => render()),
  )
}

function accountView() {
  const u = A.state.user
  return {
    el: h(
      'div',
      { class: 'narrow' },
      h('div', { class: 'label' }, 'ACCOUNT'),
      h('h2', {}, 'Your account'),
      h(
        'dl',
        { class: 'meta' },
        h('dt', {}, 'Email'),
        h('dd', {}, u.email),
        h('dt', {}, 'Signed in with'),
        h(
          'dd',
          {},
          u.providerData
            .map((p) => (p.providerId === 'google.com' ? 'Google' : 'Email and password'))
            .join(', ') || '—',
        ),
        h('dt', {}, 'Role'),
        h('dd', {}, A.state.admin ? 'Administrator' : 'Customer'),
        h('dt', {}, 'User ID'),
        h('dd', { class: 'mono', id: 'uid' }, u.uid),
      ),
      h(
        'p',
        {},
        h(
          'button',
          { class: 'btn ghost', type: 'button', onclick: () => A.signOutUser() },
          'Sign out',
        ),
      ),
      h('h3', {}, 'Your data'),
      h(
        'p',
        { class: 'hint' },
        'We store your email, your name if you gave one, and the tickets and messages you send. Only you and X Orbit support can read them. You can delete any ticket yourself from its page. To delete your account entirely, open a ticket (category "Account or something else") and ask, or write to the support inbox.',
      ),
      h(
        'p',
        { class: 'hint' },
        'Never include passwords, card numbers or recovery codes in a ticket.',
      ),
    ),
    cleanup() {},
  }
}

function render() {
  if (cleanup) {
    try {
      cleanup()
    } catch {
      /* already gone */
    }
    cleanup = null
  }
  const route = location.hash.replace(/^#/, '') || '/'
  drawNav()
  if (!A.configured)
    return mount(
      h(
        'div',
        { class: 'narrow' },
        h('h1', { class: 'display small' }, 'SUPPORT CENTER'),
        banner(
          'The Support Center is being set up. Sign-in and tickets will be available very soon.',
          'info',
        ),
        h(
          'p',
          {},
          h('a', { href: 'https://xorbit-browse.vercel.app/support' }, 'Read the FAQ meanwhile'),
        ),
      ),
      'Setting up',
    )
  if (!A.state.ready) return mount(h('p', { class: 'hint' }, 'Loading...'))
  const u = A.state.user
  if (!u) return mount(landing(), 'Sign in')
  if (!u.emailVerified)
    return mount(
      verifyView(() => render()),
      'Confirm your email',
    )

  let view
  let m
  if (route === '/new') view = newTicketView(navigate)
  else if (route === '/account') view = accountView()
  else if ((m = /^\/t\/(.+)$/.exec(route)) && ID_RE.test(m[1]))
    view = threadView(m[1], 'user', navigate)
  else if (route === '/admin' || route.startsWith('/admin/')) {
    if (!A.state.admin)
      view = {
        el: h(
          'div',
          { class: 'narrow' },
          banner('This area is for X Orbit administrators.', 'error'),
          h('p', {}, h('a', { href: '#/' }, 'Back to your tickets')),
        ),
        cleanup() {},
      }
    else if ((m = /^\/admin\/t\/(.+)$/.exec(route)) && ID_RE.test(m[1]))
      view = threadView(m[1], 'admin', navigate)
    else view = adminView(() => A.signOutUser())
  } else view = dashboardView()
  cleanup = view.cleanup
  mount(
    view.el,
    route === '/new'
      ? 'New ticket'
      : route.startsWith('/admin')
        ? 'Admin'
        : route.startsWith('/t/')
          ? 'Ticket'
          : 'Your tickets',
  )
}

window.addEventListener('hashchange', render)
A.onState(() => render())
A.init()
render()
