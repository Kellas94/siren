# SIREN v1.35.0 engineering review

This review is based on static inspection plus browser runs against the real application served over HTTP. The generated fixtures are in `qa/fixtures/`; screenshots are in `output/playwright/`. Locations below are searchable strings, not line numbers.

## Confirmed findings

### Critical — stale tabs overwrite newer whole-workspace saves

- Location: `channel.onmessage = event =>` and `function saveState()`.
- Failure: open two tabs on the same workspace. In tab A, replace the diagram with `CROSS_TAB_A_SENTINEL` and let it save. In stale tab B, change only the file name. Before the fix, the persisted source reverted to the old default and the sentinel disappeared.
- Fix: `A07_prevent_cross_tab_clobber.py` exposes remote-store notifications; a stale branch is blocked and kept under a conflict-recovery key instead of replacing the main state. `A07b_ignore_identical_remote_snapshot.py` prevents an unchanged startup write from creating a false conflict.
- Verification: after both tabs loaded the same normalized state, tab A saved `CROSS_TAB_FIXED2_SENTINEL`; tab B showed `Local save failed` with an explicit reload/export instruction. After closing B and reloading A, the sentinel remained and B's `tab_b_unrelated_change` file name did not land.

### Critical — portable project import permits prototype pollution

- Location: `function deepMerge(target, source)`.
- Failure: import `prototype-pollution.siren`, whose state has an own enumerable `__proto__` key. Before the fix, `({}).sirenImportedPrototypePollution` was `"confirmed"` and `Object.prototype` owned the property.
- Fix: `A01_harden_deep_merge.py` blocks `__proto__`, `prototype`, and `constructor` recursively and merges only own target properties.
- Verification: the same file was imported through the real Import dialog; the own-property check is now false.

### High — valid imported fields are truncated on their next edit

- Location: `editor.innerHTML.slice(0, 40000)`, `cell.textContent.slice(0, 2000)`, `row.value = value.value.slice(0, 1000)`, the test-run field cap array, and `row.notes = notes.value.slice(0, 600)`.
- Failure: import `cap-mismatch-document.json`, then type one character into each long field. Before the fix, persisted lengths became 40,000 for rich text while focused, 2,000 for the table cell, 1,000 for the setting, 4,000/8,000/2,000 for run input/output/notes, and 600 for source notes. Every fixture tail was lost.
- Fix: `A04_align_edit_limits_and_unbound_register.py` makes every editor use the corresponding `WP_LIMITS` value and reports a real cap if reached.
- Verification: the same one-character UI edits persisted lengths 50,025, 3,018, 1,521, 5,019, 9,020, 2,519, and 1,029. All seven `*_END_SENTINEL` tails survived, including rich text while it still held focus through autosave.

### High — imported dangling diagram links vanish and the report claims a whole import

- Location: `function sanitizeWorkpaperLink(raw)` and `function importWorkpaperDocument(payload, fileName, sourceName, sourceChars)`.
- Failure: import the supplied 311,895-byte Agent Spec. Its three diagram links are absent from the workspace. Before the fix, all three disappeared, the link row contained zero chips, and the report said everything arrived whole.
- Fix: `A03_preserve_dangling_links.py` carries imported links through sanitisation, retains unresolved targets as disabled dashed chips, and records the unresolved count separately from trimming.
- Verification: the fixture still imports as 39 blocks and 254,000 knowledge characters with zero trim lines; it now shows three removable unresolved chips and the toast says `3 unresolved references retained`. Screenshot: `output/playwright/A03-dangling-links.png`.

### High — a 61-document project silently becomes 60 documents

- Location: `const MAX_WORKPAPERS = 60` and `sanitizeWorkpapers(list, report)`.
- Failure: open `project-61-documents.siren`. Before the fix, IndexedDB held only documents 1–60, document 61 was absent, and the only toast was `Project restored with 1 diagram.`
- Fix: `A04_align_edit_limits_and_unbound_register.py` removes the register-wide tier; per-document guards and browser storage remain the actual limits.
- Verification: the same UI import persists 61 documents, includes and activates `QA document 61`.

### High — older IndexedDB-only saves are ignored

- Location: `const managedKeys = () =>` and `function loadPersistedState()`.
- Failure: store a valid v22 state only in IndexedDB under `t-industries-siren-v22-state`, with no current key and no localStorage copy. Before the fix, SIREN opened the default diagram instead of `LEGACY_IDB_SENTINEL`.
- Fix: `A02_migrate_legacy_indexeddb.py` hydrates legacy state/draft/library keys and checks the store before localStorage on every legacy path.
- Verification: the identical seeded profile now opens source `flowchart TD\n  LEGACY_IDB_SENTINEL[...]` and migrates it to the current session.

### High — workpaper-only recovery drafts are not offered

- Location: `function offerCrashRecovery()` and `function writeDraft()`.
- Failure: seed current and draft with identical diagrams, but put `DRAFT_WORKPAPER_SENTINEL` only in the draft. Before the fix, no recovery dialog appeared and the first boot-time draft could replace the only document-bearing copy.
- Fix: `A05_recover_complete_workspace.py` compares diagrams, active id, and workpapers; its shrink guard also protects document counts while allowing explicit deletes/project replacement.
- Verification: the same profile now offers `1 diagram and 1 document`; choosing Recover persists the sentinel document.

### High — duplicate imported diagram IDs make the later diagram unreachable

- Location: `id: diagram.id || makeDiagramId()` inside `function ensureWorkspaceState()`.
- Failure: import two diagrams with id `duplicate-diagram-id`. Both tabs address the same id, so switching resolves the first and the second source cannot be opened.
- Fix: `A08_repair_duplicate_diagram_ids.py` preserves the first id, assigns collision-free ids to later diagrams, and explicitly says ambiguous existing links remain with the first.
- Verification: `duplicate-diagram-ids.siren` reports one reassigned id; clicking the second rendered tab selects source `SECOND_DUPLICATE_SENTINEL`.

### High — a release hash and its displayed snapshot can describe different edits

- Location: `async function captureAgentRelease(doc)`.
- Failure: on a large Agent Spec, edit operational content while WebCrypto is hashing. The old flow gathered parts for some hashes, awaited, then reread the live document for the snapshot and size check.
- Fix: `A09_stabilize_agent_releases.py` freezes `agentOperationalParts(doc)` once and derives the package/subhashes and snapshot from that same immutable value. It also uses a per-document generation token so an older drift calculation cannot overwrite a newer result.
- Verification status: the pre-fix race is confirmed from the separated reads across `await`; it was not forced with a deliberately delayed WebCrypto implementation. The patched app is syntax-clean and boots with zero console errors.

### High — malformed imported release snapshots bypass schema guards and can throw when opened

- Location: `if (entry.snapshot && typeof entry.snapshot === 'object') clean.snapshot = entry.snapshot` and `(snapshot.prompts || []).forEach`.
- Failure: import a release with `snapshot.prompts` as an object, or with unbounded prompt/knowledge arrays. Import accepts it; opening Snapshot calls `.forEach` on a non-array, while very large opaque values remain uncapped in state.
- Fix: `A09_stabilize_agent_releases.py` adds a strict, reporting snapshot sanitizer for every documented field and defensive array checks in the renderer.
- Verification status: the throw is source-confirmed; the patched ingress and renderer were syntax/runtime smoke-tested, but a malformed release fixture was not driven through every release-panel action.

### High — the first release capture crashes on an Agent Spec without an ID

- Location: `function ensureAgentIdentityForRelease(doc)` and `function agentOperationalCanonFromParts(parts)`.
- Failure: import or create an Agent Spec with no typed agent identity, open Releases, and choose `Capture release`. The old initializer made only `{ schema, agentId }`; the fingerprint canon then read `parts.meta.oversight.mode`, threw `Cannot read properties of undefined`, and recorded no release.
- Fix: `A12_initialize_release_identity.py` passes partial/legacy metadata through `sanitizeAgentMeta`, assigns the ID on that complete shape, and preserves the existing settings-row version adoption.
- Verification: the same no-ID fixture captured R1 and R2 through the real Releases UI with zero page errors. Both snapshots contained their provenance, and changing only `confirmedAt` left both package and knowledge SHA-256 fingerprints identical.

### High, not fixed — restoring an imported raw revision can silently truncate its evidence

- Location: `revisions: (Array.isArray(doc.revisions) ? doc.revisions.slice(0, 6) : [])` and `doc.blocks = (revision.blocks || []).map(sanitizeWorkpaperBlock)`.
- Failure: import a document whose archived revision contains an over-limit rich-text or Knowledge block with a tail sentinel. Import retains the revision blocks raw and unbounded; choosing Changes → Restore later applies the normal caps without an import-style report, so the tail can disappear silently. Up to six hostile snapshots can also remain opaque and large in every save.
- Fix: not made. A safe change must keep the raw revision recoverable, sanitise into a separate restore candidate, show the exact `wpCut` report before committing, and let the user export/cancel instead of blindly capping historical evidence.
- Verification status: the raw-ingress and unreported restore control flow are source-confirmed; an adversarial revision was not restored through the UI. This remains an explicit data-integrity gap.

### High, off limits — Present loses arrowheads with duplicate marker IDs

- Location: `function presentationSvgForDiagram(diagram)` and `el.presentStage.innerHTML = svgString;`.
- Failure: render `flowchart LR; A[Origin] -->|CENTRE EDGE LABEL| B[Target]`, then open Present. The editor shows the arrow; Present shows only the line. The marker id occurs twice and the Present path's global lookup resolves to the editor SVG.
- Fix: not made. Present is the other engineer's territory. Handoff: namespace marker ids per rendered SVG and rewrite every `url(#...)` reference before insertion.
- Evidence: `output/playwright/agent-present/editor-arrowhead-reference.png` and `present-arrowhead-missing.png`.

### High, off limits — the presentation route badge covers an edge label

- Location: `function mapRenderThread()` and `return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };`.
- Failure: on the same two-node diagram choose Present → Build the presentation. A route dot overlaps `CENTRE EDGE LABEL` by 61.15 × 26.26 CSS px (1,605.8 px²).
- Fix: not made. Handoff: collision-aware candidate placement around the view anchor, avoiding label/card rectangles.
- Evidence: `output/playwright/agent-present/map-step-badge-edge-label-overlap.png`.

### Medium-high — a rapid edit then document switch loses the Docs undo step

- Location: `let workpaperHistoryTimer = null` and `function scheduleWorkpaperHistory(doc)`.
- Failure: edit document A, switch to B within 500 ms, and remain there. The one global timer later sees that A is not active and returns without recording A's change.
- Fix: `A06_teardown_docs_runtime.py` gives each document its own timer and flushes it on commit/switch and before Undo.
- Verification: append `UNDO_RACE_SENTINEL`, switch away for 700 ms, return, and click Undo. Undo was enabled, removed only that sentinel, and retained `TEXT_END_SENTINEL`.

### Medium — Docs retains deleted-document clones and a detached-heading scroll closure

- Location: `const workpaperSessionBaselines = new Map()`, `const workpaperHistory = new Map()`, and `function renderWorkpaperContents(doc)`.
- Failure: repeatedly import/open/delete 250k-character documents. Baselines and history strings remain keyed by deleted ids. Switching from a document with at least four headings to a shorter one returns before removing `wpContentsScrollHook`, retaining detached heading nodes.
- Fix: `A06_teardown_docs_runtime.py` prunes per-document maps/timers/drift state, disposes on delete, and tears down the observer/listener on every rerender, early return, empty state, and Docs close.
- Verification status: lifecycle endpoints are source-verified and the rapid-switch UI path passes; a long-duration heap-growth run was not performed.

### Medium — prompt version six is silently discarded

- Location: `block.history = block.history.slice(0, 5)` and `block.history.slice(0, 5)` in the prompt sanitizer.
- Failure: complete six non-empty prompt sessions. The earliest exact version disappears from state and export without a warning or import-report line.
- Fix: `A10_report_prompt_history_limits.py` keeps 60 exact versions and makes both runtime eviction and import trimming explicit.
- Verification status: source-confirmed and syntax/runtime smoke-tested; sixty-one manual prompt sessions were not replayed.

### Medium — the supplied syntax checker checks another file

- Location: `P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'` in `syncheck.py`.
- Failure: edit this working copy into invalid JavaScript and run the supplied command; it reports the unrelated Downloads file instead.
- Fix: `A11_fix_syncheck_target.py` defaults to the SIREN file next to the harness and accepts an explicit path.
- Verification: the corrected harness extracted one 2,612,494-character inline script from this working copy and `node --check` exited 0.

### Medium — the empty Docs state creates the wrong document type

- Location: `const startNewWorkpaper = (pickedType) =>` and `wpEmptyNewButton.addEventListener('click', startNewWorkpaper)`.
- Failure: with no documents, click “Create the first workpaper”. The listener passes a truthy click `Event`; `normalizeWorkpaperType(Event)` falls back to `narrative`, so the document is Narrative even though this path's intended default is Agent spec.
- Fix: `C7_remove_confirmed_dead_code.py` removes the nonexistent `wpNewType` cache/branches and accepts a menu choice only when it is a string; a click Event now selects `agent-spec` explicitly.
- Verification: the disposable and applied C7 applications created type `agent-spec`, title `New agent specification`, and displayed the Agent strip and Releases control with zero page errors.

### Medium — register search rescans multi-megabyte documents on every key

- Location: `function workpaperMatchesFilter(doc, filter)` and the `el.wpSearch.addEventListener('input', ...` binding.
- Failure: build a 25-document register containing approximately 6.3 million characters, then type a six-character query. Before C6, each non-empty key synchronously rebuilt and lowercased the document text: 13.1 ms median, 15.9 ms p95 and 18.0 ms maximum per key, or about 78.6 ms distributed across six input handlers.
- Fix: `C6_performance_pass.py` adds a per-document WeakMap search-text cache, invalidates it through `touchWorkpaper`, and debounces the actual register scan by 120 ms.
- Verification: the input handler fell to 0.3 ms median / 0.6 ms p95; one cold deferred build took 38.2 ms and warmed scans took 0.5 ms.

### Medium — waypoint clicks silently fail on direct and CSS-stroked Mermaid paths

- Location: `function selectedEdgeVisiblePath()`.
- Failure: in the default seven-block diagram select D→C, click “Click preview to add”, then click the preview. Before the fix, the first `[data-edge-key]` match is the `<path>` itself, but the code searches only its descendants and returns `null`; the click falls through to another edge, no waypoint appears and Undo remains disabled. C→G also fails because its visible paths receive stroke through CSS and do not match `path[stroke]`.
- Fix: `A13_fix_direct_edge_waypoint.py` accepts a matching tagged path itself or a matching descendant, excludes hit areas/transparent paths, and does not return `null` before checking later matches.
- Verification: through the real UI, both D→C and C→G created `Waypoint 1`, enabled Undo, exited waypoint mode and rerendered through the clicked intermediate point; console errors/warnings were zero. Evidence: `output/playwright/A13_current_post_C7_waypoints.png`.

## Confirmed work and deliberate deferrals

- C6 removed 261,941 eagerly assigned textarea characters when opening the supplied document: the five 254,000-character Knowledge payloads remain canonical but hydrate only on reveal, edit or Find. The open-document timing change was modest/noisy (24.2/35.5 ms sync/paint baseline versus 23.5/34.5 ms), so the claim is reduced DOM payload, not a dramatic opening-time win.
- `function refreshWorkpaperChangeMarkers(doc)` still performs per-block lookups that are O(n²) in source shape. Real typing near block 39 measured only 1.2 ms for the input handler and 1.2 ms for the deferred marker scan; the candidate rewrite was deliberately removed because no user-visible regression reproduced.

## Review boundaries

- Present/Map/deck/card/ambient code was inspected and exercised only for the two handed-off defects; it was not edited.
- Microsoft PowerPoint interoperability was exercised for C5: the mixed, simple-table, large-document and scoped multi-document decks opened without repair and rendered every slide. No long-duration memory soak, assistive-technology screen-reader pass, non-Chromium browser matrix, macOS PowerPoint run or LibreOffice Impress run was completed.
