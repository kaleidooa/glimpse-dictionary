# Third-party notices

The MIT license in this repository applies to original Glimpse code, not to the following data or dependencies. Bundled releases also contain complete notices and license texts.

| Material | Attribution and license | Included notice |
|---|---|---|
| Korean Wiktionary extracts | Korean Wiktionary contributors, via Kaikki/Wiktextract. Adapted data: CC BY-SA 4.0 | [Data provenance](public/dictionary/README.txt), [license](public/dictionary/CC-BY-SA-4.0.txt) |
| Kengdic extracts | Joe Speigle and contributors; maintained by Nate Garfield and the community. MPL 2.0 selected from the upstream dual license | [Upstream notice](public/dictionary/KENGDIC-UPSTREAM-README.md), [license](public/dictionary/MPL-2.0.txt) |
| WordNet 3.0 exception lists | Princeton University | [WordNet license](public/dictionary/WORDNET-LICENSE.txt) |
| React / React DOM / scheduler | Meta Platforms and contributors, MIT | Included in release THIRD-PARTY-NOTICES.txt |
| Lucide | Lucide contributors, ISC; Feather contributors, MIT | Included in release THIRD-PARTY-NOTICES.txt |
| MediaPipe Tasks Vision | Google, Apache 2.0 | [Included license](extension/licenses/mediapipe.txt) |

The transformed dictionary JSON is the editable source form and is distributed with its transformation script. Wiktionary and Kengdic data remain separate files. Entry links provide Wiktionary attribution and access to contributor history. Saved vocabulary exports retain source links and license labels.

The experimental face model is downloaded from Google's versioned MediaPipe model endpoint by `scripts/setup-assets.mjs`; it is not authored by Glimpse. See the [official model guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker). No endorsement by these projects or contributors is implied.
