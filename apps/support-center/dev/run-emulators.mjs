// Runs a test script with the Firebase Auth + Firestore emulators started around it.
// Java and the emulator downloads live inside the project (.tools/), never in your home folder.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const root = path.resolve(import.meta.dirname, '../../..')
const tools = path.join(root, '.tools')
const javaHome = path.join(tools, 'jre/Contents/Home')
if (!fs.existsSync(path.join(javaHome, 'bin/java'))) {
  console.error(`Java not found at ${javaHome}. See README (Testing) to download it into .tools/.`)
  process.exit(1)
}
const script = { rules: 'rules.test.mjs', app: 'app.e2e.mjs' }[process.argv[2]]
if (!script) {
  console.error('usage: node run-emulators.mjs rules|app')
  process.exit(1)
}

const r = spawnSync(
  path.join(import.meta.dirname, 'node_modules/.bin/firebase'),
  [
    'emulators:exec',
    '--only',
    'firestore,auth',
    '--project',
    'demo-xorbit-support',
    '--config',
    'firebase.json',
    `node dev/${script}`,
  ],
  {
    cwd: path.resolve(import.meta.dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      JAVA_HOME: javaHome,
      PATH: `${path.join(javaHome, 'bin')}:${process.env.PATH}`,
      FIREBASE_EMULATORS_PATH: path.join(tools, 'firebase-emulators'),
      XDG_CONFIG_HOME: path.join(tools, 'config'),
      CI: 'true',
    },
  },
)
process.exit(r.status ?? 1)
