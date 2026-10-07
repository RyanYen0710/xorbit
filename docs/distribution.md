# Distribution

Everything below that needs an account, certificate or money is **not included** — this lists exactly what to bring.

## Build locally

```bash
pnpm package            # dmg + zip (mac), nsis (win) for the OS you're on → apps/browser/release/
pnpm --filter @orbit/browser package:dir   # unpacked app, fastest check
```

Cross-building Windows installers from macOS needs Wine; use the GitHub Actions workflow instead.
Linux targets (AppImage, deb) are configured but unverified.

Icons: `resources/icon.png` (1024×1024) is the source; electron-builder derives `.icns` / `.ico`. Regenerate it from
`assets/branding/app-icon.svg` with `pnpm --filter @orbit/browser icons`.

## macOS signing and notarization

You need an **Apple Developer Program** membership (paid) and a **Developer ID Application** certificate.

1. Export the certificate as `.p12`, base64 it, and set `CSC_LINK` (the base64 or a file path) and `CSC_KEY_PASSWORD`.
2. Create an app-specific password at appleid.apple.com. Set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
3. Run `pnpm package`. With all three Apple variables present, electron-builder signs, notarizes and staples automatically
   (`notarize` in `electron-builder.config.cjs`). Hardened runtime + `resources/entitlements.mac.plist` are already set.

Unsigned builds work but Gatekeeper will warn users; the download page says so.

## Windows signing

Buy a code-signing certificate (OV, or EV for instant SmartScreen reputation) or use Azure Trusted Signing.
Set `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` (and optionally `WIN_PUBLISHER`). Unsigned installers trigger SmartScreen warnings.

## Releases and auto-update

1. Create the GitHub repo. Set `ORBIT_GH_OWNER`, `ORBIT_GH_REPO` (CI does this for you) and `NEXT_PUBLIC_GITHUB_REPO=owner/repo` on the website.
2. Bump `apps/browser/package.json` `version`, tag it: `git tag v0.1.0 && git push --tags`.
   `.github/workflows/release.yml` builds mac + Windows and uploads installers plus `latest*.yml` update manifests.
3. Installed builds check GitHub Releases through `electron-updater` (`apps/browser/src/main/updater.ts`).

Channels: **stable** → releases not marked pre-release, **beta** → pre-releases (tag `v0.2.0-beta.1`), **developer** → alpha tags.
The channel is chosen in Settings → About X Orbit.

Auto-update on macOS requires a **signed** app. Until you have a certificate, updates are manual downloads.

## Website

`apps/website` is a standard Next.js app (`pnpm --filter @orbit/website build && start`), deployable to Vercel or any Node host.
The Download page reads the latest GitHub release at request time (30 min cache); with no release it shows disabled buttons.
You still need: a **domain** and hosting.
