# X Orbit Support Center

Accounts and support tickets for X Orbit, at https://xorbit-support-center.vercel.app.

A static site (plain HTML/CSS/ES modules, **no build step**) on Vercel, backed by **Firebase Authentication** and
**Cloud Firestore**. Customers sign in with Google or email + password, open tickets and chat with support; the administrator
answers from the same site. The accounts are ordinary X Orbit accounts (one Firebase project), so the desktop app can use
them too (sync is a later phase).

```
index.html            page shell            js/        the app (router, auth, tickets, admin)
firebase-config.js    public project ids    vendor/    Firebase SDK bundle (built from dev/)
config.js             optional inbox alert  firestore.rules   THE security model (enforced on Google's servers)
dev/                  build + test tooling (own npm project, not part of the pnpm workspace)
```

## How it is secured (and what each part does)

| Concern              | What protects it                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Who can see a ticket | `firestore.rules`: only its owner, or an admin. Checked by Google's servers on every request, so a modified browser can't get around it.                                                                                                         |
| Who is an admin      | Not decided in the browser. A **verified Google sign-in** whose user ID is listed in the `admins` collection (only you can write it, in the Firebase console), signed in within the **last 8 hours**. Email/password logins can never be admins. |
| 2-step verification  | Admin = Google sign-in, so Google's own 2-Step Verification protects it. Turn it on for the admin Google account (preferably with a passkey/security key). The 8-hour limit forces a fresh Google login (and 2SV prompt) each day.               |
| Email verification   | Rules reject every read/write from an unverified email address; the UI walks people through confirming.                                                                                                                                          |
| Short-lived sessions | Firebase ID tokens last 1 hour and are re-checked on every request.                                                                                                                                                                              |
| Rate limiting        | Server-side, in the rules: 1 new ticket per minute and 1 message per 5 seconds per person, using the server clock. Firebase Auth throttles sign-in attempts per IP on top.                                                                       |
| Password strength    | 8+ characters with upper-case, lower-case and a number, no common passwords, nothing built from the email (checked in the page). See "Limits" below.                                                                                             |
| XSS                  | All user text is rendered with `textContent`; strict CSP with no inline scripts or styles (`script-src` only `'self'` plus Google's sign-in scripts); everything validated again by the rules (types, sizes, allowed values).                    |
| Data minimising      | The optional inbox alert email contains only the ticket ID, category and a link.                                                                                                                                                                 |

### Limits (honest)

- Email/password users have **no second factor** (that needs Firebase "Identity Platform", a paid upgrade). Google sign-in users get Google's.
- Password rules are enforced in the page; someone calling Firebase's API directly could set a weaker password **for their own account**. A server-side policy also needs Identity Platform.
- No notifications to customers when you reply (email needs a paid service or your own domain). They see replies when they sign in.
- App Check (bot attestation) is not enabled yet; it is the next hardening step if abuse appears.

## One-time Firebase setup

1. console.firebase.google.com → **Add project** (e.g. `xorbit`), no Google Analytics.
2. **Build → Authentication → Get started**: enable **Google** (project support email = the admin email) and **Email/Password**.
   _Settings → Authorized domains_: add `xorbit-support-center.vercel.app`.
3. **Build → Firestore Database → Create database** (production mode, a region near you).
   **Rules** tab: paste `firestore.rules` and **Publish**.
4. **Project settings → Your apps → Web (`</>`)**: register an app, copy the four values (`apiKey`, `authDomain`, `projectId`, `appId`) into
   `firebase-config.js` (they are public identifiers, not secrets), commit, deploy.
5. Open the site, **sign in with the admin Google account**, open **Account** and copy your **User ID**.
6. Firestore console → **Start collection** `admins` → document ID = that User ID → add any field (e.g. `ok: true`) → Save.
   Reload the site: an **Admin** link appears.
7. Recommended: Google Cloud console → _APIs & Services → Credentials_ → restrict the browser API key to your site (HTTP referrer).

## Testing

Needs Java (kept inside the project at `.tools/jre`, see the repo notes) and the tooling installed once:

```bash
cd apps/support-center/dev && npm install
cd .. && pnpm test      # 37 security-rule checks + a full browser test, against the Firebase emulators (nothing real is touched)
```

`firestore.rules` is tested for what must be refused as much as what must be allowed. `pnpm build:vendor` rebuilds `vendor/firebase.js`.
