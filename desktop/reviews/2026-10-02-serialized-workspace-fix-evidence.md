# Serialized workspace correction — scoped evidence

Author `/root`, 2 October 2026. This is the coordinator's verification record; it is not an independent evaluator's report or a release approval.

## Behavior and source identity

Product commit `4f934bda0d04358253eab5ffdb7e27bc6d5b4c98` fixes accepted workspace JSON that expands past 128MiB when embedded in a snapshot. Raw workspace acceptance remains 64MiB. Revision, pending and recovery records now share a 128MiB + 64KiB serialized budget, and writers check actual bytes before publishing unreadable records. The selected revision's contradictory 128MiB-only post-check is removed; bounded IO still rejects oversized files. New budget module is explicitly included in the package allowlist.

This does not raise Code/Python analysis limits or qualify hundred-thousand-line editing. It does not rewrite damaged files or change selected pointers; intact records formerly refused only by the contradictory size check can now be read within the common bound. Damaged files remain preserved for explicit recovery.

## Regression proof

The first run of `node --test tests/serialized-workspace.test.mjs`, before the product edits, had 3 failures (2710.8954ms). Tool transcript retains the actual failure output: accepted 64MiB create threw `Corrupt selected revision`; oversized commit changed current-pointer bytes; oversized recovery added an unreadable point. This paragraph is a summary of those tool results, not a fabricated raw log or independent verdict.

After the fix, all 3 tests passed (10088.0748ms). They check exact 64MiB escaped input and a 200-control-character label, create/read in a fresh store, pointer hash, save/read/pending and recovery bytes. Negative tests check unchanged current pointer/revision filenames and unchanged recovery filenames/catalog before an oversized envelope can be published.

The new package-module assertion first failed with `src/projects/budgets.mjs: false !== true`; adding only that runtime module to the allowlist made all4 package tests pass. Packaging is therefore checked separately from storage behavior.

The final full command `node --test tests/*.test.mjs` after packaging integration passed **115/115**, zero failed/skipped/cancelled, **180972.4173ms**. Actual 180-second callback expiry and Windows process identity probes ran. Log: `desktop/evidence/serialized-workspace-final-suite.log`, SHA256 `fe60df66eb5f3af9eeed4fe1388dac7a1f8756ed66714d950449ce3e8c810514`. The earlier full115 pass preceded the package allowlist correction and is not substituted for this final run.

## Independent review scope

`/root/launcher_implementation` authored `2026-10-02-serialized-workspace-review.md`, SHA256 `4315b654e1820ba5c5278ceab9896b90764c6fabd060f5bbe056029dccd0c041`. Root rechecked its actual bytes and reviewed source hashes. The reviewer found no must-fix in the changed path by source inspection, with low-priority additional boundary/Unicode/pending suggestions. It ran no new full/native/package test and does not own Root's results.

## Actual new packaged probe

New development package: `desktop/dist/development-0100310b-db0a-43e4-ac50-32ecab6c6c63`. BUILD-IDENTITY source commit matches `4f934bd...`.

| Item | SHA256 |
| --- | --- |
| app.asar,14,278,154bytes | `68048cd382f431b0662e881e3e48489ec0ea880ea8ae8a64880b869382cf0354` |
| unchanged Electron44.5.1 binary,245,726,208bytes | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |
| unchanged renderer | `808e28032e63a54e6e7376118d9e275e404ffa940c9669038ffc4b12382d9ad8` |
| unchanged packaged test | `771f17fb4836d4621f3ba6071edbc10cdc718ae7e4bf29814429686566a9d541` |

The actual committed-source package ran `node tests/native/packaged.mjs <new-package-root>` and exited0 with `completed:true`. Evidence: `desktop/evidence/packaged-2026-10-02T20-28-24.199Z/result.json`. Root checked result hashes against receipt/file hashes; the test covers actual sandboxed archive execution, locked null snapshot/refused writes, production native synthetic PIN, pointer/keyboard editing and acknowledged save, recovery into a new project, Unicode folder copy and reopening, inactive-original preservation and damaged-journal readonly despite correct PIN. No assertions or test driver were changed for this run.

The 64MiB exact boundary is qualified through the real ProjectStore/RecoveryStore disk tests; this packaged UI probe uses its existing small diagram fixture. It does not prove 64MiB interactive editing, native launcher/apply, clean PC, online account or physical multi-monitor behavior. Package flags remain `releaseAdmitted:false`, inventory/launcher unqualified. No public binary release or main merge.

Root additionally compared the four changed archived production modules byte-for-byte against verified source files using Windows-normalized archive paths; all matched. An initial extraction using slash-separated paths was refused by the Windows ASAR API, while listing showed the actual backslash entries; this was an inspection-path error, not a missing module or changed test oracle. Exact-path process census after the packaged probe found zero remaining owned fixture SIREN.exe processes.

Hosted CI25 remains FAILED at access-screen mouse-command timeout; its packaged stage was SKIPPED. This local new-source result does not rewrite that historical run or diagnose its timeout. Formal Security start previously failed before an authoritative scan ID and is still unqualified.
