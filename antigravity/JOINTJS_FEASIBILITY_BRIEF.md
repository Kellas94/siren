# Can a diagramming library live inside this file? — a procedure

This is a procedure, not a brief. Follow it in order. The measuring is already written; your work is
to run it, look at what comes back, and write it down.

**One question, and it has a yes or no answer:** can `@joint/core` be inlined into a single-file HTML
application with a default-deny CSP and no build step, and still work with no network at all?

Nobody needs an opinion on whether adopting it is a good idea. That decision is taken elsewhere and
waits on this answer.

---

## STEP 0 — what you may and may not touch

**You may write only inside `C:\Claude\SIREN\antigravity\jointjs_spike\`.**

Never write to `C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html`, never to anything under
`C:\Claude\SIREN\codex\`, never to the application. Another engineer is working in those files.

## STEP 1 — get the library

```
cd C:\Claude\SIREN\antigravity\jointjs_spike
curl -o joint.min.js https://cdn.jsdelivr.net/npm/@joint/core/dist/joint.min.js
```

**Calibration.** `@joint/core` is **468,240 bytes minified, 139,051 gzipped, zero dependencies**. If
what you downloaded differs materially from 468 KB, stop and say so — either the package changed or
you have the wrong file, and both matter more than anything else in this document.

If the file you get is an ES module rather than a plain script, **say which file you used**. That
difference alone decides whether it can be inlined, so do not paper over it.

## STEP 2 — build the page

```
copy page.template.html page.html
```

Open `page.html`. Find these two lines:

```
<script id="embedded-library">
/* PASTE THE LIBRARY HERE */
</script>
```

Replace the comment with the entire contents of `joint.min.js`. **Change nothing else in the file.**
In particular do not touch the `<meta http-equiv="Content-Security-Policy">` at the top — that is
SIREN's exact policy, and if the library cannot run under it, that is the finding.

## STEP 3 — run it

```
node run_spike.js
```

That is the whole measurement. It prints every answer the report needs. It blocks **every** external
request at the browser, so "does it reach the internet" is answered by construction, not by trust.

It also writes `spike.png`. **Open that image and look at it before you write anything.** A run can
report eleven green steps over a blank canvas.

**Sanity check on the harness itself:** run it once *before* pasting the library. It must say
`library global found: NO` and mark all eleven steps `NOT REACHED`. If it reports success with no
library present, the harness is broken and nothing after it means anything.

## STEP 4 — fill in this table

One line each, from what `run_spike.js` printed. Not from expectation.

| # | question | your answer |
|---|---|---|
| 1 | Does it run under that CSP at all? If blocked, the exact directive and error. | |
| 2 | Does it need `eval` or `new Function`? Both the static scan and whether any step threw. | |
| 3 | Does it need `blob:`, a worker, or dynamic `import()`? | |
| 4 | Any external request attempted? List every URL, including the ones that failed. | |
| 5 | Real inlined size, and the page's total size. | |
| 6 | Each of the seven interactions: worked / failed / partly, with what you saw. | |
| 7 | The SVG shape it produces — see STEP 5. | |
| 8 | Load-to-finished time, with the library and without it. | |

## STEP 5 — the question that decides the cost, and it is not a feature

Every export in SIREN — PDF, PowerPoint, Excel, SVG, PNG — comes from **one function that walks
Mermaid's rendered SVG**, reading `getBBox()` and `getScreenCTM()` off `g.node` groups and edge paths.
A library that draws its own SVG produces a different shape.

The harness reports that shape for you under `svgShape`: the node element's tag, classes, transform,
child tags, bounding box, and whether text is inside it.

**Answer one question from what it printed:** could a walker of that kind recover node geometry and
text from this DOM, or would an export have to be written from the library's own model instead? Say
which of the two, and quote the structure you saw. You are not being asked to build the export.

## STEP 6 — the licence audit

In plain words: **what exactly must a commercially sold single HTML file contain to use this library
legally?** Read the licence text itself, not a summary of it.

State:

- what notice the file must carry, and where a person would find it;
- what changes if we modify the library's own files;
- whether anything changes because the file is handed to clients rather than served from a website;
- **the boundary between `@joint/core` and `JointJS+`.** The plus product is commercial, and their
  documentation and examples mix the two, so a paid feature can be adopted by accident. List which
  imports and namespaces are core and which are not, precisely enough that a check could be
  automated later.

Two libraries are already eliminated on licence grounds. Do not spend time on them: **tldraw**
requires a paid licence key in production, and **bpmn-js / diagram-js** carry a watermark their
licence forbids removing or obscuring.

## STEP 7 — write the report

`C:\Claude\SIREN\antigravity\jointjs_spike\JOINTJS_FEASIBILITY.md`

That exact path. A previous job wrote its report somewhere else and it took a search to find.

Structure:

1. **The verdict, in one sentence**, as the first line.
2. The eight answers from STEP 4, each with its evidence.
3. The SVG-shape finding from STEP 5.
4. The licence audit from STEP 6.
5. **What you could not establish.** This section must not be empty. It is read first after the
   verdict.

---

## What not to do

Do not modify the application. Do not design the feature. Do not recommend whether to adopt it. Do
not build a prototype of SIREN's builder. Do not compare against other libraries beyond a sentence
if you happen to learn something decisive.

Do not relax the CSP to make something work. **If the answer is that this cannot run under that
policy, that is the most valuable outcome of the spike** and it belongs on the first line of your
report.

## Two things that have gone wrong before, here, in this exact kind of work

**A tool that ran for two seconds was reported as a result.** A coverage run that clicked Export and
immediately closed the dialog reported the entire export subsystem as unreachable. If a measurement
looks surprising, check whether the instrument reached the state it claims to describe.

**A report was written to a path nobody agreed on.** Use the path in STEP 7.

And the rule underneath both: **before reporting that something does not work, show something
comparable that does, in the same run.** The harness gives you that for free — if every one of the
eleven steps fails, suspect the harness before the library.
