# SIREN Round 5 handback — twelve jobs AC, AB, R, S, T, Q, K, L, M, N, O and P

Status: all twelve requested application jobs are implemented as twelve ordered, exact-count, SHA-pinned, atomic patch scripts. The export-fidelity gate and two Job A expectations are supplied as separate test-only patches. No merged HTML is part of the patch handback.

## Canonical application chain

Frozen input: `FROZEN_1_66_0.html`, 8,438,995 bytes, SHA-256
`B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`.

Apply:

`AC → AB → R → S → T → Q → K → L → M → N → O → P`

The canonical scripts, their own SHA-256 values, and every exact input/output SHA are in `round5_patches/APPLY_ORDER.md`. A clean replay from the frozen file produced 8,523,978 bytes with exact final SHA-256:

`8C31885AA92050DB7D6BEF8B0949C274497EB845191BBC53E3338D1995E71D28`

That replay is byte-identical to the retained verification artefact. The artefact is evidence only; the deliverable is the patch chain.

## Outcome by job

### AC — searchable, selectable diagram PDF

The owner's diagnosis reproduced independently: every tested diagram type used `buildRasterPdf`, yielding zero extractable text, zero fonts and one or more full-page images.

The patch routes plain-diagram PDF export through vector drawing/PDF primitives already present in SIREN. Flowchart, mindmap, pie, gantt and sequence now each measure four embedded fonts, zero image XObjects and roughly 61–62 KB. Romanian text remains extractable.

Large-document pagination is semantic rather than a repeated full drawing. The canonical AC-stage real-UI fixtures measured:

| Fixture | Pages | Bytes | Fonts | Images | Extractable characters |
|---|---:|---:|---:|---:|---:|
| 3 blocks | 1 | 61,000 | 4 | 0 | 159 |
| 12 blocks | 4 | 63,592 | 4 | 0 | 485 |
| 30 blocks / 3 groups | 4 | 64,745 | 4 | 0 | 1,219 |

Every numbered node label appears exactly once across the document; the title appears on page 1 only; the formerly clipped phase label has one complete owner page. All nine final page renders were inspected. The focused distribution gate passed 20/20 with unchanged AC-stage bytes.

### AB — native Office geometry where supported, explicit picture fallback where not

The split measured in the brief was real: mindmap already produced PowerPoint shapes but no Excel shapes; pie, gantt and sequence had no `g.node` geometry and silently became a picture.

The patch gives mindmap native geometry in both writers. On the accepted gate fixture, PowerPoint has seven native shapes and no picture; Excel has six native shapes. The detailed OOXML probe also finds the three native branch/connectors and no residual PNG/media relationship.

Pie, gantt and sequence remain one rendered diagram picture because their Mermaid SVG lacks the node geometry needed for a truthful native reconstruction. This is now disclosed in the live export dialog before download. PowerPoint additionally carries a selectable native title and diagram-text caption; Excel carries the title and safely detected structure in cells. The gate exemptions are limited to those six PPTX/XLSX geometry assertions and require the exact visible disclosure. PDF cannot be exempted.

The default-value leak is fixed at its actual source: unnamed exports receive a type-specific title such as `Pie chart`, never `Flowchart Preview`. A 182-character title survived without truncation. The exact mindmap slide render was inspected and visibly contains `Ciclul de audit — misiunea FY26` above the native diagram.

The smaller title diagnosis was also narrower than reported: a custom title was already present in XLSX; the missing custom-title route was PPTX. The final patch preserves the Excel title and fixes PowerPoint rather than inventing an Excel defect.

One owner action remains: the historical CHANGELOG wording still promises editable PowerPoint shapes without qualifying the three picture fallbacks. The house rule forbids this patch set from editing CHANGELOG, so the application UI is truthful but that historical wording remains byte-identical and over-broad until the owner changes it.

### R — Guided source integrity

The destructive Kanban defect and the Block/C4 quoting defects reproduced. Guided was applying flowchart parsing to foreign grammars.

The repair gates flowchart-only semantic controls by detected grammar and renders recognised flowcharts from exact source spans. Kanban, Block, C4 and unsupported syntax preserve every byte, including case, entities, comments and trailing spaces; they never receive flowchart shape/connect/group callbacks. Recognised flowcharts retain all fourteen shapes and every semantic callback. Final result: 6/6 scenarios and 52/52 assertions.

### S — only truthful, rendered Style targets

The exact hidden `Apply to block` button path quoted in the brief was not reachable in the resting UI. The underlying visible defect did reproduce: gantt/sequence/class offered phantom targets, and applying a style to Gantt `Planning` changed neither source nor rendered pixels.

Target candidates are now admitted only when the finished SVG maps them to a real rendered node. Dropdown, inspector apply and reset paths refuse before sidecar mutation or success reporting when a target is not rendered. Historical unmapped sidecar data is retained. The 19-type survey passed 18/18 assertions with no phantom success.

### T — grammar-safe Visual status

Fourteen code-first starter types received the generic instruction to add a flowchart declaration. The patch preserves the existing compatible Flowchart/Swimlane/Ishikawa and dedicated Sequence paths, while every other recognised type names itself and directs the person to Code. No parser, source-write, layout or gating behaviour changed. Final result: 3/3 scenarios and 42/42 assertions across all 19 starters.

### Q — Docs heading rail no longer paints over content

The Round 4 regression reproduced: all 15 measured blocks extended under the 34 px rail at 1440 px. The patch reserves a 56 px inline-end gutter only while the rail is visible. Documents below the four-heading visibility threshold lose no width.

Every document type was exercised at 1280, 1440, 1728, 1920 and 375 px, including Knowledge/table right-edge controls. Clearance is 16–18 px; the phone layout has no root horizontal overflow. Final result: 4/4 scenarios and 28/28 assertions, with desktop and phone captures inspected.

### K — attached notes cannot be lost with a host deletion

The brief's description was incomplete. On the frozen file, keyboard Delete removed host and note, named the loss in the toast and was exactly undoable; context-menu deletion kept the note but did not heal the path. The problem was destructive, but not silent.

Both routes now refuse before source/history mutation while an authored note remains attached, name the note and explain that it must be deleted or detached first. After intentional note deletion, keyboard Delete heals safely. After detachment, confirmed context deletion heals and retains the standalone note. Undo restores exact prior source.

### L — stable visible focus after revision restore

The ordinary hidden-button report did not reproduce: focusing the hidden Changes button was a no-op and the recreated row retained focus. A bounded 199,997-character legacy restore exposed the real lifecycle problem: the recreated invoker could be thousands of pixels outside the viewport.

Restore now focuses the stable, visible Docs menu button, which is also the route back to Changes. Normal and bounded legacy restores retain content and visible focus. K/L final result: 6/6 scenarios and 42/42 assertions.

### M — the zoom chip now does what its name promises

The chip called width-fit despite promising whole-diagram fit. A 38-block vertical fixture left 4,038 px hidden at 100%. It now calls the existing whole-page fit: the tall fixture fits at 12% and the minimap hides. A 7,900.5 × 74.5 wide stress fixture remains correctly width-limited at 10%.

### N — the diagram tour ends when Docs opens

The first-run 1/6 tour card remained over Docs. Opening Docs now ends the diagram-surface tour and removes its highlight before Docs receives focus. Guide → Start the tour remains available after returning to the diagram. M/N final result: 38/38 assertions.

### O — read-only Docs and slash cancellation

The supplied read-only share was writable through more than the reported × control: title, owner, blocks, document metadata, governance, comments, revisions and releases exposed mutation routes. The visible × persisted a 39 → 38 block deletion through IndexedDB and reload.

The surface now fails closed at both UI and mutation boundaries while retaining navigation, comments viewing, Knowledge Find, Changes/Releases viewing, copy and all seven exports. The former × coordinate leaves 39/39 blocks and the exact document hash unchanged through reload and JSON export.

For slash insertion, `/` is committed to DOM and model before the menu opens. Escape and click-away retain it; a successful command consumes only its own empty-or-slash marker; ordinary prose such as `ratio / total` stays exact.

### P — useful window identity and correct embedded brand assets

Titles now put the specific content first for narrow tabs: active diagram/index, board, Docs document and the named top-level surface, with leading saving/error markers.

The favicon diagnosis was partly wrong. The old SVG already had square, circle and diamond terminals, but raw `#` colour tokens broke its data URI and Chromium decoded it as 0 × 0. The patch embeds an ICO fallback, an adaptive base64 SVG, a 256 px Apple PNG and navy `theme-color`. Chromium light/dark 16 px captures match the official reference; Playwright WebKit decodes all three assets. O/P final result: 26/26 scenarios and 61/61 assertions.

## Export-fidelity acceptance

The unmodified owner gate asks for native Office geometry everywhere. Against the exact final build it reports 19/25: all five PDFs pass, flowchart passes, mindmap passes, and only pie/gantt/sequence × PPTX/XLSX geometry remain red.

The separate gate patch adds no silent exemption. It checks the exact disclosure visible in the real export dialog and only then accepts those six Office picture fallbacks. The accepted run is 25/25, `fatal:false`. The report schema records the app path but not a pre/post SHA; `round5_export_fidelity_attestation.json` separately records the retained app, report and gate hashes. It must not be described as an embedded cryptographic binding inside the report itself.

| Evidence | Result | SHA-256 |
|---|---|---|
| Raw fidelity report | 19/25; six disclosed Office geometry reds | `C3F0BB724CA6184B52202239AC720140B6220785042C226C71CC1F7F3D743A33` |
| Accepted scoped report | 25/25, fatal false | `5943C87525FFA565CF58B9E9BDC2A7518A024863D7F509FD8AE8DE373DC246B4` |
| Separate fidelity attestation | current app/report/gate hash ledger | `9271A9F05610C78B695CB9CA54799195FC7F7B5BF2B3CBEEB7D25F951BE8D574` |

## Canonical-stage and final-chain targeted evidence

The AC and AB rows certify their exact canonical stage outputs (`E413C6E4…35E26B` and `71B86978…016E7E`). The raw and accepted export-fidelity reports above rerun the AC/AB core export-fidelity matrix against exact final SHA `8C31885A…71D28`; the large-pagination and adversarial-title cases remain canonical-stage evidence. The R–P rows below directly target that exact final SHA. Every run leaves its named application bytes unchanged.

| Jobs | Result | Report SHA-256 |
|---|---|---|
| AC pagination/distribution | 20/20 | `CD19AD1AD7155657D9726F300DDD1981148C6FFE955A43F50FFA2DF2E6C1BE93` |
| AB adversarial summary | pass with disclosed Office fallbacks | `81337647C346F7463BC910788B1CC850603D6078EE18E5FDAC731FE223F3905E` |
| R | 6/6 scenarios, 52/52 assertions | `E90AE184572D73FC91468FCCFF8722B6A58F2C536DB268C3037047F171AC22FC` |
| S | 18/18 assertions | `BDF047057D8B282DC1F8CD8652543843B957E783D218995B784E7E8F9734E01B` |
| T | 3/3 scenarios, 42/42 assertions | `3CF50F48E80A4FE197C5705C2DF55D27D4F96AAD919703EEAFC3EDF3DFB22675` |
| Q | 4/4 scenarios, 28/28 assertions | `25F85FDBA6DC91EAEE8EE3BDF678B0AA7A9E0230A2AB69E311B1586087AB618D` |
| K/L | 6/6 scenarios, 42/42 assertions | `86AFAC2C5A5F159376B7110E6F534CB66CA8CCD19DDE9C8E6891D5E56EC74E92` |
| M/N | 38/38 assertions | `174A0A8D74B7BB5878A7A7BF22FA680EDF32DDB8B05C8206ABD7206049A7DB37` |
| O/P | 26/26 scenarios, 61/61 assertions | `126F8387007647E14E09F550C8267717E951AFF289FB64AEA4438D513C76EFA7` |

## Job A gate

The existing `EXPORT.MAIN.22` assertion required embedded PPTX raster media, which became stale when AB made the main path native. A test-only patch now requires the source sentinel, native shapes, zero pictures and zero orphan media. It also replaces the obsolete protected-gap description for K with an accurate pointer to the separate final-hash K/L gate; it does not pretend Job A duplicates K's four-route matrix. A second test-only patch re-pins the Job A entry point to that exact runner output.

The refreshed Chromium gate on the exact final build reports:

- 46/48 scenarios and 468/470 assertions;
- 0 expected-red, 0 skipped, `fatal:false`;
- 31/31 exports passing ZIP CRC, XML, relationship, OOXML, PNG, PDF and text validation;
- app SHA unchanged before and after;
- `EXPORT.MAIN.22` green with source present, three native shapes, zero pictures and zero media.

The only two failures are environment/session failures before application assertions: Word COM `R3.EXPORT.DOCX.09` and PowerPoint COM `R3.EXPORT.PPTX.11` both return HRESULT `0x80070520` because the isolated Windows logon session has no usable COM class factory. All pre-COM structural/content checks pass. An interactive desktop rerun is still required before claiming native Office opens without repair on this exact build.

- Job A report SHA: `9F2FD81E0E89DAFD084FC7D668F3CF6BE0B72B24ADF967E7EAF9B119342F0711`.
- Deep export report SHA: `093112CDF45D6B9F72A329DC25B685C7F3D969CB4D61B6E677636F09B6296060`.

The four declared coverage gaps remain honest: K's complete matrix lives in its targeted final-hash suite; protected speaker/ambient/presenter exports remain outside this gate; forced approved-release drift generation is not duplicated; and the complete all-scenario Firefox/WebKit matrix is not rerun here.

## Mechanical, syntax and patch rails

`round5_final_audit/report.json` passes 106/106 checks:

- all twelve application scripts compile and carry exact 64-hex input/output pins;
- the input of each patch equals the previous output;
- every patch rejects a wrong-SHA fixture before writing;
- clean replay from the frozen base is byte-identical to the final artefact;
- HTML syntax passes: two inline script blocks, `node --check` exit 0;
- `APP_VERSION`, CHANGELOG and CSP are byte-identical to the frozen base;
- no U+0008, `eval`, `new Function`, network call or external endpoint was introduced.

Audit report SHA: `C84F265CDB1E2560CEE302EACA04E7A0C791B117709943C0D4A17E5601347422`.

The three test-only patches also apply cleanly from their named inputs. Reapplication/wrong-SHA fixtures exit non-zero and remain byte-identical; the final entry-point negative check records exit 1 and the unchanged `38C34F4B…1F71` hash in `round5_final_audit/suite_patch_negative/R5_A01b_reapply.log`.

All fifteen delivered scripts have active `EXPECTED_INPUT_SHA256` and `EXPECTED_OUTPUT_SHA256` constants set to exact 64-hex values. Fourteen retain a dormant compatibility comparison against the literal string `TO_BE_PINNED`; no active pin contains that placeholder. Removing the unreachable sentinel would only churn the published script hashes.

## Anchors moved or corrected

One application anchor moved during authoring:

- **K:** the short candidate beginning `const heal = canvasHealPlan(...)` occurred twice. It was expanded to the unique `canvasDeleteAndHeal` preamble so the neighbouring splice/move path cannot be altered.

No application anchor moved because of base drift in AC, AB, R, S, T, Q, L, M, N, O or P. Guard corrections that did not move a base anchor:

- **R:** the bounded 9,058-byte `structureCodeLine` replacement verifies exact old-section SHA `CB67A564E59442945CE38E8FABE933E4F651E21C64F1EE9E37601ADAF7002124` in addition to unique boundaries.
- **AC:** the vector writer and unique-per-page semantic ownership correction are folded into one base-pinned patch; discarded pagination experiments are not part of the chain.
- **AB:** the application patch has 31 exact replacement groups covering 32 declared occurrences. The final mindmap empty-structure correction did not move a base anchor.
- **O:** literal escaping preserves the glyph-prefixed Close control and asserts zero U+0008.
- **M/P:** postconditions use the exact existing tooltip punctuation and favicon link.

## Protected surfaces and explicit Round 5 exceptions

Round 5 explicitly assigns Docs/canvas jobs Q, K, L and O and narrowly assigns functional correctness in S/T, while the inherited Round 3 table and the Round 5 closing note generally protect those surfaces. I treated the named twelve jobs as task-specific exceptions, not permission for a redesign:

- S changes target admission and mutation truthfulness, not the Style card layout or design;
- T changes only status policy, not builder parsing, layout, gating or source writes;
- Q/K/L/O change only the exact Docs/canvas defects assigned;
- Present, Map, deck implementation, ambient scenes, preview-toolbar design and fixed-block placement were not modified.

## Deliberately not claimed or not done

- No application version, CHANGELOG or CSP edit. Consequently, the historical unqualified CHANGELOG promise about editable PowerPoint shapes remains an owner-owned wording defect.
- No claim that pie, gantt or sequence are native Office diagrams; their picture fallback is explicitly disclosed and gate-scoped.
- No claim that the export-fidelity report JSON embeds the application SHA; the separate attestation records the retained hashes.
- No interactive Word/PowerPoint COM success in this isolated logon session; only structural validation and independently rendered PPTX evidence are claimed.
- No native Excel visual render for the final XLSX geometry; verification is real-UI export plus OOXML, drawing, relationship and media inspection.
- No native Narrator/NVDA run, physical touch run, native Safari browser-chrome check or complete final-hash Firefox/WebKit scenario matrix.
- No Round 6 survey work, preview-toolbar redesign, fixed-block placement or protected Present/Map/deck/ambient change.
