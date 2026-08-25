# Job F is released — plus what changed under it

Your round-3 rebase is **merged and live**. I applied the twelve patches to the owner's file
in your order, the chain closed on `CB107D5C…` exactly as you published it, and after two more
patches of my own the app shipped as **v1.65.0**.

## The base for Job F

- **`FROZEN_1_65_0.html`** — 8,405,358 bytes, SHA-256
  `D48D61736A4092D94AEFA5502E59FC78F97781D856C6A74C3B02317868785BBA`
  (also in `FROZEN_1_65_0.sha256`). This is byte-for-byte the file the owner is using.

Pin your input SHA to it, exactly as you did before. That habit is why the last rebase cost
nothing.

## What is in the base that was not there when you read Job F

1. **The Style surface has landed.** `#settingsSection` is now six `<details class="style-fold">`
   groups with `revealStyleControl()`; `#connectModeButton` is off the desktop toolbar and kept
   under `@media (min-width: 901px)`. This is what Job F was waiting for. **The region is free.**
2. **Your B–E are in**, so the PDF writer, the Excel writer, the import ingress and `sirenStore`
   are your own current code.
3. **The Docs block context menu was redesigned** (the repair we held back): 7 rows → 12, with
   `MOVE` and `INSERT` group headings, Copy as Markdown, Duplicate, Turn into, Move to top/bottom
   and keyboard hints. Nothing was removed.
4. **A heading input now carries `maxLength`** and refuses silently-lost text (mine).

## One change I made to your suite, and why

`R3.SURFACE.DOCS_CONTEXT.03` failed on my first full run against the shipping build. It pins the
literal labels `Insert a block above` / `Insert a block below`. I measured the menu on an Agent
spec document on both builds before touching anything:

| | rows | insert wording | role row |
|---|---|---|---|
| without the Docs repair | 7 | "＋ Insert a block above…" | present |
| with it (shipped) | 12 | "＋ A block above…" under an **INSERT** heading | present |

Nothing was lost — the verb moved into the group heading. So I repinned the assertion to the
**contract** (an insert-above and an insert-below are reachable from this menu, and the menu
carries an insert group) instead of the sentence:

```js
/block 1 of \d+/i.test(blockMenu.text)
  && /insert/i.test(blockMenu.text)
  && /a block above/i.test(blockMenu.text)
  && /a block below/i.test(blockMenu.text)
  && ['comment', 'Move down', 'Mark as purpose', 'Delete block'].every(...)
```

`qa_round3/surface_suite_additions.js` is now SHA-256
`3D8A942C98D69C1C6BA98D27C44135D0DCC8023D132192C39F13D1B76DAFA275`; the previous file is kept
as `.bak_1_65_0`. Installer: `tools/round5/suite_docs_menu_expectation.py`. Neither pinned
constant was disturbed — `run_round3_suite.js` pins only `run_regression_suite.js`, and the
mutation gate pins its own copy under `qa_round3_1635_runtime/`. **If you disagree with this
edit, say so and argue it; I would rather re-open it than have you inherit a judgement of mine
silently.**

## Gate results on the shipped build

`node qa_round3/run_round3_suite.js --app <1.65.0> --expected-sha D48D6173… `
→ **48/48 scenarios, 475/475 assertions, 0 failed, 0 expected-red, `fatal: false`.**
Note the suite refuses an `--app` outside its workspace — a good rail; I ran it on a
byte-identical copy and verified the hashes match first.

## One correction to something you told me, and one to something I told the owner

- Your handback said the Excel export gives "three sheets". I opened the exported workbook in
  **real Excel** through COM before writing the changelog — it is **one sheet per diagram**, the
  diagram drawn as 18 native shapes, and one native table (`SIRENDiagram1`, TableStyleMedium2,
  A65:AF79) with **32 columns**. That is a better thing than three fixed sheets, but it is not
  what the summary said. I had already written the summary's version into the app and had to
  correct it after shipping. When a handback describes an artefact, describe what the artefact
  *is*, not what the job asked for.
- The mistake was mine to catch and I caught it late. That is on me, not on you.

## Job F, unchanged

Build what `jobs/F_block_inspector_draggable.md` describes, against `FROZEN_1_65_0.html`.
Same deliverables as before: anchor-guarded patches with pinned input/output SHAs, every anchor
you had to move named, the Job A gate re-run against your final build with the report JSON, and
anything the suite flags that is mine rather than yours.

Two known defects are still mine and still unfixed — do not spend time on them:
the canvas removes a note hung from a deleted host block, and the Docs revision restore returns
focus to a hidden button.
