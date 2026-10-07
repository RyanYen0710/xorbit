// Attacks the Firestore rules from every angle. Run: node run-emulators.mjs rules
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing'
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import fs from 'node:fs'
import { setLogLevel } from 'firebase/firestore'
setLogLevel('silent')

const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
const env = await initializeTestEnvironment({
  projectId: 'demo-xorbit-support',
  firestore: {
    host,
    port: Number(port),
    rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
  },
})

let n = 0,
  failed = 0
const test = async (name, fn) => {
  try {
    await env.clearFirestore()
    await fn()
    n++
    console.log('✓', name)
  } catch (e) {
    failed++
    console.log('✗', name, '\n   ', (e.message || e).toString().split('\n')[0])
  }
}

const pwd = (uid, email = `${uid}@example.com`, o = {}) =>
  env
    .authenticatedContext(uid, {
      email,
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
      ...o,
    })
    .firestore()
const unverified = (uid) =>
  env
    .authenticatedContext(uid, {
      email: `${uid}@example.com`,
      email_verified: false,
      firebase: { sign_in_provider: 'password' },
    })
    .firestore()
const google = (uid, o = {}) =>
  env
    .authenticatedContext(uid, {
      email: `${uid}@gmail.com`,
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
      auth_time: Math.floor(Date.now() / 1000),
      ...o,
    })
    .firestore()
const anon = () => env.unauthenticatedContext().firestore()
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()))
const makeAdmin = (uid) => seed((db) => setDoc(doc(db, 'admins', uid), { ok: true }))

const ID = 'XO-261007-AB23'
const ticket = (uid, o = {}) => ({
  uid,
  email: `${uid}@example.com`,
  name: 'Pat',
  title: 'Installer will not open',
  category: 'Downloads and installer',
  product: 'X Orbit for Mac',
  impact: 'A feature is broken',
  details: 'I downloaded the dmg and macOS refuses to open it.',
  steps: '',
  expected: '',
  frequency: '',
  url: '',
  version: '',
  system: 'Mac',
  browser: '',
  diagnostics: '',
  status: 'open',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  lastMessageAt: serverTimestamp(),
  lastMessageBy: 'user',
  ...o,
})
const open = (db, uid, id = ID, o = {}) => {
  const b = writeBatch(db)
  b.set(doc(db, 'users', uid), { lastTicketAt: serverTimestamp() })
  b.set(doc(db, 'tickets', id), ticket(uid, o))
  return b.commit()
}
const seedTicket = (uid, id = ID, o = {}) =>
  seed((db) =>
    setDoc(doc(db, 'tickets', id), {
      ...ticket(uid, o),
      createdAt: Timestamp.fromMillis(Date.now() - 600000),
      updatedAt: Timestamp.fromMillis(Date.now() - 600000),
      lastMessageAt: Timestamp.fromMillis(Date.now() - 600000),
    }),
  )
const say = (db, id, role, text, extra = {}, uid) => {
  const b = writeBatch(db)
  b.update(doc(db, 'tickets', id), {
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessageBy: role,
    ...extra,
  })
  b.set(doc(db, 'tickets', id, 'messages', 'm' + Math.random().toString(36).slice(2)), {
    uid,
    role,
    text,
    createdAt: serverTimestamp(),
  })
  return b.commit()
}

// ── access ────────────────────────────────────────────────────────────────────────────────────────
await test('signed-out visitors can read and write nothing', async () => {
  await seedTicket('alice')
  await assertFails(getDoc(doc(anon(), 'tickets', ID)))
  await assertFails(getDocs(collection(anon(), 'tickets')))
  await assertFails(open(anon(), 'alice', 'XO-261007-ZZ22'))
})
await test('an unverified email address cannot create or read tickets', async () => {
  await assertFails(open(unverified('bob'), 'bob'))
  await seedTicket('bob')
  await assertFails(getDoc(doc(unverified('bob'), 'tickets', ID)))
})
await test('a verified user can open a ticket and read it back', async () => {
  const db = pwd('alice')
  await assertSucceeds(open(db, 'alice'))
  await assertSucceeds(getDoc(doc(db, 'tickets', ID)))
})

// ── validation ────────────────────────────────────────────────────────────────────────────────────
for (const [name, o] of [
  ['someone else’s uid', { uid: 'mallory' }],
  ['a spoofed email', { email: 'ceo@example.com' }],
  ['a too-short title', { title: 'hi' }],
  ['a too-long title', { title: 'x'.repeat(121) }],
  ['a too-short description', { details: 'too short' }],
  ['an oversized description', { details: 'x'.repeat(5001) }],
  ['an unknown category', { category: 'Hacking' }],
  ['an unknown product', { product: 'Windows' }],
  ['an unknown impact', { impact: 'meh' }],
  ['a status other than open', { status: 'solved' }],
  ['a client-chosen date', { createdAt: Timestamp.fromMillis(0) }],
  ['an extra hidden field', { isAdmin: true }],
  ['claiming the last message was from admin', { lastMessageBy: 'admin' }],
])
  await test(`ticket creation is refused with ${name}`, async () =>
    assertFails(open(pwd('alice'), 'alice', ID, o)))
await test('ticket creation is refused with a malformed ticket id', async () =>
  assertFails(open(pwd('alice'), 'alice', 'my-ticket')))
await test('ticket creation is refused without the rate-limit marker', async () =>
  assertFails(setDoc(doc(pwd('alice'), 'tickets', ID), ticket('alice'))))

// ── rate limit ────────────────────────────────────────────────────────────────────────────────────
await test('a second ticket within a minute is refused', async () => {
  const db = pwd('alice')
  await assertSucceeds(open(db, 'alice'))
  await assertFails(open(db, 'alice', 'XO-261007-CD45'))
})
await test('a second ticket after a minute is allowed', async () => {
  await seed((db) =>
    setDoc(doc(db, 'users', 'alice'), { lastTicketAt: Timestamp.fromMillis(Date.now() - 120000) }),
  )
  await assertSucceeds(open(pwd('alice'), 'alice', 'XO-261007-CD45'))
})

// ── privacy between users ─────────────────────────────────────────────────────────────────────────
await test('people cannot read other people’s tickets or list all tickets', async () => {
  await seedTicket('alice')
  const mallory = pwd('mallory')
  await assertFails(getDoc(doc(mallory, 'tickets', ID)))
  await assertFails(getDocs(collection(mallory, 'tickets')))
  await assertSucceeds(
    getDocs(query(collection(mallory, 'tickets'), where('uid', '==', 'mallory'))),
  )
  await assertFails(getDocs(query(collection(mallory, 'tickets'), where('uid', '==', 'alice'))))
})
await test('people cannot read other people’s messages or rate-limit docs', async () => {
  await seedTicket('alice')
  await seed((db) =>
    setDoc(doc(db, 'tickets', ID, 'messages', 'm1'), {
      uid: 'alice',
      role: 'user',
      text: 'hello',
      createdAt: Timestamp.now(),
    }),
  )
  await seed((db) => setDoc(doc(db, 'users', 'alice'), { lastTicketAt: Timestamp.now() }))
  await assertFails(getDoc(doc(pwd('mallory'), 'tickets', ID, 'messages', 'm1')))
  await assertFails(getDoc(doc(pwd('mallory'), 'users', 'alice')))
  await assertSucceeds(getDoc(doc(pwd('alice'), 'tickets', ID, 'messages', 'm1')))
})

// ── administrators ────────────────────────────────────────────────────────────────────────────────
await test('an administrator (listed, Google sign-in, fresh login) can read every ticket', async () => {
  await seedTicket('alice')
  await seedTicket('bob', 'XO-261007-EF67')
  await makeAdmin('boss')
  await assertSucceeds(getDocs(collection(google('boss'), 'tickets')))
  await assertSucceeds(getDoc(doc(google('boss'), 'tickets', ID)))
})
await test('being listed as admin is not enough on an email/password login', async () => {
  await seedTicket('alice')
  await makeAdmin('boss')
  await assertFails(getDoc(doc(pwd('boss'), 'tickets', ID)))
})
await test('a Google sign-in that is NOT listed is not an admin', async () => {
  await seedTicket('alice')
  await assertFails(getDoc(doc(google('stranger'), 'tickets', ID)))
})
await test('an admin whose login is older than 8 hours must sign in again', async () => {
  await seedTicket('alice')
  await makeAdmin('boss')
  await assertFails(
    getDoc(
      doc(google('boss', { auth_time: Math.floor(Date.now() / 1000) - 9 * 3600 }), 'tickets', ID),
    ),
  )
  await assertSucceeds(
    getDoc(
      doc(google('boss', { auth_time: Math.floor(Date.now() / 1000) - 7 * 3600 }), 'tickets', ID),
    ),
  )
})
await test('nobody can make themselves an admin', async () => {
  await assertFails(setDoc(doc(google('stranger'), 'admins', 'stranger'), { ok: true }))
  await makeAdmin('boss')
  await assertFails(setDoc(doc(google('boss'), 'admins', 'friend'), { ok: true }))
  await assertFails(deleteDoc(doc(google('boss'), 'admins', 'boss')))
  await assertSucceeds(getDoc(doc(google('boss'), 'admins', 'boss'))) // you can see your own admin entry
  await assertFails(getDoc(doc(google('stranger'), 'admins', 'boss'))) // and nobody else’s
})

// ── conversation ──────────────────────────────────────────────────────────────────────────────────
await test('the admin can reply and set the status in one step', async () => {
  await seedTicket('alice')
  await makeAdmin('boss')
  await assertSucceeds(
    say(google('boss'), ID, 'admin', 'Thanks, try Open Anyway.', { status: 'pending' }, 'boss'),
  )
})
await test('the owner can reply (after the rate-limit gap) and read the thread', async () => {
  await seedTicket('alice')
  const db = pwd('alice')
  await assertSucceeds(say(db, ID, 'user', 'It worked, thanks!', {}, 'alice'))
  await assertSucceeds(getDocs(collection(db, 'tickets', ID, 'messages')))
})
await test('a second reply within 5 seconds is refused', async () => {
  await seedTicket('alice')
  const db = pwd('alice')
  await assertSucceeds(say(db, ID, 'user', 'one', {}, 'alice'))
  await assertFails(say(db, ID, 'user', 'two', {}, 'alice'))
})
await test('nobody can post as someone else’s role', async () => {
  await seedTicket('alice')
  await makeAdmin('boss')
  await assertFails(say(pwd('alice'), ID, 'admin', 'I am staff', {}, 'alice'))
  await assertFails(say(google('boss'), ID, 'user', 'pretend', {}, 'boss'))
  await assertFails(say(pwd('mallory'), ID, 'user', 'butting in', {}, 'mallory'))
})
await test('messages must be written together with the ticket update, with sane size', async () => {
  await seedTicket('alice')
  await assertFails(
    setDoc(doc(pwd('alice'), 'tickets', ID, 'messages', 'x'), {
      uid: 'alice',
      role: 'user',
      text: 'orphan',
      createdAt: serverTimestamp(),
    }),
  )
  await assertFails(say(pwd('alice'), ID, 'user', '', {}, 'alice'))
  await assertFails(say(pwd('alice'), ID, 'user', 'x'.repeat(5001), {}, 'alice'))
})
await test('messages cannot be edited, and a closed ticket takes no new user messages', async () => {
  await seedTicket('alice', ID, { status: 'closed' })
  await seed((db) =>
    setDoc(doc(db, 'tickets', ID, 'messages', 'm1'), {
      uid: 'alice',
      role: 'user',
      text: 'old',
      createdAt: Timestamp.now(),
    }),
  )
  await assertFails(
    updateDoc(doc(pwd('alice'), 'tickets', ID, 'messages', 'm1'), { text: 'edited' }),
  )
  await assertFails(say(pwd('alice'), ID, 'user', 'more', {}, 'alice'))
})

// ── what can change on a ticket ───────────────────────────────────────────────────────────────────
await test('the owner can close their ticket but cannot mark it solved or edit its content', async () => {
  await seedTicket('alice')
  const db = pwd('alice')
  await assertFails(
    updateDoc(doc(db, 'tickets', ID), { status: 'solved', updatedAt: serverTimestamp() }),
  )
  await assertFails(
    updateDoc(doc(db, 'tickets', ID), {
      details: 'rewritten history',
      updatedAt: serverTimestamp(),
    }),
  )
  await assertFails(
    updateDoc(doc(db, 'tickets', ID), { uid: 'mallory', updatedAt: serverTimestamp() }),
  )
  await assertSucceeds(
    updateDoc(doc(db, 'tickets', ID), { status: 'closed', updatedAt: serverTimestamp() }),
  )
})
await test('the admin can change status but not the customer’s content', async () => {
  await seedTicket('alice')
  await makeAdmin('boss')
  const db = google('boss')
  await assertSucceeds(
    updateDoc(doc(db, 'tickets', ID), { status: 'solved', updatedAt: serverTimestamp() }),
  )
  await assertFails(
    updateDoc(doc(db, 'tickets', ID), { title: 'Edited by admin', updatedAt: serverTimestamp() }),
  )
  await assertFails(
    updateDoc(doc(db, 'tickets', ID), { status: 'banana', updatedAt: serverTimestamp() }),
  )
})

// ── deleting ──────────────────────────────────────────────────────────────────────────────────────
await test('an owner can delete their own ticket and thread; others cannot', async () => {
  await seedTicket('alice')
  await seed((db) =>
    setDoc(doc(db, 'tickets', ID, 'messages', 'm1'), {
      uid: 'alice',
      role: 'user',
      text: 'x',
      createdAt: Timestamp.now(),
    }),
  )
  await assertFails(deleteDoc(doc(pwd('mallory'), 'tickets', ID)))
  const alice = pwd('alice')
  const b = writeBatch(alice)
  b.delete(doc(alice, 'tickets', ID, 'messages', 'm1'))
  b.delete(doc(alice, 'tickets', ID))
  await assertSucceeds(b.commit())
})
await test('an unrelated collection is closed to everyone', async () => {
  await assertFails(setDoc(doc(pwd('alice'), 'secrets', 'x'), { a: 1 }))
  await makeAdmin('boss')
  await assertFails(getDoc(doc(google('boss'), 'secrets', 'x')))
})

await env.cleanup()
console.log(`\n${n} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
