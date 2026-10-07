# Independent review of the finite Diagram layout model

Author: `/root/catalogue_view`. Date: 2026-10-07. This report is the reviewer's own work, separate from root's implementation evidence. Result: no blocker observed within the stated Node/VM and real repository scope. This is **not** GUI, Mermaid geometry, packaging, hosted CI or release approval.

The corrected independent fixture and five existing stable test files completed **37/37** checks: nine newly authored independent checks and 28 existing checks. Exact commands, original output and before/after file identities are retained in the companion JSON. Ten production/baseline/fixture files captured before execution remained byte-identical at readback; the reviewer's own test file changed only to correct its fake native handle.

## What was verified

- `src/documents/diagram-layout.mjs:9` resolves parsed source ownership before native fallback. Eight supported type aliases/scopes, unrelated scopes, own accessors and unsupported grammar names were exercised. Accessors were not executed. Missing/automatic choices and unsupported types omit a forced engine.
- `src/ui/diagram/style.js:12` executes the shared adapter with the contract embedded by `build/diagram-style.mjs:19`. VM checks recorded exact source strings and initialization calls for no source layout, global source layout, scoped renderer declarations, automatic and unsupported choices. Initialization input was not mutated. Parsed configurations were fixture values: this does not independently qualify the actual Mermaid parser.
- `src/ui/diagram/draft.js:47` accepts all seven supported style fields together. Undo/redo and save retained source colour declarations and unrelated opaque data. Unsupported imported layout values were preserved by unrelated source/font edits while attempts to replace them failed.
- `src/windows/domain.mjs:52` rejects unknown values, getter payloads, own symbols, duplicate reset fields and assignment plus reset. The independent fixture also exercised actual schema-2 `DomainRepository.apply` writes, manifest snapshots, one revision/version increment, idempotent exact replay and typed removal. Source references, other diagrams, Docs and unrelated envelope storage remained exact.
- `src/windows/domain.mjs:124` refused both overwrite and reset of unsupported imported string/null/object preferences, even with the fixture's downstream validator intentionally returning true. Failed operations did not alter saved snapshots.
- `build/import-validation.mjs:67` was separately evaluated in a VM for finite scalar admission and unsupported-prior refusal. Other legacy sanitizer functions were identity stubs because this check isolates the new layout branch; it does not qualify those sanitizers.
- `src/windows/presentation-deck.mjs:42` was exercised through the actual `NativePresentationDecks`, actual `WindowRegistry`, fake native handles and real project snapshots. The projection retained finite choices and exact literal source/colours; future/object preferences and private sibling content stayed outside the render context. Reading did not change storage.

## Preserved original adverse result

The first independent run was **8 passed / 1 failed**. Its Presenter fixture omitted `restore`, `close` and `destroy`, which the real registry requires. `WindowRegistry.openView` correctly refused that fake handle with `ACCESS_REFUSED`. The correction added those methods only to the reviewer's fixture. Production files were not changed by this reviewer. The original failing output is retained verbatim in JSON and is explicitly a test fixture error, not a product bug.

An earlier inspection hypothesis about a six-field style limit was not reproduced: the reviewed source already allows seven fields. The independent compound-edit regression passed. No invented RED or inferred production fix is claimed.

## Remaining qualification boundaries

Actual Mermaid frontmatter/init parsing, renderer geometry and registration/fallback behavior still require root's runtime qualification. The VM checks use real extracted helper code but stub `mermaid.parse` and diagram DB. They show adapter policy, not the physical layout that ELK or Dagre produces.

The prior static parity audit remains relevant: automatic must preserve the bundled default; the current preference does not prove an effective engine for every diagram family. App-theme versus OS-theme behavior in hidden Present rendering remains a separate issue. Export/Present image geometry and colour parity were not visually inspected here.

No `style-view.js`, window controller, Electron GUI, renderer build, package creation or hosted workflow was run or qualified by this report. The schema-2 model tests intentionally isolate main authority using a permissive downstream validator; generated scalar validation and existing validation-wrapper tests provide separate evidence rather than a claim of fully integrated Electron execution.

Artifacts:

- `reviews/2026-10-07-diagram-layout-model-independent.test.mjs` — nine independently authored checks.
- `reviews/2026-10-07-diagram-layout-model-independent.json` — original and final execution records, scopes and exact inspected identities.

