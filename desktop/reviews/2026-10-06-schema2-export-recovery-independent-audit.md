# Independent bounded audit — schema-2 export/recovery

Author: `/root/media_batch_review`. Read-only product audit with my own small Node reproduction; no product/test/generated edits, native GUI, hosted execution or release/CI approval. Local HEAD at final inspection was `518a3306404c031f3b6c48a92e567efbd7a95712`; the executed product identities are recorded below. The concurrent diagnostic CI and earlier UI failures are unrelated to this audit.

**Two existing defects reproduced:** pending legacy export can publish after access becomes locked, and a refused export can leave a complete private temporary backup outside managed recovery. No source-byte/provenance corruption was found in the exercised small backup/checkpoint round trip. Large-memory behavior remains unmeasured.

## Reproduction and provenance

- Script: `desktop/evidence/export-recovery-audit-2026-10-06/probe.mjs`, SHA-256 `3868abe3b5a5437b0998b11a492cbafb33f42343cc3885e7e09225549f67c83f`.
- Result: same directory `result.json`, SHA-256 `fb2032bc74d020a63f77f4f323f8868d6c2dcf22a5eb4a005b0cda7119d67b7f`.
- Actual command: `node evidence/export-recovery-audit-2026-10-06/probe.mjs`, from `desktop/`; final execution exited 0 with `status:REPRODUCED`.
- The fixture uses actual `ProjectStore`, `SourceRepository`, manifest commit, `RecoveryStore`, `RecoveryAccess`, `invokeDesktop`, and filesystem `atomicWrite`. It stores a 42-byte Python source with BOM, Romanian text, emoji, mixed line endings and nested provenance. The saved schema-2 bundle is 1,737 bytes. No large allocation or stress fixture was created.
- To avoid launching Electron, the script extracts the **exact** current `exportBytes`, `exportProject` and `exportRecovery` bodies from `main.mjs` and evaluates them in an isolated VM. Controlled adapters supply the native-dialog result and unlocked state. The reproduction proves the service/IPC/writer behavior under that transition, not that a real OS dialog and production PIN lifecycle were driven. An initial harness-only extraction error caused by a CRLF boundary was corrected before the successful reproduction; it was not a product failure.

## [P1] Existing export publishes and reports success after Lock invalidates access

Source: `desktop/src/main.mjs:182–187,315–327`; `desktop/src/ipc.mjs:30–38`.

`invokeDesktop` checks unlocked access at invocation. Both project/recovery exporters read the backup bytes before calling `exportBytes`. The helper awaits `showSaveDialog` and then calls `atomicWrite` without rechecking access, selected generation or a revocable operation lease; these exports are also not joined through the native `writes` set.

My script starts each actual service through `invokeDesktop` with unlocked access, waits for the chooser adapter to enter, sets that access adapter to locked, then returns a destination. **Both `exportProject` and `exportRecovery` return `{ok:true}` and create the entire exact verified schema-2 bundle while access is false.** A new request after the same transition correctly returns `PIN_REQUIRED`, isolating the defect to an already-pending export rather than bypassing the IPC entry check.

Final emitted backup SHA-256: `cb5044ce349e43556c858aa82820204005c60452c1fce0e7f43e8cf034f0a658`. Original source bytes remain unchanged. The defect is unauthorized post-transition publication and misleading success, not source corruption. Selection/account transitions have the same absent guard in source, but I did not execute those distinct lifecycle cases and do not label them separately reproduced. `exportDiagnostics` shares the helper but was not independently executed here.

Relevant correction constraints for the parent: invalidation must be monotonic, so Lock then unlock or select-away then return cannot revive an old chooser. A chooser must not block Lock indefinitely. Actual writes admitted before invalidation need explicit join/finish policy; only checking the final return value cannot undo already-published bytes. This audit supplies no implementation or native Lock approval.

## [P2] Refused export retains a complete untracked temporary backup

Source: `desktop/src/main.mjs:185`; `desktop/src/projects/atomic.mjs:8–38`.

The shared writer defaults `cleanupPending:false`, intentionally preserving staging for project/recovery transactions. The external export helper uses that same default, although these temporary files have no recovery receipt or managed cleanup route.

In my actual filesystem reproduction, the selected output filename is created as a directory while the chooser is pending. The unchanged actual writer creates its exclusive `pending-UUID.tmp`, writes and syncs the full bundle, then correctly refuses the destination because it is not an ordinary file. `invokeDesktop` returns `OPERATION_FAILED`; **one temporary file remains in the selected parent directory containing all 1,737 backup bytes exactly**. The result records its exact parent and filename. No original project or selected directory is overwritten.

This is a destination-change/failure case, not evidence of an attacker or native chooser malfunction. Its demonstrated consequence is abandoned full private backup copies and disk accumulation outside SIREN's managed recovery, despite a failed export. Only `exportProject` was executed for this collision; other helper callers share the source path. A correction should remain export-specific rather than globally removing project/recovery staging. Cleanup ownership/failure reporting needs its own real checks; this audit did not simulate cleanup deletion failures.

## Verified boundaries and limits

The successful small backup preserves the exact source bytes (`f59c89b9436b139abd5846caed62804dc3ae3ff969d5e8d74e02f42036794f56`), nested provenance and full original snapshot. Exporting its real saved checkpoint produces the same bundle. Restoring that checkpoint to a new owned project preserves the source bytes and provenance. These positive checks are limited to this fixture and do not establish stress scalability or all recovery histories.

The actual emitted `siren-source-bundle` is rejected by current `parseLegacyImport` with `Not a SIREN workspace export`. Searches of product/build paths found only the bundle exporter, not a bundle-file importer; both visible project import routes ultimately use the legacy parser/frozen validator. **This is a confirmed current delivery boundary**, not evidence that exported bytes were lost or the local checkpoint restore failed. I am not inventing a new import feature or assigning an additional defect severity without the delivery contract being included in scope.

`exportSourceSnapshot` verifies and retains all source buffers, converts them all to base64 strings, stringifies the complete bundle and allocates a final buffer. It does not enforce an aggregate serialized export cap. Source and project storage budgets exist, while native import is capped at 64 MiB. This suggests peak-memory and export/import-budget concerns for large/many-version manifests. I deliberately did not allocate a large fixture or prove OOM/overflow; **resource exhaustion remains a hypothesis, not a reported reproduced defect**.

## Executed product SHA-256 identities

```text
src/main.mjs e31139ed6aee100471705cad0cc48681809d4d7655dd5b6c8917ab37a39a967d
src/ipc.mjs 1f33543d72438a8ce3c2198db1d5999bb90d54111de6cb37e4626dea1946f34a
src/sources/recovery.mjs 4fddd4915be81e2290476fe5b113410c14af741f77206cf80b48a3ee23a6761a
src/projects/migration.mjs 5a13e71306f7fcb9a6945fc2b55ded31d2a37402bc880b7768e5c8eca08d3a01
src/projects/atomic.mjs 51acbcfcb3bb9699bfda1a9d53a04e31c21986784898ef32a33ec2af6b42a469
```

No passing local UI result is used here to explain an original hosted failure. Evidence and reports remain separate from production qualification.
