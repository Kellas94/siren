# Optional offline Python manual for SIREN

Status: **research and proposal only — not implemented, enabled, downloaded or design-approved**. Author: `/root/catalogue_view`. Verified on **7 October 2026** using only the official Python documentation pages linked below. This research adds one document; it changes no product, test, dependency, generated asset or release.

## Recommendation

Offer the complete official English HTML manual as an **optional, independently versioned content pack**. Keep the small contextual learning surface in the existing optional **Structure / Understand** panel: a source-linked syntax fact, a brief concept explanation, then **Read in Python manual**. Also make the installed manual discoverable from Help. Installing a manual should not install Python, enable Terminal, execute examples or require an AI key.

This follows [the recorded learning direction](2026-10-07-siren-python-learning-direction.md). A large standalone course is unnecessary for the first contextual increment. The complete reference serves readers who want more detail without occupying the editor permanently. Choosing this architecture still requires design and implementation review.

## Official content verified today

The download page currently identifies the documentation as Python **3.14.8** and offers HTML, plain text, Texinfo and EPUB. It says prebuilt PDFs are no longer provided. The HTML format is the best candidate for local chapters, anchors, navigation and readable code examples. [Official downloads](https://docs.python.org/3/download.html).

The directory listing reports `python-3.14-docs-html.zip` at **12,919,458 bytes**, approximately **12.32 MiB**, dated 7 October 2026 09:20; the HTML `.tar.bz2` is **8,456,718 bytes**, approximately **8.07 MiB**, dated 09:19. These are compressed upstream sizes, not SIREN pack sizes or extracted disk requirements. The listing still contains older PDF files despite the current download policy; their existence is not evidence of a current PDF release. [Official archive directory](https://docs.python.org/3.14/archives/).

No archive was downloaded or inspected. The archive filename contains only `3.14`; the page title does **not** prove the patch version or content inside that ZIP. The `/3/` documentation alias and minor-version archive can change. No upstream archive digest, signature, expanded size, offline search behavior or asset inventory was established in this research.

## Redistribution and attribution

The documentation is under **PSF License Version 2**. Documentation examples and recipes are also available under **Zero-Clause BSD**. The PSF terms permit redistribution subject to retaining the license and copyright notice; distributing derivative work requires a brief change summary. The terms do not grant trademark endorsement rights or require publication of SIREN's private source. [Official license and conditions](https://docs.python.org/3/license.html).

Proposed release checklist: retain the complete applicable license texts and upstream copyright notices, expose **Python documentation · source/version/license** in the reader, and record transformations such as HTML sanitization or a SIREN theme wrapper. Keep SIREN-authored explanations visibly separate. Do not claim PSF endorsement. Before redistribution, inspect actual archive assets and their notices; the general Python license page alone is not a verified inventory of every bundled font, image or script. This is an engineering reading of the published terms, not a completed licensing audit of a pack.

## Version identity and updates

Proposed immutable manifest fields:

| Field | Purpose |
| --- | --- |
| `packId`, `packSchema`, `contentRevision` | SIREN content identity and compatible reader format. |
| `language`, `docsRelease`, `upstreamBuildUtc` | English edition and version/build established from the acquired content, not guessed from `/3/`. |
| `sourceUrl`, `retrievedUtc`, `archiveSha256`, `archiveBytes` | Exact acquired upstream archive. No digest is populated by this research. |
| `transformVersion`, `files[{route, sha256, bytes, mediaType}]` | Auditable conversion, finite allowlisted pages/assets and their exact bytes. |
| `installedBytes`, `fileCount`, `licenseEntries` | Measured disk cost, extraction bounds and retained attribution. |

Separate the pack's content revision from the SIREN executable version. A future signed SIREN content manifest would attest to the packaged bytes; it would not imply that Python.org signed the archive. Installation should be explicit and show measured download/disk cost. Updates should stage into a new immutable directory, validate all entries, then switch the active reference atomically; retain one known-good previous pack for rollback. Do not mutate an open document underneath its version label. Removing a manual must not remove project code, Docs or saved source versions. These mechanisms are proposals, not existing update features.

### Documentation version is not parser or runtime compatibility

SIREN's current static foundation uses its admitted patched **Lezer Python grammar**, not CPython. Its parser/factory identity is a separate concern from a manual's Python version. Installing Python 3.14 documentation neither updates that parser nor establishes complete Python 3.14 syntax support, type evaluation, library availability or successful execution. The existing source analysis represents bounded syntax containment. [Foundation review](../../desktop/reviews/2026-10-07-python-learning-foundation-review.md).

Display **Manual: Python 3.14.x · English**, using the verified installed release, beside **Static analysis · not executed** where relevant. Label features that depend on a documented Python version. Unknown project runtime remains unknown; do not infer it from coloring or the selected manual. Later support for multiple manual versions should be an explicit selector, with links resolving against the chosen pack identity. A fresh manual must not silently change claims about previously analyzed source.

## Beginner flow without clutter

The official tutorial targets readers who already know programming. It is readable offline, introduces Python concepts and points to deeper references, but is not a comprehensive course for a complete beginner. SIREN therefore needs its own small contextual bridge rather than treating the tutorial as sufficient onboarding. [Official tutorial introduction](https://docs.python.org/3/tutorial/index.html).

Proposed flow: select a stored function or code range → open **Understand** → see the saved version/range and coverage → inspect two to four literal syntax facts → expand one concept → optionally open its manual chapter. Keep the code visible and theme the surrounding controls consistently. Use separate labels for **Found in this source**, **General Python concept** and **Official reference**. Preserve keyboard navigation, selection, back/history and focus restoration when the manual closes.

Begin with values/names, assignment versus annotation, parameters, conditionals, loops and return sites; the tutorial's control-flow chapter, introduction and errors chapter are useful entry points. A topic link is a curated reference mapping, not evidence that the manual explains this project's purpose or its runtime result. A later glossary can provide short SIREN-authored explanations in the user's language while the official English text remains identified as such. Translations require separate provenance and license verification; none were investigated here.

Examples remain inert, clearly marked **Example · not executed**. Copying should target the clipboard or a separate explicit draft, never overwrite the selected project source. No automatic **Run**, install-package, repair or terminal action follows from opening a manual page. A missing optional pack should leave local contextual concepts usable and offer an explicit install action or a clearly labeled official online link; it must not silently fetch content while offline.

## Proposed route and CSP boundary

Do not embed arbitrary upstream HTML into the privileged application document or relax the app-wide CSP to make documentation scripts work. First inspect the actual archive. Prefer a build-time, deterministic conversion of article content and local assets to inert reader pages, preserving headings, anchors, code, tables, attribution and license pages. Build a bounded local text/search index as data if needed. This can avoid executing Sphinx search or UI scripts in the reader; upstream script/search compatibility has not been tested.

The following are design requirements, not claims about today's routes:

- Use a dedicated read-only documentation surface with no privileged preload, Node API, project mutation bridge or execution interface. Its accepted inputs are an installed pack identity and an allowlisted logical page/anchor, not arbitrary filesystem paths or URLs.
- Resolve pages through the verified manifest. Reject traversal, absolute paths, drive/UNC paths, encoded traversal, invalid decoding, symlink/reparse escape and requests outside the installed pack. Reject duplicate/case-colliding entries and oversized or excessive files during future extraction; resolve and revalidate the owned root.
- Keep articles inert: disallow scripts, inline handlers, forms, frames, objects, executable downloads and remote subresources. A separate reader policy should start with `default-src 'none'`, `script-src 'none'`, `connect-src 'none'`, `object-src 'none'`, `frame-src 'none'`, `base-uri 'none'` and `form-action 'none'`; allow only the chosen local styles/images/fonts actually required. Exact origin rules depend on the implementation and need qualification.
- Load reviewed SIREN-owned reader styles through the permitted local origin; do not add `unsafe-inline` or `unsafe-eval` just to preserve upstream presentation. Preserve code contrast, tables, diagrams and print legibility across SIREN themes. Converting styles must be recorded as a transformation, with notices retained.
- Relative manual links stay inside the same pack and retain its identity. External links never trigger background access or receive project code, paths, search terms or source selections. Any explicit external opening goes through a finite scheme/host policy and clearly leaves the offline reader.
- Failed, corrupted or unsupported packs should show a bounded diagnostic and preserve the prior working pack; they must not fall back to loading arbitrary online HTML into the privileged app.

## Before implementation can be considered complete

Acquire one approved upstream snapshot in a separate packaging step; verify its internal release identity, contents, licenses and actual expanded size. Review the reader/design boundary and deterministic transformation. Then test missing/corrupt packs, atomic install/rollback, offline startup/search/anchors, malicious paths/HTML, external navigation, theme readability, keyboard/focus behavior, version labels and source isolation. Qualification must distinguish source tests, real desktop behavior and copied-package evidence. **None of these runtime, archive or distribution checks were performed here.**
