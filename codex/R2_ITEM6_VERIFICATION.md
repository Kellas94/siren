# Round 2 item 6 — revisions and change-marker path

Status: **complete on the final applied main**. R2.18 and R2.19 were applied as separate exact-count/atomic patches; the final cross-engine check then exposed and fixed one WebKit focus-restoration defect in a third standalone patch, R2.20.

## R2.18 — bounded archived-revision ingress and recoverable restore

Patch: `patches/R2_18_bound_revision_ingress_and_restore.py`.

The pre-fix real UI confirmed all four boundaries:

- a native Docs JSON file carrying one valid archived revision added the document but exposed zero revisions;
- the same path accepted an over-limit raw revision as a successful document import while silently excluding its history;
- a project carrying the same over-limit revision reached the replace-workspace confirmation;
- a legacy raw snapshot already in browser state reached a normal Restore confirmation and then lost its tail without a report.

The candidate separates raw evidence from the restore candidate. Native and project ingress accept history only when every retained snapshot fits the canonical Docs limits; otherwise they reject before creating a document or opening a replace confirmation, state that nothing was imported, and leave the source file unchanged. A legacy raw snapshot is kept recoverable. Restore sanitises into a separate candidate and, when any cap would apply, shows the exact arrived/kept counts with three explicit choices: Cancel, Export exact original, or Restore bounded copy. Restoring keeps the raw source revision in Changes even at the six-revision boundary.

Disposable real-app acceptance (`output/playwright/r2-18-patched-r5/report.json`) passed 17/17 assertions with zero page/console errors. It verified safe revision ingress and normal restore confirmation; atomic rejection for the 200,048-character native and project cases; unchanged content after Cancel; an exported JSON containing both `R18_RAW_TAIL_SENTINEL` and an over-limit raw author tail; a bounded restore without the content tail; persisted Changes state still containing both raw tails; and post-restore focus on Changes. Baseline evidence is `output/playwright/r2-18-baseline/report.json`. The rendered recovery dialog was inspected at `output/playwright/r2-18-patched-r5/revision-recovery-dialog.png`.

## R2.19 — linear Docs change-marker lookup

Patch: `patches/R2_19_linearize_docs_change_markers.py`.

The pre-fix deferred scan performed `doc.blocks.find(...)` and `comments.some(...)` for each rendered block. Through a real imported 300-block / 200-open-comment document, one marker pass made exactly 45,150 block-array visits and 40,100 comment-array visits. Nine final measured deferred passes were 7.9 ms median / 9.8 ms p95 on this workstation.

The candidate builds one first-match-preserving block `Map` and one open-comment `Set` per deferred pass. The same UI fixture made zero nested `find`/`some` visits, retained all 300 rendered blocks, all 200 comment markers and the edited marker/chip, and measured 1.4 ms median / 1.9 ms p95 across nine passes. A duplicate-ID control preserves the old first-match behavior before and after editing, rather than silently adopting ordinary `Map` last-write semantics. Reports are `output/playwright/r2-19-baseline-r3/report.json` and `output/playwright/r2-19-patched-r3/report.json`; both rendered last-block captures were inspected.

## R2.20 — explicit cross-engine revision-dialog focus return

Patch: `patches/R2_20_restore_revision_invoker_focus.py`.

The final browser matrix found a real WebKit-only regression: Cancel left the live document unchanged but native `<dialog>` focus restoration fell back to the Docs root instead of the revision-row Restore button. R2.20 threads that exact invoker into the bounded-recovery dialog, explicitly restores it after Cancel or Escape, and deliberately leaves a completed restore's existing `#wpChangesButton` destination untouched.

The final applied main passed 10/10 focused assertions in Chromium 151, Firefox 153 and WebKit 26.5. Each run verified Cancel, Escape, no mutation, exact invoker identity, bounded restore, retained raw revision evidence, the Changes destination, zero page/console errors, zero successful external responses and unchanged hash. Reports are `output/playwright/r2-20-main-f025-chromium/report.json`, `output/playwright/r2-20-main-f025-firefox/report.json` and `output/playwright/r2-20-main-f025-webkit/report.json`; all six recovery/restored-state captures were visually inspected.

## Final applied-main acceptance

The final application is 3,591,449 bytes, SHA-256 `F025ACB5F18E7E81B296E931B6951A1A02110562F9D7B4CE1FDAED5F2928DF6C`. The complete Chromium suite passed 31/31 scenarios and 284/284 assertions with no failure or skip; the deep validator passed 26/26 artifacts. R2.18 and R2.19 also passed their focused final-hash gates, and every suite run left the HTML hash unchanged. Evidence: `output/regression-suite/full-final-f025/report.json` and `output/regression-suite/full-final-f025/export-validation.json`.

## Integrity and scope

All three Python scripts compile, use exact occurrence-count assertions, write a flushed/fsynced sibling temporary file and commit with `os.replace`. Each transformed real-app copy contains one inline script and passes `node --check`. Reapplication stops on the moved first anchor without modifying the transformed target. None contains or replaces a protected Present, Map, deck, card-editor or ambient anchor.
