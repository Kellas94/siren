# Native Diagram Inspector and local filters implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, with the already authorized separate agents for bounded implementation/review. Track actual RED/GREEN and original evidence; do not replace independent reports.

**Goal:** Restore useful block annotations and faceted navigation in native Diagrams without changing imported data, export meaning or save authority.

**Architecture:** A finite metadata contract shared by the native owner, browser draft and isolated validator preserves opaque values. A view-local controller owns Inspector pending fields and Filters over current admitted SVG targets. Ordinary Diagram CAS Save/history/Lock remain the only persistence path.

**Tech Stack:** Existing JavaScript modules, browser DOM, Node tests, Electron native harness; no added library or IPC.

**Spec:** Approved workspace UI direction in 2026-10-06-siren-workspace-ui.md; detailed source inventory/acceptance in desktop/reviews/2026-10-07-diagram-inspector-filters-preflight.md. The user's accepted inline implementation and autonomous UI decisions remain in force.

## Global constraints

- Preserve frozen baseline, all unknown metadata/view fields and every source pointer at its original path. No read-time normalization or automatic save.
- Risk/control180, owner/system100, evidence600, reference220, frequency80 UTF-16 units; status empty/draft/review/approved/issue/resolved. Strict well-formed strings; reject invalid edits, never truncate them. Status is an annotation, not a release approval.
- 250 admitted semantic IDs; eight connected groups per ID; bounded facet/label work. Existing 50,000-character preview, 500-edge, 60-state/8-MiB history and domain budgets remain.
- Filters are window-local dimming only: AND across fields, OR within a field; preserve connecting edges, saved view, source/styles/history/project bytes and full saved SVG export. No hide/lanes/badges/default-view claim.
- Evidence/reference remain inert text. Public Audience/deck excludes nodeMetadata/view. No new bridge, shell privilege, release, installed replacement or main merge.
- Unsupported imported managed values are immutable at their exact path. Valid string siblings remain editable. This prevents nested-pointer loss and avoids creating an Undo state that cannot be saved; Inspector explains and disables those individual fields.

## Review focus

1. Opaque noncanonical imported data, nested source references and prototype-name node IDs must survive edit/Undo/Save exactly (Task1/2 tests).
2. Valid or invalid pending Inspector, Guided, Build and Style input must not disappear on selection/navigation/Refresh/Lock (Task3/4).
3. Current-render replacement and late callbacks must retire old targets; reset/remove filter projection must restore original SVG without attribute/style mutation (Task3/4).
4. Two independent windows, stale CAS and readonly context must retain exact local/saved data and deny writes honestly (Task2/4).
5. Filter counts, zero matches, Unicode/colliding values, unsupported grammar and capped target coverage must be truthful (Task3/4).

### Task 1: Finite metadata contract and native validation

Files: create desktop/src/documents/diagram-metadata.mjs, desktop/build/diagram-metadata.mjs, desktop/tests/diagram-metadata.test.mjs; modify desktop/build/import-validation.mjs, desktop/src/windows/domain.mjs and affected validator/owner tests.

Interfaces: export self-contained createDiagramMetadataContract() returning frozen fields (name→ceiling), statuses, update(before,{id,changes}) (preserved JSON map or undefined) and validate(value,before) boolean. Changes contain only managed string fields; empty string deletes just that key. Preserve absent map on no-op and remove an empty map only when it was originally absent; reset requires no opaque data loss. Browser global SirenDiagramMetadata uses the identical function. Native validation compares managed deltas to actual before, not legacy full-map sanitization.

- [x] Write/run RED cases for opaque retention, strict limits/status, no-op absence, prototype IDs, coercion/getters/symbols/new unknowns/pointer substitutions and invalid map changes.
- [x] Implement the shared bounded contract and embed it in the existing isolated CSP validator; retain general import sanitizer. Permit nodeMetadata reset only if the same finite validator proves removal safe; increase finite reset-key limit from6 to7.
- [x] Run contract and native-domain/validator tests; retain RED/GREEN output; coherent boundary committed with Task2 as f54a624.

### Task 2: Draft and bounded history

Files: desktop/src/ui/diagram/draft.js, dedicated desktop/tests/diagram-metadata-draft.test.mjs; browser build injection in Task3.

Interfaces: draft.editMetadata({id,changes}) → {ok,code?}; existing getDiagram/save/undo/redo/flushView remain. Include optional nodeMetadata in history snapshots; no broad setStyle widening. Metadata source/style save is one existing replace-content CAS. Undo to original absence uses guarded resetStyleFields.

- [x] RED tests for no-op clean inspection, one-operation Undo/Redo, optional absence, combined exact Save, opaque/source retention and readonly/pending/fenced refusal.
- [x] Implement finite edit operation and history/reset integration; reuse contract and existing byte/state limits.
- [x] Run draft/history/domain tests and commit without changing original native harnesses; committed f54a624.

### Task 3: Themed Inspector and local Filters

Files: create desktop/src/ui/diagram/annotations.js, focused controller tests; modify desktop/src/ui/windows/diagram.js, desktop/src/ui/diagram/window.html, desktop/build/diagram-window.mjs.

Interfaces: SirenNativeDiagramAnnotations.create({inspectorHost,filtersHost,inspectorButton,filtersButton,diagramFor,editable,enabled,onEdit,onStatus,onPending,onProjectionChange}) returns paint(), bind(svg,targets), invalidate(), isEditing(), guard(), cancel(), select(id), isInspecting(), pause(), resume(), dispose(). guard() returns false with an explicit Apply/Cancel message if any Inspector fields are pending; it never autosaves or discards them. onEdit delegates only draft.editMetadata. Current target picker and pointer picking are explicit Inspect mode. onProjectionChange exits Walkthrough; no blanket key/pointer takeover.

- [x] RED focused tests for pending preservation/refusal, readonly, finite target/facet bounds, AND/OR/reset/zero matches, Unicode and source-style restoration.
- [x] Implement two compact toolbar buttons opening an overlay side panel/popover inside preview, preserving canvas height. Inspector Owner/Status/System/Frequency visible, detail groups for other fields, explicit Apply to draft/Cancel. Retained unsupported existing values are explained, individually disabled and left exactly unchanged; valid sibling fields remain editable. Pending other editor focus must survive toolbar pointerdown.
- [x] Implement local facets Owner/Status/System/Frequency/Class using current targets only; dim unmatched groups through removable external CSS projection without SVG/style mutation or source-colour override. Deduplicate nested target groups to avoid repeated dimming; retain edge context and truthful coverage/export copy.
- [x] Wire every destructive/context transition through guard; invalidate targets synchronously on source/appearance/history/Refresh/error/prepare/dispose. Lock refuses pending Inspector fields honestly and resume retains them. Integrate paused/readonly/pending states and saved-version auto-refresh gates.
- [x] Run focused plus existing Diagram session/Walkthrough/style/history/placement/security tests and regenerate through the established fresh-output build path.

### Task 4: Genuine behavior qualification and review

Files: new desktop/tests/native/diagram-annotations.mjs; narrow CI native/copy/artifact integration only after successful actual execution; root and genuine separate review reports.

- [ ] Execute genuine native readonly/working flows, explicit Apply/Cancel, exact Save/Undo/reopen, two-window filters and stale conflicts, pending invalid fields/valid Style20/title, theme/source/error lifecycle and common Lock. Preserve first adverse result and all original harnesses/oracles.
- [ ] Verify full saved SVG/export and Audience exclusion plus exact project/source pointers before/after local filtering. Explain any acceptance that is unit-only, development-only or untested physical monitors/IME.
- [x] Freeze inputs, run appropriate full suite and affected original native regressions, then build a separate preview, verify every archive member/helper/runtime and actual copied annotations/regressions. Genuine final reviewer reports authorship/execution limits; root qualification remains separate.
- [ ] Record checkpoint/remaining parity; guarded canonical delta only after preceding hosted FINAL originals are retained. No rerun-to-pass, production release or installed replacement.

## Self-review and ledger

Scope includes only managed annotations and local dim filters. Hide/lanes/badges, default-view persistence, comments/links/icons, Docs creation from nodes, filtered export and diagram capacity increases remain open. Current common domain CAS, export and public deck contracts are reused. No additional design approval is needed for this migration within the approved functional parity work.

Tasks1/2 committed f54a624; Task3 implemented and corrected with actual native8 and eight original development regression programs, all inputs unchanged within each execution. Root actual original contract RED6/GREEN6, added owner/helper RED3/GREEN39, draft RED5/GREEN53 retained. Genuine independent Tasks1/2 report c9705c78 found R1 managed-field pointer loss and R2 invalid scalar correction→Save→Undo→Save refusal. Root correction tests retained4RED→GREEN70 combined, using immutable unsupported-value preservation, not widening invalid renderer admission. Original adverse report remains separate/unchanged. Final full suite, GUI and package qualification pending.

Ruling: unsupported managed values remain immutable here; valid siblings can be edited. This trades correction of malformed imported annotation fields for exact pointer/history preservation. A future explicit migration would need a separately trusted historical-restoration contract and is not silently granted by Inspector.

## Task3/native checkpoint 2026-10-07

Actual Task3 author132 focused passed with unchanged captured inputs, not GUI. Genuine original Task3 review209414e0 retained upstream250 nondisclosure and missing real-opacity/edge native oracles. Root native original ADVERSE0 and passive diagnostic prove getter-only textarea.type initialization crash; root added actual RED1/GREEN21 regression and minimal input-only assignment. Actual upstream adapter regression RED1/GREEN22 then conservative>=250 notice. Originalharness retained; strengthened native reads actual group opacity/connecting edges and Reset plus unchanged savedSVG/project/source. Corrected native qualification currently running, no current full-suite/copy/hosted success claimed. Prior hosted375616 FINAL SUCCESS/readback86 belongs only previous HTML correction.

## Native and regression result checkpoint

Actual root native COMPLETE8 at02:47:31.275Z, unchanged captures, confirms local CSS dimming/real edges/Reset, readonly/Unicode, pending Refresh/Lock rollback, Apply/Undo/Redo, exact Save/source/opaque/Docs/view, full saved XML SVG labels, valid pending Style20/focus/Dark, separate state/window filters, stale peer and ordinary Lock/recovery. Original development Edit4/Guided4/Style6/Build7/Walk8/History8/vector/dock5 programs all completed under unchanged captures. Original first fullsuite ADVERSE1416/1417 solely existing transitive-package test: required diagram-metadata.mjs absent from finite allowlist. Original focused RED preserved; one module added, six package tests GREEN; final fullsuite currently running. No Diagram/controller/harness/generated bytes changed for packaging. Genuine separate recheck a35110d5 verifies original R1/R2 corrections and getter-only textarea behavior in its narrower source/probe scope, with timestamp-qualified native receipt readback; no independent GUI or packaging claim. Portable preview/copy and fresh hosted qualification remain pending. Invalid-field/theme/source-error/full Audience/physical matrix are not claimed from the bounded native8.

## Local portable-copy qualification complete

Source a60300ea3d36f711ae99f1991824c5304cd6a1ae; actual final full1417/1417 zero skipped/failed, native annotations8, eight original affected development programs. Separate preview development-ecc5ce34-f474-4667-b4e9-5a287d4cd9b8: exact297 packed members plus original runtime/fixedhelper, ASAR54402462B/4a1351922453d06db097d8a7a3ccada4da6c2cded15c76e1b17cca57eddbc393. Ten original copied programs COMPLETE/unchanged (annotations8, Edit4/Guided4/Style6/Build7/Walk8/History8/Dock5/shell4/core). Root separately rehashed30 copied ASAR/runtime/helper files, all exact. Compared with previous package: only added diagram-metadata.mjs and changed generated/build.json, generated/import-validation.html, generated/windows/diagram.html and src/windows/domain.mjs;292 unchanged/no removals. Development vector remains separate because its original harness ignores package args. Original author reports/review/recheck/root precommit/copyqualification remain separately attributed. Fresh canonical sync/hosted verification is next, not yet executed at this qualification.
