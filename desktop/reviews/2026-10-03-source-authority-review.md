# Sources Task 2 independent source authority review

Date: 2026-10-03. Reviewer: `/root/source_authority_review`, independent child reviewer assigned by `/root`. This report is authored by that reviewer. Scope: source and Node unit behavior only, against Task 2 of `docs/superpowers/plans/2026-10-02-siren-large-sources.md` and its approved design spec. No Electron/native launches, package inspection, integration qualification, full-suite run, or capacity/latency claim was performed by this reviewer.

Status: **APPROVED for Task 2 source/unit boundary** at the final reviewed hashes below. One independently reproduced P2 retry defect was corrected by the implementation owner and independently verified by this reviewer. No unresolved blocking correctness finding was identified in this scope. This approval does not qualify editor integration, packaged behavior, or large-source latency.

## Reviewed files and SHA256

These final hashes were captured on 2026-10-03 after the selection access recheck, checkpoint test and orphan retry correction. The repository and repository-test hashes were rechecked following the final independent reproduction; conclusions use these exact versions. Preliminary inspection and the original fault reproduction used an earlier repository hash recorded below.

| File | SHA256 |
| --- | --- |
| `desktop/src/sources/repository.mjs` | `ee86bb299af591cd0a056874e160e27607822a3d95d0c475085fe27f8a3b8457` |
| `desktop/src/sources/metrics.mjs` | `4fad1128b218b0af1f40d6412112e9c7eebbe20f1785310ba66c8a5e9ca46ad6` |
| `desktop/src/sources/text-model.mjs` | `359274f92067872fa11435e3e7aede8161ee2b7510b4930664173f85f10aa585` |
| `desktop/tests/source-repository.test.mjs` | `c5b3a2b9c0cf5b7412ae6acb51f317f1d9d4407e293adb005561d31e69f34cbc` |
| `desktop/tests/source-metrics.test.mjs` | `b9f12eb87d02d8be413241a68c0e3e0acf3c50820b7c1fbe5d7a0379be7c2a20` |
| `desktop/tests/text-model.test.mjs` | `f1352fe9d1f89e5c7d3f2ecb5e86bed8bf1afe6d42c71551f215cb436620a28a` |

Also inspected the reused `projects/{paths,atomic,io}.mjs` primitives to understand ownership, writer locking, write/readback and fault ordering. Those primitives were not edited by this reviewer.

## Resolved finding: P2 — failed commit identity becomes permanently unusable after another same-version commit

Original review verdict: **CHANGES REQUIRED** at repository SHA256 `539b8f5f7b482a25fa607001216d5b37c602db055b6062986d19465fb71c8676`, despite the then-green 31-test suite. This adverse finding and its actual failed retry outcome are retained below; the final approval follows the separate resolution and verification.

Original location: `desktop/src/sources/repository.mjs:265` and `:267`, in `commitSource`, at repository SHA256 `539b8f5f7b482a25fa607001216d5b37c602db055b6062986d19465fb71c8676`. The immutable record name was `commits/<operationId>.json`, while its content incorporated the current mutable `commitHead` as `parent` (and checkpoint configuration as `durability`). A fault after `source-commit-verified` left a durable unselected record. Another operation could successfully commit the same source version; the original identical request then built a record with a different parent and received `IMMUTABLE_CONFLICT` from `immutable`. The failed request could not be retried using its identity even though source version/content had not changed. Changing checkpoint configuration on a fresh owner could also change the proposed orphan record bytes.

Independent reproduction used an isolated synthetic `ProjectStore` root, imported literal `base`, then:

1. Commit version 1 using `operationId: 'orphan-op'`, inject one exception at `source-commit-verified`: actual `{ok:false, code:'SOURCE_WRITE_FAILED'}`.
2. Commit version 1 using `operationId: 'other-op'`: actual `{ok:true, version:1, durability:'committed'}`.
3. Retry the exact first request through a fresh `SourceRepository`: actual `{ok:false, code:'IMMUTABLE_CONFLICT'}`.

Expected: a failed unselected operation can be safely retried without permanently poisoning its ID, while retaining the intervening selected commit's identity and its own duplicate semantics. No selected source bytes were lost in this reproduction. The SHA256 of literal `base` remained `cae662172fd450bb0cd710a769079c05bfc5d8e35efa6576edc7d0377afdd4a2`. Node exit 0; the script recorded actual receipts rather than asserting a passing result. The exact finding was sent to `/root` immediately; no product changes were made by this reviewer.

Resolution by `/root`: immutable commit records now use `c-<UUID>.json`, and selected descriptors bind operation ID, filename and SHA256. A retry can create a new immutable record with the current parent while leaving the failed orphan intact; selected-chain lookup still returns original duplicate receipts. The implementation owner added a regression test. This reviewer reran the original scenario with assertions and additionally changed checkpoint configuration from enabled on the failed owner to absent on the resumed owner. Retry succeeded, both the resumed and intervening commit returned their original receipts after fresh reopen, and version 1 exported exact literal `base`. Actual Node exit 0: `fixed retry passed: parent advance + checkpoint option change + both duplicate receipts + exact export`. The fix is verified at the final hashes above.

## Independent validation evidence

Command from `portable/desktop`: `node --test tests/source-metrics.test.mjs tests/text-model.test.mjs tests/source-repository.test.mjs`. Actual process exit 0, 31 tests passed, 0 failed/skipped/cancelled, duration 5107.4232 ms. This reviewer observed the live output, including actual 32 MiB acceptance/+1 refusal and the default 256 MiB disk cap refusing the eighth distinct 32 MiB import. The latter reflects retained metadata and temporary write overhead; it does not assert eight such files can fit.

After the retry correction, the same command was independently rerun: actual process exit 0, **32 tests passed**, 0 failed/skipped/cancelled, duration **5191.6562 ms**, including the new orphan retry regression. This is the final focused result for the final source versions, and remains a source/unit result.

An additional independent string oracle exercised 4,500 edits across 30 fresh models, beginning with a 4 KiB line, CRLF, emoji, a 1 KiB line and LF, then randomized UTF-16-safe deletion/replacement ranges and insertions including CR, LF, CRLF, emoji, accented text and 333-character spans. After every edit it compared exact text and UTF-8 bytes, UTF-16 units, split-derived line count and longest width. Actual Node exit 0: `4500 independent mixed-width newline/Unicode edits passed`.

Code/test inspection supports exact BOM-inclusive UTF-16 offsets and byte-preserving UTF-8 export, refusal of split/unpaired surrogates, and exact raw export for unsupported UTF-8. Successful draft receipts follow selected journal readback; explicit commit materializes a blob, and selected checkpoint failures return `recovery-degraded`. Commit descriptors are hash-bound and checkpoint tokens preserve conservative degraded status across restart. Edit and commit identities are checked against the selected per-source chains. Invalid IDs, unknown projects, junction ownership, read/write access gates and concurrent-owner refusal are covered. Selection faults verify the actual pointer to avoid falsely claiming the old version after successful selection. The root's latest access recheck also runs after asynchronous fault work immediately before rename.

## Limits and remaining qualification work

Repository `load` replays from the import through the entire retained selected journal; reads and edits rebuild a model and materialize/hash full source bytes. Commit materialized blobs do not currently form replay checkpoints. Each edit retains metadata and inserted text, and `occupied` rescans retained files before writes. Unselected journals/blobs/pending files remain charged to the disk budget, without collection to force a transaction to fit. The TextModel bounds retained undo spans in bytes, but its idempotency fingerprint/result map grows with unique operation IDs, and piece traversal is linear in piece count. These are concrete amplification/caching limits for later integration and measurement; the unit results do not establish sustained large-file editing performance or responsive native input.

Task 3 manifest/migration/GC, Task 4 registered caller/epoch IPC and editor integration, workers, Docs links and final package/native qualification remain outside this review. The reported retry defect is resolved and independently verified; the remaining scaling limits require later measurement and integration work under the approved plan.
