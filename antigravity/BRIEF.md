# SIREN — brief for a second engineer

You are working alongside another engineer on the same 4 MB single-file application.
This brief exists because the last time two of us worked on it in parallel, **every
patch that failed to apply was one that modified shared behaviour, and nothing purely
additive ever collided.** The split below is drawn along that line, not along features.

---

## The file

`SIREN_v1.49.0_frozen.html` in this folder.

- **4,085,237 bytes**
- **SHA-256 `FC7AB9E68863E1E7D17E2409732DE8A87052FE86DC15820D1B973AC696A46831`**

Work against **this exact file**. The live application is moving several times an hour;
if you rebase on it you will be rebasing on something that no longer exists by the time
you finish. Deliver patches against this hash and they will be applied and a new
snapshot cut for the next round.

What it is: a single HTML file that opens in any browser and needs no server. One IIFE,
a strict Content-Security-Policy (`default-src 'none'`, **no `eval`, no `new Function`,
no external requests except the Mermaid CDN**), IndexedDB for persistence. Its owner is
an audit professional and a non-coder; his rule for the project is **build the better
tool, not the sellable one** — rank work by what it costs the person using it.

---

## Your territory: the export writers

Three jobs, all of them additive, all independently testable, and none of them touching
anything the other engineer is working in. They share one quality that makes them good
parallel work: **you can verify them entirely from their output bytes**, without
driving the UI.

### 1. PPTX diagrams as editable shapes

Today `mapPptxDiagramSlide` rasterises the diagram and embeds `image1.jpg`. The owner
asked for real shapes months ago and it is still outstanding.

The geometry work already exists in this file: the **Excel** export writes the diagram
as editable shapes (find `exportXlsxButton`, whose title says so). Port that approach to
the slide writer. Flowcharts map to DrawingML shapes and connectors; sequence, gantt,
class and the rest have no clean mapping — fall back to the image for those and **say so
in the export's own report line** rather than silently producing a picture.

Verify by unzipping the `.pptx` and reading `ppt/slides/slide2.xml`: real `<p:sp>` shapes
with `<a:t>` text runs, not a `<p:pic>`. Then open it if you can.

### 2. `.docx` instead of `.doc`

`exportDocsWord` emits `application/msword` — an HTML document with a Word extension. It
opens, but it is not what the button implies. Write real OOXML.

Verify by unzipping and reading `word/document.xml`.

### 3. Vector PDF for the deck — the big one

The deck PDF is currently **31 photographs**: measured on a real export, 31 `DCTDecode`
streams, **zero fonts, zero text-showing operators, 263 KB a page**. You cannot select a
word, `Ctrl+F` finds nothing, and zoom blurs. For an audit deliverable that goes into a
client file and gets searched, that is a real limitation.

The owner has decided he wants **true vectors**, not an invisible text layer — the cheap
option becomes dead code the day vectors land, so it is one or the other.

Two things already exist and must be treated as **inputs you consume, never as code you
change**:

- `deckPlanDiagramPages(request) → plan` is a pure function that decides pagination,
  portrait versus landscape, where to cut a tall diagram, and the minimum font size on
  each page. It is verified byte-identical on repeat calls. Each `part` carries
  `page{w,h,pdfW,pdfH,orientation}`, `source` (a sub-viewBox), `picture`, `header`,
  `footBox`, `eyebrow`, `minFontPt` and `overlapWith`.
- `buildRasterPdf(pages, pageWidth, pageHeight)` already emits a **per-page `/MediaBox`**,
  so portrait pages work. The app also already writes **real text** in the workpaper PDF
  — find the `Tj` runs in base-14 fonts and reuse that machinery rather than inventing a
  second text path.

So the work is a translator from the rendered SVG into PDF content-stream operators:
paths, fills, strokes, text, arrowheads, clipping. Beware the details — curves, marker
geometry, font metrics, and text that Mermaid places inside `<foreignObject>` rather
than `<text>`.

Verify by extracting the page content stream and asserting there is text, then
rasterising a page and looking at it beside the current raster output.

---

## What you must not touch

Not because it is precious, but because the other engineer is inside it right now and a
whole-file rewrite by either of us silently discards the other's work:

`applyVisualModel`, `parseVisualFlowchartSource`, `serializeVisualFlowchart`,
`parseStructureRows`, `openStructureMenu`, `buildMermaidConfig`, `inkOnFill`,
`enforceDiagramInk`, the theme presets and their ambient scenes, the workspace board,
the editor panes, and `deckPlanDiagramPages` itself.

If a job genuinely cannot be done without changing one of these, **stop and say so with
the proposed signature** rather than changing it and mentioning it in the report.

---

## How to deliver

**Anchor-guarded Python patch scripts**, one per job, each of which:

- asserts the expected occurrence count of every anchor **before** replacing it, so it
  aborts loudly rather than half-applying;
- writes to a `.tmp` and `os.replace`s it in;
- takes the file path as `sys.argv[1]`.

Then, for each: run `python syncheck.py <file>` (in `..\tools\`) and confirm it prints
`node --check exit 0`, and confirm the app still boots with zero console errors.

## How claims are checked

Everything you report will be re-measured before it is merged — that is not distrust,
it is the house rule, and it applies equally to the other engineer. Two rounds today
reported success on work that does not function in the shipped file.

So save yourself a round trip: **measure it yourself first, in the artefact rather than
in the code.** Unzip the PPTX and read the slide XML. Extract the PDF content stream.
Rasterise a page and look at it. A claim with a number or a screenshot behind it
survives; a claim that the code looks right does not.

And check your own harness before reporting that the app is broken. Three false alarms
today were the harness: a dead local server, an element read through `offsetParent`
while it was `position: fixed`, and a welcome tour card that is not a `<dialog>` and so
survives closing every `dialog[open]`.

Two more traps that cost an hour each if you meet them cold: a brand intro plays on
first run and ends on any click, and **Mermaid is fetched from a CDN** — offline you get
a fallback renderer that draws flowcharts only, so confirm `#rendererChipText` reads
"Full Mermaid" before judging any diagram.
