# Security policy

X Orbit is a browser, so security reports are taken seriously.

**Report a vulnerability privately** — do not open a public issue. Use GitHub's
[private vulnerability reporting](https://github.com/RyanYen0710/xorbit/security/advisories/new) for this repository.
Please include the version (Settings → About), your OS, and steps to reproduce. You'll get an acknowledgement as soon as
the maintainer sees it.

Supported: the latest release only (0.x is beta).

What's in scope: the desktop app, the Chrome extension, Orbit Search and the website in this repository.
What's out of scope: vulnerabilities in websites you browse, or in Chromium/Electron themselves (report those upstream;
X Orbit ships Electron updates).

Never commit secrets. API keys live in `.env` (git-ignored); `.env.example` documents each variable.
