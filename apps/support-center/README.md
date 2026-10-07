# X Orbit Support Center

A static site (plain HTML/CSS/JS, **no build step**) where people open support tickets. It is deployed as its own Vercel
project from this folder (`apps/support-center`) at https://xorbit-support-center.vercel.app.

```bash
pnpm --filter @orbit/support-center dev     # http://127.0.0.1:4500 (same security headers as production)
pnpm --filter @orbit/support-center test    # drives the real page in Chromium with a fake form service
```

## How a ticket reaches you

1. A visitor fills in the form (title, category, product, impact, details, steps, version, system, email…).
2. The page sends it to **Web3Forms** (a form-to-email service), which emails it to **your support inbox** with the
   visitor's address as _Reply-To_. The subject looks like `[XO-261007-K4F9] [Bug or crash] Title`.
3. You answer from the inbox with a normal Reply. The visitor receives it from the support address.

No server, database or secret is involved. Tickets are not stored on this site; the visitor's browser keeps only a list of
their own ticket IDs.

## One-time setup (about 5 minutes)

1. **Create a separate inbox**, not your personal one, e.g. `xorbit.support@gmail.com`, and turn on **2-Step Verification**
   for it (passkey or authenticator app).
2. Go to https://web3forms.com, enter that inbox address, confirm the email, and copy the **Access Key**.
3. Put it in `config.js` (`accessKey: '…'`), commit and push. Vercel redeploys.

The access key is **public by design** (it is visible in the page source) and can only deliver to the inbox it was created
for. Limits on the free plan apply (see their pricing page); the page also throttles to 3 tickets per 10 minutes per browser,
traps bots with a hidden field, and the form service adds its own spam filtering.

Until a key is set, the page says the form is being connected and does not send.

> Testing note: Web3Forms rejects automated/headless browsers and server-side calls on the free plan (HTTP 403, no CORS
> headers). The automated test therefore mocks the service. To test for real, submit the live form from a normal browser.

## Security

Strict CSP (no inline scripts or styles, `connect-src` limited to the form service), clickjacking and sniffing protection,
HSTS, no cookies, no third-party scripts or fonts. Anything typed by a visitor is rendered with `textContent` only.
Never ask people for passwords, card numbers or recovery codes; the form tells them not to send them.
