# Python syntax-map assignment omission: isolated fix

Author: /root/catalogue_view, **implementer**. Created 2026-10-07T15:14:44.314Z.

The actual admitted Python parser calls assignments `AssignStatement` and augmented updates `UpdateStatement`. The old projection looked for nonexistent `AssignmentStatement`, silently omitting all these blocks. The frozen foundation review and the original worker are preserved separately.

## Change

Only `src/sources/map-worker.mjs` changes in the product. Both actual parser kinds now map to the existing assignment surface. A direct `TypeDef` without a direct `AssignOp` maps to `annotation`, so `x: int` does not claim a value was stored. An equals sign in a type literal does not change that classification. IDs, absolute ranges, parent containment, label bounds, diagnostics and budgets use the existing implementation.

The unchanged browser map accepts the annotation kind and displays its literal caption plus the existing honest generic syntax explanation. No protocol, UI, source persistence or educational subsystem was added.

## Actual verification

- RED 2026-10-07T15:12:19.824Z: new real-parser projection/VM tests, **2/9 passed, 7 failed**, exit 1. Failures identify absent assignment/annotation/update blocks. Original worker SHA-256 `7d9008b70283d0e31d7bca083916fab6702084ab8d1da9ef93361a73e4b9a9d2`; byte-exact original and complete log retained.
- GREEN 2026-10-07T15:12:59.919Z: **17/17 passed**, exit 0, including the same unchanged nine new tests plus eight existing analysis-view tests. Captured test inputs remained unchanged during the run: `changedInputs: []`. Corrected worker SHA-256 `ad81f10864a4dc29e29c6d5d91468f2a7214e7a986df6822aef339c8db995b76`.
- The parser is extracted only in memory from hash-verified `baseline/R78.html`, with the exact admitted four-factory hash verified and an explicit module allowlist. Installed Lezer dependency versions and ESM bytes are captured in the JSON report. No Python scripts execute.

Cases cover annotation-only and annotated assignment, updates, chained/destructured/attribute/subscript targets, Unicode, CRLF and offset identity, nested function/branch/call/await containment, yield, syntax errors, graph/edge/visit caps, surrogate-safe labels and actual browser VM presentation/navigation. Existing view checks retain dirty-source refusal, immutable version checks, cancellation/Lock, comparisons and literal rendering.

## Provenance and limits

Full receipts: `reviews/2026-10-07-python-map-assignments-red.{json,log}` and `reviews/2026-10-07-python-map-assignments-green.{json,log}`. Exact original source: `reviews/2026-10-07-python-map-assignments-first-original.mjs`. This report hashes the frozen foundation reports rather than rewriting their finding or authorship. Among its 31 captured inputs, the current differences are: src/sources/map-worker.mjs.

- This is a syntax-containment map, not execution, data-flow, type evaluation or CPython validation. Assignment blocks describe source syntax rather than proof that a value was stored at runtime.
- Annotation uses existing generic UI explanation. This isolated repair adds no educational subsystem or detailed annotation lesson.
- Graph budgets remain finite (default 120 nodes and 120 edges; 200000 visits). More visible assignment nodes can make a formerly sparse selection reach the existing map cap earlier; limited=true remains explicit.
- No generated code-analysis-worker.cjs was rebuilt. Parent must build and qualify the integrated worker/runtime separately. No claim about installed or copied package, hosted CI or independent GUI.
- This report is written by the fix implementer. The original foundation review and RED are retained; this is not an independent approval of this patch.
