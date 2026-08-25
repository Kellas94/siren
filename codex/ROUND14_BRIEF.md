# SIREN Round 14 — eight deletions

Read `ROUND8_METHOD.md` first; the method is unchanged. The base is your round 13 output, frozen
unchanged:

```
codex/FROZEN_R14_BASE.html
8,601,839 bytes
SHA-256  60585A8B7764AE989F96BE07447878F6CDBFF9796A36484BDC7AE52A6479E77A
```

**This round adds nothing. Every item below removes or narrows something round 13 added.** There is
no design work in it.

---

## What happened, plainly

Round 13 was six repairs to the six holds on round 11. Two of them are excellent and ship exactly as
they are. **Four of them broke the capability they were written to repair**, and three of those now
lose or falsify words somebody typed.

The sentence that decides this round: **in all four cases round 11's original bug is the lesser
evil.** Round 11 annoyed the user. Round 13 writes half a sentence into their diagram and throws the
other half away.

That is not a criticism of the work — three of the four are one guard bolted onto a repair that is
itself correct and measured. The centring in BH is genuinely better than round 11 between 130% and
280% zoom. The gesture fall-through in BE works. The phantom-reference withdrawal in BG is right.
Each one then acquired a gate that is stricter than the thing it protects.

---

## What ships untouched — do not open these files

**BF is a large, clean repair.** An ordinary audit label — *"Customer master database reconciliation
and general ledger posting summary prepared quarterly"* — came out of round 11 as a single **776pt
line running from x=22 to x=799 on a 960pt slide**, straight through the neighbouring block. Round 13
turns it into four clean lines wholly inside the shape. Diamond +583pt of overhang to zero, pill
+485pt to zero. The deck route was emitting a **1130pt line onto a 960pt slide** — wider than the
slide itself — and now wraps. The dense-rectangle fix from round 11 is preserved **byte-identically**:
the entire change to that slide is 86 bytes across 43 places, all the same attribute. The Excel
drawing is byte-identical, verified on two fixtures by two engineers. All runs match across 22
diagram fixtures and 5 deck slides.

**BJ is clean.** Round 11 let a bare Tab or Enter write into the source: 4 of 72 pane/key
combinations mutated the file, a 140-press walk produced 5 unwanted blocks, and there is a
two-gesture route — one click on empty canvas, one Tab — that edits the file with nothing selected.
Round 13: **zero mutations on all 72 combinations, zero on the walk, zero on the empty-canvas route.**
It removed exactly one route and that route was the defect: no menu, no command, no button reached
it, and no help text anywhere promised it. Ctrl+Enter creation still works, byte-identically, on
Windows and macOS.

---

## The eight deletions

### 1. Delete the 520ms timer — `app.html:37930`

**This one alone kills five defects.** To let a double-click cancel it, the marker click now opens
the document through a half-second timer. Nothing happens on screen in that window, so a person
carries on typing — and Docs then steals focus mid-word.

```
Code route      BASE loses nothing, source byte-identical
                MERGED lands 10 of 37 characters, then 7 of 29, then 6 of 29
                #source left ending in the unbalanced fragment   E[Typ
Canvas route    MERGED committed  B[Payments rec]  — 12 of 23 characters — into the diagram
Palette route   MERGED holds 'QQQ' of 12 typed; the other 9 are discarded, written nowhere
```

Five of five runs between two engineers. **Delete the `setTimeout` wrapper and run its body
inline.** A double-click will then open the document — which is what round 11 did and what the
marker's own tooltip promises. The modifier and mode guard above it, which is the actual repair,
stays exactly as you wrote it.

That also removes the 6× slowdown (93ms → 559ms with no spinner, no highlight, nothing), the dead
Escape, and the buried right-click menu.

### 2. Move the drag-suppress guard back below the marker branch — `app.html:37910`

Correct in intent — a drag's own release click is not a document request — but implemented as a
stopwatch rather than an identity test. So it also refuses a **separate, deliberate click on a
different element half a second later**. Drag a block, then open its neighbour's document: the second
gesture is ignored entirely. Move the guard below the marker branch, or add `&& !workpaperMarker`.

### 3. Exclude the marker from the body-drag press

An 18×18 corner glyph is not a drag surface. A 9-pixel wobble during the click turns it into a silent
no-op. Exclude `[data-t-workpaper-node]` from the body-drag press.

### 4. Delete the `fullyVisible` refusal — `app.html:62473-62480`

**This one guard is responsible for two blockers.**

The Docs-to-block reference is **completely dead on any window 900px or narrower** — laptop
half-screen, tablet, split view. The guard compares the block's rectangle to the preview pane's
rectangle, and `app.html:12071` sets `.pane { display: none }` under `@media (max-width: 900px)`. So
that rectangle is 0×0 and the test can never pass.

```
widths swept   1024 / 1000 / 980 / 960   both builds open 'Block CTRL', label populated
               900 / 820 / 800 / 760 / 700
  MERGED       inspector hidden, heading generic 'Block', label empty, red toast — all five
  BASE         full inspector, heading 'Block CTRL', label populated, no toast — all five
```

It is unconditional there: the Docs button lives in the editor pane, so the chip can **only** be
clicked while the preview is hidden, and the More menu has no other route to Docs. The same guard
also refuses any block bigger than the pane, however well centred.

**Keep the scroll-and-centre — that part is genuinely good, residual 0–1px, and better than round 11
between 130% and 280% zoom.** Delete the refusal and always open the inspector afterwards.

### 5. Delete `selectVisualNode(nodeId)` and `canvasFocusBlock(nodeId)` from the arrival — `app.html:62458-62459`

Arriving at a block silently destroys text somebody typed and has not applied. The arrival calls the
visual builder's refresh, which overwrites the Block label field unconditionally.

```
Build mode, select a block, clear the field, type 'UNSAVED WORK 2026', never apply.
Open Docs — the field still holds it on both builds. Click the chip.
  MERGED   field becomes 'Charlie step'
  BASE     field still reads 'UNSAVED WORK 2026'
```

No toast, no dialog, no warning. **Neither undo brings it back, because the source never changed, so
there is nothing to undo.** It also leaves the Delete key armed on the arrived block.

### 6. Delete the Tab branch — `app.html:22651-22658`

A guard that refuses **every Tab in the application** so that one Tab can reach the tour card. It
refuses the editor's indent, the Visual builder's add-block, the menus, and all 19 header and panel
controls. It also discards a typed block label on the way.

**Keep everything else the tour repair added** — `tabindex`, the live region, Escape-to-dismiss and
its persistence. Those are the parts that were asked for and they work.

### 7. Widen the Escape guard — `app.html:22643`

**Escape-to-cancel became Escape-to-commit.** Type a new block label in the inspector, change your
mind, press Escape — and the app writes the abandoned text into your diagram instead of discarding
it. The tour's new Escape handler runs on the **capture phase** and swallows the inspector's own
revert before it can fire, so the edited value survives to the next click, and that click commits it.

```
click 'State' node, click the label field, Ctrl+A, type 'ZZZTEST', Escape, then click Shape
  BASE     label reverts to 'State', #source stays 295 chars, A[State] intact
  MERGED   tour gone, label still 'ZZZTEST', #source 295 -> 297, A[State] becomes A[ZZZTEST]
```

Zero console errors on both builds. This failure is invisible to everything except the auditor who
later reads their own diagram.

The guard tests `document.querySelector('dialog[open]')`, but the surfaces that actually consume
Escape are not native dialogs — the palette is a `DIV`, the inspector an `ASIDE`, the theme menu a
`DIV`. **Widen it to those surfaces, or move the listener off the capture phase** so each surface
claims Escape first.

### 8. Stop disabling the menu row on `nodeResolvable` — `app.html:29542`

After any reload, the same machinery falsely reports **live, working references as missing** — and it
does so through a menu row that then refuses to act, while the button beside it performs the very
jump the row calls impossible. The resolver is gated on an in-memory cache (`app.html:60723`), so the
same chip reads "Open this diagram" after a reload and "Open this block in its diagram" after you
happen to click through the tabs, with nothing about the file having changed. A control whose wording
depends on browsing history rather than on the document.

**Keep the honest post-click message — that is BG's real win.** Keep the phantom withdrawal too:
sequence, ER, mindmap and journey references genuinely cannot resolve, and round 11 failed silently
there. Only the disabling-on-cache-miss goes.

---

## Not in this round

**BF's inscribed-shape wrap.** Diamonds and ellipses hold their text in a rectangle far narrower than
the shape, so one long unbroken word now breaks mid-word where round 11 laid it flat — about 64pt of
text in a diamond, 42pt in an ellipse. Three of the five shape types never reach it, and what it
replaces is a 776pt line sprayed across a 261pt cylinder and over the next block. **A real but small
price for a large repair.** The fix when it comes is to measure the label against the shape's text
rectangle before choosing to wrap — not to revert BF. Round 15.

---

## Verification

Every item above is a removal, so the verification is symmetrical and short: for each one, prove the
defect is gone **and** prove the thing the deleted guard was protecting is still protected. Deleting
the `fullyVisible` refusal must not bring back an inspector floating over a block nobody can see;
deleting the timer must not bring back a double-click that opens two documents.

Test one step sideways from your own fixture, every time. A check that finds nothing on both builds
has established nothing — say so rather than counting it green. Where a fix is visual, render it and
look.

## The standing rule

Nothing in this app may promise what it cannot deliver, and nothing may ever silently lose what
somebody wrote. Three of the eight above are the second half of that rule, and they are the reason
round 11 cannot ship until they are gone.
