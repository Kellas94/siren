r"""Deck PPTX: flowchart diagram slides become editable DrawingML shapes.

Run:  python patch_pptx_editable_shapes.py <path-to-app.html>
Idempotent against FROZEN_1_62_0.html (asserts every anchor exactly once).
Regions touched (all additive or local):
  - mapSlideFocusMarker: data attribute on the ring group (additive)
  - mapPptxNewSlide: raw()/nextIdValue() methods
  - mapPptxDeckAudit/mapPptxSplits: + mapPptxEditable
  - mapPptxDiagramPartSlide: 5th param `drawing`, shapes instead of picture
  - mapPptxDiagramSlides: shapes-first block before the raster block, 2 new params
  - mapPptxAuditNote / new mapPptxEditableNote / toast in mapExportRoutePptx
  - mapExportRoutePptx: reset + call site
  - mapPptxEntries: docProps/custom.xml (SIRENDeckAudit)
  - collectDrawingFromSvg: optional sourceText param (default unchanged)
  - new deckCollectDiagramShapes / deckClipSegment / deckShapesForCrop after collectDiagramDrawing
  - new buildDeckSlideShapes before buildPptxBlob
"""
import io, os, sys

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s


def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)


# ---------------------------------------------------------------- 1. collector gets an explicit source
rep(r"""      function collectDrawingFromSvg(svg) {
        if (!svg) return null;""",
    r"""      function collectDrawingFromSvg(svg, sourceText) {
        if (!svg) return null;""")

rep(r"""        const source = el.source ? el.source.value : '';
        const shapes = [];
        const seen = new Set();""",
    r"""        // The deck passes the exported diagram's own text; the editor's exports
        // keep reading the editor, exactly as before.
        const source = typeof sourceText === 'string' ? sourceText : (el.source ? el.source.value : '');
        const shapes = [];
        const seen = new Set();""")

# ---------------------------------------------------------------- 2. deck helpers after collectDiagramDrawing
rep(r"""      function collectDiagramDrawing() {
        return withMeasurableDiagramSvg(svg => collectDrawingFromSvg(svg));
      }
""",
    r"""      function collectDiagramDrawing() {
        return withMeasurableDiagramSvg(svg => collectDrawingFromSvg(svg));
      }

      /* THE DECK'S READING OF A DIAGRAM, in the diagram's OWN coordinates.  The
         deck hands over the SVG as a string (the one the PDF draws) and the
         diagram's own Mermaid text, so a stop's shapes are its own and not the
         editor's.  collectDrawingFromSvg measures in viewport pixels; the root's
         CTM, inverted, takes every point back to user units - the units a part's
         crop is written in - so a node-step window and a split part are cut out
         of the same numbers whatever viewBox or width the string arrived with. */
      function deckCollectDiagramShapes(svgString, sourceText) {
        const markup = String(svgString || '');
        if (!markup.trim()) return null;
        const stage = document.createElement('div');
        stage.setAttribute('aria-hidden', 'true');
        stage.style.cssText = 'position:fixed;left:-100000px;top:0;width:1600px;height:1200px;opacity:0;pointer-events:none;overflow:visible';
        stage.innerHTML = markup;
        document.body.appendChild(stage);
        try {
          const svg = stage.querySelector('svg');
          if (!svg || typeof svg.getCTM !== 'function') return null;
          const ctm = svg.getCTM();
          if (!ctm || !(ctmScale(ctm) > 0)) return null;
          let inverse = null;
          try { inverse = ctm.inverse(); } catch (error) { inverse = null; }
          if (!inverse || !Number.isFinite(inverse.a) || !Number.isFinite(inverse.e)) return null;
          const drawing = collectDrawingFromSvg(svg, sourceText);
          if (!drawing || !drawing.shapes.length) return null;
          const unit = 1 / ctmScale(ctm);
          const toUser = (x, y) => {
            const point = new DOMPoint(x, y).matrixTransform(inverse);
            return { x: point.x, y: point.y };
          };
          const userBox = (x, y, w, h) => {
            const a = toUser(x, y);
            const b = toUser(x + w, y + h);
            if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return null;
            return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
          };
          const shapes = [];
          drawing.shapes.forEach(shape => {
            if (shape.kind === 'line') {
              const points = shape.points.map(point => toUser(point.x, point.y));
              if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return;
              shapes.push({ ...shape, points: points, strokeWidth: (Number(shape.strokeWidth) || 1) * unit });
              return;
            }
            const box = userBox(shape.x, shape.y, shape.w, shape.h);
            if (!box) return;
            shapes.push({
              ...shape, x: box.x, y: box.y, w: box.w, h: box.h,
              strokeWidth: (Number(shape.strokeWidth) || 1) * unit,
              fontSize: (Number(shape.fontSize) || 10) * unit
            });
          });
          // The ring a node step draws round its block (mapSlideFocusMarker) is not
          // a node, so the collector skips it; the slide keeps it as one unfilled
          // rounded box so a framed stop still points at something.
          const ring = svg.querySelector('g[data-t-focus-marker] rect:last-of-type');
          if (ring) {
            const measured = measureSvgElement(ring);
            const box = measured ? userBox(measured.x, measured.y, measured.w, measured.h) : null;
            const style = box ? getComputedStyle(ring) : null;
            const stroke = style ? cssColourToHex(style.stroke) : null;
            if (box && stroke) {
              const rx = parseFloat(ring.getAttribute('rx')) || 0;
              shapes.push({
                kind: 'box', z: 4, preset: 'roundRect', pill: false, name: 'Focus ring',
                x: box.x, y: box.y, w: box.w, h: box.h,
                fill: null, stroke: stroke,
                strokeWidth: (parseFloat(style.strokeWidth) || 2) * measured.scale * unit,
                lines: [], textColour: stroke, fontSize: 9, bold: false, anchor: 'ctr', align: 'ctr',
                adjust: clamp(Math.round((rx / Math.max(1, Math.min(box.w, box.h))) * 100000), 0, 50000)
              });
            }
          }
          if (!shapes.some(shape => shape.kind === 'box' && shape.z === 2)) return null;
          // What the SVG had, so the file can say "6 blocks of 6" and be checked.
          const ids = new Set();
          svg.querySelectorAll('g.node, [data-node-id]').forEach(group => {
            if (group.closest('[data-t-adornments]')) return;
            const id = nodeIdFromGroup(group);
            if (id) ids.add(id);
          });
          return {
            shapes: shapes,
            box: getSvgViewBox(svg),
            counts: {
              nodes: ids.size,
              clusters: svg.querySelectorAll('g.cluster, [data-subgraph-id]').length,
              edges: drawableEdgePaths(svg).length
            }
          };
        } finally {
          stage.remove();
        }
      }

      /* Liang-Barsky: the piece of segment a-b that lies inside `crop`, or null. */
      function deckClipSegment(a, b, crop) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        let t0 = 0;
        let t1 = 1;
        const edges = [
          [-dx, a.x - crop.x], [dx, crop.x + crop.width - a.x],
          [-dy, a.y - crop.y], [dy, crop.y + crop.height - a.y]
        ];
        for (let i = 0; i < 4; i += 1) {
          const p = edges[i][0];
          const q = edges[i][1];
          if (p === 0) { if (q < 0) return null; continue; }
          const t = q / p;
          if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
          else { if (t < t0) return null; if (t < t1) t1 = t; }
        }
        return [{ x: a.x + t0 * dx, y: a.y + t0 * dy }, { x: a.x + t1 * dx, y: a.y + t1 * dy }];
      }

      /* WHAT OF THE DIAGRAM BELONGS ON THIS PART.  `crop` is the part's window in
         user units - the rectangle the raster was cut to - and the rule is the
         picture's rule: a block or a caption is on the slide when its centre is
         inside the window, a group frame is cut at the window's edge, a connector
         is cut where it crosses it and keeps its arrowhead only if its end is in.
         Nothing that comes out of here reaches past the window, so nothing can
         reach past the slide either. */
      function deckShapesForCrop(shapes, crop) {
        const out = [];
        const right = crop.x + crop.width;
        const bottom = crop.y + crop.height;
        const inside = (x, y) => x >= crop.x && x <= right && y >= crop.y && y <= bottom;
        const clipBox = shape => {
          const left = Math.max(shape.x, crop.x);
          const top = Math.max(shape.y, crop.y);
          const w = Math.min(shape.x + shape.w, right) - left;
          const h = Math.min(shape.y + shape.h, bottom) - top;
          if (!(w > 0.5) || !(h > 0.5)) return null;
          return { ...shape, x: left, y: top, w: w, h: h };
        };
        (shapes || []).forEach(shape => {
          if (shape.kind === 'line') {
            const points = shape.points || [];
            const pieces = [];
            let run = [];
            for (let i = 1; i < points.length; i += 1) {
              const piece = deckClipSegment(points[i - 1], points[i], crop);
              if (!piece) { if (run.length >= 2) pieces.push(run); run = []; continue; }
              const last = run[run.length - 1];
              if (last && Math.abs(last.x - piece[0].x) < 0.01 && Math.abs(last.y - piece[0].y) < 0.01) run.push(piece[1]);
              else { if (run.length >= 2) pieces.push(run); run = [piece[0], piece[1]]; }
            }
            if (run.length >= 2) pieces.push(run);
            const end = points[points.length - 1];
            pieces.forEach((piece, index) => {
              out.push({
                ...shape, points: piece,
                name: pieces.length > 1 ? `${shape.name} (${index + 1})` : shape.name,
                arrow: index === pieces.length - 1 && !!end && inside(end.x, end.y)
              });
            });
            return;
          }
          if (shape.z === 0) {
            const cut = clipBox(shape);
            if (!cut) return;
            // A caption whose top edge is above the window is on the other slide.
            if (shape.y < crop.y) cut.lines = [];
            out.push(cut);
            return;
          }
          if (!inside(shape.x + shape.w / 2, shape.y + shape.h / 2)) return;
          const cut = clipBox(shape);
          if (cut) out.push(cut);
        });
        return out;
      }
""")

# ---------------------------------------------------------------- 3. deck shape writer before buildPptxBlob
rep(r"""      }

      async function buildPptxBlob() {""",
    r"""      }

      /* A diagram shape's words on the deck slide.  PowerPoint inscribes the text
         rectangle of a diamond, an ellipse, a cylinder or a pill well inside the
         shape, so a label Mermaid fitted across the whole block would wrap early
         ("Approv / ed?"); those shapes take their lines unwrapped (`wrap` false),
         plain boxes wrap the way the renderer did.  Overflow stays visible rather
         than clipped: a word that runs past an edge can be seen and fixed, a
         clipped one is silently gone.  No typeface is named, so the shapes use the
         theme's, the same one the slide's own title uses. */
      function deckShapeTextBody(shape, wrap) {
        const size = Math.round(clamp(Number(shape.fontSize) || 10, 6, 40) * 100);
        const colour = shape.textColour || '0F172A';
        const align = shape.align === 'l' ? 'l' : 'ctr';
        const paragraphs = (shape.lines && shape.lines.length ? shape.lines : [''])
          .map(line => `<a:p><a:pPr algn="${align}"/>${line
            ? `<a:r><a:rPr lang="en-US" sz="${size}" b="${shape.bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${colour}"/></a:solidFill></a:rPr><a:t>${escapeXml(line)}</a:t></a:r>`
            : `<a:endParaRPr lang="en-US" sz="${size}"/>`}</a:p>`)
          .join('');
        return `<p:txBody><a:bodyPr vertOverflow="overflow" horzOverflow="overflow" wrap="${wrap ? 'square' : 'none'}" lIns="18288" tIns="9144" rIns="18288" bIns="9144" anchor="${shape.anchor === 't' ? 't' : 'ctr'}"/><a:lstStyle/>${paragraphs}</p:txBody>`;
      }

      /* THE DECK'S SHAPE WRITER.  Same DrawingML as buildEditableSlideShapes, but
         the shapes arrive in the diagram's own units already cut to `crop`, and
         they are laid into `rect` - the slide's picture box in 1920x1080 design
         pixels - exactly where the raster would have gone, so the frame's
         keep-off rule still holds and a shape slide lines up with a picture
         slide.  One design pixel is 6350 EMU and half a point; the collector's
         fontSize already carries 0.75 pt per pixel, hence the 2/3 on type, and
         ooxmlLineProperties multiplies by 9525, hence the 6350/9525 on strokes.
         Ids start at `firstId` so they cannot collide with the frame's own.
         `labelFill` is the slide's background: an arrow caption sits on a patch of
         it, as Mermaid's does, so the line passes behind the word, not through. */
      function buildDeckSlideShapes(shapes, crop, rect, firstId, labelFill) {
        const list = Array.isArray(shapes) ? shapes : [];
        if (!list.length || !crop || !(crop.width > 0) || !(crop.height > 0) || !rect) return { xml: '', count: 0 };
        const s = Math.min(rect.w / crop.width, rect.h / crop.height);
        if (!(s > 0) || !Number.isFinite(s)) return { xml: '', count: 0 };
        const ox = rect.x + (rect.w - crop.width * s) / 2;
        const oy = rect.y + (rect.h - crop.height * s) / 2;
        const toX = value => mapPptxEmu(ox + (value - crop.x) * s);
        const toY = value => mapPptxEmu(oy + (value - crop.y) * s);
        const size = value => Math.max(1, mapPptxEmu(value * s));
        const toPt = value => (Number(value) || 10) * s * (6350 / EMU_PER_PX);
        const lineWidth = value => (Number(value) || 1) * s * (6350 / EMU_PER_PX);
        let nextId = Math.max(2, Math.round(Number(firstId) || 2));
        let count = 0;

        const xml = list.slice().sort((a, b) => a.z - b.z).map(shape => {
          const id = nextId++;
          count += 1;
          const name = escapeXml(String(shape.name || `Shape ${id}`).slice(0, 80) || `Shape ${id}`);

          if (shape.kind === 'line') {
            const xs = shape.points.map(point => point.x);
            const ys = shape.points.map(point => point.y);
            const left = Math.min(...xs); const top = Math.min(...ys);
            const cx = size(Math.max(...xs) - left); const cy = size(Math.max(...ys) - top);
            const line = ooxmlLineProperties(shape.stroke, lineWidth(shape.strokeWidth), shape.dashed, shape.arrow !== false);
            const first = shape.points[0];
            const last = shape.points[shape.points.length - 1];
            if (polylineDeviation(shape.points) <= 1.6) {
              const flip = `${first.x > last.x ? ' flipH="1"' : ''}${first.y > last.y ? ' flipV="1"' : ''}`;
              return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>`
                + `<p:spPr><a:xfrm${flip}><a:off x="${toX(left)}" y="${toY(top)}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
                + `<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom>${line}</p:spPr></p:cxnSp>`;
            }
            const steps = shape.points.map((point, index) => {
              const px = Math.max(0, mapPptxEmu((point.x - left) * s));
              const py = Math.max(0, mapPptxEmu((point.y - top) * s));
              return `<a:${index ? 'lnTo' : 'moveTo'}><a:pt x="${px}" y="${py}"/></a:${index ? 'lnTo' : 'moveTo'}>`;
            }).join('');
            return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
              + `<p:spPr><a:xfrm><a:off x="${toX(left)}" y="${toY(top)}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
              + `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/>`
              + `<a:pathLst><a:path w="${cx}" h="${cy}">${steps}</a:path></a:pathLst></a:custGeom>`
              + `<a:noFill/>${line}</p:spPr></p:sp>`;
          }

          const cx = size(shape.w);
          const cy = size(shape.h);
          const scaled = { ...shape, fontSize: toPt(shape.fontSize) };

          if (shape.kind === 'text') {
            return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
              + `<p:spPr><a:xfrm><a:off x="${toX(shape.x)}" y="${toY(shape.y)}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
              + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${labelFill ? `<a:solidFill><a:srgbClr val="${labelFill}"/></a:solidFill>` : '<a:noFill/>'}<a:ln><a:noFill/></a:ln></p:spPr>`
              + deckShapeTextBody(scaled, false) + '</p:sp>';
          }

          const geometry = shape.pill
            ? '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 50000"/></a:avLst></a:prstGeom>'
            : (Number.isFinite(shape.adjust)
              ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.round(shape.adjust)}"/></a:avLst></a:prstGeom>`
              : `<a:prstGeom prst="${shape.preset}"><a:avLst/></a:prstGeom>`);
          const fill = shape.fill ? `<a:solidFill><a:srgbClr val="${shape.fill}"/></a:solidFill>` : '<a:noFill/>';
          const line = shape.stroke
            ? ooxmlLineProperties(shape.stroke, lineWidth(shape.strokeWidth), false, false)
            : '<a:ln><a:noFill/></a:ln>';
          return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
            + `<p:spPr><a:xfrm><a:off x="${toX(shape.x)}" y="${toY(shape.y)}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
            + `${geometry}${fill}${line}</p:spPr>`
            + deckShapeTextBody(scaled, !shape.pill && !Number.isFinite(shape.adjust) && (shape.preset === 'rect' || shape.preset === 'roundRect'))
            + '</p:sp>';
        }).join('');
        return { xml: xml, count: count };
      }

      async function buildPptxBlob() {""")

# ---------------------------------------------------------------- 4. mapPptxNewSlide: raw() + nextIdValue()
rep(r"""              mapPptxEmu(x), mapPptxEmu(y), mapPptxEmu(width), mapPptxEmu(height)));
          },
""",
    r"""              mapPptxEmu(x), mapPptxEmu(y), mapPptxEmu(width), mapPptxEmu(height)));
          },
          // Shapes written elsewhere (the editable diagram). They were numbered
          // from nextIdValue(), so the counter steps past them and nothing the
          // frame writes afterwards can share an id with them.
          raw(xml, count) {
            shapes.push(String(xml || ''));
            nextId += Math.max(0, Math.round(Number(count) || 0));
          },
          nextIdValue() { return nextId; },
""")

# ---------------------------------------------------------------- 5. audit vars
rep(r"""      let mapPptxDeckAudit = [];
      let mapPptxSplits = [];
""",
    r"""      let mapPptxDeckAudit = [];
      let mapPptxSplits = [];
      // One row per diagram call: shapes or picture, and why, with the counts
      // the SVG had beside the counts the slide got.
      let mapPptxEditable = [];
""")

# ---------------------------------------------------------------- 6. mapPptxDiagramPartSlide
rep(r"""      function mapPptxDiagramPartSlide(part, asset, palette, media) {
        if (!part || !part.picture || !asset) return null;""",
    r"""      function mapPptxDiagramPartSlide(part, asset, palette, media, drawing) {
        // `drawing` = { shapes, crop }: the part as editable shapes, in which case
        // there is no asset and the shapes take the picture's place.
        if (!part || !part.picture || !(asset || (drawing && drawing.crop))) return null;""")

rep(r"""        const fit = presentFitBox(asset.width, asset.height,
          part.picture.x,""",
    r"""        const fit = presentFitBox(asset ? asset.width : drawing.crop.width, asset ? asset.height : drawing.crop.height,
          part.picture.x,""")

rep(r"""        slide.picture(titleText.slice(0, 90) || 'Diagram', asset,
          picture.x, picture.y, picture.w, picture.h);
""",
    r"""        let shapeCount = 0;
        if (drawing) {
          // The diagram as shapes, in the rect the picture would have filled.
          const built = buildDeckSlideShapes(drawing.shapes, drawing.crop, picture, slide.nextIdValue(), palette.bgHex);
          if (!built.count) return null;
          slide.raw(built.xml, built.count);
          shapeCount = built.count;
        } else {
          slide.picture(titleText.slice(0, 90) || 'Diagram', asset,
            picture.x, picture.y, picture.w, picture.h);
        }
""")

rep(r"""          planOverlap: deckPlanOverlap(part),
          overlap: worst,""",
    r"""          planOverlap: deckPlanOverlap(part),
          overlap: worst,
          editable: !!drawing, shapeCount: shapeCount,""")

rep(r"""        // exists, so a part that failed cannot leave a picture nothing references.
        media.push(asset);
        return slide.finish();""",
    r"""        // exists, so a part that failed cannot leave a picture nothing references.
        if (asset) media.push(asset);
        return slide.finish();""")

# ---------------------------------------------------------------- 7. mapPptxDiagramSlides: shapes first
rep(r"""      async function mapPptxDiagramSlides(diagramSvg, meta, palette, media) {""",
    r"""      async function mapPptxDiagramSlides(diagramSvg, meta, palette, media, diagramSource, diagramName) {""")

rep(r"""        // Rasterise ONCE.  Every part is a CROP of that one canvas, so the picture
        // on a split slide is the stop's own picture, not a re-render of it.
        const want = clamp(2 * parts.reduce(""",
    r"""        // EDITABLE SHAPES FIRST, flowcharts only.  The same parts the planner cut
        // for the picture, so the PDF page and the PowerPoint slide show the same
        // window, and every block on it is a shape the recipient can move and
        // retype.  All or nothing per diagram: a stop is shapes on every part or
        // a picture on every part, never a mix, and what stayed a picture is said.
        const stopTitle = String((meta && meta.title) || 'Diagram').slice(0, 60);
        const stopName = String(diagramName || stopTitle).slice(0, 60);
        let diagramKind = '';
        try {
          diagramKind = typeof diagramSource === 'string' && diagramSource.trim() ? detectMermaidDiagramType(diagramSource) : '';
        } catch (error) { diagramKind = ''; }
        if (diagramKind === 'flowchart') {
          const auditMark = mapPptxDeckAudit.length;
          let drawing = null;
          let shaped = null;
          try {
            drawing = deckCollectDiagramShapes(source, diagramSource);
            if (drawing) {
              shaped = [];
              const tally = [];
              for (let i = 0; i < parts.length; i += 1) {
                const part = parts[i];
                const crop = part.source || box;
                const partShapes = deckShapesForCrop(drawing.shapes, crop);
                // A part with no block in its window is a picture's job.
                if (!partShapes.some(shape => shape.kind === 'box' && shape.z === 2)) { shaped = null; break; }
                const slide = mapPptxDiagramPartSlide(part, null, palette, media, { shapes: partShapes, crop: crop });
                if (!slide) { shaped = null; break; }
                shaped.push(slide);
                tally.push({
                  label: part.total > 1 ? String(part.label || (i + 1)) : stopTitle,
                  blocks: partShapes.filter(shape => shape.kind === 'box' && shape.z === 2).length,
                  groups: partShapes.filter(shape => shape.kind === 'box' && shape.z === 0).length,
                  connectors: partShapes.filter(shape => shape.kind === 'line').length,
                  labels: partShapes.filter(shape => shape.kind === 'text').length
                });
              }
              if (shaped && shaped.length) {
                mapPptxEditable.push({ title: stopTitle, name: stopName, editable: true, parts: tally, svg: drawing.counts });
                return shaped;
              }
            }
          } catch (error) {
            console.warn('deck pptx: editable shapes failed for "' + stopTitle + '"; the picture goes in instead.', error);
          }
          // Whatever a failed attempt wrote about itself is withdrawn; the picture
          // slides below write their own rows.
          mapPptxDeckAudit.length = auditMark;
          mapPptxEditable.push({ title: stopTitle, name: stopName, editable: false,
            reason: drawing ? 'a part had no block in its window' : 'the diagram could not be measured' });
        } else {
          mapPptxEditable.push({ title: stopTitle, name: stopName, editable: false,
            reason: diagramKind ? diagramKind + ' diagrams stay pictures' : 'no diagram source' });
        }

        // Rasterise ONCE.  Every part is a CROP of that one canvas, so the picture
        // on a split slide is the stop's own picture, not a re-render of it.
        const want = clamp(2 * parts.reduce(""")

# ---------------------------------------------------------------- 8. call site + reset
rep(r"""                if (stopSvg) parcels = await mapPptxDiagramSlides(stopSvg, stopMeta, palette, media);""",
    r"""                if (stopSvg) parcels = await mapPptxDiagramSlides(stopSvg, stopMeta, palette, media, stopDiagram.source, stopDiagram.name || stopDiagram.diagramTitle || '');""")

rep(r"""        mapPptxDeckAudit = [];
        mapPptxSplits = [];
""",
    r"""        mapPptxDeckAudit = [];
        mapPptxSplits = [];
        mapPptxEditable = [];
""")

# ---------------------------------------------------------------- 9. notes + toast
rep(r"""        return `deck: pptx wrote ${drawn.length} diagram slide(s); frame INTERSECT picture = 0 on every one`;""",
    r"""        const editable = drawn.filter(row => row.editable).length;
        return `deck: pptx wrote ${drawn.length} diagram slide(s), editable shapes on ${editable} of them; frame INTERSECT picture = 0 on every one`;""")

rep(r"""      function mapPptxSplitNote() {""",
    r"""      /* The editable count, and the honest list of what stayed a picture. */
      function mapPptxEditableNote() {
        const shaped = mapPptxDeckAudit.filter(row => !row.clipped && row.editable).length;
        const names = Array.from(new Set(mapPptxEditable.filter(row => !row.editable).map(row => row.name || row.title)));
        let note = '';
        if (shaped) note += ` ${shaped} diagram slide${shaped === 1 ? ' is' : 's are'} editable shapes.`;
        if (names.length) {
          const list = names.slice(0, 3).join(', ');
          const more = names.length > 3 ? `, and ${names.length - 3} more` : '';
          note += ` Kept as ${names.length === 1 ? 'a picture' : 'pictures'}: ${list}${more}.`;
        }
        return note;
      }

      function mapPptxSplitNote() {""")

rep(r"""            : '') + mapPptxSplitNote() + mapDeckSmallTypeNote(), 'success');""",
    r"""            : '') + mapPptxEditableNote() + mapPptxSplitNote() + mapDeckSmallTypeNote(), 'success');""")

# ---------------------------------------------------------------- 10. custom.xml with SIRENDeckAudit
rep(r"""          + slideOverrides + notesOverrides + '</Types>';""",
    r"""          + '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>'
          + slideOverrides + notesOverrides + '</Types>';""")

rep(r"""
        const entries = [
          { name: '[Content_Types].xml', data: contentTypes },
          { name: '_rels/.rels', data: mapPptxRelsXml(
            `<Relationship Id="rId1" Type="${REL}officeDocument" Target="ppt/presentation.xml"/>`
            + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            + `<Relationship Id="rId3" Type="${REL}extended-properties" Target="docProps/app.xml"/>`) },
          { name: 'docProps/core.xml', data: core },
          { name: 'docProps/app.xml', data: app },
""",
    r"""
        // What the export did, written into the file itself so a claim about a
        // deck can be checked against the deck: which diagram slides are shapes,
        // how many blocks each carries beside how many the SVG had, which stops
        // stayed pictures and why, which diagrams were split.
        const audit = JSON.stringify({
          kind: 'SIRENDeckAudit', version: 1, slides: slides.length,
          diagrams: mapPptxEditable, splits: mapPptxSplits,
          frames: mapPptxDeckAudit.map(row => ({
            label: row.label, editable: !!row.editable, shapes: row.shapeCount || 0,
            overlap: row.overlap || 0, clipped: !!row.clipped
          }))
        });
        const custom = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
          + `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="SIRENDeckAudit"><vt:lpwstr>${workpaperPptxXml(audit)}</vt:lpwstr></property></Properties>`;

        const entries = [
          { name: '[Content_Types].xml', data: contentTypes },
          { name: '_rels/.rels', data: mapPptxRelsXml(
            `<Relationship Id="rId1" Type="${REL}officeDocument" Target="ppt/presentation.xml"/>`
            + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            + `<Relationship Id="rId3" Type="${REL}extended-properties" Target="docProps/app.xml"/>`
            + `<Relationship Id="rId4" Type="${REL}custom-properties" Target="docProps/custom.xml"/>`) },
          { name: 'docProps/core.xml', data: core },
          { name: 'docProps/app.xml', data: app },
          { name: 'docProps/custom.xml', data: custom },
""")

# ---------------------------------------------------------------- 11. focus ring is findable
rep(r"""        const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.appendChild(ring(weight * 5.2, weight * 4.2, 0.22));""",
    r"""        const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
        // Named so the PowerPoint shape writer can keep the ring on a node step.
        group.setAttribute('data-t-focus-marker', '1');
        group.appendChild(ring(weight * 5.2, weight * 4.2, 0.22));""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
