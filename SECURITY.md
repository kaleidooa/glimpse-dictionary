# Security

The latest public beta is supported. Glimpse is a local-first browser extension, so unwanted page access or leakage of saved vocabulary, sentences or camera data is a priority.

Please do not post exploitable vulnerabilities, credentials, private URLs, wordbook backups or gaze logs in public issues. Use [GitHub private vulnerability reporting](https://github.com/kaleidooa/glimpse-dictionary/security/advisories/new) when enabled. Reports should include affected version, minimal reproduction and impact without unrelated personal data.

We do not promise a response SLA or a paid bug bounty. Ordinary bugs and incorrect dictionary senses belong in the issue templates.

Content scripts can request one definition or explicitly save one word. Listing, import, deletion and study-state changes are restricted to extension pages. Saved vocabulary and settings storage is restricted to trusted extension contexts. Imports are bounded and validated before writing; exports retain source attribution and protect CSV spreadsheet cells from formula interpretation.
