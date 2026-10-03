# Sources Task 3 and causal recovery fixes: independent review

Date: 2026-10-03. Reviewer: `/root/source_authority_review`, independent child reviewer assigned by `/root`. This report is authored by the reviewer. Scope: approved Sources Task 3 source authority, manifest/migration/recovery modules, their project/recovery/main/renderer seams, save-status causal fixes and package source allowlist. No product source, other reviewers' reports, frozen evidence or baseline were edited by this reviewer. No full-suite, Electron/native launch, package build, commit, push or historical CI retry was performed.

Final status: **APPROVED for the Task 3 source/unit boundary and the local causal save fixes**, at the exact final hashes below. No unresolved blocking correctness finding was identified in this scope. Approval followed the implementation owner's freeze, live focused test execution and separate reviewer-authored assertions. It does not admit a package or qualify native large-source editing.

## Reviewed contracts

The review uses Task 3 of `docs/superpowers/plans/2026-10-02-siren-large-sources.md` and its approved design spec. Required outcomes include exact source references and provenance; explicit new-project migration with untouched originals; immutable source byte verification before manifest selection; truthful post-selection and checkpoint-degraded receipts; safe closed-world retention scans before collection; schema-aware export/restore; and refusal of legacy renderer writes to schema 2.

The causal save boundary is reviewed against the retained local synthetic evidence in `2026-10-03-recovery-save-diagnostics.md` and subsequent `2026-10-03-recovery-save-fix.md`. Historical CI26's original failure and UNKNOWN native cause remain adverse evidence. The local tests cannot identify CI26's historical refusal, establish historic data loss, or qualify a packaged build.

## Initial inspection issues raised to the implementation owner

1. A deeper ENOENT while loading a selected unlinked/private source was initially treated as evidence of an unselected import; collection could remove its remaining original directory. The owner added direct pointer-existence checks at `sources/recovery.mjs:85`, treats selected-source load failures as incomplete coverage, and conservatively admits only verified pre-journal import debris for deletion. The owner reports RED regression evidence. The final regression and separate reviewer assertions pass: missing a selected private blob returns `SOURCE_SCAN_INCOMPLETE` and preserves its exact pointer bytes.
2. Recovery scanning filtered unknown checkpoint filenames, so temporary/unrecognized recovery artifacts did not make collection coverage incomplete. The owner now rejects unscanned names in the granted checkpoint directory at `sources/recovery.mjs:74`. The owner reports RED regression evidence. The final regression and separate reviewer assertions pass: an unknown checkpoint temporary returns `SOURCE_SCAN_INCOMPLETE` and preserves the artifact and every source directory.
3. A preselection failure followed by an exact manifest retry can retain two identical parent records; requiring exactly one file then loses acknowledged-operation ancestry. The owner collapses canonical-identical records. The reviewer then raised the distinct checkpoint-policy case: orphan and retried records can share request identity while differing in `checkpointRequired`. Canonical collapsing alone was insufficient. The owner added required paired parent identities and `parentManifestHash`, a canonical full parent body hash, at `sources/manifest.mjs:132` and `:180`. The final regressions and separate reviewer assertions pass: a recovery-enabled failed orphan, an acknowledged retry without recovery, and a newer recovery-enabled manifest retain the exact acknowledged original receipt through fresh owners.
4. Manifest permission was rechecked before entering project atomic IO, but not after its awaited `before-select` hook. The owner added `ProjectStore.commit`'s `canSelect` hook at `projects/store.mjs:71` and the manifest closure rechecking both authorities at `sources/manifest.mjs:163`. The final regression and separate reviewer assertions pass for revocation of project authority and source authority, respectively, at selection: `ACCESS_REFUSED` and exact prior project selection remain.

The reviewer raised these candidates by source inspection and did not run tests on the unstable implementation. Owner-reported RED evidence is distinguished from reviewer-observed final verification. The earlier adverse diagnostic review and owner's failure logs remain untouched; this report adds the independent resolution rather than rewriting historical failures.

## Assessment of the causal save fix

Main retains a failed checkpoint receipt while claiming workspace commitment only after exact project/readback, revision and hash verification. The renderer advances CAS only for a typed degraded workspace receipt, the immediate next revision, and independent WebCrypto SHA256 of the captured UTF-8 attempt. Ordinary conflicts, access failures, wrong hashes/revisions, draft purpose and unavailable hashing retain the prior CAS state. Failed receipts remain failed.

Selection changes drain tracked native saves after renderer flush/quiescence, refuse late save starts, and resume a cancelled or failed transition. Bootstrap publication additionally binds both project ID and selection generation, preventing an old completion from republishing into a later selection, including the same project ID. Existing readonly/PIN checks are still required by these paths.

## Independent execution evidence

After the owner declared the source boundary frozen, the reviewer ran from `portable/desktop`:

```text
node --test tests/source-manifest.test.mjs tests/source-migration.test.mjs tests/source-recovery.test.mjs tests/recovery-save-diagnostics.test.mjs tests/renderer-storage.test.mjs tests/package.test.mjs
```

Actual live result: **45 tests passed, 0 failed/skipped/cancelled, process exit 0, 3696.8979 ms**. Breakdown: manifest 14, migration 7, source recovery 8, causal diagnostics 6, renderer storage 6, package 4. Coverage includes exact old source versions, forged metrics/provenance refusal, unsupported raw byte export, orphan/non-orphan duplicate distinctions, post-selection verification, conservative checkpoint degradation across duplicate calls, concurrent writer refusal, current-vs-backup source binding, special JSON keys, untouched migration originals, schema-2 legacy write refusal/read-only view, byte-verified recovery bundles, independent new-project restore/remapping, and conservative collection.

The reviewer also wrote and executed an ephemeral Node assertion script against actual project/source/recovery stores in an isolated synthetic root. It checked checkpoint-policy variant orphan ancestry across fresh owners, source-authority revocation specifically in the awaited atomic `before-select` hook, missing selected-private-source byte retention, and unknown recovery temporary retention. Actual exit 0: `independent Task3 assertions passed: checkpoint-policy orphan ancestry across fresh owners; source access revoked at atomic selection; damaged selected private source retained; unknown recovery temporary retains all source dirs`. The root was removed in `finally`; no shared product/test files were written by this script.

The additional unit command `node --test tests/native-transitions.test.mjs tests/local-pin-integration-review.test.mjs tests/pin-ipc.test.mjs tests/project-selection.test.mjs` produced **13 passes, 0 failures/skips/cancellations, process exit 0, 626.9157 ms**. These are source/VM/service unit checks despite the filenames; no Electron app was launched. They verify PIN/access and native readonly refusal, drain of private persistence before lock, failed persistence/transition resume, account selection boundaries, and damaged owned-project selection. This reviewer did not run the full suite.

The causal diagnostics execute extracted actual main code, actual stores and generated production renderer save/flush code through synthetic VM seams. The degraded first production close stays failed, its exact verified commit advances only the next CAS base, an actual recovery writer refusal remains explicit, and old completions cannot republish into a later same-ID selection generation. Healthy recovered initialization, failed flush recovery and later retry also pass. These are local causality checks, not historical CI26 attribution.

## Final reviewed SHA256

Captured after final focused tests and independent assertions, on 2026-10-03. Core/runtime hashes matched the earlier frozen-handoff capture. The unchanged Task 2 repository/model/metrics authority is separately reviewed in `2026-10-03-source-authority-review.md` and committed by the parent as `c5640e0`.

| File under `desktop/` | SHA256 |
| --- | --- |
| `src/sources/manifest.mjs` | `9b7329e02d4b23c75a0ba10d717f71d54110fc338eeaa8a5a65a9c51a939d693` |
| `src/sources/migration.mjs` | `6c363f24519120578040f0c535ba266a8609e2a6d06e70409cf6fb06ae747783` |
| `src/sources/recovery.mjs` | `c4b102014e782dd3dd3b116af9039944b11573a9953b70d06b1ea9e4051bdc1d` |
| `src/projects/store.mjs` | `fcefad6e01b007726b6415c5f2fd683fdc0b7af88470827286d9767e224f8e7b` |
| `src/recovery/access.mjs` | `27489cf3289fbdec34efc3e5892e2d6b3c6beeeec0ceb87e16d66e1edb0218de` |
| `src/recovery/checkpoints.mjs` | `47aa34710f284ddf748e4760938e4a1b71b650fc7b8324e8977b4ea8cc517306` |
| `src/main.mjs` | `77f706255af90164e7f93a6e60a6910a19fd681756585a547f3cf4a9c434f355` |
| `src/ui/storage.js` | `66f765e6109768507a92c88ca2f89b8ba175fa6558d3c9928d29d0720af3a0ca` |
| `scripts/package.mjs` | `b97786e4e1c2e5b2224e02d0b3ab7c21532bde65dd5c716cc587f06a2b6c6d2b` |
| `build/renderer.mjs` | `321aa70263827454e9efe23a51ea74205f1312042d94f1d1062dd9e7cb14cde2` |
| `tests/source-manifest.test.mjs` | `4831cba9e12eb122c7f7976d02ce5aa1c0d2c2643a9faf342946b4f77a427312` |
| `tests/source-migration.test.mjs` | `6df1a88889b47c01e937ea2fca8f030deea3241b84c69de60a9694c55f1cd16b` |
| `tests/source-recovery.test.mjs` | `e01e0cd17236e02a24ed3310bed4fe151ba98fcedba46344889f9bc92a834ad8` |
| `tests/recovery-save-diagnostics.test.mjs` | `314790535fcb48401ea295a2f32bd7e94f79ed7d356d36ace60eabe285caa3e3` |
| `tests/renderer-storage.test.mjs` | `2d3053626cf7af9c5c4ae623a85311393d0a41aaf831301e734163adde3cb753` |
| `tests/package.test.mjs` | `3fa7905616566636644a553e52acb6bd7a54afd8026b5f9f2edebcdb3a583e55` |
| `tests/native-transitions.test.mjs` | `7295ae42701d4d97d633d07a6f0d9564c071a08c6e8e53ecbe26539877e4e661` |
| `tests/local-pin-integration-review.test.mjs` | `905520c0229bc515324b78d31d6d9e3aa0dc3706ee0f8c42dd44cc43390d55d3` |
| `tests/pin-ipc.test.mjs` | `28fc7996aab64907f8f7839e2dc4107d699bada65fc133db5d475c494a1a3a34` |
| `tests/project-selection.test.mjs` | `ea8632c89dcef4d15f2401915ad6113d78a5d96c97481c1e5a415f5fe7ba172d` |

## Qualification limits

No source IPC/editor integration is exposed yet. Schema 2 opens as a read-only legacy view; trusted recovery copies receive their internal restore permission only through the native selection transition. The package allowlist contains required source modules, but source allowlist inspection is not package admission.

Recovery export verifies referenced bytes and emits an explicit schema-2 bundle; the current implementation materializes complete source buffers and base64/JSON output in memory. Restore likewise materializes all verified originals before copying. Collection is deliberately coarse and preserves selected source directories and all retained versions, including unlinked drafts; it is not a version-level garbage collector. Later package/native, large-project memory and latency qualification remain the parent's responsibility.
