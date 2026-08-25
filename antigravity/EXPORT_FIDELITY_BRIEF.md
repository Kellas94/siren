# When you open what SIREN exported, is it what SIREN promised?

Nobody has checked at scale. That is the job.

## What is already established — do not re-do this

I measured this before writing the brief, so you start from facts:

- **Every export produces a file, for every diagram type**, including types whose SVG contains no
  flowchart nodes at all. Measured on flowchart, pie, gantt and mindmap: PPTX, XLSX and PDF all
  produced blobs of the right MIME type and plausible size. So "it produces nothing" is **not** the
  question and you should not spend time on it.
- The Excel workbook from a flowchart is: **one sheet per diagram**, the diagram drawn as **native
  Excel shapes** (18 in my test), and one real Excel table (`SIRENDiagram1`, TableStyleMedium2,
  A65:AF79) with **32 columns** — Type, ID, Label, Shape, From, To, Connector, Connector label,
  Risk, Control, Owner, Evidence, Status, Reference, Frequency, System, then styling and layout.
- A nine-page PDF deck was 72,267 bytes with subset NotoSans and **Romanian diacritics intact** —
  "Ședință de deschidere", "Țară aprobată?" extract correctly.
- Another engineer validated 31 exports **structurally**, and opened one DOCX and one PPTX in real
  Word and PowerPoint. One fixture, one type.

**The open question is fidelity, at scale, across types.** A file that opens is not the same as a
file that is right.

## The suspicion to start from

`collectDrawingFromSvg` — the one function that turns a rendered diagram into export shapes — walks
`g.node` and the edge paths. A **pie chart and a gantt have zero `g.node`**. Yet both still produce
a PPTX. So either the exporter has another path for them, or it is falling back to embedding a
picture.

A hint, not proof: the **pie** PPTX came out at **222,214 bytes** while a more complex **flowchart**
came out at **132,153**. A raster image would explain that.

**Find out.** For each type, when you open the PPTX: are the blocks **selectable, editable shapes**,
or is it one flat picture? The app's own changelog promises "editable PowerPoint shapes". If that
promise does not hold for some types, that is the most valuable single finding in this job.

## Hard rules

1. **Do not modify the application.** Read-only copy. No patches — a patch will be discarded unread.
2. **Every row needs evidence you personally saw**: a screenshot of the file open in the real
   application, or a value you measured. "Could not test" is a good answer and will be treated as one.
3. **Name the application and version** you opened each file in. "Opens fine" is not a result;
   "Excel 2021, opened without a repair prompt, screenshot attached" is.
4. **A file opening is not a pass.** The question is whether the content is right. Say what is
   missing or wrong, not just whether it launched.
5. **Do not expand the scope.** Anything else you notice goes in a separate section at the end.

## The base

- **`C:\Claude\SIREN\codex\FROZEN_1_66_0.html`** — 8,438,995 bytes, SHA-256
  `B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`

## Do not try to do all of it

Nineteen types times nine formats is 171 combinations. That is not the job. Prioritise:

**Tier 1 — the owner's real work.** A flowchart at **real scale**: 40+ blocks, subgraphs, long
labels, Romanian diacritics throughout, and audit metadata (risk, control, owner, evidence, status,
reference, frequency, system) filled in on many blocks. Put that through **every** format: PDF, PNG,
SVG, PPTX, DOCX, XLSX, Markdown, JSON, `.siren`. Open every one in its real application.

**Tier 2 — the geometry formats across every type.** PDF, PPTX and XLSX for all nineteen types.
These are the three that must reconstruct the drawing, so they are where a type without flowchart
nodes will fail.

**Tier 3 — spot checks.** One or two types for the remaining formats.

## What to look for, specifically

- **Romanian diacritics** — ș, ț, ă, î, â — in every format. Select the text in the opened file and
  confirm it is text, not a picture of text. This matters more than anything else on the list: the
  owner writes in Romanian and a mangled diacritic in a client deliverable is the kind of defect that
  is noticed by someone else first.
- **Editable versus flat.** In PowerPoint, click a block: does it select as a shape? In Excel, is the
  diagram made of shapes you can move? Report per type.
- **The 32-column table** in Excel: are the audit fields carried, and do they match what is on screen?
- **A repair prompt.** If Word, Excel or PowerPoint offers to repair the file, that is a failure even
  if it opens afterwards. Say so and quote the prompt.
- **The default title.** Every diagram is titled "Flowchart Preview" until renamed, and that string
  is pre-filled in the Style card. Check whether it leaks into exported files — a client PDF headed
  "Flowchart Preview" over a Gantt is a real embarrassment and we already know the string is there.
- **Scale.** At 40+ blocks: does the PDF split pages sensibly, does the PPTX stay on one slide or
  overflow, does the XLSX shape count match the diagram?
- **Round trip.** Export `.siren` and JSON, re-import them, and confirm nothing was lost — diagrams,
  documents, metadata, comments.

## The output

One document, `EXPORT_FIDELITY.md`.

A table per tier, with these columns: **type · format · opened in (app + version) · opens cleanly ·
content correct · what is wrong · evidence file**.

Then, ordered by severity:

1. **Wrong content that opens cleanly** — the worst class, because nothing warns anyone. A picture
   where shapes were promised, a missing metadata column, a mangled diacritic.
2. **Fails to open or prompts for repair.**
3. **Cosmetic** — spacing, page breaks, a title.

And a short list of what is **right**, so we know what not to break later.

## What this is not

Do not fix anything, do not propose a redesign, do not touch the visual builder or any other work in
flight. Two other engineers are working on this file. Your job needs no changes to it at all — that
is deliberate, and it is why this job is yours.
