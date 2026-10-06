# Diagram Save and initial placement — independent causal review

Author: Codex independent agent `/root/shared_workspace_review`. Date: 2026-10-06. Scope: read-only source/artifact inspection and independently authored isolated DOM fixtures. Inspected local metadata HEAD `8ed4dc2b7b7ec8ed9a6209c4e31ccce86710e52c`, product source `066c886db7da8d441d2aa1a369b07e2fcba48f27`, corresponding hosted candidate `48912136c3dabd7a0de8c62c3c3cf3b70cb8bb8f`.

No product, generated, repository test, helper, workflow or earlier report was edited. No Electron, launcher, packaged application or OS-focus operation was run. My runtime fixture used installed Google Chrome in headless mode with Playwright, isolated file HTML and a separate browser context. Native transport, rendering and persistence were controlled seams, not actual native authority or project IO.

## Findings

Critical: none established.

**Important — Diagram admits an interactive ready surface before initial placement has settled.** `src/ui/windows/diagram.js:107` starts its source/session refresh independently of `src/ui/windows/diagram-transfer.js:33`. Source admission sets `diagramReady=true` at `diagram.js:62`; it does not await the transfer controller's native `getView`/`getShelf` result. The transfer button is initially hidden at `diagram-transfer.js:5`. When its first valid result arrives, lines 18–19 set `nativePlacement` and disclose the button. For attached placement, `src/ui/shared/shell.css:26–27` simultaneously hides the common navigation and removes its 54 px top reservation. These changes can move a Save target after pointer-down but before pointer-up. A valid hit-test and two-frame stability observation before pointer-down do not exclude that subsequent transition.

I independently reproduced that mechanism using the actual unchanged Guided, Draft, Diagram controller, transfer controller, identity controller and CSS source. Completing the controlled initial shelf response during Save's mousedown moved Save from `(720.078,66)` to `(606.453,12)` at 1008×553. Pointer-up, mouse-up and click then targeted `MAIN`, not Save. The inline source was applied by blur, but the persistence seam received zero calls: version 1, dirty true, no save verdict. This occurred both with and without the invalid-field Lock preparation/refusal/rollback sequence.

The historical hosted result has the same final unsaved state and an attached-placement screenshot. It does not retain pointer/placement events for the failed click. Therefore the controlled race is a demonstrated product defect and a concrete causal candidate for that CI failure, not proof of the exact ordering in the hosted invocation or a diagnosis of its scheduler.

Minor: none separately established in this scope. Guided's unconditional blur repaint/chip focus is discussed below; I did not demonstrate that it independently caused the hosted Save failure.

## Original evidence

Retained hosted directory:

`desktop/evidence/workspace-surface/ci37413497183/package-original/evidence/diagram-style/2026-10-06T04-29-49.324Z`

Its original `result.json` is ADVERSE after two completed cases: read-only/working Guided admission and invalid inline ID Lock refusal/rollback. The next wait failed at the first valid pending inline Save, requiring clean version 2. Diagnostics instead record version 1, dirty true, rendered true, writable Diagram state and source containing `A["Context Ș😀"] --> B[Next]`. No pending Guided input or `diagramSaveError` is recorded. Status is “Unsaved diagram · Preview only · Ctrl + S to save”. Input and package captures are marked unchanged.

Original result SHA-256: `a45de31c6dc706d74e37dbf838241db581ffe32528f80754c422e66286c00235`. Original failure PNG SHA-256: `dd76524e1c221a96a2b2186f72bed002d43663ded578a60e90c5924a1fd145cb`. I inspected that image: Save and Detach are visible, the common navigation is absent, and the new label is already in the preview. That is evidence of the final attached layout, not a record of its transition time. The initial-style diagnostics show imported colours; they do not establish click delivery or save admission.

## My controlled execution and controls

Own fixture root: `C:/Claude/SIREN_WORK/tmp-guided-pointer-review`. `placement-probe.mjs`, `placement-fixture.html`, `placement-source-hashes.json`, `source-snapshot/` and `placement-results.json` preserve the implementation, hashes, exact source snapshots and six observations. Result SHA-256: `a45995afb46bb21fd9381630c0443e45eb49c670ddfcbfda47ff13cd4ee57034`.

The fixture applies the same production pointer geometry/stability expressions and dispatches exactly one mousePressed/mouseReleased pair at the original coordinates. It does not retry, relocate the release or extend a timeout. The initial `getShelf` promise is the only controlled lifecycle timing variable. Actual transfer source handles the reply and performs the resulting DOM changes; the fixture does not directly move Save or set attached placement in the race branch.

| Initial placement reply | Without invalid rollback | With invalid rollback |
| --- | --- | --- |
| Before editing | One apply; clean version 2; Save click delivered | One apply; clean version 2; Save click delivered |
| During Save mousedown | Zero applies; dirty version 1; click on MAIN | Zero applies; dirty version 1; click on MAIN |
| After mouse release | One apply; clean version 2; Save click delivered | One apply; clean version 2; Save click delivered |

All six final observations have no page error. I separately asserted the six retained outcomes, geometry, lost click targets and source mutation. “One apply” here means the controlled persistence seam observed one invocation with an accepted simulated receipt; it is not a native durability claim.

The invalid rollback branch invokes the actual Diagram controller's registered preparation handler, observes `GUIDED_EDIT_PENDING`, resumes via its registered handler, cancels the invalid ID and edits the valid label. It does not implement the full native all-view Lock coordinator. The Diagram session/render and unused Style/Build views are inert substitutes. Therefore the fixture demonstrates this renderer lifecycle mechanism without certifying project storage, native IPC grants, previews, export, all-view Lock or package behavior.

An earlier simpler fixture completed four single-save controls at 1008×553 and 640×398 with and without rollback, retaining the normal Guided blur→paint→chip-focus behavior. They are retained as `blur-stable-controls.json`. Fixture preparation also encountered a syntax error in my transport stub and an unhit Guided field in an exploratory 480 px configuration; those are excluded from the six causal observations. The setup error is retained in `fixture-setup-adverse.json`. They are not attributed to production, and no 480 px acceptance is claimed.

## Why blur alone is not the established cause

`src/ui/diagram/guided-view.js:23` commits on blur; line 18 repaints the Guided host and focuses the replacement chip. The controlled successful and failed placement cases all execute that behavior. With settled placement, Save geometry stays fixed and the click is delivered once, including after rollback. Thus this fixture does not support blaming blur/chip focus alone.

The owner's separate successful native `evidence/diagram-style/2026-10-06T04-35-40.884Z/click-events.json`, which I read but did not execute, likewise shows valid blur/chip focus with stable Save geometry and pointer-up/click delivered to Save. It is owner evidence and cannot retroactively establish the failed hosted ordering. My causal result instead depends on the initial asynchronous placement transition happening inside the press/release interval.

## Minimum correction and validation boundary

Make initial placement admission part of Diagram connection readiness, before starting the initial source/session refresh or enabling/showing its editable ready surface. Build/load the transfer controller before the Diagram controller, expose one finite initial placement admission promise from the existing native transport, and await a valid owned role/window placement. A refused or missing placement result must remain an explicit unavailable/not-ready state rather than pretending the placement has settled. Do not set `diagramReady` merely because a source read completed first.

This should align with `src/ui/windows/entry.js:35`, where Code/Docs await `refreshPlacement()` before connecting their controllers. Initial placement readiness must not turn later manual attach/detach into a source reload: retain the existing renderer/draft, save barrier and lifecycle behavior. Reserve final control geometry while admission is pending where useful; a blanket wait or click retry does not repair the lifecycle dependency.

Validate the correction with a held initial shelf response: the ready/editable surface must not be admitted early; after releasing the valid response, a single pointer Save must commit once with fixed geometry. Keep the original native hit oracle, click count, timeouts and all unrelated source/style/Lock expectations. Also test refused placement and retirement during admission so the new wait cannot reveal or reconnect a retired private renderer.

This report contains no corrected-source GREEN, new hosted PASS or native/package approval. CI37413497183's original adverse result remains adverse, and earlier reports are unchanged.
