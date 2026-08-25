# SIREN Round 4 — patch and evidence handback

Date: 24 August 2026

## Outcome

Jobs F–J were completed in the requested order against the exact frozen 1.65.0 base. The
delivery is five ordered, exact-count, SHA-pinned, atomic patch scripts plus a verification-only
HTML artefact and two browser gates. The owner's HTML was not edited.

Frozen input: `FROZEN_1_65_0.html`, 8,405,358 bytes, SHA-256
`D48D61736A4092D94AEFA5502E59FC78F97781D856C6A74C3B02317868785BBA`.

Clean final verification artefact: `round4_work/SIREN_1_65_0_R4_FJ_reapplied.html`,
8,435,599 bytes, SHA-256
`31596D69DA933AE7D57CD0F3C572F9D639168A5749CD6F2789CC5F80CD308707`.

The clean reapply, the development repin candidate and the named verification artefact are
byte-identical. `APP_VERSION` remains `1.65.0`; the full CSP and complete `CHANGELOG` are
byte-identical to the frozen base.

## Patch order

Apply only in this order to the same writable copy:

| Order | Patch | Input SHA-256 | Output SHA-256 |
|---:|---|---|---|
| 1 | `round4_patches/R4_F_draggable_inspectors.py` | `D48D61736A4092D94AEFA5502E59FC78F97781D856C6A74C3B02317868785BBA` | `76DCBA7FD34838039FAD59052F4B6A8EBF9D56AD715E8EA379CB4BFDB1F1624F` |
| 2 | `round4_patches/R4_G_canvas_shapes.py` | `76DCBA7FD34838039FAD59052F4B6A8EBF9D56AD715E8EA379CB4BFDB1F1624F` | `B9B34F29B6B335CF2CAD5A8139BB960ADAEE8E02C79FD32B0D6BAA0459CF36D4` |
| 3 | `round4_patches/R4_H_map_block_navigation.py` | `B9B34F29B6B335CF2CAD5A8139BB960ADAEE8E02C79FD32B0D6BAA0459CF36D4` | `DE80ED083F268770C3A4D0246D3EA53E27F4A2D107DB809F5221B497683D6AE8` |
| 4 | `round4_patches/R4_I_docs_heading_rail.py` | `DE80ED083F268770C3A4D0246D3EA53E27F4A2D107DB809F5221B497683D6AE8` | `083CA6C73251B80B0523B8E99A124D90EA7301A3FF2A60B629F169FBAB30A197` |
| 5 | `round4_patches/R4_J_elk_online_disclosure.py` | `083CA6C73251B80B0523B8E99A124D90EA7301A3FF2A60B629F169FBAB30A197` | `31596D69DA933AE7D57CD0F3C572F9D639168A5749CD6F2789CC5F80CD308707` |

Each script rejects a wrong whole-file input hash before writing, asserts each replacement or
boundary anchor occurs exactly once, checks post-conditions, writes a complete temporary file,
flushes it with `fsync`, and installs it with an atomic replace. The concise chain instructions
are in `round4_patches/APPLY_ORDER.md`.

Patch-file identities:

| Patch | Script SHA-256 |
|---|---|
| F | `0756FE72C9C3C0279C9DC65DB50B14439E4631D1586EEA4E4F7DE3149B8AD67F` |
| G | `A5227D053573069D50BDDCF2DB6B47B24C027F3362FB57168A96D9FF58F61074` |
| H | `970BB8349A09B1EC7DE19B5C0CA8F2EEC0DB4EDE1C6AB4D8BEBF54B051246539` |
| I | `BC3F08508EA3CA484E506B6541B065C985009FF534C16158C068879544C79C28` |
| J | `A179FA6CEC0C8238D0EF3397CC309A8A2D16C713720C7DF5849E823296EB4C9D` |

## Job F — movable inspectors

- The Block and Connector inspector headers share one drag mechanism. The close buttons remain
  buttons and are excluded from drag initiation.
- Pointer drag, a 180 ms touch hold, focusable-header arrow nudging (8 px; Shift 24 px), Escape,
  close, blur and pointer-cancel teardown are covered by the implementation.
- Positions live in a separate `state.inspectorPositions` object and pass a bounded ingress
  sanitizer. `null`, `undefined`, booleans and blank strings do not coerce to zero.
- First open still anchors beside the target. A remembered position is used afterwards only when
  the target is visible and the panel would not cover it; otherwise the panel reanchors.
- The viewport clamp uses an 8 px margin, including after resize and `visualViewport` changes.

Measured in the real application: first-open target gap 11.28 px; top-left `(8,8)`; bottom-right
`(1092,97)` at 1440×900; remembered `(1084,97)` after keyboard nudge and reload; a covered target
reanchored with an 11.34 px gap; resize snapped to `(12,12)`; both inspectors closed cleanly.

A review of an earlier candidate caught a real defect before handback: `Number(null)` turned an
unset saved position into `(0,0)`, causing first open at `(8,8)`. The final sanitizer and a stronger
first-open/covered-target test close that regression.

## Job G — progressive shape picker

Independent measurement disagreed with the brief's count. There are fourteen true Mermaid shapes,
but the old five canvas chips comprised four Mermaid shapes plus the canvas-only hanging Note.
Therefore ten true Mermaid shapes, not nine, were unreachable from the canvas.

- The established common set remains at rest: five attached choices, or four in the free-new-block
  route where a hanging Note has no host.
- `All shapes` progressively exposes all fourteen true Mermaid shapes; attached mode also keeps the
  structural Note, for fifteen choices total.
- The popover is 340 px wide. Chips are content-sized, the row owns horizontal overflow, edge fades
  and a changing text cue disclose more content, and vertical wheel input becomes horizontal only
  when the row can consume it. Boundary wheel events are not trapped.
- The listener is attached once to the persistent popover rather than once per open. Native
  Enter/Space activation selects a chip instead of committing an empty form.
- The clipped placeholder was replaced by `New step or connect to a block`.

Measured: collapsed row `318/318` client/scroll width; expanded row `318/1027`, maximum scroll
709 px; wheel moved `1 → 246`; the new placeholder measured 178.84 px inside 298 px; all fourteen
Mermaid tokens and the distinct dotted structural Note were written through the real UI.

## Job H — Map Build navigation without losing authoring

The chosen contract is:

- plain click on a flowchart block opens that diagram at the block;
- Shift-click frames/picks the block, preserving `Keep this view` / Space block-slide authoring;
- tile background still frames the tile, a drag still does not navigate, and the Open pill retains
  its existing route;
- recording mode retains its older plain-click pick contract;
- sequence and gitGraph SVGs have no honest flowchart node id, so plain SVG click enters the
  diagram-level view and Shift-click frames the whole tile rather than manufacturing a node id.

The Build hint names both gestures. The existing Open pill remains the keyboard/screen-reader entry
route; the patch deliberately does not add dozens of tab stops to rendered SVG internals.

## Job I — Docs heading rail

Independent measurement also corrected the brief here: the existing Contents menu is generic and
is built from the user's heading blocks; it is not Agent-template-only. It is hidden below four
headings. The rail remains distinct because it is persistent, positional and available with one to
three headings.

- A semantic `nav` is a direct child of `#wpDoc`, outside the document blocks, context-menu surface
  and slash inserter. Zero headings produce no visible rail, observer or scroll hook.
- Each heading produces a button in document order with level indentation, a complete accessible
  name, `aria-current="location"`, roving Tab, Arrow keys, Home/End and native activation.
- Hover/focus expands labels; the resting rail is 34 px wide with uniform 28 px marks.
- Live heading rename updates the matching rail entry without rerendering the document. Add/import,
  document switch and close/reopen paths rebuild without stale entries or duplicate lifecycles.
- One existing observer/scroll lifecycle is reused. A stored animation-frame id is cancelled on
  teardown, the active document id guards delayed work, and both scroll and resize listeners are
  removed.
- Positioning measures the live sticky toolbar instead of assuming a fixed offset.

Measured at the end of a long document: `scrollTop 677`, toolbar bottom 100 px, rail top 110 px,
rail bottom 344 px, active section `Outputs`; the earlier candidate's toolbar overlap was found and
fixed. At 375 px the focused rail expanded to 280 px wholly inside the viewport. A real Markdown
import produced `Country` H1, `Capital` H2, `District` H3, `Transport` H2 with measured mark offsets
`0/4/8/4` px.

## Job J — honest ELK disclosure

- The option now reads `ELK · online · dense diagrams`.
- `aria-describedby="layoutEngineHint"` connects the select to a pre-selection explanation naming
  the approximately 500 KB jsDelivr fetch, offline unavailability, Standard fallback and possible
  cross-machine layout difference.
- No engine, dynamic-import, network or CSP behavior changed. Opening Style made zero ELK requests;
  selecting ELK initiated the existing exact CDN request. An intentionally aborted request produced
  one expected `ERR_INTERNET_DISCONNECTED`, an honest toast, Dagre fallback and a still-rendered
  diagram, with zero unexpected console errors.
- At 375 px the select and hint both measured 311 px wide inside the viewport; the hint wrapped to
  56 px high.

The adjacent alignment finding is confirmed and deliberately not patched. `layout.alignment` is
sanitized, persisted, shown and exported to Excel, but is not passed to Mermaid; only the offline
fallback renderer consumes it. A real fix needs engine-specific semantics, direction/subgraph
behavior, Dagre/ELK parity, migration/export decisions and new visual baselines, not a one-property
pass-through.

## Anchors moved or re-anchored

No exact anchor had to be moved after the scripts were pinned, and every clean reapply matched on
the first attempt. The brief's line numbers refer to earlier layouts, so the following semantic
anchors replaced those line locations:

| Job | Exact semantic anchor(s) used | Why |
|---|---|---|
| F | `.node-inspector-head`; mobile `.node-inspector`; both inspector `<aside>` header seams; state row beside `editorPopout`; sanitation seam between `state.map` and `state.workspaceFolders`; both close bodies; count-only edge-open double-rAF; bounded region `positionFloatingPanel` → `bindInspectorColorPair` | Style landed before F and moved the file. The bounded shared positioning region let both inspectors use one lifecycle without touching the protected editor-popout implementation. |
| G | canvas popover `width: 300px` row; complete `.canvas-chips/.canvas-chip` CSS block; `CANVAS_CHIPS`; persistent popover input-listener/append seam; popover state/chip-selection seam; complete popover markup; show seam; insertion immediately before `canvasSetPopoverShape`; complete click and keydown handlers | The extra shapes, non-shrinking overflow, once-only listener, progressive disclosure and keyboard fix must be atomic; a partial application would recreate the 15.2 px-chip failure. |
| H | complete `mapEnsureTile` click listener; `MAP_BUILD_HINT`/`MAP_BUILD_PICK_HINT`; the now-stale pick-hint comment | The existing early-return branch had to be changed as one unit to preserve drag, Open, recording and Shift-pick behavior while making plain Build click navigate. |
| I | `.wp-doc` CSS row; opening of `#wpDoc`; existing Contents lifecycle block; bounded region `renderWorkpaperContents` → `workpaperBlockFocusIds`; heading accessibility snippet; heading input listener | The live Contents implementation was generic, contrary to the brief's description. Reusing its exact lifecycle avoided a second observer and kept changes away from Docs menus, exporters and slash insertion. |
| J | the complete one-line `layoutEngineSelect` control row | This is the smallest truthful disclosure change and leaves the existing dynamic import/fallback behavior untouched. |

## Verification

### Round 4 targeted gate

Entry point: `qa_round4/run_round4_targeted.js`, SHA-256
`2F1D8B00EC9D6C0CEF0FE631DB0E294C764A0BE1CF254F518107184B7C2B462A`.

Final result: **5/5 scenarios, 91/91 assertions, `fatal: false`**, zero page errors, zero
unexpected console errors and zero warnings; the one deliberately aborted ELK request is recorded
separately as expected. The application SHA before and after is exactly `31596D69…`.

Report: `round4_work/targeted_FINAL_VERIFIED/report.json`, SHA-256
`895BF7F0D3A830AB3D645099A0D9D2F83C3A8464B8491F4BCBDC0EB6EBF75D1C`.

The final light/dark inspector, expanded shape picker, Map Build, Docs desktop/375 px and ELK
desktop/375 px screenshots in that directory were rendered from the final artefact and visually
inspected.

### Job A gate

Command:

```text
node qa_round3/run_round3_suite.js --app round4_work/SIREN_1_65_0_R4_FJ_reapplied.html --expected-sha 31596D69DA933AE7D57CD0F3C572F9D639168A5749CD6F2789CC5F80CD308707 --output round4_work/job_a_FINAL_VERIFIED_COM
```

Final result in the interactive Windows session: **48/48 scenarios, 475/475 assertions, 31/31
exports structurally valid, zero expected-red, zero skipped, `fatal: false`**. Word opened the DOCX
without repair in compatibility mode 15; PowerPoint opened the 11-slide deck without repair. Both
files were byte-identical after COM inspection. Aggregate browser telemetry contains zero page
errors, console errors/warnings, external requests and failed HTTP responses. The application SHA
was unchanged.

Report: `round4_work/job_a_FINAL_VERIFIED_COM/report.json`, SHA-256
`131D52D66C7BFC50601D96CA264FEA84EF80A2C819D122C4860476C07BFB43B8`.

Export report: `round4_work/job_a_FINAL_VERIFIED_COM/export-validation.json`, SHA-256
`D63ED8195AF388F13A2BA0F33E2A1B1C09E6C4285A145A732BA5109BD7A8683C`.

The first sandboxed run reported 46/48 and 468/470, `fatal: false`, solely because Word and
PowerPoint COM could not initialize in that non-interactive logon session (`0x80070520`). All 31
structural export validations passed there too. Re-running the same immutable artefact in the
interactive Windows session made both scenarios green. This was a harness/environment flag, not an
owner or Round 4 application defect.

`C:\Claude\SIREN\syncheck.py` reports two script blocks and `node --check exit 0` on the final
artefact.

## Owner/harness findings and accepted corrections

- The Job A Docs context-menu edit in `ROUND4_RELEASE_F.md` is sound. It now asserts the semantic
  contract (insert-above/below remain reachable under an INSERT group) rather than pinning wording
  whose verb moved into the group heading. The final gate passes that assertion.
- The Excel correction is accepted: the measured fixture exports one sheet per diagram, the diagram
  as 18 native shapes, and one native 32-column table (`SIRENDiagram1`, `A65:AF79`), not “three
  sheets”. Round 4 makes no Excel change.
- The gate's five recorded coverage gaps are unchanged owner/protected or broader-matrix work:
  Docs revision-restore focus, hung-note deletion, speaker-note/ambient/Observatory/Wasteland
  exports, forced out-of-order approved-release drift refresh, and the full Firefox/WebKit matrix.
- No Job A failure remains to attribute to the owner or to these patches.

## Deliberately not claimed

- Touch hold is implemented but was not exercised on a physical touch device.
- Keyboard/ARIA behavior was driven in Chromium; no manual Narrator/NVDA read-through was performed.
- The full Firefox/WebKit matrix was not run. The maintained gate records this as a coverage gap.
- ELK was not bundled, and the inert Mermaid alignment setting was reported rather than expanded
  into an unapproved engine-semantics project.
- No changes were made to the owner's preview toolbar, host-note deletion defect or Docs
  revision-restore focus defect.
- No protected theme finish, editor-popout implementation, Docs exporter/PPTX writer, ambient,
  deck or unrelated Present/Map code was changed. H is limited to the released Map tile click branch
  and its hint strings; I is limited to the released Docs rail seam; J is limited to the released
  Style control row.
- The Map's existing Open pill remains the keyboard/SR entry. Rendered diagram internals did not gain
  new tab stops.
- The verification HTML is not a replacement owner build. Apply the five scripts to the exact frozen
  input in order. No version or changelog bump is included.

Five jobs were a full round; no queue item beyond F–J was started.
