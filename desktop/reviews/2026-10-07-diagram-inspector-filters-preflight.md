# Native Diagram Inspector / Filters — read-only preflight

Author: `/root/media_batch_review`. Date: 2026-10-07. Scope: source inspection and a proposed bounded migration, not implementation, independent approval, native execution, package qualification or CI verdict. No product, tests, generated assets, workflow or historical reports were edited. No GUI was launched. The previously retained Walkthrough, history and typography receipts remain separate.

## Conclusion

The next coherent tranche is **block metadata Inspector plus local faceted filtering**. These functions use data already retained in native projects and provide useful navigation beyond editing Mermaid. They fit the approved workspace UI plan's real-control/parity requirement (plan lines 3–14). Do not transplant the whole legacy inspector: text/shape/style are already provided by Build/Style, while links, icons, comments and creating linked Docs require additional contracts.

Two design decisions should be explicit in the implementation plan:

1. Inspector edits the eight managed metadata fields in a working Diagram draft, with ordinary explicit Save and bounded history. Read-only diagrams can inspect and filter without writing. Preserve all other metadata exactly.
2. Initial filters are **local view state**, separately owned per native window; they neither dirty a diagram nor alter saved `view`, source, history, backups or SVG exports. Start with dimming unmatched admitted nodes and keep connecting edges visible as context. Label this behavior accurately. Hide mode, lanes/badges and saving a default view are separate parity items, not decorative unavailable controls or implicitly completed work.

This is intentionally a smaller coherent migration than all legacy view behavior. If full Hide parity is required in this tranche, the prerequisite is a verified bounded edge-endpoint adapter; guessing edge identity from Mermaid DOM ID substrings is not sufficient.

## Actual reference behavior

`baseline/R78.html:24366` defines `sanitizeNodeMetadata`: at most 500 entries; ID pattern `^[A-Za-z_][\w.-]*$`; risk/control 180 UTF-16 units, owner/system 100, evidence 600, reference 220, frequency 80; status empty/draft/review/approved/issue/resolved. These are annotation values, **not actual review authorization**. The function reconstructs known fields, string-coerces/truncates values and drops unknown per-node fields. `nodeMetadataFor` at 44441 even sanitizes the complete map on read; saving at 44460 sanitizes it again and schedules automatic save/history. Those destructive/read-mutating/autosave semantics must not be copied.

`makeDefaultView` at 38035 and `sanitizeView` at 38039 define `laneMode`, `laneField`, `badges`, `badgeField`, `filterMode` (dim/hide), and filters for owner/status/system/frequency/class. The sanitizer reconstructs known fields and drops unknown view data. The reference keeps read-only views in a local map, while writable changes at 38492 schedule project save and a new render. `nodePassesFilters` at 38101 is AND across fields, OR within one field, exact string membership, with no active filters matching all nodes. `renderFilterPanel` at 38430 offers actual distinct values and counts. `applyViewToSvg` at 38115 changes SVG attributes for dim/hide and attempts edge matching with semantic edge keys plus ID-pattern fallbacks. Metadata badges/lanes are additional drawing behavior, not synonymous with filtering.

The legacy inspector also contains shape/text/style controls, links/icons, Docs actions and comments. The next tranche should expose these only where an existing native action genuinely supports them; otherwise leave them out and record their remaining parity status.

## Current native boundary, not an implemented feature

- `src/windows/domain.mjs:14–15,99–140` already retains `nodeMetadata` and `view` within diagram data and permits them in the general style-field allowlist. It uses exact entity/version and project/source integrity, operation receipts and readback, and the existing recovery commit. This is not evidence of a native editing UI or sufficient field-level validation.
- `src/ui/diagram/draft.js:14,44–69` currently manages history/style changes for title, typography and `nodeStyles` only. Adding metadata through `setStyle` currently refuses it; history does not yet snapshot it. Implement a finite metadata operation, not arbitrary JSON editing or widening all style fields. Reuse the draft's explicit Save/CAS/fencing lifecycle; extend history within its existing 60-state/8-MiB budget. Do not delete unrelated data when Undo removes a managed value.
- `build/import-validation.mjs:63–72` compares `sanitizeNodeMetadata(value)` and `sanitizeView(value)` with the entire candidate. An opaque imported map cannot be safely edited by merely feeding the whole preserved map to these normalizers: preserving unknown values may cause refusal; normalizing it would lose them. A narrow native validator should validate only managed changes against the actual saved `before`, require every opaque/unmanaged value and source pointer to remain identical at its original path, and reject new unknown fields. Do not weaken general import or source-bundle validation. Use own-property checks and data descriptors; valid IDs such as `constructor`/`toString` must not use inherited lookup.
- `src/ui/diagram/style.js:1–6` returns actual rendered semantic targets, capped at 250 IDs. `diagram.js` binds the current render/session and Walkthrough to this adapter. Reuse the admitted target set/current-render token rather than reparse Mermaid with a new regex. Apply the existing bounded group limit and explicitly report partial target coverage. Unsupported grammar/render targets must not look fully inspectable.
- `diagram.js:110–117` already owns pan/zoom, Build selection/context menu and double-click Style. Preserve those gestures. Inspector selection must be an explicit mode/action or a selected-ID picker, with no blanket pointer/keyboard takeover.

## Minimal useful UI and data contract

Add two compact real toolbar controls: **Inspect** and **Filters · N**. Inspect opens one themed collapsible side panel (not another permanent toolbar row); provide a semantic ID + safe rendered caption picker and Previous/Next only if useful. Pointer picking happens only in explicit Inspect mode and only on current admitted targets. Show all eight fields with Risk/Control and Evidence/Reference progressively disclosed, leaving Owner/Status visible. Show read-only state and the actual working/saved context. Do not call status `approved` a release approval. Reference/evidence remain inert text; do not execute URLs or create navigation/source authority from them.

Use explicit **Apply to draft** / **Cancel** for inspector fields. Applying a valid delta produces one history entry; ordinary Diagram Save publishes it. Clear a managed field by deleting only that key (or an explicitly documented canonical empty representation), preserving the remaining node object and unknown fields. Delete the node entry only if it has no own fields afterward. Preserve absent `nodeMetadata` on a no-op inspection. Existing noncanonical/unsupported values can be shown as retained text with an explanation; opening/closing must not normalize them. Refuse overlength/invalid new inputs visibly rather than truncate them. A target change, history restore, Save/Refresh/navigation or Lock preparation must either apply an explicit accepted operation or retain/refuse pending fields; it must not silently drop valid or invalid input.

Filters popover: Owner, Status, System, Frequency and Class with bounded facet values/counts from **current admitted rendered targets**; AND across fields, OR within a field; Reset; matched/total count; an explicit zero-results state. Initially no synthetic `Unassigned` string that could collide with real data; a later missing-value option needs a tagged predicate. Counts are total current-target counts, not silently dependent on active filters. Exact Unicode values are displayed with textContent and compared literally. Metadata for absent/unrendered node IDs remains stored but is excluded from these counts with a clear coverage note.

Projection must not mutate original SVG/source/style metadata. Prefer a scoped external class/style overlay on admitted groups that can be removed completely; do not change fill/border/text or write dimming into exported SVG. Where a source declares opacity, use a temporary composition mechanism which restores the exact original computed/source semantics when filters reset. Filtering must not change layout or capture pointer events unexpectedly. Local inspector selection and Walkthrough should share current-target validity; retire/exit the active Walkthrough before changing the visible target subset, never leave a focus overlay on an unavailable target. Do not use focus/blur to accidentally commit pending Style/Build/Guided fields when opening these controls.

Seed supported local filter values from a bounded, read-only projection of saved `view.filters` only if the implementation explicitly promises this behavior. Do not apply unsupported imported hide/lanes/badges implicitly: state that those saved features are retained but not yet applied. Keep unknown saved view fields and untouched filter fields exact. Local resets/changes do not erase authored settings. Saving a default view can follow later as a separate finite draft operation and explicit user action, with its own validation/history/export tests.

## Persistence, exports and privacy

`NativeDiagramExports` (`src/windows/diagram-export.mjs:28–65`) captures exact saved entity version/hash, renders main-owned saved content and publishes only after guarded write/readback. `src/ui/diagram/vector.js:37–43` applies saved style/title but no metadata/filter view. Therefore the first filter tranche should keep **Export saved SVG** as the complete saved diagram, with a short truthful explanation while a filter is active. Do not serialize live renderer SVG, unsaved annotations, filter dimming or selection overlays. A future explicit filtered export must have a distinct bounded main-owned projection and captured filter contract; it is not achieved by this tranche.

Saved metadata and opaque authored `view` continue through the existing full project/source-backed backup and manifest path. Working metadata edits become durable only through the actual saved receipt; read-only/local filter interactions must leave exact project bytes, version, source refs, history, operation IDs and saved checkpoints unchanged. A second native window owns independent local filters and selection; saved metadata changes elsewhere follow existing explicit Refresh/conflict behavior rather than silently merging.

`src/windows/presentation-deck.mjs:11,37–43` deliberately excludes `nodeMetadata` and `view` from public render style keys. Keep that exclusion: Inspector evidence/owner/reference and local filter state must not enter Audience or public slide payloads. No new general bridge is necessary; use existing granted diagram reads/finite writes and common Lock lifecycle. Lock/disposal must clear rendered annotations/selection and local controllers; do not grant export or new write authority to another role.

## Concrete acceptance before delivery

1. Metadata unit roundtrip: one target edit, Unicode/exact limits/status controls; unknown nested objects and embedded opaque source refs at original paths remain exact; other nodes/diagram/source/metadata remain exact; prototype-name IDs work without prototype mutation. New unknown fields, pointer substitutions, coercions, overlength and unsupported status refuse without partial mutation.
2. Draft/history: no-op inspect does not dirty; Apply is one undoable delta; Undo/Redo preserves optional absence and unrelated keys; metadata + source/style Save is a single exact entity CAS; conflicting second window/fenced/readonly operations refuse; incomplete pending fields remain visible on refused actions. Existing history byte/state limits stay enforced, with no unbounded duplication of node maps per keystroke.
3. Facets/projection unit controls: AND/OR/empty/zero matches, duplicates, Unicode, absent/nonstring retained data, class facet, targets beyond cap/duplicate groups; reset restores exact SVG styling and geometry; no hidden edge assumptions; unsupported saved view fields retained. Old asynchronous render completion cannot reapply obsolete filters or selected IDs.
4. Genuine native: saved readonly and working windows for Unicode flowchart and state diagrams; real Inspect/Filters pointer + keyboard interactions; metadata Apply/Cancel/Save/readback exact bytes; readonly input cannot write; valid Style20/title and invalid Style/Guided/Build pending inputs survive opening/filtering/target selection or visibly refuse; text inputs retain normal keys and Tab/Escape semantics.
5. Two windows/two diagrams + attach/detach: filters/selection isolate, working draft continues, second-window Refresh/CAS conflict is honest. Theme changes preserve source colours and field text. Error/Refresh/source change/hidden preview/Lock retire current SVG targets and overlays. Common Lock drains only real accepted writes and forbids later callbacks from resurrecting content.
6. Export/privacy: compare saved manifest/backup before/after every local filter action; saved SVG remains full and contains no inspector evidence/filter decoration/unsaved changes; explicit saved metadata survives reopen; public Audience/deck requests contain no metadata or view. Retain first adverse receipts and distinguish development/copied/hosted execution.

Existing suites to extend narrowly: `diagram-draft.test.mjs`, `domain-owner.test.mjs`, `domain-validation.test.mjs`, `diagram-session.test.mjs`, `diagram-style.test.mjs`, `diagram-walkthrough-window.test.mjs`, `native-diagram-reads.test.mjs`, `native-diagram-export.test.mjs`, `presentation-deck.test.mjs`. Add dedicated metadata validator/controller/filter units and one bounded native Inspector/Filters harness rather than claim old suites cover the new feature. No tests were executed for this analysis.

## Bounds and remaining decisions

Retain current preview limits (50,000 source characters / Mermaid maxEdges500), domain copied-data bounds and history bounds. This tranche does not increase large-code or large-diagram capacity. Cap target enumeration at the existing 250-ID admission; cap group work, facet items and total rendered text before allocation. Validate new values strictly using the legacy field ceilings, without rewriting existing retained data. No network/manual knowledge library is needed for these annotations. Lanes/badges/hide, authored default-view saving, comments, link/icon editing, Docs creation from a node, filtered export, richer diagram grammars and physical-monitor/DPI/IME UX remain separate open scopes. These are design recommendations, not permission or independently approved implementation.

## Source identities inspected

SHA-256 of current workbytes during this read-only inspection (not an assertion of Git/hosted byte equality):

| File (desktop-relative unless `../`) | SHA-256 |
|---|---|
| `baseline/R78.html` | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |
| `../docs/superpowers/plans/2026-10-06-siren-workspace-ui.md` | `1a8ab87d3ad6bab18a1f18e75c3281c425f8fa66de7dc7a0663a8499b95f0abb` |
| `src/ui/windows/diagram.js` | `1900c032ae0599f5ebd8e225af70fba6148d37ca049d18d64ad4c8abc64cc5dd` |
| `src/ui/diagram/draft.js` | `57c87befd6724b9d104f2ab12a3b3bc78329b8c444e26a3c1dbad86cac933de3` |
| `src/ui/diagram/style.js` | `c8e6c2c2bb598e513e844ac526113efa1fa639a3ca84ba663895a09b243d04e4` |
| `src/ui/diagram/walkthrough.js` | `c6623d7681ad2613f073dadc19734f5dbb16f779a6184cdff6ea6367015697c3` |
| `src/windows/domain.mjs` | `1895bbf07b58afe2757f3ec4ea2394ef5caf0637465a3daee7770e8d95fc9e26` |
| `src/projects/domain-validation.mjs` | `c06b47d6263e173c72ef6d373a273be53441a42b9dc851bbfba9ba39cdaf78a8` |
| `build/import-validation.mjs` | `85381f438093d6a6d8633e7938e5e3e14398ff5fb8a8be3182cdeb9e4968d8c5` |
| `src/windows/diagram-export.mjs` | `f9aef5b688a413cb9bd70b59c4e2aaf419bdc78bf3d300249ffdfb7226b03186` |
| `src/ui/diagram/vector.js` | `d18ae5098c189f8eaee1299e27d60b4bbcb3ba24c51cd13996e1dca8962cda28` |
| `src/windows/presentation-deck.mjs` | `61c8550a23a7b8a74a9b4d7e01425b7a68e80f6b092ce689fb621df81f9fc51e` |
