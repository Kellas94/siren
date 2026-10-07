# Diagram catalogue Task 1 — independent source/model review

Author: Codex independent reviewer `/root/diagram_history_final_review`, 2026-10-07. Scope: the uncommitted pure catalogue, its script-injection helper and focused tests against the approved catalogue plan. No product/test edits, renderer build, GUI/native execution, full suite, commit or approval. UI, main creation authority, focus leases, operation replay and native admission are not implemented by these files and are outside this result.

## Result

No concrete Important defect found in the captured Task 1 implementation. My actual focused test run completed **12/12, no skips, exit 0**. My separate adversarial probe completed five groups, including independently scanning all 28 frozen reference literals without evaluating the HTML. Those sources match byte-for-byte after the reference's CRLF line-ending normalization and match every declared SHA-256. They total 6,433 UTF-8 bytes; maximum 441 bytes and 18 lines.

This result is a bounded model review, not render support or catalogue feature qualification. Every entry still truthfully says `renderQualification: pending`; the hosted Docs run is unrelated.

## Actual independent checks

- For all three filters and every page size 1–20, traversed pages to completion and compared the complete ordered sequence with the selected entries; no omissions, duplication or cycling. Exact end cursors return an empty final page; cursors beyond the filtered total are refused.
- Refused primitive, boxed, array, inherited, hidden unknown-field, symbol and descriptor-backed page/request values; explicit undefined optional fields, infinities and excessive cursors are refused. Checked all creation fields with coercion objects and getters: zero coercion callbacks and zero getter invocations. Null-prototype own-data records remain accepted intentionally.
- Checked exact Unicode title preservation at 160 UTF-16 units, including 80 emoji; over-limit or broken surrogate values and whitespace-only titles refuse. Title contents are literal data, not a sanitization or DOM-rendering guarantee. The normalizer keeps allowed whitespace exactly and never accepts renderer source/project/entity authority.
- Independently located each entry's literal in its correct starter/template reference section using a restricted scanner, refusing escapes/interpolation. Verified the baseline SHA, literal equality and all 28 source digests. These are trusted copied literals, not an evaluation of legacy application code.
- Executed the generated helper string only in an isolated Node VM with `window` and no DOM, fetch or storage. It produces identical frozen catalogue entries and functioning bounded pagination. This demonstrates the self-contained factory, not browser CSP, native rendering or package inclusion.

The frozen entry records contain only scalar data, so freezing each entry, their array, limits and contract is sufficient for the exposed current structure. The lookup Map stays closure-private. Main code must still resolve the entry using this trusted contract rather than accepting a renderer-returned entry object. The future creation request fingerprint must include the resolved definition/version as planned; Task 1 alone grants no write permission.

## Snapshot identities

| Input | SHA-256 |
| --- | --- |
| `src/documents/diagram-catalogue.mjs` | `3d78de0f361754e5715ddfea7060e6dbc1fe04450b3c1227e95feb127b609906` |
| `build/diagram-catalogue.mjs` | `dc20a0c5ed9d8c5b2b132bfb93e89f48ed81f7bd989491059fa3dc69b89246c0` |
| `tests/diagram-catalogue.test.mjs` | `e7777541c238b50bec6db57f6ac76689bb9931e48eecf6b568093b75117add3c` |
| `baseline/R78.html` | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |
| Approved plan | `80cbdbe4e1dc7f20a100ff40048098c23d65722a1809ac995e86e9ff783132e9` |
| Root reference measurement | `ee8b501bead51006db4a3e4690b744f9b12bce2e0dc6d9aac188fc482cb2272c` |
| Preserved original model | `6c227d102c290e692d69d2d19beb825ccf26dbfeb0f23234b31b9a2d71d37777` |

`evidence/diagram-catalogue-model-independent/inputs-before.json` and `inputs-after.json` retain capture times and these seven identities; changedInputs is empty across my executable checks. Initial capture followed initial source reading and preceded tests/probes. Original files and root evidence were not rewritten.

My execution evidence is `scoped-tests.log`, `probe.mjs`, `probe.log` and `probe-result.json` in that same independent evidence directory. The probe JSON retains its Node runtime, individual source identities and exact measurements. The probe's restricted reference scan is separate from the focused test implementation.

## Historical evidence and remaining limits

The root-retained `diagram-catalogue-options-red.txt` records the actual explicit-null/undefined-options failure. Its surrounding shell wrapper reportedly returned zero because a subsequent search replaced the test exit code; I do not recast it as an exit-1 command or my own RED execution. The original model is still separately preserved. My current focused command captures and returns the actual Node test exit before printing it.

Task 1 performs no declaration detection on arbitrary source: families are metadata attached to exact trusted catalogue IDs. The plan's existing bounded declaration handling must be respected if later integration adds detection; these model results do not validate such an implementation. Likewise, the helper is not yet tested in the final renderer HTML/CSP pipeline. Native parsing/rendering of every advertised literal, capability behavior, source-preserving focus transitions and creation durability remain separate required work.
