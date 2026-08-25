# Brief for ChatGPT Pro — one diagram, several stories: should SIREN have layers?

You are being asked for a **design decision and its documentation**, not for code.

Read the whole brief before answering. If any of it is wrong or under-specified, say so at the top
of your answer and then proceed. Everything below was measured in the running application, but a
measurement is only as good as the probe behind it — say so if you think one is weak.

---

## 1. The product

**T-Industries SIREN** is a diagramming, documentation and presentation tool. One HTML file,
8,438,995 bytes, version 1.66.0, opened by double-clicking it. No server, no build step, no
package manager, no network access at runtime. Its Content-Security-Policy forbids `eval` and
`new Function`. All code is inside a single IIFE. Mermaid 11.16.1 is embedded inline. Storage is
IndexedDB.

Its owner is a **KPMG auditor**, not a programmer. That matters for this brief more than usual:
the use case below is his working life, not a hypothetical.

## 2. What is being asked for, and why

The owner draws a process once — a payments cycle, an approval chain, a reconciliation — and then
has to show it to three different audiences:

- the **walkthrough**: just the flow, nothing else, so someone can follow the process;
- the **control testing**: the same flow plus the control points, the evidence and who owns each;
- the **management summary**: the same flow plus the two places it actually breaks.

Today that is either three separate diagrams kept in step by hand, or one crowded diagram that
serves nobody well.

He raised this from his graphic-design experience as **layering** — the Photoshop/Figma idea of
independent planes you can show, hide and reorder.

## 3. What already exists, measured

This is the important section. SIREN already contains **three half-built answers to the same
question** — "which part of which diagram am I talking about?" — and none of them knows about the
other two.

### 3.1 Filters — a computed slice, transient, one at a time

The preview toolbar has a **Filters** panel. It filters blocks on the audit metadata each block can
carry. The exact fields, from the metadata sanitiser:

`risk · control · owner · evidence · status · reference · frequency · system`

Non-matching blocks are either **dimmed** or **hidden** (a two-option select), and a separate
control shows **badges** on blocks carrying a chosen field. There is a "Clear filters" button.

So the *rendering* machinery for "show me only this slice" already exists and works.

**What does not exist: memory.** I searched the whole file for saved filters, filter presets, named
views or saved views — **zero occurrences of any of them**. `filters: {}` is a single current
setting stored on the diagram. You can set one slice; you cannot name it, keep it, or switch
between several.

### 3.2 Deck slides — a saved view, but only usable inside a deck

The Present overlay's map has a Build mode where you compose slides. Pressing "Keep this view"
stores a record of exactly this shape:

```js
{ kind: 'nodes',   diagramId, nodeIds }   // up to 40 node ids
{ kind: 'diagram', diagramId }
{ kind: 'map' }
```

That **is** a saved, named, reusable view of part of a diagram. It exists today. It just cannot be
used anywhere except as a slide in a deck.

### 3.3 Docs links — a pointer from a document to a diagram or a step

A Docs document can be linked to a diagram or to one block, through
`wpLinkKind` / `wpLinkDiagram` / `wpLinkNode`, shown as chips on the document
(`wpLinkChips`). The UI offers "Whole diagram" or a specific step.

That is a third pointer at "part of a diagram", with a third shape, and it cannot be a filter or a
slide.

### 3.4 What a diagram stores today

29 fields, including: `source, diagramTitle, direction, curve, zoom, fontFamily, fontSize,
fontWeight, nodeStyles, styleClasses, nodeClasses, edgeStyles, edgeRoutes, nodeMetadata, comments,
layout, legend, filters`. Note `nodeClasses` and `styleClasses` — SIREN already has a notion of
named classes applied to sets of nodes, used for styling.

### 3.5 The source of truth is Mermaid text

A diagram **is** its Mermaid text; everything above is a sidecar keyed to ids parsed out of that
text. Mermaid has no syntax for layers, so any layer definition is necessarily SIREN-specific
metadata. The graph itself must stay standard Mermaid: users paste Mermaid into and out of LLM
chats, and that portability is a feature, not a nicety.

## 4. The question you are being asked

**What is the right shape for "one diagram, several stories" in this product — and is it layers?**

Consider at least these, and say which you would build first and why:

- **A. Saved views.** Name the filter you have set and come back to it. Smallest step; reuses the
  filter machinery that already renders correctly; membership is *computed* from metadata.
- **B. Hand-curated layers.** A named set of blocks you assign by hand, independent of metadata,
  which can be shown or hidden. More power; a second source of truth about membership.
- **C. Unify the three primitives.** One "view" concept that a filter can produce, a deck slide can
  consume, and a Docs document can point at — replacing three incompatible shapes with one.
- **D. Something else.** If the right answer is none of the above, say so.

The owner's instruction to me, which I pass to you unchanged: **rank these by which makes the tool
better, not by which is cheaper to build.** Where a cheaper option is also the better one, say so
plainly; where it is not, say that too.

## 5. The hard problem — do not hand-wave this

**A diagram is not a stack of independent planes. Its blocks are wired to each other.**

In Photoshop, hiding layer 2 leaves layer 1 untouched. Here, hide a block in the middle of a chain
`A → B → C` and you must decide what the reader sees:

- `A → C`, bridging the gap — which asserts a connection the process does not have;
- `A` and `C` with nothing between them — which hides that anything was removed;
- a marker standing for what is hidden — honest, but now the "clean" view is not clean.

Specify the rule. Then specify it for: a hidden block that is a decision with two branches; a hidden
block that is the only path between two halves of the diagram; a hidden block that other blocks
depend on for meaning; an edge whose two ends are on different layers; a subgraph/group with only
some of its members hidden; and what a hidden block does to the automatic layout (the remaining
diagram will re-flow — is that acceptable, or must positions be stable across views?).

A design that cannot answer these is not finished. **This is the equivalent of connector routing in
the placement design: it is where the actual work is, and where a plausible-sounding proposal fails.**

## 6. What to deliver

1. **A decision record** (one page, ADR form): which of A/B/C/D, why, and what would change your
   mind. Rank on: what it does for the owner's three audiences; work; risk to existing files; what
   a person can no longer do afterwards.
2. **The hiding semantics** from §5, case by case, with the message the app shows when it cannot do
   what was asked. The house style is to refuse out loud and name the cost, never to quietly do
   something different.
3. **The data model.** What a view/layer is, where it is stored, how it is keyed to blocks (Mermaid
   ids are the only handle, and they change when a person renames a block in the code view), and
   what happens to a view when its blocks are deleted or renamed.
4. **Unification, or a defence of not unifying.** Filters, deck slides and Docs links all answer the
   same question in three shapes. Say whether they should become one, and what breaks if they do.
   If you would leave them separate, say why three is right.
5. **Transport and compatibility.** Mermaid cannot express a layer. Say how a view travels when
   someone copies the diagram out, what is lost, and how the person is told before it is lost.
   Reading every existing diagram must produce no views and change nothing.
6. **The effect on the rest of the app**, one paragraph each: vector PDF, editable PowerPoint,
   native Excel shapes, .docx, Markdown, import, the deck builder, Present, Docs, the minimap,
   search and version history. In particular: **when a person exports, do they get the current view
   or the whole diagram — and how do they choose?**
7. **A staged plan**, three to five stages, each leaving a working app. Say what is provable at the
   end of each.
8. **The first experiment.** The single cheapest test that would tell us whether your chosen shape
   works, and what result would kill it.

## 7. Hard constraints — a design that breaks one of these is unusable

- One HTML file. No build step, no bundler, no server, no external request at runtime.
- Strict CSP: no `eval`, no `new Function`.
- Works offline, from a double-click.
- The file is already 8.4 MB. Say what your design adds.
- The owner is not a programmer. Everything a person sees must read as plain language. "Layer",
  "view", "filter" and "slide" must not all mean subtly different things on screen.
- Mermaid stays the portable source of truth. Mermaid in, Mermaid out, always.
- **Nothing may ever silently lose what someone wrote.** Hiding is not losing — but a design where
  hidden content can be forgotten, exported away, or deleted while invisible *is* losing, and must
  be prevented explicitly.

## 8. Do not propose

A rewrite, a framework, TypeScript, a build pipeline, a server, real-time collaboration, replacing
IndexedDB, replacing Mermaid, or manual free placement of blocks — that is a separate design which
is currently parked by the owner's decision, and it should not be smuggled in here.

---

Length is not a constraint. Completeness is. Prefer specification to opinion; where you give an
opinion, mark it as one.
