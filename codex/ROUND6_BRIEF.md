# Round 6 — the honesty pass

Nineteen diagram types were measured by five agents, each re-measured by an adversarial verifier
told to declare its positive control before reporting that anything "does nothing". What came back
is not a list of missing features. It is a list of places where **the application tells the person
something that is not true**. Round 5 took the three that break things. This round takes the rest.

The owner's standing rule is the frame for all of it: *nothing may ever silently lose what someone
wrote, and the app never claims to have done something it did not do.* Most of these are the second
half of that rule.

## How this round runs — three stages, and you are in one of them

This round is deliberately **not** handed to one engineer end to end.

| Stage | Who | Produces | Does NOT |
|---|---|---|---|
| **1. Groundwork** | Codex Spark | a findings document per job: what is true now, where, what should change, how it would be proved | **write no patches, edit no application file** |
| **2. Verification** | a second, independent model | a verdict per claim, measured in the running app | not rewrite the plan, not implement |
| **3. Integration** | the reviewer | patch scripts, applied and verified on the shipped bytes | — |

**If you are reading this as Stage 1, your entire output is a document.** A patch handed back at
Stage 1 will be discarded unread — not because it would be bad, but because the point of splitting
the round is that the plan gets checked by someone who did not write it. Anything you implement
before that check has skipped it.

The reason for the split is specific and recent. In Round 4 an engineer shipped a heading rail that
painted over the document; in Round 5 a chip was un-hidden and its own handler turned out to have
been broken for years, because nobody had ever been able to run it. Both were caught late. A plan
that a second reader has already attacked is cheaper than a patch a second reader has to unpick.

## The base

**`C:\Claude\SIREN\codex\FROZEN_R6_BASE.html`** — 8,528,590 bytes, SHA-256
`DFFFD40E0E5E6BC205B86D779CF6FADAA89426BC04493CB389CD3308CBCF8435`

That is the shipped **v1.67.0**: Round 5's twelve-patch output (`8C31885A…71D28`), four dead-UI fixes, and the version, changelog and deck-tooltip pass. It is byte-identical to the live application. Take every line
number and every anchor from **this** file. Line numbers quoted in the job descriptions below were
read from 1.66.0 and have moved.

## Two jobs in this file are already done

**Jobs U and AD are implemented and verified.** They are marked DONE where they appear. Do not plan
them, do not re-measure them, do not fold them into another job.

**Live jobs this round: V, W, X, Y, Z, AA — six.**

## What Stage 1 must hand back

One document, `ROUND6_GROUNDWORK.md`. For each of the six live jobs, five headings, in this order:

1. **What is true now.** Measured in the running application, not read from the source. State the
   measurement: what you did, what you saw, what number came back. "The counter reads 0" is a
   finding; "the counter appears to be driven by X" is a hypothesis, and belongs under 5.
2. **Where.** File line numbers **from the base named above**, the enclosing function, and the exact
   anchor text a patch would key on — with its occurrence count in the file. An anchor that appears
   twice is not an anchor; say so and find another.
3. **What should change**, in one paragraph of plain language, written as the behaviour a person
   would experience. For the two design jobs (Z and AA) give the option you chose, the options you
   rejected, and why — the choice is the deliverable there, not the code.
4. **How it would be proved fixed.** An assertion specific enough to run: the selector, the action,
   the expected value. Not "verify the counter is correct" but "after loading a mindmap, the row
   count in `#structureCount` equals the number of `.struct-row` elements".
5. **What you could not establish.** Explicitly. An empty section here is itself a claim, and it is
   the one most likely to be wrong.

Rank nothing by effort. Rank by what a person would see and be misled by.

## House rules that apply at every stage

- **Do not modify the application.** Stage 1 and Stage 2 both work on read-only copies.
- **Measurement beats source reading, always.** The source says what was intended; the running app
  says what happens. Where they disagree, the app is right and the finding is the disagreement.
- **Declare your positive control.** Before reporting that a control does nothing, show something
  comparable that does. In Round 5 a probe reported "alignment changes the drawing" and was wrong:
  node ids carry a render timestamp, so every re-render looked different. The control experiment —
  a sibling setting that genuinely moved the nodes — is what caught it.
- **`getBBox()` on an SVG group is in local coordinates.** A node that moved reports an unchanged
  box. Use screen rects. This has produced a false result twice.
- **If the brief is wrong, say so.** The three descriptions below came from a survey, and surveys
  are wrong sometimes. A correction to this document is worth more than a job done as specified.
  Round 5's engineer corrected the reviewer twice and was right both times.

---

# Job U — the honesty machinery is invisible

`#diagramTypeChip` is written on every render with a per-type sentence and tooltip — *"Full visual
editing is available."*, *"The Sequence builder and Mermaid code are available."*, *"This diagram is
code-first and requires the Full Mermaid renderer."* — and it is authored `hidden` with
`aria-hidden="true"` (app.html:18989). **Nothing in the 8.4 MB file ever un-hides it.**
`updateDiagramTypeChip` faithfully maintains text nobody can read.

So the app's clearest statement about what a person can do with the diagram in front of them is
dead markup. What remains visible is the Visual tab's tooltip and a warning banner inside a panel.

Decide: show it, or delete it and move its sentences somewhere a person actually looks. Either is
defensible; carrying a maintained invisible control is not.

> **DONE — SHIPPED. Do not implement this job.** It is live in v1.67.0, the build you are
> measuring. See `tools/patch_dead_ui.py`. Left in this brief only so the
> reasoning survives; if you implement it you will collide with a patch that already exists.

The decision taken was **show it**. `#diagramTypeChip` was re-measured invisible in **77 states** —
all 19 diagram types, 4 editor modes, 11 panels and dialogs, 39 themes, phone and tablet widths
(`qa_exports/run_dead_ui.js`). Un-hiding it then exposed a second defect nobody could have seen
before: its own handler `revealDiagramTypeControls()` ran correctly and achieved nothing, because
`#diagramTypeSelect` sits inside a **collapsed `<details>`** and a control inside a closed
disclosure can be neither scrolled to nor focused — `scrollIntoView` left the select at top=274
before and after, and calling `.focus()` on it directly was a no-op. The patch opens the disclosure
first.

> **Corrected by the Stage 1 groundwork:** an earlier note here said this also took a bite out of
> Job AA. Measured, it does not. Both the classic route and the chip route are **four interactions**
> to create a Gantt. The chip improves the label and the opening route; it does not shorten the
> path. The earlier three-interaction figure stopped before the confirmation dialog, so no Gantt had
> been created when it was counted.

# Job V — every diagram is called "Flowchart Preview"

`#diagramTitlePreview` and `#previewHeading` read **"Flowchart Preview"** on all nineteen types —
over a pie chart, over a gantt, over a C4 context, over a mindmap. Confirmed in screenshots on
several types.

Worse, the Style card's "Diagram title" field is **pre-filled with the literal string** "Flowchart
Preview", so the wrong word is what gets exported unless the person notices and retypes it.

A beginner making a class diagram is looking at the word "Flowchart" the entire time.

# Job W — the app forgets the type you just picked

Pick **Block**, **Architecture**, **C4 context**, **XY chart**, **Requirement**, **Mindmap**,
**Timeline** or **Kanban** from the type picker and press New starter. You get the right starter and
a toast naming your type. One second later:

- the type select flips to **"Advanced / other Mermaid"**;
- **New starter goes disabled**, with the title *"Advanced Mermaid is detected from the source; paste
  its declaration directly."*;
- the hint becomes *"Advanced Mermaid: this is an auto-detected catch-all…"*.

Cause: `detectMermaidDiagramType` has branches for only some types, so the rest fall to the
catch-all. The menu offers types the app cannot name one second later — and a person who wants a
second fishbone finds the button that made the first one now disabled.

Ishikawa has a variant of the same problem in the other direction: it is re-detected as "Flowchart",
so "New starter" retitles itself *"Replace the current source with a Flowchart starter."*

# Job X — the Guided counter is false on 14 of 19 types

`#structureCount` reads "N blocks · M connections" under the Guided editor. Measured against a hand
count, it is **true on three types** (flowchart 6·6, swimlane 5·5, ishikawa 13·8 — and ishikawa's 13
counts four bone containers as blocks), **accidentally right on kanban** (7 items, no connections),
and **false on the rest**: "0 blocks · 0 connections" over a sequence with 2 participants and 2
messages, over a class diagram with 2 classes, over a gantt with 4 tasks, over a git graph with 4
commits and a merge; "1 block · 0 connections" over a mindmap with 10 nodes; "4 blocks" over a
block-beta that declares six; "3 blocks" over an XY chart, which has none.

The counter is a flowchart parser applied to every type. Make it type-aware, or say nothing rather
than say something false. Consider what a mindmap or a gantt should be counted in at all — "blocks
and connections" may be the wrong nouns, not just the wrong numbers.

While you are there, two nearby strings that inherit the same fault:

- the **Guided switch tooltip**: *"The same Mermaid code, with its parts clickable: rename a block,
  swap a shape, change a connector"* — on many types no block, shape or connector chip is ever
  produced;
- the **Guided hint**: *"Click a chip to edit it in place. Drag a line number to reorder; right-click
  a line to add, move or delete it."* — the "add" half is disabled on every non-flowchart type.

# Job Y — the caption that is attached to the wrong control

**"Applies to flowcharts only."** (`#orientationHint`) is printed immediately to the right of the
⌨ Text / ✦ Guided switch on every code-only type, so it reads as a caption for **Guided**.

It is not. Its tooltip gives it away: *"Vertical / horizontal applies to flowcharts…"* — it belongs
to the layout-orientation buttons. Right sentence, wrong place, and the place it landed makes a
working feature look unavailable.

# Job Z — the preview chip is wrong twice and shows once, ever

The chip printed over a code-only diagram reads verbatim:

> **"Drawn from its code · click a part to find its line · right-click for fit, size, export and
> colours"**

- **First half false on nine types.** On XY chart, Pie, Sequence, Architecture, C4, Gantt, Timeline,
  Journey and Git graph a real mouse click can never reach `#diagram` — `beginPan` takes pointer
  capture on `#zoomViewport` and the click retargets. (`beginPan` exempts `#diagram g.node`; those
  SVGs have no `g.node`.) The app instructs the person to do something impossible.
- **Second half false on eighteen of nineteen.** There is no colour row in the code-only right-click
  menu for any type but one; the menu is heading, "Go to … in the code", fit, size, export.
- **And it appears once per browser profile, ever.** `codeOnlyMaybeShowHint()` sets
  `state.codeOnlyHintSeen` and saves it. Proved by re-running with a reused profile: zero hint
  elements. So the app's one instruction for these types is wrong *and* unrepeatable.

Decide what the chip should say per type — including saying nothing — and whether "seen once, ever"
is the right lifetime for the only guidance a type gets.

# Job AA — a beginner cannot find the diagram types

**There is no type menu on "+ Diagram".** `#addDiagramButton` appends a blank flowchart and never
asks. The only place a type is chosen is a `<select id="diagramTypeSelect">` **inside a `<details>`
card whose summary reads "Diagram type, templates & tools" — collapsed by default.**

To make a Gantt, a person must first open a disclosure card called "tools".

This is the single biggest obstacle for the audience the owner named: someone new, or a student, who
wants to make a mindmap. Everything else in this round is about the app telling the truth; this one
is about it being findable at all.

Design it and defend the design. Note that "+ Diagram" adding a blank flowchart immediately is a
reasonable default that some people rely on — do not remove a fast path to add a plain flowchart.

# Job AD — a control nobody can reach, and a setting that goes nowhere

> **DONE — SHIPPED. Do not implement this job.** It is live in v1.67.0, the build you are
> measuring. See `tools/patch_dead_ui.py`. Left here for the reasoning only.
>
> One correction to what this job originally said, found by measurement: `#direction` is **not** a
> removable duplicate. `diagram.direction` is READ out of that invisible select's value. It is a
> state store, not a control, and deleting it breaks flow direction everywhere. The patch leaves it
> in place and writes that warning into the source instead.

Two items from a dead-code audit of the frozen build. Both are the owner's third rule — *no control
that cannot work* — and both are small.

**The Style card's direction control is sealed inside a hidden div.** `#direction` (the "Advanced
direction" select) and `#directionHint` beside it are wired to a real handler and sit inside a
`<div hidden>` that no state opens. Measured at runtime: 0×0, `offsetParent` null.

That makes flow direction the app's most duplicated setting — **three routes to one value**: the
toolbar buttons, `#visualDirection` in the builder panel, and this one. The third is unreachable, so
the redundancy costs nothing today and will cost the next person who edits direction handling a full
afternoon. Delete it, or open the div and justify a third route. Note that Job Y is about a
*different* caption in the same area (`#orientationHint`); read them together so the Style card ends
the round coherent rather than patched twice.

**`layout.alignment` is chosen, stored, exported — and never drawn.** It is parsed from the source,
sanitised, kept on the diagram record, and written into the Excel export. In the `renderDiagram`
path it is never passed to Mermaid's configuration — unlike `density`, which becomes `padding`, and
`routing`, which becomes `curve`. The only consumer is `layoutFallbackNodes()`, the offline fallback
renderer.

So a person can set an alignment, see it persist, see it travel into a spreadsheet they hand to a
client, and it changes nothing about the picture. This is the export-fidelity defect in miniature:
the value is *real* everywhere except where it was promised.

Establish both before fixing anything. The direction pair I have measured myself at 0×0; the
`layout.alignment` path is reported, not reproduced by me, so if the render path does consume it
somewhere I have not looked, say so — that is the more useful answer.

---

## Not in this round

The visual builder panel's future — whether it becomes type-specific, and whether Guided is promoted
to the primary editor for code-only types — is a design decision the owner and I are making. Do not
restructure the panel. Everything above is about what the app *says*, not about what it *is*.

Fixed-block placement and saved Views are both parked.
