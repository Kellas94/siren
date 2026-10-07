# Docs Activity integration — independent original review

Author: Codex independent reviewer `/root/diagram_history_final_review`, 2026-10-07.

Scope: corrected pure model and browser wrapper, actual Activity controller, reader reveal, Docs window integration, build injection and relevant scoped tests against the approved Docs Activity plan. No GUI, native test, build, full-suite, package, commit or release execution. Root's native results are not my execution evidence. Earlier pure-model original report SHA-256 `1e82d8b8e5dcda8e35b338a5367eb7c115238ca4964ae2ae53139377db3045b8` remains unchanged.

## R1 — P2: interrupted Refresh leaves Activity unavailable after Resume

Original reviewed `src/ui/windows/docs.js`: `readDocument` lines182–193; `onResume` lines208–210; `refreshActivitySaved` line15.

Actual bounded reproduction with the production Activity controller **and** production Docs window/draft/reader:

1. Admit a read-only document; Activity is enabled and opens.
2. Start Refresh with a delayed `getDocument` reply. `readDocument` calls `activity.invalidate()`, which discards the controller's admitted context.
3. Start common view preparation while that reply is pending. Activity is paused; preparation awaits the read.
4. Resolve the exact original read. `readDocument` sees `paused` and returns false without admitting Activity.
5. Preparation succeeds for the still-ready old read-only document; call the real registered Resume callback, modelling preparation rollback/resume.

Observed after Resume: `documentReady: 'true'`, body not inert, document visibility restored, but Activity button remains disabled and the panel hidden. A later explicit successful Refresh restores Activity. No saved data or editor data loss is claimed.

Cause: the old saved context remains in the window, while the controller context was invalidated. Resume calls `refreshActivitySaved()`, which admits only when the draft version differs from the saved-context version. An interrupted read with an unchanged version therefore never restores the controller context. This is an availability regression in a supported lifecycle, not merely a speculative future malformed-input case.

The original integration fixture stubs `SirenNativeDocsActivity.create`; its `invalidate()` increments a count without clearing context, so its Lock test cannot catch this failure. My separate probe loads the actual `activity.js` into the fixture runtime before the actual Docs scripts. The DOM and native bridge remain finite stand-ins; this is not independent Electron execution.

Recommended correction: explicitly re-admit the correct saved Activity context when resuming after invalidation, including an unchanged version, with current dirty state; retain the distinct saved snapshot when unsaved edits exist. Do not populate Activity using working content under the saved label. Test the real controller with delayed Refresh → prepare → resolve → resume, plus changed-version flush and dirty/fenced rollback controls. Root accepted the finding and began a separate test/correction after my original source capture; this report does not certify that later correction.

## Corrected model budget rechecked

The earlier model P3 fallback accounting defect is fixed in reviewed model `e7ea2b86…`. My own previous saturated-page fixture now returns exactly 131,072 field characters and `nextCursor: 8`; the next page contains all twelve malformed entries beginning at original source position8. The fallback text is charged to `rowChars` before the page admission decision. No record is lost or silently skipped.

The model's native metadata aliases were inspected as inert recorded fields: `who/detail`, `seq/testingRef`, review note, imported digest/trail evidence and finite fingerprint leaves. They do not become proof of approval or source/test equivalence. Complete canonical comparison still includes opaque/source/formatting values and refuses unsupported or over-budget input rather than reporting partial equality.

## Other reviewed behavior

- Saved Activity context is retained separately from working content. Explicit working comparison reads draft blocks; saved comparison reads admitted saved blocks. Verified Save and version-changing flush replace the saved context, while conflict retains the prior saved snapshot and local edits. Fenced read-only inspection is permitted; no new write bridge is introduced.
- Activity actions carry generation/context checks and live-host membership. Pending completion after pause, invalidation, context replacement or disposal cannot repopulate its private DOM. Dirty updates retire working comparison results. The new R1 is missing readmission after invalidation, not failure of those privacy guards.
- Opening via pointerdown preserves editor focus rather than committing a pending field. The controller does not remount the editor. Exact Jump intentionally focuses the block; reader/editor reveal appends lazy blocks after a bounded unique-ID lookup, retains original mounted controls, and does not CSS-interpolate IDs. Native keyboard/IME and actual rich/image focus behavior remain unqualified by these stand-ins.
- Activity row output is model-bounded; comparison display is paged by20 with at most512 complete comparison rows. Inert textContent renders claims/unknown values without creating links, images or execution sinks. Reader source-only initial rendering is preserved; explicit unknown-block reveal creates a labelled retained-data anchor.
- Build injection places the pure helper before the Activity controller and window integration, retains syntax/CSP checks and includes the Activity panel stylesheet. The actual helper output read in this review contained zero CR characters, avoiding the previously encountered CRLF inline-CSP mismatch at this helper boundary. I did not build or validate generated Docs HTML.

## My executions

Command:

`node --test tests/docs-activity.test.mjs tests/docs-activity-view.test.mjs tests/docs-activity-integration.test.mjs tests/docs-reader-reveal.test.mjs tests/docs-reader-guard.test.mjs`

Actual result: **39 passed, zero failures/skips**. These successful existing tests coexist with the genuine new R1 reproduction; they do not erase it.

Independent command: `node evidence/docs-activity-integration-independent/probe.mjs`. It verified corrected model pagination and recorded the R1 adverse lifecycle observation above. The probe completed with its assertions describing the observed adverse behavior; that exit success is not a product PASS.

Evidence directory: `evidence/docs-activity-integration-independent/`. Exact original production window/controller/draft/reader/model and original integration fixture are retained there. The probe's original source and output are retained; it used live production inputs at the captured hashes, before root's correction. `probe-first.log` also preserves its first output.

| Evidence | SHA-256 |
|---|---|
| probe.mjs | 4966a526a55bf630e60428763721fd211e7d92e4d028437c3889f521bdb04e69 |
| probe.log | 4b005d9196ed0a5180520679c182c7cfdbb5c0051547ee70d89120f9553f9f4d |
| scoped-tests.log | 77b456a0620da9c7866fb5fa6566b2f8496f160dd26609c65c545d9be3cda046 |

## Snapshot identities and concurrent change

`inputs-before.json` plus `extra-inputs-before.json` capture twelve actual inputs. `inputs-after.json` captures the same set after my tests/probe. Source/build/controller files below remained unchanged at recapture. The integration test changed during recapture as root started the new regression; therefore this is the **original reviewed snapshot**, not a final approval of a frozen corrected candidate.

| Input | Original reviewed SHA-256 |
|---|---|
| src/documents/document-activity.mjs | e7ea2b861b56bd06c6dd28c5cfaaa732f2afec9f71996770bf3a27f38cda24b1 |
| build/document-activity.mjs | 663faf06a90707605fccb259bd7ee74ff71f883bf6ce79a866f817fe10ebb113 |
| src/ui/docs/activity.js | 9411ea58bd12357364cd5a852d573e021cac7372e1a6a3133bffe82ecc125ca4 |
| src/ui/docs/reader.js | b63b3a92a680e68411a143a6c3396456943b56883bc0ed36987a5612687bf68a |
| src/ui/windows/docs.js | 2e44bfdd4ae978ccdd6bc99faae57796fac281c55c429329a5c5a37c563b6a32 |
| build/windows.mjs | 0936de4b266f348318ea44cad1d56d0224a73a3b2876079baa856188ff52d50b |
| src/ui/docs/draft.js | 4743688a62dd9615f72e6f7551d2a9198680150f933096e48a324001d8ea4c7f |
| tests/docs-activity.test.mjs | 1a72d9ee0ece37a3245759d8935efc2ce5d8cb4e4ba61fcfcfcbcff2faaf4e5f |
| tests/docs-activity-view.test.mjs | 579f04ee9c38cac1bff0d68ba4df33370db3681544ef2349944266ef12d38a02 |
| tests/docs-activity-integration.test.mjs | d9abd22fa01bbb8ff8b91f156c4a680fdd1bd21775e254ecede41088cbf3640a |
| tests/docs-reader-reveal.test.mjs | d0e1a9633d1dda5e3bc091dd34ad59bc1aa693e613b4866b10e15772daae1180 |
| tests/docs-reader-guard.test.mjs | 61b4685dc7ea6a282d9dc34e890a2ce05af4d112f4d52425303c5ef168bd2c43 |

No product, test, build or original report edits were made by this reviewer. Hosted pan and historical Save-to-Attach observations remain outside this Docs review and remain open on their own evidence.
