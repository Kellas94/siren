# CI26 packaged save failure: independent read-only investigation

Author: `/root/launcher_implementation`. Prepared 2026-10-03 for the CI26 run dated 2026-10-02. No product/test edits, CI retry, native rerun or PASS verdict. I used the systematic-debugging skill to trace original evidence before suggesting a fix boundary.

## Original evidence and source identity

Repository `Kellas94/siren`, workflow run **37062377426**, job **111021846159**, artifact **11251079422**. The connector supplied the decoded job log and original artifact. The preserved ZIP at `desktop/evidence/ci26-independent-original/original.zip` has SHA256 **13afd0eda5b2c89a2ebfafecdc377af5d6ac63b2fb3be9797cd31801542604d0**, matching the upload digest in the job log. All **70** entries were checked to resolve inside the new owned evidence directory before extraction. Original entries were not rewritten. Filtered relevant job lines are retained at `desktop/evidence/ci26-independent-job-relevant.log`.

Hosted checkout/package source is merge **2268370f42a35a7a24471c873253c0f4f3f1c5ec**, merging remote **06f6bc445ffc0d5bed9362749101d86d6a02fb4f**. Hosted renderer SHA256 is **20f0b24e31d22f9f93dfbab1b373c20344f4920fbb792417654cb622a755776a**. Its archive is 14,277,541 bytes, SHA256 **b7246b5cb6245df422f1889b4b649f0a9e9539d4dfc7676ce36c9ea5562b8423**. The hosted packaged probe SHA256 **771f17fb4836d4621f3ba6071edbc10cdc718ae7e4bf29814429686566a9d541** matches the inspected local probe. Local renderer `808e280…` is a different artifact and is not substituted as proof about hosted bytes. The artifact retains build identities, not the actual ASAR or complete runtime Data tree.

## Demonstrated failure, not a diagnosed cause

**Validation blocker:** CI26's packaged run cannot be called successful. `packaged.mjs:148` awaited `window.sirenDesktopRequestClose()` and received **“Save not acknowledged: failed”**. The original result is `desktop/evidence/ci26-independent-original/evidence/packaged-2026-10-02T20-52-29.049Z/result.json`; it marks `completed:false` and records operation 45 at that exact flush. The job separately records 115 unit passes and twelve completed native groups. Those do not override this packaged failure.

The failure is later than the first editor save. That save was acknowledged with baseline revision **2**, post-read revision **6**, and hash **85f8cf6df42aed652bb4c95ba3cf35cb96e2bc3166a67b8d2a80adfe687b076b**. The original edit and the pre-restore drain completed; `restore-boundary.json` exists. Recovery then created a distinct project. Assertions before line 148 checked the complete recovered bootstrap against its initial immutable revision and native checkpoint, and `recovered-initial-revision.json` was written. Failure occurred when draining normal initialization/canonicalization saves for that recovered project. The later `recovered-at-restore.json`, clean exit, folder copy and safety variant were not reached.

`failure-state.json` reports `mode:normal`, `readonly:false`, an uninert body with no read-only class, no open Desktop controls panel and no running animations. `failure.png` shows the recovered-project label, actual **Local save failed** status and retained edited diagram. A tour card is visible, but the rejected awaited flush is not a pointer hit-test failure. The current native PIN state and underlying save receipt code were not captured. Therefore the evidence does not prove PIN lock, native readonly, quota exhaustion, corruption, or a particular CAS/writer conflict. No data-loss conclusion follows from the generic failure alone.

## Where the failure information is lost

**P2 diagnostic gap:** `src/ui/storage.js` turns a native `{ok:false, code, message}` into `{ok:false, backend:'native', error:new Error(message)}` and does not preserve `code` in the returned receipt. The frozen `saveState()` catches that error and returns `{status:'failed', attempt}` without a typed cause. `sirenDesktopRequestClose` then reports only the status. The packaged failure collector records UI safety and the top-level exception, but not the underlying native receipt or recovered project's current pointer/pending files. The packaged main process also excludes its renderer console-message logging, and the retained runtime/electron logs contain no native save code. These facts prevent an evidence-supported root-cause verdict today.

## Source-supported hypotheses to discriminate

1. **Cross-generation writes at recovered-project reload.** The Recovery button calls native restore and immediately schedules `location.reload()`. `main.restoreRecovery` invokes `selected(await recoveryAccess.restore(id))` without the renderer transition/quiescence boundary used for PIN lock. Old renderer writes/timers can therefore remain in flight while selection changes and the new renderer initializes. The native `writes` set records operations but does not serialize recovery selection with them. This is a credible race boundary, not proof that it happened in CI26. The existing pre-restore flush reduces earlier writes but does not freeze all later activity.

2. **Project commit succeeded but recovery acknowledgement failed.** Main saves the project first; checkpoint failure then returns `RECOVERY_DEGRADED`. RecoveryStore uses an exclusive Recovery-root writer and can reject overlapping activity. On any `ok:false`, the adapter retains its old revision. If a project pointer already advanced, a subsequent attempt at that old revision can return `REVISION_CONFLICT` repeatedly. This failure chain is supported by code order; CI26 does not retain the initial native code/pointer necessary to establish it as the actual cause.

3. **Other real native refusal.** A per-project writer conflict, IPC refusal, changed native authority, checkpoint/IO error or post-commit acknowledgement error can also produce the same generic renderer status. Those possibilities remain open. Successful small original writes and the tiny recovered fixture make the recent 64MiB serialization boundary an unsupported explanation for this specific failure.

## Recommended owned reproducer and repair boundaries

Preserve this failure first. Run one instrumented, owned synthetic packaged scenario bound to its exact archive/renderer identity: edit → production flush → open recovery → verified recovered bootstrap → production flush. Capture a bounded per-save receipt ledger with opaque project ID, purpose, base revision, returned code and any confirmed committed revision/hash; also retain the selected pointer, pending records, recovery point/catalog identities and current native PIN/safety state at the failure. Record renderer generation/navigation events so old-context writes can be distinguished. Never log PINs, project text, credentials or arbitrary environment contents. Current CI artifacts omit the runtime Data tree, so select only explicitly owned synthetic evidence if additional files are retained.

A deterministic integration test can pause a genuine old-generation write/checkpoint while initiating recovery, then verify that transition drains or safely refuses before changing selection. A separate test should commit a workspace, fail its recovery acknowledgement, and attempt a later save: ensure no false success and no silent overwrite or permanent stale-revision loop. These tests would distinguish the hypotheses; none were executed by this reviewer.

If the transition race is demonstrated, apply the existing renderer quiescence/native drain concept to recovery selection and retain resumable behavior on failure. Prevent a completed old-project operation from publishing bootstrap state for the newly selected project. If partial commit is demonstrated, distinguish workspace commitment from recovery acknowledgement and reconcile only the exact owned committed bytes/revision; a CAS refusal must not be ignored. In every case keep native readonly/PIN enforcement, original-project preservation, full hash/readback checks and recovery failure visibility. Do not remove the flush assertion, force a raw write around the adapter, dismiss a recovery dialog to manufacture success, or convert a failed receipt to PASS.

Reviewed local source hashes (source reasoning only, not hosted binary equality):

| File | SHA256 |
| --- | --- |
| `desktop/tests/native/packaged.mjs` | `771f17fb4836d4621f3ba6071edbc10cdc718ae7e4bf29814429686566a9d541` |
| `desktop/src/ui/storage.js` | `9691d51e1c90bd850848f0ec3144949ab7a2a9ba792da72e98c545b7387d05a2` |
| `desktop/src/main.mjs` | `79e8645b92112c80c8c9aa3a0bfad81ff336b8ede182e39ad57e79a41bc2ff63` |
| `desktop/build/renderer.mjs` | `321aa70263827454e9efe23a51ea74205f1312042d94f1d1062dd9e7cb14cde2` |
