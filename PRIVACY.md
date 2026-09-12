# Privacy

[한국어](docs/ko/PRIVACY.md) · Updated September 12, 2026

Glimpse has no accounts, analytics, ads or backend service. The project is maintained at [kaleidooa/glimpse-dictionary](https://github.com/kaleidooa/glimpse-dictionary).

## Dictionary and wordbook

On an authorized page, Glimpse keeps the latest pointer position in memory and reads nearby text when you press the shortcut. It does not store pointer paths, lookup history, page content or visited URLs. Input fields and editable areas are excluded.

The bundled dictionary is read from local files. Clicking **Save word** stores that word, lemma, up to three senses, parts of speech, source links, license, save time and learning status in `chrome.storage.local`. The limit is 1,000 words or about 4 MB. Sentences, page URLs and camera data are not part of the wordbook.

You can delete individual words, download CSV or JSON, and import JSON locally. Imports add missing words without replacing existing ones. There is no automatic sync or upload. Removing the extension deletes its storage; downloaded backups remain wherever you saved them. The localhost demo uses separate localStorage.

## Optional online lookup

Online lookup is off by default. If enabled and Chrome permits access, missing English words are sent individually over HTTPS to `api.dictionaryapi.dev`. Glimpse omits sentences, page URLs, cookies and referrers. The provider can see your IP address and request time; its server handling is outside this project's control. See [Free Dictionary API](https://dictionaryapi.dev/).

The connection check sends the fixed word `serendipity`. Saving an online-only word may repeat its lookup. Turning the option off stops further online queries.

## Preferences and permissions

Interface language, online lookup and allowed-site preferences stay on the device. The default interface language is English.

The extension requests access to HTTP/HTTPS websites at installation. Automatic use is on by default, so each page is ready for the first shortcut. Page listeners keep only the latest pointer position; they do not scan the page or look up words until you ask. `activeTab` and `scripting` also support activation from the extension popup.

Turning off automatic use on all sites stops active readers and clears the individual site list. You can then enable individual sites from the popup. Saved words and the online dictionary setting remain unchanged. This switch does not revoke Chrome's host permissions; manage those in Chrome's extension settings.

## Experimental eye lab

The camera starts only after you click **Connect webcam** and allow access. Frames are processed locally and are not saved or transmitted. Disconnecting the camera or closing the lab stops its tracks.

The lab stores eye and face feature values, gaze coordinates, timestamps, text and sentences, calibration, trial targets and results, viewport size and scroll state in its own localStorage. These appear in lab exports. **Clear experiment records** removes the local lab records and calibration. Ordinary webpages do not collect gaze data.

Only a separately run localhost lab with a developer-configured OpenAI key can send a missing word and its sentence to OpenAI. Provider terms and API charges apply. The Chrome extension does not make these requests.

## Links and contact

Source and GitHub links open only when clicked. Issues and comments on GitHub are public; private browsing content and exports are not needed to report a bug. Use [private reporting](SECURITY.md) for security issues.

User data is used only for the features described here, consistent with the Chrome Web Store User Data Policy's Limited Use requirements. It is not sold or used for advertising. Changes to data handling will be reflected in this document and the product.
