# Native Docs export integration — independent original review

Author: `native_menu_trace_review`, 2026-10-07. **CHANGES_REQUESTED** for the concrete keyboard cancellation defect below. Separate from original formatter report `1586e787...` and its correction recheck `ca6b6cd8...`; neither is modified. Read-only evolving-source review of main/preload/UI/build source and actual tests. No input edits, renderer/package build, GUI, native qualification or full suite.

## P2 — Enter on Cancel submits the export

At `src/ui/docs/export.js` SHA256 `2b035e308c99151ae4a8fe1eda4c6afb58bc7c33ea97ca7354f087956f85816d`, the picker-level keydown handler catches every non-composing/non-repeat Enter, prevents its default and calls `submit()` without checking the event target. A keyboard user focused on **Cancel** therefore submits instead of cancelling. The same handler also submits on Enter targeted at the format select, overriding the control's native choice handling.

An independently authored controlled DOM/event adapter executed the actual UI controller. Enter with Cancel as the target produced `preventDefault:true`, closed the picker and invoked `exportSaved` once; Enter on the select did the same. Pointer Cancel invoked zero times (negative control). The defect is in the handler itself; no browser default-action simulation, actual GUI, OS chooser or storage was needed or claimed. Remove the blanket Enter handler or restrict submission to explicit Confirm while preserving native Cancel/select behavior. Root subsequently reproduced this with a real failing controlled test and removed the handler; correction verification belongs to a separate report.

Original retained result: `evidence/docs-export-integration-independent-2026-10-07/cancel-enter-original-result.json`; driver `cancel-enter-probe.mjs`; exact original controller snapshot `export-view-original.js.txt`. Eight inspected source/test hashes remained unchanged during the original probe. The result contains all exact identities and target/call observations.

## Reviewed integration boundaries

Main constructs the service with actual registry, workspace owner, saved Docs reads, projects and main-only `shell.showItemInFolder`. Its finite handler rejects PIN, selection, view-close, workspace-barrier, account and native-shell transition fences before invoking the service, and tracks the returned promise in `writes` until settlement.

The all-window barrier owner pauses/resumes/drains Docs exports, refuses quiescence unless they are idle and includes their idle state in proof validation. Native retirement pauses and refuses a non-idle exporter before view destruction. Main Close joins tracked writes after preparation; a pending export has no OS chooser and cannot independently hold a user selection dialog open. Working-view Close uses the existing all-window preparation; ordinary readonly view closure revokes registry authority, which the service checks at every asynchronous boundary. These are source-level observations; the exact real UI close/PIN lifecycle still requires later native qualification.

The preload exposes only `exportSaved` and `revealExport` on the dedicated channel. Neither method receives the private flush nonce, including while a view preparation callback is active. Shared exposure to other native roles supplies no authority by itself; the service independently requires an own single Docs grant/current main frame/read authority.

UI takes saved version/hash/project revision from `draft.getStatus()`, which remains the saved context while edits are local. Export requests contain only format and expected saved version/hash. The disclosure distinguishes unsaved edits and references-only delivery; no `draft.save` or body serialization is added. Receipts are checked for UUID, generated filename, format, document identity/content hash, byte budget and revision before showing a reveal action. Reset/prepare/dispose clear cached receipts; prepare hides the view and joins the pending export before the existing draft flush. The final native test must exercise a genuinely dirty draft and real keyboard/default-focus behavior.

Build source prepends the new controller before the actual Docs view calls it, includes that complete script in the existing Docs CSP hash and retains the closing-tag/JavaScript parse admission. The picker uses the existing themed dialog class and real select/buttons; no inline event attributes or external resource/renderer-supplied path are added. Existing theme selection still controls document color-scheme. Actual emitted CSP/hash and 480×320 reachability are not established by this source inspection; no build or GUI was run.

## Original integration input hashes

- main: `e3fe14b8ebbd86ce969268bac459779a20f8165745bc65dbb8e763576a8367b2`
- native preload: `23c4a4c6aa4d8cb6d0ca0854cd10824b2ca90a6ab263f14e4caf97be072862d2`
- Docs view: `5de401ccc609efb70928c3c5d89bcf85544106fb33cd77531a43200274f15c55`
- window builder: `bc19ab270e5e5da412feddad72296937408457f017233b7a78f041359fedc8f3`
- UI tests: `096f74d88f41bd1de1a03c6cdd3e1c6a3e7d23511eda8d39170179734cc9deb3`
- main tests: `2813d028b706e4b0da66b01296082d7f8176ba08565e27bc615da7719cd50021`
- preload tests: `1f60529f873c3231085a6996884282f604133913ce0b78144d6a285d4dc166ea`

No further concrete lifecycle/CAS/Lock defect was identified in this scoped integration reading. That statement does not approve evolving inputs, an actual build, full suite, native execution, copied package or release. The adverse keyboard finding above remains the original verdict until separately rechecked on new hashes.
