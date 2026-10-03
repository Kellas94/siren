# Current native diagram mouse audit — 2026-10-03

Author: `diagram_native_resume`. Current development Electron app, SIREN v1.131.0, renderer viewport 1424 × 895. Actual CDP pointer input through the unchanged `desktop/tests/native/drive.mjs`; synthetic projects and fixture PIN 4826 only. Product source, build inputs, generated output, package files, driver, and Electron executable were read-only during this audit.

**Decision:** preserve the strong flowchart authoring path, expose the sequence builder as a separate capability, and put C4/code-led starters in an explicit secondary creation group. The evidence supports capability labels and honest entry paths; it does not justify deleting diagram types or describing every non-flowchart preview as non-interactive.

## Accepted flow and observations

1. **Owned native entry — healthy after launch qualification.** A fresh synthetic fixture opened the current app and its existing flowchart. The initial entry screenshot was taken before the tour appeared and before saving settled; it is retained as startup evidence, not accepted as a final stable screen. The tour was dismissed with an actual pointer click. The type selector was set by DOM change solely as fixture preparation; New starter and its confirmation were actual pointer clicks. No claim is made that the native select popup was mouse-tested.

2. **C4 starter — renders, but has readable-layout problems.** The exact valid built-in C4 source rendered Auditor, SIREN, ERP, and both relationships. At the fitted 71% view, relationship labels collide with the SIREN and ERP boxes. The view provides a code-first type description. The preview contains session-level implementation copy: “Diagram font weight changed the test drawing for C4 context diagrams this session, so it is back in the Style panel.” That copy is difficult to interpret as a user-facing capability explanation. The generic SVG ID still begins `t_flow`; the ID is not a diagram-type oracle.

   ![Fresh C4 source rendered with overlapping relationship text](C:/Claude/SIREN_WORK/portable/desktop/evidence/diagram-mouse-audit-2026-10-03/resume-native-03/06-c4-settled.png)

3. **C4 Auditor gestures — source lookup and viewing commands confirmed.** The painted Auditor name was hit-tested before each click, double-click, right-click, and 36 × 24 px drag. Every action has an independent before/after source SHA-256 and UI receipt. All four retained the exact source hash `9f163a6c653f26435e7dda0ae50a6356ecb1782c3007ad0bfb0e64c80efcbc04`. No inline rename field or block inspector opened. Click/double-click reported Auditor as line 3. Right-click showed Go to “Auditor” in the code, Edit as code, Fit to page, Actual size (100%), and Export PNG. These are confirmed commands visible in the menu; their execution was not tested. The small free drag did not change source. This does not test every drag destination or imply C4 has no interactions.

   ![C4 Auditor menu and source-line feedback](C:/Claude/SIREN_WORK/portable/desktop/evidence/diagram-mouse-audit-2026-10-03/resume-native-03/07-c4-rightClick.png)

4. **Flowchart positive control — actual structural label edit confirmed.** Clicking Process step opened Block B’s inspector. After dismissing it, double-clicking the painted node opened `canvasInplace` with the existing label selected. Native text insertion and Enter changed `B[Process step]` to `B[Owned mouse audit step]`, with source SHA-256 changing from `624e368e37c28a2949edc147983db3a57fdc3d5185195df02f301862d8fda62f` to `39d40e446300413106c90752195dcc5b22b060fd53fb0d9ed99ea44bafe06d9c`. A subsequent fresh SVG displayed that exact label. This distinguishes a completed edit from selection, an open editor, or zoom. No connected-block splice, connect-handle drag, deletion, or sibling reorder was attempted.

   ![Flowchart double-click opens a label editor](C:/Claude/SIREN_WORK/portable/desktop/evidence/diagram-mouse-audit-2026-10-03/resume-native-03/12-flowchart-doubleClick.png)

   ![Exact edited flowchart label rendered](C:/Claude/SIREN_WORK/portable/desktop/evidence/diagram-mouse-audit-2026-10-03/resume-native-03/16-flow-edit-confirmed.png)

5. **Sequence — dedicated builder route visible.** On the valid Client/Service starter, the tested Service actor label did not directly edit source through the four gestures. Its right-click menu offered Open the Sequence builder and Edit as code. Source lookup correctly reported that Service matches three lines, rather than guessing one. The dedicated builder entry is evidence for a separate guided capability; a participant/message commit through that builder was not tested.

   ![Sequence menu offers its dedicated builder and explains ambiguous source lookup](C:/Claude/SIREN_WORK/portable/desktop/evidence/diagram-mouse-audit-2026-10-03/resume-native-matrix-04/04-sequence-rightClick.png)

6. **State, class, ER, and block — mixed preview capabilities.** The State Submit transition and class places relationship were tested, not the complete node/attribute edit surface. Their source remained unchanged. ER’s places click resulted in an ORDER selection and block inspector; the inspector said text can only be changed in Mermaid code and offered styling/metadata sections. Block Inputs click and double-click opened its inspector with the same code-only label explanation. Opening these inspectors is not an edit, and it prevents a blanket “non-flowchart diagrams cannot be inspected” conclusion. Colour, shape, metadata, documentation, and comment commits were not attempted. The ER screenshot also shows a low-contrast ORDER heading inside the selected entity; this is an observed readability risk, not a full contrast measurement.

   ![ER ORDER inspector separates code-only text from other available sections](C:/Claude/SIREN_WORK/portable/desktop/evidence/diagram-mouse-audit-2026-10-03/resume-native-matrix-04/07-er-click.png)

7. **Mindmap — source-led preview route confirmed for the root label.** TB reconciliation click/right-click produced line 2 feedback and a menu with Go to … in the code, Edit as code, Fit to page, Actual size, and Export PNG. The tested root gestures did not open an inline rename editor or block inspector and did not change source. Other branches, Guided line drag/reorder, and palette style commits were not tested.

   ![Mindmap root menu routes to source](C:/Claude/SIREN_WORK/portable/desktop/evidence/diagram-mouse-audit-2026-10-03/resume-native-matrix-04/14-mindmap-rightClick.png)

8. **Cleanup and input integrity — healthy.** Owned native PID 1652 (focused audit) and PID 8844 (starter matrix) were each matched to the exact repository Electron executable before cleanup. Both result files confirm `processGone: true`. The focused run independently hashed 67 distinct source/generated/package/baseline/driver/executable input files before and after. The matrix recorded 70 hash entries, representing 67 distinct paths after separator normalization. Both report no changes. Existing unrelated Electron processes were left alone. The exact accidental nested `desktop/desktop/.../audit.mjs` was resolved within its owned directory, verified to contain zero bytes, and removed; meaningful earlier evidence was preserved.

## Bounded starter matrix

The already-dispatched matrix used each of 19 existing valid built-in starters. For each listed target, it sent click, double-click, right-click, and a 32 × 25 px free drag. It recomputed the target hit point before each gesture and saved a separate before/after source/UI receipt and screenshot. All 76 gestures retained source. No text was committed during this matrix; the separate flowchart positive control above establishes actual editing. Small free drags do not qualify connector splicing, valid drop targets, or Guided line reordering.

| Starter | Exact selected candidate | Narrow observation |
|---|---|---|
| Flowchart | Start | Click opened inspector; double-click focused `canvasInplace`. |
| Swimlane | System | Target is a painted group label; no source edit established. |
| State | Submit | Transition label; no node style/metadata commit tested. |
| Sequence | Service | Builder route visible in right-click menu. |
| Architecture | Web app | No source edit established for this label. |
| C4 | Auditor / person description group | No inspector or inline source edit; focused Auditor-name run is stronger evidence. |
| ER | places | Click opened ORDER inspector; code-only label message visible. |
| Class | places | Relationship label; class header/attribute editing untested. |
| Block | Inputs | Click/double-click opened inspector with code-only label explanation. |
| Gantt | 2026-01-05 | Axis date, not a task bar; no task editing inference. |
| Timeline | Planning | No source edit established for this label. |
| Kanban | To do | Column target; card movement/commit untested. |
| Journey | Customer | Actor label; task editing untested. |
| Mindmap | TB reconciliation | Source lookup/menu confirmed on root label. |
| Ishikawa | Process | Painted group label; no valid structural drop tested. |
| Requirement | <<satisfies>> | Relationship marker; requirement body editing untested. |
| Git graph | main | Branch label; branch manipulation untested. |
| XY | Unreconciled balance by month | Title; series editing untested. |
| Pie | 42% | Percentage label; slice/data edit untested. |

Only the screenshots displayed above, plus the fresh State/class/block rendered screenshots, were individually opened and accepted for visual interpretation. The remaining matrix screenshots are retained raw observations, not a complete visual/accessibility audit of those families.

## Evidence qualification and retained failures

- Earlier `diagram-mouse-audit-2026-10-03/01–03` captures and PID 45824 receipt belong to the interrupted predecessor. Its receipt reports cleanup and unchanged 52 inputs. They were supplied as prior evidence by the coordinating agent and preserved, but are not claimed as this author’s captures or used to inflate fresh coverage.
- `resume-native-01/result.json`: the sandboxed Electron launch exited before attachment with an install-directory ACL/AppContainer fatal. This is an environment launch qualification failure. No ACL change or product sandbox-disabling flag was applied. The same normal driver launch was then approved outside the tool sandbox.
- `resume-native-02`: stdin closed after entry capture, so the harness cleaned up PID 5700 normally. It contains no gesture evidence and is not counted as a completed mouse audit.
- `resume-native-03`: a 30-second wait wrongly required a C4 SVG ID without the `flow` substring. C4 actually rendered correctly under a generic `t_flow` ID. The error is retained in `lastError`; the subsequently read SVG labels/source and inspected screenshot qualify the rendered C4 independently. This harness assertion failure is not a product rendering failure.
- The predecessor `matrix.mjs` had an illegal awaited default parameter and had not produced matrix results. The new owned ignored harness repaired its own copy before launch; no tracked tests or native driver were modified.
- **Storage oracle invalid:** these harnesses enumerated `Object.keys(localStorage)`, which returned an empty object under the native adapter. The recorded storage hashes are therefore hashes of `{}`. They do not witness diagram style, metadata, document, zoom, selection, or persisted state. Any earlier statement that those byte-identical values prove saved-state invariance is withdrawn. `independent-state-summary.json` records null persistent diagram hashes because no real storage key was captured. The valid action oracles are exact source hashes plus the fresh visible/DOM state. No retrospectively manufactured disk before/after oracle is substituted.
- Source lookup feedback, a selection ring, inspection, an open inline editor, and a completed source edit are reported separately. A source hash alone cannot prove that no style/metadata edit occurred.
- Renderer captures do not qualify native titlebars, physical multi-monitor behavior, assistive technology, all keyboard routes, responsive layouts, numerical colour contrast, persistence after relaunch, or exports. No full WCAG conformance claim is made.

## Home/Diagrams planning implications

1. Present Flowchart as the confirmed visual-authoring entry. Name its concrete capabilities: blocks/connectors, inline rename, and builder. Preserve advanced code access.
2. Present Sequence with its own builder route. Avoid promising that dragging a rendered actor directly edits the sequence; that behavior was not established.
3. Place C4 and other code-led starters behind an explicit secondary group such as “More diagram types”. Use a capability label like “Edit in Mermaid; preview and source lookup”. Keep their existing creation, rendering, source, presentation, export, and conditional inspection routes.
4. Use separate capability indicators for structural authoring, preview styling/metadata, source lookup, and viewing/export. Preserve the inspectors observed on ER/Block and the conditional capabilities established by the separate source inventory. State/class transition or relationship tests here do not settle their node capabilities.
5. Move the starter/type choice into the proposed Diagrams entry so users can see the capability before replacing their current diagram. The current choice is nested under “Diagram type, templates & tools”, alongside unrelated template, code, quality, and workspace actions.
6. Make C4’s starter readable at its initial fitted view: relationship labels should not cross the node text. Replace “test drawing this session” copy with a short explanation of the controls that apply to the current diagram.

Raw evidence: [focused run](C:/Claude/SIREN_WORK/portable/desktop/evidence/diagram-mouse-audit-2026-10-03/resume-native-03/result.json), [starter matrix](C:/Claude/SIREN_WORK/portable/desktop/evidence/diagram-mouse-audit-2026-10-03/resume-native-matrix-04/result.json), [independent summary with unavailable persistence oracle](C:/Claude/SIREN_WORK/portable/desktop/evidence/diagram-mouse-audit-2026-10-03/resume-native-matrix-04/independent-state-summary.json). No removal or product implementation was performed.


