# Round 5 Job R — targeted evidence

## Artefacts

- Patch: `round5_patches/R5_R_guided_source_integrity.py`
  - input SHA-256: `B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`
  - output SHA-256: `EC95A32DAF0E1FEB973FFC43951710038161947C4237D1C1962C7B5AA704ACE4`
  - output size: 8,448,184 bytes
  - script SHA-256: `D5778C7943F16365D1B20E2050DF89EFF2A75E249380F80550240E0BB9977E8D`
- Real-UI verifier: `round5_r_verify/run_round5_r.js`
  - script SHA-256: `2DD19A7D29C9C362300695EE483B034FA17690EC23457D61CE5F6BAD08CF26D9`
- Baseline report: `round5_r_verify/baseline/report.json`
  - 6/6 scenarios, 18/18 assertions, fatal false
  - SHA-256: `9CFD7F16337913D1EFDBDB42BB8C687A813639BF03588CA726E477A7BE19B2D0`
- Fixed report: `round5_r_verify/fixed/report.json`
  - 6/6 scenarios, 52/52 assertions, fatal false
  - SHA-256: `9336CAFE0E67BB41A37B177693F00B8DBC8122D2A65CD4A867971A62CF06A9F0`

## Independent reproduction

The frozen build exposes seven flowchart shape chips on its built-in Kanban starter. The first
card opens a 14-item `Block shape` menu; picking Decision rewrites
`todo[To do]` as `todo{"To do"}`. The same parser classifies Block and C4 declarations as
flowchart blocks. Block line 3 is displayed as
`a[Inputs"] b["Processing"] c["Outputs]`, and C4 line 3 loses its closing quote.

The parser's `flowchartish` flag guarded only bare nodes. Shaped nodes, chains, links and groups
were still parsed for every Mermaid grammar. Once those foreign rows were misclassified,
flowchart callbacks could serialize a flowchart token back into the foreign grammar. The old row
renderer also reconstructed valid flowchart text: it lowercased the declaration, normalized
spacing, removed quote lexemes, and inserted visible add-label text. Thus its source textarea was
unchanged on open while `.struct-code-text.textContent` was not the supplied source line.

The repair gates flowchart-only parsing after blank rows, init directives and ordinary Mermaid
notes. Notes remain safely editable for every diagram type. For recognised flowchart rows it uses
the existing surgical writer's exact offsets (`surgIndex`) rather than re-serializing or aligning
text heuristically. A per-render line map gives O(1) statement lookup. ID, shape, node-label,
connector, edge-label, direction and subgraph chips wrap only their actual source spans. A bare
node's shape/label actions and an unlabelled edge's add-label action use visible SVG controls with
empty `textContent`. If offsets are missing, ambiguous or overlapping, the row fails closed to one
exact editable raw token without throwing a page error.

## Exact anchors

Every replacement anchor occurs exactly once on the pinned input.

1. In `parseStructureRows`, the ordinary `%%` note guard immediately before the header parser.
   The fail-safe `if (!flowchartish) return row;` is inserted there, after grammar-valid notes.
2. The unique `structureCodeLine(row, ids)` section up to `renderStructureEditor()` is replaced by
   the source-span renderer and its fail-closed raw path.
3. The unique render-index block and `structureCodeLine(row, ids)` call are wired to one
   `surgIndex(el.source.value)` plus a single-statement-by-line map per render.
4. The three exact `SURG_MID_FORMS` rows accept multiple leading spaces, allowing an irregularly
   spaced mid-label edge to keep semantic spans rather than falling back to raw.

No status wording, Visual Builder controls, canvas gating, Style code, APP_VERSION, CHANGELOG or
CSP content changed. The patch uses a temp file in the target directory, flushes and `fsync`s it,
then atomically installs it with `os.replace` only after all guards and the pinned output hash pass.

## Verification

The verifier serves the real application over localhost and drives `#source`, Text/Guided and the
actual 14-item shape menu through Chromium. On the patched artefact it confirms:

- Kanban, Block and C4 have zero flowchart shape chips;
- every row's `.struct-code-text.textContent` equals its supplied source line exactly;
- each complete non-flowchart source remains byte-identical after Guided opens;
- a non-flowchart comment without a space and a line with two trailing spaces stay exact;
- a valid flowchart covers a multi-space header, entity-encoded quoted labels, irregular spacing,
  an inline edge label, a comment with trailing spaces, a chain, subgraph/end and whitespace rows;
- the valid flowchart has no `#editorError`, has exact semantic ranges, keeps all 14 distinct shape
  choices, and performs a valid one-row shape rewrite;
- direction, endpoint ID, node label, edge label, shape, arrow, group, note and add-label callbacks
  each change the expected source, followed by a fresh all-row `textContent` equality assertion;
- a separate recognised but noncanonical `GrApH    tB` fixture measures mixed-case lexical
  preservation without claiming that Mermaid itself accepts case-insensitive declarations;
- zero page errors, console errors or warnings; and the app file remains byte-identical during QA.

Direct parsing of both inline script blocks and `node --check` of the verifier pass. The independent
semantic-range probe passes 19/19, including exact target IDs and mid-label arrow/label ownership.
A clean application from the frozen input is byte-identical to the candidate. Applying the patch
to its own output exits 1 on the input SHA guard, leaves the file byte-identical, and leaves no
`.r5r-*` temp residue.

Both final flowchart screenshots were inspected. They show the exact-source Guided chips, the
14-item shape menu and the post-add-label state beside an updated, valid flowchart preview.

## Deliberately not claimed

- No Job A full-suite or final R→S→T→Q→K→L→M→N→O→P chain result; the parent round owns those.
- No full survey of every Mermaid grammar and no cross-browser claim.
- No claim that noncanonical mixed-case Mermaid declaration keywords render; that fixture is only
  a lexical-preservation edge case.
- No redesign of Guided, Visual Builder, canvas gating or the Style surface.
