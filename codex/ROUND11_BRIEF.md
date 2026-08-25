# SIREN Round 11 — first-run typing, a silent export, and the last third of a feature

Read `ROUND8_METHOD.md` first; the method is unchanged. The base:

```
codex/FROZEN_R11_BASE.html
8,591,186 bytes
SHA-256  2F2DA0BDA18427E3262EB97D06401723183D1938A09083654C64AFE791223030
```

**This is the shipped 1.70.0.** Your round 10 went out in it, alongside seven patches of mine: the
second editor slot reads Build / Sequence / Guided and routes there; that tab no longer paints itself
disabled while working (a ship-blocker the verification found in **my** patch, not yours); the editor
heading says "Guided lines" when the Guided rows are showing; the window title prefers a name a
person typed; the theme menu is four groups on both the menu and the phone list; and a context-menu
heading built from a long unbroken name now wraps instead of running off the screen.

`APP_VERSION` and `CHANGELOG` are already correct for 1.70.0 — leave both alone.

Round 10 was good, and one thing in it deserves saying: **the brief told you moving three lines was
the whole AU job, you measured it, and it was not** — the reorder fixed the Docs announcement and
left the Present row clipped at four widths. You did the extra work and said the brief had been
wrong. That is exactly right, and it is worth more than the patch.

---

## AV — the welcome tour takes the keyboard away and eats what a first-time user is typing

**Rank 1, and the only job here that destroys what somebody wrote.**

About 2.3 seconds into a first visit, focus jumps out of whatever box the person is typing into and
onto the tour card's Next button. Measured on this base with real typing:

```
typed "Review request" (14 characters) into #visualNodeLabel
  the field holds        "Revie"        5 of 14 — nine characters destroyed
  focus ended on         BUTTON.btn     the tour's Next button
  the tour reached       "3/6"          their own typing advanced it two steps
in Code mode, the word never reached #source at all
```

Nothing warns. The status strip still reads "Syntax looks valid." It happens on the default screen,
in the box the product is pointing them at, and the faster somebody types the more certainly they
hit it.

**Where it is.** The last line of `showTourStep(index)` is `next.focus();`. The tour is armed by
`if (!state.tourDone) setTimeout(startWelcomeTour, introPlaying ? 1900 : 1100);`. Victims are
`#visualNodeLabel`, `#source`, and any contenteditable block inside `#wpBlocks`.

**Done means**, in a fresh browser process with empty storage: click `#visualNodeLabel`, start typing
at about 1.5s and keep going past 3.2s — the field holds all fourteen characters. The same in Code
mode: all of it lands in `#source`. Across that window `document.activeElement` never leaves the
input, and the tour's step counter still reads `1/`. With no typing at all the tour still appears and
its Next button is still reachable and operable by Tab and Enter.

**Three ways a fix looks right and is not:**

1. **Verifying by pressing F5.** The tour is first-run only, gated on `state.tourDone`, so a reload
   measures a path where it never appears. That check passes on the unfixed build. Every
   verification needs a new context with empty storage.
2. **Guarding on `activeElement.tagName === 'INPUT'`.** That misses the Docs contenteditable blocks,
   and it misses the person who clicks into a field a second *after* the card appeared —
   `showTourStep` runs again on every Next, and each run calls `focus()`, so the theft repeats.
3. **Deleting `next.focus()` outright.** That fixes the theft and strands keyboard users, who then
   have no way into the card. Give focus when the tour was advanced by a real click or keypress,
   never when it arrives on a timer.

---

## AW — a large diagram exports to PowerPoint as unreadable clipped slides, silently

Export → PowerPoint on a 44-block flowchart produces one slide of 44 dark bars in a narrow column.
Each block is about **15.8 × 4.7 points with 6pt text written into it**, and PowerPoint clips the
overflow, so the words are gone. The status line reports a successful editable-shapes export and
raises no warning. A five-block diagram through the same button is fine — 11.17pt in 192.8 × 43.6pt
boxes — so nobody can predict which of the two they will get.

**The other route already solves this**, and its parts are the reference implementation — do not
invent a second mechanism. `deckShapeTextBody()` uses a 1pt floor with `vertOverflow`/`horzOverflow`
set to `overflow`, and carries a comment explaining why 6pt was wrong. `PDF_MIN_FONT_PT = 9`,
`getMinimumExportFontSize()` and `mapDeckSmallTypeNote()` already exist. Present → Build → Slides →
PowerPoint splits the same diagram across six slides, keeps type at true size, and says so out loud.

**The broken route** is `#exportPptxButton` → `buildPptxBlob()` → `buildEditableSlideShapes()` →
`ooxmlTextBody(shape)`, whose first line clamps to a floor of 6 and whose `bodyPr` sets both
overflow attributes to `clip`.

**Done means**: export the 44-block flowchart, unzip, and read `ppt/slides/slide1.xml` — for every
text shape, `sz/100` is no larger than that shape's own `xfrm` height in points, and no shape whose
text would overflow carries `clip`. The export's own status carries an under-9pt sentence naming the
measured smallest size, as the deck route does. **Control that must not regress:** the 5-block
flowchart through the same button still writes ~11pt into ~193 × 44pt boxes and raises no warning.

**Traps.** Lowering the clamp floor alone makes the numbers look right while the words stay erased —
the clip flags are what deletes them; switching to overflow without lowering the floor leaves 6pt
text sprawling over its neighbours. Both move together. And `ooxmlTextBody` emits `<xdr:txBody>` —
the Excel-shaped writer — so check every call site, including the Excel diagram export, before
changing its signature. A fix that silently reshapes the Excel drawing shows up in no PowerPoint
check. Finally, verify by reading the OOXML numbers: there is no LibreOffice on this machine, so any
picture of a slide is a reconstruction rather than proof.

---

## AX — following a reference lands on the diagram but not on the block it names

The owner reported this feature as undelivered. It is not — **two thirds of it works**, and that was
measured: creating a link works, the chip shows in the document with a × to remove, a dangling target
renders distinctly, the linked node carries a ▤ mark naming the document, and the inspector route
from block to document works.

What does not work is the arrival. A chip reads "Diagram · Diagram 1 · Purchase request"; clicking it
closes Docs and shows the diagram, and then nothing is selected, no inspector opens, and nothing
marks the block the chip named. On a forty-block diagram you are dropped in and left to find it. The
chip's own tooltip is honest about it — it says "Open this diagram", not "go to this block".

**Almost all of it is already built.** `resolveWorkpaperLink()` resolves and returns a populated
`.node` for the referenced block. `openWorkpaperReference()` already does the right thing for
`kind === 'block'` — it jumps and focuses. The gap is the four-line `kind === 'diagram'` branch,
which closes Docs, switches diagram if needed, and returns — **discarding the resolved node it was
handed**.

**Done means**: create a chip targeting a named block and click it with a real mouse — Docs closes,
the diagram is visible, and the destination is identifiable in the DOM: the node inspector is open on
that block, or an equivalent unambiguous marker. And update the tooltip to say what it now does.

---

## AY — right-clicking a reference chip offers no way to jump to the block

This is literally the gesture the owner asked for, and it is worthless unless AX lands first.

Both halves exist: `buildDocsContextMenu(target, point)` already tests a ladder of four sibling
branches, and `openWorkpaperReference` is the destination. Only the branch connecting them is
missing.

**Done means**: a real secondary click on a live chip returns a menu whose heading is the chip's own
text, carrying a jump row and a remove row; choosing the jump row produces the same measurable
arrival as AX.

---

## If there is room

**AZ — right-clicking a diagram block gives no route to its documents.** The inconsistency is visible
on the menu itself: comments are there, documents are not. `renderNodeDocPanel(nodeId)` already
computes exactly the list needed — documents linked to this node, plus diagram-level ones. Done: a
row naming the document appears and opens Docs on it; an unlinked sibling block shows no such row.

**BA — the ▤ mark on a diagram block cannot be clicked.** A visible marker that names a document and
refuses the click is a dead gesture, and the route it names is two levels down. The destination is
finished and correct; the mark is a bare SVG `<text>` in the adornment layer with no handler.

---

## Fifteen items were dropped before this brief was written

So that none of them comes back: boot has not regressed (DOMContentLoaded p50 342ms over ten cold
loads, fresh process each); a .docx no longer opens in Word compatibility mode; holding Delete in
Guided removes exactly one line, proved three ways; the PPTX connector-label defect is fixed on the
deck route; "Agent spec in two identical dropdowns" is fixed; the theme menu is capped. The
References machinery being "orphaned" was **my own measurement artefact** — the controls are inside
a bar I had not opened.

## Not in this round, deliberately

Per-block references in Docs — the owner's literal "link a block to a diagram block" — is a product
decision before it is a patch, with two incompatible shapes. Docs chrome density, the editor pane's
control count, and the 1,750ms brand opening are judgement calls or owner decisions, not defects.

## Closed since this brief was first written

The long-name context-menu heading hole is fixed and shipped: `.struct-menu-heading` had no
`min-width: 0` and no `overflow-wrap`, so one unbreakable underscored token pinned the grid track and
held the menu wider than a narrow window. Measured before: on a 412px screen the menu hung 75px off
the left edge on 1.69.0, and the heading ran 67.5px past the menu's own clip edge once round 10
brought the menu on screen. Now two lines, nothing cut, unchanged at 1440. Do not re-open it.
