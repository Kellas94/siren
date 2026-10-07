# Verified partial commits and project-selection save boundaries

Prepared 2026-10-03 by `/root/recovery_diagnostics`. This follows the immutable adverse review [2026-10-03-recovery-save-diagnostics.md](2026-10-03-recovery-save-diagnostics.md), SHA256 `98716a261e5c9f5ba680177a3bd841f7ba9201d9da1800d425198751f34ae750`. The earlier evidence and observations were not rewritten. CI26 remains an original failed packaged run with an **UNKNOWN historical native refusal**; these fixes address the two independently demonstrated local correctness defects. No native/package launch, CI retry, commit, push, or full-suite run was performed during this fix phase.

## Result and changed contracts

1. A workspace commit whose recovery checkpoint is refused still returns `ok:false`, `code:'RECOVERY_DEGRADED'`, and `checkpointAcknowledged:false`. Main adds `workspaceCommitted:true`, `committedRevision`, and `committedSha256` only after actual `ProjectStore.readProject` verified the complete attempted JSON, result hash, result revision, and exact `baseRevision + 1`. Failed verification returns `SAVE_UNVERIFIED` with no commit claim. A draft recovery request does not claim a workspace commitment. `recoveryCode` distinguishes typed recovery writer refusal (`WRITER_BUSY`) from an untyped `CHECKPOINT_FAILED`. Checkpoint acknowledgement false does not falsely claim the checkpoint file is absent: the injected post-verification fault can leave verified checkpoint bytes on disk.
2. The renderer adapter advances its internal CAS snapshot after a degraded workspace receipt only when those validated fields describe the immediately next revision and an independent WebCrypto SHA256 of the exact captured attempted UTF-8 bag matches `committedSha256`. It keeps the receipt failed and invokes the error callback. Wrong hash, wrong revision, generic refusal, draft purpose, or unavailable hash capability retains the prior revision. No arbitrary native fields, source bytes, or PINs are copied into diagnostics.
3. Native bootstrap publication captures the selected project ID and numeric selection generation before awaiting a save. A verified workspace commit updates bootstrap only if both still match. `selected` and damaged-project selection increment the generation after durable selection publication. This protects changing to another project and reopening the same project in a later generation.
4. Recovery restore and project open/import use the existing renderer account-transition boundary: production renderer flush and adapter lock, native refusal of late save starts, drain of tracked writes, then selection action. The transition is not itself added to the writes set, so it does not await itself. Renderer flush writes remain allowed until renderer quiescence completes. Successful selection keeps the old renderer frozen until its existing UI reload; cancellation or failure resumes it. Native access/selection transitions are refused while this boundary is active. Damaged-project selection is detected by generation change even though its reply is `ok:false`/`RECOVERY_REQUIRED`.

The first degraded production flush still throws **Save not acknowledged: failed** and remains visible in the UI. When the recovery fault is removed, a later normal save now uses base revision 2 and succeeds at revision 3. This is not converting the degraded attempt to success. Its original pending record stays recoverable, and successful retry acknowledges only its own pending record.

## Tests, failures first

The diagnostic test was converted from adverse characterization assertions to desired invariants; its historical adverse observations remain in the prior immutable review. Tests execute actual extracted main service/selection code, actual project/recovery stores and durable files, the generated production save/flush code, and the actual adapter. They remain synthetic seam tests rather than full native UI verification.

RED before source fixes: the two owned test files produced **11 tests, 6 passes, 5 failures**, exit 1. Failures were the missing verified commit metadata, missing checkpoint acknowledgement distinction, selecting before transition/drain, old completion replacing a later same-ID selection generation, and missing adapter exact-commit reconciliation. The earlier four-invariant subset had **1 pass, 3 failures** at the same boundaries.

After source edits, the owned tests passed. Broadening to existing native transition fixtures exposed their omitted `selectedId` binding: first 3 native safety cases, then the successful native PIN-lock case failed with `ReferenceError: selectedId is not defined`. The parent authorized adding only honest `selectedId: original.project.id` fixture bindings in `native-transitions.test.mjs` and `local-pin-integration-review.test.mjs`; the production publication guard was preserved.

Final targeted command:

```text
node --test desktop/tests/renderer-storage.test.mjs desktop/tests/recovery-save-diagnostics.test.mjs desktop/tests/native-transitions.test.mjs desktop/tests/project-selection.test.mjs desktop/tests/pin-ipc.test.mjs desktop/tests/local-pin-integration-review.test.mjs
```

Result: **25 tests, 25 passes, 0 failures, exit 0, 3680.6984 ms**, Node `v24.16.0`. Coverage includes healthy recovered initialization; explicit degraded commit then exact-CAS retry; actual Recovery-root writer contention; drain before recovery selection; refusal of late native saves; same-ID generation publication guard; transition failure/resume/retry; invalid reconciliation controls; native readonly/PIN enforcement; PIN lock with private saves; account transition saves; and durable project-selection checks.

`node --check desktop/src/main.mjs` and `node --check desktop/tests/recovery-save-diagnostics.test.mjs` exited 0. `git diff --check` reported no whitespace errors (Git emitted its existing CRLF normalization notice). The parent owns the final coordinated full suite after all agents' files are stable; this agent did not start another full suite.

## Scope and remaining qualification

Changes were confined to `src/main.mjs`, `src/ui/storage.js`, the two owned recovery/adapter test files, the new review, and the two explicitly authorized fixture ID bindings. No `ProjectStore`, `RecoveryStore`, build/renderer, packaged probe, packager, original evidence, or earlier review edits were made in this fix phase.

This does not establish CI26's historical native refusal or qualify a packaged build. The generated saveState/close collector still needs parent-owned typed failure capture for a future genuinely instrumented native run. The parent also owns schema-2 renderer read-only admission; it is not covered by the hashes or tests below. Final integration must verify those later shared-source edits separately.

## Identity at delivery of these fixes

The parent was told main/storage were stable before subsequent parent-owned edits. SHA256 binds this delivered local fix, not the hosted CI26 binary:

| File | SHA256 |
| --- | --- |
| `src/main.mjs` | `5d46420b6e9cf54d85bc69e7064f704bfd2eaeae54d6a6f446e329fd093d0a72` |
| `src/ui/storage.js` | `66f765e6109768507a92c88ca2f89b8ba175fa6558d3c9928d29d0720af3a0ca` |
| `tests/recovery-save-diagnostics.test.mjs` | `314790535fcb48401ea295a2f32bd7e94f79ed7d356d36ace60eabe285caa3e3` |
| `tests/renderer-storage.test.mjs` | `2d3053626cf7af9c5c4ae623a85311393d0a41aaf831301e734163adde3cb753` |
| `tests/local-pin-integration-review.test.mjs` | `8fac6c9b642b7915d13a3ea0f64029f3a635fe05918bee1c9e1d8f0e41b5c029` |
| `tests/native-transitions.test.mjs` | `cb18217a4ea7e4769b01cdc4c7f499328d5b20e15793d7342f6fab5d51657ab3` |
