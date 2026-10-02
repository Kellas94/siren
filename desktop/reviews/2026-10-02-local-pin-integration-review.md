# Local PIN integration review

Author: `/root/launcher_implementation`. This is an independent review of the coordinator's main/IPC/preload/renderer integration. I also authored `LocalPinAccess`; this report **is not an independent review or approval of that service**. The service has a separate implementation receipt. No production release approval is supplied.

## Findings and repairs checked

1. **Wrong current PIN in Settings revoked the editing session.** The original UI reused `unlockPin`, whose service intentionally clears the unlocked session before verification. Cancel then exposed a stale workspace with writes refused. The coordinator now calls `verifyCurrentPin`; the added service operation checks an existing unlocked session, counts mistakes durably and revokes only at the cooldown threshold. UI rereads native authority and reloads the locked screen when authority is lost. The service extension has 16 tests and separate RED/GREEN evidence, authored as implementation evidence rather than independent service approval.

2. **Restarting during cooldown made the PIN UI permanently unavailable.** The original UI treated `state.blocked` as a permanent storage failure even when `retryAfterMs` was positive. The repaired UI distinguishes storage failure from timed cooldown. My actual Electron diagnostic observed the persisted cooldown after renderer reload: native retry time 29,983ms, disabled PIN input and a live countdown. After expiry, the same dialog enabled entry without another reload; native verification unlocked the selected workspace. Result, screenshot and native logs: `desktop/evidence/pin-cooldown-independent-review-nqIztr/`. This used the real Electron bridge and Windows `safeStorage` in a new owned Data folder. Entry used the actual input/auto-submit handler; initial setup and five wrong attempts used native bridge calls explicitly for this synthetic fixture. No Windows policy or user Data was modified.

3. **A selector write failure could yield a false successful retry.** A real IO diagnostic planted an empty owned directory at `session-selection.json`. Against main SHA256 `9a8ad479e3496f86f40f1422bbd7a4da8b03c8b26094812efe06c8ab0434903e`, first setup returned `WORKSPACE_UNAVAILABLE`; retry returned `ok:true` with native authority unlocked, while bootstrap remained `snapshot:null, readonly:true`. `selectedId` had been assigned before selector durable acknowledgement. Original result retained at `desktop/evidence/pin-selector-review-sfAyGB/result.json`. The coordinator moved state publication after the selector write and made preparation failure explicitly lock access. My regression confirms repeated attempts remain refused while the hostile target exists; only removing the freshly owned empty target permits a later successful, durable editable selection.

4. **Lock lacked a renderer quiescence boundary around final writes.** The coordinator changed native lock to use the actual renderer transition guard: inert workspace, final flush, storage lock, native writes drain, then PIN lock. My regression pauses actual workspace persistence while a bag containing private Code bytes is pending. Authority remains unlocked until acknowledgement, concurrent unlock is refused with `PIN_BUSY`, and the exact private bytes survive successful lock. A real injected persistence failure returns `SAVE_FAILED`, resumes renderer editing/storage and retains native authority. These are extracted actual integration functions with real ProjectStore, RecoveryStore and storage queue IO; the close seam is explicit and does not claim to execute the complete frozen-editor `saveState` implementation.

## Additional checks and limits

`desktop/tests/local-pin-integration-review.test.mjs` passes **4/4**, evidence `desktop/evidence/local-pin-integration-review-green.log`. Locked IPC refuses save, export, recovery bytes/restore, project selection, diagnostics and deferred account actions before calling their services. An unlocked real PIN cannot override native readonly project-creation safety. Source inspection confirms the preload exposes the redacted bootstrap and main emits `snapshot:null` plus no project ID while locked; startup recovery/native readonly remains separate from the local PIN grant.

An earlier review harness used recovery-purpose writes to wait for a revision-commit fault. That path correctly does not commit a new project revision, so the harness waited indefinitely. Its partial log is retained at `local-pin-integration-review.log`. The corrected harness saves an actual workspace bag containing the private key and uses an actual RecoveryStore; this was a harness repair, not evidence of a product failure.

No additional must-fix was found in the checked narrow integration scope after those repairs. The four integration tests use an explicitly labeled external OS-storage double with real AES encryption and real service scrypt; only the separate actual Electron countdown diagnostic verifies Windows OS encryption here. Full native Settings/change flows, startup-frame privacy and complete desktop regression qualification remain the coordinator's or other reviewers' evidence, not newly attributed to this reviewer. This is local access control; it is not encrypted project storage, protection against a local administrator, remote account activation, hostile renderer qualification or PIN reset/recovery qualification.

## Reviewed identities

Actual Electron countdown renderer SHA256: `2bfdf1b2b01f0631e80841fdc4d68277fed81a5f59a463f547a541bf733781d0`.

| File | SHA256 |
| --- | --- |
| `desktop/src/main.mjs` | `cd92ffdb54ef48f400eb904eb3c372b875df98453b4a47be683e0c27491dd72f` |
| `desktop/src/ipc.mjs` | `356b1f2e1ccba5ce56ab56aeb0f425d17779209fe40403d441d8936f60631305` |
| `desktop/src/preload.cjs` | `198353950873f884d48604e0238e3cf270412da2679666b2c7238b70d89f9206` |
| `desktop/src/ui/pin.js` | `ccccdfd08113e4ae583ea8a92945dd2f5acc3720a1a0f4c1de94c567cd712a05` |
| `desktop/src/ui/desktop.js` | `73fbc0e75e9d929a54246589e9369a1a52b018c1bdbec6a83a7bb01b0c04aaf4` |
| `desktop/build/renderer.mjs` | `7aaa79d222315d109b7f75978253e84ff81dbd8796e7364ad6e80f95b672d4a1` |
| Review regression test | `ace2a9e97dfdc3dbabce26b84226c9aeff7ac63310ecc714d2c494fc7b548fdb` |
