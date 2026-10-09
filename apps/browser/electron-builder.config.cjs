// Packaging config. Signing/notarization/publishing are driven by env vars — see docs/distribution.md.
const owner = process.env.ORBIT_GH_OWNER
const repo = process.env.ORBIT_GH_REPO

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'app.xorbit.browser',
  productName: 'X Orbit',
  copyright: 'Copyright © X Orbit',
  // ".noindex" makes Spotlight and Launchpad ignore the build copies of the app, so only /Applications/X Orbit.app shows up.
  directories: { output: 'release.noindex', buildResources: 'resources' },
  files: ['out/**/*', 'package.json'],
  asar: true,
  // Electron "fuses": switches burned into the app so a local attacker cannot turn it into a general-purpose tool.
  // Off by default in Electron, so we turn them off/on here. (Tests attach a debugger to a packaged copy, so the
  // test build, made with ORBIT_TEST_BUILD=1, is the only one that keeps the inspector; shipped builds never do.)
  electronFuses: {
    runAsNode: false, // ELECTRON_RUN_AS_NODE=1 could run any script with this app's identity
    enableNodeOptionsEnvironmentVariable: false, // NODE_OPTIONS could inject code
    enableNodeCliInspectArguments: process.env.ORBIT_TEST_BUILD === '1', // --inspect would hand over control
    enableEmbeddedAsarIntegrityValidation: process.platform === 'darwin', // the Mac app refuses to start if its code was changed on disk (Windows once it has been tested there)
    onlyLoadAppFromAsar: true, // only the signed bundle's own code runs
    grantFileProtocolExtraPrivileges: false, // file:// pages get no extra powers (X Orbit pages use orbit://)
  },
  afterSign: 'scripts/sign-app.cjs',
  // Only publish/auto-update from GitHub when a repo is configured.
  ...(owner && repo ? { publish: [{ provider: 'github', owner, repo }] } : { publish: null }),
  protocols: [{ name: 'Web link', schemes: ['http', 'https'] }],
  mac: {
    category: 'public.app-category.productivity',
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] },
    ],
    // Hardened runtime needs a real certificate; unsigned builds are sealed by scripts/sign-app.cjs instead.
    hardenedRuntime: Boolean(process.env.CSC_LINK),
    gatekeeperAssess: false,
    entitlements: 'resources/entitlements.mac.plist',
    entitlementsInherit: 'resources/entitlements.mac.plist',
    // Notarization runs only when Apple credentials are present.
    notarize: Boolean(
      process.env.APPLE_TEAM_ID && process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD,
    ),
    extendInfo: {
      NSCameraUsageDescription: 'Websites you allow can use your camera.',
      NSMicrophoneUsageDescription: 'Websites you allow can use your microphone.',
      NSLocationUsageDescription: 'Websites you allow can use your location.',
    },
  },
  // Drag-to-Applications window: open the .dmg, drag X Orbit onto Applications, eject.
  dmg: {
    title: 'X Orbit ${version}',
    iconSize: 96,
    window: { width: 540, height: 380 },
    contents: [
      { x: 140, y: 190, type: 'file' },
      { x: 400, y: 190, type: 'link', path: '/Applications' },
    ],
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    ...(process.env.WIN_PUBLISHER ? { publisherName: [process.env.WIN_PUBLISHER] } : {}),
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    artifactName: 'X-Orbit-Setup-${version}-${arch}.${ext}',
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Network;WebBrowser',
    artifactName: 'X-Orbit-${version}-${arch}.${ext}',
  },
  artifactName: 'X-Orbit-${version}-${arch}.${ext}',
}
