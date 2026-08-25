# SIREN Round 13 — finish round 11

Read `ROUND8_METHOD.md` first; the method is unchanged.

> **Round 12 is also held**, and one decision in it is the owner's rather than yours. Its verification
> found that the offline switch does nothing whenever the URL carries a fragment — and writes the
> opposite preference while doing nothing, so somebody leaving strict mode is told on screen they are
> still protected and the protection then drops by itself at the next reload. The cause is one line:
> `location.replace(destination.href)` where `destination.href === location.href` is a same-document
> navigation, so the head bootstrap never re-runs.
>
> **You will not be asked to fix that**, because the owner has decided the offline product should not
> contain the external host at all — not opt-in, not default-on, absent from the code and from the
> policy. Two builds: one that physically cannot reach out, one labelled Connected that keeps ELK.
> That deletes the toggle rather than repairing it. The mode you built was careful work and the brief
> asked for it; the brief was asking for the wrong shape. That is mine, not yours.

**Round 11 is held, not rejected.** Four of its six jobs did what they claim at the core and two of
them are the best work in this project so far. It is held because two jobs shipped a regression
beside their fix, and because four sentences the app now says are sentences it cannot keep.

An independent pass verified every job and a second pass was then told to refute every verdict. What
follows is what survived that, with the measurements attached.

---

## What you got right, precisely

**AV is the strongest result of the round.** The first-run tour no longer eats a first-time user's
typing: seven independent fixtures, all real keystrokes, **7 of 7 kept every character where the
shipped build kept none**. It was attacked hard — a phrase with no space in it (so the loss could
not be blamed on the spacebar), a full page reload mid-first-run, a 12.4-second typing window across
620 focus samples, three browser engines — and it did not budge. The mechanism was checked rather
than assumed: `showTourStep(index, focusNext = false)`, the recursive skip-a-hidden-step call
forwards the flag unchanged, there is no third call site, and the default is load-bearing because
`setTimeout(startWelcomeTour, …)` calls with argc=0 in Chromium 152, Firefox 153 and WebKit 26.5.
And it did not over-correct: all five real tour actions still hand focus to the card.

**AY and AZ survived a hostile second pass on paths nobody designed for** — reloads, menu-driven
renames, deleted documents, deleted diagrams, keyboard menus, read-only shares. That is careful work.

**BA genuinely made the marker clickable**: 25 of 25 sampled points open the document, where the old
build opened nothing and panned the canvas instead.

**AW's warning state machine could not be broken.** It fires exactly when the minimum emitted size is
under 9pt and never otherwise, across seven diagram types and twelve sequenced exports in one
session — export twice without closing, shrink to 3 blocks (clears), grow to 44 (returns),
gantt-then-flowchart with no leak, Excel→PowerPoint→Excel, export/F5/export. No false positive, no
false negative.

---

## BE — the marker must stop being the block

**Ship-blocker, and the worst thing in the round because its worst case is silent.**

BA's 18×18 hit rectangle sits inside the block's frame but outside the block's group, so it stops
being the block for every gesture except a plain left-click.

```
at (1024.85, 471.89) — inside the block, outside the visible glyph
  BASE     source gains "D --> B", status "4 blocks and 4 connectors", Docs closed
  MERGED   source unchanged, status "3 connectors", Docs OPEN, connect mode STILL ARMED
```

With connect mode armed, clicking the target block's top-right corner **destroys the connection you
were drawing**, opens Docs over the canvas, and leaves the mode armed. No toast, no error, nothing to
notice. Double-click-to-rename, Ctrl+click and block-drag are dead at the same pixel; BASE did all
five things there. Right-click gives "Diagram actions" (Fit to page / Export PNG) instead of "Actions
for Bravo step" — and the block menu is the only place round 11's own AZ Documents rows live, so the
marker hides the feature it belongs to.

The dead area grew from 198px² to 380px² — 1.92×, on a 1-px grid over the same corner. On a
`stateDiagram-v2` node measuring 65.19 × 38.5, the rect is **27.6% of the width and 46.8% of the
height**, and that diagram's own Guided panel still tells you to click nodes in the preview.

**Done means**: the marker claims only a plain, unmodified left-click with no mode armed. Everything
else falls through to the block. The clean way is to put the marker group inside `g.node` so
`closest('[data-node-id]')` resolves; forwarding right-click, double-click, Ctrl+click and drag-start
to the node handler is acceptable. **Minimum acceptable: while connect mode is armed the marker does
not claim the click at all.**

While you are there: the rect is not centred on the glyph. It spans `nodeRight-18 … nodeRight`
(centre −9); the glyph spans `nodeRight-13 … nodeRight-2` (optical centre −7.5). 10.5px of slack on
the left, 7.5px on the right.

---

## BF — give the line breaks back

**Ship-blocker, and part of this one is my fault. Read the next paragraph before the job.**

The brief told you the deck route already solves the small-type problem and that its parts are the
reference implementation — reuse `deckShapeTextBody`, do not invent a second mechanism. You did
exactly that. What the brief did not say, and should have, is that the two callers hand it different
things: **the deck route splits a label into lines before calling it, and the diagram route hands
over one flat line.** `wrap="none"` is correct for the first and wrong for the second. I pointed you
at a mechanism whose premise does not hold for the new caller.

The consequence, measured with Arial metrics at the emitted point size (theme1.xml `minorFont` =
Arial, byte-identical on both builds):

```
flowchart TD  A[(Registrul general al operatiunilor contabile)] --> B[Pas]   at 18pt
  identical shape on both builds: 261.60 × 132.79pt, one run measuring 336.2pt
  BASE  wrap="square"  PowerPoint breaks it onto 2 lines, 43.2pt of a 132.79pt box — inside
  MERGED wrap="none"   cannot break; runs 77.48pt past the 258.72pt usable width
                       ≈37pt out of each edge, 29% wider than the shape
```

A diamond at 15.47pt spills 18.29pt. On the 44-block fixture, `wrap="none"` count is **BASE 0,
MERGED 43** — every edge label. This is a working case broken to fix a broken one, and it bites
ordinary legible diagrams rather than dense ones.

**Done means**: `wrap="square"` for any label the collector hands over as a single flat line — the
diamond, cylinder, pill, free text and every edge label. `wrap="none"` only where the label is
already split into lines. A one-line guard is enough: measure the run and fall back to square when it
exceeds the usable width. The rectangle case that started all this must stay fixed; prove both in the
same run.

---

## BG — do not offer a jump to a block that does not exist

**Your rule, not mine.** The app now says "Open this block in its diagram" and offers an enabled
"→ Go to this block" row on targets where no block exists. The click closes Docs, opens the diagram,
and stops. No inspector, no ring, no toast, no error.

Reached by a straight line — make the diagram, use the app's **own** "Diagram step to reference"
dropdown, add the link, right-click the chip. Dead on **4 of 7 types**:

| type | what the app's own picker offered | after a real click |
|---|---|---|
| sequenceDiagram | `Alice` | inspector closed, `g.node` = 0 |
| erDiagram | `places` — a relationship label; entities are never offered | inspector closed, 3 groups, 0 `data-node-id` |
| mindmap | the literal keyword `mindmap` | inspector closed |
| journey | `Day` — the title | inspector closed |

flowchart, stateDiagram-v2 and classDiagram all work correctly in the same run. A fifth case: an
ordinary flowchart with numbered blocks (`1[Receive invoice] --> 2[Match to PO]`) — the picker offers
only `['Whole diagram','TD']`, the chip promises the block, the click is silent, **and the app
already knows**: `#nodeStyleTarget` reads "No styleable rendered blocks".

Both routes die at the same `if (anchor)` guard, `round11/app.html:62424-62441`.

**Done means**: the wording is gated on a node group actually resolving, not on the id appearing in
`extractMermaidNodeCatalog`. If `findSvgNodeGroups` would return nothing, keep the old honest
"Open this diagram" / "→ Open this diagram" and disable the block row with the same reason string the
dangling case already uses. Add a message when a jump cannot land.

Behind it, pre-existing and worth cleaning up if there is room: the picker offering `TD`, `mindmap`,
`Day` and relationship labels as blocks at all.

---

## BH — the arrival has to bring the block on screen

The chip arrives at the block's **inspector**, not at the block. The canvas never scrolls, so the
panel names a block the user cannot see and, having no on-screen anchor, floats over the Build panel.

This is not a long-diagram edge case. **A five-block flowchart in a 1024×700 window already fails**:
chip title "Open this block in its diagram", heading "Block CHARLIE", ring correctly on CHARLIE — and
CHARLIE's rect is at `y: 689` in a 700px window.

**Done means**: the destination is visible when the arrival completes. Scroll it into view, and if it
cannot be brought into view, say so rather than opening a panel about something off-screen.

Related, same job: the Build panel does not follow the arrival, so two "selected block" surfaces
disagree. After arriving at Block DONE, the inspector says DONE and the ring is on DONE, but the
Build panel card PAY is still `[SELECTED]` and the "Edit a block" dropdown still reads PAY — so the
block a person would edit next is not the block they were just taken to.

---

## BI — finish AV: one press away, escapable, announced

The fix is right and must not be reverted. What it left behind traps a keyboard-only first-run user,
and the round's own disclosure — "reachable by Tab" — is the sentence that cannot ship.

Measured independently by both passes, cold, at three key speeds, with `document.hasFocus()` true
throughout: **76 forward Tab presses to Skip, 77 to Next.** On the shipped build it cost zero — the
card handed focus over on arrival and Skip was one Shift+Tab away. There is no second route: Escape
does nothing on either build (no tour branch in the handler), the card has no `tabindex`, no
`aria-modal`, and is `document.body.lastElementChild`. Shift+Tab appears to reach it in 8, but press
7 reports `hasFocus()=false` — that is the harness leaving the document, and both passes agreed
independently it must not be counted as a route the app provides.

Three things make it worse than long:

1. **The route damages the diagram.** Bare Tab inside `#zoomViewport` is bound to
   `addBlockRelativeToSelection('child')` at `app.html:37361`. Press 65 does not move focus — it
   appends `A --> N1[New step]` and the source grows 295 → 318 characters. Deterministic on both
   builds. See BJ.
2. **A screen-reader user is never told the card exists.** `role="dialog" aria-label="Welcome tour"`,
   no `aria-modal`, no `aria-live`, no announcement call anywhere in `showTourStep`. On the old build
   the focus move was doing the announcing; nothing replaced it.
3. **`state.tourDone` is never set**, because typing no longer walks the tour to its end. The card
   returns at **every launch** for anyone who ignores it — so a keyboard-only user meets an
   undismissable card on every boot.

**Done means**: `tabindex="-1"` on `.tour-card`, an Escape-to-Skip handler, a polite live-region
announcement when the card appears (or make the first Tab after it appears land on it), and a path by
which the card stops coming back without the user having to complete it. Keep `focusNext` exactly as
you patched it. After this lands, "reachable by keyboard" becomes a sentence you can write down.

---

## BJ — a navigation key must not edit the document

**Pre-existing, not yours, and it is on the project's own acceptance list: _no standard navigation
key modifies data_.**

Bare Tab inside `#zoomViewport` adds a block to the user's Mermaid source (`app.html:37361`).
Somebody tabbing through the page to reach anything at all rewrites their diagram, silently, and the
only sign is that focus did not move.

**Done means**: Tab moves focus. If adding a block from the canvas is worth a shortcut, it needs a
modifier. Check what else in the preview binds a bare navigation key before you decide the fix.

---

## Smaller, all measured, take them if there is room

1. **The under-9pt number never renders in the status bar.** `#status` is
   `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`. The new sentence is 849px of text;
   at 1440 the element is 825px, at 1100 it is 485px — and the ellipsis falls **before** the number,
   so the bar reads "…falls under 9pt at this slide size…" and stops. The dialog banner and the toast
   both wrap and show it in full, so only this surface lies.
2. **"1.0pt" is the clamp, not a measurement.** 44 blocks and 120 blocks both report 1.0pt though the
   boxes differ threefold, so halving your diagram and re-exporting reads identical and concludes
   nothing changed.
3. **The warning arrives in a success-styled toast** at the same moment the dialog banner turns
   amber, with identical words. Someone who already closed the dialog sees only the green one.
4. **The advice sentence recommends a horizontal layout to diagrams that are already horizontal**,
   where going horizontal measures worse. Note: this is `mapDeckSmallTypeNote` at
   `FROZEN_R11_BASE.html:80125` — it already shipped on two other routes, so round 11 duplicated an
   existing defective sentence onto a third button rather than inventing it. Fix all three callers.
5. **Two ordinary key presses delete a reference with no confirmation.** On a dangling chip,
   `openStructureMenu` focuses the first non-disabled row and AY puts the disabled jump row first —
   so Shift+F10 then Enter lands on Remove.
6. **"WP-001 · <title> — click to open" is live in the Presentation stage**, where clicking does
   nothing and the cursor is `grab` (the pointer rule is scoped to `#diagram`). The same promise, and
   a dead `pointer-events=all` rect, ship inside the exported static SVG.
7. **The arrival marker lands on the wrong block when two ids share a hyphen-delimited fragment** —
   PAY / PAY-LATER, AP-1 / AP-1-REVIEW, an ordinary audit pattern. `findSvgNodeGroups` matches
   `gid.includes('-'+id+'-')` and `endsWith('-'+id)`. Pre-existing.
8. **The tour counter promises six steps and delivers four**, and the last card a user sees ends the
   tour with a button labelled "Next". Steps 2 and 6 have no `offsetParent` in Build mode, so
   `showTourStep` recurses past them while the `/6` denominator and the "Done" label are computed
   from the full list. Pre-existing.
9. **Every diagram label lost its run-level `<a:latin typeface="Arial"/>`** because
   `deckShapeTextBody` does not state the face where `ooxmlTextBody` did. Harmless as shipped — the
   theme still declares Arial — but the text now follows whatever the deck theme says.

---

## Two corrections to the round 11 handback, both about evidence rather than code

- **"BASE 87 violations, MERGED zero" evidences the attribute flip, not the outcome.** "Clipped" was
  defined as `vertOverflow=="clip" AND lines*1.2*sz > cy`, and the patch hard-codes
  `vertOverflow="overflow"` on every body — so that count cannot be non-zero on MERGED for any
  diagram. "Violation" is `sz > cy`, and with `sz` floored at 1pt against a smallest measured `cy` of
  1.45pt, no shape can violate. Both headline numbers are guaranteed by the two attributes the patch
  writes. The numbers are real; they prove a different thing than they were offered for.
- **"Real, selectable, resizable text in a real shape rather than a picture" is vacuous.** BASE
  already gave `picCount=0`, an empty `ppt/media/`, and 88 `<p:sp>` shapes each holding its label at
  `sz="600"`. Round 11 changed the point size and the overflow attributes; it did not make the text
  real, because it already was.

## The standing rule

Nothing in this app may promise what it cannot deliver. A tooltip, a chip, a count, a menu label, a
disabled state or a colour that overstates is a defect of the same kind as a crash. Four of the six
holds above are that rule, not a bug.
