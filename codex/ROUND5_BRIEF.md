# Round 5 — twelve jobs: five that break or lie, one regression of yours, six defects

Round 4 is merged and live. Your five patches plus your own corrective follow-up applied to the
owner's file with **every hash matching on the first run**, and the app shipped as **v1.66.0**.

I verified the shipped bytes rather than the artefact you sent: Job A **48/48 scenarios, 475/475
assertions**; your new targeted suite **5/5 and 95/95**; my six probe suites clean; the app boots at
1.66.0 with zero exceptions. I also re-measured your headline numbers myself and they hold —
collapsed row 318/318, expanded 318/1027, maxScroll 709, wheel 1 → 246 with `defaultPrevented`,
fifteen chips, rail 34 px with one `aria-current`.

**You corrected me twice and you were right both times.** Docs' "Contents" is generic and driven by
heading count, not document type — I re-measured on a plain note in the shipped build: one, two and
three headings give a zero-width button; **four gives 89 px**. My original sample compared a
one-block note against a fifteen-block agent spec, so document type and heading count moved
together. And ten shapes were missing from the canvas, not nine: `NODE_SHAPES` has fourteen entries
and `note` is not one of them. Keep doing that.

## The base

- **`FROZEN_1_66_0.html`** — 8,438,995 bytes, SHA-256
  `B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`
  (also in `FROZEN_1_66_0.sha256`). Byte-for-byte the file the owner is using.

House rules unchanged: `BRIEF_ROUND3.md`. Anchor-guarded patches, pinned input and exact output
SHAs, every anchor you had to move named, the Job A gate re-run against your final build with the
report JSON, and anything the suite flags that is mine rather than yours.

**A note on my measurements below.** Two of these twelve jobs I have never reproduced myself — they
are *your* findings from round 3, repeated back to you. I have marked which. Where I do give
numbers, treat them the way you treated the last two: check them, and tell me if I am wrong.

---

# Job K — the canvas deletes a note that was hanging off a block

**Your finding, round 3. I have not reproduced it and I am not going to pretend otherwise.** What you
reported: deleting a host block on the drawing canvas also removes a note that was hung from it,
without saying so.

If that is right, it breaks the owner's first rule — the app never silently loses what someone
wrote. A note is writing.

Establish first, with measurements, what actually happens today: does the note vanish from the
source text, from the render, or both; does Undo bring it back; is anything said; and does the same
happen through the keyboard Delete path and through the right-click "Delete block" row.

Then decide what *should* happen and defend it. The house pattern for this class of thing is
already in the app and is worth following: `canvasDeleteAndHeal` refuses out loud when a delete
would lose a path, naming what would be lost. A note is smaller than a path but the principle is
the same — either carry it somewhere sensible, or refuse and say what would go.

# Job L — Docs revision restore hands focus to a hidden button

**Also your finding, round 3, also not reproduced by me.** Restoring a revision in Docs returns
keyboard focus to a control that is no longer visible.

Measure the exact path first: which control, which restore route, what `document.activeElement` is
afterwards and whether it passes `checkVisibility()`. Then put focus somewhere a person can see and
use. Say which element you chose and why that one.

# Job M — the zoom control says one thing and does another

Its tooltip and the guided tour both say it fits the whole diagram. The code calls a fit-to-width
path. On a tall chart the click therefore appears to do nothing at all, because the width was
already right.

Measure it: find the control, the handler, and the tour text; then measure the rendered result on a
deliberately tall diagram — the SVG box before and after, and whether the whole diagram is inside
the viewport.

Then make them agree. Either the control does what it says, or it says what it does — but decide
which, and say why. If you make it fit the whole diagram, check what that does to a very wide
diagram and to the minimap, and say so.

# Job N — the welcome tour follows you into Docs and points at nothing

**Measured by me on the shipped build, so this one you can check against a number.** Open Docs while
the first-run tour is showing and card 1 of 6 stays on screen at **300×163**, sitting on top of the
Docs sidebar, still explaining a Visual / Code switch that is no longer on screen. Only a first-time
user ever sees it — which is exactly who it misleads.

I also checked something that looked like a second bug and was not: the Visual/Code switch itself
does correctly disappear when Docs opens; a screenshot caught it mid-transition. Do not "fix" that.

Decide what the tour should do when the person leaves the surface it is describing — follow them
with relevant cards, pause, or close with a way back — and say what you chose.

# Job O — two small Docs defects that were disclosed and never fixed

Both were reported by an agent during the Docs repair and neither has been touched:

1. The read-only pill's **×** deletes a block. In a document that is meant to be read-only.
2. A `/` typed as the first character of an empty paragraph is swallowed when you press Escape —
   the inserter opens, Escape dismisses it, and the slash you typed does not come back.

Reproduce both, then fix them. The first is the more serious: a read-only surface that can destroy
content is not read-only.

---


## The gate these two must pass

I wrote it, because the reason both defects survived every existing check is that no assertion ever
asked *what kind of thing is inside the file*. A raster PDF is a perfectly valid PDF. A one-picture
PPTX is a perfectly valid PPTX. Structural validity was measured for months; kind was not.

**`qa_exportsun_export_fidelity.js`** — no dependencies beyond Playwright, reads the zip and PDF
containers itself.

```
node qa_exports/run_export_fidelity.js --app <build> --port 9931 --output <dir>
```

Baseline on shipped **1.66.0**: **25 assertions, 10 pass, 15 fail.** Your fix has to move those.

| type | PDF has text | PPTX shapes / pictures | XLSX native shapes |
|---|---|---|---|
| flowchart | **no** (0 fonts, 1 image) | 9 / 0 | 9 |
| mindmap | **no** (0 fonts, 1 image) | 4 / 0 | **0** |
| pie | **no** (0 fonts, 1 image) | **0 / 1** | **0** |
| gantt | **no** (0 fonts, 2 images) | **0 / 1** | **0** |
| sequence | **no** (0 fonts, 1 image) | **0 / 1** | **0** |

Three things this baseline corrects in what I told you above:

1. **The PDF is raster for every type, including flowchart.** Not a scale problem and not an
   exotic-type problem. Every diagram PDF this app produces is a picture.
2. **Mindmap splits the two writers**: its PowerPoint export makes 4 real shapes, its Excel export
   makes **none**. So the divide is not simply "types whose SVG has `g.node`" — the PPTX and XLSX
   paths disagree with each other on the same diagram. Find out why; that is probably the whole
   shape of the fix.
3. **The leaked "Flowchart Preview" is conditional**, not universal. With a real title set, all five
   types come out clean. It leaks when the default title is still in place — so it is a
   default-value problem, not an export-writer problem. Do not chase it in the writer.

The gate carries a `RASTER_EXEMPT` map, deliberately empty. A type may be exempted **only together
with UI text that tells the person this export is an image**, and the exemption must name that text.
An exemption without a disclosure is the exact defect this gate exists to catch, so please do not
quietly widen it.

---

# Job AC — the diagram PDF export is a picture, at every size

**Measured by me, three times, on the shipped 1.66.0.** `#exportPdfButton` produces a PDF with
**zero extractable text and zero embedded fonts** — a raster image on a page.

| diagram | pages | bytes | extractable text | embedded fonts |
|---|---|---|---|---|
| 3 blocks | 1 | 75,930 | **0** | **none** |
| 12 blocks | 2 | 492,638 | **0** | **none** |
| 30 blocks, 3 subgraphs | 4 | 1,301,187 | **0** | **none** |

It is not a scale problem. It is the path.

**The contrast that shows it is fixable:** the *deck* PDF export on the same application produces
real vector text — I measured 9 pages at 72,267 bytes with subset NotoSans, and the Romanian
diacritics extract correctly ("Ședință de deschidere", "Țară aprobată?"). So SIREN has two PDF
writers and only one of them makes a document.

What this costs the owner: a diagram PDF sent to a client cannot be searched or selected, its
Romanian diacritics are pixels rather than characters, it is unusable by a screen reader, and it is
roughly ten times the size it needs to be.

Note that the 1.65.0 changelog's PDF claims — compression, monospace and italic fidelity, native
gradients — were all measured on the **deck** path. Nobody had checked the plain diagram export.

**I traced it for you, so this is smaller than it sounds.** `#exportPdfButton` calls
`exportDiagram('pdf')`, which reaches **`buildRasterPdf(pages, pageWidth, pageHeight)`** (app.html
:83982) — a builder that writes one `/Type /XObject /Subtype /Image /ColorSpace /DeviceRGB` per
page. A bitmap, by design, not by accident. It has three call sites.

Meanwhile the vector writer is **already in the same file**: `buildDeckPdf` plus a complete
`deckPdf*` family — `deckPdfPathOps`, `deckPdfPolyOps`, `deckPdfEllipseOps`, `deckPdfArcToBeziers`,
`deckPdfColour`, `deckPdfNum`. That is what gives the deck real text.

So the job is not "write a vector PDF exporter". It is: **can the diagram export use the writer you
already built?** The likely obstacle is that the deck writer draws from the deck's own scene while
the diagram export has only a rendered SVG — but `collectDrawingFromSvg` already recovers shapes,
lines and text from exactly that SVG for the PowerPoint and Excel exports, so the geometry is
demonstrably recoverable. Establish whether that is enough, and say so plainly if it is not.

Then decide: route the diagram export through the vector writer, or say plainly in the UI that this
export is an image. As with AB, either
is defensible; shipping a picture silently is not.

**Smaller finding from the same run, same family:** the diagram title I set ("Ciclul de audit —
misiunea FY26") appears in the exported SVG but **not** in the PPTX or the XLSX. Check whether the
title is carried into those two at all.

---

# Job AB — "editable PowerPoint shapes" is a flat picture for three diagram types

**Confirmed by me, by unzipping the delivered files and counting the XML elements.** The app's own
changelog promises *"editable PowerPoint shapes"*. Measured:

| type | `<p:sp>` shapes | `<p:pic>` pictures | "Flowchart Preview" in the slide XML |
|---|---|---|---|
| mindmap | **7** | 0 | no |
| pie | **0** | **1** | **yes** |
| gantt | **0** | **1** | **yes** |
| sequence | **0** | **1** | **yes** |

A pie, a gantt and a sequence diagram export as **one flat raster image** on a single slide. Nothing
in them can be selected, moved or restyled. The same is reported for the Excel export of those types
(a picture instead of native shapes) — confirm that yourself; I verified the PowerPoint side only.

**Note the correlation, because it points at the cause:** the leaked default title
"Flowchart Preview" appears in the slide XML of exactly the three that fell back to a picture, and
not in the mindmap that produced real shapes. The raster fallback path appears to be the one writing
that title. Fixing one may fix the other; establish that rather than assuming it.

Why this outranks most of this round: these files go to **clients**. A deck where the chart cannot be
edited — and is headed "Flowchart Preview" over a Gantt — is a defect someone else notices first.

What to establish before fixing: which types take the shape path and which take the raster fallback,
and why. `collectDrawingFromSvg` walks `g.node` and the edge paths; pie, gantt and sequence SVGs
contain **no `g.node`**, while mindmap does. So the question is whether those types can be given a
real shape path, or whether the honest answer is to tell the person that this type exports as a
picture — and to stop promising otherwise in the changelog and the UI.

Either outcome is acceptable. Silently shipping a picture under a promise of editable shapes is not.

---

# Job R — the Guided shape chip destroys a kanban

**Destructive. Reproduced by an agent and confirmed by its verifier.**

Open a kanban, switch to Code, press Guided. A card's row carries a chip whose tooltip reads
verbatim *"Shape of this block. Click to change it."* It opens the 14-item **flowchart** shape menu
over a kanban card, and picking a shape **corrupts the source**.

The same editor's own row menu already knows better: it disables "Connect from here" with the
reason *"Connections are flowchart syntax; this diagram type is different."* So the knowledge is
present one menu away from the chip that ignores it.

Related, same root: on **Block** and **C4Context** the Guided rows **misquote the source before you
touch anything**. Block line 3 is `a["Inputs"] b["Processing"] c["Outputs"]` and the row renders it
as `a[Inputs"] b["Processing"] c["Outputs]`. C4 line 3 loses its closing quote. An editor that
displays code it has silently altered is a data-integrity defect, not a cosmetic one.

Fix the whole class: a Guided chip may only offer an edit that is valid for the detected type, and a
row must render the source it was given, byte for byte.

# Job S — the app says it styled a block when it did nothing

**It reports success for work it did not do.** Measured on a **gantt**: the Style card's block list
offers phantom targets (it lists non-blocks as blocks on many types). An agent selected "Planning",
set a red fill and pressed **Apply to block**. The app toasted:

> **"Style applied to block Planning."**

The source was byte-identical afterwards and the preview unchanged. The agent read the screenshot to
confirm nothing moved.

This is the worst class of defect in this product: it is not a missing feature, it is the app
telling the owner that his work was saved when it was not. Establish where the false success comes
from, then make it either do the thing or refuse out loud and name why.

While you are there: the Style card's `#nodeStyleTarget` list offers non-blocks as blocks to style —
on a Sequence it lists messages (Request, Response), on a Class it lists members (name, id). Report
what you find; fix it if it is the same root, and say so if it is not.

# Job T — the kanban status line tells you to do something that destroys your diagram

The visual builder's status line on a **kanban** reads verbatim:

> **"Advanced Mermaid mode: Add a flowchart declaration such as "flowchart TD" in code mode. The
> Mermaid code and preview were left unchanged. …"**

Following that instruction turns a kanban into a broken flowchart. The message is a generic
fallback being shown for a type it does not fit.

Audit the whole family of these status strings across every type and make each one either accurate
for that type or silent. Do not leave a generic instruction where a specific one is wrong.

---

# Job Q — the heading rail you shipped is painted on top of the document

This is a regression in your own Round 4 Job I, found by the owner within a day of shipping and
then measured by me. It is the highest-priority job in this round.

**What the owner sees:** the rail's marks land on top of his writing and on top of the row controls
in a Knowledge block - dashes drawn across text and over the "x" buttons.

**Measured at 1440x900 on the shipped v1.66.0, on an Agent spec with 15 blocks:**

| element | box |
|---|---|
| `nav.wp-heading-rail` | x 1372 -> 1406, w 34, `position: absolute`, `z-index: 7` |
| `#wpBlocks` (the content) | x 330 -> **1410** |
| every one of the 15 blocks | right edge at **1388** - i.e. 16 px inside the rail's column |

`blocksReachingUnderRail: 15 of 15`. The rail was given a column, but the content was never given
room for it, so the rail simply paints over whatever is there.

**Why your own test did not catch it, which is the part worth fixing properly:** your Job I and your
follow-up both measured the rail against the **viewport** - is the focused mark inside 812 px, does
End scroll it into view. Both were true. Nothing measured the rail against the **content**. The
assertion that was missing is the one that would have failed: *no block's right edge may cross the
rail's left edge.* Add that, not just a fix.

**What to build:** decide where the rail belongs and defend it - a reserved gutter outside the
content column, or right padding on the content while a rail exists, or the rail floating clear of
the text. Constraints: a document with no headings must lose nothing (no permanent empty gutter);
the fix must hold at 1280, 1440, 1728, 1920 and 375; and it must not fight the block right-click
menu, the row controls at the right edge of a Knowledge row, or the table column controls.

Check the same overlap on every document type, not only the Agent spec - the block widths differ.

---

# Job P — the window SIREN opens in says nothing about itself

Two defects in one small surface, both measured by me on the shipped build. This one is entirely
self-contained and touches nothing else in this round.

## P1 — the title never changes

`document.title` is assigned **zero times in the whole file**. The tab always reads
"T-Industries SIREN". The owner routinely has three copies open at once - the live file, a release
snapshot and a prototype - and cannot tell them apart in the tab strip.

The title should carry what the person is actually looking at. My opinion, marked as one: put the
specific part **first**, because a browser truncates a title at the end when the tab is narrow, so
"Diagram 1 - SIREN" stays distinguishable at a width where "SIREN - Diagram 1" does not. Measure
that rather than taking my word for it, and say what you chose.

Decide and defend: what it says with several diagrams open in one workspace, what it says in Docs,
in Present and in the deck builder, whether an unsaved change is signalled there, and what it says
before anything has been named.

**Do not confuse it with the export path.** There is a `<title>${esc(doc.ref)} · ${esc(doc.title)}</title>`
in the file already; that belongs to a *generated HTML export*, not to the application window.

## P2 — the icon in the tab is not the brand mark

`brand/BRAND_GUIDE.md` defines the symbol as **three horizontal rules, each ending in a different
terminal - a square, a circle, a diamond**, the same figure that replaces the E in the wordmark.

The favicon actually shipped is an inline `data:image/svg+xml` SVG: a white rounded square with
three rules whose terminals are **all squares**. It is a wrong or superseded version of the mark,
on a white tile, in a dark tab strip.

The brand pack already names which asset belongs at which size:

| use | asset |
|---|---|
| Favicon, 16-48 px | `brand/ico/favicon.ico` |
| App icon, 64 px + | `brand/svg/05_siren_app_icon_light.svg` / `06_siren_app_icon_dark.svg` |

The application embeds **none** of them - zero occurrences of any brand filename in the file.
There is also no `theme-color` and no `apple-touch-icon`.

Constraints that make this less trivial than it looks:

- Everything must be inlined. No external request, ever. A data URI is the only route.
- An SVG data-URI favicon is the smallest and sharpest option, but **Safari does not support SVG
  favicons** - decide whether that matters for this product and say so.
- An SVG favicon can carry its own `@media (prefers-color-scheme: dark)` rules, so one file could
  serve both a light and a dark tab strip. I have not tested whether that works from a `data:` URI
  under this CSP. **Test it; do not assume it.**
- Whatever you embed must be legible at 16 px. The guide itself warns that the three terminals
  "read as merged at small sizes even when the geometry says otherwise" - so check the real thing at
  real size and look at it, rather than trusting the vector.

Add `theme-color` while you are there, matching the app's own navy.

---

## Not yours this round

**The preview toolbar is mine.** I have now re-measured it properly, and the numbers correct what I
told you earlier: at 1440 the top row carries 585 px of unused space between "Preview" and Style,
1,093 px with the editor panel hidden. `#status` is **not** a 400 px occupant — it measures 0 px in
the steady state; I had repeated that from an earlier scout without checking. And direction turned
out to live in **three** places, the third of which ("Advanced direction" in Style) sits inside a
`<div hidden>` and measures 0×0 — dead UI. What I do with that space is a design decision and it is
not in this round.

**The diagram-type survey is finished.** Nineteen types, five agents, five adversarial verifiers.
Jobs R, S and T above are its three most damaging findings. The rest of what it found is written up
as Round 6 and is waiting — do not start it, and do not fold it into this round.

**Do not touch the builder panel, the canvas type gating or the Style card.** What the visual
builder becomes — the survey says four of nineteen types can use it fully, and that Guided already
works structurally on all of them — is a decision the owner and I are making. It is not a patch.

Fixed-block placement is **parked** at the owner's request. Do not start it.

## If twelve jobs is not a full round

Say so and I will send more. There is a queue.
