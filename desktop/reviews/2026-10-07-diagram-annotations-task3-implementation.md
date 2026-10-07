# Diagram annotations Task3 implementation record

Author and focused-test executor: /root/media_batch_review, 2026-10-07. This is my implementation record, not an independent approval of my own code, native/package/CI verdict or release approval. Root owns Tasks1/2 and the shared metadata contract, native scheduling and generated build. I edited only the authorized Task3 controller, wiring and fixture dependencies; no GUI, general build, commit, workflow, installed application or user data operation was performed.

## Result and actual scope

Inspector and window-local Filters are wired into native Diagram. Two compact controls live in bottom-right canvas overlay chrome, preserving the original preview toolbar and canvas height. Inspector uses exact current admitted semantic IDs and bounded safe captions; metadata fields are explicit Apply to draft / Cancel, with Save remaining the existing domain CAS transaction. Risk/control/evidence/reference are progressively disclosed; Owner/Status/System/Frequency remain visible. The actual readonlyFor callback distinguishes a read-only view from a working view temporarily blocked by another editor. Status explicitly remains an annotation, not release approval.

The root-owned shared canEditField contract makes unsupported existing managed values immutable. Those individual controls are disabled, valid sibling fields remain editable, and the notice says retained unchanged; cannot edit here. Existing overlength strings receive a bounded display preview and explicit explanation, never a stored rewrite; opaque objects/references are not dumped into DOM. Valid and pending strings remain exact. Inputs have no browser maxlength that could silently truncate a new overlength paste; Apply validates strict finite limits/status/well-formed strings before delegating root draft.editMetadata.

Filters implement literal AND across fields / OR within fields for Owner/Status/System/Frequency/Class, actual finite facet counts, Reset, zero matches and local state per controller. No missing-value sentinel collision, authored-view mutation or hide/lanes/badges/default-view claim. Edges remain visible. The controller captures one diagram snapshot per repaint rather than cloning once per facet. Current targets are bounded to250 IDs/eight groups and200-character semantic IDs; excluded/capped targets are reported. Labels/facet strings are bounded and assigned through textContent/value rather than HTML.

Dimming is a removable external style element scoped by generated numeric child-position paths below #diagramCanvas>svg; no source identifier, metadata text or source CSS is interpolated as executable CSS. Only finite baseline opacity multiplied by0.16 is authored. No SVG attributes, fill, border, text, filter or other source styling is written. Nested unmatched groups are dimmed once; semantic containers with matching descendants remain context and are reported partial. Inline opacity!important is left untouched/reported; finite computed-opacity readback reports stronger stylesheet precedence or unsupported projection as partial. Reset/invalidation/disposal removes only the owned style element.

Pending Inspector guard never autosaves, applies or cancels. Source edits, history, Save, Refresh/replacement, presentation transitions, editor-mode changes, copy opening, context Style/Build actions and saved-version auto-refresh respect that pending state. Source/error/appearance/history/Refresh/prepare/dispose retire targets and CSS synchronously. Common prepare hides/inerts the whole view and pauses session, returns INSPECTOR_EDIT_PENDING without draft.flushView when guard refuses; rollback resumes retained fields. Toolbar/control pointerdown preserves pending editor focus; overlay controls/panels do not start canvas dragging. Filter changes exit the active Walkthrough, leaving finite browsing available on current targets. Export remains full saved SVG; module and controls are not embedded into isolated vector/Audience render entries.

## Actual RED / GREEN and retained adverse observations

- controller-red.log: nine original actual feature assertions failed because the controller did not exist. Original missing-feature expectations remain represented in the current tests.
- controller-first-green-attempt.log:8/9 passed; my event stand-in copied the event object so its original defaultPrevented assertion was wrong. The stand-in now returns the dispatched object. This was a harness correction, not a product correction; the adverse log remains.
- window-red.log: actual mount/wiring tests failed before integration. window-and-dependencies-first-adverse.log retained7 failures: six existing VM fixtures lacked the newly required actual module, and my new layout assertion expected undefined although its Element stand-in initializes hidden=false. The new assertion was corrected to false; no existing assertion was relaxed.
- Existing placement/security/Walkthrough fixtures now load actual annotations plus the actual shared contract and minimal DOM stand-ins. Every original assertion line is byte-exact. Complete original placement and Walkthrough test bodies are byte-exact; security's setup is inside its test callback, so only setup changed and its original assertions remain exact. Originals retained under originals/.
- protected-opacity-coverage-red.log proves silently excluded long IDs; follow-up first green attempt exposed that the unit CSS stand-in did not apply authored CSS when testing computed readback. Its finite selector/opacity adapter is explicitly labelled unit-only; genuine browser cascade remains native acceptance.
- snapshot-allocation-red.log proves16 diagramFor calls for a three-node repaint; corrected test proves one captured snapshot.
- unsupported-immutable-red.log proves unsupported managed controls were editable; corrected controls use the stricter actual shared API. Root retains its separate independent/model adverses.
- bounded-preview-overlay-red.log proves unbounded retained display and extra toolbar controls; corrected tests verify bounded preview without source change and overlay-only control placement.
- context-truth-red.log proves working context with pending editor fields was labelled read only; actual context callback now distinguishes those states.
- Final related-overlay-final.log:131 tests passed,0 failed/skipped/cancelled/todo, approximately4.945seconds. All12 captured sources/tests/helper inputs match before and after. The earlier128-test receipt/log remains separate.

Related tests cover the new controller/window integration and existing placement, security, Walkthrough, style, history, draft, session, Guided, Build, metadata contract/draft/validator, domain owner/validation, saved SVG owner and public presentation projection. These are focused Node unit/VM suites, not a full global runner or a native behavior qualification. JavaScript syntax was also checked using node:vm.Script.

## Limits / next genuine qualification

No native screenshots, pointer hit tests, actual browser CSS cascade, physical monitors/DPI/IME, new generated/CSP entry, package copy or hosted workflow was executed by me. The external CSS adapter in controller units is finite simulated computed-style behavior; it does not replace the root-scheduled actual native projection/source/SVG checks. The overlay avoids adding controls to the prior toolbar structurally, but the original944×575 real geometry oracle still needs actual execution. Saved export/public privacy behavior is covered by existing service units and absence of module injection; new end-to-end Inspector/filter/native export proof is pending. Two-controller isolation is unit tested; actual two-window CAS/Lock/dock behavior remains native qualification. No capacity increase, hidden parity completion or false release claim.

## Exact inspected final input bytes

| File | SHA-256 |
|---|---|
| src/ui/diagram/annotations.js | 2e64c0dc563e62f0c4d7ef388aaba46e7deb3c777d1709b104715b937fe01c57 |
| src/ui/windows/diagram.js | 6ee9ec6914bb6a2c5027fbb3b50416461d973b026446127839329cdb676e0680 |
| src/ui/diagram/window.html | dbc5f16a49c159cff4ccef60cf3c04743825ab1766411674c14715719395bc7c |
| build/diagram-window.mjs | 21ebf8ca538a8076332a866cc090e023a890ce64c93f655a64e3c80c863422bf |
| tests/diagram-annotations.test.mjs | a2ffb3c88f479c584319fff497395e59567826b445fc2dab44d374264e3af274 |
| tests/diagram-annotations-window.test.mjs | c408ae28ae74dd55efe50a3d9d43f9d90b5ad1bdd203cf537fe1fb1c674f2133 |
| tests/diagram-placement-ready.test.mjs | 86dc0194ef5b92813ff71ef0889512f595c8b10fc6791703b046d48ba635375d |
| tests/diagram-security-config.test.mjs | 5c9fb8733a8b4606dead6196959dc4b26f091396d9b340755a57c8088723a817 |
| tests/diagram-walkthrough-window.test.mjs | 21699cfe3ce92308c2f08691a913c9859e18c4c384a3db079dc63c34f3bf2629 |
| src/documents/diagram-metadata.mjs | 24e4cf66628cc7455b29db7f01853bde262b0c4a98ac93668d5e708b1ccbd848 |
| build/diagram-metadata.mjs | 8ed4e8446394f4fbf1c226204148d0a604b9c5f8c95af0d19988e16802f3ea91 |
| src/ui/diagram/draft.js | 3f39f927198993e1fc31de6a7ab12f35a5a00ee77833522b61e60a4574957699 |

Receipt: evidence/workspace-surface/diagram-annotations-task3/final-receipt.json SHA256 cf6d41bad7f4fa0cd44921697dc235bdbf2a0b15a8c06678fd922eab84074663. All original report/evidence artifacts remain unchanged. Final source held for root review/build/native scheduling after this record.
