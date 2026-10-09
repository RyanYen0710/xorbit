# Security notes

## What X Orbit has today

The browser itself has no payments. There ARE accounts now (Support Center, website reviews, and the optional X Orbit
account in the app), all on one Firebase project; the checklist for those is met as described in the next section.
Browsing data, passwords and cards stay in local files on the user's computer and are never synced yet.

What _is_ protected, and how:

| Risk                                        | Where                           | What's done                                                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web pages reaching browser internals        | desktop app                     | `sandbox`, `contextIsolation`, no Node in pages; `window.orbit` only on `orbit://` pages; every IPC call re-validated against an allow-list (see README)                                                                         |
| XSS                                         | Orbit Search, extension, app UI | untrusted text is rendered with `textContent`/React (escaped), result links must be `http(s)`, Orbit Search sends a strict CSP, the injected Orbit Bar lives in a closed shadow root and builds DOM without `innerHTML`          |
| XSS / clickjacking on the website           | website                         | CSP (`object-src 'none'`, `frame-ancestors 'none'`, `base-uri`/`form-action` `'self'`), nosniff, Referrer-Policy, Permissions-Policy, HSTS. Scripts need a per-request nonce (`apps/website/proxy.ts`): no inline script can run |
| Draining the search API key (rate limiting) | Orbit Search                    | per-visitor per-minute and per-day limits plus a global daily cap, counted on the server; over the limit visitors are sent to Google instead. Key is server-side only                                                            |
| Leaked secrets in a public repo             | repo                            | no secrets committed; `.env` ignored; scanned before publishing; enable GitHub secret scanning + push protection                                                                                                                 |
| Vulnerable dependencies                     | repo                            | `pnpm audit` (clean for shipped code), Dependabot weekly updates, pnpm's release-age protection left **on**                                                                                                                      |
| Tampered updates                            | installers                      | signing + notarization (see `docs/distribution.md`) — **needed before real distribution**                                                                                                                                        |

## Saved passwords and cards (desktop app)

X Orbit can save logins and payment cards and fill them for you. Where the data lives and what protects it:

- **Local only, encrypted.** One vault file (`vault.bin`) in the app's user-data folder, encrypted with Electron `safeStorage`
  (macOS Keychain / Windows DPAPI / Linux Secret Service). It is never uploaded, never synced and never inside the project
  folder or the GitHub repo. If the OS can't offer real encryption (Linux without a keyring) X Orbit refuses to save anything.
- **Cards:** number, expiry and name only. The security code (CVV/CVC) is never read, saved or filled. Filling a card asks for
  Touch ID where macOS offers it.
- **Filling is explicit.** A saved login is offered in a _native_ menu after you click a username/password box; the password is
  sent to the page only after you pick it. It fills only on the exact origin it was saved for (re-checked at fill time), only
  in the top frame, only on https (or localhost), and never auto-submits. A page script can't open the menu by itself (needs a
  real click/keypress) and can't choose an entry.
- **Saving is explicit.** After you submit a login form X Orbit asks first; never in private windows; "Never for this site" is remembered.
- **Showing or copying** a saved password needs Touch ID where available; the clipboard is cleared after 30 seconds.

Honest limits: there is **no master password** (protection is the OS keychain plus Touch ID for reveal), so malware running as
your OS user could read the vault, like the built-in managers of other browsers. On systems with no biometric prompt anyone using
your signed-in account can view saved passwords in Settings. Many checkouts use embedded payment boxes (Stripe, PayPal) which can't
be filled by design. **Passkeys are not supported yet**: the OS only lets a signed app use its passkey storage, so this needs code
signing first. Sync across devices would need end-to-end encryption (see the checklist below).

Signing in to sites (including Google) keeps session cookies in the app's profile, which Chromium encrypts with the same OS keychain.
Google's sign-in page loads in X Orbit; if Google ever shows "this browser may not be secure" after you enter an email, that is
Google's block on apps built on Electron, and nothing X Orbit can override.

## The biggest real risk for a popular browser: the maintainer accounts

If someone takes over the GitHub, Vercel, Apple Developer, Chrome Web Store or Google account, they can ship malware to
every user. Do these now: **turn on 2-step verification (passkey or authenticator app, not SMS) on all of them**, protect
the `main` branch (no force-push or deletion), and keep signing certificates out of the repo (CI secrets only).

## Accounts, tickets and reviews: the checklist and how each item is met

| Requirement                                                  | How                                                                                                                                                                                                                                       | Proof                                                                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Short-lived sessions, checked by the server on every request | Firebase ID tokens last 1 hour and are re-checked by Firestore rules on every read and write. The app keeps only the refresh token, encrypted with the OS keychain; ID tokens live in memory. No token ever reaches a web page.           | `firestore.rules`; `apps/browser/scripts/account.e2e.mjs` (account file is encrypted, no token in UI state) |
| Content-Security-Policy                                      | Support Center: no inline script or style. Website: per-request nonce + `strict-dynamic`. App pages: strict CSP header on every `orbit://` response.                                                                                      | live headers; `reviews.e2e.mjs` and `app.e2e.mjs` fail on any CSP violation                                 |
| XSS                                                          | all user text is rendered as plain text (`textContent` / React escaping). No `innerHTML` with data anywhere.                                                                                                                              | tests post `<b>` and `<script>` text and check it is inert                                                  |
| Admin check on the server                                    | `isAdmin()` in the Firestore rules: verified Google sign-in + listed in `admins/` (console-only) + signed in within 8 hours. The "Admin" link is only a hint.                                                                             | `rules.test.mjs` (42 attack cases)                                                                          |
| 2FA                                                          | Admin must use Google sign-in, so Google's 2-Step Verification applies, and must re-authenticate every 8 hours. Customers must have a verified email.                                                                                     | rules; **owner must keep 2-Step Verification on**                                                           |
| Rate limiting counted on the server                          | tickets 1/min, messages 1 per 5 s, review edits 1 per 10 s (all measured with the server clock in the rules); Firebase Auth throttles sign-in, sign-up and reset attempts per IP and account                                              | rules tests; live checks                                                                                    |
| Strong passwords + email verification                        | 8+ characters with upper, lower and a number, enforced by Firebase on its servers (not only in the page); verification email required before tickets, reviews or sync. Live checklist in every sign-up form.                              | `curl` against the real API is refused; e2e tests                                                           |
| No account discovery                                         | wrong email and wrong password give the same message; password reset always answers "if an account exists"                                                                                                                                | live checks                                                                                                 |
| Google sign-in in the app                                    | never inside X Orbit (Google refuses embedded sign-in). The system browser signs in at `/app-sign-in`; only a short-lived Google ID token returns, to a one-shot server on 127.0.0.1 that checks a random secret, the Host and the Origin | `account.e2e.mjs` attack cases                                                                              |

**Packaged app hardening.** The shipped app has Electron's "fuses" set: it cannot be used as a script runner
(`ELECTRON_RUN_AS_NODE`), `NODE_OPTIONS` and `--inspect` are ignored (no debugger can be attached), only the app's own bundle
is loaded, and on Mac it refuses to start if its code was changed on disk (ASAR integrity). Test builds
(`pnpm package:test`, `ORBIT_TEST_BUILD=1`) keep the inspector so the updater can be tested end to end.

**API key.** The Firebase web key (`AIza...`) is an identifier, not a secret: it is meant to be in browser code, and
access is decided by Auth and the rules. Still, restrict it in Google Cloud: HTTP referrers = the three site origins and
APIs = Identity Toolkit, Token Service, Cloud Firestore; give the desktop app its own key limited to Identity Toolkit and
Token Service. GitHub's secret-scanning alert for it is expected and can be closed as "public by design" once restricted.

## Before you add sync or payments (what is still to do)

Do **not** build your own password or card handling. Use a managed auth provider and a hosted checkout.

1. **Sessions** — short-lived access tokens, verified on the server for every request; prefer HttpOnly + Secure +
   SameSite cookies over `localStorage`; refresh-token rotation; revoke on password change.
2. **Authorization** — decide who is an admin on the server and in database rules, never only in client code.
3. **XSS** — render user text as plain text, sanitize any rich/AI output, keep a strict nonce-based CSP.
4. **2FA / verification** — require a verified email; offer TOTP/passkeys; mandatory for admin accounts.
5. **Rate limiting** — on login, signup, password reset and any paid API, counted server-side (Redis/KV), per IP and per account.
6. **Passwords** — use the provider's hashing; enforce length ≥ 8 (prefer 12+) and check against breached-password lists; email verification.
7. **Payments** — card data must only ever touch Stripe/PayPal hosted fields/checkout (keeps you out of PCI scope); verify webhooks by signature; never trust prices from the client.
8. **Encrypted sync** — if synced, end-to-end encrypt browsing data with a key the server never sees.
9. **Privacy** — publish a privacy policy; honour deletion requests; log as little as possible.
