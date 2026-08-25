# SIREN — round 3 for Codex (23 August 2026)

Welcome back. Your round-two work landed and the file has moved a long way since: the live
app is **v1.63.5**. Your copy for this round is in this folder:

- **`FROZEN_1_63_5.html`** — 8,212,700 bytes, SHA-256 `E895B205D6E84F2F0E611164AF66FF29722645AD1073A1C6FB97C3DA1DFBD628` (also in `FROZEN.sha256`).
- Patch against **that hash**. The live file moves several times an hour.
- `syncheck.py` (extracts the inline script and runs `node --check`) and `drive.mjs` (a small CDP driver: steps `{nav,wait} | {js,name} | {click} | {clickAt:[x,y]} | {key} | {hover} | {shot}`) are in this folder. Your own harness from round two is welcome too.

Your process from round two is the process. Exact-count atomic patches, applied to your own
copy, verified from the artefact, with an honest "deliberately not claimed" section. It is
the reason your work merged and another engineer's did not.

---

## What changed since you last saw it (so you do not re-report shipped work)

- **Mermaid is embedded** (v1.51.0): the app is fully offline from a double-click. No CDN.
- **A surgical source writer** (v1.52.0): every visual gesture is an *op* that edits only the
  lines it concerns (`applyVisualModel` → `surgicalWrite` → `planSurgicalEdit` → `surgPlan*`),
  with a round-trip gate (`visualModelsEquivalent`) and an honest fallback ladder
  (written / noted / asked / fallback / refused / noop).
- **A canvas builder on the preview** (1.59–1.62, phases 1–4): a ring of handles on the
  selected block — grow, insert before, connect, rename in place, move a block into a
  connector, delete-and-heal with a refusal that names the path it would lose, notes,
  side steps, reorder verified after the render. Flowcharts only, by design.
- **Exports** (1.63.0): deck PowerPoint writes **editable DrawingML shapes** for flowchart
  slides; Word writes a **real .docx** (opens in Word 16 with CompatibilityMode 15); the deck
  PDF writes **vector diagram pages with embedded subset fonts** (Romanian diacritics now
  survive — they used to become `?`).
- **UI**: the interface was decluttered (34 → 27 controls at rest), the guided editor was
  reworked, a preview minimap appeared, diagrams can be put away from the tab strip and
  brought back.

Full history: `C:\Claude\SIREN\RESUME_HERE.md` (read the last ~600 lines). Specs and audits:
`C:\Claude\SIREN\audit\`. Evidence from the recent rounds: `C:\Claude\SIREN\qa\round4\`.

---

## Protected surfaces — five agents and I are inside the file right now

Do **not** patch these regions this round; your patches would collide and one of us would
lose work:

| Region | Who |
|---|---|
| `#editorPopout` and the editor toolbar / structure-mode switch | an agent |
| Theme finish CSS, `.canvas-popover`, `.canvas-chip`, `.struct-menu` surfaces | an agent |
| gitGraph colours, non-flowchart context menus, the Style surface | an agent |
| The Docs module (`#wpWorkspace`), its context-menu branch, `workpaperMarkdown`, `buildWorkpaperExportHtml`, **and the workpaper PPTX writer** (`workpaperPptx*`) | an agent |
| The preview toolbar (`Connect`), the "Style · title, fonts…" collapsible | an agent |
| The canvas module (`canvas*`, `surgPlanCanvasStep`), the diagram tab strip | me |

Everything else is fair game, and the five jobs below are deliberately chosen to sit outside
all of it.

---

## The jobs

They are all in `jobs/`. Job A first — it protects everything else we are shipping.

- **`jobs/A_regression_suite.md`** — bring `qa/run_regression_suite.js` up to the app as it
  is now. Pure test code; it does not patch the app at all. **Start here.**
- **`jobs/B_pdf_stage_two.md`** — the PDF writer's second stage: compression, and the
  fidelity gaps the first stage listed honestly as not done.
- **`jobs/C_excel_export.md`** — the one export nobody has audited end to end.
- **`jobs/D_import_robustness.md`** — what happens when someone else's file is not what the
  app hoped for. The workspace must never be lost to a bad import.
- **`jobs/E_storage_resilience.md`** — quota, a second tab, a corrupted record: the failure
  modes that lose a day's work.

There is a sixth, **`jobs/F_block_inspector_draggable.md`** — the block inspector should be
draggable. **Do not start it**: another engineer is inside that region this week and I will
tell you when it is free. It is there so you can read it and plan.

Take A to E in order, but if one stalls, move to the next and say so — five finished jobs beat
two perfect ones and three excuses. If you have capacity beyond these, ask before starting
anything outside them.

## Rules, unchanged from round two

- Patch against the frozen hash; exact anchor counts; atomic writes; your own copy only.
- Never weaken the CSP, never add `eval` / `new Function`, never add a network request.
- Do not touch `APP_VERSION` or `CHANGELOG` — I bump and write those.
- No new modules, PoCs or recommendations beyond the five jobs. If you find something
  important outside them, write it in your handback as a finding; do not build it.
- Verify from the artefact you produced: for a PDF, rasterise a page and look at it; for a
  test suite, show the report JSON. A claim without a measurement is not a claim.
- Say plainly what you did not do. That section is the most useful part of your handback.
