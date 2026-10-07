import { useCallback, useEffect, useState } from 'react'
import { act, query, useOrbit } from '../state'
import { Row, Toggle } from './shared'

interface Status {
  ok: boolean
  backend: string
  auth: 'touchid' | 'none'
  never: string[]
}
interface LoginRow {
  id: string
  origin: string
  username: string
  updatedAt: number
}
interface CardRow {
  id: string
  name: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

const host = (o: string) => {
  try {
    return new URL(o).host
  } catch {
    return o
  }
}

function useVault() {
  const [status, setStatus] = useState<Status | null>(null)
  const [logins, setLogins] = useState<LoginRow[]>([])
  const [cards, setCards] = useState<CardRow[]>([])
  const refresh = useCallback(async () => {
    setStatus(await query('vaultStatus'))
    setLogins(await query('vaultLogins'))
    setCards(await query('vaultCards'))
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  return { status, logins, cards, refresh }
}

function Protection({ s, what }: { s: Status | null; what: string }) {
  if (!s) return null
  if (!s.ok)
    return (
      <p className="vault-note vault-bad" role="alert">
        Secure storage isn’t available on this computer, so {what} can’t be saved. X Orbit refuses
        to keep them unencrypted.
      </p>
    )
  return (
    <p className="vault-note">
      Stored encrypted on this computer only, using your {s.backend}. Never uploaded, never in the
      project’s files.{' '}
      {s.auth === 'touchid'
        ? 'Touch ID is required to show or copy a password or to fill a card.'
        : 'This system can’t ask for your fingerprint or password here, so anyone using your signed-in computer account could view them.'}
    </p>
  )
}

export function PasswordsSection() {
  const s = useOrbit()!
  const { status, logins, refresh } = useVault()
  const [msg, setMsg] = useState('')
  const [shown, setShown] = useState<Record<string, string>>({})
  const [site, setSite] = useState('')
  const [user, setUser] = useState('')
  const [pw, setPw] = useState('')

  const reveal = async (id: string) => {
    if (shown[id] !== undefined) return setShown(({ [id]: _x, ...rest }) => rest)
    const p = (await act('vaultReveal', { id })) as string
    if (!p) return setMsg('Couldn’t show that password')
    setShown((v) => ({ ...v, [id]: p }))
    setTimeout(() => setShown(({ [id]: _x, ...rest }) => rest), 10_000) // hides itself
  }
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const r = (await act('vaultAddLogin', { url: site, username: user, password: pw })) as string
    setMsg(r)
    if (r === 'Saved') {
      setSite('')
      setUser('')
      setPw('')
      void refresh()
    }
  }
  return (
    <>
      <Protection s={status} what="passwords" />
      <Row
        label="Offer to save passwords"
        hint="After you sign in, X Orbit asks before saving. Not offered in private windows."
      >
        <Toggle
          on={s.settings.offerToSavePasswords}
          onChange={(v) => act('setSetting', { key: 'offerToSavePasswords', value: v })}
          label="Offer to save passwords"
        />
      </Row>
      <div className="orbit-label sub">SAVED PASSWORDS</div>
      {status?.ok && logins.length === 0 && (
        <p className="srow-hint">
          None yet. Sign in to a site and choose Save, or add one below. Click a username or
          password box on a site to fill it.
        </p>
      )}
      {logins.map((l) => (
        <div className="vrow" key={l.id}>
          <span className="vsite">{host(l.origin)}</span>
          <span className="vuser">{l.username || '(no username)'}</span>
          <span className="vpw mono" aria-live="polite">
            {shown[l.id] ?? '••••••••'}
          </span>
          <span className="vbtns">
            <button className="btn ghost" onClick={() => reveal(l.id)}>
              {shown[l.id] !== undefined ? 'Hide' : 'Show'}
            </button>
            <button
              className="btn ghost"
              onClick={async () => setMsg((await act('vaultCopy', { id: l.id })) as string)}
            >
              Copy
            </button>
            <button
              className="btn ghost"
              onClick={async () => {
                if (confirm(`Delete the saved password for ${host(l.origin)}?`)) {
                  await act('vaultDeleteLogin', { id: l.id })
                  void refresh()
                }
              }}
            >
              Delete
            </button>
          </span>
        </div>
      ))}
      {status?.ok && (
        <form className="vform" onSubmit={add} autoComplete="off">
          <div className="orbit-label sub">ADD A PASSWORD</div>
          <input
            className="field"
            placeholder="Site (https://…)"
            aria-label="Site"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            autoComplete="off"
          />
          <input
            className="field"
            placeholder="Username or email"
            aria-label="Username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="off"
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            aria-label="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
          />
          <button className="btn ghost" type="submit">
            Save
          </button>
        </form>
      )}
      {status && status.never.length > 0 && (
        <>
          <div className="orbit-label sub">NEVER SAVE FOR</div>
          {status.never.map((o) => (
            <div className="vrow" key={o}>
              <span className="vsite">{host(o)}</span>
              <span className="vbtns">
                <button
                  className="btn ghost"
                  onClick={async () => {
                    await act('vaultNeverRemove', { origin: o })
                    void refresh()
                  }}
                >
                  Remove
                </button>
              </span>
            </div>
          ))}
        </>
      )}
      {msg && (
        <p className="orbit-label" role="status">
          {msg}
        </p>
      )}
      <p className="srow-hint">
        Passkeys aren’t supported yet: they need X Orbit to be code-signed so the operating system
        will let it use your device’s passkey storage.
      </p>
    </>
  )
}

export function PaymentsSection() {
  const { status, cards, refresh } = useVault()
  const [msg, setMsg] = useState('')
  const [f, setF] = useState({ name: '', number: '', month: '', year: '' })
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const r = (await act('vaultAddCard', {
      name: f.name,
      number: f.number,
      expMonth: Number(f.month),
      expYear: Number(f.year),
    })) as string
    setMsg(r)
    if (r === 'Added') {
      setF({ name: '', number: '', month: '', year: '' })
      void refresh()
    }
  }
  return (
    <>
      <Protection s={status} what="cards" />
      <p className="srow-hint">
        Security codes (CVV/CVC) are never saved: you type that yourself each time. Cards are
        offered on checkout forms that use standard card fields; embedded payment boxes from Stripe,
        PayPal and similar can’t be filled, by design.
      </p>
      <div className="orbit-label sub">SAVED CARDS</div>
      {status?.ok && cards.length === 0 && <p className="srow-hint">No cards saved.</p>}
      {cards.map((c) => (
        <div className="vrow" key={c.id}>
          <span className="vsite">
            {c.brand} •••• {c.last4}
          </span>
          <span className="vuser">{c.name || '—'}</span>
          <span className="vpw mono">
            {String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}
          </span>
          <span className="vbtns">
            <button
              className="btn ghost"
              onClick={async () => {
                if (confirm(`Delete ${c.brand} ending ${c.last4}?`)) {
                  await act('vaultDeleteCard', { id: c.id })
                  void refresh()
                }
              }}
            >
              Delete
            </button>
          </span>
        </div>
      ))}
      {status?.ok && (
        <form className="vform" onSubmit={add} autoComplete="off">
          <div className="orbit-label sub">ADD A CARD</div>
          <input
            className="field"
            placeholder="Name on card"
            aria-label="Name on card"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            autoComplete="off"
          />
          <input
            className="field"
            inputMode="numeric"
            placeholder="Card number"
            aria-label="Card number"
            value={f.number}
            onChange={(e) => setF({ ...f, number: e.target.value })}
            autoComplete="off"
          />
          <span className="vexp">
            <input
              className="field"
              inputMode="numeric"
              placeholder="MM"
              aria-label="Expiry month"
              maxLength={2}
              value={f.month}
              onChange={(e) => setF({ ...f, month: e.target.value })}
              autoComplete="off"
            />
            <input
              className="field"
              inputMode="numeric"
              placeholder="YYYY"
              aria-label="Expiry year"
              maxLength={4}
              value={f.year}
              onChange={(e) => setF({ ...f, year: e.target.value })}
              autoComplete="off"
            />
          </span>
          <button className="btn ghost" type="submit">
            Save card
          </button>
        </form>
      )}
      {msg && (
        <p className="orbit-label" role="status">
          {msg}
        </p>
      )}
    </>
  )
}
