import { useEffect, useState } from 'react'
import { PASSWORD_RULES, passwordProblems } from '../../shared/password'
import { act, useOrbit } from '../state'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
type Mode = 'signin' | 'signup' | 'reset'
type Msg = { kind: 'ok' | 'error'; text: string } | null

// Set right after an account is created so the next screen plays the green tick once.
let justCreatedAt = 0

/** Runs an account action and turns "!message" results into an error message. */
async function run(type: string, payload?: Record<string, unknown>): Promise<string | null> {
  const r = (await act(type, payload)) as string | undefined
  return typeof r === 'string' && r.startsWith('!') ? r.slice(1) : null
}

function Rules({ pw, email }: { pw: string; email: string }) {
  const bad = passwordProblems(pw, email)
  // extra checks (common password / part of your email) only show up when they are the problem
  const items = [
    ...PASSWORD_RULES,
    ...bad.filter((b) => !(PASSWORD_RULES as readonly string[]).includes(b)),
  ]
  return (
    <ul className="rules" id="acct-rules" aria-live="polite">
      {items.map((label) => {
        const ok = !bad.includes(label)
        return (
          <li key={label} data-ok={ok}>
            <span className="mark" role="img" aria-label={ok ? 'met' : 'not met'}>
              {ok ? '✓' : '✗'}
            </span>
            {label.charAt(0).toUpperCase() + label.slice(1)}
          </li>
        )
      })}
    </ul>
  )
}

function Banner({ m }: { m: Msg }) {
  return m ? (
    <p className="acct-msg" data-kind={m.kind} role={m.kind === 'error' ? 'alert' : 'status'}>
      {m.text}
    </p>
  ) : null
}

function GoogleButton({
  busy,
  waiting,
  link,
}: {
  busy: boolean
  waiting: boolean
  link?: boolean
}) {
  const [msg, setMsg] = useState<Msg>(null)
  if (waiting)
    return (
      <div className="acct-wait" role="status">
        <span className="spin" aria-hidden="true" />
        <span>Finish signing in with Google in your browser, then come back here.</span>
        <button className="btn ghost" onClick={() => act('accountGoogleCancel')}>
          Cancel
        </button>
      </div>
    )
  return (
    <>
      <button
        className="btn ghost wide"
        disabled={busy}
        onClick={async () => {
          const err = await run('accountGoogle', { link: !!link })
          setMsg(err ? { kind: 'error', text: err } : null)
        }}
      >
        {link ? 'Link your Google account' : 'Continue with Google'}
      </button>
      <p className="srow-hint">
        Opens your regular browser, because Google does not allow sign-in inside X Orbit.
      </p>
      <Banner m={msg} />
    </>
  )
}

function AuthForms({ busy, waiting, error }: { busy: boolean; waiting: boolean; error: string }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const type = show ? 'text' : 'password'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    const mail = email.trim()
    if (!EMAIL_RE.test(mail)) return setMsg({ kind: 'error', text: 'Enter a valid email address.' })
    if (mode === 'reset') {
      const err = await run('accountReset', { email: mail })
      return setMsg(
        err
          ? { kind: 'error', text: err }
          : {
              kind: 'ok',
              text: 'If an account exists for that address, a reset link is on its way.',
            },
      )
    }
    if (mode === 'signup') {
      const bad = passwordProblems(pw, mail)
      if (bad.length) return setMsg({ kind: 'error', text: `Password needs: ${bad.join(', ')}.` })
      if (pw !== pw2) return setMsg({ kind: 'error', text: 'The passwords do not match.' })
      const err = await run('accountSignUp', { email: mail, password: pw, name })
      if (err) return setMsg({ kind: 'error', text: err })
      justCreatedAt = Date.now()
      return
    }
    if (!pw) return setMsg({ kind: 'error', text: 'Enter your password.' })
    const err = await run('accountSignIn', { email: mail, password: pw })
    if (err) setMsg({ kind: 'error', text: err })
  }

  return (
    <div className="acct">
      {mode !== 'reset' && (
        <div className="acct-tabs" role="tablist">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m)
                setMsg(null)
              }}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}
      {mode === 'reset' ? (
        <h3 className="acct-h">Reset your password</h3>
      ) : (
        <>
          <GoogleButton busy={busy} waiting={waiting} />
          <p className="acct-or">or use email</p>
        </>
      )}
      {error && <Banner m={{ kind: 'error', text: error }} />}
      <form onSubmit={submit} noValidate>
        {mode === 'signup' && (
          <label className="acct-field">
            <span className="orbit-label">NAME (OPTIONAL)</span>
            <input
              className="field"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
        )}
        <label className="acct-field">
          <span className="orbit-label">EMAIL</span>
          <input
            className="field"
            type="email"
            value={email}
            maxLength={200}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        {mode !== 'reset' && (
          <label className="acct-field">
            <span className="orbit-label">PASSWORD</span>
            <input
              className="field"
              type={type}
              value={pw}
              maxLength={200}
              onChange={(e) => setPw(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              aria-describedby={mode === 'signup' ? 'acct-rules' : undefined}
            />
          </label>
        )}
        {mode === 'signup' && (
          <>
            <Rules pw={pw} email={email} />
            <label className="acct-field">
              <span className="orbit-label">REPEAT PASSWORD</span>
              <input
                className="field"
                type={type}
                value={pw2}
                maxLength={200}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          </>
        )}
        {mode !== 'reset' && (
          <label className="acct-check">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />{' '}
            Show password
          </label>
        )}
        <button className="btn wide" type="submit" disabled={busy}>
          {busy
            ? 'Please wait…'
            : mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : 'Send reset link'}
        </button>
        {mode === 'signup' && (
          <p className="srow-hint">We will email you a link to confirm your address.</p>
        )}
        {mode === 'signin' && (
          <button type="button" className="link" onClick={() => (setMode('reset'), setMsg(null))}>
            Forgot password?
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="link" onClick={() => (setMode('signin'), setMsg(null))}>
            Back to sign in
          </button>
        )}
        <Banner m={msg} />
      </form>
    </div>
  )
}

function VerifyView({ email }: { email: string }) {
  const [msg, setMsg] = useState<Msg>(null)
  const [fresh] = useState(() => Date.now() - justCreatedAt < 4000)
  return (
    <div className="acct">
      {fresh && (
        <div className="success" role="status">
          <span className="success-mark" aria-hidden="true" />
          <p className="success-text">Account created</p>
        </div>
      )}
      <h3 className="acct-h">Confirm your email</h3>
      <p>
        We sent a confirmation link to <strong>{email}</strong>. Open it, then come back and press
        the button. Check your spam folder if you do not see it.
      </p>
      <div className="acct-row">
        <button
          className="btn"
          onClick={async () => {
            const err = await run('accountVerified')
            setMsg(err ? { kind: 'error', text: err } : null)
          }}
        >
          I have confirmed
        </button>
        <button
          className="btn ghost"
          onClick={async () => {
            const err = await run('accountResend')
            setMsg(err ? { kind: 'error', text: err } : { kind: 'ok', text: 'Sent again.' })
          }}
        >
          Send the email again
        </button>
        <button className="btn ghost" onClick={() => act('accountSignOut')}>
          Use a different account
        </button>
      </div>
      <Banner m={msg} />
    </div>
  )
}

function SignedIn({ busy, waiting, error }: { busy: boolean; waiting: boolean; error: string }) {
  const a = useOrbit()!.account
  const hasGoogle = a.providers.includes('google.com')
  const hasPassword = a.providers.includes('password')
  return (
    <div className="acct">
      <div className="acct-who">
        <span className="acct-avatar" aria-hidden="true">
          {(a.name || a.email || '?').charAt(0).toUpperCase()}
        </span>
        <div>
          <div className="acct-name">{a.name || a.email}</div>
          {a.name && <div className="srow-hint">{a.email}</div>}
        </div>
      </div>
      <ul className="acct-list">
        <li data-ok={a.verified}>
          <span className="mark">{a.verified ? '✓' : '✗'}</span> Email{' '}
          {a.verified ? 'confirmed' : 'not confirmed'}
        </li>
        {hasPassword && (
          <li data-ok="true">
            <span className="mark">{'✓'}</span> Email and password sign-in
          </li>
        )}
        <li data-ok={hasGoogle}>
          <span className="mark">{hasGoogle ? '✓' : '✗'}</span> Google{' '}
          {hasGoogle ? 'linked' : 'not linked'}
        </li>
      </ul>
      {error && <Banner m={{ kind: 'error', text: error }} />}
      {!hasGoogle && <GoogleButton busy={busy} waiting={waiting} link />}
      <p className="srow-hint">
        The same account works on the Support Center and for reviews on the website. Syncing your
        bookmarks, Spaces and themes between devices is coming next.
      </p>
      <div className="acct-row">
        <button className="btn ghost" onClick={() => act('accountSignOut')}>
          Sign out
        </button>
      </div>
    </div>
  )
}

export function AccountSection() {
  const a = useOrbit()!.account
  // a saved sign-in is only unlocked (Keychain read) once this page is opened, never at launch
  useEffect(() => {
    void act('accountOpen')
  }, [])
  // poll gently for the confirmation while the "confirm your email" screen is open
  useEffect(() => {
    if (!a.signedIn || a.verified || !a.providers.includes('password')) return
    const id = setInterval(() => void act('accountPoll'), 6000)
    return () => clearInterval(id)
  }, [a.signedIn, a.verified, a.providers])
  if (a.loading && !a.email) return <p className="srow-hint">Checking your sign-in…</p>
  if (
    a.signedIn &&
    !a.verified &&
    a.providers.includes('password') &&
    !a.providers.includes('google.com')
  )
    return <VerifyView email={a.email} />
  if (a.signedIn) return <SignedIn busy={a.busy} waiting={a.googleWaiting} error={a.error} />
  return <AuthForms busy={a.busy} waiting={a.googleWaiting} error={a.error} />
}
