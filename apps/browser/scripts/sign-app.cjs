// electron-builder afterSign hook.
//  1. With a real Apple certificate (CSC_LINK / CSC_NAME) electron-builder signs the app itself and this does nothing.
//  2. Otherwise, if the local X Orbit signing identity exists (.tools/signing, created once; NOT in the repo), the app is signed
//     with it. Every build then carries the same signing requirement, so macOS keeps trusting the app's Keychain item
//     ("X Orbit Safe Storage") across updates instead of asking for permission again after each one.
//  3. Otherwise a plain ad-hoc signature is used (valid, but a new Keychain permission prompt after every update).
// Without any full signature macOS calls a downloaded copy "damaged", so one of these always runs.
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const dir = path.resolve(__dirname, '../../../.tools/signing')
const keychain = path.join(dir, 'orbit-signing.keychain-db')

function localIdentity() {
  if (!fs.existsSync(keychain)) return null
  const pw = fs.readFileSync(path.join(dir, 'keychain-password.txt'), 'utf8').trim()
  execFileSync('security', ['unlock-keychain', '-p', pw, keychain], { stdio: 'ignore' })
  const out = execFileSync('security', ['find-identity', '-p', 'codesigning', keychain]).toString()
  return /([0-9A-F]{40}) "X Orbit Code Signing"/.exec(out)?.[1] ?? null
}

exports.default = async function signApp(context) {
  if (context.electronPlatformName !== 'darwin') return
  if (process.env.CSC_LINK || process.env.CSC_NAME) return // a real certificate signs it instead
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const id = localIdentity()
  const args = id
    ? ['--force', '--deep', '--sign', id, '--keychain', keychain, app]
    : ['--force', '--deep', '--sign', '-', app]
  execFileSync('codesign', args, { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' })
  console.log(`  • signed (${id ? 'X Orbit local identity' : 'ad-hoc'}) and verified`, app)
}
