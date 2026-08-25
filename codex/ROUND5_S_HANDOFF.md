# Round 5 Job S handoff — truthful rendered style targets

> Integrated-chain notice: the standalone pins below are retained only as reproduction provenance.
> The deliverable is `round5_patches/R5_S_rendered_style_targets.py`, script SHA-256
> `07DF6778FBCD33729DD2253EEC12CD5CF92C45FDB5EC5B52F09AEE0708B27228`, pinned
> `EC95A32DAF0E1FEB973FFC43951710038161947C4237D1C1962C7B5AA704ACE4` →
> `C627721354B6BAED14D3C3C27EEC6197DA5076ADD2D8776E765F80AB06CE3E73`.
> Final-chain evidence is `round5_s_verify_final_chain/report.json` (18/18). The authoritative
> ten-job order is `round5_patches/APPLY_ORDER.md`.

## Result

Job S is implemented as one standalone, exact-count, atomic patch against the frozen v1.66.0 bytes. The Style card now treats parsed Mermaid tokens only as candidates and offers a target only when the current finished SVG maps that id to a concrete node group. A successful render refreshes the list. Empty lists are disabled and explain that the diagram has no stable rendered block target and must be edited in Mermaid code. Guards before inspector open, sidebar apply/reset, and inspector live/reset prevent a stale or programmatically supplied id from creating a sidecar style or reporting success.

This is a narrow correctness change inside the otherwise protected Style region, made under the root agent's explicit Job S authorization. It does not redesign the card or change its CSS.

## Independent reproduction

The final harness created all 19 built-in starters through the real UI and measured each dropdown entry against the finished SVG using the application's node identity contract.

- Frozen baseline: 11/11 assertions, fatal false.
- Gantt offered four targets and all four were phantom: `plan`, `YYYY-MM-DD`, `Planning`, `Delivery`.
- Sequence offered four phantom targets: `Client`, `Service`, `Request`, `Response`.
- Class offered two real targets (`Customer`, `Order`) and three phantom targets (`name`, `id`, `places`).
- The baseline Gantt inspector opened as `Block Planning` with zero matching rendered groups. A red fill left source bytes and preview PNG bytes identical.
- The exact brief route is not reachable in frozen v1.66.0: `#applyNodeStyleButton` is hidden. Therefore the quoted success toast itself was not reproduced through user UI. The visible dropdown-to-inspector route reproduced the same false acceptance and no-op.

Baseline report: `round5_s_baseline_final/report.json`.

## Patch and hashes

- Patch: `round5_s_patches/R5_S_rendered_style_targets.py`
- Input SHA-256: `B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`
- Output SHA-256: `6BC1A7943E520D07EF36C79CCCD326681C8AA1FE19791356DF37883815067FF4`
- Verified artefact: `round5_s_work/SIREN_1_66_0_R5_S.html` (8,441,680 bytes)

No anchor moved: this patch is cut directly against the named frozen hash. Its eight exact-count anchors are:

1. `extractNodeIdsFromSource` followed by the head of `refreshNodeStyleTargets` — add the rendered-catalog contract and use it for the dropdown.
2. The zero-id branch in `refreshNodeStyleTargets` — disable the controls and give an honest reason.
3. The head of `applySelectedNodeStyle` — refuse before state write or success toast.
4. The head of `resetSelectedNodeStyle` — refuse a stale target before sidecar mutation.
5. The head of `openNodeInspector` — never open an editor for an unmapped target.
6. The head of `applyNodeInspectorStyleLive` — refuse before live sidecar mutation.
7. The head of `resetNodeInspectorStyle` — refuse before inspector reset mutation.
8. The successful-render sequence `clearEditorError` / `previewOverlay` / `markPreviewCurrent` — refresh only after the SVG is final and annotated.

The script asserts every anchor count, post-conditions, the input/output SHAs, and unchanged APP_VERSION, CHANGELOG and CSP structure, then replaces through a flushed sibling temporary file.

## Verification from the patched artefact

- `syncheck.py`: 2 script blocks, 7,472,666 extracted characters, `node --check` exit 0.
- Final Job S verifier: 18/18 assertions, fatal false.
- Telemetry: zero page errors, console errors, console warnings, external requests and failed requests.
- The app SHA was unchanged by both browser runs.

Final survey:

- Real targets retained, zero phantoms: Flowchart 6, Swimlane 5, State 3, ER 2, Class 2, Block 6, Kanban 4, Ishikawa 9, Requirement 2.
- Disabled with zero targets and an explicit Mermaid-code explanation: Sequence, Architecture, C4, Timeline, Gantt, Journey, Mindmap, Gitgraph, XY and Pie.
- A contrasting fill was applied through the visible inspector to one retained target on each of the nine enabled starters. In every case the rendered fill changed to the requested value and the Mermaid source remained byte-exact.
- A real UI `.siren` export after the refused Gantt case contained no `Planning` entry in the active diagram's `nodeStyles` sidecar.

Final report: `round5_s_verify_final/report.json`.

Rendered and inspected evidence:

- `round5_s_baseline_final/s-gantt-phantom-inspector.png`
- `round5_s_verify_final/s-gantt-style-refusal.png`
- `round5_s_verify_final/s-flowchart-A-styled.png`
- `round5_s_verify_final/s-state-Draft-styled.png`
- `round5_s_verify_final/s-class-Customer-styled.png`

## Deliberately not claimed

- No Style-card visual redesign, CSS change, new parser, or Mermaid renderer change.
- No historical `nodeStyles` entries are purged. A currently unmapped id may become valid again if its original source is restored; the fix prevents new false writes and hides unmapped actions without destroying recoverable project data.
- No Firefox or WebKit run; this targeted verifier is Chromium-only.
- The full Job A gate was not run for the standalone Job S artefact. It belongs on the final integrated Q–T chain.
- The hidden legacy Apply button's success toast was not claimed as reproduced. Only the visible no-op inspector route was reproduced, measured, rendered and inspected.
- APP_VERSION and CHANGELOG were not touched.
