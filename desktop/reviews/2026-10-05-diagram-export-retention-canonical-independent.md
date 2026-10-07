# Independent canonical retention review — prospective hosted qualification

Author: `/root/workspace_surface_review`, independent review subagent. Date: 2026-10-05; final local recapture at 19:46 UTC. Scope: read-only verification of the canonical synchronization of the Diagram export evidence-retention correction, and acceptance criteria for the next original hosted artifacts. This report does not qualify an actual new upload, a package release, or completion of Task4.

**Verdict: canonical correction independently confirmed; hosted artifact qualification pending.** No new actionable implementation finding was identified in this narrow delta. The historical retention gap remains an actual finding in run 37360932464; synchronizing a prospective fix does not supply that run's missing artifacts.

## Checks actually performed by this reviewer

I queried the connected GitHub API directly for the remote commit, recursive new/base trees, commit comparison, workflow/test blobs, PR2 metadata and commit-associated workflow runs. I read local Git objects and the synchronization manifest/receipt, calculated local committed blob SHA-1 and SHA-256 values, compared all local tracked paths against the remote tree, and inspected the workflow/test diff. I did not start Electron, execute a hosted workflow, download new workflow artifacts, mutate a Git ref, or alter source/tests/workflow/evidence. The focused 11/11 execution previously performed by this same reviewer is recorded in the separate immutable retention review; its workflow/test inputs are exactly the blobs verified here. It is not a newly executed test run in this report.

The actual remote Git commit `1575b58ba9ef0e54fd010a9601215419aeec1d41` points to tree `cf4ef4b88f4faf6ca2dcf6bfeb3a040f19130822` and has exactly one parent, `7bfc6da5920f1807ae12fb9cff04824a538304a2`. Both recursive tree responses were untruncated. The new tree contains 1,393 non-directory entries, all ordinary blobs; 1,382 retain their base path/mode/type/SHA, 11 differ, and no base file is deleted. The compare response independently reports ahead by one, behind by zero, exactly one commit and the same 11 changed paths. PR2 was open, draft and unmerged, with that head and main base `1e5472dde446657e2dbb155868e28e033c6c9c92`.

The 11 remote differences exactly match the manifest and committed local lot `404131150ee9a32c4bad7bb56a0866cbc6ccccdc` relative to `9e6853cd9ce63c3ef7ec75cc9566909962adcb55`. Every manifest entry's byte length and recomputed Git blob identity matches its local committed content and the actual remote tree entry. The changed paths comprise workflow/test, implementation-status/plan documentation, and seven new review/evidence documents. There is no product source, generated application bundle, packaging script or native probe change in this lot.

This is a canonical overlay, not identity of the complete local and remote repositories. Local HEAD has 735 tracked files. Of those, 732 match the remote path/mode/type/blob exactly. The three inherited root differences (`.gitattributes`, `.gitignore`, `README.md`) remain exactly the previous remote-base blobs; the remote also preserves 658 paths absent from the local checkout. None is introduced or changed by this correction.

## Exact executable inputs and correction

| Path | Remote/local committed Git blob | Bytes | SHA-256 of committed bytes |
| --- | --- | ---: | --- |
| `.github/workflows/desktop-verify.yml` | `a23f4cb750843ec8edee08c1c646e64595860307` | 33,482 | `66c372292128617f1f3f21110f8dd45d56677ef025ab508c54ff515655e1da04` |
| `desktop/tests/native-verification.test.mjs` | `a7439274723fa34d25ba207551183527612b39af` | 4,948 | `cce18ca06d49c33d4f5e78ab71f0fdb777253368c4834af9f0563b7b98292633` |

Fetched remote workflow and test text were exactly equal to their local committed UTF-8 content, including line endings. The workflow adds only nine lines: one `diagram-export/*/result.json`, `*.log` and `*.png` pattern in each of the named development, native matrix and packaged artifact upload blocks. Each named block is unique, uses `actions/upload-artifact`, retains `if: always()`, and contains exactly one of each new pattern. No native command, timeout, failure propagation, ordering or upload condition is removed or weakened.

The three added test lines validate those blocks individually and plant a misplaced result pattern that still has the misleading global count of three but must fail the block-specific oracle. This is the same final regression and workflow inspected/executed in `2026-10-05-window-close-keys-retention-independent.md`; this report adds independent remote provenance, not a different oracle.

Recaptured supporting file identities:

- `evidence/workspace-dock/export-retention-feature-sync-receipt.json`: SHA-256 `cd0122ed56b1cef7a4b21efe92d20683279b6b900b12ebac438ccc477d1a1217`.
- `evidence/workspace-dock/export-retention-sync-manifest.json`: SHA-256 `de15d035241dfed47002c10e1cb2fa3a1547f675b4564bef70523b28f1353e7f`.
- Historical hosted independent report: SHA-256 `8e9670f7131c3a2d48d71d381310f6fe1cd679da021432bd1e1b6c8e24a8d705`, unchanged.
- Local retention independent report: SHA-256 `6123b739ac44096d683d26b8e4c02cd53f67e2b4685c2bcc8af80775086bc455`, unchanged.
- Prior failed sources ZIP from run 37355828768: SHA-256 `bad1834dfd610f123b1a5f589212c13a5a62e189fb0dc54edad65be22cc86ae1`, unchanged.

## Criteria for the actual next hosted evidence

The directly observed workflow response associated run `37364770356`, run number 12, with this commit and reported `queued`, conclusion null. That is a scheduling observation, not executed checks or successful uploads. A later status or PR synthetic merge SHA must not be substituted for the actual checkout recorded in the execution logs.

Qualification requires the following direct evidence, preserving any adverse result:

1. Identify the actual run/head and synthetic checkout in original logs, then verify actual job/step conclusions and original run artifacts. Match artifact IDs, sizes and digests; compare every decompressed ZIP entry against its retained expansion. A success status alone does not close a retention gap.
2. Confirm the original Diagram export `result.json`, log and screenshots are actually retained for both jobs that execute it: the diagrams native group and copied-package job. Inspect the original result's COMPLETE status, all five original cases, captured-input integrity and matching log. The development upload block is also statically corrected, but a job that never executes Diagram export must not be required to manufacture its result.
3. Reconcile executed versus retained package results. If the unchanged commands all complete, expect 21 native executions containing 102 native cases plus the original portable flow: 22 retained result records, not the historical 21 records/97 native cases. Preserve result/log provenance and count the actual cases rather than accepting expected metadata.
4. Verify the native groups still contain exactly 20/17/15 original children, every child result and failure propagation, current canonical captured inputs, and unchanged before/after maps where the original result schema supplies them. An empty `changedInputs` field without an after-map remains a narrower receipt, not independently reconstructed after-input hashes.
5. Keep protocol classes separate: the unit log's identity tests and other tests, guarded-I/O check, native results, package identities, and hosted artifacts. A package identity receipt without the actual archive does not independently prove all 243 hosted ASAR file bytes; native success does not supply physical-keyboard or exhaustive privacy qualification.

The historical 37360932464 success statuses, its missing Diagram export retention and its separate report remain unchanged. The prior 37355828768 process-identity failure remains adverse. This workflow-only correction changes no process-identity policy; a successful subsequent run would not prove a permanent identity-provider fix. Original window-shells adverse evidence and earlier review scope limits also remain unaffected.
