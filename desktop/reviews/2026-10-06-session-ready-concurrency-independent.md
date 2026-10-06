# Independent regression: session-ready journal concurrency

Author: `/root/native_menu_trace_review`, 2026-10-06. Read-only product/source investigation plus an independently authored bounded filesystem regression. No GUI, product/test/generated edits, or hosted rerun. New files are this report and the isolated evidence directory identified below. Previous independent reports remain unchanged.

**Verdict: a separate concurrency defect is deterministically reproduced with the real journal method and real atomic writer.** Two accepted ready notifications can write different journal bytes concurrently. One write can replace the file between another write's rename and durable readback, producing the actual `Durable readback mismatch` error. The actual main ready handler then sets readonly; another successful ready handler does not reverse it.

**Original hosted boundary:** run `37526593560` remains adverse. Its screenshot identifies the readiness-journal catch branch. It does not retain the thrown error, ready-notification order or journal-phase trace needed to prove that concurrency caused that hosted failure. The independent regression proves a mechanism, not that original execution history.

## Original hosted evidence

Prefix `H` means `evidence/workspace-surface/ci37526593560/desktop-packaged-evidence-original/evidence/shell-2026-10-06T20-29-07.717Z/`, relative to `desktop/`.

| Retained original | SHA-256 independently calculated |
| --- | --- |
| `H/startup.json` | `4778a67be815ac36f97e0f518fcb4248ba9ccd7b1b731bf13103d97dd71589e5` |
| `H/failure-state.json` | `025afd2c7b4f7c317dee3bc147fa9046553bca52f5363f27b9c2975847106600` |
| `H/failure.png` | `2c8fac5f2e124ca71f8b4f83f5dbbd0f93d6bd6aebdee6ef36a7df6950646e5e` |
| `H/electron.log` | `22a43a72588fb520492741113b623d07e588e0ca0e8912657c9eb861949896eb` |
| `evidence/workspace-surface/ci37526593560/desktop-packaged-evidence-original.zip` | `798b367cee542ece48e80960ddb46e700a20fdbec2c8457582dd05f10157fd8b` |

I read the JSONs/log and visually inspected the actual failure PNG. Startup is `mode:readonly`, `readonly:true`, `pinUnlocked:true`, URL `siren://app/app.html`, readyState complete. The shell failed its existing normal-startup assertion before any successful shell checks; failure-state has `checks:[]` and `recoveryOpen:true`.

The screenshot visibly says **“Readiness journal could not be confirmed; preserve/export existing work”**. In the inspected source that exact text is assigned in the `siren:ready` catch at `src/main.mjs:832`. Recovery UI at `src/ui/desktop.js:172` renders `boot.reason` or `state.reason`. This supports identifying that catch branch, rather than inferring it from generic readonly state. The retained Electron log contains no `PROCESS_IDENTITY_FAILURE`, but absence of that line is not the primary branch evidence. It ends with Home admission refused as `ACCESS_REFUSED`; that is a downstream observation, not the underlying journal error.

The original packaged ZIP has six files, matching its retained identity receipt. Its BUILD-IDENTITY records source commit `6e86f46c6f14337438585ff98c08ceba26e367ab`. I did not independently reconstruct that hosted integration source or extract its executable archive. Local source hashes below delimit the reproduced mechanism.

## Actual source behavior and controlled experiment

Pre-correction source was captured while portable HEAD was `b15220d0c30be88f5a81cfb1ff146abcf012a7bf`. These source snapshots are preserved under `evidence/session-ready-concurrency-independent-2026-10-06/`, using filenames such as `src__recovery__sessions.mjs`. Root may subsequently implement a separate correction; this report remains about these retained bytes.

| Pre-correction source | SHA-256 |
| --- | --- |
| `src/recovery/sessions.mjs` | `8561a54eb16b8eb101c3f12bfebf8c91f299dfc1961c6ace4a5c70c3137ee6bf` |
| `src/projects/atomic.mjs` | `803eb8c40edd5711bae3a51ade69ab935b779bae7d1ec6e8da5808dbeea77de4` |
| `src/projects/io.mjs` | `a87fc4a0243eef18e3a14fb651b55cc8c1cfa49a137b21eb7239a262ce858687` |
| `src/projects/paths.mjs` | `0f3fe81566b050f0a30f808960325cc2ca7d5027239cf65ed5ffb6a751724554` |
| `src/recovery/checkpoints.mjs` | `3c840c707d2fc71d7ca8c2067994e0baa10d7e2f332d44f35c22dc084b6eb36c` |
| `src/main.mjs` | `da8e340374e032dad4ab240d633d58a3ea403854264418b05e0dd1794c949e36` |

`SessionJournal.recordSession` reads `sessions.json`, filters/pushes an event and invokes `atomicWrite` without serializing the read-modify-write sequence. The writer safely replaces one file through a private temporary file, then reads back the destination and requires exact byte equality. It does not claim to serialize multiple journal writers.

The actual main `siren:ready` handler checks `readyRecorded`, but sets it only after awaited `journal.recordSession`. A second trusted notification can pass that guard while the first operation is pending. Home's real ready notification is called from `home.refresh().finally(...)`; preload forwards it to `siren:ready`, and the legacy renderer also notifies readiness. These source call sites make repeat notifications possible across renderer lifecycles, but do not prove that two overlapped in the hosted failure.

The independent probe uses the complete actual SessionJournal class body in a VM. Only import declarations and the export keyword are removed so the atomic adapter can be injected; journal read/filter/push/validation logic is unchanged. `RecoveryStore`, owned-path checks, `readOwnedBytes` and `atomicWrite` are the actual imported implementations and operate on real files in newly created owned evidence directories. The actual main ready-handler body is separately extracted and run in a VM with a synthetic trusted sender/main-frame and application/window adapters; its guard, await, success and catch logic are unchanged.

Each dataset is seeded with one actual `opened` record. Both competing ready calls share one journal instance, session/version/process identity and seed. AsyncLocalStorage supplies fixed per-call clock values, yielding timestamps `2026-10-06T20:00:01.000Z` and `2026-10-06T20:00:01.001Z`. These payloads have equal lengths and differ only in their final event time. No IO failure is injected.

Only the atomic writer's existing fault callback is used to pause phases:

1. A reads the seed, writes/syncs its real temporary file, and pauses before rename.
2. B reads the same seed, writes/syncs its real temporary file, and reaches before-rename.
3. A renames its file, then pauses after-rename before its readback.
4. B renames, reads back and confirms its own bytes, and its operation/handler completes.
5. A resumes and reads B's bytes from the destination; actual equality verification rejects A with `Durable readback mismatch`.

This schedule is controlled, rather than a statistical stress test. Both writes and readbacks remain genuine filesystem operations. It proves the interleaving is mechanically sufficient under these source implementations; it does not estimate its frequency on hosted Windows or reproduce Electron navigation timing.

## Four executed cases

Command executed from `desktop/` with Node `v24.16.0`:

`node evidence/session-ready-concurrency-independent-2026-10-06/probe.mjs`

All four case assertions passed; result status is `MECHANISM_REPRODUCED_WITH_CONTROLS`.

| Case | Observed result |
| --- | --- |
| Actual journal method, different timestamps | B fulfills; A rejects with actual `Durable readback mismatch`. Final journal contains opened plus B's ready event; A's ready event is lost. |
| Actual main ready-handler body, different timestamps | Both handler promises resolve because the handler catches the error. B's journal write succeeds; A's journal write rejects. Final state has `readyRecorded:true`, `nativeReadonly:true`, mode readonly, bootstrap readonly and the exact original screenshot reason. One safety status is sent. A successful ready handler therefore does not restore normal mode after the other call fails. |
| Same concurrent schedule, identical timestamps/payload bytes | Both writes confirm the same digest, with no thrown error, but final journal still contains only opened plus one ready event. Identical bytes can mask the read-modify-write race. |
| Directly imported actual SessionJournal, sequential calls | Both ready calls succeed; final journal retains opened plus both distinct ready events. This is a control without the VM atomic adapter or concurrent phase schedule. |

Evidence, relative to `desktop/`:

| Artifact | SHA-256 |
| --- | --- |
| `evidence/session-ready-concurrency-independent-2026-10-06/probe.mjs` | `e8bbd5bfcea04809b09ba0fcae14f862a5a16a7604edf440761e199f6645cbd1` |
| Same directory, `result.json` | `e473a24d9a380cefee17b842423690591e0052063f6132f4df0f90384403daf3` |
| Same directory, `actual-ready-handler.txt` | `91f39a76a95da02b61bc90de945f816b4800a1d22fcce1fee37620ace76fa1bf` |

The result retains complete phase records, individual writer/handler outcomes, final state and journal bytes. The owned data directories and source snapshots are preserved. Rerunning the original probe after product source changes is a different experiment: it reads working-tree source and must not be represented as a replay of these frozen pre-correction bytes.

## What remains unproven and useful diagnostics

The original screenshot pins the readiness-journal catch, but that catch suppresses the error object. Any recordSession failure can enter it. No original ready count, timestamps, journal bytes or atomic phases were retained. There is no basis to label `Durable readback mismatch`, overlapping ready calls or timestamp differences as the original CI root cause yet. The four-case reproduction supplies a genuine defect suitable for a separate correction, independent of causal closure of the hosted failure.

The existing shell startup and failure snapshots omit reason. The smallest passive diagnostic is adding a finite bounded `window.sirenDesktopBootstrap?.reason` string to each existing snapshot expression, preserving actions, normal-startup assertion and deadlines. This would distinguish the readonly reason in machine-readable evidence without additional awaited observations or a new authority path. The existing screenshot happens to preserve it in this run.

To distinguish concurrency from another readiness-journal failure in a future recurrence, separately record a bounded main-process diagnostic at ready-handler entry, completion and catch: monotonic time, event sequence/in-flight count, accepted frame URL, and finite error name/code/message. A bounded journal phase trace correlated to those event identifiers would distinguish a failed destination readback from a rename/path/write failure. Do not weaken byte verification, substitute normal mode on failure, retry a failed write into a pass, or lengthen the shell deadline.

A correction should serialize the entire journal read-modify-write operation, including ready versus clean-close records, and coalesce duplicate readiness work while it is in flight. Failures must continue to select readonly. This report does not implement or validate any correction; independent post-change evidence and actual hosted qualification remain separate requirements.
