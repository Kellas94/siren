# SIREN Round 8 — five jobs

Read `ROUND8_METHOD.md` first. It carries the base SHA, the delivery format, and the traps that have
cost this project real time. This document is only the work.

Every defect below was **re-measured on the frozen base itself**, after the round-7 chain shipped, so
none of it is inherited from an older build. Eight other items from the standing list were dropped
because they had already been fixed or would not reproduce — including one, "the read-only pill's ×
deletes a block", that had been on the list for weeks and is simply gone.

Jobs are ranked by what a person loses. The first two both destroy something somebody typed; they
outrank everything else and should be done first.

---

## AI — typing after "/" in a Docs paragraph destroys the text

**What a person experiences.** They type `/2026 field work` into an empty paragraph. What remains is
a heading block reading `field work`. The characters `/2026 ` are gone from the screen, gone from the
saved document, and still gone after a reload. Typing a path, `/mnt/data/evidence.pdf`, leaves a
paragraph containing only `/`.

**Measured on the base.** Two separate harms, traced keystroke by keystroke:

```
"/"                marker paragraph holds "/", menu opens, focus moves to BUTTON.struct-menu-item
"2" "0" "2" "6"    paragraph unchanged; four characters delivered to a <button> and discarded
" "                SPACE activates the focused row: a Heading block is inserted and the
                   marker paragraph is DELETED
"f" "i" "e" "l" "d"  land in a heading the person never asked for
```

It is not a rendering artifact. IndexedDB (`t-industries-siren-db`, store `kv`, key
`t-industries-siren-v23-state`) holds `heading:"field work"` — no slash, no `2026`.

**Where it lives.** The `/` keydown handler on `div.wp-text[contenteditable]`, inside
`buildWorkpaperBlock` in the `block.kind === 'text'` branch. These snippets each occur exactly once:

```
if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || readOnlyMode) return;
if (editor.textContent.trim() || editor.querySelector('img, table, li')) return;
openWorkpaperAddMenu(editor, doc.blocks.indexOf(block), block.id);
```

The reason the loss survives a reload is that the only listener that writes typed text into the model
is `editor.addEventListener('input', …)`, and it never fires for keys delivered to the menu button.

**Done means** — all five, measured with real typing, not synthetic events:

1. `#wpBlocks` contains a `div.wp-text` whose textContent is exactly `/2026 field work`, all sixteen
   characters.
2. No phantom block: `.wp-block[data-block-id]` count unchanged.
3. The same string survives a reload, read back from IndexedDB, not just from the DOM.
4. `/mnt/data/evidence.pdf` keeps all twenty-two characters.
5. **The feature still works**: a bare `/` still opens `div.struct-menu[aria-label="Add block"]`
   with its five rows, and picking a row still consumes only the marker paragraph — block count
   unchanged, exactly one id removed, the neighbour untouched.

**The trap.** The cheapest fix is to stop opening the menu on `/`. That makes 1–4 pass instantly and
destroys a working feature — clause 5 passes *today*, measured. It would also make the editor's own
placeholder a lie: `editor.dataset.placeholder` reads `Write here, or press / to add a block…`.

**And a blast-radius warning.** `openStructureMenu(` appears 35 times and `closeStructureMenu(` 15
times; it is the engine behind the theme menu, every right-click menu, the toolbar and the new
preview View/Inspect menus. **Do not fix this by changing `openStructureMenu`'s focus or key
handling.** Fix it in the `.wp-text` handler and the `openWorkpaperAddMenu` path.

---

## AJ — one press of Undo destroys a diagram title somebody typed

**What a person experiences.** They name a diagram `Q3 Audit Walkthrough`, change the diagram type,
press Undo once — and the name is replaced by `Flowchart Preview` on all three surfaces. There is no
second Undo that brings it back.

**Measured on the base**, driving the app's own `#undoButton`:

```
type "Q3 Audit Walkthrough"    all three surfaces correct                     PASS
change source to a pie chart   all three still "Q3 Audit Walkthrough"         PASS  (round 7 holds)
click #undoButton once         all three read "Flowchart Preview"             FAIL
```

A second route of the same class also reproduces: a person who deliberately names a diagram exactly
`Flowchart Preview` has it rewritten later, because the code decides a title is "untouched" by
comparing the **string** rather than by recording that somebody edited it.

**The trap, and it is a good one.** An engineer greps, finds `diagramTitle: diagram.diagramTitle` in
`captureDiagramSnapshot` and the matching line in `restoreDiagramSnapshot`, concludes the title is
already undo-covered, and closes the job. It *is* covered — that is precisely why it is destroyed. A
title edit never **commits** an undo entry of its own, so the stack's newest snapshot predates the
typing, and restoring it restores the older title.

**Done means.** Type a distinctive title, change the type, press Undo once: all three surfaces still
read what the person typed, **and** the undo the person actually asked for still happened — the
source and `#diagramTypeText` return to the previous family. Plus: a title deliberately set to
`Flowchart Preview` survives a family change.

The fix is a real "a person touched this" flag, per diagram, rather than a string comparison.

---

## AK — "Delete block" is not drawn at all on a short window

**What a person experiences.** At 1100×620 they right-click a Docs block hunting for Delete. The last
row is not painted, the row above it is sliced through horizontally, and nothing indicates anything
is missing. The failure reads as "this app cannot delete a block".

**Measured on the base.** `.struct-menu.is-plain[aria-label="Heading block actions"]`, 15 children,
computed `max-height` 446.4px, `scrollHeight` 497 against `clientHeight` 444 — **53px hidden**, and
the last item's visible height is **0.0px**.

**Reproduction detail that matters.** The right-click must land on the block's own padding strip
(`blockRect.left + 6`). The inputs filling the rest of the block match `NATIVE_MENU_SELECTOR`, so
`handleAppContextMenu` returns and the browser keeps its own menu — a click at `left + 40` produces
no `.struct-menu` at all. A probe that misses this measures nothing and looks like a pass.

**The trap.** Raising the cap — `min(72vh, 560px)` to something taller, or removing it — makes this
exact menu pass at 1100×620 and makes the defect **worse** one size down. `openStructureMenu`
computes `menu.style.top` as `below + height > window.innerHeight - 8 ? Math.max(8, box.top - height - 4) : below`:
it clamps the top at 8 and never re-reads the bottom. Today the overflow is trapped inside the box's
own scrollport, which is why the wheel and End can still reach Delete. Remove the cap and the rows
leave the screen entirely, with no scrollport to recover them.

The cap is also **global** — a comment above it records that it was itself the fix for the Present
menu clipping, and it now additionally governs the theme menu and the two preview menus. Whatever you
change, re-measure Present, `#themeMenuButton`, `#previewViewButton` and `#previewInspectButton` at
1100×620 **and** 1440×900.

**Done means.** Zero hidden pixels; the last `.struct-menu-item` reads `×  Delete block` and its full
height lies inside the menu's client rect; `elementFromPoint` at its centre returns that button; and
where a menu genuinely cannot fit, its scrollability is announced by something measurable rather than
being silent.

---

## AL — a second-level Docs menu opens a thousand pixels from the click

**What a person experiences.** They right-click on the right-hand side of a document and choose
"Document type". The list appears at the far left of the page, reading as an unrelated panel.

**Measured on the base at 1440×900**, right-click at x=1152:

```
first menu  (point-anchored, correct)   left=1137  top=250
"Document type…"  -> second menu        left=330   top=481     -822px from the click
"Contents…"       -> second menu        left=330   top=481     same
"Add a block…"    -> second menu        left=330   top=481     same
```

The first menu is placed from the click **point** and is correct. The three second-level menus —
`openWorkpaperTypeMenu`, `openWorkpaperContentsMenu`, `openWorkpaperAddMenu` — are placed from the
right-clicked **container's** bounding rect (`#wpBlocks`, left=330), so they ignore the cursor.

**The trap.** The placement line ends in `Math.min(window.innerWidth - menu.offsetWidth - 8, …)`. At
1440 wide with a 248px menu that ceiling is 1184, so **any** anchor at or beyond 1184 produces
left=1184. A fixer who swaps the anchor for some element on the right of the page and verifies with
one right-click near the right edge will measure 1184, see the menu beside the cursor, and declare it
fixed — while it is still wrong everywhere else. Verify at several x positions, including x < 400.

**Done means.** For each of the three rows, the second menu opens adjacent to the point the person
right-clicked, at several click positions across the width, and still never leaves the viewport.

---

## AM — YAML frontmatter demotes a valid diagram to "Advanced Mermaid"

**What a person experiences.** They write documented Mermaid:

```
---
title: Q3 approvals
---
pie
  "Approved" : 60
  "Rejected" : 40
```

It renders as a correct pie chart, and the app calls it "Advanced Mermaid" in the type chip, in the
generated title and in the right-click menu heading. On a `gitGraph` it is worse: the menu loses its
**Branch colours…** row, so a misdetection removes a real action.

**Measured on the base**, plain source on the left, the same source with frontmatter on the right:

```
#diagramTypeText     Pie chart / Git graph / Timeline / XY chart  ->  "Advanced Mermaid" (all four)
#diagramTypeSelect   pie | gitgraph | timeline | xy               ->  "advanced"
#newDiagramTypeButton.disabled   false                            ->  true
```

Every plain control produced the correct label, so the measurement separates cleanly.

**The trap, and it is the reason this job is worth a whole slot.** The obvious fix strips frontmatter
inside `detectMermaidDiagramType`, and a probe written from this brief goes fully green in one patch
— because the chip, the title, the menu heading, the Branch colours row and `#gitBranchSection` all
flow through that single function. It is still wrong: the same "first non-comment line" scan is
copy-pasted in five more places, including `parseStructureRows`, `structureIsFlowchart` and
`structureNativeSummary`. Find them and say what you did about each.

Also report, separately, which of `sankey-beta`, `radar-beta`, `quadrantChart` and `C4Container` are
genuinely unrecognised versus simply not valid in the embedded Mermaid version — those are different
problems and only one is worth fixing.

---

## If there is room, and only then

Three small truths, each measured and each cheap. None is worth displacing a job above.

- Every confirmation button in the app is red, including on dialogs whose own text says nothing is
  lost. The app's strongest visual warning has been spent on everything, so it now means nothing.
- The word "workpapers" reaches the user in five confirmed places outside the Docs surface, most
  visibly in Import. It appears nowhere else in the product and means nothing outside an audit team.
- **KPMG Blue is the only animated theme with no ✦ beside its name** — all 27 starred themes really
  do animate, so the mark never over-promises; it just misses the one theme an auditor is most
  likely to want. One entry.

## Not in this round, deliberately

The 1.7s brand intro (the app is usable at 493ms and uncovered at 2186ms), a legend for the ✦ glyph,
regrouping the theme menu's five categories, and a read-only share link that may silently downgrade
to editable. The first three are the owner's decisions rather than defects; the fourth needs its own
triage before anyone patches it.
