# Home native fixture repair verification

**Author/implementer report; not independent approval.** Created 2026-10-07T15:18:34.778Z.

Only one line changed in each authorized native fixture. Product and shared helper sources were not edited by this author. Original hosted failures remain preserved; no GUI or package qualification is claimed.

## Confirmed causes and repairs

- Home Library and Library Search expected three Settings rows. Actual Home creates four: Change PIN, Check for updates, Quick guide, Help & diagnostics. Both assertions now check exact IDs, labels and order, including Help; omitted, renamed, reordered and extra rows are rejected.
- Recovery admitted the native preload receipt while the document was still loading with no body, then read body.innerText. Its local wait adapter now requires a real body and interactive/complete readyState inside the same existing startup condition and 30-second deadline. Every original URL, snapshot, private-label, readonly, refusal and project-preservation assertion is unchanged.

## Evidence

- Final permanent unit replay against exact retained originals: **0/7**, expected exit1. Reproduces both 4!==3, missing-Help false acceptance and null-body failure.
- Repaired fixtures: **7/7 GREEN**. Private-label exposure still fails the unchanged privacy assertion; absent body expires at exactly30000ms. No privileged startup invocation.
- Focused Home set: **18/18 GREEN**, exit0. Includes new unit, native-home-ready, home-commands, home-startup and home-entrypoints. Existing entrypoint unit builds only into its own temporary directory; no application build command was run.
- All three native files pass node --check. 61 complete literal browser expressions compile; dynamic startup conjunction executes in the new unit.
- First post-edit test attempt was6/7 because the new test expected the raw error instead of the existing helper wrapper. Its log is retained. Final test checks wrapper, original cause and unchanged deadline.

## Exact fixture identities

- `tests/native/home-library.mjs`, line19: original `58033606386cdc66c0a6d577e1464ff8a354eab68744ea5e0c7cee9678692989`; repaired `f585601591bb3127d6f340b112056d10ec2026aa040d99952963b229d33f2c7b`. 12 assertion calls before/after; every other line exact.
- `tests/native/home-library-search.mjs`, line26: original `af8ee7d8cf9512defae75fbe69c663ae68a542f9d0753b81ebbe514e4b86f23a`; repaired `30053b6a3f795c518a3e4395b2f8d2344c618566ad2d782bdeba2293936f97e9`. 26 assertion calls before/after; every other line exact.
- `tests/native/home-recovery.mjs`, line17: original `3ec788ae0e79ef306b06b80175a499b220c8cf253454ea01ccb2e37f002ad38e`; repaired `fc77ff0559372814ff23c040e6bc3f4a8ee95034a1d82f07e97eea1b449da547`. 11 assertion calls before/after; every other line exact.

Exact originals: `reviews/2026-10-07-home-library-original.mjs`, `reviews/2026-10-07-home-library-search-original.mjs`, `reviews/2026-10-07-home-recovery-original.mjs`. All hosted receipt paths/hashes, logs, source captures and precise one-line deltas are in the companion JSON.

## Limits

- No GUI/Electron/native fixture execution by this author. Original hosted ADVERSE receipts remain original; no native or package PASS claimed.
- No application build command, install, download, full suite, commit or push. Existing focused home-entrypoints unit calls buildWorkspaceEntrypoint solely into a fresh temporary output directory; workspace generated files were not intentionally written.
- Minimal DOM/fake-clock unit probes establish fixture admission/oracle behavior, not actual native rendering/input delivery or packaging.
- Author/implementer report is not independent review approval. Parent retains separate native/full-suite ownership.
- Initial RED logs and first 6/7 attempt remain preserved alongside final exact-original 0/7 replay and 7/7 GREEN.

No successful native rerun is inferred from unit results. Coordinator must run the real native tests separately.

Completion readback: all13 relevant captured inputs unchanged during report completion; main, preload, Home, drive and condition also match the preceding independent readback capture. All3 retained original fixture copies match their hosted receipt inputs exactly. Original receipt hashes unchanged.
