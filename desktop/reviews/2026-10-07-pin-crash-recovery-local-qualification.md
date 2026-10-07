# PIN first-session crash correction — owner local qualification

Author and native executor: `/root`, 2026-10-07. This is owner evidence, not an independent approval or release. Product source `c210bfb0fb7270f7b27ebc198e2cc9e1eabb94ce`; final qualified test/workflow snapshot `c9d973557bd7ffdc51271dbb780c5360392cc721`. The separate independent implementation review retains its actual author, exact source hashes and controlled-probe scope.

The original observed first-session process-crash trigger is corrected in these local repetitions. The six fresh development cases and three fresh copied-package cases all unlock after their single real restart. They include immediate setup→kill, setup→Lock→kill and graceful controls. No canary, injected storage adapter, PIN reset or reconstructed key is used. Exact ciphertext remains unchanged between setup acknowledgement and restart unlock, and the dedicated protection profile already has Local State before setup acknowledgement. Every actual child cleanup is confirmed by owned process identity; source inputs remain unchanged.

| Qualification | Actual result |
| --- | --- |
| Final full suite, `pin-final-suite-2026-10-06T22-06-50.732Z` | 1,242 tests: identity 3 + units 1,239; zero failures, skips or cancellations; unchanged inputs |
| Development crash/restart, `pin-crash-recovery/2026-10-06T21-58-22.196Z` | 6/6 cases |
| Fresh copied-package crash/restart, `pin-crash-recovery/2026-10-06T21-58-58.287Z` | 3/3 cases; closed original package inventory unchanged |
| Actual old packaged PIN → current packaged application, `pin-legacy-missing-key/2026-10-06T22-05-39.071Z` | Wrong PIN stays legacy; correct PIN migrates; real restart unlocks; untouched original seed |
| Actual copied new envelope with required key omitted, same receipt | Refuses access; exact record retained; no replacement key |
| Actual default-provider writer exclusion | 4/4 cases; live owner excludes workers; a fresh provider works after confirmed owned holder exit |
| Copied-package shell/core/300k import | All child exits zero; original 300k import oracle completes four cases |
| Passive copied-package Diagram observation, `diagram-edit/2026-10-06T22-06-51.608Z` | 4/4 cases; trusted pointer/click events and roster stages retained; original hosted cause remains unresolved |

The new development preview is `dist/development-96b4cda0-0f56-4b6d-b0a9-2cf13e78327f`, ASAR 53,866,346 bytes, SHA256 `0b66e4ef46f1b637490affc0b11cba9a3a8f5d6c4157a7e67d4c21f62448a186`. All 261 application files were byte-compared against the actual archive; the fixed process-reader binary remains `485d4fe26225c75670e2ce425fa0daa816f5b8ef93b1561042b7138e01fed6a3`. It is a development preview with `releaseAdmitted:false`; no installed application was replaced.

## Corrections to evidence scope

The original owner runner `evidence/workspace-surface/pin-package-native-2026-10-06T21-58-58.143Z/result.json` labels every child as a copied-package probe. That label is **incorrect for its `local-pin` child**: `tests/native/local-pin.mjs` ignores the supplied `--package` arguments and actually tests development. Its real `local-pin-2026-10-06T21-59-22.087Z` result is completed access/keyboard/cooldown/change/recovery evidence for development only. The separate crash, shell, core and source-import children genuinely use copied packages. The original runner, log and receipt remain unchanged; this correction is explicit in the structured owner receipt.

The initial full suite at `21-57-27.158Z` remains ADVERSE with two failures. Its external LocalPin test double lacked the newly required `cancelPending`/`drain` methods, causing the actual extracted Lock service to refuse before the intended export assertions. Only that test fixture was amended. The same 18 export/Lock tests passed afterward, including accepted-publication drain, revoked staging cleanup and unconfirmed-cleanup refusal; later complete suites passed. No product behavior or oracle was weakened.

The initial legacy compatibility harness remains ADVERSE at `22-04-38.841Z`. It tried copying Data into a pre-created directory with `errorOnExist:true`; an exact separate copy diagnostic reproduced `ERR_FS_CP_EEXIST` before the current application launched. The corrected harness copies into a previously absent owned path. Original evidence is retained, product bytes unchanged, and the later two actual native cases are a separate receipt.

The original hosted run `37534183640` remains FINAL FAILURE. Its original source import passed, but subsequent Diagram reopen timed out after a successful Close save. The new passive observations preserve the original single click, roster-growth oracle and deadlines. Additional observations alter scheduling; their local pass is **not** cause or fix proof. No original result is relabelled.

## Boundaries and next gate

This qualification covers actual local process termination/restart and the stated refusal/migration controls. It does not guarantee power-loss or OS-reboot durability, recover an already unreadable old record, or isolate against an adversarial process running as the same Windows user. The live-holder test is not a production orphan-worker crash test. Account credentials remain on their separate existing backend; no production account/update/release admission is implied.

Ruling: readable legacy PIN records retain their legacy attempt/cooldown writes until successful authentication permits migration; otherwise records remain blocked and preserved. Cost: dependence on the prior profile until legitimate migration. Ruling: required-key checks plus two normal worker exits are mandatory before publication; missing/uncertain keys refuse without reset. Cost: access can remain unavailable, rather than replacing protected state. Ruling: the original hosted Diagram failure stays open until its cause is established; a later pass cannot close it. Cost: hosted qualification remains a separate gate.

The structured companion records original receipt hashes, all final qualified input hashes and explicit adverse/scope corrections. GitHub synchronization and a fresh hosted run are the next gates; `main` and the installed application remain unchanged and PR #2 stays draft.
