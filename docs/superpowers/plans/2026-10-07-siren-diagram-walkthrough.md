# Native Diagram Walkthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The user already approved inline coherent implementation with separate independent reviews; continue without a new routine approval gate.

**Goal:** Restore the useful legacy Walk through feature in the existing native Diagram preview without adding permanent clutter or modifying diagram content.

**Architecture:** A small view-local controller consumes the current sanitized SVG's admitted semantic targets. It exposes bounded Previous/Next/Overview controls and a pointer-inert HTML overlay outside the SVG. The existing render session receives synchronous invalidation so obsolete in-flight renders cannot restore walkthrough targets during debounce. Existing source/style/history/save/Lock/dock authority remains unchanged.

**Tech Stack:** Existing vanilla JavaScript, native Electron workspace, current Mermaid renderer, shared theme tokens. No new dependency or privileged IPC.

**Spec:** Approved `docs/superpowers/plans/2026-10-06-siren-workspace-ui.md`, frozen `desktop/baseline/R78.html` walkthrough behavior, `desktop/reviews/2026-10-07-next-desktop-parity-batch-analysis.md`, and genuine `desktop/reviews/2026-10-07-diagram-walkthrough-independent-preflight.md`.

## Global constraints

- Existing target adapter admits at most 250 semantic IDs; one semantic ID can own several SVG groups. Use only actual connected groups belonging to the current SVG, with finite geometry/label work. Show unavailable for unsupported/empty renders.
- Walkthrough is readonly-safe browsing. Never mutate SVG style/attributes, draft/source/node metadata/history, project versions/hashes or exported vector output. Keep decoration in a separate HTML overlay with pointer-events none.
- Source/style/history/Refresh intent, render error, hidden preview, preparation and disposal synchronously retire target authority. A connected old SVG is not proof of current content. Pause clears navigation before any asynchronous flush.
- Preserve pending Guided/Build/Style input exactly; browsing must not commit, discard, save or steal editor input. Keyboard shortcuts apply only while walkthrough controls have focus, and must yield during composition.
- Shared theme tokens, visible focus, bounded current label/count and reduced-motion-safe navigation. Keep resting UI as one entry; active controls replace that same area.
- Original Diagram hosted Save/Attach mis-target remains OPEN. No release/main merge/installed-app replacement; do not push while hosted Code run 37556787785 is active.

## Review focus

1. Old renders resolving inside the 120/250ms debounce gap: invalidate at edit intent, not only onPreview/onError.
2. Multiple groups/long Unicode labels: count semantic nodes once; safe textContent only; finite union geometry.
3. Resize, attach/detach, title padding and CSS scaling: overlay/focus use current viewport geometry and preserve manual pan/zoom semantics.
4. Pending form fields, readonly and independent windows: traversal does not change any local/durable edit state.
5. Export and Lock: overlay never enters SVG output or native persistence; retired targets cannot reappear after stale async completion.

## Task 1 — render invalidation and bounded walkthrough state

Files: modify `desktop/src/ui/diagram/session.js`; create `desktop/src/ui/diagram/walkthrough.js`; extend `desktop/tests/diagram-session.test.mjs` and create `desktop/tests/diagram-walkthrough.test.mjs` following existing VM/controller fixtures.

- [x] RED: stale in-flight render resolves after synchronous edit invalidation; no preview callback accepted. Verify pause/dispose/read refresh fences still hold.
- [x] GREEN: add public session invalidate() that advances generation while retaining selected context; no extra read/save authority. Wire controller lifecycle next task.
- [x] RED: bounded semantic target admission, duplicates/multi-group IDs, current-node stepping, unavailable/retired targets, callbacks during disposal and no input/content mutation.
- [x] GREEN: finite view-local controller with bind/invalidate/start/step/overview/updateGeometry/pause/resume/dispose; own selected state and safe captions. Do not introduce a source cache or new parser.
- [x] Run targeted tests and retain actual result.

## Task 2 — compact themed controls and lifecycle integration

Files: modify `desktop/src/ui/diagram/window.html`, `desktop/src/ui/windows/diagram.js`, `desktop/build/diagram-window.mjs`; add/extend relevant window/build/controller tests.

- [x] RED: no walkthrough globals in vector/presentation surfaces; native asset order/admission, initial/active/unavailable markup and keyboard scoping.
- [x] GREEN: mount one resting Walk through/count entry and active Previous/current/Next/Overview in the preview toolbar, with live status and clear labels. Add a separate viewport overlay; existing save/dock header is unaffected.
- [x] GREEN: bind actual current render targets and sanitized labels. Invalidate synchronously in every source/style/history/Refresh/render-start/error/hide-preview/prepare/dispose path, including appearance-driven rerenders.
- [x] GREEN: derive finite focus geometry through current transformed rectangles/viewport scale; keep overview on existing Fit. ResizeObserver/dock geometry updates must be bounded and cleaned up; no forced continuous animation.
- [x] Verify draft/history/colour/live-SVG invariance and pending-field preservation; vector builder excludes walkthrough; actual export while active is not executed. no programmatic input writes or global arrow interception.

## Task 3 — genuinely authored review and actual native evidence

Files: create `desktop/tests/native/diagram-walkthrough.mjs`; retain distinct authored review/observation reports in `desktop/reviews/`; update `.github/workflows/desktop-verify.yml` only after actual harness qualification.

- [x] Obtain separate independent source review, preserving original findings before corrections.
- [x] Independently authored native probe: readonly Unicode flowchart and supported state targets; pointer/keyboard start-next-previous-overview; separate windows; source/history/error invalidation; exact imported colours/project/source bytes; pending fields; attach/detach and common Lock. Use original trusted input and real byte oracles, not direct controller invocation.
- [x] Retain original adverse result if any, diagnose separately, then correct product or proven transport error with separate evidence. No retry-to-pass or expected-byte relaxation.
- [x] Inspect actual representative light/dark/named-theme screenshots; explicitly distinguish from full-theme/physical-monitor certification.

## Task 4 — coherent source and copied-package qualification

- [x] Fresh bounded build, appropriate tests/full suite and input hashes; source committed884fc7a3578fa65d61b99b9d80efdc2622aff2b8 only after actual scoped qualification.
- [x] Separate portable preview, exact296 admitted files/helper/runtime, unchanged original native Walkthrough8 plus history/typography8 and shell/core regression checks. Capacity/performance/physical-UX limits retained in owner qualification.
- [x] Retain owner qualification and genuine authors. Previewcdea1cbf ASAR54367258B/5041e57138ce9d56360afac8d1e65bdb5c705fe0a12a520992e2134fe337de07; all copied inputs unchanged. Owner JSON/MD records full1375, actual development8/copied8 and original adverse provenance.
- [ ] Update resume points and guarded canonical sync: local base remains4f8d4a0e57425be4f16a6df325b1ac40c2a4b630 against canonicaldf7acd653ce431480d6001b7e920a8e1b8d142c4/tree34664e8919cf1417c8799f1499c44c59a372a3ef/1776blobs. Original hosted Code final evidence is preserved; new hosted verdict remains pending.

Not covered: node metadata Inspector/Filters, changing diagram semantics, arbitrary grammar support, public presentation editing, the historical Save mis-target cause, complete decorative parity, source-size maximum or physical-monitor certification.

## Actual implementation ledger — in progress, not qualification

- Owner observed first session RED (invalidate absent, 1 failed/5 passed), then GREEN6 after synchronous generation invalidation. Controller first RED5 absent factory, then GREEN5; window integration first RED3 absent mounting/build asset, then GREEN3. Valid pending input focus guard had separate RED1/GREEN1. Actual latest targeted27 tests all passed, including real draft/history/Build/Style regressions; these are controlled unit evidence, not native approval.
- Initial fresh renderer Diagram735d292ed003bbba56c12fc347e8187520e543709cd8b38b6bbf2659ba742b21, exact24 installed files. Genuine independent original native harness246a5dcf1dddf67dbcd8277db85aa4700ac0283c2259c65bd014456d4cad9fdd FIRST execution ADVERSE0, receipt da70b24ebdf22c530e8de926fc4f7fd4e38c5d9e89f0c6687e73f40003f29a53. Actual caption concatenates visual wrapped words (`ÎnceputȘ😀`). Original source/colours and pre-failure count/Start observed; no completed case or later field/Lock approval. Original author report c847dc288790d609a47ad08b7ba469fdeeddfdbab3ae1158db3d574582a62732 remains separate and immutable.
- Subsequent caption correction preserves visual word separators; genuine independent ORIGINAL review58c5384f and separate recheckb9be3f38 retained. Actual final native8 COMPLETE e2a19356 on Diagram a5310111 and frozen harness2761b06f; earlier native adverse0/diagnostic/adverse1(CSS serialization oracle)/adverse6(hidden legacy theme selector) retained with separately authored correction reports. Root personally inspected final light/dark/attached screenshots. No actual vector-export execution or physical-monitor certification.
- Original fullsuite at01:44:26 ADVERSE: identity3 passed, units1372 with1368passes/4failures, changedInputs[]. Independent reproduction confirmed missing real Walkthrough dependency in two VM fixtures. Genuine focused RED4 and GREEN4 retained; original placement test bodies and security assertion suffix remain byte-identical. Both fixtures now load actual production module, no Walkthrough stub. Report79669d5e owns exact changes. Fresh final suite at01:52:27 running; copied-package/new hosted qualification pending.
- Hosted Code37556787785 is FINAL FAILURE, original full retention and root23-record readback preserved. Independent analysis showed native Python source-read fixture omitted explicit language. Sole18B metadata declaration added without source/oracle/deadline changes; actual source-read6/rollback7/Home11 COMPLETE, genuine rechecka499bd58. Do not relabel original hosted result or claim prior focused development Code ran (it was skipped).

- Final full suite at01:52:27 COMPLETE: identity3 + units1372 =1375 passed; zero failures/skips/cancellations, changedInputs[]. Owner precommit readback validates all frozen inputs and distinguishes later fixture-only changes from original development native8. Source commit/copied-package qualification follows; original adverse suite remains unchanged.
