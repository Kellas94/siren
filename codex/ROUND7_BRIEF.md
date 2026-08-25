# Round 7 — four jobs, all of them measured

Every fact below was measured on the base named here, either by the Stage 1 groundwork or by the
reviewer re-measuring it. Nothing in this round is inherited from a survey.

**These four were chosen on one criterion: the answer is already settled and only the work remains.**
Three other findings from the same groundwork are deliberately held back, because they need a
decision rather than an implementation. They are named at the end so you know they exist and are not
yours.

## The base

**`C:\Claude\SIREN\codex\FROZEN_R6_BASE.html`** — 8,528,590 bytes, SHA-256
`DFFFD40E0E5E6BC205B86D779CF6FADAA89426BC04493CB389CD3308CBCF8435`

That is the shipped v1.67.0, byte for byte. Line numbers below come from it.

Two upgrades are staged and verified but **not applied**: Mermaid 11.16.1 → 11.17.1 and an embedded
ELK. Both are anchor-guarded and will be re-applied after this round, so ignore them — but it does
mean you should prefer **text anchors over line numbers**, since a later Mermaid swap moves every
line in the file.

---

# Job AE — the Guided counter is a flowchart parser applied to everything

**Do this one first.** It blocks a separate piece of work: the plan is to offer Guided as the second
editor on the fourteen types the visual builder cannot touch, and that plan makes the application
*more* dishonest while this counter reads zero.

`#structureCount` reads **"0 blocks · 0 connections" on seventeen of nineteen types**, while the
Guided rows are visibly rendered beside it. Measured, with the row count as the positive control:

| type | counter | rows rendered | what is actually there |
|---|---|---:|---|
| flowchart | `3 blocks · 3 connections` | 4 | 3 blocks, 3 connections — correct |
| graph | `3 blocks · 2 connections` | 2 | 3 blocks, 2 connections — correct |
| sequence | `0 blocks · 0 connections` | 5 | 2 participants, 2 messages |
| gantt | `0 blocks · 0 connections` | 6 | 2 tasks, 1 dependency |
| mindmap | `0 blocks · 0 connections` | 5 | 4 nodes, 3 parent-child links |
| block | `0 blocks · 0 connections` | 5 | 6 blocks |
| kanban | `0 blocks · 0 connections` | 5 | 2 columns, 2 cards |
| …and twelve more | `0 blocks · 0 connections` | 2–6 | never zero |

**An earlier brief said kanban was accidentally right. That is refuted** — it reads zero for two
columns and two cards.

The rows themselves are fine. `#structureRows .struct-code` renders on every type and equals the
number of source lines. **Note the selector**: a previous measurement used `.struct-row`, which does
not exist in runtime row construction, and concluded Guided rendered nothing. It does.

Two nearby strings inherit the same fault and are part of this job:

- the Guided switch tooltip: *"The same Mermaid code, with its parts clickable: rename a block, swap
  a shape, change a connector"* — on most types no block, shape or connector chip is produced;
- the Guided hint, identical on all types: *"Click a chip to edit it in place. Drag a line number to
  reorder; right-click a line to add, move or delete it."*

**Where:** `structureRenderedSource = el.source.value;` (×1, line 29693) — the next line parses every
type through `parseStructureRows`. `el.structureCount.textContent = namedBlocks.size` (×1, line
29737). `<p class="struct-guide-hint"><span>Click a chip to edit it in place.` (×1, line 19494).

**What should change:** the count and its nouns become type-aware, or the count is absent on types
where "blocks · connections" has no honest meaning. Saying nothing is an acceptable answer and may be
the right one for pie or XY chart. The tooltip and hint must describe only what the active type
actually produces. **Leave the row rendering alone** — it works.

**Proved fixed:** load the nineteen reference sources, switch to Guided, wait 1400 ms, and assert the
type-native count for sequence (2 participants, 2 messages), gantt (2 tasks, 1 dependency), mindmap
(4 nodes, 3 links), block (6 blocks) and kanban (2 columns, 2 cards), with flowchart still reading
3 blocks · 3 connections. Assert `#structureRows .struct-code` equals the source line count on every
fixture. Those assertions fail today.

---

# Job AF — the app forgets the type one second after it makes it

Pick a type, press New starter, **confirm the dialog**, and the selection is gone.

Measured by the reviewer on the base, with the confirmation actually pressed:

| requested | after confirming | New starter |
|---|---|---|
| block, architecture, c4, xy, requirement, mindmap, timeline, kanban | select flips to **`advanced`** | **disabled** |
| ishikawa | select flips to **`flowchart`** | stays enabled |

Eight of nine land on the catch-all, and the button that made the diagram is then disabled — so a
person who wants a second one finds it greyed out. Ishikawa fails in the other direction: it is
re-detected as a flowchart, so New starter retitles itself *"Replace the current source with a
Flowchart starter."*

**Two corrections to earlier descriptions, both from the groundwork and both right.** The option
value is **`xy`**, not `xychart` — the alias does not exist and assigning it yields an empty select.
And the click on New starter opens `#confirmDialog`; a measurement that stops there never creates
anything, which is why an earlier run reported this defect as not reproducing.

**Where:** `<option value="xy">XY chart</option>` (×1, line 19184).
`function requestNewDiagramTypeStarter()` (×1, line 24785) — this path opens the confirmation before
applying the starter. The cause is `detectMermaidDiagramType`, which has branches for only some
families, so the rest fall to the catch-all.

**What should change:** after a starter is created, the picker must still name the thing that was
created, and New starter must remain usable. Whether that means widening detection or holding the
chosen type through creation is yours to decide — say which you chose and why.

**Proved fixed:** for each of the nine values, select it, press New starter, confirm, then assert at
300 ms and again at 2200 ms that `#diagramTypeSelect.value` is still the requested value and
`#newDiagramTypeButton.disabled` is false. Assert the created source's first line matches the
starter. Ishikawa must not report itself as a flowchart.

---

# Job AG — every diagram is titled "Flowchart Preview"

All nineteen types, all three surfaces, no exceptions:

| element | value on 19 of 19 |
|---|---|
| `#diagramTitlePreview` | `Flowchart Preview` |
| `#previewHeading` | `Flowchart Preview` |
| `#diagramTitle.value` | `Flowchart Preview` |

The third is the one that leaves the building — it is an input whose value travels into exports, so a
pie chart handed to a client is called "Flowchart Preview" unless someone notices and retypes it.

There is already a downstream mitigation, `diagramOfficeExportTitle(type)` (×1, line 86203), which
substitutes a type label for some Office exports. **That is not the fix and should not be extended** —
it patches the symptom in one exporter while the UI and every other path still say the wrong word.

**Where:** `const defaultState = {` (×1, line 22289) — holds both the top-level and first-diagram
`diagramTitle: 'Flowchart Preview'` defaults. `function applySource(source, { reason =` (×1, line
69041) — the type UI is refreshed here after a source replacement, and the untouched default title
is not made type-aware.

**What should change:** when the source changes type and the title is still the untouched flowchart
default, replace it with a type-appropriate default in state, in the diagram record, and on the three
rendered surfaces. **A title a person has edited must never be touched.** This belongs in the
ordinary source/type synchronisation path, not in each exporter.

**Proved fixed:** load the nineteen sources; for every type except flowchart and its graph alias,
assert none of the three surfaces contains the word "Flowchart". Then type `Client title` into
`#diagramTitle`, change the type, and assert all three still read `Client title`. The first assertion
fails today on 17 of 19.

---

# Job AH — the code-only chip promises two things that do not exist

The chip printed over a code-only diagram reads, verbatim:

> **Drawn from its code · click a part to find its line · right-click for fit, size, export and colours**

**The colours half is false on seven of eight types.** The real right-click menus were transcribed;
only Git graph carries a colour action:

| type | colour action in the menu |
|---|---|
| gitGraph | `Branch colours…` — present |
| xychart, pie, sequence, c4, gantt, timeline, journey | **none** |

**And a separate finding from the same transcript: four types announce the wrong family.** The menu
heading reads `Diagram 1 · Advanced Mermaid` on **xychart, pie, c4 and timeline**, while gantt,
journey, sequence and gitGraph correctly name theirs. The application knows what it rendered and
tells the person something else.

**Re-measured independently after the groundwork, with a real right-click, and both claims held:**
colour action present on exactly one of eight (gitGraph); `Diagram 1 · Advanced Mermaid` on all four
of xychart, pie, c4 and timeline, while gantt, journey, sequence and gitGraph name theirs correctly.
The positive control is that a flowchart opens a different menu entirely, headed `Rename block…`.
Evidence: `qa_exports/verify_context_menus.js`, `context_menu_verify.json`.

The heading element is **`.struct-menu-heading`** — a `div`, not a header tag. Worth knowing before
you write the test: a first verification looked for `.struct-menu-head`, fell back to the first menu
row, and reported the claim refuted. One missing "ing".

**Where:** `text.textContent = 'Drawn from its code` (×1, line 28953).
`function buildDiagramContextMenu(target)` (×1, line 28622).

**What is yours and what is not.** Fix the two factual defects: the chip must not promise colours
where no colour action exists, and the four headings must name the family the app actually rendered.
**Do not touch the click half of the sentence** — whether to change the interaction, reword it, or
drop the chip is a design decision being taken separately, and it is informed by a measurement you
should know about: a real mouse click never reaches `#diagram` on any of the eight code-only types.
A flowchart, as the positive control, receives it.

**Proved fixed:** for every type whose chip mentions colours, the opened `.struct-menu` must contain a
visible colour action. Assert the menu heading names the rendered family for xychart, pie, c4 and
timeline. Both fail today.

---

## Not in this round, and each for a reason

- **The caption at 0×0 (was Job Y).** `#orientationHint` measures `0,0,0,0` while the layout buttons
  it explains are visible and disabled at `638,196` and `669,196`. The measurement is complete and
  still does not say what to do: move the caption, attach it with `aria-describedby`, or find the
  state where both are meant to be visible. That is a design decision.
- **Discoverability (was Job AA).** Measured: the classic route and the type-chip route are **both
  four interactions** to create a Gantt. An earlier claim that the chip shortened it was wrong — that
  count stopped before the confirmation, so nothing had been created. What the route should become is
  a navigation decision.
- **The click half of the code-only chip.** See Job AH.

## House rules

Unchanged. Anchor-guarded patch scripts, each with a pinned input SHA and an exact output SHA. Every
anchor you had to move, named, with why. The Job A gate re-run against your final build with its
report JSON. Anything the suite flags that is mine rather than yours.

One addition, earned this round: **if a measurement here is wrong, say so.** The Stage 1 groundwork
corrected three claims in the brief it was given and was right every time — `.struct-row` does not
exist, kanban is not accidentally correct, and `xychart` is not a valid option value. Two of those
corrections were to instructions the reviewer wrote. Keep doing that.
