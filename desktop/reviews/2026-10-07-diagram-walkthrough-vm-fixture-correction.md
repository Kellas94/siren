# Diagram walkthrough — independently reproduced VM fixture correction

Author, focused executor and fixture correction author: `/root/diagram_history_final_review`, 2026-10-07. Authorized ownership was limited to `tests/diagram-placement-ready.test.mjs` and `tests/diagram-security-config.test.mjs`. No product, generated assets, native harness, workflow or other test was edited.

## Original failure preserved and reproduced

Read root's original full-suite receipt at `evidence/workspace-surface/diagram-walkthrough-full-suite-2026-10-07T01-44-26.199Z/result.json`: ADVERSE; identity3 passed, unit1372 with1368 passed/4 failed, unchanged inputs. I did not run that full suite. Before editing, copied both exact original fixture files into `evidence/diagram-walkthrough-independent/vm-fixtures/` and independently executed:

`node --test tests/diagram-placement-ready.test.mjs tests/diagram-security-config.test.mjs`

Actual original result: **0 passed, 4 failed, exit1**. All four failed during native controller initialization at `window.SirenNativeDiagramWalkthrough.create`, before their intended placement/security assertions. The VM setup loaded the native controller without its new required production helper; the real Diagram builder already loads that helper before the controller. This is a test-context dependency omission, not evidence of a production placement or Mermaid policy regression.

## Minimal fixture changes

Both fixtures now read and evaluate the actual `src/ui/diagram/walkthrough.js` before `windows/diagram.js`. There is no walkthrough stub. Both supply a minimal ResizeObserver DOM stand-in because controller initialization observes the viewport. Placement's existing element stand-in now supports `removeEventListener` for actual walkthrough disposal. Its existing session spy additionally supplies `invalidate()` because source-read intent now retires stale renders; its refresh counter, pause result and every original assertion remain unchanged. This spy does not claim to test session invalidation semantics; the real session tests cover that separately.

The security test continues to execute the existing guided/style builders and real native render adapter against hostile init directives. It still checks strict security, no automatic start, text50000/edge500 budgets, disabled HTML labels and every protected secure key. No expectation, source payload or intentional render rejection was relaxed.

First corrected focused execution of the identical command: **4 passed, zero failed/skipped, exit0**. Files were then frozen for root's separately owned full-suite run. No full suite, build command, GUI or package execution was performed by this author. The focused security test invokes its pre-existing pure script builders as before.

## Byte proof and identities

An independent assertion script compares preserved original bytes to corrected bytes after fixture setup. All three placement test bodies through EOF are byte-identical:1882 bytes, SHA256 `c145f4ba81c69a287d7e2d3139d3e9e213e54879ab2acfc6c1eb93cc1c7c1f6c`. The security test's original render/assertion suffix through EOF is byte-identical:565 bytes, SHA256 `3962ca88de368670fb4634d5367eccf0c909d2907a941f613e972b4792115c04`. Actual proof exited0; script and output are retained as `assertion-proof.mjs`/`assertion-proof.log` in the evidence directory.

| Fixture | Original SHA256 | Corrected SHA256 |
| --- | --- | --- |
| diagram-placement-ready.test.mjs | `5860eff5b591ac1f39d6ae7b797d0f59f725b383ce361cad4bba33742531bbbb` | `1ff585ccec203c0419e6e6487c3efff089a77932c98017ee4561791bacb737ae` |
| diagram-security-config.test.mjs | `2bbab3e8e1c2e1e0dbc026a77d6ae84c013ef22026ebd6f3aeabc317469bdc3f` | `de6d273050c7f4dd1e93f240357bdcc32bc41d57a45993ff1dabe7f45c64ed4d` |

The five captured product/build inputs stayed unchanged: walkthrough, session, native controller, Diagram HTML and Diagram builder. Exact identities are in before/after manifests. Evidence directory `evidence/diagram-walkthrough-independent/vm-fixtures/`:

| Evidence | SHA256 |
| --- | --- |
| inputs-before.json | `c6fcd975391d12b9430cf2a714c3235d7d2a4fdbd1eb7a948a818ec997556a2d` |
| inputs-after.json | `0e5c8b1aa7cc89c1332b77890f50afaeb7aa7f625f289c8ac86764ee609ac799` |
| original-red.log | `3e3bd24d146dfb4ac3d42a21d7fda5370253f25a175f57d7f741a1a8b2edc932` |
| focused-green.log | `2670299901dd050734ae6ab8013bbb5f9bf1699160fcd35c81e0552bfc1078dd` |

The TDD skill guided the genuine RED→minimal correction→GREEN sequence; root explicitly reserved full-suite execution, so the focused result is not presented as a green suite. Original suite ADVERSE remains historical evidence. This report does not qualify native layout/focus, copied package, hosted CI, release or the historical Diagram Save/Attach mis-target.
