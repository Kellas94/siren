# Original hosted Diagram Build adverse: read-only causal analysis

Author/analyst: `/root/media_batch_review`, 2026-10-07. Original native execution was GitHub Actions, not this analyst. No GUI, build, rerun, cancel, source/test changes, push or artifact modification was performed for this investigation. This is a partial causal analysis, not an independent runtime/release approval.

## Immutable identity

Original hosted run 37552477003, original packaged-job receipt:
`evidence/workspace-surface/ci37552477003/desktop-packaged-evidence-original/evidence/diagram-build/2026-10-07T00-40-49.170Z/result.json`.

I independently read/rehashed it: SHA256 `45b80afa3fb88397f5b23739343505b5ed67cc9dde00ca2efe7cafa5ce7efa0b`. It reports ADVERSE after two completed cases, inputsUnchanged=true and packageUnchanged=true. Error: `diagramDirty === "false" && diagramVersion === "2"` was not satisfied at diagram-build.mjs:47:184, inside attach-page.mjs waitFor (30 seconds).

Original receipt package identity: integration source commit `bc42ea8bbb792038ce0f03529e68d1c0fe40b158`; ASAR 54,339,424 bytes / SHA256 `ead306f14a342dba71d2badb5156c1daea034708dc9f4df8f143b70f1ee19102`; Electron binary 245,726,208 bytes / SHA256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`.

The retained canonical/integration API records and disk_inventory identify canonical `d26f7c3b61d2a0ba66c038b8dba93877c6080498`, tree `6e13c5796890ba1a21c6fd97e8ea28b59fe26d3d`, and integration parents main `1e5472dde446657e2dbb155868e28e033c6c9c92` plus canonical d26f. I inspected the available immutable local commit `63f21362c60d86443edebfe9a4400b2f377b3f47`; the canonical d26f Git object is not available locally, so I do not claim complete Git byte equivalence. Exact hosted input hashes are the receipt's authority. My current reads of the following unchanged files exactly match those hashes: native diagram-build `c3d36cb3cd49a2b3a80fe2af170664b6f439caaf3786b4bdd4fb54d381719763`; attach-page `9adda5678dc537c070fe9dc3c8911f7efa8ba37f81637f434c61fe7b8b3fb7bb`; Diagram controller `df7ac8286ebb1ce38af4a2aca55350c2364498e19d437a6c154427d2298c02ca`. New Code-context edits were not used as evidence.

## Concrete original trace: Attach received the intended Save action

The two completed cases verify readonly/working Guided and an invalid inline-ID common-Lock refusal/rollback. The test then edits fromLabel to Context Ș😀 and calls exactly one native `working.page.click('#saveDiagram')`, followed by the failed version-2 wait.

The retained bounded guidedSaveTrace has 22 events, below its cap of 120, so this is not trace truncation. It contains **zero events targeting saveDiagram**. Its final complete pointer sequence instead targets **transferView**: pointerdown → mousedown → focus → pointerup → mouseup → click, with the Guided fromLabel blur between mousedown and focus. That blur commits the valid inline edit: the trace changes dirty false → true; version remains 1. Focus transfers to transferView, and no later fromLabel refocus is recorded in this sequence.

The Save button's recorded rectangle changes horizontally from x=656.078125 to x=516.171875 (delta −139.90625), with y=66, width=95.5625 and height=32.1875 unchanged. The changed rectangle is already visible in the transferView pointerdown snapshot, before mousedown/Guided blur. Therefore the observed horizontal movement cannot be attributed solely to this particular blur commit.

Final original diagnostics: nativePlacement attached, readonly false, ready true, rendered true, dirty true, version 1. Source contains the exact edited Context Ș😀 line and retained note lines. Status says unsaved. I personally inspected the actual retained failure screenshot: it shows the attached Diagram surface, edited Context rendered, and Detach window control. This agrees with actual transferView activation and preserved unsaved work.

The immutable Diagram transfer source explains that control's real action: in detached placement, its click invokes `sirenWindowDock.attach`; placement is later read back and the button becomes Detach window. The test does not itself request attach in this phase. **The immediate reason the Save-version wait fails is now evidence-backed: the native action activated Attach rather than reaching Save.** This receipt does not show a Save handler refusal or a save operation that lost acknowledged bytes. There is no original post-failure manifest readback here, so I do not extrapolate a disk result beyond the observed version/state.

## Why the wrong target received the pointer: still open

Immutable attach-page click first waits for stablePointerExpression (two requestAnimationFrame observations and finite active-animation checks), separately evaluates a visible clipped centre/hit-test, and then sends mousePressed and mouseReleased in separate awaited CDP calls. The final trusted/native event target is not an admission check before the test proceeds to wait for Save. A geometry change between sampled point and dispatch is consistent with the original trace and this transport boundary, but the receipt does not capture the requested x/y, event clientX/clientY, viewport size, header-child rectangles or mutation timing. It therefore cannot prove the exact geometry-change trigger or exclude a coordinate/viewport transition variant.

Relevant source paths include the asynchronous shared appearance refresh after Lock resume, header identity/layout changes, transfer placement refresh, and same-renderer native docking. These are **hypotheses**, not established causes. The first transfer placement is already awaited before ready content; the original startup passed. Blaming only the initial transfer-control insertion would therefore be unsupported. The earlier Guided blur-focus correction is not contradicted by this trace: focus remains on the actual clicked transferView, and does not return to fromLabel after its blur.

A meaningful next diagnostic, if root authorizes one, would preserve the original single-click action/oracle/deadline and passively record requested point plus final hit target immediately before dispatch, actual event client coordinates, viewport/header/control rectangles, placement/theme and bounded layout/mutation timestamps. It should distinguish a pre-dispatch layout shift from a dispatch-coordinate transition. It should not retarget a second click, invoke Save directly, press Enter, retry-to-pass, or extend the wait and call that a correction. Product vs harness responsibility for the underlying shift remains unresolved until that boundary is observed.

## Limits and preserved status

The original hosted package job remains a genuine failure. Later successful History/Typography, Diagram, development or copied runs cannot erase this receipt or explain its cause; none were used to claim closure. The exact package and source identities above bound the analysis. The original trace proves wrong control activation and unsaved-source retention, but not the underlying layout trigger, a completed Save, or a general multi-monitor result. No new runtime execution was performed.