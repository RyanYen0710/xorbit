# Publishing the extension

You need a **Chrome Web Store developer account** (one-time US$5 fee, Google account, identity verification) — that is the one thing not included.

1. `pnpm --filter @orbit/extension package` → `apps/extension/x-orbit-extension-<version>.zip`.
2. Open the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) → **New item** → upload the zip.
3. Listing: short description from `manifest.json`; at least one 1280×800 screenshot (the website's `public/shots/` images are real captures of the desktop app — take extension ones with the side panel open); the 128 px icon is in `public/icons/`.
4. **Privacy tab**, justify each permission (reviewers read these):
   - `tabs`, `tabGroups` — list and group the user's tabs into Spaces in the side panel.
   - `bookmarks` — read the user's bookmarks to show them as a grid on the new tab page (read-only; nothing is changed or sent anywhere).
   - `history` — Orbit Bar suggestions (`@history`). `sessions` — "Reopen closed tab" command.
   - `sidePanel` — Mission Control. `storage` — themes, Spaces, pins, search settings. `favicon` — tab icons.
   - `scripting` + `activeTab` — show the Orbit Bar on the current page when the user presses the shortcut.
   - Data use: the extension does not collect, transmit or sell user data. Tell the dashboard "no data collected".
5. Submit for review. After approval set `NEXT_PUBLIC_CHROME_STORE_URL` on the website so the Download page links to it.

Bump `version` in `apps/extension/public/manifest.json` for every update. Orbit Search keys (`SERPER_API_KEY` etc.) never go in the extension — they live on the `apps/search` server only.
