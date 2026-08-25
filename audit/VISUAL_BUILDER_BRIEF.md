# The Visual Builder tells the truth — a brief

**Status: the long-run plan.** The short-run decision (what the mode switch becomes in the next
release) is separate and is being taken by the owner and reviewer. This brief is for the direction
after that.

---

## The problem, in the owner's words

> "Sunt în continuare grafice randate care nu sunt clickable sau editabile. Având opțiunea de Visual
> Builder e ca un broken promise, pentru că nu poți să build visually. În acest moment minte
> utilizatorul."

He is right, and the diagnosis is sharper than it first sounds. "Visual Builder" is not merely a
generous name. It is a **mode**, sitting at the same rank as Code, and a mode implies a choice
between two ways of working on the same thing. When the second way does not apply to most diagram
types, the defect is not an incomplete feature — it is **a hierarchy that lies**.

## What is already measured — start from these, do not re-derive them

These come from a survey of all nineteen types by five agents, each re-measured by an adversarial
verifier, plus direct measurement by the reviewer. Treat them as the starting point and **verify
each one anyway** — two of them have already been corrected once.

- The builder panel is **fully live on four types**: flowchart, graph, swimlane, ishikawa.
- **Sequence** has a separate builder of its own.
- The remaining **thirteen get a panel that renders and cannot act**.
- On **nine types a real mouse click can never reach the diagram**: XY chart, Pie, Sequence,
  Architecture, C4, Gantt, Timeline, Journey, Git graph. `beginPan` takes pointer capture on
  `#zoomViewport` and the click retargets; it exempts `#diagram g.node`, and those SVGs have no
  `g.node`.
- **Guided renders rows on every type**, but its counter is false on fourteen of nineteen and its
  hint text promises chips that are never produced.
- **`#diagramTypeChip` now ships visible** and carries a per-type capability sentence. Whatever this
  work concludes, that chip is where the app already says what a type supports.

**Note the owner's list of "not editable" says Git, Kanban, C4 and Architecture. Kanban is doubtful:**
it is not among the nine where a click cannot land, and Guided demonstrably edits it — a Guided chip
corrupting a kanban was a whole job in Round 5. Check it rather than inheriting it.

## Calibration — do this first, it takes ten minutes

Two answers are known. Reproduce them before anything else:

1. **Flowchart is fully editable.** Blocks can be created, selected, renamed and connected from the
   panel and from the canvas.
2. **C4 is preview-only.** The panel renders and a click on the drawing cannot reach it.

If your capability matrix disagrees with either, say so loudly with your evidence — you may be right
and both would be worth knowing. If it agrees but with no measurement behind it, the rest of the
matrix will be read as unmeasured.

---

## 1. The capability matrix

Classify every one of the nineteen types:

- **Fully visual-editable** — nodes and connections can be created, selected and modified visually
- **Partially** — only some elements or operations work; say exactly which
- **Preview-only** — renders, cannot be edited visually

For each type record, measured and not assumed: can a click reach an element; does the panel produce
a real edit; does Guided render rows and are they accurate; what happens today when someone tries.

## 2. The immediate correction to the promise

For types that are not visually editable: do not present the builder as though it works, do not
allow interactions that produce no change, show the state plainly, say why, and offer the route
forward where one exists.

Evaluate renaming the function. Candidates: *Flowchart Builder*, *Structured Diagram Builder*,
*Visual Builder — supported diagrams only*. **None of these is obviously right**: the panel works on
flowchart, graph, swimlane and ishikawa, which are all block-and-connector diagrams, so
"Flowchart Builder" understates it and "Visual Builder" overstates it. Recommend the name that
describes the real capability, and say what you rejected.

## 3. The three options

**A — Honest limitation.** The builder is offered only where it works.
**B — Integrate diagrams.net / draw.io** as the engine for free-form editing.
**C — A native SIREN visual model** — its own scene model, data format and interactions.

For each: user value, implementation effort, technical risk, regression risk, limitations,
compatibility with existing files, portability impact, long-term control.

### The cost that decides B and C — measured, and it is NOT the exports

An earlier version of this brief said the export path was very likely the largest cost in options B
and C. **That was measured and it is wrong**, so do not inherit it.

`collectDrawingFromSvg` is **108 lines** and it returns a normalised model, `{ shapes, unit }`. The
PDF, PowerPoint and Excel writers consume that model - `drawing.shapes` is referenced eleven times,
`drawing.crop` four - and never touch the SVG. So a second canvas needs **a second collector emitting
the same shape**, roughly a day of work, and every writer downstream is unchanged.

**The real cost is that everything in SIREN identifies a thing by its position in the source text.**
Version history diffs text; a native canvas has no text to diff and needs a JSON diff. Docs links
point at a step in the source; a canvas node has no line. Audit metadata hangs off nodes named in
the code. And the surgical editor - one line changed, byte-exact, Undo restoring precisely - is the
differentiator, and it does not apply to a native canvas at all.

Cost those five, not the exports.

### What is LOST by detaching, not only what is gained

SIREN's real asset is not the renderer — anyone can have Mermaid. It is the **surgical editor**:
byte-exact one-line edits, Undo that restores exactly, a builder that edits your lines instead of
rewriting your file. A detached visual canvas loses all of it, and with it the diffable, mergeable,
versionable source that makes this tool different from draw.io. **The ADR must weigh that loss.** An
option that wins on capability and loses the differentiator is not obviously the right answer.

### For B specifically

Licence and attribution; fully offline use; compatibility with a single-file HTML architecture;
file-size impact; CSP compatibility (the policy is default-deny and, after the pending ELK change,
permits no external host at all); runtime external requests; performance on large diagrams;
keyboard and accessibility; IndexedDB persistence; Undo/Redo integration; version history and
review; project import and export; the five export formats; audit metadata and documentation links.

## 4. The native model, if it is recommended

Not "latitude and longitude" — an explicit canvas geometry.

Per element: stable id, type, label, semantic role, metadata, documentation links, comments, review
status; x, y, width, height, rotation, origin, z-order, parent container, layer membership; shape,
fill, border, border width, font, text size, alignment, icon, opacity, shadow. Per connector: source
and target ids and anchors, type, direction, waypoints, routing, label, style, semantic relationship.
Structure: groups, subgraphs, containers, swimlanes, layers, locked elements, reusable components,
collapsed state.

**One correction to the coordinate model, and it is measured.** Absolute `x`/`y` is right for a
**native** canvas, where nothing else decides layout. It is wrong for a **code-linked** diagram:
a prototype (`prototypes/placement_bench.html`) showed that **relative offsets survive a later edit
and absolute points do not** — the layout engine moves everything and an absolute pin lands in the
wrong place.

**SIREN already ships this pattern and it is the closest thing to a working precedent:**
`edgeRoutes` stores relative `{rx, ry}` waypoints per connector, applied post-render by
`absoluteWaypoint()`. It is renamed when a node is renamed and cleaned up when an edge is deleted —
it has already been through the hard cases. **Read it before designing anything.** The open question
is whether the same pattern extends from connectors to nodes.

Every visual change must serialise: move, resize, rotate, reshape, restyle, connector add or change,
routing change, group, ungroup, layer change, order change, metadata. The model must be saveable,
importable, exportable, comparable, versionable, validatable, migratable, and usable for Undo/Redo
and for generating exports. Choose and document a format — structured JSON, a SIREN DSL, or a
combination — and version it. No implicit format hidden in code.

## 5. Two modes, named on screen

**Code-linked** — the code is the truth; visual edits are limited to what can be written back.
**Native visual** — the visual model is the truth; code can be imported as a starting point.

The interface must always show which: *Linked to Mermaid source*, *Native visual canvas*, or
*Imported snapshot — source detached*. Nobody should have to guess what controls the diagram.

## 6. Conversion

Offer **Convert to Visual Canvas** explicitly. Voluntary, explicit, non-destructive. Warn before,
in plain words: the conversion makes an independent copy; after it, canvas edits will not update the
original code; the source is kept as a snapshot and the two can diverge.

Do not use the word "sync" unless two-way synchronisation can be demonstrated.

Conversion keeps the original, creates a new document, never overwrites the source, preserves text,
relationships, groups and metadata as far as possible, and **produces a report**: what converted
fully, what was simplified, what was omitted, what semantics of the source format were lost, and how
to get back. Do not claim round-trip fidelity that cannot be shown.

## 7. Not acceptable

Nodes that look clickable and do nothing. Fake editing that only mutates the rendered SVG. Changes
that vanish on the next render. Conversion that overwrites the original. Two-way sync claimed and
unverified. Silent loss of elements. Approximation with no report. Exports that drop positions or
metadata. A shallow wrapper around draw.io. And the word "Visual Builder" over a type that is
code-only.

## 8. Deliverables — in two passes, not one

Twelve deliverables in one pass buys breadth without depth. Split it:

**Pass one, and stop there:**
1. The capability matrix for all nineteen types, measured
2. The product analysis of the broken promise
3. The ADR comparing A, B and C — including the export-path cost and what detaching loses
4. The diagrams.net / draw.io technical evaluation
5. A final recommendation: what to build now, what to defer, and what not to build

**Pass two, only after the recommendation is accepted:**
6. UX flows and the exact message text
7. The data model
8. Import and conversion strategy
9. Compatibility and migration
10. A minimum working prototype
11. Test plan and acceptance criteria
12. A staged implementation plan, each stage leaving SIREN usable

## The principle

SIREN must tell the truth about what it can do. If a type can only be rendered, the interface says
*Preview only*. If a diagram can be edited visually only after detaching from its code, the person
is warned before the conversion, not after.

Do not optimise for the impression that the feature exists. Optimise for it being real, predictable,
and incapable of losing someone's work.
