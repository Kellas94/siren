# Large Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Edit, document and persist large Python sources with exact versioned recovery and responsive bounded analysis.

**Architecture:** Main owns source versions, durable receipts and workspace manifests. An incremental text model and virtualized editor submit typed edits; cancellable workers produce version-bound index/diff/map results. Existing schema 1 data is migrated into a verified new project, preserving the original.

**Tech Stack:** Existing Electron 44.5.1/Node/ES modules and patched Lezer Python; CodeMirror 6 evaluated before selection and pinned in the lockfile if admitted. No Python execution or AI dependency.

**Spec:** `docs/superpowers/specs/2026-10-02-siren-large-sources-design.md` — user approved both source and native-window specifications in this session.

## Global Constraints

- Target source bytes: 32 MiB UTF-8/file; total source bytes: 256 MiB/project on disk. Qualification targets 100k/300k representative lines; line count is telemetry, not the sole refusal rule.
- UTF-16 edit offsets; no unpaired surrogates or splitting a surrogate pair. Preserve valid UTF-8/BOM/newline bytes; unsupported input remains exportable without silent conversion.
- Saving Code into linked Docs is explicit. Private drafts and immutable A/B versions retain source/agent/release identity.
- One native authority, exact version/hash receipts, idempotent operation IDs and explicit conflicts. PIN/read-only/owned-path checks apply to every source method.
- Analysis is static, cancellable and version-bound; diagram budget refusal preserves editable/exportable source.
- Proposed qualification targets: input p95 ≤100 ms, cancellation ≤500 ms, representative open ≤5 s on declared hardware. Failed targets remain failures.
- Never alter frozen baseline or adverse reports, fabricate review ownership, weaken an oracle, merge main or publish binaries. AI is last.
- Use existing workspace branch; preserve user data. Tests use isolated synthetic roots. No package is admitted by merely increasing a constant.

## Review Focus

- UTF-16 range splits an emoji: refuse edit without byte replacement — Tasks 2/4.
- Newline/BOM changes through migration/export: preserve exact bytes and provenance — Tasks 2/3.
- Save succeeds but checkpoint fails: report committed/recovery-degraded state accurately — Tasks 2/3.
- Late analysis or duplicated edit after revision change: do not repaint stale results or double-apply — Tasks 4/5.
- Many Docs reference the same large source: no text duplication or ambiguous Save to Docs — Tasks 3/6.

## File map and common types

Create `desktop/src/sources/{metrics,text-model,repository,manifest,migration}.mjs` for metrics, text operations, owned durable source files, project/source references and migration respectively. Create `desktop/src/sources/{analysis,analysis-worker,diff-worker}.mjs` for job lifecycle and pure static jobs. Create `desktop/src/ui/code/{editor,source-client,docs-links}.js` for view/adaptor/explicit Docs commit. Modify `desktop/src/main.mjs`, `ipc.mjs`, `preload.cjs`, `contracts.d.ts`, `build/renderer.mjs`, `scripts/package.mjs` at integration seams; baseline remains frozen.

`SourceMetrics = {utf8Bytes, utf16Units, lines, longestLineUnits}`. `SourceRef = {sourceId, version, sha256, utf8Bytes, utf16Units, lines, encoding, bom, newline, provenance}`. `Edit = {operationId, sourceId, expectedVersion, start, end, insertedText}`. `SourceReceipt = {ok, code?, operationId, sourceId, version, sha256, durability: 'draft'|'committed'|'recovery-degraded'}`. `ManifestReceipt = {ok, code?, projectId, revision, sha256, sourceRefs, durability}`; `NewProjectReceipt` also identifies the untouched original project. Main derives project/access epoch from registered caller, never from trusted payload assertions. A draft receipt is durable only after its journal write/readback; a TextModel operation alone is not a save ACK.

Integrated execution order: Sources 1–3 → Native Workspaces 1 (registry) → Sources 4–6 → Native Workspaces 2–6. This removes the source-bridge/registered-window dependency cycle while keeping editable satellites behind stable persistence contracts.

### Task 1: Profile the adverse edit and evaluate EditorView

**Files:** Create `desktop/tests/native/large-source-profile.mjs`, `desktop/reviews/large-source-editor-evaluation.md`; reuse `desktop/tests/native/drive.mjs` unchanged. Candidate dependencies only in an isolated test-owned probe folder, not product runtime. Modify `desktop/package.json`/lockfile only after the evaluation passes.

**Interfaces:** `measureSourceInteraction({fixture, source, actions}): Promise<{timings, processMemory, traces, outcomes}>`; produces the bottleneck record and admitted editor choice for Task 4.

- [ ] Write the probe using actual input/paste/undo/find and immutable expected text hashes for compact, representative and Unicode 100k/300k sources; retain the existing 80k/200Docs adverse case and original timeout.
- [ ] Run the owned native probe once, record completed/refused/timed-out operations, CPU trace, total process peak memory and input latency. No retry-to-PASS or timeout inflation.
- [ ] Evaluate CodeMirror 6 viewport/incremental behavior, Python highlight with patched grammar, IME/tab/focus/selection and licensing; record exact versions/hashes. Admit it only if it satisfies the spec. If rejected, document the cause and design a focused internal editor before its implementation.
- [ ] Commit the independent measurement/evaluation. This task proves a choice; it does not claim full SIREN capacity.

### Task 2: Source metrics, TextModel and owned SourceRepository

**Files:** Create `desktop/src/sources/{metrics,text-model,repository}.mjs`, `desktop/tests/{source-metrics,text-model,source-repository}.test.mjs`. Reuse owned-path/atomic IO primitives, not arbitrary renderer file paths.

**Interfaces:** `measureSource(text): SourceMetrics`; `TextModel({text, version}).apply(Edit): {version,textChanged,inverse}`, `.readRange(version,start,end): string`, `.undo(operationId)`, `.redo(operationId)`; `SourceRepository(root,{canWrite,fault}).importSource({projectId,bytes,provenance})`, `.readRange({projectId,sourceId,version,start,end})`, `.applyEdit({projectId,edit})`, `.commitSource({projectId,sourceId,expectedVersion,operationId})`, `.exportSource({projectId,sourceId,version})`, `.getMetrics({projectId,sourceId,version})`. These are async at repository boundary; export returns original bytes. Import returns SourceRef; apply/commit return SourceReceipt after durable verification.

- [ ] Write failing tests for known Unicode offsets, beginning/middle/EOF edits, undo/redo, idempotent duplicate and stale version: `assert.equal(after.text, 'a😀b\r\nc'); assert.equal(stale.code,'REVISION_CONFLICT'); assert.equal(duplicate.version, first.version)`. Reject split/unpaired surrogates and preserve previous bytes. Test 32MiB acceptance/+1 refusal and 256MiB aggregate refusal without committing it.
- [ ] Run `node --test tests/source-metrics.test.mjs tests/text-model.test.mjs tests/source-repository.test.mjs`; confirm expected failures before implementation.
- [ ] Implement a piece-table text model with incremental line index and byte-budgeted operation history; immutable owned source blobs plus version metadata. Write/readback blobs before version selection. Refuse unknown IDs/path escape/PIN/readonly and duplicate write IDs. Distinguish commit success from failed checkpoint; no false old-pointer claim after commit.
- [ ] Run the focused tests, including fault injection at blob/metadata/selection phases, fresh repository read/export and long-line UTF-8/BOM/newline preservation. Assert exact independently computed SHA256, not source-helper-derived expected content.
- [ ] Commit the repository/model and tests together.

### Task 3: Manifest transaction, migration and source recovery

**Files:** Create `desktop/src/sources/{manifest,migration}.mjs`, `desktop/tests/source-manifest.test.mjs`, `source-migration.test.mjs`, `source-recovery.test.mjs`; modify `desktop/src/projects/store.mjs`, `recovery/checkpoints.mjs`, `recovery/access.mjs` without weakening schema 1 validation.

**Interfaces:** `verifySourceManifest(manifest): manifest`; `commitManifest({projectId,baseRevision,sourceRefs,metadata,operationId}): Promise<ManifestReceipt>`; `migrateLegacySources({snapshot,repository,projects}): Promise<NewProjectReceipt>`; `scanSourceRecovery(projectId)` and `collectUnreferencedSources({projectId,retainedManifests})` preserve all retained references. `ManifestReceipt` binds project revision/hash and exact source refs.

- [ ] Write failing tests: migration creates a new project and leaves original directory/hash unchanged; linked row IDs/agent/release and unlinked sources survive; two Docs referencing one source produce one source blob; torn transaction reopens a verified old/new state; checkpoint failure reports recovery-degraded; referenced emergency/draft blobs are not collected.
- [ ] Run `node --test tests/source-manifest.test.mjs tests/source-migration.test.mjs tests/source-recovery.test.mjs`; verify RED.
- [ ] Store schema 2 source references in the project envelope; perform verified blobs → manifest → atomic project selection. Make save/backup/export declare the schema and bundle referenced source versions. Migration preserves unsupported raw input and requires explicit conversion before edit. Old renderer must refuse writing a schema 2 manifest it cannot interpret.
- [ ] Run focused tests including disk-full/readback faults, crash before/after acknowledgement and restore into a new project; check byte-identical originals. Do not collect blobs until all retained manifests/drafts/checkpoints have been scanned successfully.
- [ ] Commit source-aware persistence/migration with its tests.

### Task 4: Native source bridge and virtualized Code editor

**Files:** Create `desktop/src/ui/code/{editor,source-client}.js`; modify `main.mjs`, `ipc.mjs`, `preload.cjs`, `contracts.d.ts`, `build/renderer.mjs`, `scripts/package.mjs`; create `desktop/tests/source-ipc.test.mjs`, `editor-adapter.test.mjs`, `desktop/tests/native/large-source-editor.mjs`. Use the Task 1 admitted editor and pin its dependencies/production bundle.

**Interfaces:** `sourceClient({bridge,sourceRef}).readRange/applyEdit/commitSource/subscribeSource`; `createCodeEditor({container,client,theme,readonly}).open(ref)`, `.flush()`, `.dispose()`, `.setTheme(theme)`. `flush` returns exact SourceReceipt, never merely resolved timers.

- [ ] Write failing source IPC tests for unregistered caller, frame/role/epoch mismatch, raw paths, invalid UTF-16 offsets, oversized edits, locked/readonly source access and duplicate requests. Write adaptor tests binding text, current source/version, find/replace and explicit commit; native fixture expected hashes are fixed before editing.
- [ ] Run `node --test tests/source-ipc.test.mjs tests/editor-adapter.test.mjs`; confirm RED before integration.
- [ ] Expose only typed source methods. Integrate viewport painting, incremental operations, Python highlight/theme settings, long-line wrap toggle, complete-model find/replace and status. Load sources lazily, keep parser work off input handlers; preserve existing keyboard/context actions. Package allowlist includes only required runtime modules/bundles, with licenses and no source maps/secrets.
- [ ] Run focused tests and actual native editor probe (requires approved native process execution). Verify 100k/300k edits/paste/undo/find/save/Quit/restart hashes, focus/IME and light/dark/reduced motion. Report unmet latency/memory targets by operation; do not label only-open results as editing support.
- [ ] Run `npm test`, commit editor/bridge/package integration after inspection and independent review.

### Task 5: Cancellable static index, diff and selected graphs

4 October selected-map continuation: actual patched Python syntax-containment projection is mounted in native Code with explicit selection,120-node120-edge limits, coloured foldable blocks/hover explanations and exact version-bound navigation. Static nesting is not described as executed flow or resolved runtime calls. Current300kEOF07-34-33 COMPLETE4, exact13-unit call selection,8→3→8 folding, source/project preservation, inspected Light/Dark and genuine joined Lock; currentStructure/A-B regressions pass. Final frozen845/845 unchanged inputs/log7643cd6bf32f52d468bbc86093b218a44553d443da0d579f9fdf9279d49cedd1. Committed map package/private sync follow; incremental reuse/full performance matrix remain open. Root report `desktop/reviews/2026-10-04-native-map-root-evidence.md` is implementer-only. Hosted preceding CI57 first identity-query failure remains retained; diagnostics preserve10s/refusal/assertions and do not claim its cause fixed.

4 October A/B continuation: native immutable comparison is mounted within Structure, derives both refs from genuine open Code frames in the same project, rechecks each authority during reads/publication and joins actual workers on Cancel/Lock. Full linear literal prefix/suffix precedes finite LCS with explicit coarse dense/hunk approximation and limited previews. Current300k A/B07-09-13 COMPLETE5 and original Structure07-09-02 COMPLETE4; two Cancel UI races reproduced RED→GREEN. Final captured workflow suite840/840, unchanged inputs/log15049b22e7e8c62cdf8c59a6e07a74137892750a23fa5059cb3ce8454cf9f1dd. Committed package/exact private sync follow. Root report `desktop/reviews/2026-10-04-native-diff-root-evidence.md` is implementer evidence only. Selected graphs, incremental reuse and full performance matrix remain open; no whole-task checkbox marked complete. Prior index hosted CI56 protected-storage15s timeout remains a retained failure with unknown cause; phase diagnostics preserve the original deadline.

4 October partial implementation checkpoint: native Code Structure is now an optional disclosure with Ctrl+Shift+O, exact class/function navigation, bounded64-row paging/filtering and genuine selected-range inspection beyond the large-source overview. Existing patched Lezer Python runs in a SHA-bound local owned Node worker; no new library and no Python execution. Jobs bind genuine native frame/epoch/source/version/SHA and owner authority before/after repository I/O and result publication. Global2/per-window1 jobs,2Mi UTF16 parser input/2000 definitions/200k traversal/2500ms finite budgets; explicit partial coverage. Main common Close/Lock/Quit/switch barrier cancels and joins real workers. Native300k source8.78MB/7.88M UTF16 `source-analysis/06-11-01.012Z` COMPLETE4 proves overview, exact EOF range/navigation, Cancel and actual Lock;508.12ms bounded overview is not whole-source or input-p95 admission. Real cancellation-object-identity bug reproduced RED and corrected with both current registry-derived native handles, retaining cross-window refusal. Focused27/27; actual source-edit/sync/Docs/Guided/Present regressions passed. Full suite/current committed package follow; Task5 remains open for diff, maps, incremental reuse and the complete performance/review matrix. Root report `desktop/reviews/2026-10-04-native-analysis-root-evidence.md` is implementer evidence only.

**Files:** Create `desktop/src/sources/{analysis,analysis-worker,diff-worker}.mjs`, `desktop/tests/source-analysis.test.mjs`, `source-diff.test.mjs`; modify `desktop/src/ui/code/editor.js` and renderer adapter for result display. Worker sources are local and allowlisted.

**Interfaces:** `AnalysisService.submit({sourceId,version,kind,range,budget,jobId})`, `.cancel(jobId)`, `.dispose()`; jobs return `{sourceId,version,jobId,status,coverage,result?,reason?}`. `kind = index|map|diff`; diff carries immutable left/right SourceRefs. Status enums match the spec.

- [ ] Write failing tests for decorators/classes/async/match/multiline/partial syntax; many definitions; long tokens/deep nesting; explicit partial/refused coverage; duplicate job IDs and cancelled/stale worker results. Assert `assert.equal(staleDisplayed,false)` and unchanged source hash after every failure/refusal.
- [ ] Run `node --test tests/source-analysis.test.mjs tests/source-diff.test.mjs`; confirm RED.
- [ ] Move patched Lezer parsing/indexing into an owned worker; enforce finite budgets and stop/recreate over-budget jobs. Incremental parse is version-bound; graphs use selected definition/range and finite node/edge budgets. Diff produces virtualized hunks and labels approximation explicitly.
- [ ] Run tests and the native matrix for analysis cancellation, worker crash, lock/switch epoch invalidation and navigation to actual code ranges. Preserve original 3k/120-block limits as historical guards until replacement paths are measured, without silently making full graphs unlimited.
- [ ] Run `npm test`, commit worker/index/diff integration after independent review.

### Task 6: Explicit Docs links, knowledge preview and capacity qualification

4 October post-restart scoped qualification: native Docs→Code opening and bounded preparation diagnostics passed final frozen892/892 (zero changed inputs/fail/skip/cancel/todo), guarded build and actual development package aa7518b.100 archived files byte-verified; ASAR cbb022f52d350051d70cdd4717396be240255a8ed2c930489e07d76c70ce39aa. Original packaged/recovery plus explicit300k DocsSources4/newlink4/largeDocs4/Home7 passed with unchanged captures/archive. Current dev Guide4 also passed. Implementer report desktop/reviews/2026-10-04-docs-linked-code-root-evidence.md; original hosted CI63 Home-preparation failure remains unresolved and retained, not relabeled. New Docs creation, specialized knowledge editing/preview/manuals/full stress and physical displays remain open; no whole Task6 completion claimed.

4 October partial implementation: native Docs Linked code opens the exact saved source version in pinned read-only Code via a finite Docs-only block/row/content-token request. Main derives source authority, verifies actual Docs read and immutable metrics, rechecks epoch/CAS around asynchronous admission and disposes late hidden windows. Native300k docs-sources11-40-50 COMPLETE4 preserves dirty Docs, historical source/head2, other agents, stale-token refusal and shared Lock. Light/Dark inspected; Guide11-42-46 COMPLETE4. Focused10/10. Root evidence desktop/reviews/2026-10-04-docs-linked-code-root-evidence.md is implementer only. Full frozen/package/private qualification follows; new document creation, knowledge editing/preview/manuals/full stress/physical monitors remain open. No full Task6 or native Task4 checkbox is closed.

**Files:** Create `desktop/src/ui/code/docs-links.js`, `desktop/tests/source-docs.test.mjs`, `desktop/tests/native/large-source-docs.mjs`; modify `build/renderer.mjs`, `src/ui/desktop.js`, package allowlist and guide through frozen-baseline adapters. Create `desktop/reviews/large-source-qualification.md`.

**Interfaces:** `openLinkedSource({documentId,blockId,rowId,sourceRef})`; `commitCodeToDocs({documentId,rowId,expectedDocumentVersion,sourceReceipt})`; `previewSource({sourceRef,range})`. Preserve draft/private versus explicit linked save semantics.

- [ ] Write failing tests that Code draft edits do not change Docs, explicit save updates exactly the chosen row/version, conflicts retain draft, A/B immutable versions cannot overwrite current release, and multiple references do not duplicate source bytes. Native tests exercise many Docs with source previews and global-find navigation.
- [ ] Run `node --test tests/source-docs.test.mjs`; confirm RED.
- [ ] Integrate source references and lazy virtualized preview; adapt import/export, guide, status and links to source/version/agent. Knowledge manuals remain optional versioned packs, not bundled here as a hidden dependency.
- [ ] Run full `npm test`, the declared native matrix, build a committed-source package and run unchanged packaged probes plus large-source package tests. An independent reviewer checks final actual source/package hashes and adverse results. Verify original projects unchanged and owned fixture processes closed.
- [ ] Publish the scoped qualification report and commit. No main merge/public binary release; hosted CI failures stay visible. Native-window implementation consumes these stable source/receipt contracts next.

## Self-review and handoff

4 October partial Task6 checkpoint: native working-Code now explicitly creates one knowledge pointer row in a chosen existing Docs document, as well as updating an existing link. Genuine owner/source-commit proof/document CAS/durable manifest/no code duplication are retained. Actual300k new-link4 and original-update4 groups passed cancellation, concurrent native Docs conflict, exact source/other agent/history preservation and common Lock. Bounded130-document catalog and restart/idempotency/revocation/budget tests passed. Guide updated; implementer report desktop/reviews/2026-10-04-code-docs-create-root-evidence.md. Frozen suite/package/private qualification follows. New document creation, specialized previews/manuals, incremental analysis, full stress matrix and physical displays remain open; no full Task6 completion or independent approval claimed.

Spec coverage: metrics/repository/model = Task 2; transactions/migration/recovery = Task 3; editor/find/Python themes = Tasks 1/4; cancellation/index/diff/maps = Task 5; explicit Docs/provenance and full matrix = Task 6. All five Review Focus cases have named owning tests. No implementation starts until the user reviews this plan. Preserve the previously chosen method: implementation here in coordinated batches, independent review of completed boundaries and final package; agents may handle isolated reviews/probes within explicit scope.

## 3 October native production checkpoint

Task4 working copies now have real production native edit/commit/Close/Lock admission, qualified100k/300k; Task6 existing linked-row explicit Docs integration is mounted and qualified with exact source/manifest/other-row/history oracles. Root evidence reviews/2026-10-03-native-code-edit-root-evidence.md and reviews/2026-10-03-native-code-docs-root-evidence.md; frozen692/692 unchanged inputs. Whole tasks are not marked complete: analysis/diff, new unlinked-source target creation, complete input/performance/packaged/independent qualification remain open. Continue execution of remaining approved work.

4 October verification-efficiency continuation: native source read-only verification/export now avoids an editable line index for immutable import versions. A Node-only exact ref/bytes read performs one genuine replay and rechecks read/export authority before/after; manifest/recovery consume it while custom adapters retain the original fallback. Edited versions still use actual TextModel replay; no cache/checksum/deadline relaxation. Focused40/40 preserve faults/orphan/permission/corruption/recovery checks. Paired100k/300k immutable-source local medians84.69→11.41ms/258.20→28.49ms; actual native300k Diagram Close1535ms/Lock1571ms. This is implementer evidence and does not qualify edited-version analysis, input-p95 or the remaining index/diff workers. CI54 original FAILURE remains visible; new hosted confirmation is pending.
