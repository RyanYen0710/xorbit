'use client'
import { useEffect, useState } from 'react'
import { firebase } from '@/lib/firebase'

/**
 * The sign-in step for the X Orbit app. Google does not allow sign-in inside X Orbit, so the app opens this page in the
 * person's normal browser. After Google sign-in, a short-lived Google ID token goes back to the app, which is listening
 * on 127.0.0.1 only (a one-shot local server). Nothing else is sent anywhere, and this browser is signed out again.
 */
export function AppSignIn() {
  const [args, setArgs] = useState<
    { port: number; state: string; link: boolean } | null | undefined
  >(undefined)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const port = Number(q.get('port'))
    const state = q.get('state') ?? ''
    // Only a plain local port and the app's own secret are accepted: this page never redirects anywhere else.
    setArgs(
      Number.isInteger(port) && port >= 1024 && port <= 65535 && /^[0-9a-f]{64}$/.test(state)
        ? { port, state, link: q.get('mode') === 'link' }
        : null,
    )
  }, [])

  const go = async () => {
    if (!args) return
    setBusy(true)
    setError('')
    try {
      const f = await firebase()
      await f.setPersistence(f.auth, f.inMemoryPersistence)
      const res = await f.signInWithPopup(f.auth, new f.GoogleAuthProvider())
      const gid = f.GoogleAuthProvider.credentialFromResult(res)?.idToken
      // Signing in here makes a Firebase user for a brand-new Google identity. When the app only wants to LINK that
      // identity to an existing account, remove the just-created stray user first so the link can succeed. An
      // identity that already belonged to an X Orbit account is never touched.
      if (args.link && f.getAdditionalUserInfo(res)?.isNewUser)
        await f.deleteUser(res.user).catch(() => {})
      await f.signOut(f.auth) // nothing stays signed in on this page
      if (!gid) throw new Error('no token')
      setDone(true)
      window.location.replace(
        `http://127.0.0.1:${args.port}/done#state=${args.state}&gid=${encodeURIComponent(gid)}`,
      )
    } catch (e) {
      const c = (e as { code?: string })?.code ?? ''
      setError(
        c.includes('popup-closed') || c.includes('cancelled')
          ? ''
          : c.includes('popup-blocked')
            ? 'Your browser blocked the Google window. Allow pop-ups for this page and try again.'
            : 'Sign-in did not work. Go back to X Orbit and try again.',
      )
      setBusy(false)
    }
  }

  if (args === undefined) return <p className="muted">Loading…</p>
  if (args === null)
    return (
      <p className="muted" role="alert">
        This link is not valid. Open X Orbit, go to Settings → Account and choose Continue with
        Google.
      </p>
    )
  return (
    <div className="prose" style={{ maxWidth: 520 }}>
      <h2 className="display" style={{ fontSize: 32 }}>
        Sign in to X Orbit with Google
      </h2>
      <p className="muted">
        You came from the X Orbit app. Sign in with Google here and you will be sent straight back
        to the app. Your Google password is never shared with X Orbit.
      </p>
      {done ? (
        <p role="status">Signed in. You can close this tab and go back to X Orbit.</p>
      ) : (
        <>
          <button className="btn" type="button" onClick={go} disabled={busy}>
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </button>
          {error && (
            <p role="alert" style={{ color: '#e5775f' }}>
              {error}
            </p>
          )}
        </>
      )}
    </div>
  )
}
