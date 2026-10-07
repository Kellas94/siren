# Independent CI23 packaged-save probe review — 2026-10-02

Author: `/root/review_native_launcher`. Scope: owned `tests/native/packaged.mjs` adaptation and evidence-only controlled probes. No product, preload, storage adapter, drive helper or other original test was edited. Previous mixed-result and provenance reports remain unchanged. This report does not claim that CI23's exact cause, local CDP timeouts or final full qualification have been resolved.

## CI23 negative evidence

The parent supplied authenticated CI23 run/job identity `37048076118` / `110974348576` and reported 112 unit tests plus all 12 native groups passing before the packaged probe failed. I independently read the downloaded package receipt at `evidence/ci23-downloaded/evidence/packaged-2026-10-02T18-40-57.221Z/result.json` (SHA-256 `ab7234be20d59d1d7120bb4855a64b7d0b7729424e1cec80c6442662b11cbff9`) and failure-state.json (`cc1667024897fd060374be0d2f6a33c5603c495bdfb9febaa16bb135e776725c`). It records completed=false at the direct native save ACK assertion, bootstrap normal and readonly=false. It did not retain the save response or code. Therefore a CAS race is plausible, not established as that run's actual returned error.

Its receipt source is `89a9a0965590a7af4fbed540ada7ae67e251bd06`, renderer `20f0b24e31d22f9f93dfbab1b373c20344f4920fbb792417654cb622a755776a`, archive `41e6f342bbbfc3bdcd3f422c263d0c7ef6bb8a5a09ffb45ac7f1b684d2239eb1` / 14,276,491 bytes. This is distinct from the local archive below. The parent independently verified the hosted synthetic merge tree; I did not redo that GitHub verification in this task.

## Controlled native CAS observation

Before adapting the success path, I added response/baseline/post-read metadata immediately before the raw save assertion. An evidence-only controlled copy read revision 1, then used actual Code/Text/source pointer actions and keyboard input plus the production `sirenDesktopRequestClose()` drain to commit a different owned source as revision 2. It then submitted the original direct request using deliberately stale revision 1. No native function or storage mirror was replaced.

`evidence/packaged-2026-10-02T18-49-28.493Z` records actual `{ok:false,code:REVISION_CONFLICT}` and post-read revision 2, SHA-256 `84ee73523686810a133aae9767ab2bc6f15b6daad090a326263fafdc5edc8a78`. The controlled probe required deep equality of the entire post-read snapshot with the committed intervening snapshot before preserving the original ACK assertion as a deliberate RED. It exited 1 at that original assertion. `controlled-race.json` and `save-diagnostic.json` retain the evidence. This proves the mechanism can reproduce the ACK predicate failure while the native writer correctly refuses stale bytes; it does not supply CI23's missing response.

The first controlled attempt, `evidence/packaged-2026-10-02T18-47-47.526Z`, timed out at Runtime.evaluate before its diagnostic/save phase and is retained. The successful mechanism probe used explicit `C:/Program Files/nodejs/node.exe` v24.16.0 plus the earlier evidence-only error-stage helper; the original helper/native writer/deadlines were not modified. Preparation/probe files are under `evidence/prepare-packaged-cas-race-independent.mjs` and `evidence/packaged-cas-race-independent-2026-10-02/`.

## Final test behavior

The successful save path now uses actual pointer clicks and Ctrl+A/Input.insertText to change the source, then calls the existing production close-preparation drain. That boundary clears delayed save timers and drains renderer/native adapter queues until native acknowledgment; it does not close the app or manufacture an acknowledgment. The test requires a newer native revision, exact edited source in both the stored workspace and active diagram, complete desktop envelope, JSON SHA-256, selected revision-file SHA-256 and deep equality of the complete disk snapshot bytes with ProjectStore readback. It retains a verified saved checkpoint matching that exact acknowledged JSON/hash.

Recovery compares two explicit pre-action records. The selected checkpoint remains the exact recovered-copy target. Immediately before the pointer restore, the test drains production saves again and reads the complete original snapshot, recording it in restore-boundary.json. Every subsequent original-preservation check compares that complete pre-action snapshot; no expectation is reset after restore. The recovered new project's JSON/hash still must exactly equal the selected saved checkpoint. Relocation retains the actual acknowledged normal-exit recovered snapshot at its explicit close boundary.

This separate boundary follows a meaningful observed RED in `evidence/packaged-2026-10-02T18-54-18.542Z`: the real editor saved revision 2 / `4c3fc28b74539c7eb1388ac5ba855fdde9340471ace3c5c69cdfb90f64663ef2`, then a normal backup updated the original to revision 3 / `c674f364380d3a625300c5dbb840ae508e26b376226af432c9037e0e4ba97a1d` before the restore comparison. Independent complete-bag comparison found only `t-industries-siren-v23-state-last-good` changed; workspace state itself was identical. An early save ACK was therefore not the actual pre-restore original boundary. This failed receipt remains intact.

Locked null bootstrap and known-ID PIN_REQUIRED refusal, rejected development CLI, unavailable require, actual PIN setup/unlock, normal clean-close before copying, full original preservation, Unicode relocation relock/unlock and native damaged-journal ACCESS_REFUSED despite a correct PIN all remain mandatory. There are no success retries, stale-revision mutation retries or expected-byte resets.

## Remaining local reload failure and diagnostics

The first corrected real-editor attempt `evidence/packaged-2026-10-02T18-51-17.236Z` timed out before saveDiagnostic. The later `evidence/packaged-2026-10-02T18-56-09.363Z` additionally recorded the exact pending operation: unlockDesktop's wait for a nonlocked bootstrap and pin.unlocked=true after scheduled location.reload. It had saveDiagnostic=null. Failure screenshot/evaluation also failed, producing state=null.

The retained lifecycle queue shows initial isolated context 2 and default context 1 for frame `44EAAC69F9CBC482D3AE29E4883C89C9`, followed by Page.frameStartedLoading. No context destruction/clearing, completed frame navigation or stopped-loading event was captured before the evaluation timeout. This locates the failure during reload startup but does not prove a dying-context race, socket loss, JavaScript dialog or native policy failure. The old filter did not retain dialog events.

The final test remembers its current operation in memory, masks setup/unlock PIN expressions, and writes that metadata only on failure. It also retains the existing bounded Runtime/context/Page lifecycle queue, now including javascriptDialogOpening/Closed. It neither autoaccepts dialogs nor changes transport, helper waits, deadlines, native authorization or product state. No success-time per-operation logging is added. The probe receipts include their own source digest.

## Frozen sources and qualification limit

Final owned test SHA-256: `421c0b9cbb3eb760ebac31b7ba92efdf8f24d8e932c09bbe47fc4a941fdf80a3`; `node --check tests/native/packaged.mjs` passed. Drive helper remains `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4`; main remains `79e8645b92112c80c8c9aa3a0bfad81ff336b8ede182e39ad57e79a41bc2ff63`; generated renderer remains `808e28032e63a54e6e7376118d9e275e404ffa940c9669038ffc4b12382d9ad8`.

All local native runs used the unchanged development package `dist/development-6d8d2781-d5dc-494b-b2ce-f19eb62b7e43`, receipt source b6249016cc9a001c646cc183f3c38884da678b1d, archive SHA-256 `53da590bd172987fb0102b183dde6e5c921b4af6a2ec8f34f1c8251d63a1e9f5` / 14,277,106 bytes. They ran in the desktop cwd through require_escalated PowerShell; later runs explicitly selected Program Files Node v24.16.0. Only isolated synthetic Unicode fixture copies and fixture PINs were used; original user Data was untouched.

I independently established the controlled native refusal and actual editor acknowledgment/readback. The final frozen complete test has not yet passed in my executions: the post-boundary attempt stopped earlier during reload. Root will execute it separately and report that result without rewriting this report. No new hosted CI24 result, clean aggregate PASS, physical-flash conclusion, signed update qualification or release admission is asserted here.
