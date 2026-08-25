# SIREN Round 12 — a document that cannot phone home, and a red button that means it

Read `ROUND8_METHOD.md` first; the method is unchanged.

**The base is the shipped 1.70.0** — `codex/FROZEN_R11_BASE.html`, 8,591,186 bytes,
SHA-256 `2F2DA0BDA18427E3262EB97D06401723183D1938A09083654C64AFE791223030`. The same file round 11
was built on.

This round runs **in parallel with round 11's verification**, which is deliberate and was measured
before it was asked for. Round 11's diff is 32 regions and lands in the tour, the Docs list and
reference chips, the SVG document marker, the pan handler and the workpapers open call. Every anchor
this round needs is byte-identical between 1.70.0 and the round 11 build:

| anchor | 1.70.0 | round 11 |
|---|---:|---:|
| `requestConfirmation(` | 46 | 46 |
| `confirmActionButton` | 8 | 8 |
| `classList.remove('danger')` | 1 | 1 |
| `Content-Security-Policy` | 1 | 1 |
| `CDN_MERMAID_SOURCES` | 3 | 3 |
| `layout-elk` import | 2 | 2 |

So pin to 1.70.0 and **expect one rebase** when round 11 ships. If any anchor here moves under you,
that is a finding worth its own paragraph.

Three jobs. The first two are the same thing from opposite ends — what the document is *permitted*
to do, and what a control *promises* it will do. The third is about the instrument that measures
both.

---

## BB — a mode in which the file cannot reach the internet, and says so

**Rank 1.** The owner is a KPMG auditor. This file gets opened with a client's material inside it.
"Can this document phone home?" is not a feature question for that person — it is the question that
decides whether the file may be opened at all.

**What is true today, measured on the shipped 1.70.0 rather than reasoned about.** The
Content-Security-Policy is a `<meta>` tag reading:

```
default-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com;
style-src 'unsafe-inline'; img-src data: blob:; connect-src 'self' blob:
https://cdn.jsdelivr.net https://unpkg.com; font-src data:; worker-src blob:;
base-uri 'none'; form-action 'none';
```

Driven with a request log attached, through boot, typing a diagram, changing theme, opening Docs and
opening the export dialog: **zero external requests**. The only thing that reaches out is the ELK
layout engine, and only when it is chosen — three GETs to jsdelivr, from a dynamic
`import('https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.1.7/...')`.

**Two findings worth having before you start.**

1. **`unpkg.com` is granted and never used.** It sits in `CDN_MERMAID_SOURCES` beside a jsdelivr
   entry, as a fallback for fetching Mermaid — which has been embedded in the file since 1.51.0. A
   permission with no purpose is the cheapest thing on this list to remove, and it must be removed
   by proving it is unused, not by assuming it.
2. **`mermaidSources()` returns the CDNs *first*** unless `preferLocalMermaid()` is true (`?offline=1`
   or a remembered success). Anyone who does drop a `mermaid.min.js` beside the HTML must keep
   working; that path is not what this job removes.

**Done means**: a mode a person can turn on, which removes the grant rather than merely declining to
use it, and says so where they can see it. Specifically —

- With the mode on, the effective policy no longer permits either host. Prove it by attempting the
  ELK import with the mode on and reading the CSP violation, not by observing that nothing happened.
- The app says which state it is in, in words, on screen — the review's own phrasing is a fair
  target: "No external requests. Full local renderer available."
- With the mode on, choosing ELK **fails honestly**: it says it cannot be fetched in this mode and
  the diagram keeps the layout it had. It does not silently fall back and it does not leave the
  engine label claiming something it cannot do.
- With the mode off, everything behaves as it does today, including ELK.
- Whatever the default is, the label already on the engine — "ELK · online · dense diagrams", plus
  the ~500 KB disclosure before you choose it — stays true.

**The trap that decides this job.** A `<meta>` CSP cannot be *relaxed* at runtime, and cannot be
usefully rewritten after parse. It **can** be intersected: a second policy, added before anything
loads, applies alongside the first and the strictest wins. So an offline mode that injects a second,
stricter policy at the top of the document works; one that edits the existing meta's `content` does
not, and will measure as working in a probe that only checks the attribute rather than the behaviour.
Read the violation, not the string.

**Not in this job**: removing jsdelivr outright. ELK is a real feature somebody chose to offer, and
this is about permission and disclosure, not about deleting it.

---

## BC — a red button on a choice that loses nothing

**A red button is a promise that something will be destroyed.** Where nothing is destroyed, it is
the standing rule broken with a colour instead of a sentence — and it teaches people to ignore red
on the day it matters.

`requestConfirmation({ title, message, confirmText, action })` has **46 callers**. The confirm button
carries `class="btn danger"` in the markup and nothing ever takes it off for a confirmation. Several
callers say in their own message that nothing is lost:

| what it asks | what its own message says |
|---|---|
| `Start a Pie chart?` | "This replaces the current Mermaid source. **A snapshot of the current diagram is saved first.**" |
| `Delete <folder>?` | "N diagrams will be moved to Unfiled. **No diagram will be deleted.**" |
| `Delete line 4?` | "This line holds the diagram together. Delete it anyway? **Undo restores it.**" |
| `Move lines to do this?` | a reorder |
| `Rewrite the Mermaid code?` | a rewrite the app offers, undoable |

**The app already has half of this.** `requestNotice()` — the same dialog with one button, for a
gesture that must refuse — explicitly does `el.confirmActionButton.classList.remove('danger')` and
hides Cancel. What has no shape is the middle case: a real choice, with a real Cancel, that destroys
nothing.

**Done means**: `requestConfirmation` accepts a way for the caller to state that the action destroys
nothing; the button is not red in that case and is red in every other; and all 46 call sites are
classified. Measured, not asserted: open each of a named sample with a real gesture and read the
computed colour of the confirm button against the destructive and non-destructive palettes.

**Three ways to get this wrong.**

1. **Classifying by the word "Delete".** `Delete <folder>?` deletes no diagram — it says so itself.
   The message is the evidence, not the title.
2. **Making it a global toggle.** If a caller does not say, it stays red. The safe default is the
   loud one.
3. **Breaking the notice interleaving.** `closeConfirmDialog()` puts `danger` *back* when it closes a
   notice. A new toggle that does not account for that will leave the class in whatever state the
   previous dialog left it — which is exactly the kind of defect that passes every check run in
   isolation and fails the second time a person opens a dialog.

---

## BD — the gate's permanently red assertions, which have stopped meaning anything

**This job is yours because you found it, three rounds running, and each time the brief told you not
to touch the shared gate. That was the wrong call and I am reversing it.**

A permanently red assertion is not a test. It is noise that trains everyone to skim past the
instrument, and it has already cost this project something concrete: the app's loudest export
promise — *every linked diagram as a picture* — has had **no working check** since the Word export
became a real `.docx`, because the suite asks for the wrong filename.

**The five you reported after round 11, with what you said about each:**

| assertion | what is actually wrong |
|---|---|
| `R2.ITEM3.NARROW` | six assertions target hidden desktop `#commentsButton` / `#reviewButton`; the current 375px route is `#mobileMoreButton`, and the same scenario's own Compare checks already read its ordered rows |
| `EXPORT.MAIN` | clicks a hidden `#styleShortcutButton` directly instead of opening the current Inspect route, and times out before any export is attempted |
| `R3.SURFACE.CENSUS` | expects header/preview-head counts of 4/3; live 1.70.0 is 5/0 |
| `R3.EXPORT.DOCX` | Word COM cannot create its application in an isolated session: `0x80070520` |
| `R3.EXPORT.PPTX` | the same, for PowerPoint |

**And one more that predates all of them**, and is the reason this job is ranked where it is:
`qa/run_regression_suite.js:2111` saves the Word export as `active-doc.doc`, and
`qa/validate_regression_exports.py:284` sends `.doc` to an HTML text parser. The word `docx` appears
**once** in that validator. Confirmed still true on this base.

**Done means**: every assertion in the shared gate either measures something true about the app as it
is now, or is removed with a sentence saying why. Specifically —

- The narrow-viewport assertions go through the route a person actually has at 375px.
- `EXPORT.MAIN` opens the export the way the app now offers it, and actually reaches an export.
- The census expectations match the live counts, and are written so that adding a control does not
  silently turn the gate red for a correct app.
- The Word path asks for `.docx` and validates it as a real OOXML package, not as HTML.
- The two COM scenarios are marked as environmental and **skipped with a stated reason** rather than
  counted as failures — an environment that cannot run them is not a defect in the app.

**Two ways to get this wrong.**

1. **Repinning an expectation to whatever the app currently prints.** That converts a stale test into
   a tautology. Pin to the contract — "the narrow route offers Review, Comments and Compare, in that
   order" — not to today's string.
2. **Deleting a red assertion because it is inconvenient.** Every removal needs a sentence saying
   what it used to protect and why that no longer needs protecting. If you cannot write that
   sentence, the assertion stays and the app gets fixed instead.

**This job touches zero application bytes.** Keep it in its own script, say so in the handback, and
it carries no rebase risk when round 11 ships.

---

## Method notes carried forward

- Test one step sideways from your own fixture, every time. A check that finds nothing on both the
  patched build and the base has established nothing — say so rather than counting it green.
- Where a job is about what a person sees, render it and look.
- Do not write a probe regex with a single backslash inside a JS template literal. It collapses, so
  `/\s+/` becomes `/s+/` and eats the letter s out of your own output.
- One SHA-pinned script per job, an `APPLY_ORDER.md` with every input and output hash, and a handback
  saying what you did **and** what you did not.
- Do not touch `APP_VERSION`, `CHANGELOG` or — except as BB's whole subject — the CSP.

## The standing rule

Nothing in this app may promise what it cannot deliver. A tooltip, a chip, a count, a menu label, a
disabled state or a colour that overstates is a defect of the same kind as a crash. If a job cannot
be done honestly as briefed, say so and deliver the rest.
