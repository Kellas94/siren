#!/usr/bin/env python3
# =============================================================================
# fix_dx_rule.py  --  ONE decision: how a diagram becomes pages.
#
#   usage:  python fix_dx_rule.py <path-to-SIREN.html>
#
# Anchor-guarded, atomic, abort-on-drift.  Every anchor must appear exactly
# once or nothing is written.  The target file is replaced by os.replace on a
# sibling temp file, so a half-written app can never exist on disk.
#
# WHAT THIS INSTALLS
# ------------------
# deckPlanDiagramPages(request) -> plan.  A pure function.  Given the picture's
# box, the frame's words, the target format and (optionally) the diagram's row
# structure, it answers all three questions at once, because they are one:
#
#   1. Does the frame fit without touching the picture?
#      The frame's band is RESERVED FIRST and the picture is fitted to what is
#      left.  Nothing is ever fitted to the full page "hoping for slack".
#      Guarantee: picture INTERSECT (accent bar U header U footer) = 0 on every
#      page.  deckPlanOverlap(part) returns that area so a caller can assert on
#      it rather than trust it.
#
#   2. Landscape or portrait?
#      aspect = round(height/width, 2).  Portrait when aspect >= 1.25.
#      A frozen constant, derived once (see DECK_PORTRAIT_ASPECT below).
#
#   3. One page or several?
#      minFontPt = minFontPx * picture.scale * (720/1080).  Under
#      PDF_MIN_FONT_PT the diagram is cut into horizontal parts, on structural
#      gaps, at the cut that crosses the fewest edges, with an overlap of about
#      one and a quarter block pitches, and every part is labelled.
#
# WHAT THIS DOES NOT DO
# ---------------------
# It writes no PDF and no PPTX.  buildRasterPdf, buildZip, svgToCanvas,
# showToast, PDF_MIN_FONT_PT and getMinimumExportFontSize are NOT touched.
# mapExportRoute and mapExportRoutePptx are NOT touched.
#
# LOUD NOTE FOR THE PDF AGENT: buildRasterPdf(pages, pageWidth, pageHeight)
# takes ONE page size for the whole document.  Portrait pages need a per-page
# MediaBox.  That signature change is yours; the plan already carries
# part.page.pdfW / part.page.pdfH per page so you never have to derive it.
#
# LOUD NOTE FOR THE PPTX AGENT: pass target:'pptx'.  The plan then never
# returns portrait; a tall diagram comes back as several LANDSCAPE parts, so
# presentation.xml keeps one sldSz and the file stays one editable deck.
# =============================================================================
import sys, os, tempfile

# ---------------------------------------------------------------- anchors ---

A_HEAD = '      const MAP_DECK_FRAME = { sideMin: 704, gutter: 64, bandMin: 176, bandMax: 360, foot: 72 };\n'
A_TAIL = '          titleLines: 2, centreY: false, ceiling: full.scale\n        };\n      }\n'

A_SIG = """      function mapDiagramSlideSvg(diagramSvg, meta) {
        const source = String(diagramSvg || '');
        const box = mapDeckDiagramBox(source);
        // If the picture cannot be read, the old behaviour is still the honest one.
        if (!box) return source;
        const safe = meta || {};
        const palette = mapSlidePalette();
        const W = MAP_SLIDE.w;
        const H = MAP_SLIDE.h;
        const layout = mapDeckFrameLayout(box.width, box.height);
"""

B_SIG = """      function mapDiagramSlideSvg(diagramSvg, meta, part) {
        const source = String(diagramSvg || '');
        const box = mapDeckDiagramBox(source);
        // If the picture cannot be read, the old behaviour is still the honest one.
        if (!box) return source;
        const safe = meta || {};
        const palette = mapSlidePalette();
        // `part` is ONE PAGE of a deckPlanDiagramPages plan: its own page size, its
        // own crop of the diagram, its own frame rects.  Without one this is the
        // single landscape page the deck has always drawn - now planned frame-first,
        // so the header can no longer be painted over the picture.
        const layout = part || mapDeckFrameLayout(box.width, box.height, meta);
        const W = layout.page ? layout.page.w : MAP_SLIDE.w;
        const H = layout.page ? layout.page.h : MAP_SLIDE.h;
"""

A_EYE = """        let y = head.y;
        const eyebrow = String(safe.eyebrow || '').trim();
        const titleText = String(safe.title || '').trim();
        if (eyebrow) {
          const size = 38;
          y += size * 0.82;
          body.push(mapSlidePlainLineSvg(eyebrow.toUpperCase().slice(0, 90), head.x, y, size,
            palette.family, 700, palette.accent, 1, null));
"""

B_EYE = """        let y = head.y;
        // A part carries its own eyebrow, because that is where 'Part 2 of 4' is said.
        const eyebrow = String((part && part.eyebrow) || safe.eyebrow || '').trim();
        const titleText = String(safe.title || '').trim();
        if (eyebrow) {
          const size = 38;
          y += size * 0.82;
          body.push(mapSlidePlainLineSvg(eyebrow.toUpperCase().slice(0, 90), head.x, y, size,
            palette.family, 700, palette.accent, 1, null));
"""

A_VB = "          root.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);\n"
B_VB = ("          // A part draws a CROP of the same picture; a whole page draws all of it.\n"
        "          const crop = (part && part.source) || box;\n"
        "          root.setAttribute('viewBox', `${crop.x} ${crop.y} ${crop.width} ${crop.height}`);\n")

A_FOOT = """        const footerText = String(safe.footer || '').trim();
        if (footerText) {
          chrome.push(mapSlidePlainLineSvg(footerText.slice(0, 90), head.x, H - 48, 26,
            palette.family, 600, palette.muted, 0.7, null));
        }
"""

B_FOOT = """        const footerText = String(safe.footer || '').trim();
        if (footerText) {
          // Wrapped to the header's own width and cut to one line, so on a side
          // layout the footer stays inside the reserved column instead of running
          // under the picture.  The frame owns a COLUMN there, not a strip.
          const footLine = mapSlideWrapRuns([{ text: footerText.slice(0, 120) }], head.w, 26,
            palette.family, 600)[0];
          if (footLine) {
            chrome.push(mapSlideLineSvg(footLine, head.x, H - 48, 26,
              palette.family, 600, palette.muted, 0.7, null));
          }
        }
"""

A_FRAMED = """      function mapDiagramSlideFramed(diagramSvg, meta) {
        const box = mapDeckDiagramBox(diagramSvg);
        const layout = box ? mapDeckFrameLayout(box.width, box.height) : null;
        return {
          svg: mapDiagramSlideSvg(diagramSvg, meta),
          layout: layout,
          minFontPt: layout ? mapDeckMinFontPt(diagramSvg, layout.picture.scale) : 0
        };
      }
"""

B_FRAMED = """      function mapDiagramSlideFramed(diagramSvg, meta, part) {
        const box = mapDeckDiagramBox(diagramSvg);
        const layout = part || (box ? mapDeckFrameLayout(box.width, box.height, meta) : null);
        return {
          svg: mapDiagramSlideSvg(diagramSvg, meta, part),
          layout: layout,
          minFontPt: layout ? mapDeckMinFontPt(diagramSvg, layout.picture.scale) : 0,
          // 0 on every page this planner returns.  A writer that moves a rect finds
          // out here that it broke the one rule the owner called a correctness rule.
          overlap: layout ? deckPlanOverlap(layout) : 0
        };
      }
"""

A_PPTX = """        const box = mapDeckDiagramBox(source);
        if (!box) return null;
        const layout = mapDeckFrameLayout(box.width, box.height);
        const shot = await svgToCanvas(source, 2, 'current');
"""
B_PPTX = """        const box = mapDeckDiagramBox(source);
        if (!box) return null;
        const layout = mapDeckFrameLayout(box.width, box.height, meta);
        const shot = await svgToCanvas(source, 2, 'current');
"""

A_NOTE = """                  if (stopBox) mapDeckNoteType(stopMeta.title, stopSvg,
                    mapDeckFrameLayout(stopBox.width, stopBox.height).picture.scale);
"""
B_NOTE = """                  if (stopBox) mapDeckNoteType(stopMeta.title, stopSvg,
                    mapDeckFrameLayout(stopBox.width, stopBox.height, stopMeta).picture.scale);
"""

# ------------------------------------------------------------ the new code ---

NEW = r"""      /* =====================================================================
         HOW A DIAGRAM BECOMES PAGES.

         Three questions that are one decision, so they are answered in one
         place by one pure function and both writers read the same answer.

         THE OLD SHAPE AND WHY IT FAILED.  mapDeckFrameLayout fitted the picture
         to the WHOLE page and then put the frame "in the slack".  When a
         picture is near square there is no slack, so the two occupied the same
         pixels and the title was painted across the flowchart.  Measured on the
         real export, a 0.69-aspect stop laid 76,193 square slide-pixels of
         title text on top of its own diagram.  That is inverted here: the
         frame's band is reserved FIRST and the picture is fitted to what
         remains.  It is not a tuned constant, it is an ordering, so it cannot
         fail on a shape nobody tested.

         WHAT A PLAN IS.  deckPlanDiagramPages(request) -> plan.

           request = {
             box:        { x, y, width, height },   // the diagram's viewBox
             meta:       { eyebrow, title, footer } | null,
             minFontPx:  Number,   // smallest glyph IN DIAGRAM UNITS, 0 = unknown
             target:     'pdf' | 'pptx',
             rows:       deckDiagramRowProfile(svg) | null,
             allowPortrait: Boolean,  // default: target !== 'pptx'
             minParts:   Number       // floor on the split, for matched decks
           }

           plan = {
             orientation, page, aspect, portraitAt, portraitWanted, vetoed,
             floorPt, minFontPtWhole, ptPerPx,
             split: { parts, reason, capped, overlapUser, maxPartHeight, cuts, structural },
             parts: [ part, ... ]
           }

           part = {
             index, total, label,               // 'Part 2 of 4'
             eyebrow, title, footer,            // the words THIS page says
             page:    { w, h, pdfW, pdfH, orientation },
             mode:    'side' | 'band',
             source:  { x, y, width, height },  // the sub-viewBox this page draws
             picture: { x, y, w, h, scale },    // where it sits, in page pixels
             header:  { x, y, w, h },
             footBox: { x, y, w },
             titleLines, centreY, minFontPt, overlapWith
           }

         THE GUARANTEE.  For every part, the picture rect shares zero area with
         the accent bar, the header rect and the footer band.  True by
         construction - the picture is fitted into a box that starts below or
         beside those rects - and deckPlanOverlap(part) hands the number back.

         THE PAGE.  Two page sizes, both 16:9, both 720/1080 of a PDF point per
         design pixel, so a point measured on one page means the same on the
         other.  PowerPoint defines slide size once for a whole presentation, so
         portrait is a PDF-only answer: with target 'pptx' the plan keeps the
         landscape page and splits instead.
         ===================================================================== */

      const DECK_PAGE = {
        landscape: { w: 1920, h: 1080, pdfW: 1280, pdfH: 720, orientation: 'landscape' },
        portrait:  { w: 1080, h: 1920, pdfW: 720,  pdfH: 1280, orientation: 'portrait' }
      };

      const DECK_PT_PER_PX = 720 / 1080;

      /* The frame's parts, in design pixels.  `colMin` and `footBand` are
         RESERVATIONS - the picture is never allowed into them - and everything
         else is what the drawing code in mapDiagramSlideSvg actually emits. */
      const DECK_FRAME = {
        accent: 10,      // the full-width accent bar across the top of every page
        topClear: 24,    // what a picture must leave under that bar
        botClear: 24,
        gutter: 64,      // between the header column and the picture
        colMin: 560,     // the header column, reserved before the picture is fitted
        gapUnder: 34,    // between the frame's rule and the picture below it
        footBand: 96,    // the strip at the foot of the page the footer line owns
        eyebrowSize: 38, titleSize: 74, ruleGap: 22, ruleH: 6
      };

      /* WHEN A DIAGRAM GOES PORTRAIT.  The owner's rule is "taller than it is
         wide", calibrated against a slide he accepts as correct: a five-block
         diagram of aspect ~1.05 beside its title, every label legible, which
         must KEEP the composed landscape slide.  So the boundary sits above
         1.05, and "meaningfully taller" has to be made to mean something.

         It means this.  1.25 is just above the portrait page's OWN picture
         well, which is 1080 x 1330 = 1.232 once the frame is reserved with the
         deepest title band a portrait page can draw.  A diagram at or over 1.25
         is height-bound in that well - it USES the portrait page rather than
         merely fitting on it - and it clears the owner's 1.05 reference by 19%,
         far more than the error in measuring an aspect off a photograph.

         It is a FROZEN CONSTANT, not a recomputed one.  Deriving it per export
         from the actual title's band would make the threshold move with the
         words on the slide, which is exactly the flip-flop to avoid.

         STABILITY.  The aspect is quantised to two decimals before the compare
         and the compare is a plain >=, so the answer is a pure function of a
         two-decimal number: the same diagram always gets the same page, and a
         re-render has to move the ratio by a full 0.005 to change anything.
         A diagram within about 2% of 1.25 is the only place a font substitution
         on another machine could move the answer, and there both orientations
         clear the legibility floor by a wide margin - the page shape would
         change, never the readability. */
      const DECK_PORTRAIT_ASPECT = 1.25;
      const DECK_ASPECT_DP = 2;

      /* Past six pages a "diagram" is a document, and the honest answer is to
         say the type is too small rather than to keep halving. */
      const DECK_MAX_PARTS = 6;
      const DECK_SNAP_WINDOW = 0.15;   // how far a cut may hunt for a real gap

      function deckQuantiseAspect(ratio) {
        const value = Number(ratio);
        if (!Number.isFinite(value) || !(value > 0)) return 1;
        const q = Math.pow(10, DECK_ASPECT_DP);
        return Math.round(value * q + 1e-9) / q;
      }

      /* THE FRAME'S REAL HEIGHT, in the frame's own arithmetic.  This mirrors
         mapDiagramSlideSvg line for line - eyebrow rise, gap, fitted title
         baselines, rule - so the band that is RESERVED and the band that is
         DRAWN are the same number and cannot drift apart.  Measured against the
         running app it is exact: 291.04px for a one-line title, 375.40px for
         two, which is what the rendered slides report to 0.01px.

         meta === null means "no words to measure": reserve the worst case this
         page could ever draw, so an unlabelled caller is over-served, never
         under-served. */
      function deckFrameStackHeight(meta, headerW, maxLines) {
        const F = DECK_FRAME;
        const lines = Math.max(1, Number(maxLines) || 1);
        const width = Math.max(160, Number(headerW) || 160);
        const eyebrowBlock = F.eyebrowSize * 0.82 + F.eyebrowSize * 0.5 + 26;
        const titleBlock = (size, count) => size * 0.80 + count * size * 1.14 - size * 1.14 + size * 0.32;
        if (!meta) {
          return {
            h: eyebrowBlock + titleBlock(F.titleSize, lines) + F.ruleGap + F.ruleH,
            titleSize: F.titleSize, titleLines: lines
          };
        }
        const eyebrow = String(meta.eyebrow || '').trim();
        const title = String(meta.title || '').trim();
        let h = 0;
        let size = F.titleSize;
        let drawn = 0;
        if (eyebrow) h += eyebrowBlock;
        if (title) {
          let fitted = null;
          try { fitted = mapSlideFitTitle(title, width, F.titleSize, lines, mapSlidePalette().family); }
          catch (error) { fitted = null; }
          size = fitted ? fitted.size : F.titleSize;
          drawn = fitted ? fitted.lines.length : lines;
          h += titleBlock(size, drawn);
        }
        if (eyebrow || title) h += F.ruleGap + F.ruleH;
        return { h: h, titleSize: size, titleLines: drawn || lines };
      }

      /* THE HOUSE LAYOUT: eyebrow, title, rule, then the picture below.  The
         band is the frame's measured height plus a gap - never a constant a
         longer title can overflow - and the picture gets exactly the rest. */
      function deckComposeBand(cw, ch, page, meta) {
        const F = DECK_FRAME;
        const padX = MAP_SLIDE.padX;
        const headerW = Math.max(240, page.w - padX * 2);
        const maxLines = page.w >= page.h ? 2 : 3;
        const frame = deckFrameStackHeight(meta, headerW, maxLines);
        const band = Math.max(F.accent + F.topClear, MAP_SLIDE.padTop + frame.h + F.gapUnder);
        const boxH = Math.max(120, page.h - band - F.footBand);
        const fit = presentFitBox(cw, ch, 0, band, page.w, boxH, 'contain');
        return {
          mode: 'band', page: page,
          picture: { x: fit.x, y: fit.y, w: fit.w, h: fit.h, scale: fit.scale },
          header: { x: padX, y: MAP_SLIDE.padTop, w: headerW, h: Math.max(40, frame.h) },
          footBox: { x: padX, y: page.h - 48, w: headerW },
          box: { x: 0, y: band, w: page.w, h: boxH },
          titleLines: maxLines, centreY: false
        };
      }

      /* THE COLUMN LAYOUT: the title lives in a reserved column and the picture
         takes the rest of the width at full page height.  The column is
         reserved BEFORE the fit, which is the whole difference from the old
         code; the picture is then right-aligned in what is left and the column
         takes back whatever the picture did not use.  A column that can only
         grow can never reach the picture. */
      function deckComposeSide(cw, ch, page, meta) {
        const F = DECK_FRAME;
        const padX = MAP_SLIDE.padX;
        const boxX = padX + F.colMin + F.gutter;
        const boxW = Math.max(160, page.w - padX - F.colMin - F.gutter - padX);
        const boxY = F.accent + F.topClear;
        const boxH = Math.max(160, page.h - boxY - F.botClear);
        const fit = presentFitBox(cw, ch, boxX, boxY, boxW, boxH, 'contain');
        const picX = boxX + (boxW - fit.w);
        const headerW = Math.max(F.colMin, picX - F.gutter - padX);
        const frame = deckFrameStackHeight(meta, headerW, 3);
        return {
          mode: 'side', page: page,
          picture: { x: picX, y: fit.y, w: fit.w, h: fit.h, scale: fit.scale },
          header: { x: padX, y: MAP_SLIDE.padTop, w: headerW,
            h: Math.max(40, page.h - MAP_SLIDE.padTop - MAP_SLIDE.padBottom) },
          footBox: { x: padX, y: page.h - 48, w: headerW },
          box: { x: boxX, y: boxY, w: boxW, h: boxH },
          titleLines: 3, centreY: true, frameH: frame.h
        };
      }

      /* Both compositions reserve the frame, so neither can collide; the
         picture takes whichever leaves it larger.  A wide diagram lands in the
         band because a full-bleed 1920 beats a 1056 column; a tall one lands in
         the column because 1032 of page height beats a shallow well. */
      function deckComposePage(cw, ch, page, meta, mode) {
        if (mode === 'band') return deckComposeBand(cw, ch, page, meta);
        if (mode === 'side') return deckComposeSide(cw, ch, page, meta);
        const band = deckComposeBand(cw, ch, page, meta);
        const side = deckComposeSide(cw, ch, page, meta);
        return side.picture.scale > band.picture.scale * 1.0001 ? side : band;
      }

      /* WHERE A CUT MAY LAND.  Read off the SERIALISED picture, so this needs no
         mounted tile and no layout pass: a flowchart node is a
         <g class="node ..." transform="translate(cx, cy)"> holding its own
         label-container rect, and every edge carries its polyline in
         data-points as base64 JSON.  A diagram that answers neither - a
         sequence chart, a picture from some other renderer - comes back
         ok:false and the planner cuts on even geometry instead, which is honest
         rather than wrong. */
      function deckDiagramRowProfile(svgString) {
        const src = String(svgString || '');
        const nodes = [];
        const edges = [];
        if (src) {
          const open = /<g\b[^>]*class="[^"]*\bnode\b[^"]*"[^>]*>/g;
          let m;
          while ((m = open.exec(src))) {
            const tag = m[0];
            const t = /transform="translate\(\s*(-?[\d.]+)\s*[, ]\s*(-?[\d.]+)\s*\)"/.exec(tag);
            if (!t) continue;
            const cx = Number(t[1]);
            const cy = Number(t[2]);
            const rect = /<rect\b[^>]*class="[^"]*label-container[^"]*"[^>]*>/.exec(src.slice(m.index, m.index + 1600));
            const num = (name) => {
              if (!rect) return NaN;
              const q = new RegExp('\\s' + name + '="(-?[\\d.]+)"').exec(rect[0]);
              return q ? Number(q[1]) : NaN;
            };
            let w = num('width');
            let h = num('height');
            let rx = num('x');
            let ry = num('y');
            if (!Number.isFinite(w) || !(w > 0)) w = 120;
            if (!Number.isFinite(h) || !(h > 0)) h = 48;
            if (!Number.isFinite(rx)) rx = -w / 2;
            if (!Number.isFinite(ry)) ry = -h / 2;
            nodes.push({
              id: (/data-node-id="([^"]*)"/.exec(tag) || [])[1] || '',
              x: cx + rx, y: cy + ry, w: w, h: h
            });
          }
          const pts = /data-points="([A-Za-z0-9+/=]+)"/g;
          let e;
          while ((e = pts.exec(src))) {
            try {
              const arr = JSON.parse(atob(e[1]));
              if (Array.isArray(arr) && arr.length > 1) {
                edges.push(arr.map(p => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 })));
              }
            } catch (error) { /* an unreadable edge simply does not get a vote */ }
          }
        }
        const centres = nodes.map(n => n.y + n.h / 2).sort((a, b) => a - b);
        const steps = [];
        for (let i = 1; i < centres.length; i += 1) {
          const d = centres[i] - centres[i - 1];
          if (d > 1) steps.push(d);
        }
        steps.sort((a, b) => a - b);
        return {
          ok: nodes.length > 1,
          nodes: nodes, edges: edges,
          pitch: steps.length ? steps[Math.floor(steps.length / 2)] : 0
        };
      }

      /* The horizontal bands no block occupies - the only places a cut is
         allowed, because a cut through a block is a cut through a sentence. */
      function deckRowGaps(profile) {
        const boxes = ((profile && profile.nodes) || []).map(n => ({ a: n.y, b: n.y + n.h }))
          .sort((p, q) => p.a - q.a);
        const gaps = [];
        let reach = null;
        boxes.forEach(box => {
          if (reach !== null && box.a > reach) gaps.push({ y0: reach, y1: box.a });
          reach = reach === null ? box.b : Math.max(reach, box.b);
        });
        return gaps.filter(gap => gap.y1 - gap.y0 >= 4);
      }

      function deckEdgesCrossing(profile, y) {
        const edges = (profile && profile.edges) || [];
        let count = 0;
        for (let i = 0; i < edges.length; i += 1) {
          const line = edges[i];
          for (let k = 1; k < line.length; k += 1) {
            const a = line[k - 1].y;
            const b = line[k].y;
            if ((a < y && b >= y) || (b < y && a >= y)) { count += 1; break; }
          }
        }
        return count;
      }

      /* AN EDGE HUNTS FOR AIR.  Within its window it looks for the gap that
         costs the fewest crossed connectors; ties go to the edge nearest where
         the arithmetic wanted it, and a wider gap earns a small bonus because it
         reads as a seam.  It never lands closer than `air` to a block, so a page
         edge cannot shave the top off a label.

         What is snapped is the PAGE EDGE, not a notional cut.  A join has two
         visible edges - where one page stops and where the next one starts - and
         both of them are seen by a reader, so both are snapped.  Snapping only
         the midpoint of the overlap is what sliced 'Reperform accruals' in half
         at the foot of page 1 the first time this was measured. */
      function deckSnapCut(nominal, window, gaps, profile) {
        if (!(window > 0) || !gaps.length) return nominal;
        let best = null;
        gaps.forEach(gap => {
          const air = Math.min(6, (gap.y1 - gap.y0) / 2);
          const c = Math.min(Math.max(nominal, gap.y0 + air), gap.y1 - air);
          if (!(Math.abs(c - nominal) <= window)) return;
          const cost = deckEdgesCrossing(profile, c) * 10000
            + Math.abs(c - nominal) - Math.min(gap.y1 - gap.y0, 40);
          if (!best || cost < best.cost) best = { c: c, cost: cost };
        });
        return best ? best.c : nominal;
      }

      /* A join is the band two pages share: `lo` is where the next page starts,
         `hi` is where the previous page stops, and hi > lo is the overlap a
         reader rejoins the halves by. */
      function deckPartBounds(joins, y0, ch) {
        const end = y0 + ch;
        const out = [];
        for (let i = 0; i <= joins.length; i += 1) {
          const a = i === 0 ? y0 : joins[i - 1].lo;
          const b = i === joins.length ? end : joins[i].hi;
          out.push({ y0: Math.max(y0, Math.min(a, end)), y1: Math.min(end, Math.max(b, y0)) });
        }
        return out;
      }

      function deckPartMeta(meta, index, total) {
        const safe = meta || {};
        const base = String(safe.eyebrow || '').trim();
        const tag = total > 1 ? `Part ${index + 1} of ${total}` : '';
        return {
          eyebrow: total > 1 ? (base ? `${base} · ${tag}` : tag) : base,
          title: String(safe.title || '').trim(),
          footer: String(safe.footer || '').trim()
        };
      }

      /* The guarantee as a number.  Zero on every page this planner returns. */
      function deckPlanOverlap(part) {
        if (!part || !part.picture || !part.page) return 0;
        const p = part.picture;
        const bars = [
          { x: 0, y: 0, w: part.page.w, h: DECK_FRAME.accent },
          part.header,
          part.footBox ? { x: part.footBox.x, y: part.footBox.y - 26, w: part.footBox.w, h: 34 } : null
        ];
        let area = 0;
        bars.forEach(bar => {
          if (!bar) return;
          const ix = Math.max(0, Math.min(p.x + p.w, bar.x + bar.w) - Math.max(p.x, bar.x));
          const iy = Math.max(0, Math.min(p.y + p.h, bar.y + bar.h) - Math.max(p.y, bar.y));
          area += ix * iy;
        });
        return area;
      }

      /* ---------------------------------------------------------------------
         THE DECISION.  Pure: same request in, same plan out, no state read.
         --------------------------------------------------------------------- */
      function deckPlanDiagramPages(request) {
        const req = request || {};
        const src = req.box || {};
        const cw = Math.max(1, Number(src.width) || 1);
        const ch = Math.max(1, Number(src.height) || 1);
        const x0 = Number(src.x) || 0;
        const y0 = Number(src.y) || 0;
        const meta = req.meta || null;
        const target = req.target === 'pptx' ? 'pptx' : 'pdf';
        const allowPortrait = req.allowPortrait === undefined ? target !== 'pptx' : !!req.allowPortrait;
        const minFontPx = Math.max(0, Number(req.minFontPx) || 0);
        const floorPt = PDF_MIN_FONT_PT;
        const rows = req.rows && req.rows.ok ? req.rows : null;

        /* --- 2. landscape or portrait --- */
        const aspect = deckQuantiseAspect(ch / cw);
        const portraitWanted = aspect >= DECK_PORTRAIT_ASPECT;
        const portrait = portraitWanted && allowPortrait;
        const page = portrait ? DECK_PAGE.portrait : DECK_PAGE.landscape;

        /* --- 1. the frame is reserved, THEN the picture is fitted --- */
        const whole = deckComposePage(cw, ch, page, meta, portrait ? 'band' : null);
        const wholePt = minFontPx ? minFontPx * whole.picture.scale * DECK_PT_PER_PX : 0;

        /* --- 3. one page or several --- */
        const need = minFontPx ? floorPt / (minFontPx * DECK_PT_PER_PX) : 0;
        let count = Math.max(1, Math.min(DECK_MAX_PARTS, Math.round(Number(req.minParts) || 1)));
        let capped = false;
        let overlap = 0;
        let maxPartH = ch;
        let reason = minFontPx
          ? (count > 1 ? 'the caller asked for a matched page count' : 'one page already clears the floor')
          : 'the smallest glyph could not be read, so one page it is';
        if (need && whole.picture.scale < need) {
          if (whole.box.w / cw < need) {
            capped = true;
            reason = 'the diagram is too WIDE for the floor - cutting rows cannot lift it';
          } else {
            maxPartH = whole.box.h / need;
            const pitch = rows && rows.pitch > 0 ? rows.pitch : ch / 12;
            const lo = ch * 0.04;
            const hi = maxPartH * 0.30;
            // Overlap enough to repeat a whole block and its connector, so a
            // reader rejoins two pages by recognising something, not by faith.
            overlap = hi <= lo ? Math.min(lo, hi) : clamp(pitch * 1.25, lo, hi);
            let wanted = Math.ceil((ch - overlap) / Math.max(1, maxPartH - overlap));
            if (!Number.isFinite(wanted) || wanted < 1) wanted = 1;
            // A split with no slack cannot move a cut onto a gap, so buy one page
            // of room when there is structure worth landing on.
            if (rows && wanted < DECK_MAX_PARTS) {
              const nominalH = (ch + (wanted - 1) * overlap) / wanted;
              if (maxPartH - nominalH < nominalH * 0.05) wanted += 1;
            }
            if (wanted > DECK_MAX_PARTS) { wanted = DECK_MAX_PARTS; capped = true; }
            count = Math.max(count, wanted);
            reason = capped
              ? `${floorPt}pt would need more than ${DECK_MAX_PARTS} pages`
              : `${wholePt.toFixed(1)}pt on one page is under the ${floorPt}pt floor`;
          }
        }

        const parts = [];
        let cuts = [];
        let joinBands = [];
        if (count <= 1) {
          const one = deckPartMeta(meta, 0, 1);
          parts.push({
            index: 0, total: 1, label: 'Whole diagram',
            eyebrow: one.eyebrow, title: one.title, footer: one.footer,
            page: page, mode: whole.mode,
            source: { x: x0, y: y0, width: cw, height: ch },
            picture: whole.picture, header: whole.header, footBox: whole.footBox,
            titleLines: whole.titleLines, centreY: whole.centreY,
            minFontPt: wholePt, overlapWith: { previous: null, next: null }
          });
        } else {
          if (!overlap) overlap = ch * 0.05;
          const nominalH = (ch + (count - 1) * overlap) / count;
          const step = (ch - nominalH) / (count - 1);
          const window = Math.max(0, Math.min((maxPartH - nominalH) / 2, nominalH * DECK_SNAP_WINDOW));
          const gaps = rows ? deckRowGaps(rows) : [];
          const nominal = [];
          for (let i = 1; i < count; i += 1) nominal.push(y0 + i * step + overlap / 2);
          const plain = nominal.map(c => ({ lo: c - overlap / 2, hi: c + overlap / 2 }));
          const snapped = nominal.map(c => {
            const lo = deckSnapCut(c - overlap / 2, window, gaps, rows);
            const hi = deckSnapCut(c + overlap / 2, window, gaps, rows);
            // A snap that swallowed the overlap has repeated nothing; keep the
            // arithmetic's band rather than hand the reader two halves that meet
            // at a line with no block on both sides of it.
            return (hi - lo >= Math.min(overlap * 0.4, 12)) ? { lo: lo, hi: hi } : { lo: c - overlap / 2, hi: c + overlap / 2 };
          });
          const trySnapped = deckPartBounds(snapped, y0, ch);
          // A snapped edge that pushed a page past its own legibility ceiling, or
          // that ran into the next join, is not an improvement; the arithmetic's
          // own bands are always legal.
          const legal = trySnapped.every(b => (b.y1 - b.y0) <= maxPartH + 0.5 && (b.y1 - b.y0) > 0)
            && snapped.every((j, i) => i === 0 || j.lo > snapped[i - 1].hi);
          const joins = legal ? snapped : plain;
          joinBands = joins;
          cuts = joins.map(j => (j.lo + j.hi) / 2);
          const bounds = legal ? trySnapped : deckPartBounds(plain, y0, ch);
          // One composition for the whole set, taken from the first part, so
          // every page of one diagram reads as the same slide.
          const mode = portrait ? 'band'
            : deckComposePage(cw, Math.max(1, bounds[0].y1 - bounds[0].y0), page, meta, null).mode;
          bounds.forEach((b, i) => {
            const h = Math.max(1, b.y1 - b.y0);
            const pm = deckPartMeta(meta, i, count);
            const composed = deckComposePage(cw, h, page, pm, mode);
            parts.push({
              index: i, total: count, label: `Part ${i + 1} of ${count}`,
              eyebrow: pm.eyebrow, title: pm.title, footer: pm.footer,
              page: page, mode: composed.mode,
              source: { x: x0, y: b.y0, width: cw, height: h },
              picture: composed.picture, header: composed.header, footBox: composed.footBox,
              titleLines: composed.titleLines, centreY: composed.centreY,
              minFontPt: minFontPx ? minFontPx * composed.picture.scale * DECK_PT_PER_PX : 0,
              overlapWith: {
                previous: i > 0 ? { y0: b.y0, y1: Math.min(b.y1, bounds[i - 1].y1) } : null,
                next: i < bounds.length - 1 ? { y0: Math.max(b.y0, bounds[i + 1].y0), y1: b.y1 } : null
              }
            });
          });
        }

        return {
          orientation: page.orientation, page: page, ptPerPx: DECK_PT_PER_PX,
          aspect: aspect, portraitAt: DECK_PORTRAIT_ASPECT,
          portraitWanted: portraitWanted,
          vetoed: (portraitWanted && !portrait) ? 'pptx-defines-slide-size-once' : '',
          floorPt: floorPt, minFontPtWhole: wholePt,
          split: {
            parts: parts.length, reason: reason, capped: capped,
            overlapUser: overlap, maxPartHeight: maxPartH, cuts: cuts, joins: joinBands,
            structural: !!rows
          },
          parts: parts
        };
      }

      /* THE OLD NAME, KEPT.  Everything that used to ask mapDeckFrameLayout for
         one landscape page still gets one landscape page - now planned
         frame-first, so it cannot collide.  `meta` is new and optional: with it
         the reserved band is exactly the height the frame will draw, without it
         the worst case is reserved instead. */
      function mapDeckFrameLayout(contentW, contentH, meta) {
        const plan = deckPlanDiagramPages({
          box: { x: 0, y: 0, width: contentW, height: contentH },
          meta: meta || null, target: 'pptx', allowPortrait: false, minFontPx: 0
        });
        const part = plan.parts[0];
        const full = presentFitBox(contentW, contentH, 0, 0, plan.page.w, plan.page.h, 'contain');
        return {
          mode: part.mode, page: part.page, source: part.source,
          picture: part.picture, header: part.header, footBox: part.footBox,
          eyebrow: part.eyebrow, titleLines: part.titleLines, centreY: part.centreY,
          ceiling: full.scale, plan: plan
        };
      }
"""

# ------------------------------------------------------------------ apply ---

def main():
    if len(sys.argv) < 2:
        raise SystemExit('usage: fix_dx_rule.py <path-to-SIREN.html>')
    path = sys.argv[1]
    src = open(path, 'r', encoding='utf-8', newline='').read()
    before = len(src)

    if 'deckPlanDiagramPages' in src:
        raise SystemExit('ABORT: deckPlanDiagramPages already present - already patched')

    # -- the block replacement: MAP_DECK_FRAME .. end of mapDeckFrameLayout ---
    for name, needle in (('A_HEAD', A_HEAD), ('A_TAIL', A_TAIL)):
        if src.count(needle) != 1:
            raise SystemExit('ABORT: %s found %d times, expected 1' % (name, src.count(needle)))
    start = src.index(A_HEAD)
    end = src.index(A_TAIL) + len(A_TAIL)
    if end <= start:
        raise SystemExit('ABORT: anchors out of order')
    old_block = src[start:end]
    for token in ('presentFitBox(contentW, contentH, 0, 0, W, H', 'slackX >= MAP_DECK_FRAME.sideMin'):
        if token not in old_block:
            raise SystemExit('ABORT: block drifted, %r missing' % token)
    src = src[:start] + NEW + src[end:]

    # -- the surgical replacements -------------------------------------------
    edits = [
        ('signature',   A_SIG,    B_SIG),
        ('eyebrow',     A_EYE,    B_EYE),
        ('crop',        A_VB,     B_VB),
        ('footer',      A_FOOT,   B_FOOT),
        ('framed',      A_FRAMED, B_FRAMED),
        ('pptx-layout', A_PPTX,   B_PPTX),
        ('pptx-note',   A_NOTE,   B_NOTE),
    ]
    for name, old, new in edits:
        n = src.count(old)
        if n != 1:
            raise SystemExit('ABORT: edit %r matched %d times, expected 1' % (name, n))
        src = src.replace(old, new, 1)

    # -- post-conditions ------------------------------------------------------
    for token in ('function deckPlanDiagramPages(', 'function deckDiagramRowProfile(',
                  'function deckPlanOverlap(', 'function mapDeckFrameLayout(contentW, contentH, meta)'):
        if src.count(token) != 1:
            raise SystemExit('ABORT: post-condition %r count %d' % (token, src.count(token)))
    if 'MAP_DECK_FRAME' in src:
        raise SystemExit('ABORT: the old frame constants survived')
    for untouched in ('function buildRasterPdf(pages, pageWidth, pageHeight) {',
                      'function buildZip(entries) {',
                      'const PDF_MIN_FONT_PT = 9;',
                      'function getMinimumExportFontSize() {'):
        if src.count(untouched) != 1:
            raise SystemExit('ABORT: shared primitive %r disturbed' % untouched)

    d = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(dir=d, suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8', newline='') as f:
        f.write(src)
    os.replace(tmp, path)
    print('patched %s: %d -> %d bytes (+%d)' % (path, before, len(src), len(src) - before))

main()
