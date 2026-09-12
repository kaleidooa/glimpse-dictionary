# Contributing to Glimpse

Glimpse focuses on a small, reliable reading flow: point at an English word, press a shortcut, read a Korean definition, optionally save it. The core stays free and works without an account.

## Development

Use Node.js 24 and npm. Run `npm ci`, `npm run dev`, and open the printed localhost URL. The default page is the reading demo; `/dashboard.html` contains onboarding, vocabulary and settings. Browser site-permission controls work only in the installed extension.

Run `npm test`, `npm run build:extension`, and `npm run check:extension`. On Windows, `npm run package:extension` creates an unpacked-install ZIP. Load `dist-extension` from `chrome://extensions`, then refresh the extension and target web page after code changes. Keep the previous release ZIP when comparing behavior.

## Useful contributions

- A reproducible missed word: word, expected sense, source, browser version and minimal public test HTML if needed. Private browsing URLs and full sentences are not required.
- Dictionary corrections with a traceable, compatible source. Do not scrape proprietary dictionaries or copy licensed definitions without permission. Original corrections belong in `src/lib/editorial.ts`; public-source data changes must keep attribution and their original license.
- Reader regressions covering real text boundaries, scrolling, keyboard focus, iframe permission or accessible controls.
- Independent evaluation of unseen reading vocabulary. A test list used for corrections must not be reported as an unbiased accuracy benchmark.

## Before a pull request

1. Describe the problem and observable new behavior.
2. Add meaningful regression coverage for a behavior change; avoid tests that merely mirror static markup.
3. Run tests, build and package checks. Never include `.env` files, credentials, real gaze logs, browser profiles, vocabulary backups or `.qa` files.
4. Run `npm run format` on changed source and `npm run check:public` after staging public files.

Original code contributions are under MIT. Dictionary data remains under its separate license; see [notices](THIRD-PARTY-NOTICES.md). No contributor license assignment is required.
