# Round 3 — rebase the twelve application patches onto 1.64.0

Your round-three handback is accepted, and Job A is already earning its keep: I am running
`run_round3_suite.js` against the current live build as I write this.

One thing stands between B–E and the owner's file: **the app moved while you worked.** Your
chain is pinned to `FROZEN_1_63_5.html` (`E895B205…`) and the live app is now **1.64.0**.
Your patches guard their input SHA, which is exactly right — so they refuse, loudly, instead
of half-applying. That is the behaviour I want; it just means a rebase.

## The new base

- **`FROZEN_1_64_0.html`** — 8,257,865 bytes, SHA-256
  `F6330D42E570DF0CA722CC7F3149F748315A8DA29AD766EF79DDE4D413EAF59A` (also in
  `FROZEN_1_64_0.sha256`).

## What changed between 1.63.5 and 1.64.0, and where

Eleven agent patches and six of my own landed. In the order they were applied:

| Area | What it touched |
|---|---|
| Guided editor | the `+ Block` / `+ Connection` footer removed; `#structureCount` moved into the hint row; a `.struct-first-block` line on a blank page; `structureAddBlock` unchanged |
| Diagram tabs | the hide `×` now exists only on the active tab; a "N put away" restore menu (`#diagramHiddenButton`, `openHiddenDiagramsMenu`) beside `#diagramCount` |
| Canvas | block right-click gained "Add a step after / Insert a step before" (`canvasBlockStepRows`, `canvasContextRows` trimmed); the side handles now write `B --> N` from the pressed block (`canvasAddBeside`, `canvasVerifySide`, `surgPlanCanvasStep` mode `after` gained a `bias`); `event.repeat` guards on Delete |
| Present | `openPresentation` no longer forces the Studio rail open; `togglePresentationSidebar` remembers `state.presentStudioOpen` |
| Pop-out editor | the Text/Guided switch and the guided rows move into `#editorPopout`; **Wrap is unconditional now** — the old checkbox is gone and `updateLineNumbers`, `textarea#source`'s white-space and `.line-number` CSS were rewritten so the gutter follows wrapped text |
| Style / Connect | `#connectModeButton` hidden on desktop but kept under `@media (min-width: 901px)`; `#settingsSection` is now six `<details class="style-fold">` groups; `revealStyleControl()` added |
| Cupertino Glass | opaque surfaces for `.canvas-popover`, `.canvas-chip`, `.struct-menu` and the current row |
| Git graph | branch colour rows in Style (`gitGraphBranchNames`, `renderGitBranchControls`, `applyGitBranchColoursFromControls`, `gitBranchSlots`), git colour slots in `buildMermaidConfig`, and a code-only drawing surface (`buildCanvasContextMenu` gained a type gate, `handleCodeOnlyDiagramClick`, `codeOnlyMaybeShowHint`, one line in `setMobileView`) |

**None of that should touch your regions** — the PDF writer, the Excel writer, the import
ingress and `sirenStore` were not edited. I expect most of your anchors to match untouched.
Where one does not, say which and why; a rebase you had to re-aim is worth more when it is
named.

## What I need back

1. The twelve patches re-pinned to the new chain: input SHA `F6330D42…` for the first, and
   each subsequent input equal to the previous output, exactly as you had it.
2. Every anchor you had to move, listed.
3. The Job A gate re-run against the rebased final build, with the report JSON.
4. Anything in 1.64.0 that your suite now flags. Two are known and are mine, not yours:
   Canvas still removes a note hung from a deleted host block, and the Docs revision restore
   returns focus to a hidden button — you reported both and I have not fixed them yet.

## One correction you should know about

You reported that `tools/syncheck.py` was fine. It was not: it hardcoded the live app path and
ignored `argv[1]`, so any "syntax gate green" run against a working copy was really
re-checking the live file. A round-five agent caught it. It now takes the path and returns the
exit code, and `tools/integrate.py` decides on the return code rather than a substring. If any
of your evidence leaned on it against a copy, re-run that step; everything that used your own
harness is unaffected.

## Job F

Still held. The Style region it touches has now landed, so the block inspector is nearly free —
I will release it once the Docs repair in flight is merged.

## Your Job A gate, run against live 1.64.0 — and what its four failures mean

I ran `run_round3_suite.js` against the current live build (`F6330D42…`) before writing this.
Result: **44/48 scenarios, 428/433 assertions, `fatal: false`**, 16 exports validated, the app
SHA unchanged before and after. The suite is doing its job. All four failures are explained,
and none of them is a defect in the app:

| Scenario | Why it failed | Whose move |
|---|---|---|
| `R3.SURFACE.CENSUS` (2 assertions) | expects `previewToolbar: 10`; 1.64.0 has **9**. The Connect button left the desktop toolbar this afternoon — it is on a block's right-click menu, and stays on the phone layout under `@media (min-width: 901px)`. | Yours: update the expectation to 9 on the desktop layout, and please assert the mobile count separately — that is the case the removal nearly broke. |
| `A07.A07B` | waits for `#confirmDialog[open]` on a cross-tab stale write. That modal is **your Job E**, which is not merged yet. | Nobody: it will pass once E is applied. Worth a note in the suite so a red line does not read as an app fault. |
| `A08` | waits for a toast matching `/missing or duplicate ID/i` on a duplicate-id project import. That refusal is **your Job D**, not merged yet. | Same. |
| `EXPORT.MAIN` | `fill('#diagramTitle')` timed out. The field exists but is inside the Style card, which is collapsed at rest — and since this afternoon that card opens as six folds. Measured: after `#styleShortcutButton`, `#diagramTitle` is visible (`checkVisibility() true`) and typing into it updates the rendered diagram title. | Yours: the scenario needs to open the Style card first. |

Two of those (A07, A08) tell me something useful about the suite itself: when a scenario
encodes a contract that only exists after a patch of yours, a red line on an unpatched build
looks like a regression. Consider marking those scenarios with the patch they depend on, so
the gate can say "expected red: requires R3_E" instead of just failing.

Report: `run_on_1640/report.json`; log `run_on_1640.log`.
