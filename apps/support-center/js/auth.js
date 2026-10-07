// Sign-in (Google, or email + password with a verified email). Authorisation is NOT decided here: Firestore's
// security rules re-check the signed-in user, their verified email and admin status on every single request.
import * as fb from '/vendor/firebase.js'

const cfg = window.XORBIT_FIREBASE || {}
export const configured = Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId)

export const state = { user: null, admin: false, ready: false }
let auth, db
const listeners = new Set()
const emit = () => listeners.forEach((f) => f(state))
export const onState = (fn) => (listeners.add(fn), () => listeners.delete(fn))
export const getDb = () => db

export function init() {
  if (!configured) {
    state.ready = true
    return
  }
  const app = fb.initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
  })
  auth = fb.getAuth(app)
  db = fb.getFirestore(app)
  // Emulator hooks exist for automated tests only and are ignored anywhere except localhost.
  if (cfg.emulator && ['127.0.0.1', 'localhost'].includes(location.hostname)) {
    fb.connectAuthEmulator(auth, cfg.emulator.auth, { disableWarnings: true })
    fb.connectFirestoreEmulator(db, cfg.emulator.firestore[0], cfg.emulator.firestore[1])
  }
  fb.onAuthStateChanged(auth, async (user) => {
    state.user = user
    state.admin = false
    if (user && user.emailVerified) await checkAdmin(user)
    state.ready = true
    emit()
  })
}

/** UI hint only ("show the Admin link"). The database rules make the real decision. */
async function checkAdmin(user) {
  try {
    const t = await user.getIdTokenResult()
    if (t.signInProvider !== 'google.com') return
    state.admin = (await fb.getDoc(fb.doc(db, 'admins', user.uid))).exists()
  } catch {
    state.admin = false
  }
}

const COMMON = new Set([
  'password1',
  'password123',
  'qwerty123',
  'letmein123',
  'welcome123',
  'iloveyou1',
  'admin1234',
  'abc12345',
  'xorbit123',
  'passw0rd1',
])
export function passwordProblems(pw, email = '') {
  const p = []
  if (pw.length < 8) p.push('at least 8 characters')
  if (!/[a-z]/.test(pw)) p.push('a lowercase letter')
  if (!/[A-Z]/.test(pw)) p.push('an uppercase letter')
  if (!/\d/.test(pw)) p.push('a number')
  const local = email.split('@')[0].toLowerCase()
  if (COMMON.has(pw.toLowerCase())) p.push('something less common')
  else if (local.length >= 4 && pw.toLowerCase().includes(local))
    p.push('no part of your email address')
  return p
}

const persist = (remember) =>
  fb.setPersistence(auth, remember ? fb.browserLocalPersistence : fb.browserSessionPersistence)

export async function signUp(email, password, name, remember) {
  await persist(remember)
  const cred = await fb.createUserWithEmailAndPassword(auth, email, password)
  if (name) await fb.updateProfile(cred.user, { displayName: name.slice(0, 80) })
  await fb.sendEmailVerification(cred.user)
  return cred.user
}
export async function signIn(email, password, remember) {
  await persist(remember)
  return (await fb.signInWithEmailAndPassword(auth, email, password)).user
}
export async function signInWithGoogle(remember) {
  await persist(remember)
  const provider = new fb.GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return (await fb.signInWithPopup(auth, provider)).user
}
export const signOutUser = () => fb.signOut(auth)
export const resendVerification = () => fb.sendEmailVerification(auth.currentUser)
export const resetPassword = (email) => fb.sendPasswordResetEmail(auth, email)

/** After the person clicks the link in their email: reload the account and fetch a token that says "verified". */
export async function refreshVerified() {
  const was = state.user && state.user.emailVerified
  await auth.currentUser.reload()
  await auth.currentUser.getIdToken(true)
  state.user = auth.currentUser
  state.admin = false
  if (state.user.emailVerified) await checkAdmin(state.user)
  if (state.user.emailVerified !== was) emit() // only redraw when something changed, so messages on screen aren't wiped
  return state.user.emailVerified
}

export function friendlyError(e) {
  const c = (e && e.code) || ''
  if (
    [
      'auth/invalid-credential',
      'auth/wrong-password',
      'auth/user-not-found',
      'auth/invalid-email',
    ].includes(c)
  )
    return 'Incorrect email or password.'
  if (c === 'auth/email-already-in-use')
    return 'An account with that email already exists. Try signing in instead.'
  if (c === 'auth/weak-password') return 'Choose a stronger password.'
  if (c === 'auth/too-many-requests')
    return 'Too many attempts. Please wait a few minutes and try again.'
  if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request')
    return 'The sign-in window was closed before finishing.'
  if (c === 'auth/popup-blocked')
    return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
  if (c === 'auth/network-request-failed')
    return 'Network problem. Check your connection and try again.'
  if (c === 'auth/account-exists-with-different-credential')
    return 'That email is already registered another way. Sign in with your password, or use Google.'
  return 'Something went wrong. Please try again.'
}
