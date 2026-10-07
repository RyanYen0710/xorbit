// Packaging config. Signing/notarization/publishing are driven by env vars — see docs/distribution.md.
const owner = process.env.ORBIT_GH_OWNER
const repo = process.env.ORBIT_GH_REPO

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'app.xorbit.browser',
  productName: 'X Orbit',
  copyright: 'Copyright © X Orbit',
  directories: { output: 'release', buildResources: 'resources' },
  files: ['out/**/*', 'package.json'],
  asar: true,
  // Only publish/auto-update from GitHub when a repo is configured.
  ...(owner && repo ? { publish: [{ provider: 'github', owner, repo }] } : { publish: null }),
  protocols: [{ name: 'Web link', schemes: ['http', 'https'] }],
  mac: {
    category: 'public.app-category.productivity',
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] },
    ],
    hardenedRuntime: true,
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
  dmg: { title: 'X Orbit ${version}' },
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
