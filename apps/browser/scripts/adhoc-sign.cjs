// electron-builder afterSign hook. Without an Apple Developer ID the app would be left with only the linker's
// signature, whose seal doesn't cover the app's resources: macOS then calls a downloaded copy "damaged".
// A full ad-hoc signature fixes that (macOS shows the normal "unidentified developer" prompt instead).
const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  if (process.env.CSC_LINK || process.env.CSC_NAME) return // a real certificate signs it instead
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' })
  console.log('  • ad-hoc signed and verified', app)
}
