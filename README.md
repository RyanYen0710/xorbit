# X ORBIT

**The web, reorbited.** A desktop browser built around Spaces, a vertical Orbit Rail and a floating Orbit Bar instead of a crowded toolbar — plus its public website and the Orbit Search page.

> Status: **0.1.0 beta.** The browser, website and search page run and are tested end to end. See [What's built](#whats-built) for the honest list of what isn't.

## What's in the repo

```
apps/
  browser/   Electron desktop browser (TypeScript, React, electron-vite)
  extension/ Chrome extension (Manifest V3): Orbit new tab, Mission Control side panel, Spaces as tab groups, Orbit Bar overlay
  website/   Public site: Next.js 16 (/, /download, /features, /search, /themes, /privacy, /about, /changelog, /support)
  search/    Orbit Search: tiny Node server + original search UI, pluggable official-API backends
packages/
  types/     Shared TypeScript types (state, settings, IPC surface)
  themes/    Design presets (ZERO, LUNAR, MARS, EARTH, TERMINAL, TITANIUM), colour maths, theme import validation
  search/    Provider URL templates, address-vs-search resolver, calculator, fuzzy matcher, API adapters (+ tests)
  ui/        Shared design tokens (orbit.css), fonts, logo component
assets/      Branding (logo, app icon SVGs) and generated PNG icons
docs/        distribution.md, architecture.md, orbit-index.md
```

## Requirements

- Node 22+ (developed on 24) and **pnpm** (`corepack enable`, or `npm i -g pnpm`)
- macOS, Windows or Linux to run the browser

## Quick start

```bash
pnpm install
pnpm dev:browser     # launch X Orbit in dev mode (hot reload for the UI)
pnpm dev:web         # website → http://localhost:3000
pnpm dev:search      # Orbit Search → http://localhost:4400/orbit-search
```

Other commands: `pnpm build` (all), `pnpm package` (installers → `apps/browser/release/`), `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format`.

End-to-end check of the MVP flow (needs a built app, no network):

```bash
pnpm --filter @orbit/browser build && pnpm --filter @orbit/browser smoke
```

It launches the real app and verifies: onboarding, loading a page, search through the Orbit Bar, back/forward/reload, pinning, Spaces, theme switching, the Bar and palette, downloads, history, settings, split view, focus mode, private windows, the IPC trust boundary, and session restore after quitting and relaunching. `pnpm --filter @orbit/browser exec node scripts/shots.mjs <dir>` captures real screenshots (the website's images come from it).

## What's built

| Area                                                                                                                 | Status                                                          |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Tabs (new/close/reopen/duplicate/mute/drag/move to Space/archive/discard), back/forward/reload, find                 | ✅                                                              |
| Orbit Rail + Mission Control (Pinned / Today / Older), Spaces (+ optional separate session)                          | ✅                                                              |
| Orbit Bar (URL, search, `@tabs`, `@history`, `@pins`, `/commands`, calculator) and Orbit Command (⌘/Ctrl+K)          | ✅                                                              |
| Split view (2 pages), Focus Mode, private windows                                                                    | ✅                                                              |
| Search providers: Google (default), DuckDuckGo, Bing, Brave, Orbit Search, custom                                    | ✅                                                              |
| Orbit Search page, Google Programmable Search + Brave API backends, fallback to Google                               | ✅                                                              |
| Theme Studio (6 presets, custom, live preview, export/import JSON), appearance modes                                 | ✅                                                              |
| History, downloads manager (pause/resume/cancel/retry), pins with folders + JSON import/export                       | ✅                                                              |
| Privacy: third-party cookie blocking, JS switch, per-site permissions (prompt + panel), clear data, popups, autoplay | ✅                                                              |
| Saved passwords + payment cards (encrypted with the OS keychain, local only, fill on click, no CVV stored)           | ✅ desktop app                                                  |
| Passkeys                                                                                                             | ❌ needs code signing first                                     |
| Session restore (tabs, Spaces, active tab, window bounds), first-run onboarding, custom error page                   | ✅                                                              |
| Packaging (dmg/zip/NSIS/AppImage/deb configs), GitHub Releases auto-update, CI + release workflows                   | ✅ configured; mac arm64 package verified                       |
| Website with download-page OS detection and real release lookup                                                      | ✅                                                              |
| Orbit Index (own crawler/index)                                                                                      | ⏳ contract + docs only (`docs/orbit-index.md`)                 |
| Extensions, sync, password manager, tracker/ad blocking, importing Chrome/Edge/Brave bookmarks, 3-way split          | ❌ not yet                                                      |
| Trackpad Space gestures, hover-to-expand Rail (click or ⌘/Ctrl+B instead)                                            | ❌ not yet                                                      |
| Windows/Linux builds                                                                                                 | configured, **not yet built or run** (only macOS was available) |

## Chrome extension (`apps/extension`)

The same ideas as an extension people install from the Chrome Web Store instead of downloading an app:

- **New tab** replaced by the Orbit page, with your Chrome bookmarks as a grid under the search box (pin any of them to the side panel with the bookmark icon; Google/Bing toggle under the search box) · **Mission Control** in Chrome's side panel (toolbar button or **Alt+S**) · **Orbit Bar** over any page (**Alt+O**; `@tabs`, `@history`, `@pins`, `/commands`, calculator) · **Spaces** as Chrome tab groups (**Alt+Shift+←/→**) · themes and search provider in Settings.
- Limits (Chrome's, not ours): an extension can't replace the toolbar, address bar or tab strip, can't float a permanent bar, and can't script `chrome://` pages or the Web Store (the Bar opens the Orbit new tab there instead). Alt+O is a default shortcut users can change at `chrome://extensions/shortcuts`.
- Permissions: `tabs`, `tabGroups`, `bookmarks` (read-only, for the new tab grid), `history`, `sessions` (reopen closed tab), `sidePanel`, `storage`, `favicon`, `scripting` + `activeTab` (Orbit Bar runs only on the page you invoke it on — no blanket site access). Nothing leaves the browser.
- `pnpm --filter @orbit/extension build` → `apps/extension/dist` (load it at `chrome://extensions` → Developer mode → Load unpacked). `pnpm --filter @orbit/extension package` → `apps/website/public/downloads/x-orbit-extension.zip`, which the website's Download page serves for free (users install it with Load unpacked; the $5 Web Store listing is optional). `pnpm --filter @orbit/extension test` loads it into Chromium and exercises it. Publishing steps: [docs/chrome-web-store.md](docs/chrome-web-store.md).

## Architecture

- **Main process** (`apps/browser/src/main`): `OrbitWindow` owns one `BrowserWindow` with three layers of `WebContentsView`: the **chrome** view (Rail, top strip, empty states — full window, at the back), one **page** view per visible tab, and a transparent **overlay** view on top (compact Orbit Bar pill → full-window Bar/palette/site panel/find). The overlay is only as big as it needs to be, so it never blocks the page.
- **State** flows one way: main holds the truth (tabs, Spaces, settings…) and pushes a `UIState` snapshot (coalesced to one per frame) to the shell and to every `orbit://` page. Renderers send small commands via `act()` / `query()`.
- **Internal pages** are real tabs at `orbit://newtab`, `settings`, `history`, `downloads`, `themes`, `pins`, `welcome`, `error`, served by a custom protocol from the renderer bundle (or the Vite dev server in dev). Panels are lazy-loaded.
- **Storage**: JSON files in the user-data folder (`state.json`, `history.json`) with atomic debounced writes. SQLite was deliberately skipped to avoid native-module rebuilds; swap it in behind `store.ts` if history outgrows it.
- **Tabs and memory**: restored/archived tabs have **no** `WebContents`; views are created on first activation and destroyed for tabs idle 15 minutes (archived after your chosen interval).
- **Search layer** (`packages/search`): `resolveInput` decides URL vs. search and never emits `javascript:`/`data:` URLs; `SearchProvider` adapters (`google`, `brave`, `orbit`) back Orbit Search; the browser itself only needs URL templates.
- **Shared design language**: `packages/ui/src/orbit.css` defines the `--orbit-*` tokens used by the browser, the website and Orbit Search; `packages/themes` swaps their values at runtime.

### Security decisions

Full notes, including what applies once accounts/payments exist: [docs/security.md](docs/security.md). Reporting: [SECURITY.md](SECURITY.md).

- Every tab and shell view: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`. The preload exposes `window.orbit` **only** on `orbit://` pages; the main process re-validates every IPC call (sender must be a view we created, a main frame, showing an `orbit://` URL) and rejects anything off an explicit allow-list of actions, with per-action input checks. The smoke test asserts web pages have no `window.orbit`.
- Web pages cannot navigate to `orbit://`; `javascript:`/`data:` are never loaded from the Bar; external protocols other than `mailto:`/`tel:` are dropped; `<webview>` is disabled.
- Permissions are explicit: camera, microphone, location and notifications prompt (or follow your saved per-site/default choice); everything else is denied.
- The user agent drops the `Electron/…` token so sites treat X Orbit as normal Chromium.
- No telemetry, no analytics, no passwords stored, no API keys in the repo.

## Search providers & Orbit Search

Settings → Search chooses the provider for the Orbit Bar and New Tab. **Google is the default**; queries open Google's results page (no scraping, no proxy). **Orbit Search** (`apps/search`) renders results itself when you configure an official API, otherwise it forwards to Google:

1. Easiest: a free [Serper.dev](https://serper.dev/api-keys) key (2,500 queries) → set `SERPER_API_KEY` in `.env` (Google results; Web, Images and News). Alternatives: `BRAVE_SEARCH_API_KEY`, or `GOOGLE_PSE_API_KEY` + `GOOGLE_PSE_CX` (Google's Programmable Search API is closed to new customers and ends 1 Jan 2027). Bing's search API was retired in August 2025, so Bing is available only as a normal results page.
2. `pnpm dev:search`, then pick _Orbit Search_ in the browser's Settings (default URL `http://localhost:4400/orbit-search`).

Add a provider: implement `SearchProvider` in `packages/search/src/adapters.ts`, register it in `createProvider`.

## Environment variables

Copy `.env.example` to `.env`. Nothing is required to run; every variable is documented there. Summary: `GOOGLE_PSE_API_KEY`, `GOOGLE_PSE_CX`, `BRAVE_SEARCH_API_KEY`, `ORBIT_SEARCH_BACKEND`, `ORBIT_INDEX_URL`, `ORBIT_SEARCH_PORT` (Orbit Search); `ORBIT_SEARCH_URL` (browser default for Orbit Search); `ORBIT_GH_OWNER`/`ORBIT_GH_REPO`/`GH_TOKEN` (publishing + updates); Apple and Windows signing variables (`docs/distribution.md`); `NEXT_PUBLIC_GITHUB_REPO`, `NEXT_PUBLIC_SITE_URL` (website). Developer-only: `ORBIT_USER_DATA`, `ORBIT_DOWNLOADS`, `ORBIT_TEST` (used by the smoke test).

## Theme system

A theme is 13 colours + a mode (`packages/themes`). Imported/edited themes accept `#rgb`/`#rrggbb`/`#rrggbbaa` or `transparent` only (no CSS injection); missing fields are derived, so a four-colour file like `{ "name": "Mars", "background": "#050505", "surface": "#111111", "text": "#F5F5F5", "accent": "#C65332" }` is valid. Tokens: `--orbit-bg`, `-surface`, `-surface-2`, `-text`, `-text-2`, `-muted`, `-border`, `-border-strong`, `-accent`, `-tab-active`, `-tab-inactive`, `-sidebar`, `-bar`, `-selection`, plus radius and motion tokens in `orbit.css`. Appearance can follow the theme, or force dark/light/system.

## Release process

See [docs/distribution.md](docs/distribution.md): bump version → tag `vX.Y.Z` → the Release workflow builds and publishes installers and update manifests to GitHub Releases → the website's Download page and installed browsers pick them up. Signing/notarization needs an Apple Developer account and a Windows certificate; both are optional for unsigned test builds.

## Developer notes

- Run the Electron app **outside** restrictive sandboxes (some CI/agent sandboxes block it).
- `playwright-core`'s Electron driver does not attach to Electron 44, so tests drive the main process over the Node inspector (`apps/browser/scripts/harness.mjs`).
- Fonts (Inter, Space Grotesk, IBM Plex Mono) are open source (OFL) and bundled via `@fontsource`.
- Logo: two crossing orbital trajectories forming an X, one incomplete, with a planet. Original; see `assets/branding`.
