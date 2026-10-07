# Independent limited review — observation additions after hosted adverse results

Author: `/root/media_batch_review`. I directly reviewed only the working-tree changes in `desktop/tests/native/docs-context.mjs` and `desktop/tests/native/guided-intro.mjs` against local HEAD `378a0485eb02cd44f6224e0ded6ede1e0a3f9d37`, and read the four retained result files below. This is a fixture/instrumentation review, not product/package approval, independent native execution, a CI fix or acceptance of the entire feature batch. I launched no GUI and edited only this report. Earlier reports and adverse artifacts were not modified.

**Conclusion:** no hidden action, success-oracle or configured-deadline change was found in these two diffs. The new observations are useful but not timing-neutral. Neither local successful result explains or closes its original hosted failure. Both hosted causes remain **UNRESOLVED**.

## Exact reviewed inputs

| File | HEAD blob | Working-tree SHA-256 |
| --- | --- | --- |
| `tests/native/docs-context.mjs` | `dcf590124003f50b97df8e515885feb8e178df5d` | `dc6c37cbcb399d2bb424e59a0850a40d470e170bf5821a85e9a930202b1ec86e` |
| `tests/native/guided-intro.mjs` | `98adce6b4ca75d33a9e661a713b05b7a830cf2d4` | `d27d31cf55c5df9bda69b08e27098315d00a56343735af409b93fdf49c6fcf78` |

Both hashes remained the same at the end of my inspection. I independently ran `node --check` for both files and scoped `git diff --check`; all exited 0 (Git also reported its existing CRLF-to-LF normalization warning). These are syntax/diff checks only, not native tests.

## What changed and what did not

**Docs:** added five read-only `Runtime.evaluate` snapshots before/after the original status click, End, Enter and Search. They record active element, status value, control disabled state and current entity IDs. The original click/select/key sequence, expected approved-only `doc-b` result, reset sequence, six cases, save/readback assertions, failure exit and wait deadlines remain intact. There is no DOM value assignment, synthetic change event, extra click/key, retry, fallback success or relaxed row oracle.

The added awaited evaluations introduce real CDP round trips between actions. Although they do not contain sleeps or modify deadlines, they can change how much time a native popup has to process input. Consequently a pass with snapshots cannot prove that the uninstrumented sequence has no scheduling defect. No trace was recorded for the reset-to-All half.

**Guided/intro:** added one observation installation after the existing `stopTour`, a failure-path readout, and a success-path readout before the first driver closes. The added listeners only read event targets/focus/menu state; they never prevent/default-stop an event, focus a control, modify application state, or call application functions. The MutationObserver records menu and Guided-row changes and header ARIA attributes. Recorded events are capped at 160. The original header click immediately followed by `.struct-menu-item:nth-child(2)`, the subsequent two repetitions, save/source/intro assertions and deadlines are unchanged. No positive menu wait or re-click has been introduced.

The trace itself creates a test-owned `window.__sirenOwnedMenuTrace`, listeners and an observer. They add DOM queries and microtask work, and remain installed for the page lifetime even after the recorded-event cap. Thus “passive” means no intentional app action, not zero timing/CPU perturbation. A MutationObserver timestamp is callback observation time, not the exact mutation execution time or a caller stack. Event fields do not include `isTrusted`, cancellation state or actual header-descendant identity, so the trace must not be overinterpreted as proof of a particular internal handler.

## Retained evidence and identities

All paths in this section are relative to `desktop/`.

| Evidence | SHA-256 | Recorded outcome / identity |
| --- | --- | --- |
| `evidence/workspace-surface/ci37521535159/desktop-packaged-evidence-original/evidence/docs-context-native/2026-10-06T19-55-24.506Z/result.json` | `81b4fbefb0b081a84e4aa0400a90f810ef81155dea5cc914834d02322ddeddfa` | `ADVERSE`, register phase, zero cases, unchanged inputs. Package source `d83bedc68e0025dd9050aa3bf7f093a2a74d0408`; app archive `28c1186e1db719dd47b7b77b88f7a1edad2acdccc3cd3068eedb24a61823ad04`. |
| `evidence/docs-context-native/2026-10-06T19-57-25.495Z/result.json` | `80c26dcb1ef27dd1ed46a4dfc7ae1273202b9690963c4577c4d537b047810cf5` | `COMPLETE`, six cases, unchanged inputs. Package source `fd20b76d586ce0fb2d925692de49d5f98222c66b`; app archive `20de5955d0b1f012913892807f7da3629e23acaf3bd7d6cc52bc3b236b5f25b4`. |
| `evidence/workspace-surface/ci37521535159/desktop-native-desktop-evidence-original/evidence/guided-intro-2026-10-06T19-55-24.656Z/result.json` | `1d91657fef3eb5791a02ea543095e1ed2cc2677bd03d87c3c32da0458c91e508` | `completed:false`, actual Guided edit saved; second click on original line 67 immediately throws `Missing native control`. Renderer hash `fbf59fd11031f7eb11d6a7c50d831dcb9c704308bc4c11b47b6f758d6688f299`. |
| `evidence/guided-intro-2026-10-06T20-02-23.360Z/result.json` | `8a004e422545f76a0cf6616abc8d84470299b611997c80803cea9a67ad93ffd8` | `completed:true`, Guided save, explicit tour, animated replay and reduced-motion overview recorded. Renderer hash `2c9244ce238665993a0f6b97d4af020ad979164be11c8cd582f8a51fd1fcd8a3`; 90 menu trace records, 139 first-paint frames, locked bootstrap and no observed workspace flash. |

These local results are not executions of the identical original hosted package/renderer. Comparing the Docs result input maps shows differences in `src/main.mjs`, `build/windows.mjs` and the Docs fixture; the other listed inputs match. Guided's result does not include an executed fixture-file hash, so its attribution to the current file rests on the supplied run context plus the observed trace content, not a complete immutable harness identity receipt. I do not claim binary equivalence from timestamps or case names.

## What the observations establish

**Docs local:** before click, status is All (`value:''`), with both documents and enabled controls. After click the actual active element is `homeDocsFilter-status`; after End the page still reports All. After Enter it reports `approved`; after the single Search it reports only `doc-b`. This is consistent with the native popup committing its choice on Enter. It does not establish why the hosted sequence retained All: that run has no intermediate focus/key/value trace. Native popup routing, command-processing timing and a product event failure are still hypotheses, not a proven diagnosis.

**Guided local:** the first header pointer/click events are observed around 1473–1475 ms; a connected `structure-menu-1` and `aria-expanded:true` are observed around 1480 ms. The next menu-row click occurs around 1718 ms, followed by the expected close/focus return and a recorded removal mutation around 1741 ms. Two later menu cycles likewise open and close normally. There is no unexplained removal in this successful trace. The local result therefore does not reproduce a lost header click or spontaneous Guided redraw closing the menu.

Source inspection previously established that header menu creation is synchronous, and that `renderStructureEditor` unconditionally calls `closeStructureMenu`. This remains a potential independent ownership issue; neither original result nor this successful trace proves that call caused the hosted menu failure. The Full Mermaid loaded toast is not caller evidence. A correction must not be justified by that temporal coincidence alone.

## Honest next interpretation

The observation additions are acceptable for diagnosis within their bounded recorded scope, with the timing caveat above. Keep the original hosted results adverse, keep their identities distinct, and collect the same observations on a genuinely failing execution before assigning cause. No native input fallback, retry-to-pass, hidden setter or changed oracle was found in the reviewed patch. Local success supplies useful counterexamples and diagnostic state, **not a fix for CI**.
