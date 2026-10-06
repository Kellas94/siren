# Diagram initial placement correction — independent verification

Author: Codex independent agent `/root/shared_workspace_review`. Date: 2026-10-06. Reviewed correction: `e228540906ee6550d6d36f0fe1752251ee31bbfc`.

This is a new correction report. The original causal report remains SHA-256 `b889a5614ee02341349bf089fd902f7a80e93b60e84f96c8ba15570ab36ede62`, and its original six-case result remains `a45995afb46bb21fd9381630c0443e45eb49c670ddfcbfda47ff13cd4ee57034`. I rechecked both hashes. I did not modify that report, its fixture directory, product source, repository tests, generated output or the native helper. I ran no Electron, packaged application, native GUI or OS-focus probe.

## Findings and disposition

Critical: none established. Important: no new unresolved finding established. Minor: none established in this correction scope.

The reviewed change closes the initial-placement mechanism demonstrated in the original isolated RED fixture. It prevents Diagram source admission and Save exposure while initial placement is unresolved, rather than tolerating a lost click. The corrected source and my isolated GREEN/control observations support that conclusion. They do not establish the exact failed hosted ordering or turn CI37413497183 into a successful run.

## Code review

`src/ui/windows/diagram-transfer.js:9–10` exposes one initial placement promise. It accepts only its own matching Diagram window and a finite attached/detached value (`:20`). It updates placement and header controls before resolving true (`:21–26`). Refused, foreign, malformed or unavailable replies do not grant readiness. Unload resolves the pending promise false (`:40`).

`src/ui/windows/diagram.js:68–71` awaits that promise before refreshing the source/session, checking paused and disposed both before waiting and after resolution. The resume path at `:109` reconnects an empty surviving view; an existing draft continues through preview without a replacement source read. Transfer polling does not invoke Diagram refresh.

`build/diagram-window.mjs:17` places the transfer script before the controller script. The build retains three scripts and exact CSP hashes; it does not introduce a script capability, fallback, pointer retry or additional source reload on manual placement changes. The Guided blur/repaint/chip-focus behavior and save receipt checks are unchanged.

This is a state-based readiness dependency. It does not declare success after a delay. A refused initial placement can remain pending until a later valid response or unload; the implementation does not promise bounded successful startup when native placement is unavailable. Existing native query bounds and polling remain separate from that readiness promise.

## My executions

I executed five repository tests:

```text
node --test tests/diagram-placement-ready.test.mjs tests/diagram-entry-build.test.mjs
5 tests; 5 passed; 0 failed; 0 skipped
```

Three tests exercise the actual transfer/controller source against VM fixtures. Two build Diagram/SVG entries into isolated OS temporary directories and inspect source order, exact CSP script identities and application-boundary exclusions. They do not run the resulting renderer or overwrite production generated files.

I independently adapted the earlier headless fixture into a new directory, `C:/Claude/SIREN_WORK/tmp-guided-placement-correction-review`. It loads the actual corrected transfer and Diagram controller in the corrected order, alongside unchanged actual Guided/Draft/identity code and shared CSS. Native IPC, Diagram rendering, unused Style/Build components and persistence remain controlled seams. Poll callbacks are captured and explicitly invoked; the initial gate is released by controlled transport completion, not by elapsed time.

The new fixture asserted thirteen lifecycle scenarios at 1008×553:

| Scenario | Independent observation |
| --- | --- |
| Initial shelf response held, all scenarios | Zero source/session reads; no diagramReady; empty source; Save remains hidden |
| Attached and detached, each with and without invalid Guided preparation/refusal/rollback | After valid admission, one pointer pair delivers one Save; clean version 2; unchanged Save rectangle across press/release |
| Later placement poll, each of those four cases | Placement changes, source/session read count stays one, saved version 2 and clean draft remain |
| Placement resolves while paused | No read or ready while paused; legitimate resume starts one read and admits the empty surviving view |
| Pagehide before placement resolution | No read or ready; a subsequent resume callback does not reconnect the retired controller |
| Unload before placement resolution | No read or ready after the late reply |
| Foreign window, wrong role, invalid placement, explicit access refusal and thrown shelf query | No placement/source readiness; transfer remains hidden; unload settles gate false |
| Missing transfer capability | No source read, no ready state, empty source and hidden Save |

The four Save cases each retain the original clipped hit-test and two-frame stability observation, followed by exactly one mousePressed/mouseReleased pair at the original point. No click retry or coordinate adjustment was used. All thirteen scenarios completed their assertions with zero browser page errors. The accepted Save receipts are simulated: one apply and version 2 describe the controlled renderer/persistence seam, not actual native project durability.

Fixture `placement-results.json` SHA-256: `c164fa94223237109ff610bb9c4d2829aec63fc262cfa7f39e284571c90ff6ea`. `probe.mjs`, `placement-fixture.html` and `placement-source-hashes.json` retain the execution recipe and inputs. Actual controller digest is `245f620eb80db10055a7ee60c2851f45ba2400376883a34a70410e8144f43612`; transfer digest is `5987bfb0c333f8ed8d3bede08cf9230efaf6d72ce02c4dbd23c54390f9dba4dd`; builder digest is `75b99df55d688797d11f760cde9a7c80945464115b4444c7eea801a5989426a6`.

## Causal and evidence limits

The earlier RED completed initial placement during Save mousedown, causing a 54 px upward shift, lost Save click and unsaved applied inline source. On the corrected source that startup state is not exposed: the controller has neither read the entity nor revealed Save while placement is unresolved. Once admission completes, the final placement/header exists before the source is made ready. The successful single-save controls and pause/retirement refusals verify that dependency without reproducing native authority.

I did not independently qualify real all-view Lock, native transport deadlines, a physical desktop, copied-package startup or hosted execution. Synthetic pagehide/unload callbacks test renderer fencing, not native window destruction. The original failed CI has no pointer/placement trace establishing its exact ordering. Owner behavioral/unit/native outcomes retain their own authorship; none is counted among my five tests or thirteen fixture scenarios. Full source/native/package and fresh hosted qualification remain separate obligations.

All headless browser instances opened by this correction fixture were closed. No approval, merge or release admission is implied.
