# Independent whole-batch review: Docs context and Presentation authoring

Author: `/root/docs_deck_batch_review`, separately delegated reviewer. Reviewed source commit: `9807ab5d037c7058c6e30baeb5ae0d72e979b2ad`, against `206b79e`. This report is written by the reviewer, not the implementation coordinator.

Decision: **CHANGES REQUESTED** for the reproducible P2 regression below. This is an independent code and unit/adversarial review, not native, packaged, hosted or release admission.

## Finding

### P2: ordinary Docs Save now destroys the existing Undo history

`desktop/src/ui/docs/draft.js:33` unconditionally calls `resetHistory()` after a genuinely accepted save. In BASE, a body/title-only save retained its undo/redo stacks. The new behavior also applies to the existing `replace-content` path when no context was edited, so a user can edit an ordinary title, save successfully, then immediately find Undo unavailable. This regresses existing Docs editing behavior outside the context feature.

I independently reproduced the same scenario against both revisions, using the actual draft scripts, a valid acknowledged SHA and a normal body-only save. BASE restores the original title through Undo and marks the draft dirty. Reviewed commit reports `canUndo: false` and cannot undo. Evidence: `desktop/evidence/docs-deck-independent-history-9807ab5.test.mjs` and `.log` (2 tests, BASE passed, reviewed source failed). This adverse evidence is retained unchanged.

Preserve ordinary title/body Undo after Save and add a durable regression test. Context snapshots require an explicit history-rebase policy because they are partial patches against a base document; do not fix that by clearing established history on every unrelated save. I have not prescribed an automatic stale mutation retry.

## Review and independently run verification

I read the approved batch plan and the 47-file diff, then followed the pure finite document/deck models, scoped domain normalization/transaction/validation adapters, catalog metadata filters, own-reference discovery/opening, own-deck navigation, native admission and main IPC tracking, browser draft/UI wiring, build CSP bundling, and private Presenter/Audience transport/projection.

I independently executed these 12 affected test files: `docs-context`, `docs-context-draft`, `docs-references`, `presentation-authoring`, `diagram-presentation-draft`, `deck-navigation`, `domain-owner`, `domain-validation`, `native-window-catalog`, `presentation-deck`, `presentation-ipc`, and `presentation`. All **65** tests passed, with no skip or cancellation. Own captured output: `desktop/evidence/docs-deck-independent-units-9807ab5.log`. I separately wrote and ran the before/after history reproducer; it exposed the finding rather than deriving approval from a pre-existing PASS file.

The observed source retains important boundaries: Docs catalog rows project names and bounded context facts rather than bodies or instructions; own-reference opening accepts a saved index/version rather than arbitrary target authority; whole-reference addition checks exact membership in the selected project; body/context and source/style/deck use the existing single-entity CAS transaction; finite presentation edits preserve opaque settings/cards/note metadata instead of replacing the complete presentation through a sanitizer; Audience lacks the Edit deck route and receives a public frame, not private notes. Pending navigation/discovery rechecks current native grants and Lock state before showing a target. These are conclusions from the inspected code and my test run, not a guarantee against all possible defects.

## Context sheet at Lock and Close

The sheet has an explicit **Apply to draft / Cancel** stage. Input handlers only populate its local proposal; `draft.setContext` runs on Apply. Once applied, the new draft participates in Save/Lock through the existing preparation barrier. Pausing closes the sheet and discards an unapplied local proposal. I do not classify cancellation of an explicitly unapplied proposal as a CAS or committed-draft integrity failure. The introductory wording currently says "Changes join the document draft" before Apply; it would be clearer to say "Apply adds changes to the draft; Save commits them" and, if uninterrupted recovery of tentative form values is wanted, design that explicitly. Do not silently approve or save unconfirmed form values as a security repair.

## Limits and remaining scope

No Electron/native GUI was launched by this reviewer, so I did not independently observe pointer geometry, modal focus, the 480x320 viewport, physical displays/DPI, or actual native Lock/Close. I did not build or execute a portable copy, run the full suite, verify hosted Actions, inspect installer/update signatures, merge or release. Coordinator-provided native completion statements are not independent tests performed here and do not change this decision.

The current batch intentionally retains the existing 300-block body-edit cap, 60 references, 600 presentation steps/notes and 120 finite deck operations per save. Complete rich media authoring, review/release approval workflows, all-diagram mouse parity and broader application scalability remain beyond the reviewed implementation. Existing malformed/unsupported records are retained or refused, not asserted to be fully editable or playable. This report applies only to the exact reviewed source until a separately documented correction is reviewed.
