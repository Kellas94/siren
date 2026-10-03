# Recovery save diagnostics: synthetic reproductions and receipt observability

Prepared 2026-10-03 by `/root/recovery_diagnostics`, using systematic-debugging and test-driven-development. Original CI26 evidence was read without mutation. No CI retry, packaged/native Electron launch, or PASS replacement was performed. Initial ownership was this review and `tests/recovery-save-diagnostics.test.mjs`; the parent subsequently authorized only `src/ui/storage.js` and `tests/renderer-storage.test.mjs` for a narrow observability repair. No commits.

## Historical evidence remains adverse and cause remains UNKNOWN

The retained original `evidence/ci26-independent-original/evidence/packaged-2026-10-02T20-52-29.049Z/result.json` records `completed:false`, operation 45, production `window.sirenDesktopRequestClose()`, and `packaged.mjs:148`: **Save not acknowledged: failed**. The earlier original-project save was acknowledged (baseline revision 2; readback revision 6). `recovered-initial-revision.json` was captured before the failed recovered initialization flush. `failure-state.json` shows normal renderer bootstrap mode, readonly false, body uninert, no controls panel, and no animations. It does not contain the native save refusal, native PIN state, project pointer, or pending records at failure.

The retained hosted renderer hash is `20f0b24e31d22f9f93dfbab1b373c20344f4920fbb792417654cb622a755776a`, source merge `2268370f42a35a7a24471c873253c0f4f3f1c5ec`. Local sources/built renderer are not asserted to equal that binary. Synthetic tests below demonstrate reachable defects in inspected local APIs; they do not establish which refusal CI26 experienced, or demonstrate historical data loss.

## Reproducer implementation and exact observations

The new diagnostic test creates only owned temporary projects with synthetic source. It uses the actual `ProjectStore`, `RecoveryStore`, `RecoveryAccess`, atomic writes, pointer/hash readback, pending preservation, and exclusive writer. It extracts and executes the actual current `main.mjs` `selected`, `saveProject`, and `restoreRecovery` bodies in a VM instead of copying their logic or importing Electron. It builds the current renderer and executes the actual resulting `saveState`, serialized save queue, and production close/flush code with the actual native adapter. DOM controls are a narrow synthetic input boundary; process bootstrap, preload, IPC transport, full DOM, and native launch are outside this test.

1. **Healthy control.** A verified recovery point restores into a distinct revision-1 project. The production initialization flush advances that project to revision 2, verifies hash/full bytes and saved checkpoint, clears its pending record, and preserves the original project exactly.
2. **Post-commit checkpoint acknowledgement refusal.** An injected `RecoveryStore.fault('checkpoint-verified')` throws after genuine checkpoint-byte verification. The workspace pointer is already revision 2 with exactly the attempted bag and matching hash. Main returns `RECOVERY_DEGRADED`; production close throws **Save not acknowledged: failed**. After removing the fault, the next normal production flush still requests base revision 1 and receives `REVISION_CONFLICT`. Two pending attempts remain; the current pointer is not overwritten. Before the observability change the adapter receipt had no `code`; its separate callback already had the code. The new adapter retains it on the receipt and error. Main's degraded receipt currently does not provide committed metadata, so the adapter correctly invents none.
3. **Actual recovery-root writer contention.** Another real checkpoint pauses at `checkpoint-verified` while holding the exclusive Recovery-root writer. A recovered-project initialization save commits revision 2, then fails checkpoint acquisition and returns `RECOVERY_DEGRADED`; no revision-2 checkpoint exists for that recovered project. After releasing the other writer, another flush still uses base revision 1 and returns `REVISION_CONFLICT`. This confirms the writer-refusal chain without replacing `exclusiveWriter` with a mock.
4. **Old operation publishes into new selection.** An original-project workspace save pauses on the main service's checkpoint-preparation read, after CAS/commit/readback. Recovery restores and selects another distinct project while `writes.size` remains 1. Releasing the old operation produces an acknowledged old save. Native `selectedId`, `bootstrap.recoveryProjectId`, and disk `session-selection.json` name the newly recovered project, but `bootstrap.snapshot.project.id` names the old project. The recovered project's full pointer snapshot remains exact. This proves inconsistent bootstrap publication, not recovered disk corruption or the historical CI26 cause.

The diagnostic adverse-behavior assertions intentionally remain visible and pass when these observed defects reproduce. They are characterization evidence, not a claim the transition/CAS defects were repaired. They must be replaced with the desired invariants when their owner implements a causal fix.

## Minimal authorized change

`src/ui/storage.js` now returns the native refusal `code` and attaches it to `error.code`. It preserves only validated primitives from `revision`, `sha256`, `committedRevision`, `committedSha256`, and `workspaceCommitted` when present. It does not spread native objects, include workspace JSON/PINs/arbitrary fields, infer commitment, change `ok:false`, reconcile revisions, retry, or bypass CAS. The on-write-error callback uses the same typed error.

`tests/renderer-storage.test.mjs` adds a refusal receipt contract and negative cases for `ACCESS_REFUSED`/`REVISION_CONFLICT`: malformed commit metadata is excluded and failed writes retain base revision 1. Synthetic private fields are not returned. Existing private Code draft acknowledgement, storage transition lock, and failed flush behavior remain covered.

The built `saveState()` still catches the typed error and returns only `{status:'failed', attempt}`; production close still throws its generic status before examining the typed flush receipt. Those files were outside this agent's authorized mutation scope. The adapter repair makes `window.sirenDesktopFlush()` useful for the next collector but does not independently make the existing packaged evidence collector capture the missing code.

## Verification record

Node `v24.16.0` on Windows.

- Initial diagnostic harness run: 0/4, all due to an omitted VM `Buffer` binding (`ReferenceError: Buffer is not defined` in `selected`). This was a harness error, not a product reproduction. Adding that binding produced 4/4 diagnostic assertions.
- RED, before product edit: `node --test desktop/tests/renderer-storage.test.mjs desktop/tests/recovery-save-diagnostics.test.mjs` produced 6 passes and 2 failures. Both failed because actual `code` was `undefined` instead of `RECOVERY_DEGRADED` (unit receipt and production flush receipt).
- GREEN, after product edit: the same targeted command produced 8 passes, 0 failures. Then the negative malformed-metadata/CAS test was added.
- Full `npm test`, approved `require_escalated` because existing unit tests fork owned synthetic crash processes: **144 tests, 134 passes, 10 failures, exit 1, 181125.7799 ms**. All 4 diagnostics and all 5 renderer-storage cases (including the added negative case) passed. The suite ran concurrently with another agent's Sources2 implementation; all 10 failures were `ERR_MODULE_NOT_FOUND` for the then-missing `src/sources/repository.mjs` in `tests/source-repository.test.mjs`. This is an adverse partial-source snapshot, not a final coordinated stable-source suite. No rerun was performed. The long quiet interval was the existing real 180-second OIDC callback deadline; that test passed.

The 10 full-run failed tests, recorded individually rather than omitted as unrelated work:

- exact BOM, mixed newline and Unicode bytes survive import, durable draft, commit and fresh reopen
- duplicate operations survive restart; stale writes and ID reuse cannot replace selected bytes
- split surrogate, unpaired input and out-of-range edits preserve original version and bytes
- malformed UTF-8 stays exactly exportable and refuses editing without implicit conversion
- 32 MiB source boundary is accepted, +1 refused; growing edit also obeys bytes rather than lines
- project disk budget includes retained distinct blobs and journal overhead, refusing before publication
- blob, journal and preselection faults keep old version; postselection ACK states the durable new version
- checkpoint failure after source commit returns committed version with recovery-degraded durability
- PIN/access, IDs, unknown project and junctions cannot bypass owned-source access
- concurrent owners cannot both select edits from the same source version

## Next boundaries for the parent owner

First carry the typed cause through generated `saveState` and close failure, then have the packaged collector retain a bounded ledger of generation/project ID, purpose, base revision, native code, and any confirmed committed revision/hash. Capture current native PIN/safety state, selected pointer, explicitly owned synthetic pending metadata, and checkpoint/catalog identities on the first failure. Do not include project contents, PINs, paths/account secrets, or arbitrary environment data.

For causal repair, the demonstrated selection defect warrants draining/quiescing old renderer operations at recovery selection and conditionally publishing bootstrap only for the currently selected project. A failed transition must leave usable original authority. The demonstrated post-commit refusal warrants distinguishing verified workspace commitment from checkpoint acknowledgement; reconcile only exact verified attempted bytes and revision/hash and keep failure visible until recovery is acknowledged. Merely incrementing the adapter revision on generic refusal or treating `RECOVERY_DEGRADED` as success would be unsupported and unsafe. Retain ordinary CAS refusal, read-only/PIN enforcement, original-project preservation, and the production flush assertion.

## Local source identity

Hashes at the completed targeted GREEN run (uppercase/lowercase equivalent). These bind source reasoning, not CI26 hosted bytes:

| File | SHA256 |
| --- | --- |
| `src/main.mjs` (unchanged) | `79e8645b92112c80c8c9aa3a0bfad81ff336b8ede182e39ad57e79a41bc2ff63` |
| `build/renderer.mjs` (unchanged) | `321aa70263827454e9efe23a51ea74205f1312042d94f1d1062dd9e7cb14cde2` |
| `src/projects/store.mjs` (unchanged) | `3aa5ed291ac65a87753865e5ef7ca009930bddec43cf10caa2c1bf2df2411bc2` |
| `src/recovery/checkpoints.mjs` (unchanged) | `8a5a00f1fc7afee9b07a6525c701fa392130cb5b2b909d6fe0c65e8edcda4fe5` |
| `src/ui/storage.js` (receipt repair) | `bd30b35e1c2cfcb8bf6324f099d696843114539a681012868ca91c2257b2b6ec` |
| `tests/recovery-save-diagnostics.test.mjs` | `9d1db9e49f2aa3bdd2562b0acd1ec5eca0098c11621ab581014f80147820d635` |
| `tests/renderer-storage.test.mjs` (including later negative case) | `e7c9f1883b683eb167e2cd3a3fec11703b0e5387e6e5720a75c353ab775f1ab7` |
