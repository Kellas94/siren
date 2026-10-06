# Native Docs: export the saved document

This is the next bounded functional-parity tranche of the approved workspace UI plan, not a new account/service or release. Analysis: `desktop/reviews/2026-10-07-native-docs-single-export-boundary-analysis.md`, actual author `/root/media_batch_review`, SHA256 `8623a6b0dfb0be542fd3e7eb2ab07066484f07b04083a948efcceec1a2359612`.

## Contract

- Add a compact **Export saved…** control in native Docs for JSON archive, Markdown and standalone HTML. Explain that drafts need explicit Save and linked assets remain references. Preserve common navigation, themes, keyboard, detached-window and Lock behavior.
- Main captures the actual own Docs grant and exact saved read. Renderer supplies only format and expected 64-hex Docs content version/document hash. No renderer body, identity, paths, source fetch or SVG. Verified read-only saved documents may export. Content CAS is not a monotonic event counter.
- JSON preserves exact saved document data, IDs, unknown fields, claims and provenance in a versioned archive envelope. Markdown and HTML retain the complete archive in a labelled raw-data appendix and disclose visual/reference limits. Do not promise reimport before an actual single-document importer exists.
- HTML is static/inert with restrictive CSP and fixed CSS; no scripts, events, forms, SVG or external URLs. Rich markup requires a bounded real parser, not a regex sanitizer. Unsupported/unsafe data remains visible in the preserved-data section. PNG/JPEG may embed only after exact bounded validation. Prefer explicit omission notices to incomplete image claims.
- Preserve the current saved-read bounds (8 MiB, depth32, 50k nodes); cap each formatted output at16 MiB. Bound rich parsing/formatting and test malicious/oversized content. No implicit retrieval of large linked source bytes or linked diagram rendering.
- Use unique main-generated owned project export files and **Show file**, following the existing Diagram publisher authority, atomic publication, post-write recheck, cleanup-failure fencing, retained receipt, pause/abort/drain lifecycle. Do not introduce an untracked writer or a pending chooser into Lock.

## Sequence and proof

1. Write failing pure format/adversarial/fidelity/budget tests, implement finite formatting, and run meaningful RED/GREEN. Choose parser packaging only after inspecting current production build/dependency admission.
2. Write saved-Docs publisher tests against real owner/registry/store/reader and owned filesystem. Exercise source references, CAS conflicts, readonly, cross-role/frame refusal, concurrent requests, pause/Lock/revoke-before-and-after-rename, cleanup uncertainty, receipt expiry and reveal refusal.
3. Integrate the service into main lifecycle and a separate finite preload. Add native Docs control/menu feedback, including dirty-draft and saved-version distinctions. Test actual UI commands and barriers, keeping draft bytes intact.
4. Fresh independently authored review with original findings preserved. Apply real corrections using RED/GREEN; record rulings rather than silently enlarging scope.
5. Freeze source/build/tests/workflow, complete full suite and actual native saved export cases. Build a separate committed development package, compare actual archive files/helper/runtime identities, then qualify affected copied-package paths. Hosted CI remains a separate verdict.

## Rulings and ledger

Ruling: references-only document delivery plus exact raw-data appendix — preserves saved data without silently loading hundreds of thousands of linked code lines — visual exports cannot be represented as a complete linked-assets backup.

Ruling: retain the existing owned-file destination and Show file lifecycle — avoids introducing another pending OS chooser into native Docs — arbitrary Save As locations remain a later adapter.

Status: analysis and plan only. Implementation has not started. PDF/Office, document reimport, linked-asset bundling and physical multi-monitor/DPI verification remain explicitly open. No main merge, production release or installed-app replacement.
