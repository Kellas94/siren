# Round 5 — what SIREN should do next

**Scout: ideas5. Read-only. 23 August 2026.**

Measured against **v1.63.5** — a byte-exact copy of the live file
(`C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html`, 8,212,700 bytes) served on
`127.0.0.1:9969` and driven headless through `tools\drive.mjs` on CDP 9879 at 1440×900,
one fresh Chrome profile per run. Eleven runs (A–L). `PAGE EXCEPTION` count: **0 in every
run**. Evidence — steps files, logs, 25 screenshots — in
`C:\Claude\SIREN\pending\ideas5\`. Every number below was read out of the running app;
where I only read the source I say so.

I have read `RESUME_HERE.md`, `audit\COMPETITIVE_INVENTORY.md`, `DECLUTTER_MOVES.md`,
`CANVAS_BUILDER_SPEC.md`, `SECONDARY_SKILLS_AND_OSS.md`, the six critiques,
`pending\ROUND5_LIST.md` and `pending\ROUND4_ADDITIONS.md`. Nothing below re-proposes a
shipped feature, a declined one, or an item already on the round-5 list; where I touch one
of those I cite it instead.

---

# Section A — The newcomer study: can a person build a flowchart with only the canvas?

This is the gate `ROUND5_LIST` item 13 sets on retiring the panel's construction steps:
*"it must not ship before the newcomer study (ideas5) confirms the canvas is discoverable
without the panel."*

**Short answer: yes on capability, no on discovery — and the gap is four small pieces of
copy, not a feature.** A person who knows the canvas exists builds a five-block flowchart in
**7 mouse gestures**, against **35–45** through the panel. A person who does *not* know it
exists is pointed away from it by the naming, by the tour, and by an empty canvas that says
nothing at all. Every one of those is fixable in a day, and none of them is a canvas
feature.

## A.1 — The first sixty seconds, measured

| What happens | Measured |
|---|---|
| Boot | DCL **717 ms**, load **791 ms**, **0** external requests |
| What is on screen | Someone else's diagram: `DEFAULT_SOURCE` is a 7-block, 6-connector Romanian public-finance ownership map — *State → Ministry of Finance → Public Entity → Beneficiaries / Financial statements* |
| The tour | 6 cards defined, **5 shown**. The counter reads **1/6 → 3/6 → 4/6 → 5/6 → 6/6** |
| Left of the screen, read first | A card headed **"Build without code"**, 1,294 px tall, numbered steps ①–⑤ and two lists |
| Right of the screen | A card headed **"Flowchart Preview"** |

Three things a newcomer has to guess in the first minute:

1. **Whether the diagram on screen is theirs.** It is finished-looking, domain-specific and
   is not a process — no start, no end, no decision. A teacher or a project manager reads
   "this app is for state finance". Nothing on screen offers "start your own"; the only
   route is `New blank` inside the panel, which asks *"Start a new visual flowchart? This
   replaces the current Mermaid source with a blank visual canvas."*
2. **Where you build.** The panel says *build*; the canvas says *preview*. The naming sends
   every newcomer to the panel first, and the panel is the slow route.
3. **That the canvas builds at all.** The tour's six cards never say so. Card 4/6, the one
   that points at the canvas, reads in full: *"Zoom, pan, and click any block to style it,
   document it or comment on it."* Three verbs, none of them "add", "connect" or "build".

**The tour is skipping a card.** `TOUR_STEPS[1]` targets
`.layout-switch[aria-label="Choose how to edit the diagram"]`, which is the Text/Guided
switch and does not exist while the app is in Visual mode — the mode it boots in.
`showTourStep` recurses past a missing target but keeps numbering off the full array, so
the newcomer's first impression of the product is a counter that jumps from 1 to 3.
*(SOURCE: line ~22003; measured live in run 2.)*

## A.2 — The canvas-only build, action by action

Task: *Receive invoice → Check the PO → Approved? → (Yes) Pay the invoice / (No) Send back to buyer.*
Five blocks, four connectors, one decision, two branch labels. Started from `+ Diagram`,
which seeds `flowchart TD  A[Start] --> B[Next step]`.

| # | Gesture | Result |
|---|---|---|
| 1 | click `+ Diagram` | starter pair appears |
| 2 | double-click *Start*, type 15 chars, Enter | in-place editor, 140 px wide, prefilled and selected |
| 3 | double-click *Next step*, type 12 chars, Enter | — |
| 4 | hover *Check the PO*, press the ↓ handle, type `Approved?`, Enter | **shape flipped to Decision by itself** on the `?` |
| 5 | hover *Approved?*, press the ↓ handle, type `Pay the invoice`, Enter | **branch field pre-filled `Yes`** |
| 6 | hover *Approved?*, press the → handle, type `Send back to buyer`, Enter | **branch field pre-filled `No`** |

**7 mouse gestures (9 physical clicks), 69 characters, 5 × Enter.** Zero dead ends, zero
toasts, zero exceptions. The source that came out:

```
flowchart TD
    A[Receive invoice] --> B[Check the PO]
    B --> N1{Approved?}
    N1 -->|Yes| N2[Pay the invoice]
    N1 -->|No| N3[Send back to buyer]
```

That is source a person can read. The popover's hints were correct at every step
(*"Follows Check the PO."*, *"Follows Approved?, kept to the right where the layout allows
it."*).

**The same task through the panel, measured in run C:**

| Step | Actions |
|---|---|
| `Add a block` × 5 (click the label field, type, click `＋ Add Process block`) | 10 |
| Open the collapsed `Add a connector` section | 1 |
| `Add a connector` × 4 (From select ×2, To select ×2, label field, Add) | 24 |
| **Subtotal** | **35** |
| Deleting the two orphaned starter blocks the panel leaves behind (`Edit a block` → select → Delete → confirm, twice) | 10 |
| **Total** | **45** |

The panel produced this:

```
flowchart TD
    A[Start] --> B[Next step]
    N1 --> N2
    N2 --> N3
    N3 -->|Yes| N4
    N3 -->|No| N5
    N1[Receive invoice]
    ...
```

Connectors above declarations, the starter pair still floating. The panel also never
offered a decision shape and never pre-filled a branch word — both of which the canvas did
for free.

**5× fewer actions, and a better file.** That settles the capability half of the gate.

## A.3 — How the handles are found

Three affordances, in the order a newcomer meets them:

1. **Hover.** Moving the pointer onto any block paints a ring of four 22 px discs, one per
   side, ~44 px out from the box edge, each with a `<title>` ("Add the next step", "Insert
   a step before…"). Verified live: `pointermove` on a block's shape → `handles=4`.
   *This is the affordance that works, and it is the one nothing tells you about.* It is
   O(1) at any diagram size — on the 40-block chart at fit width, all four handles measured
   `insidePane=true`.
2. **Click.** Selects the block, paints the ring, and fires a one-time chip for 9 seconds:
   *"Drag a handle to add a step · type "Note: …" for a note · drag a block onto a connector
   to move it · Delete removes and reconnects."* It is the clearest teaching in the product
   and it is shown **once, ever** (`state.canvasHintSeen`), with no way back to it.
3. **Right-click a block** → 6 rows: *Rename block… / Add a step after X / Insert a step
   before X / Connect from here / Add comment… / Delete block.*
   *(This confirms `ROUND5_LIST` item 1 is already fixed in 1.63.5 — the two adding verbs
   are on the block's own menu, and the empty-canvas menu carries only `New block…`,
   `Fit to page`, `Actual size (100%)`, `Export PNG`.)*

**The click gesture is doing two jobs at once.** One click on a block paints the ring **and**
opens the **Block Inspector** — a 330 × 580 px floating form with 14 controls (fill, border,
text colour with hex fields, a 14-item shape select, font family/size/weight, audit
metadata, link, icon, Reset block, Done). On the 2-block diagram in run B it covered the
right-hand half of the canvas and the block's own right-hand handle sat under its left edge.
Same on the 5-block diagram in run E. The canvas spec's own rule — *"one ring at a time…
a resting UI that is not loud"* — is undone by the gesture that reveals the ring.

## A.4 — Where a newcomer gets stuck, ranked by how badly

**1. The empty canvas says nothing.** `New blank` (or deleting everything) leaves
900 × 640 px of black under a heading reading "Flowchart Preview". No hint, no
"right-click here", no first-block affordance. Meanwhile the panel says
*"Synchronized with Mermaid code. Add your first block to begin."* and
*"No blocks yet. Add the first block above."* — **both inside the card that is being
retired.** Compare the Docs empty state, which is excellent: *"Write the document next to
its diagram — A document is a written page — headings, text, tables, checklists, evidence…
＋ Create the first document."* The canvas, the surface that is meant to replace the panel,
is the only major surface in the app with no empty state at all.

**2. On a code-only source the canvas goes silent.** Seeded
`flowchart TD / A[Start] --> B[Review] / B --> C[Approve] / style A fill:#f00`:

- the panel disables `Add a block` and `Add a connector` and explains, in 232 characters:
  *"Advanced Mermaid mode: Advanced styling or interactions require code mode (line 4). The
  Mermaid code and preview were left unchanged. Use Mermaid source for this diagram, or
  choose New blank to start a visual flowchart."*
- the canvas paints **no ring, and no message** — `handles=0`, and no line anywhere on the
  drawing.

`CANVAS_CODE_ONLY` exists as a string (*"This diagram uses features the canvas can't edit
safely. Use the panel or the source."*) but only fires as a toast when you press a key on a
selected block. The spec asked for *"a single quiet line where the ring would be"* and it
was never built. Today the panel's status bar is the **only** explanation a person gets.
**If the construction steps go and this line is not built first, a styled diagram becomes a
completely mute surface.**

*(The good news, verified: a plain chain — `A[Start] --> B[Review] --> C[Approve]` — is now
fully live on both routes. The `COMPETITIVE_INVENTORY` §1.3 "the demo fails in the first
minute" defect is fixed.)*

**3. The naming points the wrong way.** "Build without code" on the left, "Flowchart
Preview" on the right. A newcomer reads left to right and works in the slow half.

**4. The tour teaches the old paradigm.** Six cards, five shown, and not one names a canvas
gesture.

**5. Nothing survives the 9-second chip.** After it goes, the four gestures it names exist
only in the Quick guide's "Canvas keys" row, behind the header ⋯ → Guide.

## A.5 — What the panel genuinely does that the canvas cannot

`CANVAS_BUILDER_SPEC` §6 and `ROUND5_LIST` item 13 both list seven jobs as panel-only.
**Measured against 1.63.5, four of the seven are already on the canvas.** Correcting this
list matters, because it decides how much of the panel actually has to stay.

### Already on the canvas — the spec's list is out of date

| Claimed panel-only | Where it actually lives on the canvas |
|---|---|
| **Connector type** | **One click on a connector opens the CONNECTOR INSPECTOR** (340 × 523): *Label*, *Arrow type* with all five options (Arrow / Dotted arrow / Strong arrow / Line without arrow / Dotted line (note)), line colour, line width, waypoints, comments, Delete. The panel's `#visualEdgeType` is a duplicate. |
| **Fields with more than two inputs** (metadata, links, icons, styling) | All of it is in the Block Inspector, one click on a block. |
| **Grouping non-neighbouring blocks** | Ctrl+click any two blocks (they need not be adjacent) → right-click → **"Group these 2 blocks… / Apply the current style to these 2 / Save as reusable subflow…"**. The ring correctly disappears at 2+ selected. Right-clicking an existing group gives **"Rename group… / Ungroup"**. The panel's `#visualGroupMembers` is a 4-row porthole; the canvas route is better. |
| **Long labels** | The in-place editor is narrow (measured 140–151 px), but the Block Inspector's *Block text* field is ~300 px and is one click away. |

### Genuinely still panel-only — measured

1. **Flow direction (TD / BT / LR / RL).** `#visualDirection` in the panel's ⑤ Layout step
   and `#direction` in the Style card. **Nothing on any canvas menu changes it.** This is
   the one construction step in the panel with no canvas equivalent at all.
2. **Inserting a saved reusable subflow.** *Saving* one is on the canvas multi-select menu;
   `#insertSubflowButton` is panel-only.
3. **Shapes beyond the popover's chips, at the moment of creation.** The popover offers
   4 shapes (+ note): Process, Decision, Start/end, Database. The panel offers **14**. The
   other ten need a second trip through the Block Inspector — create, then click, then pick.
4. **Bulk edits beyond "apply this style to N".** No bulk rename, reshape or delete on
   either surface. The spec conceded this to the panel; the panel does not have it either.
5. **Reading and navigating by name.** On the 40-block chart the panel's Blocks list is the
   only place all 40 names are visible at once. But see the defect in A.6/#5 — clicking a
   row does not move the preview, so it is a list, not yet a navigator.
6. **Explaining a code-only source.** Covered above.

## A.6 — What must exist before the construction steps are removed

Six items. All are small; four are copy.

1. **A canvas empty state.** One line where the diagram would be:
   *"Nothing here yet. Right-click the page to add the first block."* Same treatment as the
   guided editor's `＋ Add the first block` (1.63.1) — that precedent is exactly the shape of
   this fix.
2. **The quiet code-only line** the spec asked for, in the same slot, wording already
   written: *"This diagram uses features the canvas can't edit safely. Use the panel or the
   source."*
3. **Flow direction on the canvas** — the empty-canvas right-click menu is the natural home
   (it already carries diagram-scope rows: Fit to page, Actual size, Export PNG).
4. **One tour card that names the canvas gesture**, replacing or joining card 4/6. It also
   fixes the skipped-step counter for free if the steps are renumbered.
5. **Blocks-list rows must scroll the preview.** Measured on the 40-block chart: clicking
   the *Step 30* row left `zoomViewport.scrollTop = 0` with the block at y = 4,491 — off
   screen. Item 13 makes this list the panel's whole reason to exist; a list view whose rows
   do not navigate is not a list view.
6. **Fix `appendVisualEmpty(el.visualEdgeList, 'No connectors yet. Choose two blocks
   above.')`** — that sentence points at the `Add a connector` step item 13 deletes.

**Not required, but I would do it in the same pass:** decide where the two inspectors live.
They are already the panel that item 13 is trying to build — they carry shape, colour, font,
metadata, links, icons, arrow type, line colour, waypoints and comments — and today they
float over the diagram they edit. Docking them into the left column, in the space the
construction steps vacate, gives the panel a coherent new identity (*"what is selected"*)
and gives the canvas its diagram back.

## A.7 — Verdict on the gate

**The canvas is capable enough to build without the panel: confirmed, 7 gestures against
35–45.** It is not yet *discoverable* without the panel, and the reason is that every
sentence teaching a newcomer what to do is currently printed inside the card being removed.
Ship the six items in A.6 first — they are one day of work and each is independently good —
and the gate is met.

**What would be lost if the construction steps disappeared today, honestly:**
flow direction (no other route on the canvas); subflow insertion; ten shapes at creation
time; the only sentence explaining a code-only diagram; the only sentence telling a new
person what to do on an empty page; and the numbered ①–⑤ scaffold that `critique_plan` put
on the do-not-touch list as *"the clearest teaching device in the editor pane."* That last
one is real and I would not dismiss it — but its job is teaching, not building, and a
canvas empty state plus one tour card does the same job in the place the person is looking.

**Size of the prize, measured:** removing ① Add a block, ② Edit a block and ③ Add a
connector takes the panel from **1,294 → 930 px at rest** and **1,978 → 1,019 px with
everything open**, and from **44 → 25 visible controls**. Keeping ④ Group blocks as item 13
specifies, that is the whole saving.

---

# Section B — Everything else, ranked

## Small — do it now

### S1. The welcome tour skips a card and says so out loud
**Costs today:** the newcomer's first interaction with the product is a counter reading
1/6 then 3/6. Measured in run 2: `TOUR_STEPS[1]` targets the Text/Guided switch, which is
not rendered in Visual mode — the boot mode. Five cards shown of six.
**After:** 1/5 … 5/5.
**Smallest honest fix:** resolve `TOUR_STEPS` to the steps whose targets exist once at
`startWelcomeTour`, then number and count off that resolved list. `showTourStep`'s recursion
stays exactly as it is.
**Risk:** none. Does not remove or reorder the tour, which is on the do-not-touch list.

### S2. The empty canvas has no empty state
**Costs today:** 900 × 640 px of nothing after `New blank`. Every instruction lives in the
panel.
**After:** one line, one right-click, first block placed.
**Smallest:** a `.canvas-empty` line in the `#diagram` slot, painted when
`parseVisualFlowchartSource` sees zero nodes and the source is compatible. Reuse the guided
editor's `＋ Add the first block` treatment verbatim.
**Risk:** must not appear in exports or thumbnails — the same rule the handle layer already
follows (`canvasOverlayFreeMarkup`).

### S3. The canvas is silent on code-only sources
**Costs today:** hovering does nothing, clicking does nothing, and nothing says why. The
string is already written and only ever reaches a toast.
**After:** the person reads one sentence and knows to use the source.
**Smallest:** same slot as S2, painted when `canvasModel()` returns null and the source is
non-empty. `CANVAS_CODE_ONLY` is the text.
**Risk:** none; it is the spec's own requirement, unbuilt.

### S4. The zoom chip promises something it does not do
**Costs today:** on the 40-block chart, clicking the chip changes nothing — no zoom change,
no toast, no feedback — because `fitStructuralPreview()` is `fitToWidth(100)`, correct and
deliberate per the comment in the source. But the chip's `title` says *"Fit the whole
diagram in the pane"*, tour card 3/6 says *"This chip fits the whole diagram in the pane"*,
and only the `aria-label` is right: *"Fit the diagram to the pane width."*
**After:** the copy tells the truth; two words in two places.
**Smallest:** change the `title` and the tour text to "Fit the diagram to the pane width".
Optionally disable the chip when the diagram is already at fitted width, so the dead click
is visibly dead.
**Risk:** none.

### S5. Blocks-list rows do not move the preview
**Costs today:** measured — clicking *Step 30 of the purchase to pay cycle* on a 40-block
chart leaves the viewport at scrollTop 0 with the block 4,491 px down. On a big diagram the
list is the only place you can read all the names, and it is a dead end.
**After:** one click to reach any block by name.
**Smallest:** in the node-row click handler, after selecting, scroll the matching
`g.node` into the centre of `#zoomViewport`.
**Risk:** must not fight `beginPan` or the ring repaint; scroll the viewport, do not change
zoom.

### S6. Present opens with the authoring studio in front of the audience
**Costs today:** the first press of Present gives **43 visible controls**, a 330 px sidebar
over a quarter of the stage showing *Default seconds, Tool colour, Live tool, Loop the deck,
± Camera, Clear drawings, Snapshot PNG, ● Record, Export notes*.
`#presentSidebarToggle` is hard-coded `aria-pressed="true"` in the markup.
**After:** Present opens clean; `☰ Studio` is a button you press when you want it.
**Smallest:** default the toggle to `false` and start the rail collapsed; persist whatever
the person last chose.
**Risk:** low. `critique_present` already asked for the sidebar to be re-ordered — this is
the cheaper half of that and does not touch `#presentToolSelect`, which is on the
do-not-move list.

### S7. The inspectors name things by their Mermaid ids
**Costs today:** the Block Inspector heading reads **"Block A"** above a field containing
"Receive invoice"; the Connector Inspector heading reads **"A → B"**; `buildEdgeContextMenu`
builds the same heading. Code-first identifiers in the mode whose promise is *build without
code* — the same defect the connector list already had and had fixed (the row now reads
*"Receive invoice → Check the PO"* with the code as the small line beneath).
**After:** the heading names what the person can see.
**Smallest:** apply the connector-list pattern — human label first, `A --> B` as the small
second line — in `openNodeInspector`, `openEdgeInspector` and `buildEdgeContextMenu`.
**Risk:** none.

### S8. The first diagram every newcomer meets is a public-finance ownership map
**Costs today:** `DEFAULT_SOURCE` is 7 blocks of *State / Ministry of Finance / Public
Entity / Line Ministry / Banks / Beneficiaries / Financial statements*. Against a stated
general audience — teachers, engineers, project managers — it reads as "this is for
government finance". It is also not a process (no start, no end, no decision), so it teaches
none of the shapes.
**After:** the first diagram teaches the vocabulary and belongs to nobody's industry.
**Smallest:** point `DEFAULT_SOURCE` at the `templates.generic` string that is **already in
the file**: `A((Start)) --> B[Step 1] --> C{Decision?} -->|Yes| D / |No| E --> F((Finish))`.
Six blocks, three shapes, a decision and two branch labels — exactly what the canvas
gestures produce.
**Risk:** none technically. It is a taste call, so it is the owner's — but it costs one
constant.

### S9. "Build without code" is now the wrong sign over the wrong door
**Costs today:** the phrase is the largest heading in the left column, and the thing it
describes is the slow route. The canvas builds without code, five times faster, and is
labelled "Flowchart Preview".
**After:** the names match what the two halves are for.
**Smallest:** this is one line of copy but it should land *with* the item-13 design pass,
not before it — the new name depends on what the panel becomes. If the inspectors dock
there, "Selected block" / "Selected connector" writes itself.
**Risk:** renaming before deciding is worse than not renaming.

## Worth a round

### W1. Split the click gesture on a block
**Costs today:** one click paints a 4-handle ring *and* opens a 330 × 580 px, 14-control
form over the middle of the canvas, with one of the ring's own handles underneath it.
Measured on both a 2-block and a 5-block diagram at 1440×900. The person who clicked to
select gets a form; the person who clicked to style gets a ring they did not ask for.
**After:** click = select (ring only, quiet). The inspector opens deliberately — from the
block's right-click menu ("Style this block…"), or from the ⌘/Ctrl+click the multi-select
already owns, or by docking it in the left column.
**Smallest honest version:** keep the inspector, move its trigger to the right-click menu
and to a `Style` row, and leave plain click to the canvas. One row added to
`buildNodeContextMenu`, one call site changed.
**Risk:** real — the tour's card 4/6 currently teaches "click any block to style it", and
some people will have learned it. That card needs rewriting anyway (see W3), and the
inspector keeps a visible route. Do not ship this without the menu row.

### W2. Flow direction on the canvas
**Costs today:** the only two routes (`#visualDirection`, `#direction`) both live in
collapsibles, and one of them is a duplicate `critique_editor` already asked to delete.
After item 13 the panel's Layout step is the only construction step with no canvas
equivalent — so either it survives the cut alone, awkwardly, or the canvas grows the row.
**After:** one right-click on the page, one pick.
**Smallest:** a `Flow direction ▸` row on the empty-canvas context menu (which already
carries diagram-scope rows) using `openStructureMenu` verbatim, writing the same first line
`applyVisualModel` already writes.
**Risk:** low. It changes line 1 of the source, which the surgical writer handles.

### W3. Teach the canvas in the tour
**Costs today:** the six cards never mention the handles, the popover, `Ctrl+Enter`, the
right-click menu or `Delete`-and-heal. The one place they are named is a chip shown once for
nine seconds.
**After:** the fastest route in the product is the one the tour points at.
**Smallest:** rewrite card 4/6 to name the gesture — *"Hover any block and four handles
appear. Drag one to add the next step; ⌘/Ctrl+Enter does the same from the keyboard."* —
and let the S1 renumbering absorb the skipped card.
**Risk:** the tour is on the do-not-touch list. Rewriting one card's copy is not removing
the tour, but say so explicitly to the owner before doing it.

### W4. Reaching a block by name on a big diagram
**Costs today:** 40 blocks render at 100% into a 932 × 656 pane — **8.62× overflow, 4 of 40
blocks visible, 5,157 px of scrolling.** The routes out are: scroll; the minimap (a 35 × 220
px strip of 40 unlabelled hairlines, which is a scrollbar with ambitions); `Fit page`, two
clicks deep in the zoom popover, which would put the text at ~11%; or the Blocks list, which
does not navigate (S5).
**After:** type three letters, land on the block.
**Smallest:** S5 first. Then wire the existing `#workspaceSearchButton`/palette machinery to
a block-scoped filter over the Blocks list. No new component — `#findDiagramButton` is
already the pattern and is on the do-not-move list precisely because it is that door.
**Risk:** medium — it is the first genuinely new navigation surface, and
`CANVAS_BUILDER_SPEC` §10 already warned that keyboard navigation gets *worse* relative to
clicking as the graph grows. This is the answer to that warning, not a contradiction of it.

### W5. The other ten shapes at the moment of creation
**Costs today:** the popover offers 4 shapes + note; the panel offers 14. Reaching e.g.
*Input / output* on the canvas costs create → click → open the inspector → pick — 3 extra
actions and a form over the diagram.
**After:** one extra click inside the popover.
**Smallest:** a sixth chip, `More ▾`, opening the same 14-shape `openStructureMenu` the
inspector's select already backs. `renderRecentShapes()` exists and is on the do-not-touch
list — feed it, do not replace it.
**Risk:** low, but it grows the popover, and the popover is the thing `ROUND5_LIST` item 3
already says is unreadable on Cupertino Glass. Sequence after that fix.

### W6. Make the one-time hint recoverable
**Costs today:** the four canvas gestures are named once, for nine seconds, and then only
in the Quick guide behind the header ⋯.
**After:** a person who missed it can get it back.
**Smallest:** keep the chip one-time, but add the same sentence as a `title` on the ring
group, or a `?` row on the block's right-click menu that re-shows it. Do not make it
permanent — a permanent chip over the canvas is exactly the loud resting UI the design
direction refuses.
**Risk:** low.

## Big — needs the owner's word

### B1. The panel-to-list-view conversion (`ROUND5_LIST` item 13)
This report is the gate. Section A.6 is the gate list. The measured saving is
**1,294 → 930 px at rest, 44 → 25 controls**. My recommendation: do A.6 as one small
patch first, let it sit for a day of real use, then cut.

### B2. Decide what the left column *is* afterwards
The strongest available answer, and it needs no new component: **dock the Block Inspector
and the Connector Inspector there.** They already hold everything item 13 wants the panel to
keep — shape (14), arrow type (5), colour, width, font, metadata, links, icons, waypoints,
comments — plus the Blocks and Connectors lists directly above them. That turns three
overlapping surfaces (panel, block inspector, connector inspector) into one, stops the
inspectors covering the diagram they edit, and gives the column a name a person can read:
*what is selected*. This is a design decision, not a patch.

### B3. Keeping the diagram fitted
`fitToWidth(100)` on render is the owner's documented default and is right for a tall
flowchart. But the person who has zoomed to read something, then adds a block, gets a
re-fit; the person who wants the whole picture has to go two clicks deep for `Fit page`
every time. `critique_preview` asked for a re-fit on content change gated on an explicit
zoom flag; the honest version of the same idea is a sticky choice: whatever you last picked
in the zoom popover is what a re-render gives you. Owner's call because it changes a
documented default.

### B4. First run, once sign-in exists
Three separable questions the owner should answer together, since the sign-in is coming and
`ROUND4_ADDITIONS` already lists first-run and the brand intro as things to collect:
does a brand-new account land on **no diagram** (with the S2 empty state doing the
teaching), on a **neutral starter** (S8), or on **a chooser**? My preference is the neutral
starter, because the tour needs something on screen to point at, and because an empty
first screen is the scariest of the three — but this is the owner's product decision and
it is cheap either way.

---

# Things that are simply broken

Everything here was reproduced in a fresh profile at 1440×900 on 1.63.5.

1. **The tour skips step 2 and mis-numbers the rest** (1/6 → 3/6). Run 2. — S1
2. **The zoom chip's tooltip and tour card 3/6 both promise "the whole diagram"; the code
   fits width, capped at 100%.** On a tall diagram the click has no effect and no feedback.
   Runs E and F, `title` read from the DOM in run L. — S4
3. **Clicking a Blocks-list row does not move the preview.** Run G: `scrollTop` 0, target at
   y = 4,491. — S5
4. **The canvas says nothing on a code-only source** — `handles=0`, no line, no toast until
   a key is pressed. The spec's quiet line was never built. Run D. — S3
5. **The empty canvas has no empty state.** Run L. — S2
6. **Both inspectors open over the object they edit**, and the Block Inspector puts one of
   the block's four handles under its own edge. Runs B, E, K. — W1
7. **`'No connectors yet. Choose two blocks above.'`** points at the panel step item 13
   deletes. (SOURCE: `appendVisualEmpty` call site.)
8. **Inspector and edge-menu headings use Mermaid ids** ("Block A", "A → B") in the visual
   mode. — S7
9. **Boot is 717 ms DCL / 791 ms load** on a local HTTP serve with a cold profile, against
   the 283 ms recorded before Mermaid was embedded and the 344 ms recorded at 1.51.0. The
   file is now 8,212,700 bytes. Not a bug — a consequence of a decision the owner made
   deliberately — but it is the number a first-time visitor feels, and it is worth knowing
   it has roughly doubled again since 1.51.0.

**Verified working, so nobody re-opens them:** the `A --> B --> C` chain no longer disables
the builder (`COMPETITIVE_INVENTORY` §1.3 is fixed); the minimap does appear and track on an
overflowing diagram; multi-select, group, ungroup and save-as-subflow all work from the
canvas; the connector list leads with the human route; `ROUND5_LIST` item 1 (the adding
verbs on the block's own menu) is already fixed; `ROUND5_LIST` item 6 is safe to act on —
*Connect from here* is on the block menu, as it assumed.

---

# What I could not settle

- **Touch.** I drove a mouse. `AGENT_CONVENTIONS` and the owner's rule both say tablet =
  reading, and canvas touch drag was deliberately not built, so I did not test it — but if
  the panel's construction steps go, the tablet loses its only building route. Worth one
  sentence from the owner: is "tablet = reading" still true *after* the panel is a list?
- **A real 40-node restructure.** `CANVAS_BUILDER_SPEC` §10 asked for insert-four /
  relabel-six / move-one-branch on a real audit diagram, and `RESUME_HERE` says the
  benchmark ran at 1.61.1. I measured the ring's *reachability* at that size (fine at fit
  width) but not the restructure itself.
- **Whether a newcomer actually hovers a block.** I proved the ring appears on hover; I
  cannot prove an unprompted person's pointer goes there. That is the one thing only a real
  person in front of the app can settle, and it is the reason S2, S3 and W3 matter more than
  any of the capability work.
- **Frequencies.** Same gap `DECLUTTER_MOVES` §7 names: every ranking here is reasoned from
  measured cost per action, not from observed use.
