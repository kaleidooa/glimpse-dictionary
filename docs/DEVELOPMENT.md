# Development notes

## Build and package

`npm ci` copies MediaPipe WASM and downloads the face model. Retry a failed download with `npm run assets`. The cursor dictionary does not use the model.

`npm run build` builds the web demo. `npm run build:extension` replaces the generated `dist-extension` directory. On Windows, `npm run package:extension` produces a ZIP and SHA-256 file in `release/`. On other systems with PowerShell 7, run `pwsh -File scripts/package-extension.ps1`.

The web demo and extension have separate storage. Site permissions work only in the installed extension. Reload both the extension and the page after changing a content script. HTTP/HTTPS access is required at installation. The worker dynamically registers the reader at `document_start`; automatic use defaults to on and respects an explicit off preference and Chrome's permission restrictions.

Alt+Q is the default shortcut. Chrome owns the installed binding; the popup, reader demo and settings read `commands.getAll()`. Settings refreshes it when the page regains focus. Shortcut changes go through `chrome://extensions/shortcuts`; the web demo uses Alt+Q locally.

## Dictionary

`extension/word-at-point.ts` finds the word under the pointer. Lookup runs in the extension worker through `src/lib/local-lexicon.ts`. A temporary overlay marks the word's text rectangles without wrapping page text or changing the browser selection. It closes with the popup on scroll; lookups wait for 180 ms of scroll stability and ignore late results after closing.

Text selection offers a small button after the drag ends. Selected words use the same dictionary; sentences use Chrome's Translator API directly from the button's user activation. Selection reads are bounded to 2,000 characters and exclude editable areas. Chrome 138+ on desktop supports the API, but insecure pages and frame permissions can prevent access. A model may download on first use. Translation instances are destroyed after use and canceled on close; there is no translation cache or automatic online fallback. The optional Google Translate link sends the selection in its URL only when clicked.

| Data | Headwords | Senses | License |
| --- | ---: | ---: | --- |
| Korean Wiktionary, via Kaikki | 13,649 | 19,747 | CC BY-SA 4.0 |
| Kengdic | 45,771 | 73,535 | MPL 2.0 |

The union contains 51,109 headwords. Data files remain separate, with provenance in `public/dictionary/manifest.json` and [notices](../THIRD-PARTY-NOTICES.md). Import scripts live in `scripts/`. Original corrections belong in `src/lib/editorial.ts`.

Lookup loads alphabetic JSON shards on demand, shares concurrent reads and keeps at most 12 shards in memory. WordNet exceptions and spelling rules produce lemma candidates; round-trip checks distinguish `hoped → hope` from `hopped → hop`. Homographs such as `saw` can retain more than one interpretation. The UI shows up to eight senses but does not choose a sense from the surrounding sentence.

The optional Free Dictionary API is used only for missing words, with a 2.5-second timeout. Both the online setting and host permission are required. The extension does not call an LLM.

## Checks

```sh
npm test
npm run build
npm run build:extension
npm run check:extension
npm run benchmark:dictionary
```

Tests cover dictionary files, inflections, text boundaries, scrolling, permission checks, wordbook storage and eye-lab calibration. The package check runs the actual built worker against packaged data using Chrome API doubles. It is not a live Chrome integration test. GitHub Actions runs the tests and packaging on Linux.

The benchmark checks every bundled headword and records Node file-lookup timings. Reports in `reports/` exclude Chrome IPC, rendering and OS cold-cache costs. The 398-word sample was used to fix missing entries, so it is not an independent accuracy benchmark. Dictionary completeness does not establish sense accuracy.

For installed-extension testing, open a regular webpage and use the first shortcut without opening the extension popup. Check the word marker before and after scrolling, turn automatic use off and back on, and try Chrome's site-access restrictions. Save a word, reload, export a backup, delete the test word and restore it. Also check an unavailable online service. Automated browser checks have covered the localhost wordbook flow; installed-extension permission/shortcut integration and native file backup/restore remain manual checks.

## Eye lab

Open **Settings → Eye-tracking lab**. Mouse mode exercises the interface without a camera. For webcam trials, connect the camera and choose precise calibration (25 positions twice) or quick calibration (9 positions). Hold your head still and follow each point. Calibration ends with new validation positions that were not used for fitting.

Choose evaluation or additional training, then 50, 100 or 200 trials. Look at the underlined target, wait briefly and press Space. Scroll to sample different parts of the page. Mouse results are recorded separately and say nothing about webcam accuracy.

Additional training needs at least 30 stable trials across 15 screen regions. A held-out portion checks whether to apply the candidate model. After applying it, run a new evaluation; the model-selection score is not a final accuracy result. Recalibrate after changing zoom, viewport size, posture or camera position.

The lab stores features, coordinates, sentences, calibration and trial records locally. JSON contains the detailed records; CSV contains trial rows. Export before clearing records. Camera frames are neither recorded nor sent to a server. See [privacy](../PRIVACY.md).

For the localhost lab only, developers can put an `OPENAI_API_KEY` in `.env` to enable contextual definitions for missing words. This sends the word and sentence to OpenAI and may incur API charges. Do not use a `VITE_` prefix or publish the key. The server middleware is absent from static builds and extension packages.

## Language changes

The interface defaults to English. UI strings use `t(english, korean)`; dictionary glosses and user content are not translated. The language preference stays on the device. Keep translations next to the corresponding English strings, and test both languages when changing a flow.
