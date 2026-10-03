# Large-source editor and library evaluation

Author: `/root` (coordinator), 3 October 2026 Europe/Bucharest. This is my actual native measurement and integration choice, not an independent approval or release verdict. Independent library recommendations are in `2026-10-02-library-capability-review.md`, authored by `/root/review_pending_work`.

## Decision

Select **CodeMirror 6** for the approved Code editor integration, retaining SIREN's patched Lezer Python grammar and adding explicit theme and search-input adapters. Its isolated candidate passed six native 100k/300k synthetic editing cases. Product dependencies and renderer remain unchanged here; source repository, persistence, windows and final integrated qualification are still pending. The current SIREN application has not acquired 300k-line support from this experiment.

Next library evaluations: framework-free **TanStack Virtual core 3.17.11** for the complete-render Docs register, then **MiniSearch 7.2.0** for ranked/prefix/fuzzy global discovery. Those are source-grounded recommendations, with no measured A/B improvement yet. Keep Lezer, Mermaid and existing layout initially. Workers, native window management, hashes and atomic IO use existing Electron/Node capabilities; another library is not needed for those interfaces. Tree-sitter/Pyodide require a concrete additional language/compiler/execution requirement before their WASM/runtime costs are justified. Imported Python remains text and is never executed by this evaluation.

## Retained adverse product measurement

`tests/native/large-source-profile.mjs` imports unchanged actual main/preload/renderer and observes them from a test-owned entry. The production driver/deadlines were not modified. Owned fixture: 200 Docs, compact 80k lines, 319999 UTF-8 bytes. Actual `Input.insertText` failed after **20002.50 ms**. `completed:false` remains in `evidence/large-source-profile-2026-10-02T20-49-01.668Z/result.json`; diagnostic exit0 means the measurement was retained, not that the input succeeded.

Chromium trace retained 16,360,228 bytes and 68,849 events. Renderer13900 recorded 12,342 Layout and20,559 UpdateLayoutTree events; summed complete-event durations were5743.69ms and1006.95ms respectively. CPU sampling attributed almost all renderer samples to native `(program)`, so it does **not** establish a particular JavaScript function as the cause. Main42712 was predominantly idle. Layout, memory and native work are demonstrated symptoms; a widget/parser attribution would exceed the evidence.

105 native process samples were retained. Maximum **same-snapshot total working set2235.84MiB**, including a renderer working set1780.73MiB. These are Electron native KiB measurements, not JS heap estimates or the sum of independent process peaks. Passive tracing/sampling adds overhead. `scripts/analyze-source-trace.py` retains sampled CPU attribution, complete-event durations and the actual maximum snapshot in `trace-analysis.json`.

## Candidate and exact inputs

Isolated dependencies live only in ignored `evidence/codemirror-evaluation`. Installed with exact pins, `--ignore-scripts`, no product install. Candidate direct modules: state6.7.6, view6.43.13, lang-python6.2.1, commands6.11.1, search6.7.2. Transitive modules: language6.12.4, autocomplete6.20.3, Lezer common1.5.3/lr1.4.10/highlight1.2.5/python1.1.19, find-cluster-break1.0.4, crelt1.0.7, style-mod4.1.4, w3c-keyname2.2.8. **15 unique runtime packages**, all with MIT declarations and actual license files retained/hashed; build-only esbuild0.28.2 is additional. `2026-10-03-editor-dependencies.json` records package integrity and actual license bytes. Notices must accompany eventual redistribution; this experiment is not complete application licensing admission.

Current npm metadata points CodeMirror's maintained repository to [code.haverbeke.berlin](https://code.haverbeke.berlin/codemirror/view). The [old GitHub repository](https://github.com/codemirror/view) is archived and explicitly points to the move; its archived package version is not treated as latest. Documentation/new repository requests returned403 during this evaluation, so actual installed module source, package lock and licenses were inspected rather than claiming those pages were read successfully.

SIREN Python factory/helpers/terms are extracted from the trusted local generated renderer at build time. Shared Lezer modules use one installed instance; the existing patched grammar is not silently replaced with unmodified upstream Python. Four static fixtures passed without error: empty class pattern, parenthesized `with`, formfeed indentation, decorated async function with typing/f-string. Highlight, indentation and language-data properties share those module instances. The candidate still bundles upstream Python tables through lang-python as well as patched tables; deduplicating that asset is an integration optimization, not a reason to discard the fixes.

## Final native candidate run

Command: `node tests/native/codemirror-evaluation.mjs`, exit0, `completed:true`, six cases. Evidence: `evidence/codemirror-native-2026-10-02T21-12-10.711Z`.

Hardware: Windowsx64 release10.0.26200, Intel i9-13900HX,32logical CPUs,31.75GiB RAM. Build Node24.16.0, pinned Electron44.5.1/Chromium152. Synthetic fixture values are never executed.

| Lines | Fixture | UTF-8 bytes | Open request ms | Input→frame p95 ms | Painted line nodes |
|---:|---|---:|---:|---:|---:|
|100000|compact|400019|39.78|34.70|68|
|100000|representative|6399959|155.16|7.20|68|
|100000|Unicode|4899974|133.99|22.70|68|
|300000|compact|1200019|37.99|22.90|68|
|300000|representative|19199959|391.40|22.80|69|
|300000|Unicode|14699974|439.86|51.40|69|

Open request includes CDP fixture transfer/construction, **not** disk cold-open. Input p95 is nearest-rank over22 browser `beforeinput`→next-animation-frame observations per case; it is not a monitor-photon/OS-keystroke measurement. Fixtures are repeated synthetic statement lines, not proof of every complex syntax distribution. Peak native total working set across the final candidate session **886.04MiB**. Candidate lacks the200Docs/workspace envelope and tracing overhead of the adverse product fixture; these figures are **not** a comparable A/B memory reduction percentage.

Every case verifies independent Node SHA256 against the complete actual editor document after beginning insert, Ctrl+Z, middle Unicode paste, undo and repeated typing/undo. Complete-model find locates a sentinel near EOF rather than only searching painted lines; representative300k find took758.60ms. Selection and focus are exercised. Additional native checks passed Python highlighting, four-space Tab indentation, leaving editor focus for another control and Chromium IME composition/commit of漢字. Light/dark screenshots are retained. This checks CDP IME behavior, not every physical OS IME or accessibility workflow.

Actual final bundle442753bytes, SHA256`32a9a7290f2a4ec9d42d755d6606c532a657c9527723b5bfcc3d37a7f0ec9752`. Candidate source SHA256`1da44fabe29ca0b2e15f6685dad20f6a0e8f3fb2f579b3882d37e211487d93d9`. Patched factories SHA256`c3b436db7d8d79ae712772ec1ffccb60381f9bfcf5f35646d3e838e2b9a0592b`. Final result SHA256`8d3a599f750200d75114db1679d1bcff5854c6c5e4c96d7bb92f62afdd292e77`. Driver SHA256`e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4` is unchanged; generated SIREN remains808e280.

## Failures and adaptations retained

No deadlines or expected text hashes were loosened. Before functional measurement, a Windows ESM path import failed, a test-entry top-level await of Electron readiness prevented startup, and a missing local Python terms factory caused an initialization error. Each harness fault was diagnosed and changed; logs/original result folders remain. The startup diagnostic exposed `Unexpected parser module`, not a library performance failure.

First functional attempt at21-04-43 found that a pasted search query followed immediately by Enter searched the old query (selection0 instead of399998). Installed stock search panel commits on keyup/change. The isolated adapter now bridges actual `input` to its existing `change` contract; the exact EOF selection assertion remains. Integration must retain this behavior, including replace/options.

At21-06-06, compact100k passed, then a full6.4MB string return over CDP timed out. Process samples showed a responsive low-CPU renderer, but the precise transport cause remains unknown. The oracle now hashes the **complete actual text** using browser SHA256 and compares the64hex receipt with independently computed expected Node bytes. This bounds verification transport without dropping text coverage. The old timeout remains; a different transport path is not a retrospective PASS for it.

First bounded-receipt six-case run at21-08-06 completed, but visual inspection found inherited light token colors unreadable in dark. A native contrast test failed at **2.27:1 string /2.59:1 comment**. The candidate now uses separate token styles per theme. Unchanged `codemirror-theme.mjs` passed on the final bundle: dark10.32:1 string/6.18:1 comment, light6.54:1/6.15:1. This is string/comment contrast coverage, not full accessibility certification.

## Integration boundaries and existing blockers

Approved next work remains native source authority/TextModel/blob storage, manifest/migration/recovery, registered windows, editor adapter and cancellable index/diff/maps. Save/export/Quit/restart exact bytes,32MiB boundary,256MiB project, long-line/malformed/BOM/newline/refusal, conflicts and crash/cancellation have **not** been qualified by the isolated editor. Task4/Task6 own those integrated tests. No product package dependency was admitted merely by increasing a constant.

Hosted DesktopCI26 remains **FAILED**, independently retained in `2026-10-02-ci26-packaged-failure-review.md`:115unit tests and12native groups passed; packaged post-recovery flush rejected `Save not acknowledged: failed`. Its native cause is not retained/proven. LauncherCI17 succeeded. Local earlier package success does not override that hosted failure. Private PR2 stays draft; no main merge or public binary release occurred.
