# Repeated Diagram pan adverse — independent original analysis

Author: Codex reviewer `/root/diagram_history_final_review`, 2026-10-07. Read-only source/evidence investigation plus bounded extracted-handler probes. No source/test edits, GUI/native execution, build, full suite or commit. This report preserves the original controller before the separately planned root correction.

## Repeated observation, still not a proven historical cause

I read the copied-package original `ci37579922872/desktop-packaged-evidence-original/evidence/diagram-preview/2026-10-07T06-16-53.919Z/result.json`: ADVERSE after one completed case, unchanged before/after inputs, at the original `diagram-preview.mjs:45:532` Boolean `transform.includes("45px, 25px")`. Source commit is `f45a68064772a5fc07a073963edd8679ce3bcd00`; archive SHA is `a33143804631627b06e42bd037da99d02042e0441f41710e7016912e28366dce`. No actual resulting transform or event trace is retained by this original fixture.

The original hosted development failure 375651 and this copied-package failure record the same controller `fbc7b0da…`, preview harness `17902534…`, session `dbdc13f4…`, window HTML `dbc5f16a…` and generated Diagram `78130314…`. The observation therefore cannot be characterized as development-only. It also does not establish a package-only regression. Both originally passed Zoom In 120% and Fit 100% before the failed pan oracle.

I viewed the new satellite failure screenshot. The connection lies near the viewport centre, Inspector/Filters remain in the lower-right corner, and no panel is visibly open. This does not demonstrate an excluded-control hit or prove event-time geometry. The retained state is rendered, clean, read-only, light, detached, version 1. It cannot rule out an uncollected runtime exception or input delivery difference.

## Concrete original-controller weaknesses

The actual source starts `drag` on accepted pointerdown, updates pan only on matching pointermove, then clears it on pointerup without applying the release coordinates. Its pointerup, pointercancel and lostpointercapture termination also disregard pointer identity.

My independent probe extracts the original production handler text from an exact retained full-controller copy. It supplies controlled event/DOM stand-ins; it does not manufacture browser event delivery. Actual observations:

| Sequence after pointer 1 down at (100,100) | Original resulting pan |
| --- | --- |
| Move to (145,125), then matching release | (45,25) |
| Matching release at (145,125), no delivered move | **(0,0)** |
| Last move to (120,110), matching release at (145,125) | **(20,10)** |
| Pointer 2 up, then pointer 1 move to (145,125) | **(0,0)** |
| Pointer 2 lostcapture, then pointer 1 move | **(0,0)** |
| Matching pointercancel or lostcapture, then later move | (0,0), correct termination |
| Normal move/release followed by later movement | (45,25), correct termination |

The first two bold cases demonstrate discarded final endpoint information. The foreign-pointer cases demonstrate premature cancellation of another active gesture. These are concrete conditional source defects and useful regression targets. **Neither original adverse receipt proves that one of these event sequences occurred during its failure.** The original fixture dispatches a move, but its receipt does not establish that the matching DOM pointermove was delivered to this handler before release. Coalescing/delivery is a candidate, not an established Chromium diagnosis. Multiple pointers are a robustness case, not an explanation for this one-mouse fixture.

## Geometry, focus and reset candidates

- Raw pan reads the centre once and sends three CDP events. Unlike its button-click helper, it does not stabilize or hit-test the drag target. A transient layout/occlusion change remains possible, but is not demonstrated by the snapshots. Record event targets and bounds before changing the harness.
- `attachNativePage` awaits CDP responses but does not prove a matching handler mutation for each dispatched event. Adding sleeps or polling until the desired pan would obscure this distinction.
- Main-frame focus changes across the separately opened Code/Docs windows are possible in this sequence. However subsequent actual Zoom/Fit clicks succeeded. Focus is not a sufficient explanation without an event-time record.
- `onPreview` reapplies current pan; it does not zero it. `fit()` explicitly resets pan. Walkthrough binding/invalidation does not invoke overview/fit by itself. There is no demonstrated asynchronous preview reset in these sources. Capture actual Fit/Overview click events if investigating a later reset.
- Overlay exclusions, cancellation and capture loss are separate branches. Preserve those refusal/termination behaviors while correcting endpoints. Do not apply a cancellation event's coordinates as though it were a successful release.

## Prior and latest passive successes remain separate

The older passive helper awaits an extra Runtime.evaluate after every mouse dispatch and performs layout reads in event observers. Its COMPLETE4 changed scheduling and cannot disprove a delivery race.

I also read root's new lean diagnostic receipt `evidence/diagram-preview/2026-10-07T06-24-47.167Z/result.json`: COMPLETE4, unchanged recorded inputs, genuine down/move/up with pointer ID 1 and exact (45,25) translation. It inserts no per-dispatch round trip; its observer still makes it a separate instrumented execution. The trace records capture false at each document-capture observation and no got/lostcapture event. That is a fact of this successful trace, not proof that pointer capture works or fails universally, and not evidence that either historical failure was repaired. I did not execute either diagnostic.

## Minimal next regression evidence

Existing inspected controller tests exercise annotation gesture exclusions and walkthrough geometry/lifecycle, but my bounded search found no existing `.test.mjs` exercising pointermove/up/cancel/lostcapture pan progression. Add actual full-controller regressions for no final move, partial final move and unrelated-pointer termination. Retain ordinary motion, matching cancellation/lostcapture, post-release inactivity, prepare/disposal and overlay exclusion controls. A correction should apply the matching release endpoint before clearing its active drag, and ignore foreign termination; it must not reset zoom or treat cancel as commit. Root reported starting this separate RED/correction work after my original capture; those results are not my executed tests.

Then run the unchanged original native oracle on the corrected frozen product. A successful recheck can qualify that execution and the deterministic correction; historical causal attribution remains open unless a retained failing event trace connects it. Do not relax exact 45/25, add retries or replace the original fixture merely to obtain green.

## Retained evidence

`evidence/diagram-pan-repeat-independent/` contains original-controller-fbc7b0da.js, probe.mjs, probe.log, probe-result.json and before/after input maps. All 11 captured inputs remained unchanged across my probes. Eight controlled scenarios completed with the observations above; no native suite was run by this reviewer.

- Original controller: `fbc7b0da4bea0ce02ebe19903dd4cf6521c9fd093821f9ed7bba71e30d605fbf`.
- Original harness: `179025344c089b855a2314e85f0b89b808cfa9b7f13a538f2c970bde33b0ead9`.
- Copied original adverse receipt: `b29b9fb19fdf30adc2f5000538f495cb4419dc02203d17015d66ca9e7880564c`.
- Prior hosted original adverse receipt: `8e61c17d8708e86ce3e27f90d5dac99003579354f9c21dd5f4863a731946e2f3`.
- Root lean COMPLETE4 receipt: `651d9efc5d121879751a0c675b6dd31aecb98d8b04bfabfba763967a1710c9df`.

The prior original analysis remains unchanged. No broad approval, native execution claim or historical pan/Save-to-Attach cause closure is made.
