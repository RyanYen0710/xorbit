import { h, banner, field, setErr } from './ui.js'
import * as A from './auth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Signed-out landing: Google, or email + password. `go` re-renders after success. */
export function authView(go) {
  let mode = 'signin'
  const root = h('div', { class: 'auth' })
  const msg = h('div', { 'aria-live': 'polite' })
  let busy = false

  const guard = async (fn) => {
    if (busy) return
    busy = true
    msg.replaceChildren()
    try {
      await fn()
    } catch (e) {
      msg.replaceChildren(banner(A.friendlyError(e), 'error'))
    } finally {
      busy = false
    }
  }

  const remember = h('input', { id: 'remember', type: 'checkbox', checked: true })
  const rememberRow = h(
    'div',
    { class: 'check' },
    remember,
    h('label', { for: 'remember' }, 'Keep me signed in on this device'),
  )

  function google() {
    return h(
      'button',
      {
        class: 'btn ghost wide',
        type: 'button',
        onclick: () =>
          guard(async () => {
            await A.signInWithGoogle(remember.checked)
            go()
          }),
      },
      'Continue with Google',
    )
  }

  function signInForm() {
    const email = h('input', {
      id: 'si-email',
      type: 'email',
      autocomplete: 'email',
      required: true,
      maxlength: '200',
    })
    const pw = h('input', {
      id: 'si-pw',
      type: 'password',
      autocomplete: 'current-password',
      required: true,
      maxlength: '200',
    })
    const form = h(
      'form',
      {
        novalidate: true,
        onsubmit: (e) => {
          e.preventDefault()
          submit()
        },
      },
      field('Email', email),
      field('Password', pw),
      h(
        'p',
        { class: 'row-links' },
        h(
          'button',
          {
            class: 'link',
            type: 'button',
            onclick: () => {
              mode = 'reset'
              draw()
            },
          },
          'Forgot password?',
        ),
      ),
      h('button', { class: 'btn wide', type: 'submit' }, 'Sign in'),
    )
    function submit() {
      setErr('si-email', '')
      setErr('si-pw', '')
      if (!EMAIL_RE.test(email.value.trim()))
        return setErr('si-email', 'Enter a valid email address.')
      if (!pw.value) return setErr('si-pw', 'Enter your password.')
      guard(async () => {
        await A.signIn(email.value.trim(), pw.value, remember.checked)
        go()
      })
    }
    return form
  }

  function signUpForm() {
    const name = h('input', { id: 'su-name', autocomplete: 'name', maxlength: '80' })
    const email = h('input', {
      id: 'su-email',
      type: 'email',
      autocomplete: 'email',
      required: true,
      maxlength: '200',
    })
    const pw = h('input', {
      id: 'su-pw',
      type: 'password',
      autocomplete: 'new-password',
      required: true,
      maxlength: '200',
      'aria-describedby': 'su-rules',
    })
    const pw2 = h('input', {
      id: 'su-pw2',
      type: 'password',
      autocomplete: 'new-password',
      required: true,
      maxlength: '200',
    })
    const RULES = ['at least 8 characters', 'an uppercase letter', 'a lowercase letter', 'a number']
    const rules = h('ul', { class: 'rules', id: 'su-rules', 'aria-live': 'polite' })
    function drawRules() {
      const bad = A.passwordProblems(pw.value, email.value)
      // Extra checks (common password / contains your email) only show up if they are the problem.
      const items = [...RULES, ...bad.filter((b) => !RULES.includes(b))]
      rules.replaceChildren(
        ...items.map((label) => {
          const ok = !bad.includes(label)
          return h(
            'li',
            { 'data-ok': String(ok) },
            h(
              'span',
              { class: 'mark', role: 'img', 'aria-label': ok ? 'met' : 'not met' },
              ok ? '\u2713' : '\u2717',
            ),
            label.charAt(0).toUpperCase() + label.slice(1),
          )
        }),
      )
    }
    const show = h('input', {
      id: 'su-show',
      type: 'checkbox',
      onchange: () => {
        pw.type = pw2.type = show.checked ? 'text' : 'password'
      },
    })
    pw.addEventListener('input', drawRules)
    email.addEventListener('input', () => pw.value && drawRules())
    drawRules()
    const form = h(
      'form',
      {
        novalidate: true,
        onsubmit: (e) => {
          e.preventDefault()
          submit()
        },
      },
      field('Name (optional)', name),
      field('Email', email),
      field('Password', pw),
      rules,
      field('Repeat password', pw2),
      h('div', { class: 'check' }, show, h('label', { for: 'su-show' }, 'Show passwords')),
      h('button', { class: 'btn wide', type: 'submit' }, 'Create account'),
      h(
        'p',
        { class: 'hint' },
        'We will email you a link to confirm your address before you can open tickets.',
      ),
    )
    function submit() {
      for (const i of ['su-email', 'su-pw', 'su-pw2']) setErr(i, '')
      if (!EMAIL_RE.test(email.value.trim()))
        return setErr('su-email', 'Enter a valid email address.')
      const p = A.passwordProblems(pw.value, email.value.trim())
      if (p.length) return setErr('su-pw', `Password needs: ${p.join(', ')}.`)
      if (pw.value !== pw2.value) return setErr('su-pw2', 'The passwords do not match.')
      guard(async () => {
        await A.signUp(email.value.trim(), pw.value, name.value.trim(), remember.checked)
        go()
      })
    }
    return form
  }

  function resetForm() {
    const email = h('input', {
      id: 'rs-email',
      type: 'email',
      autocomplete: 'email',
      required: true,
    })
    return h(
      'form',
      {
        novalidate: true,
        onsubmit: (e) => {
          e.preventDefault()
          setErr('rs-email', '')
          if (!EMAIL_RE.test(email.value.trim()))
            return setErr('rs-email', 'Enter a valid email address.')
          // Same answer whether or not an account exists, so this form can't be used to discover who has one.
          guard(async () => {
            try {
              await A.resetPassword(email.value.trim())
            } catch (err) {
              if (err.code === 'auth/too-many-requests') throw err
            }
            msg.replaceChildren(
              banner('If an account exists for that address, a reset link is on its way.', 'info'),
            )
          })
        },
      },
      h(
        'p',
        { class: 'hint' },
        'Enter your email and we will send you a link to choose a new password.',
      ),
      field('Email', email),
      h('button', { class: 'btn wide', type: 'submit' }, 'Send reset link'),
      h(
        'p',
        { class: 'row-links' },
        h(
          'button',
          {
            class: 'link',
            type: 'button',
            onclick: () => {
              mode = 'signin'
              draw()
            },
          },
          'Back to sign in',
        ),
      ),
    )
  }

  function draw() {
    const tab = (id, label) =>
      h(
        'button',
        {
          class: 'tab',
          type: 'button',
          role: 'tab',
          'aria-selected': String(mode === id),
          onclick: () => {
            mode = id
            draw()
          },
        },
        label,
      )
    root.replaceChildren(
      mode !== 'reset' &&
        h(
          'div',
          { class: 'tabs', role: 'tablist' },
          tab('signin', 'Sign in'),
          tab('signup', 'Create account'),
        ),
      mode === 'reset' ? h('h2', {}, 'Reset your password') : google(),
      mode !== 'reset' && h('p', { class: 'or' }, 'or use email'),
      mode === 'signin' ? signInForm() : mode === 'signup' ? signUpForm() : resetForm(),
      mode !== 'reset' && rememberRow,
      msg,
    )
  }
  draw()
  return root
}

/** Email/password accounts must confirm their address before the database lets them do anything. */
export function verifyView(go) {
  const msg = h('div', { 'aria-live': 'polite' })
  let last = 0
  // true only right after sign-up (the screen can redraw a few times in a row, so expire it by time)
  const fresh = A.state.justCreated
  if (fresh) setTimeout(() => (A.state.justCreated = false), 4000)
  return h(
    'div',
    { class: 'auth' },
    fresh &&
      h(
        'div',
        { class: 'success', role: 'status' },
        h('span', { class: 'success-mark', 'aria-hidden': 'true' }),
        h('p', { class: 'success-text' }, 'Account created'),
      ),
    h('h2', {}, 'Confirm your email'),
    h(
      'p',
      {},
      'We sent a confirmation link to ',
      h('strong', {}, A.state.user.email),
      '. Open it, then come back and press the button. Check your spam folder if you do not see it.',
    ),
    h(
      'p',
      { class: 'actions-row' },
      h(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: async () => {
            msg.replaceChildren()
            try {
              if (await A.refreshVerified()) go()
              else
                msg.replaceChildren(
                  banner('Not confirmed yet. Open the link in the email first.', 'info'),
                )
            } catch (e) {
              msg.replaceChildren(banner(A.friendlyError(e), 'error'))
            }
          },
        },
        'I have confirmed',
      ),
      h(
        'button',
        {
          class: 'btn ghost',
          type: 'button',
          onclick: async () => {
            if (Date.now() - last < 60000)
              return msg.replaceChildren(
                banner('Please wait a minute before asking for another email.', 'info'),
              )
            last = Date.now()
            try {
              await A.resendVerification()
              msg.replaceChildren(banner('Sent again.', 'info'))
            } catch (e) {
              msg.replaceChildren(banner(A.friendlyError(e), 'error'))
            }
          },
        },
        'Send the email again',
      ),
      h(
        'button',
        { class: 'btn ghost', type: 'button', onclick: () => A.signOutUser() },
        'Use a different account',
      ),
    ),
    msg,
  )
}
