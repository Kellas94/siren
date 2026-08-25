# SIREN patch - pdf stage 1: the deck PDF draws every slide as vector shapes and real text.
# Applies on top of pdf_fonts.py (needs pdfFontResources / pdfEncodeText / pdfTextShowOps).
# Takes the target html path as argv[1]; idempotent (refuses to apply twice).
# Regions: new block after formatPdfNumber (deckVectorPage, buildDeckPdf, deckPdfKeptNote and
# helpers); mapExportRoute (slides loop, placed map, writer call, toast); mapChooseDeckExport
# 'pdf' row wording; #mapExportButton title.
import io, os, sys
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
def rep(anchor, new, n=1):
    global s; c = s.count(anchor); assert c == n, (c, anchor[:90]); s = s.replace(anchor, new)
assert 'function pdfFontResources(pdf)' in s, 'apply pdf_fonts.py first'
if 'async function deckVectorPage(' in s:
    print('pdf_vector already applied'); sys.exit(0)

STAGE1_BLOCK = r"""      /* ---- deck PDF: vector pages -------------------------------------------
         The deck PDF used to be a JPEG photograph of every slide (~290 KB a page,
         no selectable text). Each slide is now converted from the LIVE-rendered
         slide SVG into PDF drawing operators: the SVG is mounted off-screen in this
         document so Mermaid's CSS applies, every element is read with
         getComputedStyle + getScreenCTM, nested pictures are clipped in page space,
         text is written with the embedded fonts at DOM-measured positions, and
         arrowheads come from the marker definitions. Anything the converter does
         not understand (a gradient, a filter, an odd tag) is kept as a small
         picture tile cut from the raster of the same slide; a slide that throws
         stays a whole picture. The toast names both. buildRasterPdf and the other
         raster PDF producers are untouched. ---- */
      const DECK_VECTOR_MAX_ELEMENTS = 8000;
      const DECK_SKIP_TAGS = new Set(['defs', 'style', 'script', 'title', 'desc', 'marker', 'clippath', 'mask', 'pattern', 'lineargradient', 'radialgradient', 'symbol', 'metadata', 'filter']);
      const DECK_KAPPA = 0.5522847498;

      function deckPdfNum(value) { return Number.isFinite(value) ? formatPdfNumber(value) : '0'; }

      // A computed CSS colour -> { r, g, b, a } in 0..1, or null for none/transparent.
      function deckPdfColour(value) {
        const raw = String(value || '').trim();
        if (!raw || raw === 'none' || raw === 'transparent') return null;
        let m = raw.match(/^rgba?\(([^)]+)\)$/);
        if (m) {
          const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
          if (parts.length < 3) return null;
          const a = parts.length > 3 ? parts[3] : 1;
          if (!(a > 0.004)) return null;
          return { r: parts[0] / 255, g: parts[1] / 255, b: parts[2] / 255, a };
        }
        m = raw.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
        if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
        if (/^url\(/.test(raw)) return { r: 0.5, g: 0.5, b: 0.5, a: 1, paintServer: true };
        const parsed = typeof parseCssColour === 'function' ? parseCssColour(raw) : null;
        if (parsed && Number.isFinite(parsed.r)) return { r: parsed.r / 255, g: parsed.g / 255, b: parsed.b / 255, a: Number.isFinite(parsed.a) ? parsed.a : 1 };
        return null;
      }

      // SVG arc -> cubic Béziers (SVG implementation notes F.6.5).
      function deckPdfArcToBeziers(x1, y1, rx, ry, phi, largeArc, sweep, x2, y2) {
        if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]];
        const rad = phi * Math.PI / 180;
        const cs = Math.cos(rad);
        const sn = Math.sin(rad);
        rx = Math.abs(rx); ry = Math.abs(ry);
        const dx = (x1 - x2) / 2;
        const dy = (y1 - y2) / 2;
        const x1p = cs * dx + sn * dy;
        const y1p = -sn * dx + cs * dy;
        const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
        if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
        const sign = largeArc === sweep ? -1 : 1;
        const numr = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
        const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
        const co = den ? sign * Math.sqrt(Math.max(0, numr / den)) : 0;
        const cxp = co * rx * y1p / ry;
        const cyp = -co * ry * x1p / rx;
        const cx = cs * cxp - sn * cyp + (x1 + x2) / 2;
        const cy = sn * cxp + cs * cyp + (y1 + y2) / 2;
        const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
        let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
        if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
        const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
        const out = [];
        const d = dt / segs;
        let t = t1;
        const map = (px, py) => [cx + rx * cs * px - ry * sn * py, cy + rx * sn * px + ry * cs * py];
        for (let i = 0; i < segs; i += 1) {
          const t2 = t + d;
          const k = 4 / 3 * Math.tan(d / 4);
          const p1x = Math.cos(t), p1y = Math.sin(t), p2x = Math.cos(t2), p2y = Math.sin(t2);
          const a = map(p1x - k * p1y, p1y + k * p1x);
          const b = map(p2x + k * p2y, p2y - k * p2x);
          const e = map(p2x, p2y);
          out.push([a[0], a[1], b[0], b[1], e[0], e[1]]);
          t = t2;
        }
        return out;
      }

      // SVG path data -> PDF path operators in the element's own units.
      function deckPdfPathOps(d) {
        const tok = String(d || '').match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || [];
        const ops = [];
        let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0, lcx = 0, lcy = 0, last = '';
        const n = () => parseFloat(tok[i++]);
        const num = deckPdfNum;
        while (i < tok.length) {
          if (/^[A-Za-z]$/.test(tok[i])) cmd = tok[i++];
          else if (cmd === 'M') cmd = 'L'; else if (cmd === 'm') cmd = 'l';
          if (!cmd) { i += 1; continue; }
          const rel = cmd === cmd.toLowerCase();
          const C = cmd.toUpperCase();
          let x, y, x1, y1, x2, y2;
          if (C === 'Z') { ops.push('h'); cx = sx; cy = sy; last = 'Z'; continue; }
          if (C === 'M' || C === 'L' || C === 'T') {
            x = n(); y = n(); if (rel) { x += cx; y += cy; }
            if (C === 'T') {
              const qx = (last === 'Q' || last === 'T') ? 2 * cx - lcx : cx;
              const qy = (last === 'Q' || last === 'T') ? 2 * cy - lcy : cy;
              ops.push([cx + 2 / 3 * (qx - cx), cy + 2 / 3 * (qy - cy), x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), x, y].map(num).join(' ') + ' c');
              lcx = qx; lcy = qy;
            } else {
              ops.push(num(x) + ' ' + num(y) + (C === 'M' ? ' m' : ' l'));
              if (C === 'M') { sx = x; sy = y; }
            }
            cx = x; cy = y; last = C; continue;
          }
          if (C === 'H') { x = n(); if (rel) x += cx; ops.push(num(x) + ' ' + num(cy) + ' l'); cx = x; last = C; continue; }
          if (C === 'V') { y = n(); if (rel) y += cy; ops.push(num(cx) + ' ' + num(y) + ' l'); cy = y; last = C; continue; }
          if (C === 'C') {
            x1 = n(); y1 = n(); x2 = n(); y2 = n(); x = n(); y = n();
            if (rel) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; }
            ops.push([x1, y1, x2, y2, x, y].map(num).join(' ') + ' c'); lcx = x2; lcy = y2; cx = x; cy = y; last = C; continue;
          }
          if (C === 'S') {
            x2 = n(); y2 = n(); x = n(); y = n();
            if (rel) { x2 += cx; y2 += cy; x += cx; y += cy; }
            x1 = (last === 'C' || last === 'S') ? 2 * cx - lcx : cx; y1 = (last === 'C' || last === 'S') ? 2 * cy - lcy : cy;
            ops.push([x1, y1, x2, y2, x, y].map(num).join(' ') + ' c'); lcx = x2; lcy = y2; cx = x; cy = y; last = C; continue;
          }
          if (C === 'Q') {
            x1 = n(); y1 = n(); x = n(); y = n();
            if (rel) { x1 += cx; y1 += cy; x += cx; y += cy; }
            ops.push([cx + 2 / 3 * (x1 - cx), cy + 2 / 3 * (y1 - cy), x + 2 / 3 * (x1 - x), y + 2 / 3 * (y1 - y), x, y].map(num).join(' ') + ' c');
            lcx = x1; lcy = y1; cx = x; cy = y; last = C; continue;
          }
          if (C === 'A') {
            const rx = n(), ry = n(), phi = n(), fa = n(), fs = n(); x = n(); y = n();
            if (rel) { x += cx; y += cy; }
            deckPdfArcToBeziers(cx, cy, rx, ry, phi, fa, fs, x, y).forEach(b => ops.push(b.map(num).join(' ') + ' c'));
            cx = x; cy = y; last = C; continue;
          }
          i += 1;
        }
        return ops;
      }

      function deckPdfEllipseOps(cx, cy, rx, ry) {
        if (!(rx > 0) || !(ry > 0)) return null;
        const num = deckPdfNum;
        const kx = rx * DECK_KAPPA, ky = ry * DECK_KAPPA;
        return [num(cx + rx) + ' ' + num(cy) + ' m',
          [cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry].map(num).join(' ') + ' c',
          [cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy].map(num).join(' ') + ' c',
          [cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry].map(num).join(' ') + ' c',
          [cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy].map(num).join(' ') + ' c', 'h'];
      }

      function deckPdfRectOps(x, y, w, h, rx, ry) {
        if (!(w > 0) || !(h > 0)) return null;
        const num = deckPdfNum;
        if (!(rx > 0) && !(ry > 0)) return [num(x) + ' ' + num(y) + ' ' + num(w) + ' ' + num(h) + ' re'];
        if (!(rx > 0)) rx = ry;
        if (!(ry > 0)) ry = rx;
        rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
        const kx = rx * DECK_KAPPA, ky = ry * DECK_KAPPA;
        return [num(x + rx) + ' ' + num(y) + ' m', num(x + w - rx) + ' ' + num(y) + ' l',
          [x + w - rx + kx, y, x + w, y + ry - ky, x + w, y + ry].map(num).join(' ') + ' c',
          num(x + w) + ' ' + num(y + h - ry) + ' l',
          [x + w, y + h - ry + ky, x + w - rx + kx, y + h, x + w - rx, y + h].map(num).join(' ') + ' c',
          num(x + rx) + ' ' + num(y + h) + ' l',
          [x + rx - kx, y + h, x, y + h - ry + ky, x, y + h - ry].map(num).join(' ') + ' c',
          num(x) + ' ' + num(y + ry) + ' l',
          [x, y + ry - ky, x + rx - kx, y, x + rx, y].map(num).join(' ') + ' c', 'h'];
      }

      function deckPdfPolyOps(el, close) {
        const pts = el.points;
        const ops = [];
        for (let i = 0; i < pts.numberOfItems; i += 1) {
          const p = pts.getItem(i);
          ops.push(deckPdfNum(p.x) + ' ' + deckPdfNum(p.y) + (i ? ' l' : ' m'));
        }
        if (close && ops.length) ops.push('h');
        return ops;
      }

      // One PDF document in the making: the writer, its fonts and the shared
      // transparency states. Created once per deck export, before the slides loop.
      function deckPdfDocument() {
        const pdf = new PdfBuilder();
        return { pdf, fonts: pdfFontResources(pdf), gsIds: {} };
      }

      /* One slide -> one vector page. Resolves to { content, gs, images, fallbacks,
         stats } or throws (the caller then keeps the slide as a picture). */
      async function deckVectorPage(svgString, mediaW, mediaH, deck) {
        const safeSvg = sanitizeSvgForRaster(svgString);
        const pdf = deck.pdf;
        const fonts = deck.fonts;
        const num = deckPdfNum;
        const NL = '\n';
        const out = [];
        const gs = {};
        const images = {};
        const fallbacks = [];
        const tiles = [];
        const stats = { elements: 0, shapes: 0, textRuns: 0, lostChars: 0, markers: 0, clips: 0, images: 0, midMarkersSkipped: 0, charCountMismatch: 0 };
        const stage = document.createElement('div');
        stage.setAttribute('aria-hidden', 'true');
        stage.style.cssText = 'position:fixed;left:-100000px;top:0;width:4000px;height:3000px;overflow:visible;pointer-events:none';
        stage.innerHTML = safeSvg;
        document.body.appendChild(stage);
        let W = 0, H = 0, k = 1, offX = 0, offY = 0;
        try {
          const root = stage.querySelector('svg');
          if (!root) throw new Error('slide has no svg');
          const elementCount = root.querySelectorAll('*').length;
          if (elementCount > DECK_VECTOR_MAX_ELEMENTS) throw new Error(`slide has ${elementCount} elements; kept as a picture`);
          W = parseFloat(root.getAttribute('width')) || root.viewBox.baseVal.width;
          H = parseFloat(root.getAttribute('height')) || root.viewBox.baseVal.height;
          if (!(W > 0) || !(H > 0)) throw new Error('slide has no size');
          k = Math.min(mediaW / W, mediaH / H);
          offX = (mediaW - W * k) / 2;
          offY = (mediaH - H * k) / 2;
          const rootCtm = root.getScreenCTM();
          if (!rootCtm) throw new Error('slide is not laid out');
          const rootInv = rootCtm.inverse();
          const rootRect = root.getBoundingClientRect();
          const rootScale = rootRect.width > 0 ? W / rootRect.width : 1;

          // element user space -> PDF page (root viewBox px scaled and flipped)
          const pdfMatrix = el => {
            const m = el.getScreenCTM();
            if (!m) return null;
            const r = rootInv.multiply(m);
            return [k * r.a, -k * r.b, k * r.c, -k * r.d, offX + k * r.e, mediaH - offY - k * r.f];
          };
          const gsName = alpha => { const key = 'GS' + Math.round(alpha * 1000); gs[key] = alpha; return key; };
          const lenOf = (el, name) => { try { return el[name].baseVal.value; } catch (error) { return parseFloat(el.getAttribute(name)) || 0; } };
          const isBold = cs => /bold/i.test(cs.fontWeight) || parseFloat(cs.fontWeight) >= 600;

          const paintOps = (cs, groupAlpha) => {
            const ops = [];
            const fill = deckPdfColour(cs.fill);
            const stroke = deckPdfColour(cs.stroke);
            const fa = fill ? fill.a * (cs.fillOpacity === '' ? 1 : parseFloat(cs.fillOpacity)) * groupAlpha : 0;
            let sa = stroke ? stroke.a * (cs.strokeOpacity === '' ? 1 : parseFloat(cs.strokeOpacity)) * groupAlpha : 0;
            const swidth = parseFloat(cs.strokeWidth);
            if (!(swidth > 0)) sa = 0; // stroke-width:0 paints nothing (Mermaid mindmap node lines)
            if (fill && fa > 0.004) ops.push(num(fill.r) + ' ' + num(fill.g) + ' ' + num(fill.b) + ' rg');
            if (stroke && sa > 0.004) {
              ops.push(num(stroke.r) + ' ' + num(stroke.g) + ' ' + num(stroke.b) + ' RG');
              ops.push(num(swidth) + ' w');
              const cap = cs.strokeLinecap === 'round' ? 1 : cs.strokeLinecap === 'square' ? 2 : 0;
              const join = cs.strokeLinejoin === 'round' ? 1 : cs.strokeLinejoin === 'bevel' ? 2 : 0;
              ops.push(cap + ' J ' + join + ' j');
              const dash = String(cs.strokeDasharray || 'none');
              if (dash !== 'none') {
                const arr = dash.split(/[\s,]+/).map(parseFloat).filter(v => Number.isFinite(v) && v >= 0);
                if (arr.length && arr.some(v => v > 0)) ops.push('[' + arr.map(num).join(' ') + '] 0 d');
              }
            }
            const alpha = Math.min(fa > 0.004 ? fa : 1, sa > 0.004 ? sa : 1);
            if (alpha < 0.999) ops.push('/' + gsName(alpha) + ' gs');
            return { ops, fill: !!(fill && fa > 0.004), stroke: !!(stroke && sa > 0.004), evenodd: cs.fillRule === 'evenodd', paintServer: !!((fill && fill.paintServer) || (stroke && stroke.paintServer)) };
          };
          const paintOp = p => (p.fill && p.stroke) ? (p.evenodd ? 'B*' : 'B') : p.fill ? (p.evenodd ? 'f*' : 'f') : p.stroke ? 'S' : 'n';
          const geometryOf = (el, tag) => {
            if (tag === 'rect') return deckPdfRectOps(lenOf(el, 'x'), lenOf(el, 'y'), lenOf(el, 'width'), lenOf(el, 'height'), lenOf(el, 'rx'), lenOf(el, 'ry'));
            if (tag === 'circle') return deckPdfEllipseOps(lenOf(el, 'cx'), lenOf(el, 'cy'), lenOf(el, 'r'), lenOf(el, 'r'));
            if (tag === 'ellipse') return deckPdfEllipseOps(lenOf(el, 'cx'), lenOf(el, 'cy'), lenOf(el, 'rx'), lenOf(el, 'ry'));
            if (tag === 'line') return [num(lenOf(el, 'x1')) + ' ' + num(lenOf(el, 'y1')) + ' m ' + num(lenOf(el, 'x2')) + ' ' + num(lenOf(el, 'y2')) + ' l'];
            if (tag === 'polyline') return deckPdfPolyOps(el, false);
            if (tag === 'polygon') return deckPdfPolyOps(el, true);
            if (tag === 'path') return deckPdfPathOps(el.getAttribute('d'));
            return undefined; // not a shape tag (an empty shape returns null or [])
          };

          // Something the converter cannot draw: remember its box, cut a tile from
          // the raster of the same slide afterwards and place it here, in z-order.
          const tileFallback = (el, reason) => {
            fallbacks.push(reason);
            let rect;
            try { rect = el.getBoundingClientRect(); } catch (error) { return; }
            if (!rect || !(rect.width > 0) || !(rect.height > 0)) return;
            const pad = 2;
            const box = {
              x: (rect.left - rootRect.left) * rootScale - pad,
              y: (rect.top - rootRect.top) * rootScale - pad,
              w: rect.width * rootScale + pad * 2,
              h: rect.height * rootScale + pad * 2
            };
            tiles.push({ index: out.length, box });
            out.push('');
          };

          const drawMarker = (pathEl, markerEl, which, cs, groupAlpha) => {
            let L;
            try { L = pathEl.getTotalLength(); } catch (error) { return; }
            let p, ang;
            if (!(L > 0)) {
              // a zero-length host (Mermaid's sequence-number disc rides on one): position only
              try { p = pathEl.getPointAtLength(0); } catch (error) { return; }
              if (!p) return;
              ang = 0;
            } else {
              const at = which === 'start' ? 0 : L;
              p = pathEl.getPointAtLength(at);
              const q = pathEl.getPointAtLength(which === 'start' ? Math.min(L, 0.5) : Math.max(0, L - 0.5));
              ang = Math.atan2(p.y - q.y, p.x - q.x);
            }
            const orient = markerEl.getAttribute('orient');
            if (orient === 'auto-start-reverse' && which === 'start') ang += Math.PI;
            else if (orient && orient !== 'auto' && orient !== 'auto-start-reverse') ang = (parseFloat(orient) || 0) * Math.PI / 180;
            const units = markerEl.getAttribute('markerUnits') || 'strokeWidth';
            // Chrome still draws a strokeWidth-unit marker on a stroke-width:0 host at scale 1
            const sw = units === 'userSpaceOnUse' ? 1 : (parseFloat(cs.strokeWidth) || 1);
            const mw = parseFloat(markerEl.getAttribute('markerWidth')) || 3;
            const mh = parseFloat(markerEl.getAttribute('markerHeight')) || 3;
            const vb = markerEl.viewBox && markerEl.viewBox.baseVal;
            let s = 1, vx = 0, vy = 0;
            if (vb && vb.width > 0 && vb.height > 0) { s = Math.min(mw / vb.width, mh / vb.height); vx = vb.x; vy = vb.y; }
            const refX = parseFloat(markerEl.getAttribute('refX')) || 0;
            const refY = parseFloat(markerEl.getAttribute('refY')) || 0;
            const base = pdfMatrix(pathEl);
            if (!base) return;
            const cs_ = Math.cos(ang), sn_ = Math.sin(ang);
            const a = cs_ * sw * s, b = sn_ * sw * s, c = -sn_ * sw * s, d = cs_ * sw * s;
            const e = p.x - (a * (refX + vx) + c * (refY + vy));
            const f = p.y - (b * (refX + vx) + d * (refY + vy));
            const M = [base[0] * a + base[2] * b, base[1] * a + base[3] * b, base[0] * c + base[2] * d, base[1] * c + base[3] * d, base[0] * e + base[2] * f + base[4], base[1] * e + base[3] * f + base[5]];
            const parts = ['q ' + M.map(num).join(' ') + ' cm'];
            let drew = 0;
            Array.from(markerEl.children).forEach(child => {
              const tag = child.tagName.toLowerCase();
              const geo = geometryOf(child, tag);
              if (!geo || !geo.length) return;
              const ccs = getComputedStyle(child);
              const pnt = paintOps(ccs, groupAlpha);
              // Mermaid paints markers through CSS; if nothing resolved, use the host's stroke colour
              if (!pnt.fill && !pnt.stroke) {
                const sc = deckPdfColour(cs.stroke);
                if (sc) { pnt.ops.push(num(sc.r) + ' ' + num(sc.g) + ' ' + num(sc.b) + ' rg'); pnt.fill = true; }
              }
              if (!pnt.fill && !pnt.stroke) return;
              parts.push(pnt.ops.join(NL)); parts.push(geo.join(NL)); parts.push(paintOp(pnt));
              drew += 1;
            });
            if (!drew) return;
            parts.push('Q');
            out.push(parts.join(NL));
            stats.markers += drew;
          };

          const textLeaves = textEl => {
            const spans = Array.from(textEl.querySelectorAll('tspan')).filter(t => !t.querySelector('tspan'));
            return spans.length ? spans : [textEl];
          };
          const emitText = (textEl, cs, groupAlpha) => {
            const M = pdfMatrix(textEl);
            if (!M) return;
            if (textEl.querySelector('textPath')) { tileFallback(textEl, 'textPath'); return; }
            textLeaves(textEl).forEach(leaf => {
              const lcs = leaf === textEl ? cs : getComputedStyle(leaf);
              if (lcs.display === 'none' || lcs.visibility === 'hidden') return;
              let n;
              try { n = leaf.getNumberOfChars(); } catch (error) { n = 0; }
              if (!n) return;
              let s = String(leaf.textContent || '').replace(/\s+/g, ' ');
              if (s.length !== n) s = s.trim();
              if (s.length !== n) stats.charCountMismatch += 1;
              if (!s) return;
              let start, end, shiftY = 0;
              try {
                start = leaf.getStartPositionOfChar(0);
                end = leaf.getEndPositionOfChar(n - 1);
                // getStartPositionOfChar ignores dominant-baseline while getExtentOfChar
                // honours it: measure the shift against the same glyph with the baseline
                // forced to auto on the leaf and every ancestor up to the <text>.
                const actualY = leaf.getExtentOfChar(0).y;
                const chain = [];
                for (let anc = leaf; anc; anc = anc.parentElement) { chain.push([anc, anc.getAttribute('style')]); if (anc === textEl) break; }
                chain.forEach(pair => { pair[0].style.setProperty('dominant-baseline', 'auto', 'important'); pair[0].style.setProperty('alignment-baseline', 'auto', 'important'); pair[0].style.setProperty('baseline-shift', '0', 'important'); });
                const autoY = leaf.getExtentOfChar(0).y;
                chain.forEach(pair => { if (pair[1] == null) pair[0].removeAttribute('style'); else pair[0].setAttribute('style', pair[1]); });
                shiftY = Number.isFinite(actualY - autoY) ? actualY - autoY : 0;
              } catch (error) { return; }
              const size = parseFloat(lcs.fontSize) || 12;
              const fill = deckPdfColour(lcs.fill);
              if (!fill) return;
              const bold = isBold(lcs);
              const alpha = fill.a * (lcs.fillOpacity === '' ? 1 : parseFloat(lcs.fillOpacity)) * groupAlpha;
              if (!(alpha > 0.004)) return;
              const encoded = pdfEncodeText(s, bold);
              stats.lostChars += encoded.lost;
              const rendered = Math.hypot(end.x - start.x, end.y - start.y);
              const spacing = parseFloat(lcs.letterSpacing);
              const tc = Number.isFinite(spacing) ? spacing : 0;
              const natural = encoded.width * size + tc * s.length;
              // The PDF font is not the screen font (Inter on screen, Noto Sans in the
              // file), so a run is fitted into the width it had on screen: a small
              // horizontal scale keeps every word where Mermaid put it, inside the box
              // it measured. A run that would need more than a quarter of stretch is
              // left at its natural width and only its anchor point is kept.
              const ratio = rendered > 0 && natural > 0 ? rendered / natural : 1;
              const fitted = ratio >= 0.75 && ratio <= 1.25;
              const anchor = lcs.textAnchor;
              const shift = fitted ? 0 : anchor === 'middle' ? (rendered - natural) / 2 : anchor === 'end' ? (rendered - natural) : 0;
              const ux = rendered > 0 ? (end.x - start.x) / rendered : 1;
              const uy = rendered > 0 ? (end.y - start.y) / rendered : 0;
              const x = start.x + ux * shift;
              const y = start.y + uy * shift + shiftY;
              const ops = ['q ' + M.map(num).join(' ') + ' cm', num(fill.r) + ' ' + num(fill.g) + ' ' + num(fill.b) + ' rg'];
              if (alpha < 0.999) ops.push('/' + gsName(alpha) + ' gs');
              const textState = (fitted && Math.abs(ratio - 1) > 0.0005 ? num(ratio * 100) + ' Tz ' : '') + (tc ? num(tc) + ' Tc ' : '');
              // Tm flips back: the cm above carries SVG's y-down. The baseline direction is kept.
              ops.push('BT 1 0 0 -1 ' + num(x) + ' ' + num(y) + ' Tm ' + textState + pdfTextShowOps(encoded, size, fonts) + ' ET', 'Q');
              out.push(ops.join(NL));
              stats.textRuns += 1;
            });
          };

          const emitImage = el => {
            const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
            if (!/^data:image\/(jpeg|jpg);base64,/i.test(href)) { tileFallback(el, 'image'); return; }
            const M = pdfMatrix(el);
            if (!M) return;
            const x = lenOf(el, 'x'), y = lenOf(el, 'y'), w = lenOf(el, 'width'), h = lenOf(el, 'height');
            if (!(w > 0) || !(h > 0)) return;
            const bin = atob(href.split(',')[1]);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
            const name = 'Im' + (Object.keys(images).length + 1);
            images[name] = pdf.addStream(`/Type /XObject /Subtype /Image /Width ${Math.max(1, Math.round(w))} /Height ${Math.max(1, Math.round(h))} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, bytes);
            out.push('q ' + M.map(num).join(' ') + ' cm ' + [w, 0, 0, -h, x, y + h].map(num).join(' ') + ' cm /' + name + ' Do Q');
            stats.images += 1;
          };

          const walk = (el, groupAlpha) => {
            if (el.nodeType !== 1) return;
            const tag = el.tagName.toLowerCase();
            if (DECK_SKIP_TAGS.has(tag)) return;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return;
            const own = cs.opacity === '' ? 1 : parseFloat(cs.opacity);
            if (!(own > 0)) return;
            const alpha = groupAlpha * own;
            stats.elements += 1;
            // effects the converter does not model: keep the whole element as a picture tile
            if ((cs.filter && cs.filter !== 'none') || (cs.mask && cs.mask !== 'none') || (cs.clipPath && cs.clipPath !== 'none' && tag !== 'svg')) { tileFallback(el, tag + ':' + (cs.filter !== 'none' ? 'filter' : cs.mask !== 'none' ? 'mask' : 'clip-path')); return; }
            if (tag === 'svg') {
              const parentEl = el.parentElement;
              if (parentEl && el !== root) {
                const pm = pdfMatrix(parentEl);
                const x = lenOf(el, 'x'), y = lenOf(el, 'y'), w = lenOf(el, 'width'), h = lenOf(el, 'height');
                if (pm && w > 0 && h > 0 && cs.overflow !== 'visible') {
                  // clip in PAGE space (no cm), so the children's absolute matrices still hold
                  const P = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(p => [pm[0] * p[0] + pm[2] * p[1] + pm[4], pm[1] * p[0] + pm[3] * p[1] + pm[5]]);
                  out.push('q ' + P.map((p, i) => num(p[0]) + ' ' + num(p[1]) + (i ? ' l' : ' m')).join(' ') + ' h W n');
                  stats.clips += 1;
                  Array.from(el.children).forEach(c => walk(c, alpha));
                  out.push('Q');
                  return;
                }
              }
              Array.from(el.children).forEach(c => walk(c, alpha));
              return;
            }
            if (tag === 'g' || tag === 'a' || tag === 'switch') { Array.from(el.children).forEach(c => walk(c, alpha)); return; }
            if (tag === 'text') { emitText(el, cs, alpha); return; }
            if (tag === 'image') { emitImage(el); return; }
            if (tag === 'use') {
              // draw the referenced shape in place: a clone beside the <use>, walked, then removed
              const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
              const ref = href.startsWith('#') ? root.querySelector('#' + CSS.escape(href.slice(1))) : null;
              const refTag = ref ? ref.tagName.toLowerCase() : '';
              if (!ref || refTag === 'symbol' || refTag === 'svg') { tileFallback(el, 'use'); return; }
              const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
              const ownTransform = el.getAttribute('transform') || '';
              wrap.setAttribute('transform', (ownTransform ? ownTransform + ' ' : '') + 'translate(' + lenOf(el, 'x') + ',' + lenOf(el, 'y') + ')');
              if (el.getAttribute('class')) wrap.setAttribute('class', el.getAttribute('class'));
              if (el.getAttribute('style')) wrap.setAttribute('style', el.getAttribute('style'));
              const clone = ref.cloneNode(true);
              clone.removeAttribute('id');
              wrap.appendChild(clone);
              el.parentNode.insertBefore(wrap, el.nextSibling);
              try { walk(wrap, alpha); } finally { wrap.remove(); }
              return;
            }
            const geo = geometryOf(el, tag);
            if (geo === undefined) { tileFallback(el, tag); return; }
            if (!geo || !geo.length) return;
            const M = pdfMatrix(el);
            if (!M) return;
            const pnt = paintOps(cs, alpha);
            if (pnt.paintServer) { tileFallback(el, tag + ':gradient'); return; }
            if (tag === 'line' || tag === 'polyline') pnt.fill = false;
            if (pnt.fill || pnt.stroke) {
              out.push('q ' + M.map(num).join(' ') + ' cm' + NL + pnt.ops.join(NL) + NL + geo.join(NL) + NL + paintOp(pnt) + NL + 'Q');
              stats.shapes += 1;
            }
            ['marker-start', 'marker-mid', 'marker-end'].forEach(attr => {
              const v = cs.getPropertyValue(attr) || el.getAttribute(attr) || '';
              const m = /url\(["']?#([^"')]+)/.exec(v);
              if (!m) return;
              // root-scoped first: the live Map tiles can carry the same ids
              const markerEl = root.querySelector('#' + CSS.escape(m[1])) || document.getElementById(m[1]);
              if (!markerEl) return;
              if (attr === 'marker-mid') { stats.midMarkersSkipped += 1; return; }
              drawMarker(el, markerEl, attr === 'marker-start' ? 'start' : 'end', cs, alpha);
            });
          };
          walk(root, 1);
        } finally {
          stage.remove();
        }

        // Picture tiles for what the converter could not draw, cut from one raster of the slide.
        if (tiles.length) {
          const shot = await svgToCanvas(svgString, 2, 'current');
          const canvas = shot && shot.canvas ? shot.canvas : shot;
          if (canvas && canvas.width) {
            const px = canvas.width / W;
            for (const tile of tiles) {
              const b = tile.box;
              const sx = Math.max(0, Math.floor(b.x * px)), sy = Math.max(0, Math.floor(b.y * px));
              const sw = Math.min(canvas.width - sx, Math.ceil(b.w * px)), sh = Math.min(canvas.height - sy, Math.ceil(b.h * px));
              if (!(sw > 0) || !(sh > 0)) continue;
              const jpeg = await canvasRegionToJpeg(canvas, sx, sy, sw, sh);
              const name = 'Im' + (Object.keys(images).length + 1);
              images[name] = pdf.addStream(`/Type /XObject /Subtype /Image /Width ${sw} /Height ${sh} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, jpeg);
              const x = sx / px, y = sy / px, w = sw / px, h = sh / px;
              out[tile.index] = 'q ' + [k * w, 0, 0, k * h, offX + k * x, mediaH - offY - k * (y + h)].map(num).join(' ') + ' cm /' + name + ' Do Q';
              stats.images += 1;
            }
          }
        }
        const content = out.filter(Boolean).join(NL);
        if (!/^[\x00-\x7F]*$/.test(content)) throw new Error('vector page content is not ASCII');
        return { content, gs, images, fallbacks, stats };
      }

      /* The deck writer: vector pages and picture pages in one document. A picture
         page has the same shape buildRasterPdf takes; a vector page carries its
         content stream and the resources it used. */
      function buildDeckPdf(deck, pages, pageWidth, pageHeight) {
        const pdf = deck.pdf;
        const catalogId = pdf.reserve();
        const pagesId = pdf.reserve();
        const pageIds = [];
        for (const page of pages) {
          const mediaW = Number(page.pageWidth) > 0 ? Number(page.pageWidth) : pageWidth;
          const mediaH = Number(page.pageHeight) > 0 ? Number(page.pageHeight) : pageHeight;
          let resources;
          let contentId;
          if (page.kind === 'vector') {
            contentId = pdf.addStream('', new TextEncoder().encode(page.content));
            const gsDict = Object.keys(page.gs || {}).map(key => {
              if (!deck.gsIds[key]) deck.gsIds[key] = pdf.add(`<< /Type /ExtGState /ca ${formatPdfNumber(page.gs[key])} /CA ${formatPdfNumber(page.gs[key])} >>`);
              return `/${key} ${deck.gsIds[key]} 0 R`;
            }).join(' ');
            const imageDict = Object.keys(page.images || {}).map(key => `/${key} ${page.images[key]} 0 R`).join(' ');
            resources = `<< /ProcSet [/PDF /Text /ImageC] /Font << ${deck.fonts.dict()} >>`
              + (gsDict ? ` /ExtGState << ${gsDict} >>` : '')
              + (imageDict ? ` /XObject << ${imageDict} >>` : '') + ' >>';
          } else {
            const imageId = pdf.addStream(`/Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Interpolate false /Filter /DCTDecode`, page.jpeg);
            const content = `q\n${formatPdfNumber(page.drawWidth)} 0 0 ${formatPdfNumber(page.drawHeight)} ${formatPdfNumber(page.x)} ${formatPdfNumber(page.y)} cm\n/Im0 Do\nQ`;
            contentId = pdf.addStream('', new TextEncoder().encode(content));
            resources = `<< /ProcSet [/PDF /ImageC] /XObject << /Im0 ${imageId} 0 R >> >>`;
          }
          pageIds.push(pdf.add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${formatPdfNumber(mediaW)} ${formatPdfNumber(mediaH)}] /Resources ${resources} /Contents ${contentId} 0 R >>`));
        }
        pdf.set(pagesId, `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
        pdf.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
        return pdf.build(catalogId);
      }

      // The sentence the export toast adds when something stayed a picture or a letter had no glyph.
      function deckPdfKeptNote(kept) {
        let note = '';
        if (kept.raster.length) note += ` ${kept.raster.length === 1 ? 'Slide' : 'Slides'} ${kept.raster.join(', ')} had to stay ${kept.raster.length === 1 ? 'a picture' : 'pictures'}.`;
        if (kept.tiles) note += ` ${kept.tiles} detail${kept.tiles === 1 ? '' : 's'} ${kept.tiles === 1 ? 'was' : 'were'} kept as a small picture.`;
        if (kept.lost) note += ` ${kept.lost} character${kept.lost === 1 ? '' : 's'} had no glyph in the PDF font and ${kept.lost === 1 ? 'was' : 'were'} written as ?.`;
        return note;
      }

"""

# 1. converter + writer, right after formatPdfNumber (which they use)
rep("      function formatPdfNumber(value) { return Number(value.toFixed(3)).toString(); }\n",
    "      function formatPdfNumber(value) { return Number(value.toFixed(3)).toString(); }\n\n" + STAGE1_BLOCK)

# 2. mapExportRoute: the slides loop tries the vector page first when the format is PDF
rep(r"""        const pages = [];
        for (let index = 0; index < slides.length; index += 1) {
          try {
            const shot = await svgToCanvas(slides[index].svg, 2, 'current');""",
    r"""        const pages = [];
        // The PDF draws each slide as real shapes and text (deckVectorPage). A slide
        // the converter cannot handle stays a picture, and the closing toast says so.
        const deck = format === 'pdf' ? deckPdfDocument() : null;
        const kept = { raster: [], tiles: 0, lost: 0 };
        for (let index = 0; index < slides.length; index += 1) {
          if (deck) {
            try {
              const shape = slides[index].page || DECK_PAGE.landscape;
              const boxW = Number(shape.pdfW) > 0 ? Number(shape.pdfW) : 1280;
              const boxH = Number(shape.pdfH) > 0 ? Number(shape.pdfH) : 720;
              const vector = await deckVectorPage(slides[index].svg, boxW, boxH, deck);
              kept.tiles += vector.fallbacks.length;
              kept.lost += vector.stats.lostChars;
              pages.push({ kind: 'vector', content: vector.content, gs: vector.gs, images: vector.images, pageWidth: boxW, pageHeight: boxH, page: shape, note: slides[index].note || '' });
              continue;
            } catch (error) {
              kept.raster.push(index + 1);
              console.error('vector slide failed; kept as a picture', index + 1, error);
            }
          }
          try {
            const shot = await svgToCanvas(slides[index].svg, 2, 'current');""")

# 3. the pdf branch: vector pages pass through the letterboxing untouched
rep(r"""            if (boxH > boxW) portraitPages += 1;
            const fit = Math.min(boxW / page.imageWidth, boxH / page.imageHeight);""",
    r"""            if (boxH > boxW) portraitPages += 1;
            if (page.kind === 'vector') return page;
            const fit = Math.min(boxW / page.imageWidth, boxH / page.imageHeight);""")
rep("          // page: the page could not turn.  It can now, because buildRasterPdf takes",
    "          // page: the page could not turn.  It can now, because the deck writer takes")
rep("          const bytes = buildRasterPdf(placed, pageWidth, pageHeight);",
    "          const bytes = buildDeckPdf(deck, placed, pageWidth, pageHeight);")
rep(r"""              : '')
            + mapDeckSmallTypeNote(), 'success');""",
    r"""              : '')
            + deckPdfKeptNote(kept)
            + mapDeckSmallTypeNote(), 'success');""")

# 4. wording: the PDF is no longer a picture of every slide
rep("          ['pdf', '⤓ PDF · a picture of every slide'],",
    "          ['pdf', '⤓ PDF · real text and shapes'],")
rep('title="Export the deck: a PDF of pictures, or an editable PowerPoint"',
    'title="Export the deck: a PDF with real text and shapes, or an editable PowerPoint"')

tmp = APP + '.tmp'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, APP)
print('applied pdf_vector', len(orig), '->', len(s), 'delta', len(s) - len(orig))
