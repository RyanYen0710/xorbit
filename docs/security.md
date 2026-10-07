# Security notes

## What X Orbit has today (no accounts, no server-side user data)

X Orbit has **no sign-in, no passwords, no payments and no admin area**, so the classic web-app risks (stolen session
tokens, client-side admin checks, login brute-forcing, weak passwords, missing 2FA) **do not exist yet**. The website is
static content with no forms or cookies. Browsing data stays in local files on the user's computer.

What _is_ protected, and how:

| Risk                                        | Where                           | What's done                                                                                                                                                                                                                    |
| ------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web pages reaching browser internals        | desktop app                     | `sandbox`, `contextIsolation`, no Node in pages; `window.orbit` only on `orbit://` pages; every IPC call re-validated against an allow-list (see README)                                                                       |
| XSS                                         | Orbit Search, extension, app UI | untrusted text is rendered with `textContent`/React (escaped), result links must be `http(s)`, Orbit Search sends a strict CSP, the injected Orbit Bar lives in a closed shadow root and builds DOM without `innerHTML`        |
| XSS / clickjacking on the website           | website                         | CSP (`object-src 'none'`, `frame-ancestors 'none'`, `base-uri`/`form-action` `'self'`), nosniff, Referrer-Policy, Permissions-Policy, HSTS. Inline scripts are still allowed (Next's bootstrap); move to nonce-based CSP later |
| Draining the search API key (rate limiting) | Orbit Search                    | per-visitor per-minute and per-day limits plus a global daily cap, counted on the server; over the limit visitors are sent to Google instead. Key is server-side only                                                          |
| Leaked secrets in a public repo             | repo                            | no secrets committed; `.env` ignored; scanned before publishing; enable GitHub secret scanning + push protection                                                                                                               |
| Vulnerable dependencies                     | repo                            | `pnpm audit` (clean for shipped code), Dependabot weekly updates, pnpm's release-age protection left **on**                                                                                                                    |
| Tampered updates                            | installers                      | signing + notarization (see `docs/distribution.md`) — **needed before real distribution**                                                                                                                                      |

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

## When you add accounts, sync or payments (future checklist)

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
