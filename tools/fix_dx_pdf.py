#!/usr/bin/env python3
# =============================================================================
# fix_dx_pdf.py  --  THE PDF WRITER.  Where a tall diagram goes.
#
#   usage:  python fix_dx_pdf.py <path-to-SIREN.html>
#
#   REQUIRES fix_dx_rule.py to have been applied first: this builds on
#   deckPlanDiagramPages / DECK_PAGE / DECK_FRAME / deckPlanOverlap and aborts
#   if they are not there.
#
# Anchor-guarded, atomic, abort-on-drift.  Every anchor must appear exactly
# once or nothing is written.  The target is replaced by os.replace on a
# sibling temp file, so a half-written app can never exist on disk.
#
# ---------------------------------------------------------------------------
# WHAT THE OWNER ASKED FOR
# ---------------------------------------------------------------------------
# "The composed landscape slide keeps the eyebrow, the title, the rule and the
#  note; when the diagram is tall, the diagram moves to its own following
#  PORTRAIT page, full-bleed under a thin header that says which stop it
#  belongs to, so the two never share pixels.  When even portrait leaves the
#  smallest glyph under 9pt, the diagram continues across further portrait
#  pages, labelled so a reader can reassemble them."
#
# That is what this installs, literally:
#
#   a tall stop  ->  page 1: the composed LANDSCAPE slide, accent bar, eyebrow,
#                            title, rule, footer, and a note saying where the
#                            picture went and how the parts are labelled.
#                            The picture is NOT on it.
#                    page 2..n: PORTRAIT, the picture across the full page
#                            width under a one-line header - the stop's name,
#                            and "Part 2 of 4" when there is more than one.
#
#   everything else -> byte-for-byte the slide the deck already drew.
#
# ---------------------------------------------------------------------------
# THE SHARED PRIMITIVE.  SAID LOUDLY.
# ---------------------------------------------------------------------------
# buildRasterPdf(pages, pageWidth, pageHeight) took ONE page size for the whole
# document: every /Page object was written with the same /MediaBox, built from
# the two function arguments.  Mixed orientation was therefore impossible, and
# that is the single reason a tall diagram came out as a ribbon.
#
# It is EXTENDED, NOT REWRITTEN.  Two lines are added inside the existing page
# loop:
#
#     const mediaW = Number(page.pageWidth)  > 0 ? Number(page.pageWidth)  : pageWidth;
#     const mediaH = Number(page.pageHeight) > 0 ? Number(page.pageHeight) : pageHeight;
#
# and the /MediaBox is written from those.  A page object that carries neither
# key - which is every page every existing caller builds - resolves to exactly
# the numbers the old code used.  The object graph, the object order, the
# stream contents and the xref are untouched.
#
# ITS OTHER CALLERS, ENUMERATED, AND WHY THEY ARE UNAFFECTED.  There are three
# call sites in the whole file (this script asserts that count):
#
#   1. exportSpeakerNotes()     - pushes { jpeg, imageWidth, imageHeight, x, y,
#                                 drawWidth, drawHeight }.  No pageWidth key,
#                                 no pageHeight key.  -> unchanged.
#   2. the single-diagram PDF export (fit and tile layouts) - pushes the same
#                                 seven keys in both branches.  -> unchanged.
#   3. mapExportRoute('pdf')    - the deck.  This is the one that starts
#                                 setting the two new keys.
#
# The proof is not the reading: both untouched exports were run before and
# after and the PDF bytes hashed.  See the report.
#
# ---------------------------------------------------------------------------
# WHY THE PORTRAIT PAGE HAS A THIN HEADER, AND WHY THAT IS PLANNED NOT DRAWN
# ---------------------------------------------------------------------------
# The landscape slide immediately in front of these pages has just said the
# eyebrow, the title and the rule.  Repeating the full frame on every portrait
# page would spend 429 of 1920 design pixels - 22% of the page - on words the
# reader read one page ago.  So a continuation page carries ONE line.
#
# The header is not drawn thin and hoped for: the page is PLANNED with exactly
# the meta it is drawn with - { eyebrow: <stop name>, title: '', footer } - so
# deckFrameStackHeight reserves 104.16px, deckComposeBand fits the picture into
# what is left, and deckPlanOverlap(part) is 0 by construction.  Planning with
# one meta and drawing another is the exact mistake that put the title across
# the flowchart in the first place, and it is not repeated here.
#
# With that header the portrait picture well is 1080 x 1581.84 = aspect 1.465,
# against 1080 x 1330 = 1.232 for the full frame.  A diagram at the threshold
# 1.25 therefore gets scale 1.08 on the portrait page against 0.818 on the
# landscape one: +32%, so the page turn is worth taking at the very boundary
# where it starts happening, not only far above it.
#
# ---------------------------------------------------------------------------
# WHAT THIS DOES NOT DO
# ---------------------------------------------------------------------------
# It does not touch the PowerPoint path.  mapExportRoutePptx, mapPptxStopParts,
# mapPptxDiagramSlide, mapPptxRasterSlide and buildZip are untouched and are
# asserted untouched; the deck PPTX keeps one landscape sldSz.
# It does not touch presentFitBox, svgToCanvas, showToast, PDF_MIN_FONT_PT or
# getMinimumExportFontSize.
# It does not touch mapViewSlideSvg, mapCardSlideSvg, mapDiagramSlideSvg or
# mapDiagramSlideFramed - the composed landscape slide is produced by exactly
# the code that produced it yesterday.
# It does not split a LANDSCAPE diagram.  The owner's sentence about further
# pages is about the portrait case, and splitting a near-square diagram would
# break his own reference slide (aspect 1.05, which must stay ONE composed
# landscape slide).  A wide diagram whose type is small still gets one page and
# the toast that says so.
# =============================================================================
import sys, os, tempfile

# ---------------------------------------------------------------- anchors ---

# The insertion point: immediately before mapStopSlides' own doc comment.
A_ANCHOR = "      /* THE DECK IS WHAT THE ROOM SAW. A diagram stop used to be exactly one slide -\n"

# --- mapStopSlides, five sites ------------------------------------------------

A_S1 = """        if (target.kind !== 'diagram' && target.kind !== 'nodes') {
          const only = await mapViewSlideSvg(view);
          return only ? [{ svg: only, note, label: mapViewLabel(view) }] : [];
        }
"""
B_S1 = """        if (target.kind !== 'diagram' && target.kind !== 'nodes') {
          const only = [];
          mapDeckPushPages(only, await mapViewSlidePdfPages(view), note, mapViewLabel(view));
          return only;
        }
"""

A_S2 = """        const base = await mapViewSlideSvg(view);
        const sequence = speakerSequenceForDiagram(diagram);
        const cards = sequence.filter(entry => entry && entry.type === 'card' && entry.card);
        if (!cards.length && !walking) return base ? [{ svg: base, note, label: mapViewLabel(view) }] : [];
"""
B_S2 = """        // A stop is a LIST OF PAGES now, not one slide. On every shape but one it
        // is a list of exactly one and nothing about the deck changes; on a
        // diagram taller than it is wide it is the composed landscape slide
        // followed by that diagram's own portrait page or pages.
        const base = await mapViewSlidePdfPages(view);
        const sequence = speakerSequenceForDiagram(diagram);
        const cards = sequence.filter(entry => entry && entry.type === 'card' && entry.card);
        if (!cards.length && !walking) {
          const only = [];
          mapDeckPushPages(only, base, note, mapViewLabel(view));
          return only;
        }
"""

A_S3 = """            if (base) {
              out.push({
                svg: base,
                note: entry && entry.type === 'overview'
                  ? mapJoinNotes(note, mapStepNoteText(diagram, null), mapStepNoteText(diagram, entry))
                  : mapJoinNotes(note, mapStepNoteText(diagram, null)),
                label: mapViewLabel(view)
              });
            }
"""
B_S3 = """            mapDeckPushPages(out, base, entry && entry.type === 'overview'
              ? mapJoinNotes(note, mapStepNoteText(diagram, null), mapStepNoteText(diagram, entry))
              : mapJoinNotes(note, mapStepNoteText(diagram, null)), mapViewLabel(view));
"""

A_S4 = """          let stepSvg = '';
          try { stepSvg = await mapStepSlideSvg(diagram, entry); }
          catch (error) { stepSvg = ''; }
          if (stepSvg) out.push({ svg: stepSvg, note: mapStepNoteText(diagram, entry), label: speakerEntryLabel(diagram, entry) });
"""
B_S4 = """          let stepPages = [];
          try { stepPages = await mapStepSlidePdfPages(diagram, entry); }
          catch (error) { stepPages = []; }
          mapDeckPushPages(out, stepPages, mapStepNoteText(diagram, entry), speakerEntryLabel(diagram, entry));
"""

A_S5 = """        if (!placed && base) out.push({ svg: base, note, label: mapViewLabel(view) });
        return out;
      }
"""
B_S5 = """        if (!placed) mapDeckPushPages(out, base, note, mapViewLabel(view));
        return out;
      }
"""

# --- mapExportRoute, two sites ------------------------------------------------

A_R1 = """            pages.push({
              jpeg: await canvasRegionToJpeg(canvas, 0, 0, canvas.width, canvas.height),
              imageWidth: canvas.width,
              imageHeight: canvas.height,
              note: slides[index].note || ''
            });
"""
B_R1 = """            pages.push({
              jpeg: await canvasRegionToJpeg(canvas, 0, 0, canvas.width, canvas.height),
              imageWidth: canvas.width,
              imageHeight: canvas.height,
              // The page shape this slide asked for, carried through to the writer.
              page: slides[index].page || DECK_PAGE.landscape,
              note: slides[index].note || ''
            });
"""

A_R2 = """        if (format === 'pdf') {
          // Landscape 16:9 at PDF points, each slide letterboxed into the page.
          const pageWidth = 1280;
          const pageHeight = 720;
          const placed = pages.map(page => {
            const fit = Math.min(pageWidth / page.imageWidth, pageHeight / page.imageHeight);
            const drawWidth = page.imageWidth * fit;
            const drawHeight = page.imageHeight * fit;
            return {
              jpeg: page.jpeg,
              imageWidth: page.imageWidth,
              imageHeight: page.imageHeight,
              x: (pageWidth - drawWidth) / 2,
              y: (pageHeight - drawHeight) / 2,
              drawWidth,
              drawHeight
            };
          });
          const bytes = buildRasterPdf(placed, pageWidth, pageHeight);
"""
B_R2 = """        if (format === 'pdf') {
          // 16:9 at PDF points, each slide letterboxed into ITS OWN page.  The deck
          // used to be one page size from cover to close - which is the whole reason
          // a tall flowchart arrived as a ribbon down the middle of a landscape
          // page: the page could not turn.  It can now, because buildRasterPdf takes
          // a per-page MediaBox, and the shape a slide asks for is the shape it gets.
          // 1280x720 stays the DOCUMENT default, so a slide that asks for nothing
          // lands on exactly the page it always landed on.
          const pageWidth = 1280;
          const pageHeight = 720;
          let portraitPages = 0;
          const placed = pages.map(page => {
            const shape = page.page || DECK_PAGE.landscape;
            const boxW = Number(shape.pdfW) > 0 ? Number(shape.pdfW) : pageWidth;
            const boxH = Number(shape.pdfH) > 0 ? Number(shape.pdfH) : pageHeight;
            if (boxH > boxW) portraitPages += 1;
            const fit = Math.min(boxW / page.imageWidth, boxH / page.imageHeight);
            const drawWidth = page.imageWidth * fit;
            const drawHeight = page.imageHeight * fit;
            return {
              jpeg: page.jpeg,
              imageWidth: page.imageWidth,
              imageHeight: page.imageHeight,
              x: (boxW - drawWidth) / 2,
              y: (boxH - drawHeight) / 2,
              drawWidth,
              drawHeight,
              pageWidth: boxW,
              pageHeight: boxH
            };
          });
          const bytes = buildRasterPdf(placed, pageWidth, pageHeight);
"""

A_R3 = """          showToast(`${pages.length} slides exported as PDF.` + mapDeckSmallTypeNote(), 'success');
"""
B_R3 = """          showToast(`${pages.length} page${pages.length === 1 ? '' : 's'} exported as PDF.`
            + (portraitPages
              ? ` ${portraitPages === 1 ? 'One page is' : `${portraitPages} pages are`} portrait:`
                + ' a diagram taller than it is wide is printed on its own page rather than across its title.'
              : '')
            + mapDeckSmallTypeNote(), 'success');
"""

# --- buildRasterPdf, the shared primitive, extended additively ----------------

A_PDF = """          const contentId = pdf.addStream('', new TextEncoder().encode(content));
          const pageId = pdf.add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${formatPdfNumber(pageWidth)} ${formatPdfNumber(pageHeight)}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
"""
B_PDF = """          const contentId = pdf.addStream('', new TextEncoder().encode(content));
          // A PDF PAGE CARRIES ITS OWN SIZE.  This writer used to spend the two
          // function arguments on every page in the document, so a document could
          // only ever be one shape - which is why the deck could not turn a page
          // for a diagram taller than it is wide.  A page that names its own size
          // gets it; a page that names nothing gets the document size it was called
          // with, so every existing caller writes the same bytes it wrote before.
          const mediaW = Number(page.pageWidth) > 0 ? Number(page.pageWidth) : pageWidth;
          const mediaH = Number(page.pageHeight) > 0 ? Number(page.pageHeight) : pageHeight;
          const pageId = pdf.add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${formatPdfNumber(mediaW)} ${formatPdfNumber(mediaH)}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
"""

# ------------------------------------------------------------ the new code ---

NEW = r"""      /* =====================================================================
         THE DECK AS A PDF - WHERE A TALL DIAGRAM GOES.

         THE FAULT.  A ~30-block vertical flowchart on a 1280x720 page came out
         as a thin strip pinned to the right of the page with the title alone on
         the left, its block text about two points tall.  Nothing about the
         composition was wrong: a picture eighteen times taller than it is wide
         cannot be read on a landscape page at any composition.  The page was
         wrong.

         WHAT A PDF CAN DO THAT A PPTX CANNOT.  PowerPoint defines slide size
         once, in presentation.xml, for a whole presentation - per-slide
         orientation does not exist in the format - so a mixed-orientation deck
         is a PDF-only answer, and the owner has accepted that.  A PDF page
         carries its own /MediaBox, so this file CAN turn the page, and does.

         THE SHAPE OF THE ANSWER, in the owner's own words: the composed
         landscape slide keeps the eyebrow, the title, the rule and the note;
         the diagram moves to its own following portrait page, full-bleed under
         a thin header that says which stop it belongs to, so the two never
         share pixels.  Under 9pt even there, it continues across further
         portrait pages, labelled so a reader can reassemble them.

             stop 3, a 30-block chain     page  4  landscape  the frame, no picture
                                          page  5  portrait   PART 1 OF 4
                                          page  6  portrait   PART 2 OF 4
                                          page  7  portrait   PART 3 OF 4
                                          page  8  portrait   PART 4 OF 4

         WHICH DIAGRAMS.  Exactly the ones deckPlanDiagramPages calls portrait -
         aspect quantised to two decimals, >= DECK_PORTRAIT_ASPECT.  The rule is
         ASKED here, never re-derived, so the PDF and the PowerPoint cannot end
         up disagreeing about which diagrams are tall.  Everything at or under
         the owner's 1.05 reference - and everything else that is not taller
         than it is wide - takes the composed landscape slide it already took,
         drawn by exactly the code that drew it before.

         THE ONE THING PLANNED HERE RATHER THAN THERE.  A continuation page's
         header is THIN: one line, not eyebrow-title-rule, because the landscape
         slide one page earlier has just said all three and repeating them would
         spend 22% of the page on words the reader has read.  That thin header
         is not drawn thin and hoped for - the page is PLANNED with the same
         meta it is DRAWN with, so the picture is fitted to what the header
         left and deckPlanOverlap(part) is 0 by construction.  Planning with one
         meta and drawing another is precisely the mistake that painted the
         title across the flowchart, and it is not repeated here.
         ===================================================================== */

      /* Would the planner turn the page for this picture?  One call, meta-free
         and font-free, because orientation depends on neither: it is the
         aspect rule and nothing else. */
      function mapDeckPdfWantsPortrait(box) {
        if (!box || !(box.width > 0) || !(box.height > 0)) return false;
        try {
          return deckPlanDiagramPages({
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            meta: null, minFontPx: 0, target: 'pdf'
          }).orientation === 'portrait';
        } catch (error) { return false; }
      }

      /* THE THIN HEADER'S WORDS.  Which stop this page belongs to - the stop's
         own title, the words already on the route chip, on the presenter's plate
         and on the landscape slide in front of it - and nothing else.  An empty
         title means the header measures and draws one line and no more. */
      function mapDeckPdfThinMeta(meta) {
        const safe = meta || {};
        return {
          eyebrow: String(safe.title || safe.eyebrow || 'Diagram').trim(),
          title: '',
          footer: String(safe.footer || '').trim()
        };
      }

      /* The plan for a tall stop, or null for every other stop.  Structure is
         read off the serialised picture so the cuts land in the gaps between
         blocks rather than through them; a picture that answers no structure
         still plans, on even geometry. */
      function mapDeckPdfPlanTall(picture, meta) {
        const box = mapDeckDiagramBox(picture);
        if (!box || !mapDeckPdfWantsPortrait(box)) return null;
        let rows = null;
        try { rows = deckDiagramRowProfile(picture); } catch (error) { rows = null; }
        try {
          const plan = deckPlanDiagramPages({
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            meta: mapDeckPdfThinMeta(meta),
            minFontPx: mapDeckSvgMinFontPx(picture),
            target: 'pdf',
            rows: rows
          });
          return plan && plan.parts && plan.parts.length ? plan : null;
        } catch (error) { return null; }
      }

      /* The eyebrow is drawn as ONE unwrapped line, and a portrait page's column
         is 840 design pixels wide where a landscape page's is 1680.  Measure it
         with the app's own measurer - canvas measureText, the engine that paints
         the SVG - and cut the STOP NAME rather than let the line run off the edge
         of the page.

         THE PART LABEL IS PASSED SEPARATELY AND IS NEVER CUT.  'Part 2 of 4' is
         the entire reason these pages are labelled; the first version of this
         trimmed the whole line and the ellipsis ate it, which left three portrait
         pages a reader could not tell apart.  Measured on the real export, so it
         is a fix for something that happened, not for something imagined.

         Uppercased before measuring because the drawing code uppercases and
         capitals are wider - the measurement has to be taken on the letters that
         will actually be set. */
      function mapDeckPdfFitLine(text, tail, width, size, weight) {
        const name = String(text || '').trim().toUpperCase();
        const suffix = String(tail || '').toUpperCase();
        if (!name) return suffix.replace(/^[\s·]+/, '');
        try {
          const font = mapSlideFont(size, weight, false, mapSlidePalette().family);
          const room = Math.max(40, (Number(width) || 0) - mapSlideTextWidth(suffix, font));
          if (mapSlideTextWidth(name, font) <= room) return name + suffix;
          let cut = name;
          while (cut.length > 1 && mapSlideTextWidth(`${cut}…`, font) > room) cut = cut.slice(0, -1);
          return `${cut.replace(/[\s·]+$/, '')}…${suffix}`;
        } catch (error) { return name + suffix; }
      }

      /* THE SLIDE THE PICTURE LEFT.  It keeps everything the composed slide ever
         had - the accent bar, the eyebrow, the title, the rule, the footer - and
         the diagram is not on it, because on a picture taller than the page there
         is no honest way to have both.  Its body says where the picture went, in
         the same words the pages themselves are labelled with, so a printed deck
         can be reassembled by a reader who was not in the room.  Drawn by
         mapCardSlideSvg, so it is the same slide a content card is. */
      function mapDeckPdfCoverSvg(meta, plan) {
        const safe = meta || {};
        const total = plan.parts.length;
        const capped = plan.split && plan.split.capped;
        const body = total > 1
          ? `The diagram is taller than it is wide, so it is printed on the ${total} portrait pages`
            + ` that follow, marked Part 1 of ${total} to Part ${total} of ${total}.`
            + ' Consecutive parts overlap: the last blocks of one page are repeated at the top of the next.'
            + (capped ? ' At this size the smallest labels are still tight; a horizontal layout or a larger diagram font would lift them.' : '')
          : 'The diagram is taller than it is wide, so it is printed on its own portrait page overleaf,'
            + ' across the full width of that page.';
        return mapCardSlideSvg({ kind: 'text', eyebrow: safe.eyebrow, title: safe.title, body: body },
          MAP_SLIDE.w, MAP_SLIDE.h);
      }

      /* ONE STOP, THE PAGES IT BECOMES.  Every entry carries the page shape it
         wants; the writer letterboxes it into that shape and gives that page its
         own MediaBox.  On everything that is not a tall diagram this returns a
         list of one and the deck is exactly what it was. */
      async function mapViewSlidePdfPages(view) {
        const target = (view && view.target) || { kind: 'map' };
        if (target.kind === 'diagram' || target.kind === 'nodes') {
          const diagram = state.diagrams.find(entry => entry.id === target.diagramId);
          if (!diagram) return [];
          // The SAME picture mapViewSlideSvg would have composed - asked for once,
          // so turning the page costs no second render.
          const picture = await mapViewDiagramSvg(view, diagram);
          if (!picture) return [];
          const meta = mapDeckDiagramMeta(view, diagram);
          const plan = mapDeckPdfPlanTall(picture, meta);
          if (plan) {
            const thin = mapDeckPdfThinMeta(meta);
            const out = [{
              svg: mapDeckPdfCoverSvg(meta, plan),
              page: DECK_PAGE.landscape,
              label: meta.title, kind: 'cover'
            }];
            plan.parts.forEach(part => {
              // The stop's name is cut to the column; the part label never is.
              // Trimming cannot move any rectangle: the header reserves ONE LINE
              // whatever that line says, so the picture rect is untouched and the
              // planner's zero-overlap guarantee still holds.
              const tag = part.total > 1 ? ` · ${part.label}` : '';
              part.eyebrow = mapDeckPdfFitLine(thin.eyebrow, tag, part.header.w,
                DECK_FRAME.eyebrowSize, 700);
              const svg = mapDiagramSlideSvg(picture, thin, part);
              if (!svg) return;
              // The toast has to report the page the reader is actually handed,
              // not the page this diagram would have had on one landscape sheet.
              mapDeckNoteType(meta.title, picture, part.picture.scale);
              out.push({
                svg: svg, page: part.page, kind: 'part',
                label: part.total > 1 ? `${meta.title} · ${part.label}` : meta.title,
                minFontPt: part.minFontPt, overlap: deckPlanOverlap(part)
              });
            });
            if (out.length > 1) return out;
            // Every part refused to draw.  A stop that VANISHES from the deck is a
            // worse answer than a stop on one landscape page, so fall through to
            // the slide this diagram would have had.
          }
          // NOT TALL: the composed landscape slide, from the same two calls
          // mapViewSlideSvg makes, in the same order, with the same arguments.
          const framed = mapDiagramSlideFramed(picture, meta);
          if (!framed || !framed.svg) return [];
          if (framed.layout) mapDeckNoteType(meta.title, picture, framed.layout.picture.scale);
          return [{
            svg: framed.svg, page: DECK_PAGE.landscape, kind: 'slide',
            minFontPt: framed.minFontPt, overlap: framed.overlap || 0
          }];
        }
        const svg = await mapViewSlideSvg(view);
        return svg ? [{ svg: svg, page: DECK_PAGE.landscape, kind: 'slide' }] : [];
      }

      /* A walkthrough step's pages.  A step's camera is a `nodes` view, so a step
         whose crop is taller than it is wide turns the page for the same reason a
         whole diagram does - and a section step is a card and stays landscape. */
      async function mapStepSlidePdfPages(diagram, entry) {
        if (!entry) return [];
        if (entry.type === 'section') {
          let svg = '';
          try {
            svg = mapCardSlideSvg({ kind: 'title', eyebrow: 'Section', title: entry.title || 'Section' },
              MAP_SLIDE.w, MAP_SLIDE.h);
          } catch (error) { svg = ''; }
          return svg ? [{ svg: svg, page: DECK_PAGE.landscape, kind: 'slide' }] : [];
        }
        return mapViewSlidePdfPages(mapStepView(diagram, entry));
      }

      /* One stop can be several pages now.  The NOTE belongs to the stop, so it
         travels on the first of them - a notes file that repeats one note four
         times is a notes file nobody reads - while every page keeps its own label,
         so the notes file names the part a reader is holding. */
      function mapDeckPushPages(out, pages, note, label) {
        let added = 0;
        (Array.isArray(pages) ? pages : []).forEach(page => {
          if (!page || !page.svg) return;
          out.push({
            svg: page.svg,
            page: page.page || DECK_PAGE.landscape,
            note: added === 0 ? String(note == null ? '' : note) : '',
            label: page.label || label,
            kind: page.kind || 'slide'
          });
          added += 1;
        });
        return added;
      }

"""

# ------------------------------------------------------------------ apply ---

REQUIRED = (
    'function deckPlanDiagramPages(',
    'function deckPlanOverlap(',
    'function deckDiagramRowProfile(',
    'const DECK_PAGE = {',
    'const DECK_FRAME = {',
    'function mapDiagramSlideSvg(diagramSvg, meta, part) {',
    'function mapDiagramSlideFramed(diagramSvg, meta, part) {',
)

UNTOUCHED = (
    "function presentFitBox(contentW, contentH, boxX, boxY, boxW, boxH, mode) {",
    "function buildZip(entries) {",
    "const PDF_MIN_FONT_PT = 9;",
    "function getMinimumExportFontSize() {",
    "async function svgToCanvas(svgString, requestedScale, backgroundMode) {",
    "async function mapExportRoutePptx() {",
    "async function mapPptxDiagramSlide(diagramSvg, meta, palette, media) {",
    "async function mapViewSlideSvg(view) {",
    "function mapCardSlideSvg(card, width, height, revealShown) {",
)


def main():
    if len(sys.argv) < 2:
        raise SystemExit('usage: fix_dx_pdf.py <path-to-SIREN.html>')
    path = sys.argv[1]
    src = open(path, 'r', encoding='utf-8', newline='').read()
    before = len(src)

    if 'mapViewSlidePdfPages' in src:
        raise SystemExit('ABORT: mapViewSlidePdfPages already present - already patched')
    for token in REQUIRED:
        if src.count(token) != 1:
            raise SystemExit('ABORT: fix_dx_rule.py must be applied first - %r count %d'
                             % (token, src.count(token)))

    # buildRasterPdf must still be the one-page-size writer with three callers.
    if src.count('function buildRasterPdf(pages, pageWidth, pageHeight) {') != 1:
        raise SystemExit('ABORT: buildRasterPdf signature drifted')
    callers = src.count('buildRasterPdf(') - 1
    if callers != 3:
        raise SystemExit('ABORT: buildRasterPdf has %d call sites, expected 3 - '
                         'enumerate them before extending it' % callers)

    edits = [
        ('insert-block',   A_ANCHOR, NEW + A_ANCHOR),
        ('stop-not-diagram', A_S1, B_S1),
        ('stop-base',        A_S2, B_S2),
        ('stop-base-push',   A_S3, B_S3),
        ('stop-step',        A_S4, B_S4),
        ('stop-tail',        A_S5, B_S5),
        ('route-raster',     A_R1, B_R1),
        ('route-place',      A_R2, B_R2),
        ('route-toast',      A_R3, B_R3),
        ('mediabox',         A_PDF, B_PDF),
    ]
    for name, old, new in edits:
        n = src.count(old)
        if n != 1:
            raise SystemExit('ABORT: edit %r matched %d times, expected 1' % (name, n))
        src = src.replace(old, new, 1)

    # -- post-conditions ------------------------------------------------------
    for token in ('async function mapViewSlidePdfPages(view) {',
                  'async function mapStepSlidePdfPages(diagram, entry) {',
                  'function mapDeckPushPages(out, pages, note, label) {',
                  'function mapDeckPdfPlanTall(picture, meta) {',
                  'function mapDeckPdfCoverSvg(meta, plan) {',
                  'const mediaW = Number(page.pageWidth) > 0 ? Number(page.pageWidth) : pageWidth;'):
        if src.count(token) != 1:
            raise SystemExit('ABORT: post-condition %r count %d' % (token, src.count(token)))
    # The RASTER writer's page line must now read the per-page size.  The other
    # PDF writer in this file - the Docs/workpaper vector one, which is not this
    # agent's - keeps its single document MediaBox and is left exactly as it is.
    if src.count('/MediaBox [0 0 ${formatPdfNumber(mediaW)} ${formatPdfNumber(mediaH)}]') != 1:
        raise SystemExit('ABORT: the raster /MediaBox did not become per-page')
    if '/XObject << /Im0 ${imageId} 0 R >> >> /Contents' in src and \
       'formatPdfNumber(pageWidth)} ${formatPdfNumber(pageHeight)}] /Resources << /ProcSet' in src:
        raise SystemExit('ABORT: a raster /MediaBox still writes the document size directly')
    if src.count('buildRasterPdf(') - 1 != 3:
        raise SystemExit('ABORT: a buildRasterPdf call site appeared or vanished')
    # The two exports that must not change still build pages with no page size.
    if src.count('pages.push({ jpeg, imageWidth:canvas.width, imageHeight:canvas.height, x:0, y:0, '
                 'drawWidth:pageWidth, drawHeight:pageHeight });') != 1:
        raise SystemExit('ABORT: the speaker-notes page shape changed')
    for token in UNTOUCHED:
        if src.count(token) != 1:
            raise SystemExit('ABORT: %r disturbed' % token)
    # mapStopSlides must no longer reach the single-svg helpers.
    for gone in ('const base = await mapViewSlideSvg(view);',
                 'await mapStepSlideSvg(diagram, entry)'):
        if gone in src:
            raise SystemExit('ABORT: %r survived in mapStopSlides' % gone)

    d = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(dir=d, suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8', newline='') as f:
        f.write(src)
    os.replace(tmp, path)
    print('patched %s: %d -> %d chars (+%d)' % (path, before, len(src), len(src) - before))


main()
