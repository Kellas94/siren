# Round 6, Stage 1 — the procedure

This is a procedure, not a brief. Follow it in order. Where it gives a command, run that command.
Where it gives a selector, use that selector. Do not design your own approach — the approaches have
already been designed, and the wrong ones have already been tried.

**You write no patches and you edit no application file.** Your output is one document.

---

## 0. Setup — do this once

```
cd C:\Claude\SIREN
node qa_exports\r6_probe_reference.js --app C:\Claude\SIREN\codex\FROZEN_R6_BASE.html --port 9970
```

If that prints nineteen lines, your environment works. If it does not, stop and say so — everything
below depends on it.

**The file you measure, every time:**

```
C:\Claude\SIREN\codex\FROZEN_R6_BASE.html      8,528,590 bytes
SHA-256 DFFFD40E0E5E6BC205B86D779CF6FADAA89426BC04493CB389CD3308CBCF8435
```

**How to write a probe:** copy `qa_exports\r6_probe_reference.js` to a new filename, change only the
two blocks marked `EDIT POINT`, and give it a port no other probe is using (9971, 9972, …).
Everything outside those two blocks took several wrong attempts to get right. Do not rewrite it.

---

## 1. What to produce

One file: `C:\Claude\SIREN\codex\ROUND6_GROUNDWORK.md`.

Six sections, one per job, in this order: **V, W, X, Y, Z, AA**. Each section has exactly these five
headings, spelled this way:

```
## Job <letter> — <the defect in your own words, one line>

### 1. What is true now
### 2. Where
### 3. What should change
### 4. How it would be proved fixed
### 5. What I could not establish
```

Job V below is filled in completely, from a real run. Match that level of detail for the others.

---

## 2. WORKED EXAMPLE — Job V, already measured for you

Copy this into your document as-is. It is the standard for the other five.

> ## Job V — every diagram type is titled "Flowchart Preview"
>
> ### 1. What is true now
>
> Measured with `qa_exports\r6_probe_reference.js` against `FROZEN_R6_BASE.html`, loading all
> nineteen types in one session and reading three elements after each render.
>
> **All nineteen types report the identical string in all three places:**
>
> | element | value on every one of the 19 types |
> |---|---|
> | `#diagramTitlePreview` | `"Flowchart Preview"` |
> | `#previewHeading` | `"Flowchart Preview"` |
> | `#diagramTitle` (the Style card field) | `"Flowchart Preview"` |
>
> Types covered: flowchart, graph, sequence, classDiagram, state, er, journey, gantt, pie, quadrant,
> requirement, gitGraph, c4, mindmap, timeline, sankey, xychart, block, kanban. Zero exceptions.
>
> The third row is the one that leaves the building: `#diagramTitle` is an input whose value is the
> exported title, so a pie chart sent to a client is called "Flowchart Preview" unless the person
> notices and retypes it.
>
> ### 2. Where
>
> *(fill in: line numbers from FROZEN_R6_BASE.html, the enclosing function, and the exact anchor
> text with its occurrence count — see section 4 of this procedure for how)*
>
> ### 3. What should change
>
> *(fill in)*
>
> ### 4. How it would be proved fixed
>
> Load each of the nineteen types in turn; after each render, `#diagramTitlePreview`,
> `#previewHeading` and `#diagramTitle` must not contain the word "Flowchart" unless the diagram is
> a flowchart or a graph. **This assertion fails on the current build on 17 of 19 types**, which is
> what makes it a test of the fix rather than a description of the present.
>
> ### 5. What I could not establish
>
> *(fill in — and do not leave it empty)*

---

## 3. The five remaining jobs — exactly what to do

### Job W — the app forgets the type you just picked

**States to enter.** For each of these nine values of `#diagramTypeSelect`: `block`, `architecture`,
`c4`, `xychart`, `requirement`, `mindmap`, `timeline`, `kanban`, `ishikawa`.

**Steps, per type:**
1. `#diagramTypeSelect` is inside a collapsed `<details>`. Open it first: walk up from the select to
   the nearest `DETAILS` ancestor and set `.open = true`. It cannot be used while closed.
2. Set the select's value, dispatch a `change` event.
3. Click **New starter** (`#newDiagramTypeButton`).
4. Wait **300 ms** and record: the select's value, `#newDiagramTypeButton.disabled`, its `title`, and
   `#diagramTypeHint`'s text.
5. Wait a further **2000 ms** and record the same four things again.

**What to report.** A table with one row per type and both readings, before and after. The claim to
test is that the select flips to "Advanced / other Mermaid", the button goes disabled, and the hint
changes — a second after the app told you it worked. Report the actual strings, not a summary.

**Ishikawa is the opposite case:** the claim is that it is re-detected as "Flowchart". Confirm or
refute separately.

### Job X — the Guided counter

**States.** All nineteen types from the reference probe's `SOURCES`.

**Steps, per type:**
1. Load the source. Wait for the render.
2. Switch to Guided: click the button whose text matches `/guided/i`.
3. Wait **1400 ms** — this counter has been measured too early before and reported as 0 when it was
   not.
4. Record: `#structureCount` text, and the count of `.struct-row` elements actually rendered.
5. **Hand-count from the source string** what a person would call blocks and connections.

**What to report.** One row per type: counter text, rendered row count, your hand count, and whether
they agree. The existing claim is that it is true on flowchart (6·6), swimlane (5·5) and ishikawa
(13·8), accidentally right on kanban, and false on the rest. **Test that claim; do not assume it.**

Also record verbatim: the Guided switch tooltip, and the Guided hint text. Both are alleged to
describe capabilities that do not exist on most types.

### Job Y — the caption on the wrong control

**States.** Any code-only type — pie, gantt and sequence are enough.

**Steps:** measure `#orientationHint` — its text, its `title` attribute, its
`getBoundingClientRect()`, and the rect of the ⌨ Text / ✦ Guided switch, and the rect of the layout
orientation buttons.

**What to report.** The pixel distance from `#orientationHint` to each of the two candidates. The
claim is that it sits beside the control it does not describe. Distance in pixels settles it; an
opinion does not.

### Job Z — the code-only hint chip

**Collect facts. Do not choose a design.** The decision is not yours this round.

1. **The text.** On a code-only type, find the hint chip and record its exact wording.
2. **Can a click reach the diagram?** On each of xychart, pie, sequence, c4, gantt, timeline, journey,
   gitGraph: dispatch a real click at the centre of a rendered element inside `#diagram` and record
   which element actually receives it (`document.elementFromPoint`). The claim is that pointer
   capture on `#zoomViewport` retargets the click, so the chip instructs the person to do something
   impossible. **Positive control: do the same on a flowchart, where it is supposed to work.** If
   your click does not land on a flowchart either, your probe is broken, not the app.
3. **The right-click menu.** On each of those types, open the context menu over the diagram and list
   its rows verbatim. The claim is that it offers no colour row on 18 of 19 types.
4. **Does the chip come back?** Load the app twice in the same browser profile and record whether
   the chip appears the second time.

### Job AA — a beginner cannot find the diagram types

**Collect facts. Do not choose a design.**

1. From a fresh load, count the **interactions** required to create a Gantt chart, listing each one.
2. Record where `#diagramTypeSelect` lives: its ancestor `<details>`, that element's `summary` text,
   and whether it is `open` on a fresh load.
3. Record what `#addDiagramButton` does: the type of the diagram it creates, and whether it asks.
4. Record whether the chip fixed in Job U now offers a shorter route, and how many interactions that
   route takes.

---

## 4. How to produce an anchor (mechanical — follow exactly)

For every change you propose, Stage 3 needs a piece of text that appears **exactly once** in the
file. Produce it like this:

1. Choose a span of 1–3 lines that contains what must change and enough context to be unique.
2. Count it:

```
python -c "import io; s=io.open(r'C:/Claude/SIREN/codex/FROZEN_R6_BASE.html',encoding='utf-8').read(); a=open('anchor.txt',encoding='utf-8').read(); print('occurrences:', s.count(a))"
```

3. If the count is not `1`, widen the span and count again.
4. In your document, give the anchor, its occurrence count, and its line number.

**An anchor that appears twice is not an anchor.** If you cannot make one unique, say so under
heading 5 rather than proposing a fragile one.

---

## 5. Rules that have caught real mistakes here

Each of these has produced a wrong answer in this codebase in the last week. None is hypothetical.

- **Report facts, not conclusions.** "The counter reads `0 blocks · 0 connections` over a sequence
  with 2 participants" is a finding. "The counter is broken" is not.
- **Before reporting that anything does nothing, show something comparable that does**, in the same
  run. A probe that reports zero everywhere is usually a broken probe. This is how two false results
  were caught this week — in both cases the application was fine and the instrument was lying.
- **Never compare raw SVG node ids.** They carry a render timestamp, so they differ after every
  render and everything looks changed.
- **`getBBox()` on an SVG group is in local coordinates.** A node that moved reports an unchanged
  box. Use `getBoundingClientRect()`.
- **Reject SCRIPT and STYLE parents when walking text nodes.** This app is one inline `<script>`, so
  a text walk otherwise finds sentences in its own source code and reports them as on-screen text.
- **A control inside a closed `<details>` can report a non-zero size and still be unreachable** — it
  cannot be focused or scrolled to. Check for a closed `DETAILS` ancestor before calling something
  visible.
- **Dismiss the welcome tour**, including its "Next" button. It holds keyboard focus and silently
  breaks focus assertions. The reference probe already does this.

---

## 6. If this document is wrong, say so

The job descriptions came from a survey, and surveys are wrong sometimes. If you measure something
that contradicts what the brief claims, **the measurement wins** and the contradiction is your most
valuable finding. Write it under heading 1 with the evidence.

The last two engineers on this application each corrected the reviewer twice, and were right all
four times.
