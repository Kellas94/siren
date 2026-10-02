# CI17 close and recovery investigation

Scope: independent investigation of actual CI17 failures, not a release approval. Product behavior was unchanged during the native probes. The final change adds rejection status and failure diagnostics only; it does not retry saves, dismiss recovery, or relax acknowledgement or occlusion checks.

## Preserved adverse evidence

Actions run `37025643123`, job `110899451055`, artifact head `0d74fc7c9cbf2fdaf23771c02d995727e24aad53` failed the development-first-run close guard (`Save not acknowledged`) and the second-start Code library click (covered by `confirmDialog`). Downloaded artifact is preserved under `desktop/evidence/reviewer-ci17-2026-10-02/ci17.zip`, SHA256 `1dad292cfaa0f771339023bb66435b340220c650ee2f5cd67fe04241f86c1761`, matching Actions' digest. The extracted development failure screenshot displays “Saving locally…” and the expected edited Mermaid source. This does not identify the save receipt status. The recovery artifact lacks second-start confirmation text and a native snapshot, so the dialog's reason cannot be reconstructed from that artifact.

## Actual native observations

Unmodified local tests both passed on generated renderer `f831ec5ce7197e17b660ea068f84c468459a3a2dce46615c6ba5f07b1e56a9e4`: development-first-run evidence `dev-first-run-2026-10-02T15-24-01.046Z`; recovery evidence `code-recovery-2026-10-02T15-25-55.191Z`.

After concurrent UI work regenerated the renderer, a copied first-run probe used the real native store, pointer/keyboard driver, and a conditional CDP breakpoint at the close guard to record the actual returned receipt without pausing execution. At CPU throttling rate 8, it passed with `status: confirmed`, `attempt: 3`, current serial `3`. Evidence: `reviewer-dev-first-run-2026-10-02T15-36-46.432Z/result.json`. The instrumented generated HTML hash was `c810868f51480e9c7a7ff4a5f7abdfe23564321bd4d58bea3fd99567c44bb71d`; this is not the CI17 artifact renderer.

Copied recovery probes captured native snapshots before restart and the actual second-start confirmation text/bootstrap. The original timing passed (`reviewer-code-recovery-2026-10-02T15-37-31.313Z`), and an otherwise identical probe with a documented 2500ms idle interval before Quit passed (`reviewer-code-recovery-idle-2026-10-02T15-38-41.516Z`). Both had `confirmDialog.open === false`; no dialog was dismissed or bypassed. The idle variant persisted the genuine Mermaid draft key, while the original timing did not. Both snapshots had native revision 3 and the persisted clean-exit key `no`, despite an acknowledged native clean-close journal event. Private Python remained in its dedicated draft record and outside Docs.

This confirms a lifecycle limit: main's clean-close acknowledgement precedes window destruction and its unload writes. The test calls driver.close immediately after seeing clean-close; driver.close kills an owned process if it has not exited yet. The observed persisted flag is compatible with this sequence, but neither local probe produced the CI dialog or data damage. A retained old draft alone is insufficient to explain the failure, because the idle variant's draft did not trigger recovery. CI17's actual mismatching fields remain unknown.

## Save supersession mechanism and limits

`save-supersession-vm.mjs` evaluates the exact generated saveState and close-guard bodies with a synthetic store that delays the first receipt. A second save confirms before the first resolves. Both written states are identical, yet close rejects with the generic error because the first attempt is superseded. Evidence: `save-supersession-vm.json`, same generated source hash `c810868f…`. This proves a reachable mechanism in the current functions; it is not an actual Electron reproduction and does not establish CI17's cause. The native probe recorded confirmed, not superseded. A retry or concurrency behavior change is therefore not justified by these observations.

## Diagnostics added for the next real failure

The close guard now reports `Save not acknowledged: <status>` while retaining exactly the same accepted statuses. Development-first-run failures preserve the save chip, pending confirmation text, and native snapshot; recovery failures preserve actual confirmation text/bootstrap, native snapshot, and a screenshot. Assertions and the driver's negative occlusion oracle are unchanged. Syntax checks and an independent renderer build succeeded; all 9 focused shell and renderer-storage tests passed. The independent diagnostic build hash is `a8cec03adfd82cbb14637f472cc7c28f7cfd397100bcfff794074bc8c93b196f`.

Source SHA256 after diagnostics: builder `c35ca01ed546d19c57ca68687cbedeffbc33ac225c0176beeda300e55b551179`; main `8107996f9c793e261eebe4359db4b2fb05dfd851894da7cacf74b84a09b1a2c2`; first-run test `fbb99218c331e2a33c07a2e07b0a42f9ed9c3f33b65eb84ce042eb3abbca28c2`; recovery test `b0a0fb027645a0396d0003ff8045839aa69a00675c653d6050f7f7594005fe7b`. Frozen baseline remains `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4`.

CI17 remains a genuine failure. Local passes do not close it; the next authenticated failure needs receipt status and the actual recovery comparison data before a behavioral repair can be selected.
