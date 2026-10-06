# Original hosted Diagram reopen: independent read-only analysis

Author: `/root/native_menu_trace_review`. Date: 2026-10-07. Scope: original hosted run `37534183640`, packaged Diagram editing failure; historical source and retained evidence only. No GUI, product/test/build/workflow edits, test execution, or historical report edits. Later unchanged local COMPLETE4 and unrelated PIN candidate qualification do not establish a cause or fix for this failure.

## Finding

The original failure remains **ADVERSE and causally unresolved**. The actionable finding is a diagnostic gap at the UI click → main admission → new working-view boundary. The retained evidence establishes that the preceding Close save succeeded and that the test subsequently timed out observing roster growth. It does not identify which admission phase failed. No product correction is justified solely by this record.

## Original evidence and source identity

Original directory: `evidence/workspace-surface/ci37534183640/desktop-packaged-evidence-original/evidence/diagram-edit/2026-10-06T21-34-44.068Z`.

- `result.json` SHA-256: `3bb6dff328f152baa5d06c86501842583740ae4a822d01a7df9f5b7610ee7bea`.
- Original packaged evidence ZIP SHA-256 independently rehashed: `0c02640d74fe65ed06261f3b75438e81e4ea0bc4f16d0a262dd7faf17f212579`, matching the retained ZIP identity; artifact ID `11445801523`.
- Packaged receipt sourceCommit: `f725c18254443873d343b3c6ae41a156a3f374f7`; app archive SHA-256 `3f09fb5c60290ef4107db6036c9237118f1933540dbff459af9a488a80fd1a25`; runtime SHA-256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`.

The packaged commit object is not available locally. The reviewer extracted the locally available historical commit `153f760d7b7cf72e06532a57b8537ee7103d0e7c` and independently matched **all 17 available tracked receipt files byte-for-byte** to the original hosted input hashes. This includes historical main `b4de20837af0a10215924076346cadf074e64f43eac1de8b319fa11842627e0b`, test `ea2ee1d481a499f68ff47744fe5a63f70192d771d595fae3fcac912066ae26b1`, UI `2cd39ca54349f11ce57e2545448b60a946ebae30559f3f8670f7b34782e3099b`, Diagram edits/reads/coordinator and attach helper. The generated Diagram HTML is not tracked in that commit and was not reconstructed or executed. Its hash remains original receipt metadata, not independently reproduced build proof.

Historical registry, source barrier and pointer helper were also extracted from that commit and match the current files exactly. They are not separately listed in the original test's input receipt; that provenance boundary is retained. Their respective SHA-256 values are `ca13906ea2e476616004b9faf803304760f426179ac1ba565fc2738830848ac5`, `69da5d68f3c1739d40e1792082a4d07dbcd6f34461adfef137744368881784e8`, and `a55d6f22b8fb1fbb781e4d3ac32710fab622e49b1153046ebcbea57dcf4ddd8d`.

Own read-only extraction/hash receipt: `evidence/diagram-reopen-independent-2026-10-07/source-comparison.json`, SHA-256 `f2bec6ee190c13557419a5e300dc8a79cf81cf7ae556e396d7a669b40106fdc1`. Relevant historical files are retained in its `historical-inputs/`. Current main differs because of subsequent work and was not used as the original historical main.

## What the original execution establishes

The test used 300,000 lines of separate Python source. It completed two recorded cases: real Home/working admission and save preserving unrelated metadata/source, then independent saves/stale conflict/theme retention and failed all-view Lock rollback. It later reached the third case, performed separate latest review, cancelled and accepted explicit reload, captured light/dark screenshots, edited working window `a`, and clicked its Close button.

Before requesting reopen, the test observed `a` absent from the roster and the primary body's inert flag cleared. It then read the project and passed exact equality against expected flow source `flowchart TD\nA[Saved by Close]-->B`, with native version 3 and all unrelated fields preserved. Consequently this particular timeout is downstream of the asserted Close save; it is not evidence that the Close save lost data.

The failure is exactly `UI condition not met: ... r.ok&&r.views.length>8`, at `openWorking(reader)` on test line 48. The helper had taken the pre-click roster IDs, clicked `#openWorkingDiagram` on the original read-only flow reader, and waited up to the existing 30-second driver deadline for total count to exceed eight. It never reached attachment/readiness/source verification of a reopened window.

Failure diagnostics retain five Diagram targets: three read-only readers (flow versions 2 and 1, other version 1), working flow version 3 with the exact saved-by-Close source, and working other version 2. These are consistent with retained readers plus surviving working windows, not a retained newly opened working copy. They cannot exclude a short-lived window that was discarded before collection. The original reader screenshot `view-failure-2.png`, SHA-256 `d591607ddc21389682dcac648b61f2dc2be82867a1cf3879e8dec9422d6fe0c5`, shows the read-only Original flow with an Edit working copy button and normal read-only status at later failure collection. It does not show click-time state or prove event delivery.

The runtime tail records the expected earlier failed preparation, then a subsequent nine-view preparation reaching `prepared` after about 2474 ms. It contains no per-open admission/result trace or renderer click receipt. The error/result and screenshots preserve the failure, but do not supply a main refusal code or a causal event ordering at reopen.

## Historical contracts and unresolved branches

The renderer's open-copy function silently returns when paused/disposed; otherwise it awaits the IPC result and displays a generic failure for a returned refusal. The test's pointer helper observes stable geometry and hit-tests the control before dispatching one pressed/released mouse pair. Those checks are meaningful but do not record that a trusted click reached this handler, its paused state when delivered, or the eventual IPC outcome. A later normal status cannot establish that outcome because refresh/preview can repaint status.

The historical main handler first refuses invalid caller/working scope or active PIN/selection/close transition, then creates a registered Diagram, reads/adopts its working context, sends ready, and shows it. Failures can discard the created view and return ACCESS_REFUSED. Registry open additionally checks a frozen roster, policy/epoch/native identity and post-create validity. The retained failure cannot distinguish early gate refusal from a factory/admission failure or subsequent discard.

Working native Close prepares all views, releases the roster/owner, closes the target, sends resume to survivors, and clears `writes.viewClosing` in finally. The test's closure predicate checks successful roster response, target absence and primary inert=false. Historical main refuses listViews while `writes.viewClosing` is true, so the successful response already excludes a still-active close flag at that observation; the pre-reopen roster snapshot also returned views. The predicate does not attest the surviving reader's exact resume delivery. This is an observation boundary worth tracing, **not proof of a close/reopen race** or evidence that a simple wait for the close flag is the missing fix. The source ordering alone does not establish a causal race.

The original read-only reader retaining version 1 is not itself a stale-write admission violation: openWorkingCopy submits no stale source/version, uses its genuine entity identity, and reads the current owner entity during new working admission. NativeDiagramEdits validates the current grant/entity/project and the owner result. The 300k Python source is separate from the short Mermaid text; this timeout contains no RangeError, source budget refusal or source-integrity failure. It must not be conflated with the separately reproduced bundle base64 parser defect.

Finally, total roster growth is only an indirect new-window oracle; an unrelated creation could satisfy it and a brief create/discard could escape polling. That limitation is real, but neither event is proven here. Preserve the original action and oracle while gathering diagnostics before deciding whether any oracle amendment is warranted.

## Minimal bounded diagnostic recommendation

For a subsequent separate diagnostic run, preserve the exact single click, Close/reopen sequence, 30-second deadlines and assertions. Do not retry the mutation, invoke openWorkingCopy directly, delay admission artificially, alter paused state, or convert the historical failure to success.

1. At the existing pre-click, post-click and timeout points, retain a capped roster of IDs/roles/entities plus target lifecycle events, caller URL/target ID, body inert, document visibility, button hidden/disabled/geometry/hit identity and status. Record only bounded public fields, not document/source content.
2. Add a passive capturing click/pointer observer on this existing reader control to record target ID, `isTrusted`, monotonic time and contemporaneous inert/visibility. It must not prevent/redispatch events or wrap/replace the bridge. This separates a delivered click from a transport-only pressed/released acknowledgment.
3. If a product diagnostic amendment is authorized after the freeze, emit finite main-only Diagram-open stages: received, gate-refused, registered, admission-refused, ready-sent/shown, discarded and final result. Include a bounded correlation tag, caller/opened window IDs, method, finite refusal code and boolean transition/roster state. Add close prepared/released/resume-sent/finished stages under the same bounded tracing. No source, PIN, plaintext, flush nonce, native error text or path authority should be logged. Preserve existing authorization and return behavior.

The next retained failure can then distinguish missing click delivery, an early close/roster gate, failure during current-entity admission, and a created-then-discarded surface. These recommendations are not implemented in this review. Original hosted Diagram reopen remains unresolved and adverse.
