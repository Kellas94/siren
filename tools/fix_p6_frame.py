#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
fix_p6_frame.py -- DEFECT 1: nothing in Present is ever fitted to its frame.

    python fix_p6_frame.py <path-to-T_Industries_SIREN_v1.html>

Gives Present ONE fit-to-box primitive (presentFitBox) and routes the five
surfaces that must put a picture inside a rectangle through it:

  1. the deck's PDF page       - a diagram stop becomes a COMPOSED slide with the
                                 frame mapCardSlideSvg already draws, and the
                                 picture is fitted into the frame's well
  2. the deck's PowerPoint     - the same composition, with the eyebrow, the title
                                 and the footer as REAL <a:t> text runs
  3. the audience window       - #svg gets a definite box so height:100% resolves,
                                 and the plate gets a reserved band
  4. the Map tile              - .map-tile-body gets a definite grid area so
                                 object-fit:contain has something to contain into
  5. the title / section plate - a reserved band under the picture instead of a
                                 plate dropped on top of it

Every edit is anchored on text that must be present exactly once.  Nothing is
written unless every anchor matches; the write is atomic.
"""
import io
import os
import sys
import tempfile

TARGET_DEFAULT = r"C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html"


class Drift(Exception):
    pass


class Patch(object):
    def __init__(self, text):
        self.text = text
        self.log = []

    def sub(self, label, anchor, new, count=1):
        found = self.text.count(anchor)
        if found != count:
            raise Drift("%s: anchor found %d time(s), expected %d\n---\n%s\n---"
                        % (label, found, count, anchor[:400]))
        self.text = self.text.replace(anchor, new, count)
        self.log.append("%-34s  %+7d bytes" % (label, len(new) - len(anchor)))

    def must_absent(self, label, needle):
        if needle in self.text:
            raise Drift("%s: already patched (found %r)" % (label, needle[:80]))


# ---------------------------------------------------------------------------
# 1.  THE PRIMITIVE + the deck's frame layout.
#     Inserted immediately above mapCardSlideSvg, whose chrome it reuses.
# ---------------------------------------------------------------------------

ANCHOR_SLIDE_HEAD = """      /* ---------------- the slide ---------------- */

      function mapCardSlideSvg(card, width, height, revealShown) {"""

PRIMITIVE = r"""      /* =====================================================================
         FIT TO BOX - the rule Present did not have.

         Five surfaces have to put a picture inside a rectangle: the deck's PDF
         page, its PowerPoint twin, the audience screen, a Map tile and the plate
         that names the slide.  Each of them used to work out its own Math.min,
         or no Math.min at all, and so each of them got it wrong differently.
         They all ask this now.

         `contain` letterboxes, `cover` crops, `shrink` letterboxes but never
         enlarges.  The scale comes back with the rectangle because every caller
         that has to answer "is the type still legible" needs it, and slackX /
         slackY come back because the deck puts its frame in the slack rather
         than on top of the picture.

         A fit needs a DEFINITE box.  That is the whole of what was wrong on the
         audience screen and on the Map tile: the arithmetic was already right in
         CSS, but it was resolving against an auto height, so `height:100%`
         became `auto` and the picture fell back to its intrinsic size.
         ===================================================================== */
      function presentFitBox(contentW, contentH, boxX, boxY, boxW, boxH, mode) {
        const cw = Math.max(1, Number(contentW) || 1);
        const ch = Math.max(1, Number(contentH) || 1);
        const bw = Math.max(1, Number(boxW) || 1);
        const bh = Math.max(1, Number(boxH) || 1);
        let scale = mode === 'cover' ? Math.max(bw / cw, bh / ch) : Math.min(bw / cw, bh / ch);
        if (mode === 'shrink' && scale > 1) scale = 1;
        const w = cw * scale;
        const h = ch * scale;
        return {
          x: (Number(boxX) || 0) + (bw - w) / 2,
          y: (Number(boxY) || 0) + (bh - h) / 2,
          w: w, h: h, scale: scale, slackX: bw - w, slackY: bh - h
        };
      }

      /* An exported slide is not a live viewport: the page is a fixed 16:9 and the
         diagram should be COMPOSED into it, not merely dropped in the middle of it.
         So the frame goes in the slack the letterbox was wasting anyway - the side
         bars of a portrait diagram, the band above a wide one - and the picture
         keeps every pixel of the axis that constrains it.  That is the whole trick:
         on the two shapes an audit flowchart actually takes, the frame is free.
         `ceiling` is the scale the picture could have had with no frame at all, so
         the caller can say out loud when a frame did cost something. */
      const MAP_DECK_FRAME = { sideMin: 704, gutter: 64, bandMin: 176, bandMax: 360, foot: 72 };

      function mapDeckFrameLayout(contentW, contentH) {
        const W = MAP_SLIDE.w;
        const H = MAP_SLIDE.h;
        const full = presentFitBox(contentW, contentH, 0, 0, W, H, 'contain');
        if (full.slackX >= MAP_DECK_FRAME.sideMin) {
          // Portrait picture, landscape page: the title column lives in the bar the
          // letterbox left empty.  The picture keeps the full page height - it bleeds
          // on the axis that constrains it, and takes the page margin on the axis
          // that does not, which costs it nothing at all.
          return {
            mode: 'side',
            picture: { x: W - MAP_SLIDE.padX - full.w, y: (H - full.h) / 2, w: full.w, h: full.h, scale: full.scale },
            header: {
              x: MAP_SLIDE.padX, y: MAP_SLIDE.padTop,
              w: Math.max(360, W - full.w - MAP_SLIDE.padX * 2 - MAP_DECK_FRAME.gutter),
              h: H - MAP_SLIDE.padTop - MAP_SLIDE.padBottom
            },
            titleLines: 3, centreY: true, ceiling: full.scale
          };
        }
        // Everything else gets the house layout - eyebrow, title, rule, then the
        // picture below - with the band no deeper than the slack allows.  A wide
        // diagram is width-constrained, so a shorter well costs it nothing; only a
        // diagram that already fills the page pays, and there the loss is smallest.
        const band = clamp(Math.min(full.slackY - MAP_SLIDE.padBottom, MAP_DECK_FRAME.bandMax),
          MAP_DECK_FRAME.bandMin, MAP_DECK_FRAME.bandMax);
        const well = presentFitBox(contentW, contentH, 0, band, W, H - band - MAP_DECK_FRAME.foot, 'contain');
        // A very wide band leaves the well far taller than the picture. Sitting it in
        // the middle of the well puts it low on the page; the page's own middle reads
        // better, so it goes there whenever the header still clears it.
        const lowest = Math.max(band, H - MAP_DECK_FRAME.foot - well.h);
        const y = clamp((H - well.h) / 2, band, lowest);
        return {
          mode: 'band',
          picture: { x: well.x, y: y, w: well.w, h: well.h, scale: well.scale },
          header: {
            x: MAP_SLIDE.padX, y: MAP_SLIDE.padTop, w: W - MAP_SLIDE.padX * 2,
            h: Math.max(72, band - MAP_SLIDE.padTop - 24)
          },
          titleLines: 2, centreY: false, ceiling: full.scale
        };
      }

      /* The diagram's own rectangle, in its own coordinates.  x and y matter: a node
         stop's picture is the same SVG with a CROPPED viewBox, and throwing its
         origin away would silently un-crop it. */
      function mapDeckDiagramBox(svgString) {
        try {
          const doc = new DOMParser().parseFromString(String(svgString || ''), 'image/svg+xml');
          const root = doc.documentElement;
          if (!root || doc.querySelector('parsererror')) return null;
          const box = getSvgViewBox(root);
          if (!box || !(box.width > 0) || !(box.height > 0)) return null;
          return { x: box.x || 0, y: box.y || 0, width: box.width, height: box.height, root: root, doc: doc };
        } catch (error) { return null; }
      }

      /* What the eyebrow, the title and the footer say on a diagram slide.  The
         title is the stop's own label - the words already on the route chip and on
         the presenter's plate - so the deck and the room cannot disagree about what
         a slide is called.  For a plain diagram stop that label IS the diagram name,
         so the eyebrow says where the stop sits rather than repeating it. */
      function mapDeckDiagramMeta(view, diagram) {
        const route = (state.map && state.map.route) || [];
        const at = route.indexOf(view);
        const target = (view && view.target) || {};
        const name = diagram ? (diagram.name || diagram.diagramTitle || 'Diagram') : 'Diagram';
        return {
          title: mapViewLabel(view) || name,
          eyebrow: target.kind === 'nodes'
            ? name
            : (at >= 0 && route.length > 1 ? `Stop ${at + 1} of ${route.length}` : 'Walkthrough'),
          // Read exactly where mapCardSlideSvg reads it, so a diagram slide and a
          // content card carry the same footer or neither carries one.
          footer: String((state && state.projectName) || '').trim()
        };
      }

      /* The smallest type actually in the picture, in the picture's own pixels.
         PDF_MIN_FONT_PT and getMinimumExportFontSize already exist to stop the
         single-diagram export shipping a postage stamp; the deck never consulted
         either.  This is the deck's reading of the same question, taken from the
         rendered SVG rather than from the diagram's settings, so a per-block font
         override counts too. */
      function mapDeckSvgMinFontPx(svgString) {
        const sizes = [];
        String(svgString || '').replace(/font-size\s*[:=]\s*"?\s*([\d.]+)\s*(px)?/gi, (all, value) => {
          const size = Number(value);
          if (Number.isFinite(size) && size >= 4 && size <= 200) sizes.push(size);
          return all;
        });
        return sizes.length ? Math.min.apply(null, sizes) : 0;
      }

      /* One design pixel of a 1920x1080 slide is 720/1080 of a PDF point, because
         the deck page is 1280x720 and both are 16:9. */
      function mapDeckPointsPerSlidePx() { return 720 / MAP_SLIDE.h; }

      function mapDeckMinFontPt(svgString, scale) {
        const px = mapDeckSvgMinFontPx(svgString);
        if (!px) return 0;
        return px * (Number(scale) || 1) * mapDeckPointsPerSlidePx();
      }

      /* Stops whose smallest type lands under the app's own legibility floor. The
         deck cannot fix that by scaling - on one 16:9 page the ceiling is the page -
         so it says which stops and how small, which is what the author can act on. */
      let mapDeckSmallType = [];

      function mapDeckNoteType(label, svgString, scale) {
        const pt = mapDeckMinFontPt(svgString, scale);
        if (pt && pt < PDF_MIN_FONT_PT) {
          mapDeckSmallType.push(`${label} (${pt.toFixed(1)}pt)`);
        }
      }

      /* A sentence appended to the closing toast, not a toast of its own: showToast
         keeps ONE element on a 3.2s timer, so a second toast raised in the same tick
         replaces the first and the author never reads it.  The PowerPoint export
         already names its rasterised cards this way. */
      function mapDeckSmallTypeNote() {
        if (!mapDeckSmallType.length) return '';
        const list = mapDeckSmallType.slice(0, 3).join(', ');
        const more = mapDeckSmallType.length > 3 ? `, and ${mapDeckSmallType.length - 3} more` : '';
        return ` The smallest text on ${mapDeckSmallType.length === 1 ? 'one slide falls' : 'some slides falls'}`
          + ` under ${PDF_MIN_FONT_PT}pt at this page size: ${list}${more}.`
          + ' A horizontal layout, fewer blocks or a larger diagram font would lift it.';
      }

      /* ---------------- the slide ---------------- */

      function mapCardSlideSvg(card, width, height, revealShown) {"""


# ---------------------------------------------------------------------------
# 2.  The composed diagram slide (SVG) -- inserted after mapCardSlideSvg.
# ---------------------------------------------------------------------------

ANCHOR_MIRROR = """      /* ---------------- the plain-text mirror ---------------- */

      function mapSlideHtmlToText(html) {"""

DIAGRAM_SLIDE = r"""      /* ---------------- a diagram, given the same frame a card gets ----------------

         A content card has always arrived on a drawn slide: a background, the
         accent bar, an eyebrow, a title, a rule and a footer.  A diagram stop
         arrived as the bare rendered picture, letterboxed by the PDF writer into
         whatever shape it happened to be - 28% of the width for a tall flowchart,
         8% of the height for a wide one, with nothing on the page saying what it
         was.  Same chrome, same palette, same helpers; the picture is nested as a
         child <svg> with its own viewBox, so it is placed and scaled by
         mapDeckFrameLayout and clipped by nothing. */
      function mapDiagramSlideSvg(diagramSvg, meta) {
        const source = String(diagramSvg || '');
        const box = mapDeckDiagramBox(source);
        // If the picture cannot be read, the old behaviour is still the honest one.
        if (!box) return source;
        const safe = meta || {};
        const palette = mapSlidePalette();
        const W = MAP_SLIDE.w;
        const H = MAP_SLIDE.h;
        const layout = mapDeckFrameLayout(box.width, box.height);
        const head = layout.header;
        const body = [];

        let y = head.y;
        const eyebrow = String(safe.eyebrow || '').trim();
        const titleText = String(safe.title || '').trim();
        if (eyebrow) {
          const size = 38;
          y += size * 0.82;
          body.push(mapSlidePlainLineSvg(eyebrow.toUpperCase().slice(0, 90), head.x, y, size,
            palette.family, 700, palette.accent, 1, null));
          y += size * 0.5 + 26;
        }
        if (titleText) {
          const fitted = mapSlideFitTitle(titleText, head.w, 74, layout.titleLines, palette.family);
          let baseline = y + fitted.size * 0.80;
          fitted.lines.forEach(line => {
            body.push(mapSlideLineSvg(line, head.x, baseline, fitted.size, palette.family, 800, palette.fg, 1, null));
            baseline += fitted.size * 1.14;
          });
          y = baseline - fitted.size * 1.14 + fitted.size * 0.32;
        }
        if (eyebrow || titleText) {
          body.push(mapSlideRoundRect(head.x, y + 22, 116, 6, 3, palette.accent, 1, null, 0));
          y += 22 + 6;
        }
        // A side column is a tall empty bar with a title pinned to the top of it
        // unless the stack is centred in it - the same move mapCardSlideSvg makes
        // for a title card, for the same reason.
        let stack = body.join('');
        if (layout.centreY) {
          const shift = Math.round((head.h - (y - head.y)) / 2);
          if (Number.isFinite(shift) && Math.abs(shift) > 4) stack = `<g transform="translate(0,${mapSlideNum(shift)})">${stack}</g>`;
        }

        // The picture itself: a child <svg> carrying the diagram's own viewBox, so
        // preserveAspectRatio does the containing and nothing is ever cropped.
        let picture = '';
        try {
          const root = box.root;
          root.setAttribute('x', mapSlideNum(layout.picture.x));
          root.setAttribute('y', mapSlideNum(layout.picture.y));
          root.setAttribute('width', mapSlideNum(layout.picture.w));
          root.setAttribute('height', mapSlideNum(layout.picture.h));
          root.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
          root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          root.removeAttribute('style');
          picture = new XMLSerializer().serializeToString(root);
        } catch (error) { picture = ''; }
        if (!picture) return source;

        const chrome = [];
        chrome.push(`<rect width="${W}" height="${H}" fill="${mapEscapeXml(palette.bg)}"/>`);
        chrome.push(`<rect x="0" y="0" width="${W}" height="10" fill="${mapEscapeXml(palette.accent)}"/>`);
        const footerText = String(safe.footer || '').trim();
        if (footerText) {
          chrome.push(mapSlidePlainLineSvg(footerText.slice(0, 90), head.x, H - 48, 26,
            palette.family, 600, palette.muted, 0.7, null));
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
          + chrome.join('') + picture + stack + '</svg>';
      }

      /* The framed slide AND the numbers the caller needs to talk about it. */
      function mapDiagramSlideFramed(diagramSvg, meta) {
        const box = mapDeckDiagramBox(diagramSvg);
        const layout = box ? mapDeckFrameLayout(box.width, box.height) : null;
        return {
          svg: mapDiagramSlideSvg(diagramSvg, meta),
          layout: layout,
          minFontPt: layout ? mapDeckMinFontPt(diagramSvg, layout.picture.scale) : 0
        };
      }

      /* ---------------- the plain-text mirror ---------------- */

      function mapSlideHtmlToText(html) {"""


# ---------------------------------------------------------------------------
# 3.  Wire the PDF/deck path: mapViewSlideSvg frames every diagram result.
# ---------------------------------------------------------------------------

ANCHOR_VIEW_DIAGRAM = """        const diagram = state.diagrams.find(entry => entry.id === target.diagramId);
        if (!diagram) return null;
        const svg = await presentationSvgForDiagram(diagram);
        if (!svg) return null;
        if (target.kind === 'diagram' || !(target.nodeIds || []).length) return svg;
        // A node view crops the same picture rather than rendering a second one."""

NEW_VIEW_DIAGRAM = """        const diagram = state.diagrams.find(entry => entry.id === target.diagramId);
        if (!diagram) return null;
        // The picture and the slide are two jobs.  mapViewDiagramSvg answers "what
        // picture does this stop stand for" - the whole diagram, or the node crop -
        // and this composes it onto the page.  The PowerPoint driver asks the same
        // question, so the two files cannot end up looking at different crops.
        const picture = await mapViewDiagramSvg(view, diagram);
        if (!picture) return null;
        const meta = mapDeckDiagramMeta(view, diagram);
        const framed = mapDiagramSlideFramed(picture, meta);
        if (framed.layout) mapDeckNoteType(meta.title, picture, framed.layout.picture.scale);
        return framed.svg;
      }

      /* The rendered picture behind a diagram or node stop, in the diagram's own
         coordinates and with no slide chrome on it. */
      async function mapViewDiagramSvg(view, known) {
        const target = (view && view.target) || {};
        const diagram = known || state.diagrams.find(entry => entry.id === target.diagramId);
        if (!diagram) return null;
        const svg = await presentationSvgForDiagram(diagram);
        if (!svg) return null;
        if (target.kind === 'diagram' || !(target.nodeIds || []).length) return svg;
        // A node view crops the same picture rather than rendering a second one."""


# ---------------------------------------------------------------------------
# 3b. A node stop's crop landed off the top-left corner of the diagram, so it
#     exported as a BLANK slide in both files.  Found while verifying this fix.
# ---------------------------------------------------------------------------

ANCHOR_NODE_BBOX = """            let rect = null;
            try { rect = node.getBBox(); } catch (error) { rect = null; }
            if (!rect || !rect.width) return;"""

NEW_NODE_BBOX = """            let rect = null;
            try { rect = mapNodeBoxInDiagram(live, node); } catch (error) { rect = null; }
            if (!rect || !rect.width) return;"""

ANCHOR_NODE_HELPER = """      /* The rendered picture behind a diagram or node stop, in the diagram's own
         coordinates and with no slide chrome on it. */"""

NEW_NODE_HELPER = """      /* getBBox() answers in the NODE's own user space, and every mermaid block group
         carries a translate() that puts it where it actually is - block D of the AP
         flowchart measures (-108, -108, 216, 216) and lives at (195, 437).  The node
         crop read the first pair, so its viewBox pointed off the top-left corner of
         the diagram and a node stop exported as a BLANK slide in both the PDF and
         the PowerPoint.  Composed here through the standard matrix rather than by
         parsing the transform attribute, which would not survive a nested group. */
      function mapNodeBoxInDiagram(root, node) {
        const box = node.getBBox();
        if (!box || !box.width) return null;
        let matrix = null;
        try { matrix = root.getScreenCTM().inverse().multiply(node.getScreenCTM()); }
        catch (error) { matrix = null; }
        if (!matrix) return { x: box.x, y: box.y, width: box.width, height: box.height };
        const at = (x, y) => {
          const point = root.createSVGPoint();
          point.x = x;
          point.y = y;
          return point.matrixTransform(matrix);
        };
        const corners = [at(box.x, box.y), at(box.x + box.width, box.y),
          at(box.x, box.y + box.height), at(box.x + box.width, box.y + box.height)];
        const xs = corners.map(point => point.x);
        const ys = corners.map(point => point.y);
        const minX = Math.min.apply(null, xs);
        const minY = Math.min.apply(null, ys);
        return { x: minX, y: minY, width: Math.max.apply(null, xs) - minX, height: Math.max.apply(null, ys) - minY };
      }

      /* The rendered picture behind a diagram or node stop, in the diagram's own
         coordinates and with no slide chrome on it. */"""


# ---------------------------------------------------------------------------
# 4.  The PowerPoint twin: the same composition, with real text runs.
# ---------------------------------------------------------------------------

ANCHOR_PPTX_RASTER = """      const MAP_PPTX_TEXT_KINDS = ['title', 'text', 'table', 'facts', 'doc'];"""

PPTX_DIAGRAM = r"""      /* A DIAGRAM STOP AS A REAL SLIDE.  It used to be one picture stretched over
         the whole 12192000 x 6858000 canvas - which meant the recipient got a
         21%-wide strip of flowchart on an otherwise empty slide with not one
         <a:t> run on it: no title, no eyebrow, no footer, nothing to search, and
         nothing to edit.  The picture is still a picture, because a rendered
         diagram is one, but it is PLACED by mapDeckFrameLayout and the words
         around it are OOXML text, exactly as mapPptxCardSlide writes them. */
      async function mapPptxDiagramSlide(diagramSvg, meta, palette, media) {
        const source = String(diagramSvg || '');
        const box = mapDeckDiagramBox(source);
        if (!box) return null;
        const layout = mapDeckFrameLayout(box.width, box.height);
        const shot = await svgToCanvas(source, 2, 'current');
        const canvas = shot && shot.canvas ? shot.canvas : shot;
        if (!canvas || !canvas.width) return null;
        const asset = {
          name: `image${media.length + 1}.jpg`,
          bytes: await canvasRegionToJpeg(canvas, 0, 0, canvas.width, canvas.height),
          width: canvas.width,
          height: canvas.height
        };
        media.push(asset);

        const slidePalette = mapSlidePalette();
        const head = layout.header;
        const safe = meta || {};
        const eyebrow = String(safe.eyebrow || '').trim();
        const titleText = String(safe.title || '').trim();
        const footerText = String(safe.footer || '').trim();

        const slide = mapPptxNewSlide(palette);
        slide.rect('Accent bar', 0, 0, MAP_SLIDE.w, 10, palette.accentHex);
        slide.picture(titleText.slice(0, 90) || 'Diagram', asset,
          layout.picture.x, layout.picture.y, layout.picture.w, layout.picture.h);

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
          const fitted = mapSlideFitTitle(titleText, head.w, 74, layout.titleLines, slidePalette.family);
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
        if (layout.centreY) {
          const shift = Math.round((head.h - (y - head.y)) / 2);
          if (Number.isFinite(shift) && Math.abs(shift) > 4) stack.forEach(item => { item.y += shift; });
        }
        stack.forEach(item => {
          if (item.kind === 'rect') slide.rect(item.name, item.x, item.y, item.w, item.h, item.fill);
          else slide.text(item.name, item.x, item.y, item.w, item.h, item.paragraphs);
        });
        if (footerText) {
          slide.text('Footer', head.x, MAP_SLIDE.h - 58, Math.max(360, head.w), 34,
            [{ text: footerText.slice(0, 90), size: 13, colour: palette.mutedHex }]);
        }
        return slide.finish();
      }

      const MAP_PPTX_TEXT_KINDS = ['title', 'text', 'table', 'facts', 'doc'];"""


ANCHOR_PPTX_CALL = """              } else {
                built = await mapPptxRasterSlide(await mapViewSlideSvg(view), palette, media, mapViewLabel(view));
              }"""

NEW_PPTX_CALL = """              } else {
                // A diagram stop: the same composition the PDF gets, but the
                // eyebrow, the title and the footer are real text runs.
                const stopDiagram = state.diagrams.find(entry => entry.id === view.target.diagramId);
                const stopMeta = mapDeckDiagramMeta(view, stopDiagram);
                // The SAME picture the PDF frames, node crop and all.
                const stopSvg = stopDiagram ? await mapViewDiagramSvg(view, stopDiagram) : null;
                if (stopSvg) {
                  const stopBox = mapDeckDiagramBox(stopSvg);
                  if (stopBox) mapDeckNoteType(stopMeta.title, stopSvg,
                    mapDeckFrameLayout(stopBox.width, stopBox.height).picture.scale);
                  built = await mapPptxDiagramSlide(stopSvg, stopMeta, palette, media);
                }
                // A renderer that gave nothing back still gets the old answer.
                if (!built) built = await mapPptxRasterSlide(await mapViewSlideSvg(view), palette, media, mapViewLabel(view));
              }"""


# ---------------------------------------------------------------------------
# 5.  The two export drivers: reset and report the legibility floor.
# ---------------------------------------------------------------------------

ANCHOR_PPTX_START = """        showToast(`Building the PowerPoint from ${route.length} stop${route.length === 1 ? '' : 's'}…`);
        const palette = mapPptxPalette();"""

NEW_PPTX_START = """        showToast(`Building the PowerPoint from ${route.length} stop${route.length === 1 ? '' : 's'}…`);
        mapDeckSmallType = [];
        const palette = mapPptxPalette();"""

ANCHOR_PPTX_END = """          ? ` ${pictured.length === 1 ? 'One card is a drawing rather than words, so it went in as a picture' : `${pictured.length} cards are drawings rather than words, so they went in as pictures`}: ${pictured.join(', ')}.`
            : ''), 'success');"""

NEW_PPTX_END = """          ? ` ${pictured.length === 1 ? 'One card is a drawing rather than words, so it went in as a picture' : `${pictured.length} cards are drawings rather than words, so they went in as pictures`}: ${pictured.join(', ')}.`
            : '') + mapDeckSmallTypeNote(), 'success');"""

ANCHOR_PDF_START = """        if (format === 'pptx') return mapExportRoutePptx();
        showToast(`Building ${route.length} stop${route.length === 1 ? '' : 's'}…`);
        const slides = [];"""

NEW_PDF_START = """        if (format === 'pptx') return mapExportRoutePptx();
        showToast(`Building ${route.length} stop${route.length === 1 ? '' : 's'}…`);
        mapDeckSmallType = [];
        const slides = [];"""

ANCHOR_PDF_END = """          showToast(`${pages.length} slides exported as PDF.`, 'success');"""

NEW_PDF_END = """          showToast(`${pages.length} slides exported as PDF.` + mapDeckSmallTypeNote(), 'success');"""


# ---------------------------------------------------------------------------
# 6.  The Map tile: give .map-tile-body a DEFINITE grid area.
# ---------------------------------------------------------------------------

ANCHOR_TILE_CSS = """    .map-tile-body { position: relative; display: grid; place-items: center; padding: 24px; }
    .map-tile-body svg, .map-tile-image { max-width: 100%; max-height: 100%; }
    .map-tile-image { width: 100%; height: 100%; object-fit: contain; }"""

NEW_TILE_CSS = """    /* A tile is an index entry, not a page: its job is "which diagram is this",
       so it shows the WHOLE diagram, fitted.  It used to show the top of it -
       51%, 37% of the picture measured on a three-diagram map - because this
       grid had no explicit track.  A single auto row is sized by its content
       first, so the image's own 468px or 636px became the row, `height: 100%`
       resolved against THAT, and `object-fit: contain` had nothing to contain
       into.  minmax(0, 1fr) inside a definite-height tile is a definite box,
       which is all a fit ever needs. */
    .map-tile-body {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
      place-items: center;
      padding: 24px;
      min-width: 0;
      min-height: 0;
    }
    .map-tile-body > * { min-width: 0; min-height: 0; }
    .map-tile-body svg, .map-tile-image { max-width: 100%; max-height: 100%; }
    .map-tile-body svg { width: 100%; height: 100%; }
    .map-tile-image { width: 100%; height: 100%; object-fit: contain; }"""

ANCHOR_TILE_JS = """          mounted.removeAttribute('width');
          mounted.removeAttribute('height');
          mounted.style.width = '100%';
          mounted.style.height = '100%';"""

NEW_TILE_JS = """          mounted.removeAttribute('width');
          mounted.removeAttribute('height');
          mounted.style.width = '100%';
          mounted.style.height = '100%';
          // The same line loadPresentationDiagram sets on the stage: without it a
          // near-detail tile stretches its diagram to the tile instead of fitting it.
          mounted.setAttribute('preserveAspectRatio', 'xMidYMid meet');"""


# ---------------------------------------------------------------------------
# 7.  The title / section plate: a reserved band, not a plate on the picture.
# ---------------------------------------------------------------------------

ANCHOR_PLATE_CSS = """    .present-section-card {
      position: absolute;
      z-index: 25;
      left: 50%;
      top: 50%;
      width: min(560px, calc(100% - 48px));
      transform: translate(-50%, -50%);"""

NEW_PLATE_CSS = """    /* THE PLATE STOPPED SITTING ON THE PICTURE.  It was dropped at
       left:50%;top:50% over a stage that had been fitted to the FULL viewport, so
       at stage opacity 1 it covered whatever happened to be in the middle of the
       diagram.  A band is reserved for it instead: .present-stage is the fit box
       for the picture (its svg is width/height 100% of the content box), so
       padding-bottom shrinks that box and preserveAspectRatio re-fits the picture
       into what is left.  Nothing is ever underneath the plate.

       The depth of the band is the plate's own measured height, written here by
       presentReservePlateBand() - a guessed clamp is a guess, and at 1280x720 a
       guess was still 24px short of the plate. */
    .present-stage-shell { --present-plate-band: 0px; }
    .present-stage { padding-bottom: calc(18px + var(--present-plate-band, 0px)); }
    .present-section-card {
      position: absolute;
      z-index: 25;
      left: 50%;
      top: auto;
      bottom: 20px;
      width: min(560px, calc(100% - 48px));
      transform: translate(-50%, 0);"""


# ---------------------------------------------------------------------------
# 8.  The audience window: a definite box for #svg, and the same reserved band.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 7b. The band is measured, not guessed.
# ---------------------------------------------------------------------------

ANCHOR_PLATE_JS = """        updatePresentationSectionCard(entry);
        updatePresentationHeader();"""

NEW_PLATE_JS = """        updatePresentationSectionCard(entry);
        presentReservePlateBand();
        updatePresentationHeader();"""

ANCHOR_PLATE_FN = """      function updatePresentationHeader() {
        const diagram = getPresentationDiagram();"""

NEW_PLATE_FN = """      /* The plate names the slide; it must not stand on it.  The stage is the fit
         box for the picture - its svg is width and height 100% of the stage's
         CONTENT box - so reserving a band is a padding-bottom, and the picture
         re-fits itself into what is left.  The depth is the plate's own height,
         read back after it is shown, because a fixed clamp is a guess and the
         guess was 24px short at 1280x720. */
      function presentReservePlateBand() {
        const shell = el.presentStageShell;
        const card = el.presentSectionCard;
        if (!shell || !card) return;
        const depth = card.hidden ? 0 : Math.round(card.offsetHeight) + 40;
        shell.style.setProperty('--present-plate-band', `${depth}px`);
      }

      function updatePresentationHeader() {
        const diagram = getPresentationDiagram();"""

ANCHOR_PLATE_RESIZE = """        ctx.setTransform(dpr,0,0,dpr,0,0);ctx.lineCap='round';ctx.lineJoin='round';
      }"""

NEW_PLATE_RESIZE = """        ctx.setTransform(dpr,0,0,dpr,0,0);ctx.lineCap='round';ctx.lineJoin='round';
        // A resize changes the plate's own height (its heading is clamped against
        // vw), so the band it stands in is measured again here.
        presentReservePlateBand();
      }"""


ANCHOR_AUD = """#stage{position:relative;overflow:hidden}#stage svg{width:100%;height:100%;display:block}"""

NEW_AUD = ("""#stage{position:relative;overflow:hidden}"""
           """#svg{position:absolute;left:0;right:0;top:0;bottom:var(--band,0px)}"""
           """#stage svg{width:100%;height:100%;display:block}""")

ANCHOR_AUD_SECTION = """#section{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:70%;padding:24px;"""

NEW_AUD_SECTION = """#section{position:absolute;left:50%;top:auto;bottom:18px;transform:translate(-50%,0);max-width:70%;padding:24px;"""

# The audience window's own script reserves the band, from the plate's own height,
# on every state message AND on every resize - the plate's title wraps differently
# on a projector than in the window it was opened in.
ANCHOR_AUD_FN = """const ch=new BroadcastChannel(${channelName});const q=id=>document.getElementById(id);"""

NEW_AUD_FN = ("""const ch=new BroadcastChannel(${channelName});const q=id=>document.getElementById(id);"""
              """const band=()=>q('stage').style.setProperty('--band',"""
              """(q('section').hidden?0:q('section').offsetHeight+36)+'px');addEventListener('resize',band);""")

ANCHOR_AUD_JS = """q('section').hidden=!d.section?.visible;q('sectionTitle').textContent=d.section?.title||'';q('sectionSub').textContent=d.section?.subtitle||'';"""

NEW_AUD_JS = ("""q('section').hidden=!d.section?.visible;q('sectionTitle').textContent=d.section?.title||'';"""
              """q('sectionSub').textContent=d.section?.subtitle||'';band();""")


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else TARGET_DEFAULT
    if not os.path.isfile(target):
        print("no such file: %s" % target)
        return 2
    with io.open(target, "r", encoding="utf-8", newline="") as handle:
        original = handle.read()

    p = Patch(original)
    try:
        p.must_absent("already applied", "function presentFitBox(")

        p.sub("1  presentFitBox + layout", ANCHOR_SLIDE_HEAD, PRIMITIVE)
        p.sub("2  mapDiagramSlideSvg", ANCHOR_MIRROR, DIAGRAM_SLIDE)
        p.sub("3a deck path: split + frame", ANCHOR_VIEW_DIAGRAM, NEW_VIEW_DIAGRAM)
        p.sub("3b node crop: real coords", ANCHOR_NODE_BBOX, NEW_NODE_BBOX)
        p.sub("3c node crop: the matrix", ANCHOR_NODE_HELPER, NEW_NODE_HELPER)
        p.sub("4a mapPptxDiagramSlide", ANCHOR_PPTX_RASTER, PPTX_DIAGRAM)
        p.sub("4b pptx driver wiring", ANCHOR_PPTX_CALL, NEW_PPTX_CALL)
        p.sub("5a pptx: reset floor", ANCHOR_PPTX_START, NEW_PPTX_START)
        p.sub("5b pptx: report floor", ANCHOR_PPTX_END, NEW_PPTX_END)
        p.sub("5c pdf: reset floor", ANCHOR_PDF_START, NEW_PDF_START)
        p.sub("5d pdf: report floor", ANCHOR_PDF_END, NEW_PDF_END)
        p.sub("6a map tile: definite box", ANCHOR_TILE_CSS, NEW_TILE_CSS)
        p.sub("6b map tile: preserveAR", ANCHOR_TILE_JS, NEW_TILE_JS)
        p.sub("7a plate: reserved band", ANCHOR_PLATE_CSS, NEW_PLATE_CSS)
        p.sub("7b plate: measure the band", ANCHOR_PLATE_FN, NEW_PLATE_FN)
        p.sub("7c plate: measure on step", ANCHOR_PLATE_JS, NEW_PLATE_JS)
        p.sub("7d plate: measure on resize", ANCHOR_PLATE_RESIZE, NEW_PLATE_RESIZE)
        p.sub("8a audience: definite box", ANCHOR_AUD, NEW_AUD)
        p.sub("8b audience: plate to band", ANCHOR_AUD_SECTION, NEW_AUD_SECTION)
        p.sub("8c audience: band()", ANCHOR_AUD_FN, NEW_AUD_FN)
        p.sub("8d audience: measure band", ANCHOR_AUD_JS, NEW_AUD_JS)
    except Drift as error:
        print("ABORTED, nothing written.\n%s" % error)
        return 1

    folder = os.path.dirname(os.path.abspath(target)) or "."
    fd, tmp = tempfile.mkstemp(dir=folder, suffix=".tmp")
    os.close(fd)
    with io.open(tmp, "w", encoding="utf-8", newline="") as handle:
        handle.write(p.text)
    os.replace(tmp, target)

    for line in p.log:
        print("  " + line)
    print("  %-34s  %+7d bytes" % ("TOTAL", len(p.text) - len(original)))
    print("wrote %s (%d bytes)" % (target, len(p.text)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
