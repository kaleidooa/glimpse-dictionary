Glimpse English-to-Korean dictionary data

wiktionary/*.json: Adapted from the Korean Wiktionary contributors via Kaikki/Wiktextract, CC BY-SA 4.0.
Entry attribution: https://ko.wiktionary.org/wiki/{entry.title}
Contributor history: https://ko.wiktionary.org/w/index.php?title={entry.title}&action=history
Extraction: https://kaikki.org/kowiktionary/%EC%98%81%EC%96%B4/index.html
License: https://creativecommons.org/licenses/by-sa/4.0/
No endorsement by Wiktionary, Wikimedia, Kaikki or their contributors is implied.

kengdic/*.json: Derived from Kengdic by Joe Speigle and contributors, with maintenance by Nate Garfield and the community.
https://github.com/garfieldnate/kengdic
The upstream offers MPL 2.0 or LGPL 2.0+; this distribution uses MPL 2.0.
License: https://www.mozilla.org/MPL/2.0/
These JSON files are the source form of the modified data, supplied under MPL 2.0.
Upstream identifiers are retained in the id fields. The transformation source is included in import-dictionary.mjs.
The original TSV can be retrieved from the upstream URL. Source hashes are recorded in manifest.json.

The two data collections are distributed as separate files, not relicensed as one database.
Changes: restriction to English single-word headwords, Korean gloss checks, normalization, deduplication, and indexing.
No generated translations or the third-party open-english-korean-dict aggregate are imported.

WordNet 3.0 exception lists: Copyright Princeton University. See WORDNET-LICENSE.txt.
The bundled application code uses 5,635 inflected spellings transformed from the WordNet exception files.
Original Glimpse editorial entries are separate from both public databases and are not Wiktionary or Kengdic material.
Full license texts are included as CC-BY-SA-4.0.txt, MPL-2.0.txt and WORDNET-LICENSE.txt.
