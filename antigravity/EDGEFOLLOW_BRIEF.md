# Spike: make the connectors follow a moved node, and make the picture right

You did the first two spikes on this. They established two things, and both were worth having:

1. A naive translation puts an endpoint at the same *relative* point on the moved box, so an edge
   crosses straight through the node it belongs to. Casting a ray to the box border fixes that —
   endpoints landing inside the box went **4 → 0**.
2. Then the picture was looked at and it was still wrong. "Raise order" had **no incoming edge at
   all**, both branches out of the decision arrived at "Return to requester", and two arrowheads
   pointed at nothing.

The cause was not the maths. Edges were matched to the moved node **by geometric proximity**, and a
tolerance wide enough to catch a node's own edges is wide enough to catch its neighbours'.

**This spike is that problem, solved.** Not the feature — the spike.

---

## The foothold, already measured for you

You do not have to discover this. It was measured on the current build on 25 August and here is the
result, exactly:

An edge's path element carries **both of its endpoints in its DOM id**:

```
id="t_flow_1787644598180_4-L_A_B_0"
                          └──┬──┘
                    L_<from>_<to>_<index>
```

Six edges in the test flowchart, six identifiable, zero geometry involved:

```
L_A_B_0   L_B_C_0   L_B_D_0   L_C_E_0   L_D_A_0   L_E_F_0
```

Nodes carry their id the same way:

```
id="t_flow_1787644598180_4-flowchart-B-1"
                            └───┬────┘
                       flowchart-<id>-<seq>
```

So "which edges belong to node B" is a **string match**, not a distance test: any path whose id
matches `L_B_*` or `L_*_B_*`. That is the finding from last time, made actionable.

**One trap, and it already caught a probe.** SIREN adds an invisible wider `.t-edge-hitarea` path
beside every connector so it is easier to click. Those have **no id**. A first run of the probe
counted them and reported "6 of 12 identifiable", which looked like a finding and was a filter
mistake. Filter them out:

```js
Array.from(svg.querySelectorAll('g.edgePaths path, path.flowchart-link'))
  .filter(p => !p.classList.contains('t-edge-hitarea'))
```

**Edge labels are movable.** The "yes" and "no" captions are `<g class="edgeLabel">` elements
positioned by `transform="translate(98.6171875, 292.71875)"`. Last time you reported they broke
because they are separate elements. They are — but they are separate elements with a transform you
can write to.

---

## What to build

Work in `C:\Claude\SIREN\antigravity\edgefollow_spike\` only. **Never write to the application**, to
anything in `C:\Claude\SIREN\codex\`, or to the file in Downloads. Copy what you need. The build to
test against will be named in the prompt.

Start from your own `run_intersect.js` — the border-intersection maths in it is correct and should be
kept. Replace only how edges are chosen.

1. Render the flowchart. Build a map from node id to the edges that touch it, **from the path ids**.
2. Move one node by appending `translate(dx, dy)` to its `transform`, as before.
3. For every edge in that node's list, recompute **only the endpoint that belongs to the moved
   node**, meeting the box border, exactly as your border maths already does.
4. Move the edge's label with it, if it has one.
5. Measure, then **look at the screenshot**.

## The metric has to change too

Last time the metric said **12 of 12 edges attached** on a drawing with a missing connector. A line
from the decision to the wrong box touches nodes at both ends; the metric could not tell a correct
edge from a misrouted one. It is a check that a wrong answer can satisfy.

Your metric must assert **which** nodes each edge joins:

> For every edge id `L_X_Y_n`, the path's start point lies on node X's box border and its end point
> lies on node Y's box border.

Report it as a table of six rows, one per edge, each naming X and Y and whether both ends landed.
A number alone is not enough here — the last one lied.

## Four things that will probably break, and each is a finding

Report each as worked / broke / did not reach it. A "broke" is worth more than a "worked".

- **Curves.** Mermaid draws beziers; rewriting the whole path as straight `L` segments turned the
  moved edges into rigid polylines that clashed with the untouched ones. Try keeping the curve:
  move the endpoint **and the control point next to it**, leaving the rest of the `d` alone. Say
  whether that preserves the character.
- **Labels.** Now that you can write their transform — where should the label go? The midpoint of
  the new path is the obvious answer. Say whether it looks right, especially on the two branches out
  of the decision.
- **Both ends moved.** Move two nodes that are joined to each other. Both endpoints of that edge
  need recomputing against two different boxes.
- **Self-loops.** `D --> A` and a node connected back to itself. Say what happens.

## The question that decides the direction, again

**Does it survive a re-render?** You answered this once — relative offsets survive, absolute do not —
and that answer stands. What is NOT established is whether the *edge rewrite* survives. Add a block
to the source, let Mermaid redraw, reapply the offset, and reapply the edge rewrite. Report in
coordinates whether the picture comes back correct or has to be rebuilt from scratch.

## And one number nobody has

You listed performance as something you could not establish. Get it now: with a diagram of about
**forty blocks**, how long does one full "move node + rewrite its edges" cycle take, in
milliseconds? Report the median over at least twenty cycles. If it is over 16 ms it cannot run on
every mouse-move and the design has to change — that is a real finding, not a failure.

## What to hand back

`C:\Claude\SIREN\antigravity\edgefollow_spike\EDGEFOLLOW.md` — that exact path.

1. **The verdict in one sentence, first line.** Does the picture come out right, yes or no.
2. The six-row edge table.
3. The four breakages, one line each.
4. The re-render answer, in coordinates.
5. The 40-block timing, with the median.
6. **What you could not establish.** Not empty. It is read first after the verdict.

Include your screenshots. **If the picture is still wrong, that image is the most valuable thing in
the report** — last time it was.

## What not to do

Do not modify the application. Do not build the feature. Do not propose a data model. Do not
recommend whether to adopt this. Do not relax a check to make a number look better.

And before reporting that something does not work, show something comparable that does, in the same
run. Your harness gives you that free: its positive control is every edge correctly attached before
any move. **If that control ever fails, suspect the harness before the application.**
