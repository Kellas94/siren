# Docs Activity controller — Task2 implementation record

Author and focused Node executor: `/root/media_batch_review`, 7 October 2026. I authored only `src/ui/docs/activity.js` and `tests/docs-activity-view.test.mjs`, plus this report and scoped evidence. Root authors the common model, reader, Docs controller/build integration and their tests. This is an implementation record of my own code, not independent approval, native GUI proof, full-suite/package/hosted qualification or release readiness.

The agreed `SirenNativeDocsActivity.create({host,button,enabled,onJump,onCompare,onStatus})` API is implemented with `setContext`, `updateState`, `invalidate`, `pause`, `resume`, `dispose`. It uses the actual injected `window.SirenDocumentActivity` for record projection, with no save/content/apply/export authority. The supplied host is the only private DOM subtree it replaces; the main document/editor is never repainted or focused by opening Activity. Left pointerdown on its buttons preserves the existing editor's selection/focus; explicit Jump is delegated to root and may move focus deliberately. Native defaults handle select/button keyboard activation, with local select focus restored after panel repaint.

Comments expose All/Open/Resolved and exact original-position paging, including the model's256-position scan limit and honest source-total counts. Changes delegates a finite `{position,against:'saved'|'working'}` compare, labels saved/working/dirty context, reports refusal codes without claiming equality, and displays at most20 of up to512 returned rows. Readonly working-target refusal such as root's `COMPARISON_UNAVAILABLE` is rendered as unavailable, with no attempted mutation. Review/releases display the model's inert recorded fields including top-level `signoffFromFile`, accompanied by explicit attribution: these are recorded claims, not independently verified approvals/signatures/tests. Unknown and overlength details remain available through existing Preserved fields/exact archive. No HTML, image, URL, clipboard or code execution sink is introduced.

Every pending callback captures generation/context identity. Context replacement, dirty-state update, local navigation, hide, pause, invalidation and disposal retire stale work. Pause clears and hides all private host DOM synchronously; rollback resume restores the previously open admitted context only when `enabled()` permits it. Invalidate removes the context and closes the disclosure; disposal also removes supplied-button listeners. A detached old control is fenced by generation/context and actual host membership before it can call root. Errors expose only bounded finite error codes/generic retained-data messages.

## Actual test sequence and preserved adverse evidence

All evidence below is in `evidence/workspace-surface/docs-activity-controller/`.

1. Original9 tests were authored and run before the controller existed: **9 failed** at the explicit missing-controller assertion. `original-red.log` SHA256 `496d817fc1388289166a402557a6078883c085cf13a7c71c2503dbf8de4c0180`.
2. Initial implementation produced **6 passed /3 failed**: `first-green-attempt.log` SHA `bf6cbba2090653e81ccd45e4caf6a754b5f6a66579a16e8dc9e4df5e6fb34dfe`. These three failures were my fixture/oracle defects: selected `.value` lacked its change event, malformed-comments expectation remained on Changes, and a blanket negative regex matched the truthful disclaimer “not independently verified approvals”. Original tests were retained byte-exact as `original-view-tests.mjs`, SHA `dce0547192e9e49a2a799689825750abd2fed5c3868aea1a27c1d26fe7bf1410`. Corrections used the intended native-control event/state and an exact negative-provenance disclaimer expectation; no product data/authority/budget assertion was removed. Nine then passed.
3. Additional clean-working/focus/excerpt/single-operation/max512 tests produced **11 passed /1 failed**, exposing my real clean-working label bug: it called clean content unsaved. `clean-working-red.log` SHA `8afb66f39740f3103d506a819a5e6616c94bade734c2c1436f8479807025195a`; the corrected controller says “Working current content · No unsaved edits”. Twelve passed afterward.
4. Added stale-control regression produced **12 passed /1 failed**: an old detached Jump handler could target the newly admitted document. `stale-controls-red.log` SHA `e8f16514ca3a89ff253e7c4c0250b9c03f7c147e54bdcdd7dcf9801b467aa6f0`. Actual generation/context/host-membership checks corrected it without changing the test's refusal oracle.
5. Final actual command: `node --test tests/docs-activity-view.test.mjs tests/docs-activity.test.mjs tests/docs-reader-guard.test.mjs tests/docs-draft.test.mjs` — **40 tests passed,0 failed/skipped/cancelled**, Node exit0. This includes13 own controller tests and root-owned related model/reader/draft cases. `node --check src/ui/docs/activity.js` exit0. Final log SHA `ea28e61c1437fadd5c66e1c4be19847cc74de1d0d1675a7ca1415e14ab496626`.

The test DOM is an explicit scoped stand-in with an HTML-sink throw, focus/selection and owned-tree membership; callbacks use the real model and controlled deferred promises. This proves controller behavior under those unit fixtures. It does not prove actual browser focus, native controls, CSP, layout, timing, Lock IPC, source persistence, physical monitors or pending rich/context/image integration. Those require root's real integration/native/package qualification. Root's concurrently implemented alias correction is not my code or independent approval.

## Frozen Task2 working bytes

`final-receipt.json`, SHA256 `0d54595810f8927b68765487e84c77df30ee9cafdd3de38b9e84f81b8f178704`, records the actual focused command exits and before/after hashes for these6 source/input files; `changedInputs:[]` only describes that capture interval and set. It is not a whole-tree freeze or Git blob equality claim.

| Input | Bytes | SHA256 |
| --- | ---: | --- |
| `src/ui/docs/activity.js` | 10792 | `9411ea58bd12357364cd5a852d573e021cac7372e1a6a3133bffe82ecc125ca4` |
| `tests/docs-activity-view.test.mjs` | 13438 | `579f04ee9c38cac1bff0d68ba4df33370db3681544ef2349944266ef12d38a02` |
| `src/documents/document-activity.mjs` | 10125 | `e7ea2b861b56bd06c6dd28c5cfaaa732f2afec9f71996770bf3a27f38cda24b1` |
| `build/document-activity.mjs` | 218 | `663faf06a90707605fccb259bd7ee74ff71f883bf6ce79a866f817fe10ebb113` |
| `src/ui/docs/reader.js` | 6493 | `b63b3a92a680e68411a143a6c3396456943b56883bc0ed36987a5612687bf68a` |
| `src/ui/docs/draft.js` | 7924 | `4743688a62dd9615f72e6f7551d2a9198680150f933096e48a324001d8ea4c7f` |

IDs supplied for root integration/native authors: `documentActivitySection` (comments/revisions/review), `documentActivityFilter` (all/open/resolved), `documentActivityAgainst` (saved/working), `documentActivityRows`, `documentActivityJump{originalPosition}`, `documentActivityCompare{originalPosition}`, `documentActivityPageNotice`, `documentActivityPrevious/Next`, `documentActivityCompareRows`, `documentActivityComparePrevious/Next`. The button/host themselves are supplied by root; no hardcoded button ID dependency exists.

The source files in this table are held stable for root review/integration. No GUI/build/native/package/process/commit was run by me. No writable comments/review/release/snapshot-restore parity or historical Save-to-Attach closure is claimed.
