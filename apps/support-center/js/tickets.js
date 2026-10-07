// Ticket reads/writes. Every write here is validated again by firestore.rules on Google's servers.
import * as fb from '/vendor/firebase.js'
import { getDb } from './auth.js'
import { ms } from './ui.js'

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export function newTicketId() {
  const d = new Date()
  const ymd =
    String(d.getFullYear()).slice(2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  const r = crypto.getRandomValues(new Uint8Array(4))
  return `XO-${ymd}-${[...r].map((n) => ALPHABET[n % ALPHABET.length]).join('')}`
}
export const ID_RE = /^XO-\d{6}-[2-9A-HJKMNP-Z]{4}$/

const snapData = (s) => ({ id: s.id, ...s.data({ serverTimestamps: 'estimate' }) })
export const normalize = (t) => ({
  ...t,
  created: ms(t.createdAt),
  updated: ms(t.updatedAt),
  last: ms(t.lastMessageAt),
})

/** Create the ticket and stamp the per-person rate-limit marker in ONE batch (the rules require both). */
export async function createTicket(user, f) {
  const db = getDb()
  const id = newTicketId()
  const b = fb.writeBatch(db)
  b.set(fb.doc(db, 'users', user.uid), { lastTicketAt: fb.serverTimestamp() })
  b.set(fb.doc(db, 'tickets', id), {
    uid: user.uid,
    email: user.email,
    name: f.name,
    title: f.title,
    category: f.category,
    product: f.product,
    impact: f.impact,
    details: f.details,
    steps: f.steps,
    expected: f.expected,
    frequency: f.frequency,
    url: f.url,
    version: f.version,
    system: f.system,
    browser: f.browser,
    diagnostics: f.diagnostics,
    status: 'open',
    createdAt: fb.serverTimestamp(),
    updatedAt: fb.serverTimestamp(),
    lastMessageAt: fb.serverTimestamp(),
    lastMessageBy: 'user',
  })
  await b.commit()
  return id
}

/** A reply = a new message + the ticket's conversation fields, written together. */
export async function sendMessage(ticketId, uid, role, text, status) {
  const db = getDb()
  const b = fb.writeBatch(db)
  const patch = {
    updatedAt: fb.serverTimestamp(),
    lastMessageAt: fb.serverTimestamp(),
    lastMessageBy: role,
  }
  if (status) patch.status = status
  b.update(fb.doc(db, 'tickets', ticketId), patch)
  b.set(fb.doc(fb.collection(db, 'tickets', ticketId, 'messages')), {
    uid,
    role,
    text,
    createdAt: fb.serverTimestamp(),
  })
  await b.commit()
}
export const setStatus = (ticketId, status) =>
  fb.updateDoc(fb.doc(getDb(), 'tickets', ticketId), { status, updatedAt: fb.serverTimestamp() })

export async function deleteTicket(ticketId) {
  const db = getDb()
  const msgs = await fb.getDocs(fb.collection(db, 'tickets', ticketId, 'messages'))
  const b = fb.writeBatch(db)
  msgs.forEach((m) => b.delete(m.ref))
  b.delete(fb.doc(db, 'tickets', ticketId))
  await b.commit()
}

export function watchMine(uid, cb, onError) {
  const q = fb.query(fb.collection(getDb(), 'tickets'), fb.where('uid', '==', uid))
  return fb.onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => normalize(snapData(d))).sort((a, b) => b.last - a.last)),
    onError,
  )
}
export function watchAll(cb, onError) {
  const q = fb.query(
    fb.collection(getDb(), 'tickets'),
    fb.orderBy('createdAt', 'desc'),
    fb.limit(300),
  )
  return fb.onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => normalize(snapData(d))).sort((a, b) => b.last - a.last)),
    onError,
  )
}
export function watchTicket(id, cb, onError) {
  return fb.onSnapshot(
    fb.doc(getDb(), 'tickets', id),
    (s) => cb(s.exists() ? normalize(snapData(s)) : null),
    onError,
  )
}
export function watchMessages(id, cb, onError) {
  const q = fb.query(
    fb.collection(getDb(), 'tickets', id, 'messages'),
    fb.orderBy('createdAt', 'asc'),
  )
  return fb.onSnapshot(
    q,
    (s) =>
      cb(
        s.docs.map((d) => ({
          ...snapData(d),
          at: ms(d.data({ serverTimestamps: 'estimate' }).createdAt),
        })),
      ),
    onError,
  )
}

// "New reply" markers live only in this browser.
export const seenKey = (id) => `xo-seen-${id}`
export const markSeen = (id, t) => {
  try {
    localStorage.setItem(seenKey(id), String(t))
  } catch {
    /* private mode */
  }
}
export const hasUnseen = (t, role) => {
  if (t.lastMessageBy === role) return false
  try {
    return Number(localStorage.getItem(seenKey(t.id)) || 0) < t.last
  } catch {
    return false
  }
}

/** Optional free heads-up email to the support inbox. Deliberately contains no personal data and no ticket text. */
export async function notifyInbox(id, category, product) {
  const key = (window.XORBIT_SUPPORT || {}).accessKey
  if (!key) return
  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: key,
        subject: `[${id}] New support ticket`,
        from_name: 'X Orbit Support Center',
        message: `A new ticket was opened.\n\nTicket: ${id}\nCategory: ${category}\nProduct: ${product}\n\nOpen it in the admin area:\n${location.origin}/#/admin/t/${id}\n`,
      }),
    })
  } catch {
    /* best effort: the ticket itself is already saved */
  }
}
