// Public Firebase web settings for the reviews (identifiers, not secrets: access is enforced by Firestore rules
// and Google sign-in). Same project as the Support Center.
const config = {
  apiKey: 'AIzaSyA5KXBEVA6dgIqWm_9m7hMr1U_gI4FN45A',
  authDomain: 'x-orbit-545e2.firebaseapp.com',
  projectId: 'x-orbit-545e2',
  appId: '1:571156036904:web:7f6de0c044322abd14a41d',
}

let cached: ReturnType<typeof load> | null = null

/** Loads the Firebase pieces on demand (the home page stays light until the reviews section needs them). */
export function firebase() {
  return (cached ??= load())
}

async function load() {
  const [{ initializeApp, getApps }, authMod, fs] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore/lite'),
  ])
  const emulator = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1' // local tests only
  const app =
    getApps()[0] ??
    initializeApp(emulator ? { ...config, projectId: 'demo-xorbit-support' } : config)
  const auth = authMod.getAuth(app)
  const db = fs.getFirestore(app)
  if (emulator) {
    authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    fs.connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }
  return { auth, db, ...authMod, ...fs }
}
