# PIN crash-recovery implementation: independent scoped review

Author: `/root/native_menu_trace_review`, independent reviewer of the implementation authored by `/root`. Date: 2026-10-07 (Europe/Bucharest). This is one overall implementation review, separate from the earlier contract/design review and blocked C# research report. The reviewer made no product, test, build, package or workflow edits and ran no GUI, Windows worker, native crash matrix or global suite.

## Outcome and scope

No remaining concrete must-fix finding was identified in the eight-file snapshot below after the corrections and six controlled rechecks. This is an **evolving-source review completed within its stated scope**, not native qualification, release approval, or a claim that the original crash defect is closed. The snapshot stayed unchanged across the six-case probe. A later source/package change requires its own comparison or recheck.

The review covers asynchronous PIN authority, cancellation/publication, legacy migration, worker protocol and IO, dedicated profile ownership, startup dispatch and finite packaging. It does not approve the reviewer's earlier source-bundle helper or modify any earlier adverse report.

## Retained initial adverse evidence

Original controlled result: `evidence/pin-implementation-review-2026-10-07/2026-10-06T21-49-32.134Z/result.json`, SHA-256 `deeed5038beeb97785de583371c25b15a615ca551e01f98c15f2d6d0dc32cde7`. Its `inputs/` preserves the exact eight source files; pre/post hashes match.

1. The protector-integrated LocalPinAccess dispatched an unrecognized, nonlegacy record to the legacy decoder once. The refusing double blocked it and original bytes remained unchanged. This established a finite-format dispatch gap, **not** an authentication bypass. Original local-pin SHA-256: `736b72f227e16e1c75b3723ddb78d187927f9867cdf4e257a9e59c72109e9df2`.
2. The actual original worker/protocol bodies, evaluated in a VM with a controlled short synchronous pipe write, called graceful quit after emitting only 11 of 123 frame bytes. The parent decoder refused the incomplete frame. This was a fail-closed reliability defect, not successful malformed publication. Original worker SHA-256: `9da82f77fc390b95571f53d23da53558436b11830c058ca3ec68818a92908ee8`; original protocol SHA-256: `71b8c020f9a173ea6ec8a71f802773568ccf91342fbabdf05cf1c9b26abd4ad1`.

Root also corrected accepted-rename configured-state uncertainty and missing-key recreation after an earlier successful decrypt. Root's separate four-case RED and focused GREEN logs are owner evidence; this report does not relabel them as the reviewer's reproductions. In particular, an attempted new missing-key adverse probe ran after that correction and correctly refused: it is not evidence of an additional RED on already-fixed inputs.

## Exact corrected snapshot and own recheck

Result: `evidence/pin-implementation-review-2026-10-07/2026-10-06T21-54-53.010Z/result.json`, SHA-256 `e9723956f0501532d358948b9dae36e19992de2fdbbb3e33908c70136d65504a`. Six cases COMPLETE, `inputsUnchanged: true`. Corrected driver retained alongside it as `recheck-driver.mjs`, SHA-256 `c488624d8606bc81a5953a42bf87b95470afb3d7102fb7c83aca8d7070c10e78`.

| Reviewed source | SHA-256 |
| --- | --- |
| `src/account/local-pin.mjs` | `a41f4d6868820973b92f568239934b4d1a669db317b4388aed049e225b6eb537` |
| `src/account/pin-protocol.mjs` | `d673e53389c2f20e98fbd5b20bc53e8b496e12b913e467117c7fea19e2df2f5a` |
| `src/account/pin-protection.mjs` | `1e47f90e02e0e17b29c6cc26ee555c85fdeebea289cb6e4bf66b0c2b437d79fb` |
| `src/account/pin-worker.mjs` | `cc7c1c07b18f939c527b1c872141cbc43f25458d5612b9ca8e22b1306eb0c995` |
| `src/start.mjs` | `1db3fb8b968168f69a915956927bcf5f544a59dd792be21c635e3e6d5a0b4f62` |
| `src/main.mjs` | `2fca3e2e51df88359e63e74e7a64acafeecb28f4d12a022abf91e1672da35b83` |
| `scripts/package.mjs` | `1d2a0c9f9e4c67611096125a19c03057bc5a8c12204b7dfb77a60b294a5e7307` |
| `package.json` | `dbce38460412c79f3ae8618279ec27c11ffcc01598aebab672e36e867adccb19` |

Atomic/owned-path/IO dependencies and package test were copied after the probe, with hashes in `dependency-capture-after-probe.json`, SHA-256 `6f5241f4d234cdc1c56216261882b52c3aad7e8aeed8807309f056f9e410c4b5`. These are explicitly post-probe captures rather than a retroactive pre/post dependency receipt.

The six independently executed cases establish:

1. **Worker checks key existence again.** Actual PinProtector plus captured actual worker/protocol bodies and owned filesystem: after a successful decrypt, remove Local State after the next parent preflight but before worker code executes. The private request carries `requireKey:true`; one worker starts, exits 23 before readiness, returns no encryption, and leaves the file absent. Electron, pipes and cryptography are injected; no Windows key observation is claimed.
2. **Accepted publication cannot appear fresh.** Actual LocalPinAccess/scrypt/atomic IO with an authenticated asynchronous AES-GCM storage double: injected after-rename failure leaves configured=true, blocked=true and locked. A second setup cannot overwrite it; a fresh instance unlocks the retained record with the fixture PIN.
3. **Lock drains and revokes pending changes.** Captured actual main `lockPin` body and actual LocalPinAccess, with protection held at a barrier: Lock waits for cancellation/drain. The change returns PIN_LOCKED and cannot publish. A controlled workspace flush refusal returns SAVE_FAILED, preserves prior record bytes and the existing unlocked session, and reactivates the workspace. Failed-flush rollback cannot revive the revoked authentication.
4. **Parent retains known-key expectation.** Actual provider and owned filesystem: after successful decrypt, deleting Local State before a later encrypt causes refusal without launching another worker or recreating the file.
5. **Unknown envelope dispatch is closed.** Actual LocalPinAccess rejects an unknown header without invoking the legacy decoder; original bytes are unchanged. This applies to the actual protector-integrated path. Old no-protector unit fixture doubles intentionally remain compatible and are not renderer-selectable constructors.
6. **Short writes complete before quit.** Actual worker/protocol VM emits all 123 frame bytes over 12 injected short writes, then quits; the parent accepts the complete response.

The VM initially used a PassThrough view of the worker's output buffer, unlike a kernel pipe's copy semantics; the worker's deliberate buffer clearing therefore invalidated the fake transport. The corrected driver copies bytes synchronously at that boundary. That intermediate harness error is not a product finding. Earlier successful three/five-case directories and unsuccessful driver attempts remain retained; the result cited above is the complete six-case receipt.

## Contract assessment

The main-owned provider serializes its complete encrypt → separate-process decrypt receipt per root. It binds schema, operation and random nonce, validates bounded canonical frames, waits for each successful child close, compares decrypted plaintext to the requested plaintext, and returns ciphertext only afterward. Child output alone cannot authorize publication. Failure refuses; unresolved termination marks the provider unavailable. The worker has no ordinary application imports or renderer bridge, installs its dedicated profile before readiness, validates owned paths, and holds a dedicated single-instance writer lock through process exit. A worker flag takes only the startup worker branch; malformed versions do not evaluate ordinary main.

LocalPinAccess fences asynchronous load, scrypt and protection and the atomic pre-rename phases with an epoch. Once rename is accepted, completion/readback is allowed to finish; the configured state is already recorded, and revoked operations still cannot unlock afterward. Main Lock explicitly cancels/drains PIN work, and close refuses active operations before entering its own fenced transition. This avoids relying on the unrelated workspace write set to track provider work.

Legacy v10/v11 records remain on their original safeStorage backend for durable wrong-PIN/cooldown and verifyCurrent writes. Only successful known-PIN unlock/change requests migration to the dedicated envelope. No retry reset or new approval is invented on decrypt alone. Unknown SIRENPIN versions and nonlegacy headers are refused in the production path.

The package main is the minimal dynamic dispatcher; the finite package source set contains both startup branches and all three helper modules. The package dependency test follows the actual entry and dynamic imports. These are source observations; this review did not produce a new packaged binary.

## Remaining qualification boundaries

Actual latest-source native two-process close/decrypt, first-session abrupt-parent crash/restart, pending-operation revocation, orphan worker/profile occupancy, copied-profile refusal, and both packaged dispatch branches still require their own exact-source/binary evidence. Owner-reported focused/global/native results remain separate evidence classes and are not silently imported into this result. Earlier native runs against pre-correction inputs cannot qualify the corrected snapshot automatically.

The owned-file checks reduce accidental/hostile path substitution but do not isolate the application from an adversarial process running as the same Windows user after those checks. The existence checks plus separate decrypt receipt do not prove uninterruptible filesystem writes, power-loss durability or survival of arbitrary external key deletion. No such guarantee is made. The blocked direct-DPAPI C# research result remains adverse and immutable; it neither supports nor refutes this separate Electron-worker implementation.

No further source correction is requested on this reviewed snapshot. Release/defect closure remains pending the exact-source native and packaging evidence above.
