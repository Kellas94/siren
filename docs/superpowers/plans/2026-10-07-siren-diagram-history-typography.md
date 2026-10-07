# Native Diagram history and typography implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Preserve the user's chosen inline implementation with separate genuine review.

**Goal:** Make native source/Build/Guided/style editing reversible and expose existing supported typography without permanent toolbar clutter.

**Architecture:** Keep bounded history inside the existing per-window draft, storing source and admitted style values independently of saved version/hash and presentation edits. Existing explicit Save/CAS remains the only persistence authority. Compact History and the existing Style disclosure expose the commands.

**Tech Stack:** Existing JavaScript renderer, Electron bridge, Mermaid12.0.0; no dependency change.

**Spec:** Approved `2026-10-03-siren-home-diagrams` specification/plan, user-requested reference parity and `desktop/reviews/2026-10-07-native-diagram-parity-next-analysis.md` (analysis, not runtime approval).

## Global constraints and rulings

- Per working window, maximum60 retained states and8MiB aggregate encoded history; retain current work even if an oversized state means clearing prior history. No source truncation. State count includes current state.
- Restore source and admitted style only. Preserve presentation edits and all unrelated diagram/project/source metadata. Never restore saved CAS counters. A history jump becomes a local draft.
- Coalesce consecutive textarea input within750ms; separate structured commands and saved checkpoints. New edits after Undo discard Redo. Equal edits do not create history.
- Refuse restore while readonly/pending/paused/fenced/disposed. Refresh/adopted newer saved content resets local history. Lock rollback preserves retained local states when no external adoption occurred.
- Commit valid pending Guided/Style fields before a toolbar history command; visibly refuse incomplete Build fields. Never clear unfinished fields silently. Focused fields retain normal browser Undo and IME/composition behavior; source textarea uses semantic history only outside composition.
- Preserve imported source colour/font precedence. Existing style validation is authoritative; changing one block property preserves untouched keys.
- Ruling:8MiB is an initial renderer history budget, not a new source capacity or performance claim. Cost if wrong: tune after measured desktop profiling.
- Ruling: history excludes presentation authoring; disable its controls in Presentation mode and explain source/style scope. Cost if wrong: separate deck-history design, not implicit rollback of notes.
- Existing no-push-while-hosted-active rule, original adverse evidence and historical Diagram timeout remain unchanged. No merge/release/installed replacement implied.

## Review focus

1. Undo after acknowledged Save must use the current version/hash and preserve later presentation edits (Task1).
2. Oversized Unicode/source states and history eviction must preserve current exact work (Task1).
3. Unfinished Add/Connect fields and invalid Style values must survive a refused history jump (Task2).
4. Focused fields, composition and native Ctrl+Z defaults must not lose input (Task2).
5. Source-declared typography and per-block inherited/default values must remain honest after selection/render (Task3).

### Task1: Bounded semantic draft history

**Files:** Modify `desktop/src/ui/diagram/draft.js`; create `desktop/tests/diagram-history.test.mjs`.

**Interfaces:** Consume existing `getDiagram/getStatus/setSource/setStyle/save/flushView`. Produce `getHistory()` returning finite `{index,entries:[{id,label}],bytes,limitBytes,limitStates}`, `undo()`, `redo()`, `restoreHistory(id)` returning existing `{ok,code}` convention. Extend `setSource(value,{label='Edit Mermaid',coalesce=false}={})` and `setStyle(input,{label='Change style'}={})`; no renderer bridge expansion.

- [x] Write tests for complete source/style restore across Save, no-op and redo truncation, bounded UTF8 retention, fences and current-version CAS, separate presentation edits, and newer external adoption reset.
- [x] Run `node --test tests/diagram-history.test.mjs`; watch missing-method RED.
- [x] Implement snapshots of admitted style values/source; compute retained UTF8 budget; discard old states without altering current work. Derive style patch relative to the current acknowledged diagram when restoring. Save seals coalescing, not CAS history rewind.
- [x] Run history, draft and presentation-draft tests; require zero failures and exact unchanged unrelated fields.
- [x] Commit the independently tested draft deliverable locally.

### Task2: Compact history commands and keyboard/lifecycle integration

**Files:** Modify `desktop/src/ui/windows/diagram.js`, `desktop/src/ui/diagram/window.html`; create focused controller tests and extend actual native Diagram harness.

**Interfaces:** Consume Task1 history methods and current Guided/Build/Style `commit/isEditing`. History UI uses the same guarded command path for Undo/Redo/step jump, updates source/Guided/Style/preview, and makes no direct IPC save.

- [x] Write mounted tests: toolbar/jump restoration, incomplete field refusal, source semantic Ctrl+Z/Shift+Z/Y, focused field/composition/repeat guards, readonly/paused and presentation mode refusal.
- [x] Watch missing controls/handlers RED, then implement Undo/Redo beside source mode controls and a compact History disclosure. Clearly label source/style scope and retained-state budget.
- [x] Run controller and existing UI/window tests; require all accepted old interactions to remain intact.
- [x] Commit locally after GREEN.

### Task3: Supported typography access

**Files:** Modify `desktop/src/ui/diagram/style-view.js`; extend `desktop/tests/diagram-style-view.test.mjs` and actual native style harness.

**Interfaces:** Reuse existing font/weight allowlists, draft `setStyle`, render `styleTargets` and source-aware `applyStyle`. Add global weight and selected-block font/size/weight with explicit inheritance/reset controls; no new domain fields.

- [x] Write tests for missing global/block controls, preservation of colour/other block keys, no selection/readonly/source precedence, invalid pending number refusal and target-change field retention.
- [x] Watch RED; implement compact labelled groups in the current Style panel with no additional permanent toolbar row.
- [x] Run style-view/style/history/controller tests; require exact field preservation and no implicit Save.
- [x] Commit locally after GREEN.

### Task4: Genuine review and qualification

- [x] Request one independent review of the coherent final change, explicitly including review-focus inputs/rulings; retain original findings and corrections separately.
- [x] Freeze source and complete full suite/build, exact package/runtime/helper comparison, development and actual copied-package native keyboard/pointer/history/font/Save/Lock cases.
- [x] Distinguish controlled tests from native observations; retain failures. Hosted qualification is a separate candidate-specific verdict.
- [ ] Record owner qualification, guarded canonical synchronization and resume checkpoint. Continue the approved parity backlog without requesting another routine checkpoint approval.

Status: LOCAL QUALIFICATION COMPLETE. Source63f21362, owner reports record fullsuite1340 and native-fixture-only boundary, genuine development/copied8, exact295 files and copied shell/core/300k. Canonical synchronization/new hosted verdict remain pending.

## Task1 preflight ruling and scoped progress

Actual main DomainRepository merges style properties; neither undefined/null nor a visual default restores a missing optional key. Add finite nonpersisted `resetStyleFields` only to existing replace-content/replace-deck-content actions. Allow only the six renderer-managed style names, reject overlap/duplicates/unknown/sparse/getter values, strip the control before frozen style validation/persistence, delete only those admitted keys under current CAS. Preserve presentationEdits separately. Cost if wrong: refine this finite contract and requalify domain admission; no generic JSON deletion or saved version rollback.

Task1 files also include src/windows/domain.mjs, src/projects/domain-validation.mjs and their domain-owner/domain-validation tests. Actual missing-history RED5 and finite domain reset RED2 retained. Current scoped draft/presentation/domain suite40 passes. First test oracle incorrectly expected one Redo to cross two distinct source/style steps; original failed result is retained and corrected test now asserts each exact intermediate state. Native/fullsuite/GUI/history controls remain unqualified; implementation continues.

## Final local source verification boundary

Actual current product source/build/workflow and all unit tests passed fullsuite1340 (identity3 +units1337), unchanged captured inputs. After that suite, the sole changed captured file was the native harness: enabled-option enumeration corrected from a demonstrated keyboard transport defect; finite executor metadata now names the actual root/agent/GitHub runner. No product/unit-test code changed. Relevant CI/build tests4 and final actual current-harness native8 passed separately; this does not claim the earlier fullsuite executed the new native harness. Original nativeADVERSE0/CSP diagnostic and nativeADVERSE1/select diagnostic retained with authors. Actual native strict-CSP startup, source-owned fonts, exact Save/CAS/optional-field absence, pending fields, same-renderer docking, window isolation and commonLock passed. Root rehashed all final native capturedinputs and independently inspected actual screenshot.

Observed narrow-window placeholder clipping/history-popover overlap and stale invalid-edit feedback remain UI refinement items; no all-theme/physical-monitor/IME/stress/maximum or complete Studio parity claim. Historical older Diagram timeout remains OPEN.
