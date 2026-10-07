# Diagram passive Save diagnostic and preview-space correction — independent analysis

Author: `/root/diagram_history_final_review`, 2026-10-07. Read-only source/evidence review; no GUI interaction, product/test edits, build, package or native execution by this author. I personally viewed the retained failure screenshot. **This run demonstrates successful Save followed by a separate preview-height failure.** The current narrow help-text relocation addresses the observed layout pressure; its actual native recheck remains separate.

## What the original run establishes

Read outer owner receipt `evidence/workspace-surface/save-attach-passive-owner-2026-10-07T02-02-58.613Z/result.json`: ADVERSE, two original completed cases, child exit1, changedInputs[]. Root executed the separately authored passive driver on the current qualified package. Read actual `passive-observations.json` under `evidence/workspace-surface/diagram-save-attach-passive-2026-10-07/prepared-2026-10-07T02-02-58.756Z/` and original scenario receipt/screenshot under `evidence/diagram-build/2026-10-07T02-02-58.779Z/`.

The requested Save point is `(563.953125, 82.09375)`, hit true. Retained trusted pointerdown, mousedown, focus, pointerup, mouseup and click events all target `saveDiagram`. Save geometry remains x516.171875/y66/width95.5625/height32.1875 through these events. Attach begins at x690.921875, well beyond the requested point. Final observed state is version2, dirtyfalse. Original scenario source reaches its exact saved-workspace and linked-source invariance assertions before the later failing line; those assertions returned successfully in this execution. This is positive bounded evidence for Save delivery here.

The original failure is `diagram-build-original-scenario.mjs:55:309`: `diagramViewport.getBoundingClientRect().height > innerHeight * .6` returned false. The preceding imported-fill assertion passed. Thus this failure is not a Save event delivered to Attach. It also does not complete the interrupted third case or the remaining scenario.

## Observed layout and correction assessment

The screenshot is944×575. The preview starts approximately y219 and ends y559, about340px versus the original strict threshold345px. Those preview coordinates are screenshot estimates, not a separately captured exact DOM rectangle. The toolbar visibly has all controls on its first row and `Drag to pan · Ctrl + wheel to zoom` alone on the following row. The existing flex-wrap toolbar and automatic grid row consume this extra vertical space. The walkthrough entry contributes to the row's width; the separate always-visible help text then wraps.

Root's correction moves only that guidance out of the toolbar into `#diagramPanHint`, a clipped absolute1px span inside the viewport. The viewport retains tabindex0/its label and now references the hint with `aria-describedby`; its title exposes the same text on hover. The span is pointer-inert and outside the SVG/canvas; it is not `hidden` or `aria-hidden`. All existing buttons, their handlers and the original >60% assertion remain. This is a proportionate fix for the observed extra help row and preserves the guidance in the accessibility description without new focus stops or saved-diagram decoration.

This source change should recover the help row's layout space, but source inspection cannot quantify the resulting native viewport height. Preserve the unchanged original native scenario and its strict threshold for verification. Also avoid treating this one width as a general responsive-layout guarantee: narrower windows or active walkthrough controls can still cause genuine control wrapping, which may warrant separate coverage. Hover title plus described-by improves access to the compacted help but is not a screen-reader/touch usability certification.

## Snapshot and evidence identities

The pre-correction source is preserved as `evidence/workspace-surface/diagram-preview-space-original/window-f435a729.html`, original SHA256 `f435a729172a773b92e83818c987ac21d23085799839c1e0a8f74b8ef4638bbd`. The reviewed current `src/ui/diagram/window.html` is SHA256 `358eafa3281589ca38ae72aaa144e3e9b06b36dc987cc7b4b270a5d4881282d2`; root's separate owner-change record describes that transition. The original passive diagnostic ran before this correction. Source review and diagnostic therefore concern explicitly different snapshots.

| Personally read artifact | SHA256 |
| --- | --- |
| Outer owner result.json | `dc90d9031ca5ee1558e7a452830390d9a3afac18f278b9c7d1d8857b5da10567` |
| passive-observations.json | `172f61c0c4291b0b0d358498ac5981cf3a7e5ecb21220fb032e4b4bb9afed7e6` |
| Original scenario result.json | `0427e46010581374b474994f32c1d8408ce43abb948e885422a71585e2684573` |
| Personally viewed failure.png | `7fe54bbb60428528d2770af901cf3528c225ce2ac0917fbb63fe14aa6dfde37f` |

No local/native recheck of the correction is claimed here. Passive instrumentation performs layout reads and can perturb scheduling; a current successful Save does not reconstruct the historical hosted timing or establish its cause. Original hosted Save→Attach cause remains **OPEN**. Original ADVERSE2, prior qualified source/package results and any later corrected result must remain distinct. No hosted action, push, release, main merge or installed replacement is approved by this analysis.
