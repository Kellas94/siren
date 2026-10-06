# Home saved-backup implementation: independent review

Author: `/root/native_menu_trace_review`, reviewing implementation by `/root`. Date: 2026-10-07. **CHANGES REQUESTED on the captured initial implementation**, for the two bounded issues below. No source/test/build/workflow edits, GUI, native chooser, full suite, package or hosted qualification were performed by this reviewer. Later corrections require a separate recheck; this report and its initial evidence must remain unchanged.

## Immutable scope and evidence

Own seven-case controlled result: `evidence/home-backup-implementation-independent-2026-10-07/2026-10-06T22-24-09.137Z/result.json`, SHA-256 `0c72da32fb1e26c8ee647b1c9e9ec057d298653f0e3f0723c660e6eee48e7826`. Driver retained alongside as `probe-driver.mjs`, SHA-256 `0451219c4c438669e2d8d86c31c2296075e5f6614b7dee3b2e8b326ba63a8676`. Nineteen inputs, including plan/tests, were copied before execution and hashed before/after: all unchanged throughout this run. The receipt contains every full hash.

Principal initial identities:

| Input | SHA-256 |
| --- | --- |
| `src/navigation/backup-export.mjs` | `62205ad138377ad67b1a74b0ed7edf9fa151f8c62b6fc540f14564c964ba8577` |
| `src/main.mjs` | `4e7d6a8a11562780af28275211b7d4b9c944d3520e8549d6a5265cc3c7337315` |
| `src/preload.cjs` | `ce9012ef4e05826ea2bbbe26b2a03cb9accc5f06b7cca4c9c6d32c3160b9a8f2` |
| `src/ui/workspace/home.js` | `725d97ee93cb13d0185e9e3b6d7e97eeb67669eaf7c2c30683f5be641cef672d` |
| `src/ui/workspace/guide.js` | `ac59a2edc0bd488840c7481d381fb7afe336d37eb3e7e89dd2c8bbe93b8f85b0` |
| `scripts/package.mjs` | `eebdd65a05eae5a3049b294df492826fc08bbdaa2099a176a4ef6d7e107e1a03` |

The review used the actual new exporter, HomeAuthority, actual extracted main registration/exportBytes, real ProjectStore/SourceRepository/RecoveryStore/atomic IO in owned ignored evidence, and the complete actual Home renderer with a controlled DOM model. Only native Electron/chooser, controlled filesystem fault boundaries and DOM primitives were substituted. This is a causal controlled probe, not native UI evidence.

During report preparation root separately reported a renderer build refusal (Home entry 66,286 bytes exceeds its unchanged 64 KiB cap) and began moving message dictionaries to the existing guide asset. Home/guide current hashes therefore drifted **after** this immutable run. The original captured results are not claimed to review that amendment. Root's build outcome is owner evidence, not an independently executed build here.

## Findings

### P2 — Do not mask publication/cleanup uncertainty with ordinary access refusal

Initial `src/navigation/backup-export.mjs:53` prioritizes `!isCurrent()` over `publishing` in its catch. A real publisher error that coincides with revocation is therefore returned as ACCESS_REFUSED rather than BACKUP_WRITE_FAILED. This loses the destination-check warning precisely when accepted output or retained staging may exist.

Own actual-main/actual-atomic reproduction: inject an error at after-rename and revoke authority in the same controlled hook. The chosen destination already contains the exact 48 saved bytes, SHA-256 `ec2689b382e189db13e0a8193bb24635feee16b4be9bd2fc21b5a46e1c42cf8f`; readback/confirmation cannot complete, but Home receives only ACCESS_REFUSED. This is not EXPORT_COMMITTED: readback was not confirmed. The correct classification is unconfirmed write/check destination.

A second owned-IO reproduction changes the chosen destination parent at before-rename, revokes access, and forces pending cleanup failure. The actual native `writes` drain correctly rejects PENDING_CLEANUP_FAILED and one staging file remains; the Home result again collapses to ACCESS_REFUSED. The existing publication test asserts only `ok:false` for that result and misses this classification gap. **No authorization bypass or successful Lock is claimed:** the rejected drain is preserved, as intended.

Requested correction: retain BACKUP_WRITE_FAILED for a real publisher/cleanup/readback failure even if authority changed, while preserving ACCESS_REFUSED for clean pre-publication revocation and the publisher's explicit clean ACCESS_REFUSED result. Never return confirmed EXPORT_COMMITTED for a failed readback, suppress cleanup failure, remove accepted destination bytes, or weaken the native drain. Add actual-main/atomic controls for both observed branches and their unchanged-authority counterparts.

### P2 — Keep the visible Home Lock action available during backup wait

Initial Home `controls()` at line 59 disables every button whenever busy is true. The new export action sets busy for the complete pending chooser/operation. Consequently actual `#homeLock`, enabled before export, becomes disabled during it; only the native menu/keyboard Lock command remains permitted by the command installer exception at line 271.

Own probe executes the complete actual render, paint, controls and command code against a controlled DOM. It obtains the actually created Home Lock button, verifies enabled before export and disabled while the backup bridge promise is held, then delivers the native Lock command and observes one actual `desktop.lockPin()` call. This proves a visible-control availability discrepancy, **not** a PIN bypass or broken native Lock.

Requested correction: preserve the already authorized visible Lock action while a saved export is pending, retaining its actual unavailable/blocked/disposed guards. Keep other actions bounded and do not enable all busy controls. A focused renderer test must query the real painted button rather than returning an empty button collection; retain the native command and covered-result suppression controls.

## Positive boundaries independently observed

- Actual main Home route exports a verified readonly selected classic snapshot byte-exact; chooser waiting leaves `writes.size===0`, and original project remains unchanged.
- Actual pending chooser cannot publish after selection→return with authority invalidation/generation changes; no destination is created.
- Actual schema-2 ProjectStore/SourceRepository/RecoveryStore save/export plus corrected source-bundle parser round-trips exact BOM/CRLF/Unicode bytes, full saved snapshot and opaque provenance/history. Corrupting the real source blob subsequently returns BACKUP_UNAVAILABLE without a second publication; no metadata-only fallback occurs.
- Generic desktop exportProject remains SENDER_REFUSED from Home; its forbidden service is never called.
- Source inspection confirms exact Home URL/grant/selection derivation, empty descriptor-checked input, a single pending operation, sticky revocation, saved-only content, source verification, checked base64 wire preflight and finite result fields. The existing publisher mechanics and private PIN worker/startup are not widened by the main/preload diff. Package source list includes the new module.

These controls are useful evidence, not universal proof. The source-wire budget formula matches the serializer's schema-2 skeleton/base64 expansion by inspection; this reviewer did not allocate a new 64 MiB boundary fixture. Parser roundtrip is not the frozen hidden-window metadata-validation or native import qualification. The complete correction still needs the renderer budget/build check, focused regressions, independently captured amended-source recheck, then the separately scoped full/build/copied-package/native/hosted evidence. Root-reported 40 focused passes do not substitute for this review or those later outcomes.

The approved plan is appropriately limited to Home selected saved backup; no Docs/Presenter delivery, save-all preparation, generic desktop authorization or new PIN policy is needed. Original hosted Diagram reopen remains independently adverse and causally unresolved.
