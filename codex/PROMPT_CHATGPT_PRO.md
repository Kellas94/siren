# Brief for ChatGPT Pro — can a block be put where you want it, and what is the smallest thing that makes that true?

You are being asked for a **design decision and its documentation**, not for code.

Read the whole brief before answering. If any of it is wrong or under-specified, say so at the top
of your answer and then proceed. Everything below was measured in the running application, but
measurements can miss things.

---

## 1. The product

**T-Industries SIREN** is a diagramming, documentation and presentation tool used to draw
flowcharts, sequence diagrams, git graphs, gantt charts and mind maps, to write linked
documentation beside them, and to present them.

It is **one HTML file**: 8,405,358 bytes, version 1.65.0. You open it by double-clicking it.
There is no server, no build step, no package manager, no bundler and no network access at
runtime. Its Content-Security-Policy forbids `eval` and `new Function`. All application code lives
inside a single IIFE. Mermaid **11.16.1** is embedded inline in the file. Storage is IndexedDB.

Its owner is not a programmer. Its users paste Mermaid from ChatGPT into it, and copy Mermaid out
of it.

## 2. The thing that does not work

> "I want to be able to put a block where I want it — to the side of another block if I need to —
> and have it stay there."

Today that is impossible in the general case, and it is impossible *by construction*, not by
oversight.

## 3. What the application actually is, measured

### 3.1 The source of truth is Mermaid text

A diagram **is** its Mermaid text. `#source` is a real `<textarea>`; `renderDiagram()` reads
`el.source.value` and every visual gesture re-parses it with `parseVisualFlowchartSource()`.
Everything else in the app is a **sidecar keyed to ids parsed out of that text**.

Persistence: the whole `state` object is written as one JSON string into IndexedDB under a single
key (`t-industries-siren-v23-state`), with a backup key, a draft key, a `BroadcastChannel` mirror
for multi-tab, and a localStorage fallback that writes a pending shadow record before the value so
a quota failure mid-write is recoverable.

A stored diagram has **29 fields**, including: `id, name, folderId, source, diagramTitle,
direction, curve, zoom, fontFamily, fontSize, fontWeight, nodeStyles, styleClasses, nodeClasses,
edgeStyles, edgeRoutes, nodeMetadata, comments, layout`. Note what is *not* there: **no
coordinates, for anything.**

### 3.2 There is no geometry layer anywhere

SIREN exports vector PDF, **editable PowerPoint shapes**, **native Excel shapes**, .docx, Markdown
and JSON. All of them need coordinates. None of them store any.

A single function, `collectDrawingFromSvg(svg, sourceText)`, derives every coordinate by reading
`getBBox()` and `getScreenCTM()` off the **rendered SVG at export time**, normalised by
`1 / ctmScale(svg.getCTM())` so preview zoom does not leak in. Shape *names* come from the Mermaid
text; every *rectangle* comes from the picture. Nothing is stored and nothing is reused between
exports.

This is important both ways: it means no geometry model exists to build on, and it means the app
already knows how to read geometry back out of a render.

### 3.3 Who decides where a block goes

**dagre**, inside Mermaid, from the text alone. The application contributes only global knobs:
`nodeSpacing` (12–180, default 50), `rankSpacing` (24–260, default 62), `padding`, and `curve`.
Direction (`TD` / `LR` / …) is not configuration — it is the first line of the Mermaid text, and
changing it is a surgical text edit.

One stored setting, `layout.alignment` (start / centre / end), is shown in the UI and exported to
Excel but is **never passed to Mermaid**. Against dagre it does nothing.

### 3.4 The second engine is not in the file

The Style card offers "ELK · better on dense diagrams". Choosing it performs a dynamic
`import()` of `https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.1.7/…`. Measured: three
requests, ~502 KB, from a public CDN. Offline it fails and falls back to dagre with a toast saying
it needs a connection.

So today the same file lays out **differently depending on whether the machine has internet** —
in an application whose entire premise is that it works with the network unplugged.

### 3.5 What Mermaid *can* be made to do — measured, not assumed

Measured by calling `mermaid.render` directly with the app's own config and reading each node's
centre out of the produced SVG:

| lever | result |
|---|---|
| **Node** declaration order | **No effect at all.** `C\nB\nP\nP-->B\nP-->C` and `B\nC\nP\n…` give byte-identical geometry. |
| **Edge** declaration order | **Decisive.** `P-->B; P-->C` puts B at cx 48.5 and C at 179.9. Swap the two edges and C is at 48.8, B at 180.1. With three siblings you get full permutation control. |
| `A ~~~ B` (invisible edge) | **A rank constraint, not a same-row hint.** Baseline: X and Z both on rank 0. Add `Z ~~~ X` and X is pushed down a whole rank. |

And the decisive limitation:

| case | result |
|---|---|
| Siblings that **rejoin** (`P-->B; P-->C; B-->E; C-->E`) | Edge order is **ignored**. Both orderings give B at 48.5, C at 179.9. |
| Siblings pinned to different ranks (`P-->B; P-->C; B-->C`) | Ignored. Both orderings identical. |

### 3.6 The app already exploits this, honestly

Pressing `]` on a selected block swaps it with its sibling: it rewrites the edge order in the text,
re-renders, **measures the result out of the new SVG**, and if the layout ignored the request it
rolls the text back and says so — measured toast: *"These two branches rejoin further down, so the
layout decides their left-right order. Moving them apart would mean changing what feeds them."*
When it does work: *"One and Two swapped sides."*

So the machinery for *ask → render → verify → keep-or-roll-back* already exists and works.

---

## 4. The question you are being asked

**What is the smallest change that lets a person place a block and have it stay — without losing
the offline promise, and without trapping anyone's work in a private format?**

Three candidate routes. Judge them; do not assume the owner's favourite.

- **Route A — constrain the engine.** Bring ELK into the file (about half a megabyte against 8.4)
  and drive its placement constraints. No new format, no migration. Unknown: whether ELK's
  constraints actually hold a lateral placement through edits, and what it costs in file size,
  boot time and fidelity.
- **Route B — a position sidecar.** Mermaid text stays the source of truth; add a per-diagram map
  of `node → the position a person chose`, applied after render. Small, reversible, and it degrades
  to today's behaviour if the map is lost. The hard part is **edges**, not nodes: move a block and
  its connectors must be re-routed.
- **Route C — a format of SIREN's own.** The largest. A parser inside a CSP-locked single file, every
  export and import path rewritten, every existing file migrated, and Mermaid — the thing ChatGPT
  already writes — demoted to an interchange format.

## 5. What to deliver

1. **A decision record** (one page, ADR form): which route, why, and what would change your mind.
   Rank them on: work, risk to existing files, file size, boot time, and what a user can no longer
   do afterwards.
2. **Placement semantics.** Whichever route you pick, specify exactly what happens when:
   a person places B left of A and then deletes A; places B left of A and then adds six more
   children to A; a placed block would overlap another; a diagram with placed blocks opens on a
   much narrower screen; the person asks for "tidy up" after placing things by hand; two branches
   that were placed apart later rejoin. A design that cannot answer these is not finished.
3. **The honest limit.** Name the cases your route still cannot hold, and say what the app should
   *tell the person* when it cannot — following the precedent in §3.6, which refuses out loud
   rather than pretending.
4. **Compatibility.** Reading every existing diagram with no loss; writing valid Mermaid back out;
   what happens to a diagram edited as raw Mermaid by hand (there is a Code view and people use it);
   and a migration that is reversible.
5. **The effect on everything else**, one paragraph each: the vector PDF, the editable PowerPoint,
   the native Excel shapes, .docx, import, the drawing canvas and its handles, the deck builder,
   the minimap, search, undo/redo and version history. Say for each whether your route makes it
   simpler or harder. Remember §3.2: all of them read geometry off the render today.
6. **A staged plan**, four to six stages, each leaving a working app the owner can use. Say what is
   provable at the end of each stage. No stage may be "and then everything changes at once".
7. **The first experiment.** Name the single cheapest test that would tell us whether your chosen
   route works, and say what result would kill it.

## 6. Hard constraints — a design that breaks one of these is unusable

- One HTML file. No build step, no bundler, no npm at runtime, no server, no external request.
- Strict CSP: no `eval`, no `new Function`. A format needing a generated parser must ship that
  parser as plain code.
- It must work offline, from a double-click, on a laptop.
- The file is already 8.4 MB and first paint is ~284 ms. Say what your design adds to both.
- The owner is not a programmer. Anything a person sees must read as plain language.
- Mermaid legibility is a feature, not a nicety: users move diagrams between SIREN and LLM chats.
- **Nothing may ever silently lose what someone wrote.** Where loss is unavoidable, the design must
  say how the person is told, before it happens.

## 7. Do not propose

A rewrite, a framework, TypeScript, a build pipeline, a server, real-time collaboration, replacing
IndexedDB, replacing Mermaid as an interchange format, or touch-first drawing (a tablet is for
reading this app, not authoring in it).

---

Length is not a constraint. Completeness is. Prefer specification to opinion; where you give an
opinion, mark it as one.
