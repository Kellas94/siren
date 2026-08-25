#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# =============================================================================
# fix_dx_pptx.py  --  the PowerPoint writer for a planned diagram.
#
#   usage:  python fix_dx_pptx.py <path-to-SIREN.html>
#
# REQUIRES fix_dx_rule.py TO HAVE RUN FIRST.  This script consumes
# deckPlanDiagramPages / deckPlanOverlap / deckDiagramRowProfile and aborts if
# they are not in the file.
#
# Anchor-guarded, atomic, abort-on-drift.  Every anchor must appear exactly once
# or nothing is written; the file is replaced by os.replace on a sibling temp
# file, so a half-written app can never exist on disk.
#
# WHAT THIS CHANGES
# -----------------
# ONE FORMAT CONSTRAINT DRIVES ALL OF IT.  presentation.xml carries a single
# <p:sldSz> for the whole presentation - per-slide orientation does not exist in
# OOXML - so PowerPoint cannot answer a tall diagram the way the PDF does.  It
# answers instead by SPLITTING: the deck stays one landscape file, and a diagram
# too tall to be legible on one slide becomes several landscape slides that
# overlap enough to rejoin, each carrying the stop's eyebrow and title with its
# own part number.
#
#   mapPptxDiagramSlides(svg, meta, palette, media) -> [slide, ...]
#       Plans with target:'pptx' (which can never come back portrait), rasters
#       the picture ONCE, and cuts each part's crop out of that one canvas.
#
#   mapPptxDiagramPartSlide(part, asset, palette, media) -> slide
#       One page of a plan as real OOXML: accent bar, picture, eyebrow, title,
#       rule and footer, every word an <a:t> run.
#
#   mapPptxDiagramSlide(...)  kept, now a thin wrapper returning the first page.
#
# THE ONE RULE, ENFORCED ON THE SHAPES ACTUALLY EMITTED
# -----------------------------------------------------
# mapPptxKeepOffPicture measures every frame shape against the picture rect with
# the same arithmetic deckPlanOverlap uses, and SHORTENS any shape that touches
# it - upwards if it sits above, sideways if it sits beside - before the shape
# reaches OOXML.  On a planned page it never fires.  It fires the day somebody
# moves a rect, and then the deliverable is still clean and the console says
# which shape moved.  mapPptxAuditNote reports the result of every export.
#
# WHAT ROUND SIX WON AND THIS KEEPS
# ---------------------------------
#   * every expanded step slide still carries real <a:t> runs;
#   * the notesSlide still carries that step's own Studio note - and now carries
#     it on every page of a split, because it is one step said once;
#   * the picture is still the stop's OWN crop (mapViewDiagramSvg), rasterised
#     through the same svgToCanvas -> canvasRegionToJpeg path, never re-rendered.
#
# SHARED PRIMITIVES: buildZip, svgToCanvas, canvasRegionToJpeg, showToast,
# presentFitBox, PDF_MIN_FONT_PT and getMinimumExportFontSize are READ, never
# rewritten.  Post-conditions below assert that.  The PDF path
# (mapExportRoute's non-pptx branch, buildRasterPdf) is not touched.
#
# LOUD NOTE: the raster scale for a diagram stop is no longer the flat 2 it has
# always been.  A crop that fills a slide needs the pixels the whole picture
# never did, so the scale is raised to about two canvas pixels per slide pixel,
# clamped to [2, 3.2] - never coarser than before, never wild.
# =============================================================================
import sys, os, tempfile

# ------------------------------------------------------------------ anchors --

A_SLIDE_HEAD = "      async function mapPptxDiagramSlide(diagramSvg, meta, palette, media) {\n"
A_SLIDE_TAIL = "\n      const MAP_PPTX_TEXT_KINDS = ['title', 'text', 'table', 'facts', 'doc'];\n"

# tokens that must still be inside the block being replaced, or the file drifted
A_SLIDE_TOKENS = (
    "const layout = mapDeckFrameLayout(box.width, box.height, meta);",
    "slide.rect('Accent bar', 0, 0, MAP_SLIDE.w, 10, palette.accentHex);",
    "slide.text('Footer', head.x, MAP_SLIDE.h - 58, Math.max(360, head.w), 34,",
)

B_SLIDE = r"""      /* =====================================================================
         A DIAGRAM STOP AS POWERPOINT SLIDES.

         It used to be one picture stretched over the whole 12192000 x 6858000
         canvas - a 21%-wide strip of flowchart on an otherwise empty slide with
         not one <a:t> run on it.  Round six gave it the frame and real text.
         This round answers the two faults the owner found in the real export.

         THE FORMAT CONSTRAINT.  <p:sldSz> is written ONCE, in presentation.xml,
         for the whole presentation.  OOXML has no per-slide orientation.  So the
         PDF's answer to a tall diagram - give it a portrait page - is not
         available here at all, and pretending otherwise would mean writing two
         files or one file PowerPoint cannot open.

         SO POWERPOINT SPLITS.  The deck stays ONE landscape file the recipient
         can edit, and a diagram too tall to be legible on one slide is cut into
         several landscape slides on the gaps between its own blocks, overlapping
         by about a block and a quarter so a reader rejoins them by recognising
         something rather than by faith.  Each part says which part it is, in the
         eyebrow, next to the stop it belongs to.

         WHO DECIDES.  Not this writer.  deckPlanDiagramPages(target:'pptx') -
         the same pure function the PDF asks - which with that target can never
         return portrait.  Both files therefore cut a diagram in the same places
         and report the same point size; only the page shape differs.

         THE PICTURE IS STILL THE STOP'S OWN CROP.  mapViewDiagramSvg has already
         framed the step's camera; this rasterises THAT, once, and cuts each
         part's crop out of the one canvas.  Nothing is re-rendered per part, so
         no part can disagree with the PDF page beside it.
         ===================================================================== */

      /* A crop blown up to fill a slide needs pixels the whole picture never
         did.  The scale is raised to about two canvas pixels per slide pixel and
         clamped: never coarser than the flat 2 the deck has always used, never
         so fine that a 30-block flowchart turns into a 40 MB deck. */
      const DECK_PPTX_RASTER_MIN = 2;
      const DECK_PPTX_RASTER_MAX = 3.2;

      /* What the last export did, so a claim about it can be measured rather
         than believed.  Reset at the top of mapExportRoutePptx. */
      let mapPptxDeckAudit = [];
      let mapPptxSplits = [];

      function mapPptxRectOverlapArea(a, b) {
        if (!a || !b) return 0;
        const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        return ix * iy;
      }

      /* THE RULE, ON THE SHAPES THIS WRITER ACTUALLY EMITS.  deckPlanOverlap
         proves the PLAN is clean; this proves the SLIDE is, which is the thing
         the owner opens.  A frame shape that touches the picture is shortened
         until it cannot - upwards if it sits above it, sideways if it sits
         beside it - and if even that fails the shape is dropped rather than
         painted across the flowchart.  A deliverable must never leave the
         building looking like that.

         On a planned page this never fires.  It fires the day somebody moves a
         rect, and then the console names the shape. */
      function mapPptxKeepOffPicture(rect, picture, name) {
        if (!rect) return null;
        if (!picture || mapPptxRectOverlapArea(rect, picture) <= 0) return rect;
        const out = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
        if (rect.y < picture.y) out.h = Math.max(1, picture.y - rect.y);
        if (mapPptxRectOverlapArea(out, picture) > 0 && rect.x < picture.x) {
          out.w = Math.max(1, picture.x - rect.x);
        }
        if (mapPptxRectOverlapArea(out, picture) > 0 && rect.x + rect.w > picture.x + picture.w) {
          const left = Math.max(picture.x + picture.w, rect.x);
          out.w = Math.max(1, rect.x + rect.w - left);
          out.x = left;
        }
        const left = mapPptxRectOverlapArea(out, picture);
        console.error('deck pptx: "' + name + '" was over the picture', rect, picture,
          left > 0 ? 'and could not be moved off it - dropped' : 'and was clipped off it');
        mapPptxDeckAudit.push({ label: name, clipped: true, dropped: left > 0, overlap: left });
        return left > 0 ? null : out;
      }

      /* ONE PAGE OF A PLAN, AS OOXML.  `part` owns the page size, the crop, the
         picture rect and the frame rects; `asset` is that crop, already encoded.
         Every word here is a real <a:t> run, exactly as mapPptxCardSlide writes
         them, so the recipient can edit and search a diagram slide. */
      function mapPptxDiagramPartSlide(part, asset, palette, media) {
        if (!part || !part.picture || !asset) return null;
        const slidePalette = mapSlidePalette();
        const page = part.page || { w: MAP_SLIDE.w, h: MAP_SLIDE.h };
        const head = part.header || { x: MAP_SLIDE.padX, y: MAP_SLIDE.padTop, w: 560, h: 400 };
        const eyebrow = String(part.eyebrow || '').trim();
        const titleText = String(part.title || '').trim();
        const footerText = String(part.footer || '').trim();

        // The crop's OWN aspect, fitted inside the planned picture rect.  Rounding
        // a crop to whole canvas pixels moves its ratio by a fraction of a pixel;
        // re-fitting absorbs that instead of stretching the diagram - and a
        // sub-rect of a non-overlapping rect is still non-overlapping.
        const fit = presentFitBox(asset.width, asset.height,
          part.picture.x, part.picture.y, part.picture.w, part.picture.h, 'contain');
        const picture = { x: fit.x, y: fit.y, w: fit.w, h: fit.h };

        const slide = mapPptxNewSlide(palette);
        const emitted = [];
        const put = (name, rect, draw) => {
          const safe = mapPptxKeepOffPicture(rect, picture, name);
          if (!safe) return;
          emitted.push({ name: name, x: safe.x, y: safe.y, w: safe.w, h: safe.h });
          draw(safe);
        };

        put('Accent bar', { x: 0, y: 0, w: page.w, h: 10 },
          r => slide.rect('Accent bar', r.x, r.y, r.w, r.h, palette.accentHex));
        slide.picture(titleText.slice(0, 90) || 'Diagram', asset,
          picture.x, picture.y, picture.w, picture.h);

        // Laid out first, then shifted as one block, so the PowerPoint header sits
        // exactly where the PDF header sits.
        const stack = [];
        let y = head.y;
        if (eyebrow) {
          const size = 38;
          stack.push({ kind: 'text', name: 'Eyebrow', x: head.x, y: y, w: head.w, h: size * 1.4, paragraphs: [{
            text: eyebrow.toUpperCase().slice(0, 90), size: size / 2, bold: true, colour: palette.accentHex
          }] });
          y += size * 1.4 + 18;
        }
        if (titleText) {
          const fitted = mapSlideFitTitle(titleText, head.w, 74,
            Math.max(1, Number(part.titleLines) || 2), slidePalette.family);
          const height = Math.max(fitted.size * 1.2, fitted.lines.length * fitted.size * 1.18 + 10);
          stack.push({ kind: 'text', name: 'Title', x: head.x, y: y, w: head.w, h: height, paragraphs: [{
            text: titleText, size: fitted.size / 2, bold: true, colour: palette.fgHex
          }] });
          y += height + 6;
        }
        if (eyebrow || titleText) {
          stack.push({ kind: 'rect', name: 'Rule', x: head.x, y: y + 16, w: 116, h: 6, fill: palette.accentHex });
          y += 16 + 6;
        }
        if (part.centreY) {
          const shift = Math.round((head.h - (y - head.y)) / 2);
          if (Number.isFinite(shift) && Math.abs(shift) > 4) stack.forEach(item => { item.y += shift; });
        }
        stack.forEach(item => {
          put(item.name, { x: item.x, y: item.y, w: item.w, h: item.h }, r => {
            if (item.kind === 'rect') slide.rect(item.name, r.x, r.y, r.w, r.h, item.fill);
            else slide.text(item.name, r.x, r.y, r.w, r.h, item.paragraphs);
          });
        });
        if (footerText && part.footBox) {
          // The footer owns the frame's OWN column, not a 360-wide strip that on a
          // side layout ran under the picture.  Same rect deckPlanOverlap checks.
          put('Footer', { x: part.footBox.x, y: part.footBox.y - 26, w: part.footBox.w, h: 34 },
            r => slide.text('Footer', r.x, r.y, r.w, r.h,
              [{ text: footerText.slice(0, 90), size: 13, colour: palette.mutedHex }]));
        }

        let worst = 0;
        emitted.forEach(shape => { worst = Math.max(worst, mapPptxRectOverlapArea(shape, picture)); });
        mapPptxDeckAudit.push({
          label: `${titleText || 'Diagram'}${part.total > 1 ? ' · ' + part.label : ''}`,
          index: part.index, total: part.total,
          page: { w: page.w, h: page.h }, mode: part.mode,
          picture: picture, shapes: emitted,
          minFontPt: Number(part.minFontPt) || 0,
          planOverlap: deckPlanOverlap(part),
          overlap: worst,
          pictureShare: (picture.w * picture.h) / (page.w * page.h)
        });
        // The picture joins the package only once the slide that points at it
        // exists, so a part that failed cannot leave a picture nothing references.
        media.push(asset);
        return slide.finish();
      }

      /* A DIAGRAM STOP AS ONE OR MORE SLIDES.  The plural is the point: this is
         where a tall diagram stops being a ribbon. */
      async function mapPptxDiagramSlides(diagramSvg, meta, palette, media) {
        const source = String(diagramSvg || '');
        const box = mapDeckDiagramBox(source);
        if (!box) return [];
        let rows = null;
        // Structure, so a cut lands in the air between two blocks rather than
        // through a sentence.  A picture that has no readable structure simply
        // does not get a vote and the planner cuts on even geometry.
        try { rows = deckDiagramRowProfile(source); } catch (error) { rows = null; }
        let plan = null;
        try {
          plan = deckPlanDiagramPages({
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            meta: meta || null,
            minFontPx: mapDeckSvgMinFontPx(source),
            // The whole reason this file looks different from the PDF.
            target: 'pptx',
            rows: rows
          });
        } catch (error) { plan = null; }
        const parts = (plan && plan.parts) || [];
        if (!parts.length) return [];

        // The smallest type on the slides that will actually be written - the
        // WORST part, not the unsplit whole, which after a split is a number no
        // slide in the file has.
        try {
          const worstScale = parts.reduce((least, p) => Math.min(least, p.picture.scale), Infinity);
          if (Number.isFinite(worstScale)) mapDeckNoteType((meta && meta.title) || 'Diagram', source, worstScale);
        } catch (error) { /* the small-type note is a courtesy, never a blocker */ }
        if (parts.length > 1) {
          mapPptxSplits.push({ title: String((meta && meta.title) || 'Diagram').slice(0, 60), parts: parts.length });
        }

        // Rasterise ONCE.  Every part is a CROP of that one canvas, so the picture
        // on a split slide is the stop's own picture, not a re-render of it.
        const want = clamp(2 * parts.reduce((most, p) => Math.max(most, p.picture.scale || 0), 0),
          DECK_PPTX_RASTER_MIN, DECK_PPTX_RASTER_MAX);
        const shot = await svgToCanvas(source, want, 'current');
        const canvas = shot && shot.canvas ? shot.canvas : shot;
        if (!canvas || !canvas.width) return [];
        const pxX = canvas.width / Math.max(1, box.width);
        const pxY = canvas.height / Math.max(1, box.height);

        // One diagram's pictures are STAGED and join the package together, so a
        // diagram that failed on its third part cannot leave two pictures behind
        // in a zip whose slides were all thrown away by the caller's catch.
        const staged = [];
        const out = [];
        for (let i = 0; i < parts.length; i += 1) {
          const part = parts[i];
          const crop = part.source || box;
          const sx = clamp(Math.round((crop.x - box.x) * pxX), 0, canvas.width - 1);
          const sy = clamp(Math.round((crop.y - box.y) * pxY), 0, canvas.height - 1);
          const sw = clamp(Math.round(crop.width * pxX), 1, canvas.width - sx);
          const sh = clamp(Math.round(crop.height * pxY), 1, canvas.height - sy);
          const asset = {
            name: `image${media.length + staged.length + 1}.jpg`,
            bytes: await canvasRegionToJpeg(canvas, sx, sy, sw, sh),
            width: sw, height: sh
          };
          const built = mapPptxDiagramPartSlide(part, asset, palette, staged);
          if (built) out.push(built);
        }
        staged.forEach(one => media.push(one));
        return out;
      }

      /* THE OLD NAME, KEPT.  One diagram, one slide - the first page of the plan.
         The deck itself asks for the plural, because a tall diagram is more than
         one slide and dropping the rest is exactly the ribbon this round fixes. */
      async function mapPptxDiagramSlide(diagramSvg, meta, palette, media) {
        const built = await mapPptxDiagramSlides(diagramSvg, meta, palette, media);
        return built.length ? built[0] : null;
      }

      /* What the export can say about itself, measured rather than asserted. */
      function mapPptxAuditNote() {
        const drawn = mapPptxDeckAudit.filter(row => !row.clipped);
        const bad = mapPptxDeckAudit.filter(row => (Number(row.overlap) || 0) > 0.01);
        if (bad.length) {
          return `deck: pptx frame OVER the picture on ${bad.length} slide(s): `
            + bad.map(row => row.label).join(', ');
        }
        return `deck: pptx wrote ${drawn.length} diagram slide(s); frame INTERSECT picture = 0 on every one`;
      }

      function mapPptxSplitNote() {
        if (!mapPptxSplits.length) return '';
        const list = mapPptxSplits.slice(0, 3).map(row => `${row.title} (${row.parts})`).join(', ');
        const more = mapPptxSplits.length > 3 ? `, and ${mapPptxSplits.length - 3} more` : '';
        return ` PowerPoint carries one slide size for a whole file, so `
          + `${mapPptxSplits.length === 1 ? 'a diagram too tall for it was' : 'diagrams too tall for it were'}`
          + ` split across slides: ${list}${more}.`;
      }
"""

A_LOOP = """            let built = null;
            try {
              const kind = view.target ? view.target.kind : 'map';
              // The whole-map stop is a title slide in the PDF too - mapViewSlideSvg
              // draws exactly this card for it - so it goes in as text, not a picture.
              const card = piece.card
                || (kind === 'card'
                  ? ((state.map && state.map.cards) || []).find(entry => entry.id === view.target.cardId)
                  : (kind === 'map'
                    ? { kind: 'title', eyebrow: 'Overview', title: state.projectName || 'The whole map',
                        body: `${state.diagrams.length} diagram${state.diagrams.length === 1 ? '' : 's'}` }
                    : null));
              if (card) {
                built = mapPptxCardSlide(card, palette, media);
                if (!built) {
                  const svg = piece.card ? mapCardSlideSvg(card, 1920, 1080) : await mapViewSlideSvg(view);
                  built = await mapPptxRasterSlide(svg, palette, media, card.title || mapViewLabel(view));
                  // Name the stop and the kind: an auditor who wants editable text
                  // has to know which slides did not get any, and why.
                  const meta = MAP_CARD_KINDS.find(entry => entry[0] === card.kind);
                  if (built) pictured.push(`stop ${index + 1} (${String((meta && meta[1]) || card.kind).toLowerCase()})`);
                }
              } else {
                // A step part brings its own view - the camera for that step - and
                // its own label; a plain stop is the whole picture, as before.
                const stopView = piece.view || view;
                const stopLabel = piece.label || mapViewLabel(view);
                // Every one of them gets the composition the PDF page gets, with the
                // eyebrow, the title and the footer as real text runs.
                const stopDiagram = state.diagrams.find(entry => entry.id === ((stopView.target || {}).diagramId));
                const stopMeta = mapDeckDiagramMeta(stopView, stopDiagram);
                // The SAME picture the PDF frames, node crop and all.
                const stopSvg = stopDiagram ? await mapViewDiagramSvg(stopView, stopDiagram) : null;
                if (stopSvg) {
                  const stopBox = mapDeckDiagramBox(stopSvg);
                  if (stopBox) mapDeckNoteType(stopMeta.title, stopSvg,
                    mapDeckFrameLayout(stopBox.width, stopBox.height, stopMeta).picture.scale);
                  built = await mapPptxDiagramSlide(stopSvg, stopMeta, palette, media);
                }
                // A renderer that gave nothing back still gets the old answer.
                if (!built) built = await mapPptxRasterSlide(await mapViewSlideSvg(stopView), palette, media, stopLabel);
              }
            } catch (error) {
              // One unwritable stop must not take the whole deck down silently.
              console.error('PowerPoint slide failed for stop', index + 1, error);
              built = null;
            }
            if (!built) { if (!failed.includes(index + 1)) failed.push(index + 1); continue; }
            slides.push(built);
            notes.push(piece.note);
"""

B_LOOP = """            // A stop is a LIST of slides now, not one: a diagram too tall to be
            // legible on a 16:9 slide comes back as several, because <p:sldSz> is
            // written once for the whole presentation and a portrait page is not
            // a thing PowerPoint has.
            let parcels = null;
            try {
              const kind = view.target ? view.target.kind : 'map';
              // The whole-map stop is a title slide in the PDF too - mapViewSlideSvg
              // draws exactly this card for it - so it goes in as text, not a picture.
              const card = piece.card
                || (kind === 'card'
                  ? ((state.map && state.map.cards) || []).find(entry => entry.id === view.target.cardId)
                  : (kind === 'map'
                    ? { kind: 'title', eyebrow: 'Overview', title: state.projectName || 'The whole map',
                        body: `${state.diagrams.length} diagram${state.diagrams.length === 1 ? '' : 's'}` }
                    : null));
              if (card) {
                let built = mapPptxCardSlide(card, palette, media);
                if (!built) {
                  const svg = piece.card ? mapCardSlideSvg(card, 1920, 1080) : await mapViewSlideSvg(view);
                  built = await mapPptxRasterSlide(svg, palette, media, card.title || mapViewLabel(view));
                  // Name the stop and the kind: an auditor who wants editable text
                  // has to know which slides did not get any, and why.
                  const meta = MAP_CARD_KINDS.find(entry => entry[0] === card.kind);
                  if (built) pictured.push(`stop ${index + 1} (${String((meta && meta[1]) || card.kind).toLowerCase()})`);
                }
                parcels = built ? [built] : null;
              } else {
                // A step part brings its own view - the camera for that step - and
                // its own label; a plain stop is the whole picture, as before.
                const stopView = piece.view || view;
                const stopLabel = piece.label || mapViewLabel(view);
                // Every one of them gets the composition the PDF page gets, with the
                // eyebrow, the title and the footer as real text runs.
                const stopDiagram = state.diagrams.find(entry => entry.id === ((stopView.target || {}).diagramId));
                const stopMeta = mapDeckDiagramMeta(stopView, stopDiagram);
                // The SAME picture the PDF frames, node crop and all.
                const stopSvg = stopDiagram ? await mapViewDiagramSvg(stopView, stopDiagram) : null;
                // The planner reads the small type off the parts it actually
                // returns, so mapDeckNoteType is no longer told the unsplit number.
                if (stopSvg) parcels = await mapPptxDiagramSlides(stopSvg, stopMeta, palette, media);
                // A renderer that gave nothing back still gets the old answer.
                if (!parcels || !parcels.length) {
                  const built = await mapPptxRasterSlide(await mapViewSlideSvg(stopView), palette, media, stopLabel);
                  parcels = built ? [built] : null;
                }
              }
            } catch (error) {
              // One unwritable stop must not take the whole deck down silently.
              console.error('PowerPoint slide failed for stop', index + 1, error);
              parcels = null;
            }
            if (!parcels || !parcels.length) { if (!failed.includes(index + 1)) failed.push(index + 1); continue; }
            // Every page of a split diagram carries the SAME note: it is one step,
            // said once, however many slides it takes to show it.
            parcels.forEach(one => { slides.push(one); notes.push(piece.note); });
"""

A_RESET = """        showToast(`Building the PowerPoint from ${route.length} stop${route.length === 1 ? '' : 's'}…`);
        mapDeckSmallType = [];
"""

B_RESET = """        showToast(`Building the PowerPoint from ${route.length} stop${route.length === 1 ? '' : 's'}…`);
        mapDeckSmallType = [];
        mapPptxDeckAudit = [];
        mapPptxSplits = [];
"""

A_TOAST = """            : '') + mapDeckSmallTypeNote(), 'success');
"""

B_TOAST = """            : '') + mapPptxSplitNote() + mapDeckSmallTypeNote(), 'success');
        // The rule the owner called a correctness rule, reported as a measurement
        // rather than as a promise.
        console.info(mapPptxAuditNote());
"""

# ------------------------------------------------------------------- apply ---

def die(message):
    raise SystemExit('ABORT: ' + message)


def main():
    if len(sys.argv) < 2:
        raise SystemExit('usage: fix_dx_pptx.py <path-to-SIREN.html>')
    path = sys.argv[1]
    src = open(path, 'r', encoding='utf-8', newline='').read()
    before = len(src)

    # -- pre-conditions -------------------------------------------------------
    if 'mapPptxDiagramSlides' in src:
        die('mapPptxDiagramSlides already present - already patched')
    for needed in ('function deckPlanDiagramPages(', 'function deckPlanOverlap(',
                   'function deckDiagramRowProfile('):
        if src.count(needed) != 1:
            die('%r found %d times - run fix_dx_rule.py first'
                % (needed, src.count(needed)))

    # -- the block replacement: the whole mapPptxDiagramSlide function ---------
    for name, needle in (('A_SLIDE_HEAD', A_SLIDE_HEAD), ('A_SLIDE_TAIL', A_SLIDE_TAIL)):
        if src.count(needle) != 1:
            die('%s found %d times, expected 1' % (name, src.count(needle)))
    start = src.index(A_SLIDE_HEAD)
    end = src.index(A_SLIDE_TAIL)
    if end <= start:
        die('slide anchors out of order')
    old_block = src[start:end]
    if len(old_block) > 9000:
        die('slide block is %d chars - that is not one function, the file drifted' % len(old_block))
    for token in A_SLIDE_TOKENS:
        if token not in old_block:
            die('slide block drifted, %r missing' % token)
    src = src[:start] + B_SLIDE + src[end:]

    # -- the surgical replacements -------------------------------------------
    for name, old, new in (('loop', A_LOOP, B_LOOP),
                           ('reset', A_RESET, B_RESET),
                           ('toast', A_TOAST, B_TOAST)):
        n = src.count(old)
        if n != 1:
            die('edit %r matched %d times, expected 1' % (name, n))
        src = src.replace(old, new, 1)

    # -- post-conditions ------------------------------------------------------
    for token in ('async function mapPptxDiagramSlides(',
                  'function mapPptxDiagramPartSlide(',
                  'async function mapPptxDiagramSlide(diagramSvg, meta, palette, media) {',
                  'function mapPptxKeepOffPicture(',
                  'function mapPptxAuditNote(',
                  'function mapPptxSplitNote('):
        if src.count(token) != 1:
            die('post-condition %r count %d' % (token, src.count(token)))
    # the old single-slide body must be gone
    for gone in ("slide.text('Footer', head.x, MAP_SLIDE.h - 58, Math.max(360, head.w), 34,",
                 "const layout = mapDeckFrameLayout(box.width, box.height, meta);"):
        if gone in src:
            die('the old diagram-slide body survived: %r' % gone)
    # `built` must no longer be the loop's own variable
    if 'let built = null;\n            try {' in src:
        die('the old per-stop single-slide loop survived')
    # shared primitives, untouched
    for untouched in ('function buildZip(entries) {',
                      'async function svgToCanvas(svgString, requestedScale, backgroundMode) {',
                      'async function canvasRegionToJpeg(sourceCanvas, sx, sy, sw, sh) {',
                      'function presentFitBox(contentW, contentH, boxX, boxY, boxW, boxH, mode) {',
                      'const PDF_MIN_FONT_PT = 9;',
                      'function getMinimumExportFontSize() {',
                      'function buildRasterPdf(pages, pageWidth, pageHeight) {',
                      'function deckPlanDiagramPages(request) {'):
        if src.count(untouched) != 1:
            die('shared primitive %r disturbed (count %d)' % (untouched, src.count(untouched)))
    # ONE slide size for the whole presentation - the constraint this all rests on
    if src.count('<p:sldSz cx="${WP_PPTX.width}" cy="${WP_PPTX.height}" type="screen16x9"/>') != 2:
        die('presentation.xml sldSz changed - PowerPoint keeps ONE slide size')

    # -- atomic write ---------------------------------------------------------
    folder = os.path.dirname(os.path.abspath(path)) or '.'
    handle, temp = tempfile.mkstemp(dir=folder, suffix='.tmp')
    try:
        with os.fdopen(handle, 'w', encoding='utf-8', newline='') as out:
            out.write(src)
        os.replace(temp, path)
    except BaseException:
        try:
            os.unlink(temp)
        except OSError:
            pass
        raise
    print('patched %s: %d -> %d chars (%+d)' % (path, before, len(src), len(src) - before))


if __name__ == '__main__':
    main()
