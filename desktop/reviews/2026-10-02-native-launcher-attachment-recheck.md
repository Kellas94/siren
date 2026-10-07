# Independent attachment repair recheck — 2026-10-02

Author: independent reviewer agent `/root/review_native_launcher`. Original report `2026-10-02-native-launcher-review.md` is preserved unchanged.

**Disposition: original attachment findings 2 and 3 are resolved for the reviewed JS snapshot and handled-failure development scope. No release PASS and no native launcher qualification.** Original finding 1 concerning hostile insertion of new directory children remains outside this JS recheck. Native Rust changes and CI are pending and were not evaluated here.

## Snapshot

| File | SHA-256 |
| --- | --- |
| `desktop/launcher/attach-development.mjs` | `453f38079e91ffeeb00c69d4784a5e68f20eda1b706c130ab637cf65af0aa314` |
| `desktop/launcher/attach-development.test.mjs` | `47e5b2b30077cf6cf044fae310eaccac9a126e86f6878f130c4b2006205009b3` |
| `desktop/src/projects/atomic.mjs` | `261010e6177ecb43a29779ddbb519c7c75277c4372142f3471d921880b79628f` |
| `desktop/src/projects/io.mjs` | `a87fc4a0243eef18e3a14fb651b55cc8c1cfa49a137b21eb7239a262ce858687` |
| `desktop/src/projects/paths.mjs` | `0f3fe81566b050f0a30f808960325cc2ca7d5027239cf65ed5ffb6a751724554` |

## Independent results

Executed `node --test desktop/launcher/attach-development.test.mjs`: **7 passed, 0 failed**. This includes the original four behavior tests and three filesystem regression cases: read-only artifact success, oversized metadata refusal, and read-only identity failure followed by a successful writable retry.

Executed my preserved probe, without modifying it: `node desktop/reviews/native-launcher-attachment-adverse.mjs`. The first attachment now succeeds; `selectionPresent=true`, `selectionBytes=376`, `launcherPresent=true`, `identityHasReceipt=true`, `dataUnchanged=true`. The second invocation refuses an already completed attachment as intended. There is no initial EPERM failure.

Executed my preserved probe, without modifying it: `node desktop/reviews/native-launcher-attachment-adverse.mjs --large-metadata`. Both invocations now reject with `Selection metadata exceeds consumer size limit`. `selectionPresent=false`, `launcherPresent=false`, `identityHasReceipt=false`, `dataUnchanged=true`. The previously accepted 1,251,976-byte selector is not published.

These are actual local Windows filesystem observations. Neither probe launches an executable; its small MZ fixture is only test bytes. No Rust installation, policy adjustment, or product source mutation was performed by this reviewer.

## Transaction and bound assessment

The attachment now reads the artifact into a bounded 2 MiB buffer and hashes those exact bytes before staging. It creates a fresh `wx` file, writes and syncs it, and checks the staged file's exact hash/size. This avoids inherited Windows READONLY attributes and removes the old source-reopen/copy timing gap for artifact bytes. Receipt origin still depends on the separately authenticated private CI retrieval; local receipt fields do not authenticate themselves.

Exact serialized selector bytes and the augmented identity bytes are checked against the 1 MiB consumer bound before attachment state is written. File-count, path and extracted-byte limits remain in place. The producer/consumer mismatch demonstrated in the original report is fixed.

An exclusive writer on the preview root serializes cooperating attempts; absence and unchanged identity checks are repeated inside it. The root launcher is published last through exclusive hard-link creation, after selection and augmented identity writes complete. An existing root destination is not overwritten. The staging link is removed afterward, leaving the completed root launcher as a normal single-link file on the observed Windows filesystem.

For a handled error before root publication, cleanup removes the selector only when its bytes match this attempted selector and restores the identity only when it matches the augmented identity from this attempt. Changed identity bytes are preserved and explicitly reported as requiring inspection. The exercised read-only identity failure retained the original identity, removed the selector and allowed a subsequent successful retry. The code has no Data/project write or delete path, and the preserved probes observed unchanged original Data bytes.

## Limits that remain explicit

- This is exception cleanup, not a durable crash-recovery journal. Process termination or power loss between pointer/identity writes and root publication can leave `writer.lock`, selection, metadata or staging files requiring inspection; automatic recovery from those states was not implemented or validated here. Full Task 6 apply/recovery remains open.
- The existing `atomicWrite()` helper can leave its own unique temporary file when a later rename fails; the repaired attachment's cleanup targets its selector, identity and named launcher stage. I did not interpret harmless diagnostic temporary files outside the selected version as completion of durable recovery.
- Root publication uses hard links. The observed filesystem supports them; attachment on FAT/exFAT or another filesystem without that capability was not tested. This method should not be generalized into a supported-filesystem claim.
- Matching-byte cleanup and path helpers do not establish an authenticated ownership boundary against a hostile concurrent writer. The development receipt is unsigned and preview membership is not an immutable authenticated tree. The original native directory-insertion finding remains unqualified for production.
- No artifact-origin verification, publisher signature, native launch, release/static-CRT binary test, activation test, updater apply/rollback or release admission is implied by these seven passing Node tests.

No new must-fix issue was found within the narrow handled-failure attachment repair scope. Rebind this recheck if any listed source hash changes.
