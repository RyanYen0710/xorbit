'use client'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { firebase } from '@/lib/firebase'

interface Review {
  uid: string
  rating: number
  text: string
  name: string
  at: number
}
interface Summary {
  count: number
  avg: number
}
type Fb = Awaited<ReturnType<typeof firebase>>

const SHOWN = 12 // newest reviews in the rotating line
const ROTATE_MS = 5000

function Stars({ value, size = 18 }: { value: number; size?: number }) {
  const gid = 'half' + useId().replace(/:/g, '')
  return (
    <span
      className="stars"
      role="img"
      aria-label={`${value.toFixed(1).replace('.0', '')} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <linearGradient id={gid}>
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path
            fill={value >= n - 0.25 ? 'currentColor' : value >= n - 0.75 ? `url(#${gid})` : 'none'}
            d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9z"
          />
        </svg>
      ))}
    </span>
  )
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(5, (value || 0) + 1))
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(1, (value || 2) - 1))
    else return
    e.preventDefault()
  }
  return (
    <div
      className="star-pick"
      role="radiogroup"
      aria-label="Your rating"
      onMouseLeave={() => setHover(0)}
      onKeyDown={key}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          tabIndex={value === n || (!value && n === 1) ? 0 : -1}
          data-on={shown >= n}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9z" />
          </svg>
        </button>
      ))}
      <span className="star-word" aria-live="polite">
        {['Tap a star', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][shown]}
      </span>
    </div>
  )
}

const friendly = (e: unknown) => {
  const c = (e as { code?: string })?.code ?? ''
  if (c.includes('popup-closed') || c.includes('cancelled')) return ''
  if (c.includes('popup-blocked'))
    return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
  if (c.includes('permission-denied'))
    return 'That was not accepted. Wait a few seconds if you just edited your review, then try again.'
  if (c.includes('network')) return 'No connection. Check your internet and try again.'
  return 'Something went wrong. Please try again.'
}

export function Reviews() {
  const [fb, setFb] = useState<Fb | null>(null)
  const [reviews, setReviews] = useState<Review[] | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [failed, setFailed] = useState(false)
  const [uid, setUid] = useState<string | null>(null)
  const [name0, setName0] = useState('')
  const [writing, setWriting] = useState(false)
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [sure, setSure] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const track = useRef<HTMLDivElement>(null)
  const paused = useRef(false)

  const refresh = useCallback(async (f: Fb) => {
    try {
      const q = f.query(
        f.collection(f.db, 'reviews'),
        f.orderBy('createdAt', 'desc'),
        f.limit(SHOWN),
      )
      const [snap, agg] = await Promise.all([
        f.getDocs(q),
        f.getAggregate(f.collection(f.db, 'reviews'), { n: f.count(), avg: f.average('rating') }),
      ])
      setReviews(
        snap.docs.map((d) => {
          const x = d.data()
          return {
            uid: d.id,
            rating: Number(x.rating) || 0,
            text: String(x.text ?? ''),
            name: String(x.name ?? ''),
            at: x.createdAt?.toMillis?.() ?? 0,
          }
        }),
      )
      const n = Number(agg.data().n) || 0
      setSummary(n ? { count: n, avg: Number(agg.data().avg) || 0 } : null)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    let off = () => {}
    let dead = false
    firebase()
      .then((f) => {
        if (dead) return
        setFb(f)
        void refresh(f)
        off = f.onAuthStateChanged(f.auth, (u) => {
          setUid(u?.uid ?? null)
          setName0((u?.displayName ?? '').split(' ')[0].slice(0, 30))
        })
      })
      .catch(() => setFailed(true))
    return () => {
      dead = true
      off()
    }
  }, [refresh])

  const mine = reviews?.find((r) => r.uid === uid)

  // The line rotates by itself, smoothly, one review at a time. It rests while you hover, focus, write, or
  // the tab is hidden, and never moves for people who ask for reduced motion.
  useEffect(() => {
    const el = track.current
    if (!el || !reviews || reviews.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      if (paused.current || document.hidden || writing || el.scrollWidth <= el.clientWidth + 4)
        return
      const cards = [...el.children] as HTMLElement[]
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      const next = atEnd
        ? cards[0]
        : (cards.find((c) => c.offsetLeft > el.scrollLeft + 4) ?? cards[0])
      el.scrollTo({ left: next.offsetLeft - cards[0].offsetLeft, behavior: 'smooth' })
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [reviews, writing])

  const open = () => {
    setMsg(null)
    setSure(false)
    setRating(mine?.rating ?? 0)
    setText(mine?.text ?? '')
    setName(mine?.name ?? name0)
    setWriting(true)
  }
  useEffect(() => {
    if (writing && !mine && !name) setName(name0)
  }, [writing, mine, name, name0])

  const signIn = async () => {
    if (!fb) return
    setBusy(true)
    setMsg(null)
    try {
      await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider())
    } catch (e) {
      const t = friendly(e)
      if (t) setMsg({ kind: 'error', text: t })
    } finally {
      setBusy(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fb || !uid) return
    if (!rating) return setMsg({ kind: 'error', text: 'Choose a star rating first.' })
    if (!name.trim())
      return setMsg({ kind: 'error', text: 'Enter the name to show with your review.' })
    setBusy(true)
    setMsg(null)
    try {
      const ref = fb.doc(fb.db, 'reviews', uid)
      const body = { rating, text: text.trim(), name: name.trim().slice(0, 30) }
      if (mine) await fb.updateDoc(ref, { ...body, updatedAt: fb.serverTimestamp() })
      else
        await fb.setDoc(ref, {
          ...body,
          createdAt: fb.serverTimestamp(),
          updatedAt: fb.serverTimestamp(),
        })
      setWriting(false)
      setMsg({
        kind: 'ok',
        text: mine ? 'Your review was updated.' : 'Thank you! Your review is live.',
      })
      await refresh(fb)
    } catch (err) {
      const t = friendly(err)
      if (t) setMsg({ kind: 'error', text: t })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!fb || !uid) return
    setBusy(true)
    try {
      await fb.deleteDoc(fb.doc(fb.db, 'reviews', uid))
      setWriting(false)
      setMsg({ kind: 'ok', text: 'Your review was deleted.' })
      await refresh(fb)
    } catch (err) {
      setMsg({ kind: 'error', text: friendly(err) || 'Could not delete. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="reviews">
      <div className="rev-top">
        <div className="rev-score" aria-live="polite">
          {summary ? (
            <>
              <span className="rev-avg display">{summary.avg.toFixed(1)}</span>
              <div>
                <Stars value={summary.avg} size={22} />
                <div className="label">
                  {summary.count} REVIEW{summary.count === 1 ? '' : 'S'}
                </div>
              </div>
            </>
          ) : (
            <p className="muted">
              {failed
                ? 'Reviews could not load right now.'
                : reviews
                  ? 'No reviews yet. Be the first to rate X Orbit.'
                  : 'Loading reviews…'}
            </p>
          )}
        </div>
        {!writing && (
          <button className="btn" type="button" onClick={open} disabled={!fb}>
            {mine ? 'Edit your review' : 'Rate X Orbit'}
          </button>
        )}
      </div>

      {msg && (
        <p
          className="rev-msg"
          data-kind={msg.kind}
          role={msg.kind === 'error' ? 'alert' : 'status'}
        >
          {msg.text}
        </p>
      )}

      {writing && (
        <div className="rev-form" role="region" aria-label="Write a review">
          {!uid ? (
            <>
              <p className="muted">
                Sign in with Google to leave a rating. Your email is never shown; only the name you
                choose.
              </p>
              <div className="rev-actions">
                <button className="btn" type="button" onClick={signIn} disabled={busy}>
                  {busy ? 'Opening Google…' : 'Sign in with Google'}
                </button>
                <button className="btn ghost" type="button" onClick={() => setWriting(false)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={submit}>
              <StarPicker value={rating} onChange={setRating} />
              <label className="rev-field">
                <span className="label">NAME TO SHOW</span>
                <input
                  value={name}
                  maxLength={30}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="given-name"
                />
              </label>
              <label className="rev-field">
                <span className="label">YOUR REVIEW (OPTIONAL) · {text.length}/500</span>
                <textarea
                  value={text}
                  maxLength={500}
                  rows={4}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What do you like? What could be better?"
                />
              </label>
              <div className="rev-actions">
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : mine ? 'Save changes' : 'Post review'}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => setWriting(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                {mine &&
                  (sure ? (
                    <>
                      <span className="muted small">Delete your review for good?</span>
                      <button className="link" type="button" onClick={remove} disabled={busy}>
                        Yes, delete
                      </button>
                      <button className="link" type="button" onClick={() => setSure(false)}>
                        Keep it
                      </button>
                    </>
                  ) : (
                    <button
                      className="link"
                      type="button"
                      onClick={() => setSure(true)}
                      disabled={busy}
                    >
                      Delete my review
                    </button>
                  ))}
              </div>
            </form>
          )}
        </div>
      )}

      {reviews && reviews.length > 0 && (
        <div
          className="rev-line"
          onMouseEnter={() => (paused.current = true)}
          onMouseLeave={() => (paused.current = false)}
          onFocus={() => (paused.current = true)}
          onBlur={() => (paused.current = false)}
        >
          <div
            className="rev-track"
            ref={track}
            tabIndex={0}
            aria-label="Reviews from people using X Orbit"
          >
            {reviews.map((r) => (
              <figure className="rev-card" key={r.uid}>
                <Stars value={r.rating} />
                {r.text && <blockquote>{r.text}</blockquote>}
                <figcaption>
                  <strong>{r.name}</strong>
                  {r.at ? (
                    <span className="label"> · {new Date(r.at).toLocaleDateString()}</span>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
