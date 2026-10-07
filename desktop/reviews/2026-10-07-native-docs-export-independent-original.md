# Native Docs export — independent evolving-source review (original findings)

Author: `native_menu_trace_review`, 2026-10-07. **CHANGES_REQUESTED** for the two independently reproduced formatter defects below. Read-only review of the approved plan and analysis SHA256 `8623a6b0dfb0be542fd3e7eb2ab07066484f07b04083a948efcceec1a2359612`, formatter, service, tests and dependency/package boundary. No product/test/build/workflow edits, GUI, native export, full suite or release approval. Root was actively integrating UI/main; this is not a frozen-candidate verdict.

## P2 — jagged table amplification precedes the output budget

At formatter SHA256 `85c379a274392a1363ee58a0025a36d2e3893c8bb7ff057f7899ccfdd5cb1707`, the table branch constructs a rectangular Markdown array for every row regardless of requested format. With 3,000 empty rows and one 3,000-cell row, a 21,097-byte document with approximately 6,008 input nodes causes 9,003,000 padded-cell operations, well below the 8MiB/50k-node saved-read limits.

The actual formatter in three bounded owned Node children produced JSON in 5ms (93,671B), HTML in 1,806ms (182,632B), and Markdown in 1,824ms before finally refusing `EXPORT_BUDGET` (peak RSS 165,068,800B). HTML computes an unused Markdown intermediate exceeding 27MB. Timing/RSS are observations on this host, not cross-host performance guarantees. The input bounds permit much larger products; no larger/OOM case was executed. Because the formatter is synchronous, this amplification would occupy main's event loop before any asynchronous Lock recheck.

Require a per-document rendered-cell/output work bound **before** padding/allocation, including aggregate work across blocks, and avoid constructing the other format's unused table output. Keep all existing read/output limits. Root was informed and subsequently changed this implementation; this finding and original evidence remain immutable pending separate recheck.

Original result `evidence/docs-export-independent-2026-10-07/jagged-original-result.json`, SHA256 `4377dbc26f9dd81a5876a09fdf7fd6eed3b248cd617546750e8bbd8f143bf27b`; driver `jagged-probe.mjs`, SHA256 `1eb52d65186d881b22f0a6bfac37368446b521e938bd9b85ac818761f8373af9`; child `jagged-child.mjs`, SHA256 `8e5260cae7935456f00f899342802de407c4fb2ff8c1ed4d2dbfa9f2133ad77e`. Original source snapshots are in `original-snapshot/`. All seven recorded input hashes remained unchanged during this probe interval.

## P2 — lone CR escapes preserved-data Markdown indentation

At subsequent formatter SHA256 `47f02d2a8ff56ed2ac8210e0cd74fb0e9d793e3540eee037232a84d0723474bc` (after root's first table correction), `indented(value)` still split only on LF. Prompt text `kept\r<script>owned_synthetic()</script>\rnext` therefore puts the script on an unindented Markdown line after Markdown line-ending normalization. The unsafe-rich fallback has the same issue: a lone CR followed by `<img src="https://owned.invalid/test">` leaves an external-resource HTML node in the reading section.

The independent probe used the actual formatter and the existing baseline's extracted Marked parser in an isolated VM, then parse5 tree inspection. It observed an actual `script` element for the prompt and an `img` with `src` for the rich fallback. Generated HTML was never executed/opened; no application exploit or particular external Markdown viewer behavior is claimed. Nevertheless data represented as indented code becomes raw markup in the repository's existing Markdown parser, contradicting the intended safe syntax/preserved-data delivery.

Normalize CRLF and lone CR to LF **only in the visual indented-code representation**, before indenting each line. Preserve original CR bytes/values in the archive. Add actual-parser negative cases for both prompt and rich fallback, not only LF fence strings.

Result `evidence/docs-export-independent-2026-10-07/cr-original-result.json`, SHA256 `68261eacd320e418591f5fc3e87bd786b9c7cfd4d71aa7b99fbf7bd0de35afb6`; driver `cr-probe.mjs`, SHA256 `93066329815f5f01792e35bbebdb9a278da06d41460c80549784c726cd7dc5fe`. Formatter before/after hashes match. Baseline SHA256 `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4`; exact extracted Marked source SHA256 `dd1740338c5c2e0c294518274c37bcedeca14a4f7b944fe00ebf9c47bfd8e979`. The extraction runs only the trusted parser module, with bundler/name adapters; no document/browser entrypoint runs.

## Service/dependency boundary and limits

The inspected publisher uses own registry Docs identity, exact saved reads, content version/hash checks before and after formatting/publication, unique owned project exports, readback, cleanup of unretained publication, pause/generation/abort fences and pending drain. It does not retrieve linked source bytes or accept renderer body/path/project identity. Existing structured fields and claims are preserved in the archive; standalone HTML escapes the appendix and uses fixed hashed CSS/restrictive CSP. These source observations are not final main-lifecycle or copied-package qualification.

At the first retained probe, service SHA256 was `74bb26715bc82ee444d572e23434fdf3bc7b7f4a2363e938eda2fde7660ab850`, format test `d3fd1472eb3b4e45266f9c4bd405e3cd3af77dfdccd70da58c6ed432db7bf072`, publisher test `2a848681fd3672ad675eb4e456b750376b717cbde8eb3d640801fb5efe52ae4c`, package manifest `3c0bf4d8fa257852a8c438f261bcaf77f032175f9f1c3457fbd1e78717d3b434`, lock `2c887168ab1ff14bef19b7e05a1b76856569e6f393d7477e5aba2658bf0d8247`, package script `8dda22bce87c97923ca74824943471646cd4f2bc21045e78cd28d765c17ca737`.

The initial package diff promoted existing parse5 8.0.1 and its existing entities 8.1.0 closure from development to production by root dependency/`dev` metadata changes; no version, resolved URL or integrity changes appeared in that diff. Full structured comparison/package admission remains for the separate current-input recheck. `src/windows/docs-export.mjs` admission was still pending when first inspected; root identified this as integration work, not a completed package claim. Root's separately discovered/fixed request-format coercion issue is not claimed as this reviewer's finding.

The two original findings require correction and an independent recheck on explicit new hashes. Root's evolving integration, later focused tests and any later native run must remain separate evidence. This report does not close historical hosted failures or approve a release.
