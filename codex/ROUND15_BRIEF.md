# SIREN Round 15 — finish it: four repairs and one decision

Read `ROUND8_METHOD.md` first; the method is unchanged. The base is round 14's output, frozen:

```
codex/FROZEN_R15_BASE.html
8,599,649 bytes
SHA-256  0C17FB6673FD1FC5DE24CC5C474B49EAE85505589E373E7ABA870BE345338F97
```

**This round is scoped as repairs only. No new capability, no new guard.** Round 11 has now been held
three times; this is what stands between it and shipping. The ELK work and the round 12 rework are
written separately as round 16 and deliberately kept out of here — round 13 failed partly because a
round tried to do too much, and this one ends with something you can ship.


**Round 14 is the right direction and nothing in it is reverted.** Six of the eight deletions land
cleanly and make the app better than round 13 *and* better than round 11: the marker opens its
document in **17–20ms instead of 543–555ms**, Escape stops committing text nobody asked to commit,
Tab works in the editor and the builder again, and a reference row stops calling a diagram two inches
away "no longer in this workspace".

The framing the verification landed on, and it is the useful sentence: **rounds 13 and 14 were both
correct about what was wrong and both wrong about what to do. Round 13 added a gate everywhere.
Round 14 removed them.** None of the fixes below adds a gate, and that is a constraint, not a
preference. If your answer to any of them is a new guard, stop and say so instead.

---

## BO — a double-click on the marker presses whatever Docs puts under the cursor

**Ship-blocker, and the writing it destroys survives closing and reopening the document.**

Docs is a full-viewport overlay (0,0,1440,900) while the canvas viewport starts at x=508. So the
first click opens Docs, and the second click of a double-click lands on whatever the document renders
at that pixel — a heading with a word selected, a caret in rich text, a table insert bar, the
Add-block menu, or the document's own Undo button.

```
real detail=2 double-click, marker centre over #wpUndoButton (682.9, 255)
  round 14   Docs opens, elementFromPoint at release = button#wpUndoButton,
             toast "Undone.", the 11 characters typed into the document are GONE,
             the block flagged edited and empty, Undo greys out, Redo goes live
             — and still gone after closing and reopening the document.  2 of 2 runs.
  round 13   at the identical pixel: no Docs, the canvas rename opens, text intact.
```

Reproduced on flowchart TD, stateDiagram-v2, classDiagram and flowchart LR with subgraphs. Single-
document markers only; a two-document marker behaves identically on both builds.

**Done means, and the shape matters:** `handlePreviewNodeClick` already guards `event.detail <= 1`,
but the second click never reaches it — the overlay is already covering the marker. So the fix is
**overlay-side**: after a marker click opens a document, discard pointer events arriving on the Docs
surface with `event.detail >= 2` for one double-click interval, about 400ms.

**This is not round 13's timer and the difference is the whole point.** It delays nothing, it opens
nothing invisibly, it touches no single click, and it adds no state object. Round 13 delayed the
*open*, which is what created the invisible window a person typed into.

Re-measure to close: double-click a marker positioned over `#wpUndoButton`, expect no "Undone." and
the document text intact, on all four diagram types.

---

## BP — after a jump, Update block edits the block you did not go to

**Ship-blocker.** Deletion 5 removed `selectVisualNode(nodeId)` and `canvasFocusBlock(nodeId)` from
`landWorkpaperDiagramNode` to protect an unapplied label draft. Those two calls were also doing the
selection sync, **and only one of them was ever the threat to the draft.**

```
jump to 'Sign off', then open "2 Edit a block", triple-click Label, type 'RENAMED HERE', Update block
  round 13   Build panel SIGN, ring on SIGN, focus on the SIGN group  ->  writes SIGN[RENAMED HERE]
  round 14   Build panel START, ringCount 0, focus on #workpapersButton,
             inspector still reads 'Block SIGN'                       ->  writes START[RENAMED HERE]
             and SIGN is untouched. Same green "Block updated" toast on both.
```

At 800px the two panels physically overlap: a red **Delete** button for one block sits inches under a
heading naming another.

**Done means:** the two calls are not equivalent and must not be restored together blindly.
`canvasFocusBlock` only sets `canvasSelectedId`, repaints the overlay and moves keyboard focus — it
**destroys nothing**, so restore it unconditionally; that alone brings back the ring, the handles and
keyboard reach. `selectVisualNode` calls `refreshVisualBuilder(id)`, which is what wiped the draft —
restore it too, but read `#visualNodeEditLabel` before the refresh and write the value back
afterwards when it holds an uncommitted edit.

Prove **both** in the same run: `SIGN[RENAMED HERE]` after the arrival, **and** `UNSAVED WORK 2026`
still in the label field after the arrival and after pressing Done.

---

## BQ — an editing panel for a block that is nowhere on screen, and it says nothing

Deletion 4 removed the visibility refusal, which was right — the refusal was measuring against a pane
the stylesheet hides below 900px, so the whole feature was dead there. But it was also protecting
against something real.

```
Filters set to "Hide them", 1440x900
  round 13   refuses with a red toast
  round 14   opens a live panel with NO message, then accepts an edit that changes the source
             while the canvas does not move
700px
  round 14   opens 'Block N60' with scrollTop 0 of 6721; tapping Preview closes the panel and
             leaves the person 6,928px from the block
```

**Done means:** when the landed block's rectangle is 0×0, or the preview pane is not displayed, or
the block is filtered out — **open the panel and say so.** One sentence, not a refusal. The whole
lesson of round 13 is that refusing is worse than explaining.

---

## BR — Tab over a selection in the code editor deletes the selected text

**Pre-existing, and it is in what is live today.** Round 14 does not cause it; it hands the gesture
back during the first-run tour, which is where a person is most likely to meet it.

**Done means:** when Tab has a selection, indent the whole lines. The symmetric function for
Shift+Tab already exists — find it and mirror it.

---

## Two one-liners that should ride along

**The tour card's reachability.** `document.body.insertBefore` instead of `appendChild`. It is
`position: fixed`, so nothing moves on screen, and the card goes from **72–81 Tab presses away to
about one** — without stealing focus from anyone typing, which is the property round 11 fought for
and must keep.

**Two places where the app's own words are now false.** The comment above `resolveNodeIdFromElement`
and the v1.59.1 release note. See the decision below.

---

## The decision: abandon a claim, not the feature

Three rounds have now proved that those 324 pixels **cannot honour both contracts at once**. Round 11
made the click a no-op on a wobble. Round 13 bought reliability with a 520ms window that silently
renamed blocks. Round 14 bought instant opening and lost the drag and the rename at that corner.

**So decide it instead of repairing it a fourth time.** The marker corner is a single-purpose
control:

- one click opens the document
- right-click and Ctrl+click fall through to the block — both already work correctly on both builds
- drag and double-click-rename belong to the block's **body**, not its corner

Fix the comment above `resolveNodeIdFromElement`, which still claims "every non-plain gesture still
belongs to the block underneath it", and fix the v1.59.1 release note, which still says "F2 or a
double-click renames in place". **The dead drag corner and the unreachable rename then stop being
defects and become documented behaviour**, at zero engineering cost, and two open items leave this
list.

### And a pre-committed exit rule for BO

The marker click gets **one attempt**. It works, it is twenty-five times faster than round 13, and
BO's fix is genuinely different in shape from round 13's timer.

**If the re-measure is not clean — double-click a marker sitting over the Docs Undo button, expect no
"Undone." and no lost text, on all four diagram types — then the marker click is dropped entirely.**
The glyph stays as an indicator that a document exists, and documents open from the block's
right-click **Documents** row, which already works identically on both builds and names the document.
Deletions 1, 2 and 3 all become unnecessary at that point, and nothing is lost but one shortcut with
three rounds of blood on it.

Say in the handback which of the two happened. Do not attempt it twice.

---

## What is explicitly NOT abandoned

- **The reference chips and the arrival.** Deletion 8 is the cleanest work in round 14 — it removed a
  refusal that was lying, made the menu row and the button beside it agree, and eliminated a keyboard
  path that deleted the reference on the first Enter. Its one open problem is BP, in a different
  group, with a precise fix.
- **The welcome tour.** And round 13's Tab capture must not be reinstated under any circumstance — it
  cost 19 of 19 keyboard controls and made a typed block impossible to add.
