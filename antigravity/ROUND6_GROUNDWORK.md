# Round 6 groundwork — the string inventory

You are doing the **groundwork** for a round that another engineer will implement and that I will
review. Your output is a **map, not a patch**. Read this whole brief before starting.

## What this is

T-Industries SIREN is a diagramming, documentation and presentation tool: one HTML file, 8,438,995
bytes, version 1.66.0, opened by double-clicking it. No server, no build step, no network at
runtime, strict CSP (no `eval`, no `new Function`). All code lives in one IIFE. Mermaid 11.16.1 is
embedded inline. Its owner is a KPMG auditor, not a programmer.

A survey of **all nineteen diagram types** the app can render was just completed by five agents,
each re-measured by an adversarial verifier. It found that the application repeatedly **tells the
person something that is not true**: counts that are wrong, instructions that cannot be followed,
a heading that names the wrong diagram, and controls that maintain text nobody can see.

Round 6 fixes that. Your job is the inventory it will be built from.

## Hard rules

1. **Do not modify the application.** Not the live file, not a copy that anyone else uses. You get a
   read-only copy; work from it and never write to it.
2. **Do not write patches.** No `.py` installers, no diffs, no edited HTML. If you produce a patch it
   will be discarded unread, because unpicking a patch costs more than writing one.
3. **Do not expand the scope.** Six jobs are listed below. If you find something else, put it in a
   separate "also noticed" section at the end — do not fold it into the inventory.
4. **Do not report a finding you have not seen.** Every row must carry a line number you actually
   grepped, or a runtime measurement you actually took. If you could not confirm something, write
   "could not confirm" — that is a useful answer and it will be treated as one.
5. **Do not claim anything works or does not work without saying how you checked.** For every
   behavioural claim, state what you would have observed if the opposite were true.

Your base:

- **`C:\Claude\SIREN\codex\FROZEN_1_66_0.html`** — 8,438,995 bytes, SHA-256
  `B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`

Copy it into your own working directory. The file is 8.4 MB: use `grep -an` / `grep -ao`, never read
it whole.

## What to deliver

**One markdown document**, `ROUND6_INVENTORY.md`, containing six tables — one per job below. Nothing
else is required. Prose only where a table cannot carry the point.

Every table row must have these columns:

| column | what goes in it |
|---|---|
| **String / control** | the exact text or element id, quoted verbatim |
| **Where** | file line number(s) from the frozen copy, and the function that writes it |
| **Shown when** | the condition under which a person sees it |
| **Wrong for** | which of the nineteen types it is false or misleading on |
| **Why wrong** | one sentence, concrete |
| **Proposed wording** | your suggested replacement, or "delete", or "needs a decision" |

The nineteen types: flowchart, graph, swimlane, ishikawa, sequence, class, state, ER, requirement,
block (block-beta), architecture, C4 context, gantt, timeline, kanban, journey, mindmap, git graph,
pie, XY chart. (That is the menu's list; if the app supports more, say so.)

---

## The six jobs to inventory

### 1. The invisible type chip
`#diagramTypeChip` is authored `hidden` with `aria-hidden="true"` around app.html:18989, and
`updateDiagramTypeChip` maintains its text on every render. Find **every sentence it can hold**, for
every type, and where each is set. These are the app's clearest statements about what a person can
do — currently unreadable.

### 2. "Flowchart Preview" everywhere
`#diagramTitlePreview` and `#previewHeading` read "Flowchart Preview" over every type. Find the
hard-coded string, every place it is set or defaulted, and — importantly — where it is used as the
**pre-filled value of the Style card's "Diagram title" field**, because that is the copy that ends
up in exports. List every export path that consumes it.

### 3. Type amnesia
`detectMermaidDiagramType` has branches for only some types; the rest fall to an "Advanced Mermaid"
catch-all, so seconds after a person picks Block / Architecture / C4 / XY chart / Requirement /
Mindmap / Timeline / Kanban the app stops calling it by name and disables "New starter". Inventory:
which types have a branch, which do not, every string that changes as a result, and the exact
condition that disables the starter button.

### 4. The Guided counter
`#structureCount` reads "N blocks · M connections". Measured, it is true on three types and false on
fourteen. Find the function that computes it, what it actually counts, and — per type — what the
honest nouns would be (a gantt has tasks, a mindmap has ideas, an XY chart has neither). Include the
two neighbouring strings that inherit the same fault: the Guided switch tooltip and the Guided hint
about right-click "add".

### 5. The misplaced caption and the preview chip
`#orientationHint` ("Applies to flowcharts only.") sits beside the Text/Guided switch but belongs to
the layout-orientation buttons — locate both and confirm which control it is bound to.
Then the code-only preview chip: "Drawn from its code · click a part to find its line · right-click
for fit, size, export and colours". Establish, per type, whether a real mouse click can reach
`#diagram` at all — the mechanism is `beginPan` taking pointer capture on `#zoomViewport`, exempting
only `#diagram g.node`. Also find `codeOnlyMaybeShowHint` and `state.codeOnlyHintSeen`, and confirm
whether the chip really can only ever appear once per browser profile.

### 6. Finding the diagram types at all
`#addDiagramButton` ("+ Diagram") appends a blank flowchart and never asks the type. The only type
picker is `#diagramTypeSelect`, inside a `<details>` card summarised "Diagram type, templates &
tools", collapsed by default. Inventory the full path a person must take to create each type, the
confirmation dialog wording (including the "Start a Architecture?" article bug), and every place the
type can be changed after the fact.

---

## Also useful, if you have room

A short section listing any **other** string you found that is false for some type. Do not fix it,
do not fold it into the tables — just quote it, say where it is and which type it is wrong for.

## What happens to your work

The inventory goes to a second engineer who writes the patches, and then to me for review. He will
be told explicitly that your inventory is **unverified input to be checked, not truth** — so a row
you are unsure about costs nothing if you mark it, and costs a great deal if you do not.

Accuracy is worth more here than completeness. A short inventory where every row is right is more
useful than a long one where some rows are guesses.
