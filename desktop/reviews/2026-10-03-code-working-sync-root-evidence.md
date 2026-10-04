# Native Code working-view synchronization — implementer evidence

Written by the implementing coordinator. This is implementation evidence, not an independent review or release approval.

Other genuine working Code windows receive only a native source ID/version/hash after the actual owner accepts an operation. Immutable readers receive no update and the origin receives no echo. A clean idle window coalesces updates and loads the native-selected version. Dirty, pending, fenced or retiring windows retain their local text and offer separate latest-version review or explicit replacement with confirmation. Cancelling that confirmation retains the view. Stored historical source versions remain exact; this does not promise recovery of an optimistic edit that native persistence never accepted.

Clean refresh now stages a candidate editor while the old clean editor remains intact and paused, rechecks the native reference after loading and publishes only an exact current version. A refused refresh resumes the old view. A failed all-view preparation retains visible local text instead of clearing a fenced editor. A failed clean refresh stops automatic retries for that version; a newer authentic version may try again. Explicit replacement resets the controller. No concurrent merge or blind conflict retry was added.

Native source diagnostics report only a bounded method and uppercase error code to the main process. Renderer error projection, caller/frame/role/epoch checks, native selection guards and saved receipts are unchanged. Invalid renderer requests are not dispatched or logged. Diagnostic callback failure cannot change persistence. An actual SourceRepository pre-selection EIO fault test retains the selected pointer, observes native EIO and still returns sanitized SOURCE_REQUEST_FAILED to the renderer.

## Evidence

- Native final 300k-line `evidence/source-sync/2026-10-03T23-15-16.016Z`: COMPLETE, five groups, inputs unchanged. Actual multiple working views/immutable reader, clean version refresh, dirty retention, real stale-view Lock refusal restoring four Code plus Home windows, confirmation Cancel/accept, historical bytes and final all-view Lock were exercised.
- Native 300k-line Code/Docs regression `evidence/source-link/2026-10-03T23-13-22.632Z`: COMPLETE, four groups, inputs unchanged. Actual source save, chosen Docs row, cancellation, stale CAS, Refresh, native Close/reopen and open-dialog Lock retain exact independently expected bytes.
- Focused source IPC, notification, domain owner and primary persistence suite: 45/45. New diagnostics and retry-loop assertions were observed failing before their respective implementations.
- Frozen final full suite `evidence/working-sync-final-suite-result.json`: **698/698**, identity 2 plus remaining 696, exit 0, no failures/skips/cancellations/todo, `changedInputs: []`. Started `2026-10-03T23:16:03.456Z`, finished `2026-10-03T23:19:38.317Z`; log SHA256 `81f2b9aa8206c2a63ee3ab1dd36dd02b8e0c1e5590ccf19db5dd1e4865cb05a3`. Earlier `working-sync-suite` 696/696 predates the transactional refresh correction and is not final qualification. Committed-package results will be recorded only after execution.

## Retained adverse evidence

- Native source-sync `22-47-03.869Z`: initial fixture selected Home before its module controls initialized; the fixture now waits for actual controls.
- Native source-sync `22-49-27.663Z`: **real refresh race** — the native selected source changed from version 2 to 3 during the sibling's exact version read, and the old UI cleared the view. Native guards refused correctly. Transactional editor staging and post-load revalidation correct the UI; the original adverse result and screenshots remain retained.
- Native source-sync `23-02-02.086Z`: fixture counted four total registry views while the real roster correctly contained four Code plus Home. Exact per-role assertions corrected the fixture; local text/data oracles are unchanged.
- Hosted CI48 package Close failure is retained separately in `2026-10-03-native-code-docs-root-evidence.md`. Its underlying native failure cause remains unconfirmed; new diagnostics do not claim to fix that cause.

## Remaining scope

Hosted results subsequently verified: DesktopCI49 (`37161648066`) and Launcher40 (`37161648063`) completed successfully for exact private head `6d903957d5536fff7a9d5cda4785577325bbb409`. This confirms the current committed run, including the new package probes; it does not identify or relabel the underlying cause of the original CI48 failure.

### Committed package and exact private sync

Local source `0da1fcb49d9b9f52ad357d6da8a09cb5b12340f4`, development package `dist/development-812771fb-2886-4a78-b741-1945421b7dec`: ASAR SHA256 `f2aaa67a941d9d7c6c7d0431c96e91a66e46e7af8b4b4bb3664a4838625a064a`, 31,349,764 bytes; Electron binary unchanged `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`.

Original packaged recovery probe `evidence/packaged-2026-10-03T23-21-14.291Z` completed. Actual packaged300k Code/Docs `evidence/source-link/2026-10-03T23-22-00.661Z` completed four groups; actual packaged300k shared Code `evidence/source-sync/2026-10-03T23-23-57.417Z` completed five groups. Each runs a whole separate Unicode folder copy with an explicitly stored selection, not a packaged test-root bypass. Captured probe inputs remained unchanged. The original hostedCI48 failure is still retained and its cause is not inferred from these local successes.

Exact private remote `6d903957d5536fff7a9d5cda4785577325bbb409`, tree `7bf9bde4cd1cbd0a59b258bbda061e2df744f9bc`, parent `013e45f84e43a634a17d17a54b0d878f16c36d8e`: 18 changed exact Git blobs, 1,106 unrelated blobs preserved, 1,124 total. Actual parent/tree, nonforced ref and raw PR2 head/body/draft/base were verified. Main remains `688c48528ff7bdab77908faf041806d10acc54dc`; PR remains draft/open/unmerged. The new hosted outcome is pending, not a claimed success.

General editable native Docs, new unlinked-source Docs creation, native Diagram/Presenter/Terminal, attach-back, A/B analysis/diff workers, complete layout/cursor restoration, physical multi-monitor/DPI and end-to-end input-p95 qualification remain open. This batch does not establish those capabilities. No installed user application was replaced, main merged or public release published. The one-time Git graph remains frozen.
