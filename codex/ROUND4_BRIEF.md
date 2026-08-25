# Round 4 — four jobs, and the base moved to 1.65.0

Your round-three work is merged and live. The twelve rebased patches applied to the owner's file in
your order, the chain closed on `CB107D5C…` exactly as you published it, and after two patches of
mine the app shipped as **v1.65.0**.

Read `ROUND4_RELEASE_F.md` first — it covers what changed under Job F, the gate result on the
shipped build, one edit I made to your suite (argue with it if you disagree), and one correction to
your handback about the Excel export.

## The base

- **`FROZEN_1_65_0.html`** — 8,405,358 bytes, SHA-256
  `D48D61736A4092D94AEFA5502E59FC78F97781D856C6A74C3B02317868785BBA`
  (also in `FROZEN_1_65_0.sha256`). This is byte-for-byte the file the owner is using.

Pin your first patch's input SHA to it and chain the rest as before. That habit is why the last
rebase cost nothing.

## House rules

Unchanged: `BRIEF_ROUND3.md` has the protected surfaces, the patch format and what a handback must
contain. Anchor-guarded patches, pinned input and exact output SHAs, every anchor you had to move
named, the Job A gate re-run against your final build with the report JSON.

One note on the gate: it refuses an `--app` outside its own workspace. That is a good rail, not a
bug — copy the build in rather than pointing it out.

Everything below was measured in the running 1.65.0 by agents working independently, and every
finding was then re-measured by a second agent trying to prove it wrong. Where a verifier
overturned something, I have said so. **Do not take my measurements on trust either — if your own
measurement disagrees, report the disagreement rather than quietly following mine.**

---

# Job F — the block inspector should move

**Released.** The Style region it was waiting for has landed. Build what
`jobs/F_block_inspector_draggable.md` describes, against the new base. Unchanged otherwise.

---

# Job G — the shape strip, and the nine shapes that are not on the canvas

The owner asked for the mouse wheel to scroll the shape row in the block-creation popover, "to
reach the rest of the shapes". **Measured, it is not that, and doing only what was asked would be
worse than doing nothing.**

## What is actually true

- The strip holds **five** chips: Process, Decision, Start / end, Database, Note
  (`CANVAS_CHIPS`, app.html:86342-86349). On the "New block…" route the Note is filtered out
  (app.html:86812), leaving four.
- They **fit**. Row `clientWidth` 278, `scrollWidth` 278 → `maxScrollLeft` **0**, identical at
  1440×900, 1280×800 and 1024×768, and identical in all sixteen themes. Natural widths total
  222 px plus 20 px of gaps inside a 278 px track: **36 px of slack**.
- So the wheel cannot scroll it because **there is nothing past the edge**. A real OS-level wheel
  event over the row moves `scrollLeft` 0 → 0 for `deltaY` and `deltaX`; a synthetic `WheelEvent`
  comes back `defaultPrevented: false`; `row.scrollBy({left:150})` does nothing;
  `row.scrollLeft = 999` reads back 0. It is not a scroll container.
- What *is* clipped in the owner's screenshot is the **input's own placeholder**, rendered as
  "Name this step, or an existing block to cor…".
- Only cosmetic defect in the row: "Start / end" is 50.4 px of text in a 45.6 px content box, so it
  touches its own border. The other four fit.

## The real gap

The application knows **fourteen** shapes (`NODE_SHAPES`, app.html:32340; display names via
`shapeDisplayName()`, app.html:29325). The canvas offers five. The old side panel has a "More
shapes" control; the canvas popover has no equivalent.

## The trap — this is why the parts must land together

A verifier built the fourteen real chips under **today's** CSS and looked at the result. `.canvas-chip`
is `flex: 1 1 0; min-width: 0`, so the chips *shrink* instead of overflowing — at fourteen they are
**15.2 px wide each**, while the inner `<svg>` is a fixed `width: 20px` (app.html:9729) and does not
shrink. Measured: `clientWidth` 278 vs `scrollWidth` 296. The icons cross each other's borders,
all fourteen labels overprint into an unreadable smear, and the last label spills past the popover's
right edge.

**Shipping the extra shapes alone does not leave the row inert — it wrecks it.**

## What to build

All three, in one patch or a chain that is never half-applied:

1. **The other shapes on the canvas.** Decide, and defend, whether all fourteen belong in the strip
   or whether the strip carries the common ones and a "More…" affordance carries the tail. The
   owner's standing rule is progressive disclosure: uncluttered by default, everything reachable.
2. **A row that can hold them.** `.canvas-chips` gets `overflow-x: auto`; `.canvas-chip` becomes
   content-sized (`flex: 0 0 auto`). Proven in the page: with fourteen chips this gives
   `clientWidth` 278, `scrollWidth` 842, `maxScrollLeft` 564.
3. **The wheel, and a cue that there is more.** The app already does exactly this on the diagram tab
   bar — `deltaY → scrollLeft`, `preventDefault`, `{passive:false}`, at app.html:22584-22589, with
   overflow bookkeeping at 22590. Follow that precedent. Note the popover is a **child of `document.body`**,
   not of `#zoomViewport`, so the canvas Ctrl+wheel zoom (`handlePreviewWheel`, app.html:86253) never
   sees it — verified: Ctrl+wheel over the strip leaves the zoom at 100%.
   A scrollable row with no visible cue is a row people do not know they can scroll. Solve that too.
4. **The placeholder.** Fix the thing that was actually cut off. Either shorten the sentence or let
   the field show it.

Watch: `canvasClosePopover()` sets `pop.innerHTML = ''` (app.html:86943), so a listener bound per
open leaks. Bind once, or clean up.

---

# Job H — clicking a block in the map should take you into that diagram

## Where this is

The **Present overlay's map layer with Build on** — not "All previews", not a separate deck editor.
`#presentOverlay` (20673) → `#mapLayer` (20693), marked `[data-building="on"]` by `mapSetBuild`
(74192). The card with a whole diagram and an "Open" pill is a `.map-tile` from `mapEnsureTile`
(72500). A `.map-card` is a different object — it carries a pencil, never an Open pill.

## What happens today

The tile's click listener, `mapEnsureTile` at **app.html:72540-72569**, branches in this order:

```
72541  if (mapPointerState && mapPointerState.moved) return;         // a drag is not a click
72546  if (event.target.closest('.map-tile-open')) { mapEnterDiagram(diagram.id); return; }
72550  if (mapRecording || mapBuilding) {
72556      if (!id) { if (mapBuilding) mapFrameTile(diagram.id); return; }
72560      mapSelectedNodeIds = [id]; mapSelectedDiagramId = diagram.id;
72563      node.classList.add('is-map-picked');
72564      mapSetHint('Block picked. Press Space to keep this view.');
72565      return;
72566  }
72568  mapEnterDiagram(diagram.id, id);          // Build OFF: this already goes in, at that block
```

So the behaviour the owner wants **already exists on line 72568** — it is simply unreachable while
Build is on.

## Why the pick exists — do not remove it blind

`mapSelectedNodeIds` has exactly two readers. The important one is `mapCaptureView()`
(73588-73593), which is what **Keep this view / Space** does: with a pick you get a
block-framed slide (`{kind:'nodes'}`); without one you get a whole-diagram slide or "The whole map".
The comment at 73584 explains it: at block-aiming zoom the camera is always wider than one tile, so
a grazed neighbour used to turn a deliberately framed block into "The whole map". **The pick is the
disambiguator.** Block-framed slides are a real feature with their own label, camera, spotlight and
exported page.

If a plain click navigates instead, then without a replacement: the only producer of block-framed
slides disappears; "Facts about the blocks in view" degrades from "the block I picked" to "the first
eight nodes of this tile"; the teaching hint becomes a lie; and a mis-aimed click throws the author
out of Build into a walkthrough — recoverable (`mapBuildResume` 74312, `mapReturnFromDiagram` 74338
restore Build, position and hint — measured) but a full re-render and a few seconds.

## What to build

Give the owner what they asked for **and** keep block-framed slides authorable. Choose the design,
state the trade-off, and say what you rejected. Constraints: dragging must still not count as a
click (72541 already handles it); the Open pill must keep working; whatever gesture picks a block
must be discoverable from the hint line, not folklore.

Also answer: what happens on a tile whose diagram is edited only as code — a git graph, a sequence
diagram? 1.65.0 made those clickable in the editor; check whether the map path agrees.

---

# Job I — Docs needs a quick-navigation rail

A long document in Docs has no way to see its own shape or to move inside it.

**What to build:** a thin rail down the edge of the page with **one mark per heading**, indented by
heading level; the mark for the section you are in is lit; hovering shows the headings as text;
clicking jumps there. The diagram side already has a minimap — this is the same idea for writing.

**It does not duplicate `Contents`.** Measured: `#wpContentsButton` ("☰ Contents") is **absent on a
Note** — zero width, zero height — and appears only on an Agent spec, where it opens a transient
dropdown (`.struct-menu is-plain`, 334×253) listing the **template's** fixed sections: "Purpose and
scope · 1 block", "Scope and boundaries · 1 block", and so on. It lists the template, not what the
person wrote, and it disappears on click. The rail is always there, works on every document type, is
built from the user's own headings, and shows position.

Requirements: it must cost nothing when a document has no headings (do not show an empty rail); it
must not fight the block right-click menu or the `/` inserter; it must be keyboard-reachable; and it
must survive the document being edited while it is on screen.

---

# Job J — a setting that quietly needs the internet

The Style card offers "ELK · better on dense diagrams". Choosing it does a dynamic `import()` of
`https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.1.7/…` (app.html:34563 — one occurrence in the
whole file). Measured: three requests, ~502 KB, from a public CDN. Offline, `applyLayoutEngineChoice`
(34571) falls back to dagre and toasts that it needs a connection.

The result is that **the same diagram lays out differently on two machines depending on their
connectivity**, in an application whose whole premise is that it works from a double-click with the
network unplugged.

This job is **the honest small fix**: make the control tell the truth before it is chosen — that this
engine is fetched from the internet, that it will not work offline, and that a diagram laid out with
it will look different on a machine without a connection. Do not bundle ELK; that is a separate
decision the owner has not made yet, and it is being weighed against other options right now.

While you are there: `layout.alignment` (start / centre / end) is stored, shown in the UI and written
into the Excel export, but is **never passed to Mermaid** — it is consumed only by the offline
fallback renderer (88397, 88414). Against dagre it does nothing. Report what you find; do not fix it
without saying what the fix costs.

---

## Not yours this round

The preview toolbar's empty space is mine — my own scout's recommendation was refuted by its verifier
and I am redoing the analysis. Two defects remain mine and unfixed: the canvas removes a note hung
from a deleted host block, and the Docs revision restore returns focus to a hidden button. Do not
spend time on any of them.

## If this is not a full round

Say so and I will send more. There is a queue.
