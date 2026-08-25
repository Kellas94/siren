# Can a moved node take its connectors with it? — a procedure

One question, measurable in an afternoon. It decides whether a whole direction is worth starting.

**If a node is moved after Mermaid has drawn it, can the connectors attached to it be made to
follow, so the picture stays coherent?**

You are not designing a feature. You are not writing a patch to the application. You answer one
question with evidence.

---

## What is already known — do not re-derive it

The first half of this spike is done and its harness is in your folder. Run it once to see for
yourself, but the answer is settled:

```
node run_nodespike.js
```

Measured on the shipped application: translating one node by (180, −60) leaves **0 of 12** edge
endpoints moved, and edges still touching a node fall from **12 to 6**. The positive control passes
— all 12 edges touch a node at both ends before the move — so the measurement is real.

Looked at, not only counted: the picture is **wrong but not grotesque**. The diagram stays readable
and the arrows simply end in mid-air. It reads as a bug, not as garbage. That distinction matters
for what you are about to try.

## The machinery that already exists, and the one step it is missing

SIREN already rewrites connector paths after Mermaid has drawn them:

```js
function routePathD(endpoints, points) {
  const absolute = (points||[]).map(point => absoluteWaypoint(point, endpoints));
  return `M${endpoints.sx},${endpoints.sy}` + absolute.map(p => ` L${p.x},${p.y}`).join('') + ` L${endpoints.tx},${endpoints.ty}`;
}

function applyRouteToPath(path, points) {
  const endpoints = pathEndpointsFromD(path.getAttribute('d') || '');
  if (!endpoints) return;
  path.setAttribute('d', routePathD(endpoints, points));
}
```

Read that carefully, because it is the whole point of this job. The function **takes the endpoints as
an argument** and then re-derives them from the path it is about to rewrite — so it always puts them
back where they were. It inserts waypoints *between* two fixed ends.

**Nobody has ever passed it different ends.** That is the one step between what ships today and a
node that takes its connectors with it.

## What to try

Work in `C:\Claude\SIREN\antigravity\nodeoffset_spike\` only. **Never write to the application**, to
anything in `C:\Claude\SIREN\codex\`, or to the file in Downloads. Copy what you need.

1. Render the flowchart the harness uses. Note which edges start or end at the node you will move.
2. Move that node, exactly as the harness does — a `translate` appended to its `transform`.
3. **For each attached edge, recompute the endpoint** that belongs to the moved node: the point where
   the connector should now meet its box. Then rewrite the path's `d` with the new endpoints, using
   the same shape `routePathD` produces.
4. Measure again with the same test the harness uses: how many edges touch a node at both ends now?
5. **Look at the screenshot.** A coherent set of numbers over an ugly picture is still a failure.

## Five things that will probably go wrong, and each is a finding

Report each one as worked / broke / did not reach it. A "broke" here is worth more than a "worked".

- **Arrowheads.** They are SVG markers on the path, so they should follow and rotate. Confirm they
  do, and that they point the right way after the endpoint moves.
- **Edge labels.** The "yes" and "no" captions are separate elements positioned absolutely. They
  almost certainly stay where they were. Say whether they did and how wrong it looks.
- **Curves.** Mermaid draws curves, `routePathD` writes straight `L` segments. Rewriting a curved
  edge as a polyline changes its character. Say how visible that is.
- **Which point on the box.** An edge should meet the border, not the centre. Say what you used and
  whether it looks right for edges arriving from different directions.
- **Self-loops and edges between two moved nodes.** If you have time, move two nodes and report.

## The question that decides the whole direction

**Does the offset survive a re-render?**

Change the source text — add a block at the end — and let Mermaid redraw. Then reapply the offset and
the edge rewrite.

A prototype in this project already established the principle for connector waypoints: **relative
offsets survive a later edit and absolute points do not**. Confirm or refute that for node offsets.
Report which you tested and what happened, in coordinates.

If the offset does not survive an edit, this direction is a toy, and saying so plainly is the most
valuable outcome of the job.

## What to hand back

`C:\Claude\SIREN\antigravity\nodeoffset_spike\NODEOFFSET.md` — that exact path.

1. **The verdict in one sentence**, first line: can the connectors be made to follow, yes or no.
2. Your numbers before and after, using the harness's own measurement.
3. The five gotchas, one line each.
4. The re-render answer, with coordinates.
5. **What you could not establish.** Not empty. It is read first after the verdict.

Include your screenshots. If the picture after the rewrite is still wrong, that image is the most
useful thing in the report.

## What not to do

Do not modify the application. Do not build the feature. Do not propose a data model. Do not
recommend whether to adopt this. Do not relax anything to make a number look better.

And before reporting that something does not work, show something comparable that does, in the same
run. The harness gives you that for free: its positive control is 12 of 12 edges attached before any
move. If that control ever fails, suspect the harness before the application.
