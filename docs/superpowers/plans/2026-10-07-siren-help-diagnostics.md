# SIREN Help & diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, with one separate review of the completed boundary. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Explain real SIREN errors offline through a searchable themed manual and interactive resolution flows.

**Architecture:** A pure validated catalog/search resolver feeds a shared DOM manual view. Existing native surface controls open it; operation adapters supply only a scoped error identity. Bundle it in the existing shared shell assets, without new privileged IPC or remote resources.

**Tech Stack:** Existing JavaScript, DOM, CSS, Node test runner, esbuild and Electron native probes. No new library.

**Spec:** `docs/superpowers/specs/2026-10-07-siren-help-diagnostics-design.md` — approved by user on 7 October 2026.

## Global constraints

- Offline English product copy; existing SIREN theme tokens and compact navigation; Quick guide retained.
- Search input at most 200 characters; each resolution flow at most 24 nodes and 48 edges, no cycles.
- Match namespace + operation + code, never arbitrary stdout or global substring guesses.
- No automatic repairs, execution, file deletion, source scan, diagnostic upload or new dependency.
- Lock/disposal clears context; recovery/readonly can read; Audience receives no help UI/context.
- Unknown errors have a generic explanation; no invented cause or unsupported capability claim.
- Keep genuine adverse evidence and actual reviewer authorship; copied-package proof is separate from source tests.

## Review focus

1. A save/export partially succeeds: the article must retain the committed result rather than advise destructive retry.
2. Duplicate codes in different subsystems: identity must not silently select the wrong diagnosis.
3. Malicious error metadata or article/flow corruption: text-only rendering, finite data validation and no arbitrary actions.
4. An error arrives during Lock or after project transition: no stale project context or reopened panel.
5. Broken Mermaid, reduced motion, keyboard-only use and smaller desktop windows: the manual remains readable and usable.

## File boundaries

Create `desktop/src/help/catalog.mjs` (finite article data and validation), `desktop/src/help/resolve.mjs` (scoped resolution/search/flow validation), `desktop/build/help.mjs` (bundle finite catalog as shared browser data), `desktop/src/ui/shared/help.js` (DOM view and lifecycle). Extend `desktop/src/ui/shared/shell.css` for themed layout, `desktop/build/appearance.mjs` for shared bundling, `desktop/src/ui/workspace/home.js` and `desktop/src/ui/desktop.js` for help entry points. Extend `desktop/src/main.mjs` only for the existing native Help command routing, not a new renderer-controlled privileged operation.

Operation adapters initially change `desktop/src/ui/shared/shell.js` (appearance errors), `desktop/src/ui/workspace/home.js` (scoped known Home receipts), `desktop/src/ui/windows/diagram.js` (known save/export receipts), and `desktop/src/ui/docs/reader.js` / `desktop/src/ui/windows/code.js` only where existing structured receipts can be mapped exactly. Do not reinterpret arbitrary legacy text. Confirm each target against `docs/research/2026-10-07-siren-error-manual-inventory.md` before adding an adapter.

### Task 1: Scoped catalog, search and safe flow model

**Files:** Create `desktop/src/help/{catalog,resolve}.mjs`, `desktop/tests/help-catalog.test.mjs` and `desktop/tests/help-resolve.test.mjs`.

**Interfaces:** `HELP_ARTICLES` is a frozen article array. `validateHelpCatalog(articles)` returns `{ok:true}` or `{ok:false,code:'INVALID_HELP_CATALOG'}`. `createHelpResolver(articles)` returns frozen `{get(id),resolve({namespace,operation,code}),search({query,category}),flow(id)}`. `resolve` returns an article or the generic unknown article; `search` returns an ordered array of article IDs, at most the catalog size; invalid queries return `[]`. An article's mappings are exact triples. Flow nodes are `{id,type,label}`, edges `{from,to,label}`; no executable fields. `flow` returns validated data or `null`.

- [ ] Write tests before implementation: scoped duplicate ACCESS_REFUSED resolves only to its own article; missing namespace and unknown code resolve to unknown; a 201-character query returns `[]`; query/ID/getter/HTML inputs cannot invoke actions; exact title/code ordering is deterministic.
- [ ] Add catalog tests for duplicate IDs/mappings, missing references, cycle, 25 nodes, 49 edges, unknown node type, invalid text limits and non-data properties. Example assertions: `assert.equal(validateHelpCatalog(cyclic).ok,false)` and `assert.deepEqual(resolver.search({query:'x'.repeat(201)}),[])`.
- [ ] Run `node --test tests/help-catalog.test.mjs tests/help-resolve.test.mjs` from `desktop`; expected RED because the modules do not exist, then implement and expect all cases PASS.
- [ ] Author an initial finite catalog from the actual inventory. Each article includes source references and distinguishes observation, possible causes and advice. Include conflict/draft retention, source budgets, imported diagram render failure, partial export/open success, PIN/transition refusal, recovery and unconfigured updates/native Terminal. Use bounded text fields (title 160, summary 600, each prose section 4000 characters); validate data at build time.
- [ ] Commit the pure catalog and tests, preserving the initial RED log. Catalog presence alone does not mark the feature delivered.

### Task 2: Shared accessible manual and lifecycle

**Files:** Create `desktop/src/ui/shared/help.js`, `desktop/build/help.mjs`, `desktop/tests/help-view.test.mjs`; modify `desktop/build/appearance.mjs` and `desktop/src/ui/shared/shell.css`.

**Interfaces:** Browser bundle exposes finite `window.SirenHelpCatalog` and `window.SirenHelpResolver`. `window.SirenHelp.create({document,isAvailable})` returns `{open({articleId,errorIdentity,initiator}={}),close(),dispose()}`. No raw log/path/source context is accepted. `isAvailable()` must return literal true; caller supplies current unlocked/live state. The view stores no project text, polls no service and renders no arbitrary HTML. Use an accessible dialog with labeled search/category controls and article navigation; flow choices highlight a bounded next node plus equivalent text steps.

- [ ] Write DOM/VM tests for search/category/result navigation, keyboard/focus return, finite flow navigation/reset, malicious HTML shown as text, unknown identity and an unavailable opener. Explicitly assert no innerHTML/eval/IPC call occurs.
- [ ] Write lifecycle tests: close/dispose clears contextual identity; retired view cannot reopen; invalid/error context does not retain source/path data; show/close is idempotent and repeated mount does not accumulate listeners.
- [ ] Run `node --test tests/help-view.test.mjs`; expect RED, implement the shared view and bundler, then PASS.
- [ ] Bundle into the existing shell JS/CSS resources and validate exact SRI/CSP through current builder tests. Do not loosen resource whitelists or generic URL access. Run `node --test tests/*appearance*.test.mjs tests/*shell*.test.mjs tests/help-*.test.mjs`; expect PASS. If a finite shared-bundle budget needs adjustment, measure exact bytes and justify it explicitly.
- [ ] Commit the view/builder/test boundary.

### Task 3: Native Help navigation and contextual adapters

**Files:** Modify the existing main native Help menu, Home Settings/Quick guide actions, desktop command allowlist, shared shell lifecycle and the exact operation adapters listed above; create `desktop/tests/help-integration.test.mjs` and `desktop/tests/native/help-diagnostics.mjs`.

**Interfaces:** Add a single known command `desktopHelpDiagnostics` to existing main-to-view command routing. It opens only the registered current surface's manual; no renderer-provided path/command. Context adapters call the Task 2 view with a constant namespace/operation and exact bounded receipt code. Retain existing visible error text and operational behavior. `EXPORT_COMMITTED` and creation/opening split outcomes must preserve their actual meanings.

- [ ] Write integration tests first for known structured error actions, wrong namespace, unknown code, malformed receipt, saved-but-open-failed, native command allowlisting and Audience absence.
- [ ] Add Lock/project-change/disposal tests: event invalidation closes manual synchronously; a late callback cannot reopen it; readonly reading does not enable privileged IPC. Resolve the actual shared lifecycle hooks before wiring, never infer unlock from URL alone.
- [ ] Run `node --test tests/help-integration.test.mjs tests/help-*.test.mjs`; expect RED then PASS after minimal integration.
- [ ] Run original impacted native navigation/appearance/Home tests and new actual `node tests/native/help-diagnostics.mjs`. The new probe must use real clicks/keys on Home, Code/Docs and Diagram, deliberate known errors without changing source, a working logical flow when Mermaid fails, themes, Lock and focus return. Record only actual completed cases; a UI screenshot alone does not prove an action.
- [ ] Update Quick guide and documented limits; commit source and genuine tests. Do not add an exportDiagnostics bypass to Home just to support the manual.

### Task 4: Source, copied-package and independent qualification

**Files:** Extend explicit package inputs only if needed for packaged runtime modules; create `desktop/reviews/2026-10-07-help-diagnostics-owner.{md,json}` and a separately authored independent review. Preserve exact catalog version/hash in build evidence.

- [ ] Run full `npm test` with source hashes before/after; expect zero failures, cancellations or skipped required cases. Preserve any first failure and repair only the demonstrated cause.
- [ ] Build a separate preview from the committed source. Verify every ASAR member, shared bundle/SRI, runtime and helper against the build receipt. Do not replace the installed build or claim production release.
- [ ] Run the new help native probe with `--package <preview>` through the existing copied-package context, plus impacted original Home/navigation/appearance checks. Recheck hashes of every executed copy after exit; distinguish development utility tests from copied UI execution.
- [ ] Obtain independent source/receipt review on exact captured bytes. Report authors write their own verdicts. Repair material findings with retained RED/GREEN and appropriate repeat tests; do not synthesize PASS for an interrupted reviewer.
- [ ] Commit qualification records and update resume/ledger. Qualified guarded feature-branch sync follows the existing approved workflow; main merge/release remains separate.

## Self-review and handoff

Catalog/search/flow = Task 1; themes/accessibility and malformed content = Task 2; actual receipt namespace, lifecycle and existing UI controls = Task 3; portable byte identity and genuine provenance = Task 4. The manual neither admits Terminal execution nor closes the original hosted pointer timeout. User approved this written plan on 7 October 2026: implementation here in coherent batches, with separate review of completed boundaries.
