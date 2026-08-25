# SIREN Round 11 — handback

## Delivery identity

- Frozen input: `FROZEN_R11_BASE.html`
- Input bytes: `8,591,186`
- Input SHA-256: `2F2DA0BDA18427E3262EB97D06401723183D1938A09083654C64AFE791223030`
- Clean replay artefact used for verification: `round11_work/SIREN_R11_FINAL.html`
- Final bytes: `8,598,565`
- Final SHA-256: `539C3D5F98BCDB465895F2CAE3222E2BE16F2318234D5F667F8E54370F4E4697`

The deliverable is the six-script chain in `round11_patches/`, not the verification HTML. `round11_patches/APPLY_ORDER.md` records every script hash and every required input/output hash.

## What landed

### AV — delayed tour no longer takes an editor's focus

`showTourStep` and `startWelcomeTour` now carry explicit `focusNext` provenance. The timer-created first-run card defaults to no focus transfer. A real Next action and an explicit Guide replay pass `true`, so focus still follows a deliberate keyboard or pointer action, including across a hidden tour step.

Measured on the frozen base: `1/6` scenarios and `20/37` assertions; Visual and Docs retained only `Revie`, Code retained only the initial typed suffix, focus moved to the tour button, and typing advanced the tour. On the final build: Visual, Code, Docs, reduced-motion, automatic-keyboard and Guide-replay scenarios are `6/6`, `37/37`. All three editors retain `Review request`, focus never leaves the active editor during the timer window, and the automatic tour remains Tab/Enter operable.

### AW — main PowerPoint export keeps small type visible and reports it

The PowerPoint-only shape builder now reuses the existing `deckShapeTextBody` implementation: 1pt floor and visible horizontal/vertical overflow. It records the smallest emitted font size on the blob and adds the exact under-9pt value to both the main status and export status. The Excel `ooxmlTextBody` writer and the deck writer remain byte-for-byte unchanged.

Measured 44-block TD fixture:

- Base: 87 text shapes, 87 font/height violations, 87 clipped text bodies, no warning.
- Final: 87 text shapes, minimum `1.0pt`, zero font/height violations, zero clipped text bodies, and both status surfaces name `1.0pt`.

The required five-block control remains `11.17pt`; its representative block is `192.8 × 43.6pt`, and no warning is shown. A 44-block LR sideways fixture also reaches `1.0pt` with zero clipping/height violations. The five-block Excel `xl/drawings/drawing1.xml` is byte-identical before and after: 10,359 bytes, SHA-256 `26159209885A9994F25CE1F39DEABF31C3D1F9E2DE49791B9CA8C4126366CF74`.

### AX — a diagram reference arrives at its named block

The diagram-reference branch now keeps `resolved.node.id`, waits for a cross-diagram render when necessary, guards against the active diagram changing during that render, and opens the block inspector on the rendered node. Its tooltip promises a block arrival only when a resolved block exists; whole-diagram references still say only that they open the diagram.

Same-diagram and cross-diagram physical chip clicks both arrive at the exact block. Whole-diagram and dangling references keep their narrower promises.

### AY — reference-chip context actions

A real secondary click on a live reference chip now opens a menu headed by the chip's own text, with a jump row and a remove row. Both actions reuse the existing open/remove paths. A dangling block-scoped link uses its stored `nodeId` to retain the disabled `Go to this block` wording and names why it cannot run; it does not overstate that it can still open a live diagram target.

The jump route produces the same block arrival as AX. Removal was verified in rendered and persisted state.

### AZ — block menu routes to its documents

The block menu and inspector now share one `nodeWorkpapersFor` scope calculation and one `openNodeWorkpaper` destination. A node-specific link wins over a whole-diagram link from the same document. Rows name the document and say `this block` or `whole diagram`.

The linked block shows and opens the exact document. An unlinked sibling does not inherit a node-only document; a whole-diagram document appears on both blocks as intended.

### BA — the document marker is a real pointer target

The bare SVG text is now a grouped marker with an 18 × 18 transparent hit rectangle, a non-intercepting glyph, a live-app pointer cursor and a node identity. One linked document opens directly; several linked documents open the block inspector with Documentation expanded instead of choosing arbitrarily.

The first physical implementation still failed: `pointerdown` hit the marker, but `beginPan()` captured it and retargeted `pointerup`/`click` to `#zoomViewport`. The final patch adds the marker to the existing unique interactive-target selector, so the pan engine leaves that gesture alone. Final BA result: `8/8` assertions within the reference probe, including the physical 18px hit target, direct one-document arrival and the two-document sideways case.

## Round 10 probe corrections requested with this round

There is no `au_lib.js` anywhere in this workspace. The two stale calculations live in the current consolidated `qa_round10/run_round10_targeted.js`, so that is the test file corrected:

- AU now treats `box.left + borderLeft + clientWidth` as the padding-edge clip boundary; it no longer subtracts the content inset and invents 5px of clipping.
- AT no longer uses the invalid x=240 column or forged block-target events. It requests x=380/620/900 and uses real secondary clicks on actual block chrome. Where the native editor owns the requested point, the probe records the nearest real chrome hit rather than pretending the pointer was on the block.

Corrected Round 10 probe on the frozen 1.70.0 base: `2/2` scenarios, `45/45` assertions.

## Verification evidence

### Positive controls

- AV base: `round11_work/baseline_av_full/report.json` — `1/6` scenarios, `20/37` assertions.
- AW base: `round11_work/baseline_aw_exact/report.json` — the large fixture is red for height, clipping and missing warning while the small control is green.
- AX/AY/AZ/BA base: `round11_work/baseline_references_full/report.json` — `1/7` assertions; the existing creation machinery is the positive control and the requested arrival/actions are absent.

### Final targeted gate

Command:

```text
node qa_round11/run_round11_targeted.js --base FROZEN_R11_BASE.html --app round11_work/SIREN_R11_FINAL.html --output round11_work/targeted_final --port 9910
```

Result: `4/4` probes, `11/11` scenarios, `92/92` assertions, `fatal: false`. No probe reported a page or console error.

The visual evidence was opened and inspected, not only generated:

- `targeted_final/av/av_visual.png` and `av_docs.png`: the complete `Review request` remains in the focused editor while the tour is at `1/6`.
- `targeted_final/references/ay-chip-menu.png`: exact chip heading plus jump/remove rows.
- `targeted_final/references/az-block-menu.png`: Documents section and scoped row inside the real block menu.
- `targeted_final/references/ba-marker-sole-result.png` and `ba-marker-result.png`: direct Docs arrival and the two-document inspector.

AW was proved from OOXML, as required; no slide screenshot is presented as proof.

### Job A gate

Command:

```text
node qa_round3/run_round3_suite.js --app round11_work/SIREN_R11_FINAL.html --expected-sha 539C3D5F98BCDB465895F2CAE3222E2BE16F2318234D5F667F8E54370F4E4697 --output round11_work/job_a_gate_final
```

Raw result: `43/48` scenarios, `428/439` assertions, `fatal: false`, four coverage gaps. All 16 produced exports passed structural validation. The application SHA was unchanged after the suite. The syntax scenario found two script blocks and `node --check exit 0`.

The five red scenarios and all 11 red assertions reproduce unchanged on the unpatched frozen base (`round11_work/job_a_base_control/report.json`, same five scenarios and same 11 assertions):

1. `R2.ITEM3.NARROW` — six stale assertions still target hidden desktop `#commentsButton` and `#reviewButton`. The current 375px route is `#mobileMoreButton`; the same scenario's Compare checks already observe its ordered `Review and sign-off…`, `Review comments…`, `Compare diagrams…` rows.
2. `EXPORT.MAIN` — one harness timeout clicks hidden `#styleShortcutButton` directly instead of opening the current Inspect route. It fails before any main export is attempted. AW's main PowerPoint route is covered independently by the green targeted gate.
3. `R3.SURFACE.CENSUS` — two stale expectations say header/preview-head counts are 4/3; live 1.70.0 is 5/0, with the same nine desktop preview-toolbar actions and ten mobile actions.
4. `R3.EXPORT.DOCX` — Word COM cannot create its application in this isolated session: HRESULT `0x80070520`. Package/XML/compatibility-mode checks pass before that environmental step.
5. `R3.EXPORT.PPTX` — the equivalent PowerPoint COM step fails with the same `0x80070520`; deterministic bytes, bounds, audit metadata and editable/picture contracts pass first.

These are gate drift/environment findings, not Round 11 regressions. The raw gate was not rewritten or marked green.

### Delivery integrity

- A clean replay from the frozen base reached the exact final SHA in `APPLY_ORDER.md`.
- Every patch and test runner passes `node --check`.
- Applying any of the six scripts to the wrong hash exits non-zero before writing; the final file remained SHA `539C…E4697` after all six negative checks.
- `APP_VERSION` exact line: unchanged, 35 characters, SHA `1FC375C61C1C61B595B25F3759BC5316786F3C74AE7D12335F513CC5C143A91B`.
- CSP exact line: unchanged, 343 characters, SHA `BF168A35B3263E9AC55CB40B0D05AD9FC87626601669275EC661EA695D9565F9`.
- CHANGELOG protected slice: unchanged, 37,884 characters, SHA `B4AD3102DAAE390D5AE2FB08200F584EF61B6528FB6362F2DB2CFF09CD6BBE55`.

## Anchor drift and implementation corrections

No application anchor from the frozen 1.70.0 base drifted. Every replacement anchor matched its asserted exact count, and the clean chain replayed without loosening a guard.

Two changes came from sideways verification rather than anchor drift:

- AY initially chose the dangling menu label from `resolved.node`; that object is absent precisely when dangling. It now uses the stored `resolved.nodeId`, preserving the link's real scope without promising a live destination.
- BA's first pointer target was geometrically correct but still lost its click to preview pointer capture. The final patch adds the unique `beginPan` interactive-selector anchor; it does not add a capture handler or alter pan behavior elsewhere.

The only named-file mismatch was in test code: `au_lib.js` does not exist, so the requested AU correction was made in the existing consolidated Round 10 runner that contains the calculation.

## Deliberately not done or claimed

- No merged/release HTML is handed back; `round11_work/SIREN_R11_FINAL.html` is verification evidence only.
- `APP_VERSION`, `CHANGELOG` and CSP were not changed.
- Present, the Map, the deck writer and the Excel writer were not modified. The main PPTX route calls the already-proven deck text-body helper, whose implementation remains exact.
- No LibreOffice visual claim is made. AW proof is the emitted OOXML plus the unchanged small-fixture and Excel controls.
- The delayed tour card can still become visible over Docs if Docs is opened before its timer. This round proves that it no longer steals focus, loses text or advances from that typing; it does not claim that earlier lifecycle race has disappeared.
- The automatic tour's Next button is reachable by Tab, but it took 77 Tab presses in the measured default layout. That satisfies the stated operability test, not a claim of good navigation ergonomics.
- The SVG document marker deliberately exports without `role` or `tabindex`, because an exported static SVG has no live opener. BA is a real mouse/pointer route in the running app; keyboard users retain the existing block-inspector/document rows.
- With several documents on a marker, no arbitrary document is opened. The inspector is the chooser.
- Per-block references inside Docs, Docs chrome density, editor control count and the brand opening remain the product decisions explicitly excluded by the brief.
- The stale Job A assertions were reported and controlled against the base; the shared gate itself was not modified in this round.
