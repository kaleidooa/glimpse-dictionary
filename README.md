# Glimpse

[한국어](docs/ko/README.md)

A Chrome extension for looking up English words in Korean. Point at a word and press **Alt+Shift+D**. A faint highlight marks the word while its definition is open. You can save words for later.

The dictionary includes 51,109 headwords and works offline. An optional online English dictionary covers some missing words. The interface supports English (default) and Korean.

## Install

1. Download the ZIP from [Releases](https://github.com/kaleidooa/glimpse-dictionary/releases) and unzip it.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select the folder containing `manifest.json`.
4. Open an English webpage, move the pointer over a word, and press **Alt+Shift+D**. Lookup is ready by default on regular websites.

Keep the extracted folder in place. After replacing it with an update, reload the extension and refresh your open webpages. Change the shortcut at `chrome://extensions/shortcuts`.

This is a beta distributed through GitHub, not the Chrome Web Store. Chrome internal pages, PDF viewers, images, canvas text and editable fields are unsupported.

## Wordbook and settings

Click **Save word** in a definition to add it to your local wordbook. Search saved words, mark familiar ones, export CSV, or back up and restore JSON. Nothing is saved just by looking up a word.

Settings lets you change the interface language, enable the online dictionary and turn off automatic use on all sites. You can then enable individual sites from the extension popup. Chrome's own site-access settings take precedence. Definitions from the bundled dictionary are in Korean regardless of interface language. Eye tracking is available in a separate experimental lab and requires calibration.

## Development

Requires Node.js 24.

```sh
npm ci
npm run dev
```

The demo runs at `http://127.0.0.1:5173`. To build the extension:

```sh
npm test
npm run build:extension
npm run check:extension
```

Load `dist-extension` in Chrome. See [development notes](docs/DEVELOPMENT.md) for packaging, benchmarks, the eye lab and test limits. Bug reports and pull requests are welcome; include reproduction steps and the checks you ran. For dictionary corrections, include a source we can legally redistribute.

## Privacy and license

No account or analytics. Saved words stay on your device. Online lookup is off by default. See [privacy](PRIVACY.md) and [security reporting](SECURITY.md).

Original code is [MIT](LICENSE). Dictionary data, dependencies and the face model have [separate licenses and attribution](THIRD-PARTY-NOTICES.md).
