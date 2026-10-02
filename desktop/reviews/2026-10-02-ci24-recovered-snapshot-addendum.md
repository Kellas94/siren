# Independent CI24 recovered-snapshot addendum — 2026-10-02

Author: `/root/review_native_launcher`. This is a new scoped addendum; the CI23/mixed-result/provenance reports remain frozen. Only `tests/native/packaged.mjs` was adapted. Product, native runtime, preload, storage adapter, drive helper and other original tests were not edited.

## Retained hosted negative

The parent supplied the authenticated CI24 artifact; I independently read `evidence/ci24-downloaded/evidence/packaged-2026-10-02T19-11-51.912Z/result.json`, SHA-256 `20a0078d9e6b36a3ff7502d439b16c4b1fbf5bb368ae19e0caa90acd55ba96ef`. I independently hashed `evidence/ci24-evidence.zip`: `a2449fc65b413aef836c84cfd9c0727a814165840972aa74f80ddf2538501f26`, matching the parent-provided artifact digest. I did not repeat the parent's GitHub authentication/count audit in this task.

The receipt records probe `421c0b9cbb3eb760ebac31b7ba92efdf8f24d8e932c09bbe47fc4a941fdf80a3`, source `fae74857f6b3fe8e5fb0a9a997a1de385ad0cbb2`, renderer `20f0b24e31d22f9f93dfbab1b373c20344f4920fbb792417654cb622a755776a`, archive `41e6f342bbbfc3bdcd3f422c263d0c7ef6bb8a5a09ffb45ac7f1b684d2239eb1` / 14,276,491 bytes. Actual editor save drained successfully from revision 2 to 4 with SHA-256 `93fa041dafdbc9a3e8b4bcb11f409a56b5bab9e90d607f2ebb3b0f4ea36e8dbf`. Failure occurred at the second separate recovered read's hash assertion, line 110: observed `22a4c4ba121fdaf1b55926a16566074ed7a160bf94e863ef2a2b6adc80634921` versus the selected checkpoint hash above. The prior line's separate JSON equality had passed, or execution could not reach this assertion. No post-read disk Data was retained, so the exact changed fields/trigger cannot be reconstructed from this artifact.

## Independent diagnosis and correction

`ProjectStore.readProject` reads one current pointer, then the named immutable revision bytes. It verifies that record's pointer hash/revision/project identity and payload hash before returning. Thus each call returns a coherent verified snapshot. Two calls are separate observations of a mutable current pointer. Given the preceding JSON equality and subsequent different verified payload hash, CI24's checks combined two different valid generations. This identifies the test's incoherent comparison; it does not identify every field or timer responsible for that hosted transition.

Merely capturing current once still assumes the active renderer has not saved before that first read. The final probe separates two lifecycle boundaries without resetting any expectation after an action:

1. The initial recovered copy must have a new project ID and revision 1. Its production bootstrap JSON/hash must exactly equal the previously selected verified checkpoint. Its immutable revision-1 disk record must have the same exact JSON/hash, independently recomputed payload hash, and full deep equality with both the native bootstrap and a verified native saved checkpoint. Every key/byte in the selected workspace bag remains part of this initial-copy oracle.
2. After normal initialization, the test calls the production save drain and captures exactly one current `readProject` snapshot. Its project ID/revision, computed payload SHA-256, desktop envelope, exact edited source and active-diagram source are checked together. Later normal renderer saves may produce a canonical envelope while leaving the initial immutable proof intact. This current snapshot is recorded, not used to replace any initial-copy or original-preservation expectation.

The complete acknowledged pre-restore original snapshot still must remain exactly equal after recovery, after draining the new project, after normal exit, after Unicode relocation and in the native read-only safety variant. Native locked/null bootstrap, known-ID PIN_REQUIRED, rejected development CLI, real PIN setup/unlock, editor input/save byte/hash readback, normal clean-close, relocation and ACCESS_REFUSED despite a correct PIN remain mandatory. No save retries, altered native functions, storage injection, dialog acceptance or expected resets were introduced.

The parent separately owns a workflow change retaining the named diagnostic JSON files. This reviewer did not edit that workflow.

## Actual local progression

The first single-current-read candidate `fbe61c18e2bf7806972edf6c6bd7b9aac0f247c3a114f3adbc44c647516f4579` attempted one native execution: `evidence/packaged-2026-10-02T19-16-07.330Z`. It failed earlier in unlockDesktop's post-reload nonlocked-bootstrap wait, before saving/recovering. Lifecycle evidence showed initial isolated/default contexts and frameStartedLoading, with no captured dialog, new navigation or context destruction before the timeout. That distinct local failure remains retained and unclassified. It did not validate the copy change and was not followed by blind retries.

After the lifecycle-semantic refinement, the exact final test `8e7dd6c5ee9e2ffe7cef0485ff9ecdfe081f4250c0f15525a73d7102af6e754e` completed an independent actual native execution, exit 0: `evidence/packaged-2026-10-02T19-19-13.702Z`. `node --check` also passed; the final source digest was independently rechecked after execution.

That execution provides concrete native progression: selected checkpoint and initial recovered revision 1 had hash `4c3fc28b74539c7eb1388ac5ba855fdde9340471ace3c5c69cdfb90f64663ef2`, and full bootstrap equality with the immutable disk record passed. After the production drain the same new project was revision 2 with hash `c674f364380d3a625300c5dbb840ae508e26b376226af432c9037e0e4ba97a1d`, retaining exact edited source in workspace and active diagram. The original pre-action boundary was revision 4 with the latter hash, and all subsequent complete-original preservation checks passed. `recovered-at-restore.json`, `recovered-initial-revision.json`, `restore-boundary.json`, save-diagnostic.json and result.json retain these records. The normal copy really advanced; the revised test verifies that progression rather than hoping to read before an autosave.

Execution command: `& 'C:/Program Files/nodejs/node.exe' tests/native/packaged.mjs dist/development-6d8d2781-d5dc-494b-b2ce-f19eb62b7e43`, desktop cwd, require_escalated PowerShell, Node v24.16.0. All data/PINs were owned synthetic fixtures and only isolated Unicode package copies were executed. Original user Data was untouched.

## Scope and limits

Local qualification binds the unchanged development package source `b6249016cc9a001c646cc183f3c38884da678b1d`, renderer `808e28032e63a54e6e7376118d9e275e404ffa940c9669038ffc4b12382d9ad8`, archive `53da590bd172987fb0102b183dde6e5c921b4af6a2ec8f34f1c8251d63a1e9f5` / 14,277,106 bytes and runtime `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`. The hosted LF-normalized archive remains a distinct receipt; no new hosted CI result is inferred from this local run.

Final original test SHA-256 is `8e7dd6c5ee9e2ffe7cef0485ff9ecdfe081f4250c0f15525a73d7102af6e754e`. Drive remains `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4`; main remains `79e8645b92112c80c8c9aa3a0bfad81ff336b8ede182e39ad57e79a41bc2ff63`.

This is one successful exact local packaged execution with stronger independent initial-copy evidence, alongside the retained pre-save timeout. It does not prove that earlier CDP instability is fixed, diagnose CI23's missing save-response code or the original CI20 identity failure, establish a physical first-paint claim, or admit signed updates/launcher races/a production release.
