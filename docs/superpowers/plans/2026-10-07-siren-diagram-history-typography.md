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

- [ ] Write tests for complete source/style restore across Save, no-op and redo truncation, bounded UTF8 retention, fences and current-version CAS, separate presentation edits, and newer external adoption reset.
- [ ] Run `node --test tests/diagram-history.test.mjs`; watch missing-method RED.
- [ ] Implement snapshots of admitted style values/source; compute retained UTF8 budget; discard old states without altering current work. Derive style patch relative to the current acknowledged diagram when restoring. Save seals coalescing, not CAS history rewind.
- [ ] Run history, draft and presentation-draft tests; require zero failures and exact unchanged unrelated fields.
- [ ] Commit the independently tested draft deliverable locally.

### Task2: Compact history commands and keyboard/lifecycle integration

**Files:** Modify `desktop/src/ui/windows/diagram.js`, `desktop/src/ui/diagram/window.html`; create focused controller tests and extend actual native Diagram harness.

**Interfaces:** Consume Task1 history methods and current Guided/Build/Style `commit/isEditing`. History UI uses the same guarded command path for Undo/Redo/step jump, updates source/Guided/Style/preview, and makes no direct IPC save.

- [ ] Write mounted tests: toolbar/jump restoration, incomplete field refusal, source semantic Ctrl+Z/Shift+Z/Y, focused field/composition/repeat guards, readonly/paused and presentation mode refusal.
- [ ] Watch missing controls/handlers RED, then implement Undo/Redo beside source mode controls and a compact History disclosure. Clearly label source/style scope and retained-state budget.
- [ ] Run controller and existing UI/window tests; require all accepted old interactions to remain intact.
- [ ] Commit locally after GREEN.

### Task3: Supported typography access

**Files:** Modify `desktop/src/ui/diagram/style-view.js`; extend `desktop/tests/diagram-style-view.test.mjs` and actual native style harness.

**Interfaces:** Reuse existing font/weight allowlists, draft `setStyle`, render `styleTargets` and source-aware `applyStyle`. Add global weight and selected-block font/size/weight with explicit inheritance/reset controls; no new domain fields.

- [ ] Write tests for missing global/block controls, preservation of colour/other block keys, no selection/readonly/source precedence, invalid pending number refusal and target-change field retention.
- [ ] Watch RED; implement compact labelled groups in the current Style panel with no additional permanent toolbar row.
- [ ] Run style-view/style/history/controller tests; require exact field preservation and no implicit Save.
- [ ] Commit locally after GREEN.

### Task4: Genuine review and qualification

- [ ] Request one independent review of the coherent final change, explicitly including review-focus inputs/rulings; retain original findings and corrections separately.
- [ ] Freeze source and complete full suite/build, exact package/runtime/helper comparison, development and actual copied-package native keyboard/pointer/history/font/Save/Lock cases.
- [ ] Distinguish controlled tests from native observations; retain failures. Hosted qualification is a separate candidate-specific verdict.
- [ ] Record owner qualification, guarded canonical synchronization and resume checkpoint. Continue the approved parity backlog without requesting another routine checkpoint approval.

Status: PLAN ONLY. Source for the Presenter candidate remains frozen during its copied native execution; no Diagram implementation started.
