# Read-only design review: PIN crash recovery plan

Author/reviewer: `/root/native_menu_trace_review`, 2026-10-07. Scope: pre-implementation contract review of the approved-scope plan against actual LocalPinAccess, main/IPC, atomic/owned paths and package startup. **This is research/design feedback, not review of an implemented correction or production approval.** No source/test/build/workflow edits, GUI, new executable attempts or policy workarounds. The earlier C# blocked report remains unchanged at SHA256 `7e9c9025025723f1ac1d67be2ac47481d15a96b132177506d0453362a745ce22`.

Inspected plan: `portable/docs/superpowers/plans/2026-10-07-siren-pin-crash-recovery.md`, SHA256 `936c14990d7662cb701ef34047edce5f8f4d54a87c8f2d1e79afb901644c9752`. The independent-process graceful-exit/decrypt receipt is a testable candidate boundary. It retains Chromium key dependence and must remain conditional on bounded actual proof and the original application crash regression. No prototype result should close the actual defect.

## Concrete implementation conditions

### 1. Epoch checks must cover every asynchronous phase, including wrong attempts

`local-pin.mjs:130` captures an epoch before its serial queue, but checks it only before `await #load()`. An awaited decrypt adds a new revocation window: immediately recheck epoch after load before executing any operation body. Successful unlock/verify/change paths check after scrypt, but the failed-match branch calls `#wrong()` before an epoch check. A Lock during scrypt or async decrypt must not enter a fresh retry/migration write under stale authority. Propagate the captured epoch into load/match/persist as needed, and recheck after each awaited provider result and immediately before initiating filesystem publication. Queued calls captured before Lock must stay revoked even if a later unlock occurs.

The asynchronous provider also must not publish a cached successful result as availability/unlock after it was cancelled or a profile/process identity changed. `state()` and the public `getPinState` contract remain synchronous; preserve a finite cached capability/error state and make actual operation failure authoritative. Returning a Promise from today's `isEncryptionAvailable()` would fail its strict `===true` check. A startup probe may report capability but must not pre-encrypt a canary that masks the first-use regression.

### 2. Distinguish cancelled-before-publication from accepted rename

`atomicWrite` flushes, closes, checks owned target, calls `before-rename`, renames, calls `after-rename`, then verifies exact readback. It has no PIN epoch guard by default. Awaited provider success followed by `await #path()` is not an atomic authority check. Supply a specific pre-publication guard through the existing fault/admission boundary so a stale epoch cannot publish after Lock during encryption or path preparation.

After rename has been accepted, finish the actual readback while tracked; do not call the operation untouched or restore the old record automatically. A post-rename failure may already have committed the new PIN/backend/cooldown. Retain bytes, stay locked/fail-closed and distinguish that uncertainty in internal result/state. Recheck epoch before setting `#unlocked=true`. Assigning persisted `#record/#configured` for an accepted exact write is distinct from granting session authority. Cleanup may remove only an owned uncommitted staging file, never the destination or a retained legacy record.

Required barrier tests: Lock during decrypt, scrypt, protect, independent verify, path preparation, before rename and after rename. Verify both durable bytes and public locked state, not merely a rejected Promise.

### 3. The existing main `writes` drain does not include PIN operations automatically

`main.mjs:237–240` returns PIN methods directly; `siren:desktop` at879 delegates directly to `invokeDesktop`, unlike the source/domain handlers that explicitly add tracked operations. `lockPin` sets `pinTransition`, drains `writes`, then calls `localPin.lock()` only after preparation/retirement. Close likewise drains `writes` and may begin while setup/unlock is pending because those calls do not set a persistent transition flag. Simply adding provider await inside LocalPinAccess will leave child and publication work outside these drains.

Add an explicit PIN/provider operation drain or tracked PIN service wrapper. Track through provider child exit, verification and final atomic/readback—not only until stdout arrives. Establish admission closure/revocation at Lock/close intent and define rollback: a failed workspace preparation may preserve an already unlocked session, but it must not reactivate a previously revoked pending PIN call. Do not put the current Lock/close Promise into a set that it then awaits; do not allow provider writes to wait on the drain containing themselves. On ordinary close, either join admitted PIN work honestly before closing or refuse close while a bounded access transition finishes.

### 4. Dedicated profile serialization must survive parent death

The current module-level PIN queue serializes instances in one parent process, and the UI Data-root single-instance lock prevents two ordinary app mains. Neither alone prevents an orphan protection child from retaining the dedicated profile after its parent is killed while a new application instance starts.

The worker must hold its own dedicated-profile writer exclusion through actual normal exit; a later worker must refuse while another writer owns that profile. An Electron dedicated-userData single-instance lock can be evaluated for that role, but it is a contract requiring actual concurrent/orphan/restart proof, not an assumption. Do not reclaim on PID alone, fixed delay or parent absence. Parent timeout/cancellation must wait for actual owned child termination before launching another writer. Serialize both encryption and independent-decrypt children with every other operation using that profile. Do not “repair” an uncertain profile by deleting it.

Worker encryption and independent decrypt must use the same **dedicated userData/Local State authority**, separate from the UI profile. A separate storage partition alone would not establish separate Local State ownership. Set profile paths before ready; verify main-owned canonical paths and any existing critical profile files, reject links/junctions/aliases, and refuse a missing expected profile on decrypt of an existing new-envelope record rather than silently replacing it. This is in addition to owned `Access/local-pin.bin` checks. No worker takes a renderer-supplied path.

### 5. Entry dispatch must precede normal module evaluation and preserve packaging

Current `package.json` points directly to `src/main.mjs`, which statically imports the ordinary app modules and executes Data-root/protocol setup before ready. An early conditional placed below those static imports does not prevent their evaluation. Use a minimal admitted startup entry with conditional **dynamic** import of fixed worker or normal-main modules; invalid/duplicate/partial worker arguments must refuse rather than silently start the normal UI.

This worker is a separate Electron main **process**, not a Node `worker_threads` analysis worker; use supported main-process safeStorage APIs after ready, no BrowserWindow/WebContents/renderer bridge. If the async safeStorage variants are chosen, respect installed44.5.1 return shapes rather than assuming decrypted return value is a string. Worker public flags must not admit arbitrary operation names, modules, executables, URLs or record paths. Payloads use private bounded pipes with strict version/type/length/framing and zero logging of plaintext/ciphertext. Verify output and successful exit/stdio completion; an empty successful exit is not a receipt.

Use the fixed admitted `process.execPath` and correct packaged application archive path, without PATH/shell or diagnostic executable overrides. Prevent inherited runtime/debug/Node-mode options from changing the worker execution contract. The new entry/worker/provider must enter `scripts/package.mjs`'s finite `sourceFiles` set and required-archive assertions; the package dependency traversal test currently starts from `src/main.mjs`, so extend it to the actual entry and both dispatch branches. Prove the copied-package normal path and worker path separately. The existing signed Electron runtime remains byte-identical; no rejected C# helper or process-reader cryptography repurposing is involved.

### 6. Legacy retry writes need an explicit transitional policy

The plan's original wording says migration only after known-PIN authentication and no migration on wrong PIN. Actual `#wrong()` always encrypts and writes incremented failure/cooldown state, and `verifyCurrent` also writes after successful proof. A blanket replacement of `encryptString` with the new backend would therefore migrate on an unauthenticated wrong attempt. Keeping attempts only in memory would violate the existing persisted cooldown contract.

**Root's explicit ruling during this review:** legacy records remain on their original backend for bounded failure/cooldown and `verifyCurrent` writes until successful known-PIN **unlock/change** authentication; only then atomically migrate. No memory-only counters or reset. Root will amend the plan. This deliberately permits narrow transitional legacy encryption for those counter/proof updates, rather than the decrypt-only proposal in my earlier immutable prototype research. The current ruling governs the implementation.

The provider must communicate the admitted record backend to persistence explicitly; new envelopes always use the dedicated provider, and legacy writes cannot be chosen by hostile payload fields. Preserve salt/verifier/PIN length/KDF and existing retry state during migration except the existing successful-authentication counter reset. A correct `verifyCurrent` must retain its existing session-proof semantics without migration or PIN rotation. Wrong change attempts likewise stay on the legacy backend. A legacy encryption failure stays locked/unavailable and preserves bytes; it must not silently convert or reset.

### 7. Strict envelope and migration receipt must bind the exact payload

Recognize only the finite supported legacy prefix/shape and an explicit new envelope/version/backend. Do not use “try new decrypt, then legacy” to reinterpret corruption or unknown versions. Do not assume a readable ciphertext implies a valid PIN record: keep the existing strict field set, salted scrypt verifier, attempts/cooldown invariants and bounded plaintext validation. No provider receives PIN digits.

The independent verifier must decrypt **the exact ciphertext returned by the encryption child**, compare the exact serialized verifier in memory, and exit normally before publication. Do not accept a provider boolean, a hash of a different frame, same-process decrypt or availability as that receipt. Parent death between successful child exits and atomic publication should leave the old record or no record; after accepted publication the new record must open under a new parent. During migration keep the original recoverable record until the atomic replacement is accepted; interruption or uncertainty must not erase either usable authority silently. New-envelope unwrap/decrypt failure must never fall back to setup or legacy parsing.

Envelope overhead must remain within the existing16KiB protected-file bound and4096-byte plaintext bound. Changing those bounds requires separate justification; credentials have different1MiB storage semantics and remain out of this PIN-only change. Unknown/corrupt profile/envelope and unavailable protection must remain blocked without writes.

## Recommended minimum gates before coding/closing

First obtain the bounded actual-profile prototype receipt with normal child exits and independent exact decrypt, while preserving the original actual crash cases and C# policy block. Then implement the explicit async/epoch/drain/backend contracts above with deterministic phase barriers and existing real owned atomic IO. The decisive product evidence remains fresh first-session actual serialized-verifier setup → immediate forced termination → fresh normal app startup/unlock, plus setup/Lock kill, repeated restart, graceful controls and authenticated legacy migration interruption. Add orphan-worker writer contention and accepted-rename uncertainty; run the actual copied package. A synthetic prototype pass alone cannot qualify these product boundaries or recover already-unreadable legacy keys.

## Inspected source identities

```text
src/account/local-pin.mjs 61b0eb84e4b90d2babd73d2dde9c34c976c271f17c7c0c5eb98dc9c47547eea7
src/main.mjs ddcbb10cc560d3c74a22550e19860deb617383bd801b25105d168443874440a1
src/projects/atomic.mjs 803eb8c40edd5711bae3a51ade69ab935b779bae7d1ec6e8da5808dbeea77de4
src/projects/paths.mjs 0f3fe81566b050f0a30f808960325cc2ca7d5027239cf65ed5ffb6a751724554
src/data-root.mjs 4bfb044c74097ee0fdd65276355324d32cd95cccac7c3efe358e059ad62fd7ab
src/ipc.mjs 1f33543d72438a8ce3c2198db1d5999bb90d54111de6cb37e4626dea1946f34a
scripts/package.mjs fc6c8ba8dd261e2d28be412c98d26c74a92b76c478e90e8b1070e7567a8b80c7
package.json b88a96a244c88c369ab9934635613896008feeb4ab0165eecb604a51aaba8043
```

These are source-inspection requirements, not a claim that an unimplemented provider already violates them. No GUI/runtime/CI tests were run in this design review. Root/media own the evolving prototype evidence and its actual failure categorization.
