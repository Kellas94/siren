# The draw.io canvas for SIREN — specification

**Status:** approved-pending. Prototypes driven and measured; nothing installed.
**Target file:** `C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html` — now **v1.48.2, 4,061,942 bytes** (the brief's v1.45.0 / 3,976,591 is stale; another agent has been editing). Every anchor this spec depends on still exists in 1.48.2 and was re-confirmed by name.

**How everything below was measured.** My own copy of each prototype served on port **19787** (never previously held). Asserted three ways before any claim: `Content-Length: 3623904` == `curl | wc -c` == disk `3623904` for the handles prototype; `54575` == `54575` == `54575` for the quiet one. Headless Chrome over raw CDP. All input real `Input.dispatchMouseEvent` / `dispatchKeyEvent` / `dispatchTouchEvent` — no `element.click()`. Every screenshot cited was opened and read. Driver `spec/drive.mjs`, step generators `spec/mk_*.py`, logs and PNGs in `spec/oK3 oG3 oC oS oJ oL oQ oP2 oR2`.

---

## 1. What I found that the judges missed

### 1.1 The two judges who contradicted each other were both right, and both wrong about why

Judge 2: *"`Tab` really walks BLOCK N1 → HANDLE back → crossA → crossB."* Judge 3: *"`handlesInDOM = 0` at every single stop."* They ran different experiments. The real mechanism is neither.

Measured (`spec/oK3/log.txt`), tabbing from a blurred body on a one-block diagram:

```
tab0  => DIV[HIT:N1]  "Block Invoice received"   H:0
tab1  => BODY                                     H:0
tab2..8 => the seven toolbar buttons              H:0
tab9  => DIV[HIT:N1]                              H:0
```

**Tab does reach the block** — judge 3 was wrong that it is unreachable. But `H:0` throughout, because handles are painted only when a node is **hovered or selected**, and `paintOverlay()` gates on `hovered === id || (selected.length === 1 && selected[0] === id)`. There is **no focus listener anywhere in the file** (`grep "'focus'\|'focusin'\|onfocus"` → zero hits), so focusing a block never selects it. Then:

```
Ctrl+Enter (keyboard only) => "1 nodes"   (unchanged — dead)
F2         (keyboard only) => "F2 dead"
```

Both gate on `selected.length === 1`, and the **only** line in the file that sets `selected` from user action is a pointer handler (line 901 of `canvasA/app.js`).

And the part neither judge found: after a mouse click *does* select a block, handles enter the DOM (`H:2`) — but Tab still lands on toolbar buttons, never on a handle. Because **`paintOverlay()` calls `clearOverlay()` and rebuilds every overlay child on every render**, destroying the focused element. Focus falls to `<body>` and the tab order restarts from the top of the document. So keyboard focus is annihilated by every single mutation.

This matters because it is *cheap to fix and nobody had diagnosed it*: one `focusin` listener that selects, arrow keys for navigation, and a re-focus by `data-handle-for` after repaint. Roughly forty lines. Judge 3's verdict ("keyboard is a claim, not a feature") is correct as a description and wrong as a prognosis.

### 1.2 G3's failure has a single isolable cause, and I isolated it in one run

Both judges reported G3 lying. Neither pinned the variable. I built one diagram and added one edge between two trials (`spec/oC/log.txt`):

| trial | source after `[` or `]` | rendered x of the two branches |
|---|---|---|
| **no join** | `N2\|No\|N4` then `N2\|Yes\|N3` | `Post to ledger@482 / Exception queue@673` → **`Exception queue@491 / Post to ledger@682`** — swapped |
| **join added** (`N3→N5`, `N4→N5`) | `N2\|Yes\|N3` then `N2\|No\|N4` | `Post to ledger@482,419 / Exception queue@673,419` → **identical** — nothing moved |

Same diagram. One edge. The gesture flips from working to lying. Dagre's within-rank ordering is a crossing-minimisation pass; once the branches reconverge, dagre re-derives an order and edge-array order stops mattering. **A converging approval flow is the normal shape of an audit diagram**, so the gesture is broken precisely where it would be used.

Confirmed visually in `spec/oG3/H03_after_G3.png`, read: the toast says *"Exception queue and Post to ledger swapped sides"*, the log says *"applied: Branch moved to the other side"*, the source pane shows the edges reordered — and on screen "Post to ledger" is still on the left with its `Yes` label and "Exception queue" still on the right with `No`.

**Design consequence, and it is the reason G3 is deferred to Phase 4:** you cannot *predict* this without reimplementing dagre's crossing minimisation. You can only *verify* it — apply, re-render, re-measure, and roll back if nothing moved.

### 1.3 G2's heal is worse than reported, and it is the finding that should decide the owner's risk appetite

Judge 2 found the `ins × outs` heal skipping an existing `(from,to)` while ignoring the label. I reproduced it on the canonical audit shape and it destroyed **two** edges (`spec/oS/log.txt`):

```
before:  N1-->N2 · N2|Yes|N3 · N2|No|N4 · N4-->N3        (4 connectors)
after:   N1-->N4 · N4-->N2   · N2|Yes|N3                 (3 connectors)
```

The `No` branch is gone. The decision diamond "3-way match clean?" now has **exactly one exit** — a decision that cannot decide. The heal wanted to add `N2 -->|No| N3`, found `N2 --> N3` already present as the `Yes` edge, and dropped the `No` path into it.

`spec/oS/S03_after_splice.png`, read: the toast says *"Moved Exception queue between Invoice received and 3-way match clean?"* — accurate about what it added, silent about what it deleted. And the status bar reads **"round-trip OK · 4 blocks · 3 connectors"** in green, because the Mermaid is *valid*. **Validity is not correctness, and the health indicator cannot catch semantic loss.** In an audit file a silently deleted control path is worse than any number of extra clicks.

### 1.4 The rename trap is not minor — it fired twice on me, unprompted

Judge 2 logged it as recoverable and moved on. It caught me **twice in two separate runs while I was trying to do something else entirely**. A drag that misses the 22px handle leaves the block selected; the next character typed is swallowed by type-to-rename. In run `oG` it renamed "3-way match clean?" to "Post to ledger" and then to "Exception queue"; in run `oI` it renamed "Invoice matched" to "Second review". The shape stayed a diamond while the label stopped being a question — label and shape desynchronised with no warning.

One `Ctrl+Z` recovers it. But the failure is *invisible*: you meant to create a block, you got a rename, and the only evidence is that the block you were looking at now says something else. For a non-coder building a 40-step process this is the bug that erodes trust in the whole canvas.

### 1.5 The one that would have cost an implementer days: the quiet prototype's layout engine is more obedient than dagre

The quiet prototype has **no mermaid at all** (`typeof window.mermaid === "undefined"`, `grep -c mermaid` → 0). It ships its own layered layout engine that takes within-rank order from edge-array order. I loaded the same four sources into both engines (`spec/oP2/log.txt` vs `spec/oC/log.txt`):

| source | quiet's engine | mermaid + dagre |
|---|---|---|
| join, `Yes` first | `N3@486 N4@651` | `N3@482 N4@673` |
| join, `No` first | `N3@658 N4@493` — **swapped** | `N3@482 N4@673` — **unchanged** |
| no join, `Yes` first | `N3@486 N4@651` | `N3@482 N4@673` |
| no join, `No` first | `N3@658 N4@493` — swapped | `N4@491 N3@682` — swapped |

**Quiet's engine reorders on edge order in both cases; dagre only does it without a join.** Any gesture designed and validated against the quiet prototype would look perfect there and fail in SIREN — exactly on converging flows. This is why the quiet author never hit the G3 problem: their engine does not have it.

**Rule this establishes, and it belongs in the implementer's head permanently: the quiet prototype's *keyboard grammar* is portable because it is pure model mutation. Its *layout* claims are not portable at all. Never validate a positional gesture anywhere but against real mermaid.**

### 1.6 Smaller things, all measured

- **The canvas contradicts the pointer on the very first click.** `spec/oK3/K01_first_block.png`, read: I clicked the placeholder at y=627; the block landed at y=119. Correct behaviour for a computed layout, wrong affordance — the ghost should sit where the block will actually land.
- **Two handle rings can be lit at once.** `__C.handles()` returned `["back","crossA","crossB","back","fwd"]` — five handles, the hovered node's ring plus the selected node's. Against a design direction of "a resting UI that is not loud", one ring at a time.
- **A block that already has a successor loses its "add the next step" handle.** The arity rule replaces `fwd` with `crossA`/`crossB` at the first child. Adding a sequential step mid-chain is then only reachable from the *downstream* block's `back` handle — correct, but not where anyone looks.
- **Touch: tap selects, every drag is dead.** Real CDP touch: tap lit the ring (`back@485,388 fwd@485,458`); the handle drag left `n:5 e:4` unchanged and the popover closed. `touch-action` is `auto` on body, `#overlay` and `#left`, so Chrome claims the gesture for scrolling. G1/G2/G3 are all unavailable on touch. (Judge 3's stranded blue wire did not reproduce for me — `wire d.len=0`. The drag simply does nothing.)
- **Undo granularity is correct.** One `Ctrl+Z` reverted exactly one gesture; `Ctrl+Y` restored byte-identical source.
- **The insert is genuinely excellent, and safe on labelled branches** — the case that actually matters. `N2 -->|No| N4` became `N2 -->|No| N5` + `N5 --> N4`: the branch label stayed upstream where an auditor means it to stay. Measured cost, exact: mouse 3→4, keys 3→4, chars 38→51.

---

## 2. What I took from where

**Take A (handles) — `scratchpad/canvas_handles.html` — is the winner, and it is the one to keep on disk.** It is the only prototype that renders with real mermaid 11.16.1, which means it is the only one whose layout claims are worth anything. Its handle ring is the correct translation of draw.io's four arrows, and its insert gesture is the single most valuable edit in the set.

**From Take A I take:** the handle ring and its arity rule (2 on a leaf, 3 once it branches); the drag-out-to-popover interaction; drop-on-a-block = connector only; the `?`→Decision and first-two-branches→`Yes`/`No` defaults, which bought 4 branch labels for 0 keystrokes; and the insert semantics on the `back` handle, including the label staying upstream.

**From Take C (quiet) — `scratchpad/canvas_quiet.html` — I take the keyboard grammar and nothing else.** Measured: a 3-node chain with a decision and an auto-labelled `Yes` built with **0 mouse actions, 4 keys, 48 characters**, `round-trip identical: true` throughout. Arrow navigation works (`←` walked N4→N3 across siblings, `↓` walked N3→N5 to the successor). Its `Ctrl+Enter` insert is clean and non-destructive: `N4-->N5` became `N4-->N6` + `N6-->N5`, 1 mouse + 2 keys + 13 chars. And its at-rest keyboard legend (visible in `spec/oR2/R01_quiet_insert.png`) is the best discoverability idea in any of the three — the entire grammar readable without a tooltip.

I take **none** of its layout, and none of its positional gestures. See 1.5.

**Take B (drop) contributed nothing.** It returned `null` and built no prototype — `scratchpad/drop/` contains a single `siren_shapes.xlsx` from a previous session. There is no drop-target design to inherit. The drop-target behaviour in this spec is derived from Take A's measured splice plus the correctness rules in §4.

**Where I overrule both takes:** no DOM overlay (§7.0), G3 deferred behind verify-after-render (§4, G6), and destructive heals forbidden outright (§4, safety rule).

---

## 3. How close this gets to draw.io, and where it deliberately differs

**Close, on the gestures that carry meaning.** Grow-from-a-handle, drop-on-a-block to connect, drop-on-a-connector to splice, type-to-rename, double-click-an-edge-to-label — all five are draw.io's actual grammar and all five are pure topology, so all five survive translation.

**Three deliberate differences.**

1. **Two axes instead of four arrows.** draw.io's four handles all do the same thing; only the pixels differ. SIREN has no pixels to differ in. So the ring carries *before me / after me*, and once a block branches, *this side / that side*. This is better rather than a compromise: a cosmetic control would teach the user that the canvas is lying about space, and a computed layout's whole advantage is that space is honest. Every handle here changes the file.

2. **No free positioning, ever.** In draw.io you drag a box where you want it. Here you cannot, and the answer is not "you'll get used to it" — it is that on the identical benchmark draw.io needed **~16 tidying actions and was still not clean**, and SIREN needs zero. The tidying column is the product.

   Say the honest version to the owner: it is **0 tidying *possible***, not 0 tidying *needed*. The picture the canvas produces cannot be adjusted. On my own benchmark run the decision diamond sat outside the group it belonged to and two edges crossed. That is the trade, it is the right trade, and it is why G3 — the only reordering tool there will ever be — must tell the truth or not exist.

3. **The keyboard is a first-class route, not an accessibility afterthought.** draw.io's keyboard story is thin. Every gesture here has a keyboard equivalent that produces the identical mutation, because the mutation is the product and the pointer is one way to reach it.

**Where it will feel worse than draw.io, stated plainly.** You cannot nudge anything. You cannot make one box bigger. Two nodes on the same rank under *different* parents can never be reordered — their left/right is fixed by their ancestors, and no gesture will change that. And on touch, until Phase 3, this is a read-and-tap canvas rather than a drag canvas.

---

## 4. The gesture set

**Safety rule that governs all of them, and it is not negotiable:** *no gesture may delete or absorb an edge without naming it.* Any mutation that would drop an edge must either preserve it (by carrying the label onto a new edge) or stop and say what it is about to lose. §1.3 is what happens otherwise. Every gesture below goes through `scheduleUndoSnapshot()` before it mutates, so one `Ctrl+Z` is exactly one gesture.

Shared vocabulary: `M = parseVisualFlowchartSource(el.source.value)`; apply with `applyVisualModel(M, reason, selectId)`. Never write `order` — it is assigned at parse time and the serialiser never reads it. Arrow types are limited to `EDGE_TYPES = ['-->','---','-.->','==>']`; anything else is silently coerced.

---

### G1 · Grow — drag a handle into empty space

**Trigger.** Hover a block (or select it) → ring appears → press a handle → drag → release over empty canvas.

**Stages.** *Hover:* a ring of 2 or 3 small arrow buttons, 13px outside the block edge, fading in. *Press:* the grabbed handle fills. *Drag:* a dashed wire follows the cursor. *Release:* a small popover opens at the drop point with the label field already focused and a shape chip. *Enter:* block and connector appear, layout re-flows, new block is selected.

**Mutation.**
```js
scheduleUndoSnapshot();
const M  = parseVisualFlowchartSource(el.source.value);
const id = nextVisualNodeId(M.nodes);
M.nodes.push({ id, label: cleanVisualText(value), shape: /\?\s*$/.test(value) ? 'diamond' : 'rect' });
M.edges.push({ from: sourceId, to: id, type: '-->', label: autoBranchLabel(M, sourceId) });
const sg = M.subgraphs.find(g => g.members.includes(sourceId));
if (sg) sg.members.push(id);                       // inherit the group
applyVisualModel(M, 'Block added from handle', id);
```
`autoBranchLabel` returns `'Yes'` for the first edge out of a diamond, `'No'` for the second, `''` otherwise.

**Mermaid.** `D{"Match clean?"}` gains `N1["Escalate to partner"]` and `D -->|No| N1`. Group members round-trip inside the `subgraph … end` block.

**Keyboard.** `Ctrl+Enter` = grow forward. `Ctrl+Shift+Enter` = insert before (G2). Opens the same popover at the same place.

**Touch.** Tap selects and lights the ring; press-and-hold a handle 120ms then drag. Requires `touch-action: none` on the handle layer (§7) — without it Chrome takes the gesture for scrolling and the drag is dead, which is exactly what I measured.

---

### G2 · Insert — drag the `back` handle out, or `Ctrl+Shift+Enter`

**This is Phase 1 and the highest-value gesture in the set.** Everything feeding the block is re-pointed to feed the new one.

**Trigger.** Hover the block that should come *after* the new step → drag its `back` handle to empty canvas → type → Enter.

**Mutation.**
```js
scheduleUndoSnapshot();
const M  = parseVisualFlowchartSource(el.source.value);
const id = nextVisualNodeId(M.nodes);
M.nodes.push({ id, label: cleanVisualText(value), shape });
M.edges.forEach(e => { if (e.to === targetId) e.to = id; });   // labels stay upstream
M.edges.push({ from: id, to: targetId, type: '-->', label: '' });
const sg = M.subgraphs.find(g => g.members.includes(targetId));
if (sg) sg.members.push(id);
applyVisualModel(M, 'Step inserted before block', id);
```

**Mermaid.** Measured, plain: `N1-->N2` + `N2-->N3` became `N1-->N4` + `N4-->N2` + `N2-->N3`. Measured, labelled: `N2 -->|No| N4` became `N2 -->|No| N5` + `N5 --> N4`. The `No` stays on the upstream edge — the auditor's meaning is preserved.

**Cost, measured exactly:** mouse 3→4, keys 3→4, chars 38→51. **1 mouse + 1 key + the label.**

**Keyboard.** Select the block, `Ctrl+Shift+Enter`. Quiet's `Ctrl+Enter`-inserts-after is the mirror image and ships alongside it.

**Touch.** As G1.

---

### G3 · Connect — drag a handle onto an existing block

**Trigger.** Drag any handle and release over another block instead of empty canvas. The target block outlines; no popover opens.

**Mutation.** `M.edges.push({ from: sourceId, to: targetId, type: '-->', label: autoBranchLabel(M, sourceId) })`, guarded by a duplicate check on `from|type|to`. Measured cost: **1 mouse, 0 keys.**

**Refusal.** If the edge already exists, say so and do nothing: *"These two are already connected."*

**Keyboard.** `Ctrl+Enter` to open the popover, then `↓` into the "connect to an existing block" list and `Enter` — quiet's combobox pattern, which is the right shape for this.

**Touch.** As G1.

---

### G4 · Splice — drag a block's body onto a connector

**Trigger.** Press a block's body (not a handle) and drag onto a connector. The connector thickens under the cursor.

**Mutation — with the correctness fix that §1.3 demands.**
```js
scheduleUndoSnapshot();
const M = parseVisualFlowchartSource(el.source.value);

// 1. detach: heal the hole this block leaves, WITHOUT losing labels
const ins  = M.edges.filter(e => e.to   === movedId);
const outs = M.edges.filter(e => e.from === movedId);
const casualties = [];
ins.forEach(i => outs.forEach(o => {
  const clash = M.edges.find(e => e.from === i.from && e.to === o.to && e.type === i.type);
  if (clash && clash.label !== i.label) { casualties.push({ i, o, clash }); return; }
  if (!clash) M.edges.push({ from: i.from, to: o.to, type: i.type, label: i.label });
}));
if (casualties.length) return refuse(casualties);   // STOP. Do not silently absorb.

M.edges = M.edges.filter(e => e.from !== movedId && e.to !== movedId);

// 2. splice into the target connector
const k   = M.edges.findIndex(e => e.from === t.from && e.to === t.to && e.type === t.type);
const old = M.edges[k];
M.edges.splice(k, 1,
  { from: old.from, to: movedId, type: old.type, label: old.label },  // branch label stays upstream
  { from: movedId,  to: old.to,  type: old.type, label: '' });
applyVisualModel(M, 'Block moved into the connector', movedId);
```

`refuse()` is the whole point: *"Moving Exception queue here would merge its 'No' path into the existing 'Yes' path, and the No branch would be lost. Move it somewhere else, or delete the Yes connector first."* Blocking, with a Cancel. Never a toast that only mentions what was added.

**Mermaid.** `A-->B` becomes `A-->C` and `C-->B`, with `A`'s branch label riding the first half.

**Keyboard.** Select the block, `Ctrl+Shift+I`, then pick the connector from a list ("between PO issued and Goods received"). Naming both ends beats hunting a line.

**Touch.** Press-and-hold 200ms on the block body, then drag.

---

### G5 · Rename in place — type on a selected block

**Trigger.** Select a block and type any printable character, or press `F2`, or double-click.

**Stages.** The block's text is replaced by an input sized to the block, pre-filled (`F2`/double-click) or empty and taking the first keystroke (type-to-replace). `Enter` commits, `Esc` reverts.

**Mutation.** `M.nodes.find(n => n.id === id).label = cleanVisualText(value) || node.id;` then `applyVisualModel(M, 'Block renamed on canvas', id)`. **Never change the id** — `structureRemapNodeId` migrates the seven sidecar stores but does not touch the source, and the two go out of sync.

**The guard that §1.4 demands.** Type-to-replace fires only within 400ms of an *explicit* selection — a click or a keyboard move — and never after a failed drag. Concretely: a `pointerup` that began on a handle and did not produce a block sets `suppressTypeToRename = true` until the next deliberate selection. This alone removes the failure that caught me twice. Ship type-to-replace as a preference, default on, discoverable in Settings; `F2` and double-click are always available.

**Keyboard.** `F2`. **Touch.** Double-tap.

---

### G6 · Reorder siblings — `[` and `]`, or drag a block past its sibling — **Phase 4, and only with verification**

**Do not ship this on a predicate.** §1.2 shows the predicate ("same `edge.from` and equal rendered `y`") passes on a converging flow where the gesture then does nothing. Prediction requires reimplementing dagre's crossing minimisation. Verification does not.

**Mutation, then verify.**
```js
const before = readRenderedX();                 // { id: x } from g.node transforms
scheduleUndoSnapshot();
swapEdgeOrder(M, a, b);
applyVisualModel(M, 'Branch moved to the other side', a);
afterNextRender(() => {
  const after = readRenderedX();
  if (after[a] === before[a] && after[b] === before[b]) {
    undo();                                     // silent rollback, one step
    explain('These two branches rejoin further down, so the layout decides their ' +
            'left-right order. Moving them apart would mean changing what feeds them.');
  } else {
    toast(labelOf(a) + ' and ' + labelOf(b) + ' swapped sides.');
  }
});
```

Cost of the verify pass: one render, ~420ms debounce + ~230ms mermaid ≈ 650ms. Acceptable for a gesture used rarely, and infinitely better than a confirmed lie. The toast fires **after** the render, never before.

**Keyboard.** `[` / `]`. **Touch.** Drag onto the sibling.

---

### G7 · Edge label in place — double-click a connector

**Trigger.** Double-click a connector, or select a block and press `Ctrl+L` to edit its incoming connector's label.

**Mutation — and the sidecar move is mandatory, because the label is part of the key.**
```js
const oldKey = edgeKey(edge);            // from|type|to|encodeURIComponent(label)
edge.label   = cleanVisualText(value);
const newKey = edgeKey(edge);
const d = getActiveDiagram();
['edgeStyles','edgeRoutes'].forEach(store => {
  if (d[store]?.[oldKey]) { d[store][newKey] = d[store][oldKey]; delete d[store][oldKey]; }
});
applyVisualModel(M, 'Connector label edited');
```
Miss this and every styled or re-routed edge loses its styling the first time someone fixes a typo in `Yes`.

**Keyboard.** `Ctrl+L`. **Touch.** Double-tap the connector.

---

### G8 · Delete and heal — `Delete`

Same `ins × outs` heal as G4 step 1, same refusal when a label would be absorbed, same wording. `Delete` on a multi-selection heals around the whole set.

---

## 5. Phasing

Four phases. Each ships alone, each leaves the app better, none depends on a later one.

### Phase 1 — The ring and the insert · ~3 days

**Ships:** the handle ring (2 handles: `back`, `fwd`) on hover and on selection; drag out to empty canvas → popover → new block; **G2 insert** on `back`, **G1 grow** on `fwd`; the `?`→Decision and `Yes`/`No` defaults; `Ctrl+Enter` / `Ctrl+Shift+Enter`; the rename-modal bug fixed in passing.

**Why this is Phase 1.** The insert is the most common audit edit — *"we forgot the review step"* — and it goes from ~15 form actions to **1 mouse + 1 key + the label**, measured. Grow comes essentially free once the ring, the popover and the mutation path exist: it is a strictly simpler mutation than the insert. Nothing here depends on drop targets, hit-testing new geometry, or any layout prediction. It only ever *adds* nodes and edges, and re-points one — **it cannot destroy anything**, which is why it can ship before the safety machinery in Phase 2.

**Does not ship:** drop-on-a-block, drop-on-a-connector, reorder, touch drag.

### Phase 2 — Drop targets and the refusal machinery · ~4 days

**Ships:** G3 connect (drop on a block); G4 splice (drop on a connector); G8 delete-and-heal; the shared `heal()` with the casualty check and the blocking refusal dialog; the type-to-rename guard from §1.4.

**Why second.** These are the first gestures that can *remove* an edge, so they may not ship until the refusal machinery does. The heal is written once and used by both G4 and G8.

### Phase 3 — Keyboard and touch parity · ~3 days

**Ships:** `focusin` on a block selects it; `↑↓` walk predecessor/successor, `←→` walk siblings; focus preserved across repaint by re-focusing `[data-handle-for]` / `[data-node-id]` after render; handles in the tab order with real `aria-label`s; `touch-action: none` on the handle layer; press-and-hold to start a drag; the at-rest keyboard legend borrowed from the quiet prototype, collapsed by default.

**Why third and not first.** Everything in Phases 1–2 already has a keyboard route (`Ctrl+Enter`, `Ctrl+Shift+Enter`, `F2`, `Delete`) reachable once a block is selected by *any* means. Phase 3 makes the canvas fully operable without a pointer. It is separable, and it is the phase most likely to slip — which is exactly why it must not block the insert.

### Phase 4 — Reorder, with verification · ~2 days

**Ships:** G6 behind `readRenderedX()` + `afterNextRender()` + silent rollback + the plain-language refusal.

**Why last.** Least valuable — under auto-layout, left/right rarely carries meaning — and most dangerous. It is the one gesture that can confirm an edit that did not happen, and §1.2 shows that is the *normal* case on an approval flow.

---

## 6. What the form panel keeps, and what leaves it

**Leaves the panel** (the canvas is strictly better): adding a block; connecting two blocks; inserting a step into a connector; renaming a block; labelling a connector; deleting a block. These are one-object-and-its-neighbours jobs, and every one of them costs 5–15 form actions today against 1–2 on the canvas.

**Stays in the panel**, and the panel is not diminished by this — these are the jobs a canvas is genuinely bad at:

- **Connector type.** The canvas only ever writes `-->`. `---`, `-.->`, `==>` are a four-way choice with no spatial meaning; a dropdown is the right control.
- **Shapes beyond the popover's chips.** The chips cover Process / Decision / Start-End / Data. Everything else belongs in a list.
- **Bulk edits.** Renaming eight blocks, restyling a whole branch, reassigning group membership for a set. The canvas is O(1) per object and that is its weakness at volume.
- **Anything with more than two fields**: metadata, drill-down links, icons, node styling. A popover with six fields is a form wearing a costume.
- **Long labels.** A 90-character step name is unreadable in an in-place editor sized to the block.
- **Grouping non-contiguous members.** Measured in the quiet prototype as the one job where three clicks genuinely beat the keyboard — and it is a list operation, not a spatial one.
- **The source view.** Always. It is the audit trail.

The panel also keeps its job as the **fallback for incompatible sources.** `parseVisualFlowchartSource` returns `compatible: false` on `%%{init}` directives, nested subgraphs, `classDef`/`class`/`style`/`linkStyle`/`click`/`direction` lines, a second `flowchart` declaration, arrow forms outside the writable four, and `subgraph` without `end`. **On those diagrams the ring must not appear at all** — not appear-and-fail. A single quiet line where the ring would be: *"This diagram uses features the canvas can't edit safely. Use the panel or the source."*

---

## 7. What changes underneath

### 7.0 The one structural decision, and it is earned by measurement

**Do not build a DOM overlay.** Both the prototype and judge 3's integration notes assume an absolutely-positioned overlay of `.nodebox` / `.nodehit` divs that must be re-measured on every scroll and resize. That is where judge 3's drift risk, the `beginPan` conflict, and the focus-destruction bug (§1.1) all come from.

Instead: **paint handles as a sibling `<g class="t-handles">` inside the diagram's own SVG**, positioned from each node's `getBBox()`. Consequences, all verified against v1.48.2:

- No drift, ever — the handles live in the same coordinate space as the picture and pan and zoom with it for free.
- No new hit-testing. `resolveNodeIdFromElement(target)` already resolves any element via `closest('[data-node-id], g.node')`. Handles placed in a *sibling* `<g>` (not inside `g.node`) resolve to `''`, so `handlePreviewNodeClick` falls through cleanly and does not open the inspector behind the gesture.
- `beginPan` (line 75014) already excludes `button, … #diagram [data-node-id], #diagram path.t-edge-hitarea`. SVG `<g role="button">` is not `button`, so **add `#diagram [data-handle-for]` to that selector string.** One string, one line — and naming it here is the difference between a clean Phase 1 and a day lost to a canvas that pans while you drag.

### Per-phase touch points

| | functions and searchable strings | effort | main risk | how to test it |
|---|---|---|---|---|
| **P1** | `parseVisualFlowchartSource`, `applyVisualModel`, `nextVisualNodeId`, `cleanVisualText`, `scheduleUndoSnapshot`, `serializeVisualFlowchart`, `resolveNodeIdFromElement`, `renameNodeById` (28900), `requestRename` (20441), `handlePreviewNodeDoubleClick` (28919), `RENDER_DEBOUNCE_MS` (17047), `beginPan` (75014). New: `paintHandles`, `handleSpec`, `openGrowPopover`. | ~3 d | **The 420ms debounce.** `applyVisualModel → applySource → scheduleRender` means ~420 + ~230 ≈ **650ms before the block you just made has handles.** Chained growth feels broken. | Add a synchronous render path for canvas mutations (bypass the debounce when `reason` starts `'canvas:'`). Test: drive ten consecutive grows with no artificial wait and assert ten blocks. |
| **P2** | `edgeKey`, `legacyEdgeKey`, `structureRemapNodeId`, `getActiveDiagram`, `nodeStyles` / `nodeMetadata` / `nodeClasses` / `links` / `icons` / `edgeStyles` / `edgeRoutes`, `showDialog`, `confirmDialog`. New: `healAround`, `refuseDestructiveHeal`, `spliceIntoEdge`. | ~4 d | **Silent edge loss (§1.3).** A green "round-trip OK" does not mean correct. | A property test: for 200 random 6–12 node graphs with labelled branches, assert that after any splice or delete `newEdges.length >= oldEdges.length - 1` **and** every distinct branch label out of every diamond still exists. This is the single most valuable test in the plan. |
| **P3** | `paintHandles` re-focus, `autoFitPreviewToPane`, `el.zoomViewport`, `touch-action`, `aria-label`, `tabindex`. New: `focusin` handler, `moveFocus(dir)`. | ~3 d | **Focus annihilation on repaint (§1.1)**; `autoFitPreviewToPane` re-fitting zoom mid-gesture and moving the handle out from under the cursor. | Drive a full build with zero mouse events and assert the source. Separately: start a drag, force a re-fit, assert the wire still tracks. |
| **P4** | New: `readRenderedX`, `afterNextRender`, `verifyOrRollback`. Reuses `undo`. | ~2 d | The verify pass races a second user gesture. | Gate input during verification (~650ms) behind a subtle busy state. Test: fire `[` twice in 200ms, assert exactly one undo entry. |

### The drive-by bug, exact

`renameNodeById` at **line 28908** of v1.48.2 calls `requestRename(node.label || node.id, value => { … })` with no third argument, so it falls through to the diagram defaults at lines 20444–20447 (`'Rename diagram'`, `'Diagram name'`, `'Rename'`). Add the options object:

```js
requestRename(node.label || node.id, value => { /* unchanged */ }, {
  title: 'Rename block',
  label: 'Block name',
  hint: 'Up to 60 characters.',
  confirmText: 'Rename block'
});
```

Ten minutes, and it goes in Phase 1 whether or not anything else does. In Phase 1 the double-click path is replaced by the in-place editor anyway, but `renameNodeById` stays reachable from the panel and should stop calling a block a diagram.

---

## 8. DO NOT BUILD

**Made unnecessary by auto-layout — building them would give away the zero-tidying advantage:**

1. **Free positioning / drag a box anywhere.** Requires stored coordinates. Kills auto-layout. This is the whole product.
2. **Alignment and distribution tools** (align left, distribute vertically, "tidy up"). draw.io needs ~16 of these per diagram. Dagre has already done it, exactly, every time.
3. **Manual resize handles.** Mermaid grows a node to fit its label. draw.io's fixed 80×80 diamonds that clip their own text are the thing SIREN already beats.
4. **Waypoint dragging on connectors as a *layout* tool.** `edgeRoutes` exists and stays in the panel for the rare deliberate route; it must never become the way people fix a crossing, because dagre re-derives the crossing on the next edit and the waypoints then fight it.
5. **A grid, snap-to-grid, rulers, guides.** All of them presuppose coordinates.
6. **Z-order / bring-to-front.** No overlap to resolve.

**Requires coordinates — impossible without abandoning Mermaid as the source of truth:**

7. **Marquee / rubber-band selection.** Selection by screen region has no model meaning. Use `Ctrl+click` and "select this branch".
8. **Freeform connector routing** (orthogonal / curved / elbow as a per-edge choice). Dagre owns routing.
9. **Sticky notes, floating text, images placed on the canvas.** No Mermaid node type holds them; they would live only in a sidecar and desync from the source on the first external edit.
10. **Swimlanes as draggable containers.** Subgraphs are membership, not geometry. Membership is already editable.

**Deliberately deferred, not forbidden:**

11. **Multi-block drag.** Dragging a selection of five onto a connector has no single correct splice. Revisit only if asked for.
12. **Copy / paste a subtree.** Real value, but it is a model operation and belongs with the panel's bulk tools, not with the canvas gestures.

---

## 9. The measured comparison

**Benchmark:** the purchase-to-pay flowchart — 11 blocks, 12 connectors, 1 subgraph, 141 characters of labels.
**Insert edit:** add "Second review" between "PO issued" and "Goods received" — 13 characters.

Label characters are constant across every tool and are listed separately. A **mouse action** is one press→release; hover is free. A **structural key** is Enter/Esc/Tab/a shortcut.

### Building the benchmark

| | mouse | structural keys | label chars | **tidying** | source |
|---|---|---|---|---|---|
| draw.io | 41 | 33 | 141 | **~16, still not clean** | brief, inherited |
| **SIREN today** (form panel) | **~85** | — | 141 | **0** | derived from the shipped controls: 11 × (label + Add) + 12 × (from-select + to-select + label + Add) + group |
| **Phase 1** | **16** | **13** | 141 | **0** | reconstructed from my per-gesture measurements: 1 seed + 10 grows + 2 joins + 3 group-clicks |
| Phase 2 | 16 | 13 | 141 | 0 | unchanged — P2 adds correctness, not speed |
| Phase 3 (keyboard-only) | **0** | ~31 | 141 | 0 | quiet's measured grammar; I measured 0 mouse / 4 keys for a 3-node chain |
| Phase 4 | 16 | 13 | 141 | 0 | unchanged |

My per-gesture costs, each measured directly: seed **1 mouse + 1 key**; grow **1 mouse + 1 key**; join **1 mouse + 0 keys**; insert **1 mouse + 1 key**. Summing them reproduces **16 / 13** independently — and two judges reproduced the same 16 / 13 by driving the full build.

### The insert edit

| | mouse | structural keys | label chars | tidying | source |
|---|---|---|---|---|---|
| draw.io | 1 | 0 | 13 | 0 | drag from palette onto the connector |
| **SIREN today** | **~15** | — | 13 | 0 | add block (2) + delete the old connector (2) + build two connectors (5 each + label) |
| **Phase 1** | **1** | **1** | **13** | **0** | **measured: mouse 3→4, keys 3→4, chars 38→51** |
| Phase 1 (keyboard) | 1 | 2 | 13 | 0 | measured in the quiet prototype: select + `Ctrl+Enter` |
| Phase 3 (keyboard-only) | **0** | 2–6 | 13 | 0 | navigation keys replace the selecting click; cost grows with graph diameter |

**Phase 1 reaches parity with draw.io on the edit that matters most, and keeps the zero in the tidying column.**

---

## 10. The single weakest thing about this recommendation

Every count above is an *authoring* count. The audit job is mostly **editing someone else's 40-node diagram**, and no one has benchmarked that — not me, not the three prototypes, not the judges. The one honest signal is the quiet author's own: navigating from one block to another cost 5 keystrokes against 1 click in an 11-node graph, and that gap widens with graph diameter.

The hover ring is O(1) at any size, which is why it wins here. But two things about Phase 1 remain untested at scale, and I will not assert them: whether the ring stays reachable when the diagram is taller than the window (judge 2 measured one handle parking below the fold on a 1440×900 laptop, rescued by the keyboard), and whether hover-to-reveal stays pleasant when blocks are 40px apart.

**The test to run before Phase 2 is not another build benchmark. It is a restructure benchmark on a real 40-node audit diagram** — insert four steps, re-label six connectors, move one branch — driven with real input on a 1440×900 window. If the ring survives that, the rest of the plan is safe.
