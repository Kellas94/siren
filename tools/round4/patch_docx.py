"""SIREN patch: replace the Docs "Word export" (.doc = HTML in disguise) with a
real OOXML .docx writer. Anchor-guarded; takes the target html path as argv[1];
idempotent against the frozen 1.62.0 base (re-running on a patched file fails
the first anchor assertion and leaves the file untouched)."""
import io, os, sys

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

# ---------------------------------------------------------------------------
# 1. The .doc writer goes; the .docx writer takes its place (same spot, before
#    printWorkpapersToPdf). buildWorkpaperExportHtml stays: HTML/PDF use it.
# ---------------------------------------------------------------------------
OLD_DOC_WRITER_HEAD = """      /* Word's HTML reader is inconsistent about data: image URLs. When image
         evidence is present, package the same printable HTML as multipart/related
         and address each raster by Content-Location. Documents without images keep
         the original plain-HTML bytes. */
      function buildWorkpaperWordDocument(doc) {"""
OLD_DOC_WRITER_TAIL = """        parts.push(`--${boundary}--`, '');
        return parts.join(crlf);
      }

      /* A workpaper printed for the file: the browser's own layout engine paginates"""

NEW_WRITER = r'''      /* ---- Word export: a real .docx -------------------------------------------
         The old route wrote HTML and called it .doc: Word opened it with a repair
         prompt and dropped every diagram picture. This writer builds WordprocessingML
         directly. Two rules hold it together and the helpers enforce them: a
         paragraph takes runs, a table cell takes paragraphs. Word refuses a
         paragraph inside a paragraph, so docxParagraph refuses it first. */
      const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const DOCX_PAGE = { width: 11906, height: 16838, margin: 1134 };     // A4 portrait, 2 cm margins, twips
      const DOCX_CONTENT_TWIPS = DOCX_PAGE.width - 2 * DOCX_PAGE.margin;    // 9638
      const DOCX_CONTENT_EMU = DOCX_CONTENT_TWIPS * 635;                    // 6,120,130
      const DOCX_MAX_PICTURE_EMU = 7000000;                                  // ~19.4 cm: a picture stays on one page
      const DOCX_COLOURS = {
        text: '1C2733', muted: '5A6B7D', border: '9AA8B5', shade: 'EEF2F6', code: 'F8FAFC',
        accent: '1C5FBF', comment: 'FDF6E0', commentBar: 'D9A514', resolvedBar: '9AA8B5',
        pass: '14603A', partial: '7A5410', fail: '9F1239', 'not-run': '4A5563'
      };
      // Same palette the editor shows (WP_TEXT_COLOURS / WP_TEXT_HIGHLIGHTS); the two
      // token colours get the hexes the HTML export uses. Legacy class names kept.
      const DOCX_TEXT_COLOURS = (() => {
        const map = { 'wp-c-accent': '1F5FBF', 'wp-c-muted': '6A7480', 'wp-c-good': '17724A', 'wp-c-warn': '8A5A08', 'wp-c-bad': 'A12B22' };
        WP_TEXT_COLOURS.forEach(entry => { if (entry[0] && /^#[0-9a-f]{6}$/i.test(entry[2])) map[entry[0]] = entry[2].slice(1).toUpperCase(); });
        return map;
      })();
      const DOCX_HIGHLIGHTS = (() => {
        const map = {};
        WP_TEXT_HIGHLIGHTS.forEach(entry => { if (entry[0] && /^#[0-9a-f]{6}$/i.test(entry[2])) map[entry[0]] = entry[2].slice(1).toUpperCase(); });
        return map;
      })();
      const DOCX_BREAK = '<w:r><w:br/></w:r>';

      function docxXmlText(value) { return escapeXml(workpaperExportSafeText(value)); }

      // Run properties in the order the schema wants them (Word repairs a file whose
      // rPr children are shuffled).
      function docxRunProps(opts) {
        const o = opts || {};
        let props = '';
        if (o.font) props += `<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/>`;
        if (o.bold) props += '<w:b/><w:bCs/>';
        if (o.italic) props += '<w:i/><w:iCs/>';
        if (o.caps) props += '<w:caps/>';
        if (o.strike) props += '<w:strike/>';
        if (o.color) props += `<w:color w:val="${o.color}"/>`;
        if (o.sz) props += `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`;
        if (o.underline) props += '<w:u w:val="single"/>';
        if (o.shd) props += `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>`;
        return props ? `<w:rPr>${props}</w:rPr>` : '';
      }

      // Text -> runs. A newline becomes a line break run, a tab a tab run; a
      // newline never sits inside <w:t>, where Word would show it as a space.
      function docxRun(text, opts) {
        const value = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
        if (!value) return '';
        const props = docxRunProps(opts);
        return value.split('\n').map(line => line.split('\t').map(piece =>
          piece ? `<w:r>${props}<w:t xml:space="preserve">${docxXmlText(piece)}</w:t></w:r>` : ''
        ).join(`<w:r>${props}<w:tab/></w:r>`)).join(`<w:r>${props}<w:br/></w:r>`);
      }

      function docxParagraph(runsXml, opts) {
        const runs = String(runsXml || '');
        if (/<w:(p|tbl)[ >]/.test(runs)) throw new Error('Word export: a paragraph only takes runs.');
        const o = opts || {};
        let props = '';
        if (o.style) props += `<w:pStyle w:val="${o.style}"/>`;
        if (o.keepNext) props += '<w:keepNext/>';
        if (o.keepLines) props += '<w:keepLines/>';
        if (o.numId) props += `<w:numPr><w:ilvl w:val="${o.ilvl || 0}"/><w:numId w:val="${o.numId}"/></w:numPr>`;
        if (o.topBorder || o.leftBorder) {
          props += '<w:pBdr>'
            + (o.topBorder ? `<w:top w:val="single" w:sz="6" w:space="6" w:color="${o.topBorder}"/>` : '')
            + (o.leftBorder ? `<w:left w:val="single" w:sz="24" w:space="8" w:color="${o.leftBorder}"/>` : '')
            + '</w:pBdr>';
        }
        if (o.shd) props += `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>`;
        if (o.tabRight) props += `<w:tabs><w:tab w:val="right" w:pos="${o.tabRight}"/></w:tabs>`;
        if (o.before != null || o.after != null || o.line) {
          props += '<w:spacing' + (o.before != null ? ` w:before="${o.before}"` : '') + (o.after != null ? ` w:after="${o.after}"` : '')
            + (o.line ? ` w:line="${o.line}" w:lineRule="auto"` : '') + '/>';
        }
        if (o.indLeft != null) props += `<w:ind w:left="${o.indLeft}"${o.hanging != null ? ` w:hanging="${o.hanging}"` : ''}/>`;
        if (o.align) props += `<w:jc w:val="${o.align}"/>`;
        if (o.markSz) props += `<w:rPr><w:sz w:val="${o.markSz}"/><w:szCs w:val="${o.markSz}"/></w:rPr>`;
        return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${runs}</w:p>`;
      }

      // A cell takes paragraphs. Bare runs are wrapped; an empty cell gets an empty
      // paragraph; a cell that ends in a table gets a closing paragraph (Word insists).
      function docxCell(paragraphsXml, opts) {
        let content = String(paragraphsXml || '');
        const o = opts || {};
        if (!/<w:p[ >]/.test(content)) content = docxParagraph(content, { before: 0, after: 0 });
        if (/<\/w:tbl>\s*$/.test(content)) content += docxParagraph('', { before: 0, after: 0 });
        let props = o.width ? `<w:tcW w:w="${o.width}" w:type="dxa"/>` : '<w:tcW w:w="0" w:type="auto"/>';
        if (o.span > 1) props += `<w:gridSpan w:val="${o.span}"/>`;
        if (o.shd) props += `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>`;
        if (o.vAlign) props += `<w:vAlign w:val="${o.vAlign}"/>`;
        return `<w:tc><w:tcPr>${props}</w:tcPr>${content}</w:tc>`;
      }

      function docxRow(cellsXml, opts) {
        const o = opts || {};
        const props = (o.cantSplit ? '<w:cantSplit/>' : '') + (o.header ? '<w:tblHeader/>' : '');
        return `<w:tr>${props ? `<w:trPr>${props}</w:trPr>` : ''}${cellsXml}</w:tr>`;
      }

      // A table is followed by a hairline paragraph: two tables back to back would
      // otherwise fuse into one in Word.
      function docxTable(rowsXml, gridTwips) {
        const grid = (gridTwips || []).map(width => Math.max(1, Math.round(width)));
        const total = grid.reduce((sum, width) => sum + width, 0);
        const border = side => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="${DOCX_COLOURS.border}"/>`;
        return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>`
          + `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders>`
          + '<w:tblLayout w:type="fixed"/>'
          + '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar>'
          + `</w:tblPr><w:tblGrid>${grid.map(width => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${rowsXml}</w:tbl>`
          + docxParagraph('', { before: 0, after: 120, markSz: 8 });
      }

      function docxEvenGrid(columns, total) {
        const count = Math.max(1, columns);
        const width = Math.floor((total || DOCX_CONTENT_TWIPS) / count);
        return Array.from({ length: count }, () => width);
      }

      // rows: arrays of cells. A cell is plain text or { text | runs | paragraphs,
      // head, bold, italic, color, mono, shd }. Header cells are bold on grey.
      function docxGridTable(rows, widths, opts) {
        const o = opts || {};
        const columns = Math.max(1, widths ? widths.length : 0, ...rows.map(row => row.length));
        const grid = widths && widths.length === columns ? widths : docxEvenGrid(columns);
        const rowsXml = rows.map((row, rowIndex) => {
          const header = Boolean(o.headerRow && rowIndex === 0);
          let cells = '';
          for (let col = 0; col < columns; col += 1) {
            const raw = row[col];
            const cell = raw && typeof raw === 'object' ? raw : { text: raw == null ? '' : String(raw) };
            const head = header || Boolean(cell.head);
            const runs = cell.runs != null ? cell.runs : docxRun(cell.text, {
              bold: head || cell.bold, italic: cell.italic, color: cell.color,
              font: cell.mono ? 'Consolas' : '', sz: cell.sz || (cell.mono ? 17 : 20)
            });
            const paragraphs = cell.paragraphs != null ? cell.paragraphs : docxParagraph(runs, { before: 0, after: 0 });
            cells += docxCell(paragraphs, { width: grid[col], shd: head ? DOCX_COLOURS.shade : cell.shd });
          }
          return docxRow(cells, { header, cantSplit: true });
        }).join('');
        return docxTable(rowsXml, grid);
      }

      // Code-like text: one paragraph per source line, spaces kept, so a newline never
      // meets <w:t>. Adjacent paragraphs with the same shading and bar read as one box.
      function docxCodeParagraphs(text, opts) {
        const o = opts || {};
        const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
        return lines.map(line => docxParagraph(docxRun(line, { font: 'Consolas', sz: o.sz || 19, color: o.color }),
          { shd: o.shd || DOCX_COLOURS.code, leftBorder: o.leftBorder, before: 0, after: 0, line: 252 })).join('');
      }

      // The small uppercase tag the HTML export draws above PROMPT / SETTINGS / KNOWLEDGE.
      function docxKindTag(label) {
        return docxParagraph(docxRun(label, { bold: true, sz: 15, color: DOCX_COLOURS.muted }), { before: 200, after: 40, keepNext: true });
      }

      function docxSectionHeading(text) {
        return docxParagraph(docxRun(text), { style: 'Heading1' });
      }

      /* ---- formatted text: sanitised HTML -> paragraphs and tables ---------------
         Allowed tags are P/DIV/H1-3/UL/OL/LI/TABLE parts/B/I/U/EM/STRONG/BR/SPAN.
         Block tags become paragraphs or tables, inline tags become runs, lists
         become numbered paragraphs. A table never lands inside a paragraph. */
      const DOCX_BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH']);

      function docxHtmlText(value) { return String(value || '').replace(/[ \t\r\n\f]+/g, ' '); }

      function docxBlocksFromHtml(html, ctx) {
        const parsed = new DOMParser().parseFromString(`<body>${sanitizeWorkpaperHtml(html)}</body>`, 'text/html');
        const out = [];
        docxWalkHtmlBlocks(parsed.body, ctx, out, null, 0, {});
        return out.join('');
      }

      function docxInlineRuns(node, fmt) {
        let runs = '';
        Array.from(node.childNodes).forEach(child => { runs += docxInlineNode(child, fmt); });
        return runs;
      }

      function docxInlineNode(node, fmt) {
        if (node.nodeType === 3) return docxRun(docxHtmlText(node.nodeValue), fmt);
        if (node.nodeType !== 1) return '';
        const tag = node.tagName.toUpperCase();
        if (tag === 'BR') return DOCX_BREAK;
        const next = Object.assign({}, fmt);
        if (tag === 'B' || tag === 'STRONG') next.bold = true;
        else if (tag === 'I' || tag === 'EM') next.italic = true;
        else if (tag === 'U') next.underline = true;
        else if (tag === 'SPAN') {
          String(node.getAttribute('class') || '').split(/\s+/).forEach(name => {
            if (DOCX_TEXT_COLOURS[name]) next.color = DOCX_TEXT_COLOURS[name];
            if (DOCX_HIGHLIGHTS[name]) next.shd = DOCX_HIGHLIGHTS[name];
          });
        }
        // A block tag met in inline position keeps its words and loses its box.
        return docxInlineRuns(node, next);
      }

      // Walk one container: inline content gathers into the current paragraph; a
      // block child flushes it and becomes its own paragraph, list or table.
      function docxWalkHtmlBlocks(container, ctx, out, paragraphOpts, listDepth, fmt) {
        let runs = '';
        const flush = () => {
          let content = runs;
          // A trailing line break at the end of a block is invisible in the browser: drop it here too.
          if (content.endsWith(DOCX_BREAK)) content = content.slice(0, -DOCX_BREAK.length);
          if (content) out.push(docxParagraph(content, paragraphOpts));
          runs = '';
        };
        Array.from(container.childNodes).forEach(node => {
          if (node.nodeType === 3) {
            const text = docxHtmlText(node.nodeValue);
            if (!text || (!text.trim() && !runs)) return;
            runs += docxRun(text, fmt);
            return;
          }
          if (node.nodeType !== 1) return;
          const tag = node.tagName.toUpperCase();
          if (tag === 'BR') { runs += DOCX_BREAK; return; }
          if (!DOCX_BLOCK_TAGS.has(tag)) { runs += docxInlineNode(node, fmt); return; }
          flush();
          if (tag === 'P' || tag === 'DIV') {
            const before = out.length;
            docxWalkHtmlBlocks(node, ctx, out, paragraphOpts, listDepth, fmt);
            if (out.length === before) out.push(docxParagraph('', paragraphOpts));   // an empty line stays an empty line
          } else if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
            out.push(docxParagraph(docxInlineRuns(node, fmt), { style: 'Heading' + tag.charAt(1) }));
          } else if (tag === 'UL' || tag === 'OL') {
            docxListFromHtml(node, ctx, out, listDepth, fmt);
          } else if (tag === 'TABLE') {
            out.push(docxTableFromHtml(node, ctx, fmt));
          } else {
            // LI / TR / TD / TH / THEAD... outside their parents: keep the words, drop the structure.
            docxWalkHtmlBlocks(node, ctx, out, paragraphOpts, listDepth, fmt);
          }
        });
        flush();
      }

      // numId 1 is the shared bullet list; every ordered list gets its own num so
      // numbering restarts at 1 (one shared num would count on across the document).
      function docxAllocateNumbering(ctx, abstractId) {
        const numId = ctx.numbering.length + 2;
        ctx.numbering.push({ numId, abstractId });
        return numId;
      }

      function docxListFromHtml(list, ctx, out, depth, fmt) {
        const ordered = list.tagName.toUpperCase() === 'OL';
        const numId = ordered ? docxAllocateNumbering(ctx, 1) : 1;
        const level = Math.min(depth, 2);
        const itemOpts = { style: 'ListParagraph', numId, ilvl: level, before: 0, after: 60 };
        Array.from(list.children).forEach(item => {
          const tag = item.tagName.toUpperCase();
          if (tag === 'UL' || tag === 'OL') { docxListFromHtml(item, ctx, out, depth + 1, fmt); return; }
          const before = out.length;
          docxWalkHtmlBlocks(item, ctx, out, itemOpts, depth + 1, fmt);
          if (out.length === before) out.push(docxParagraph('', itemOpts));
        });
      }

      function docxTableFromHtml(table, ctx, fmt) {
        const rows = [];
        const collect = node => Array.from(node.children).forEach(child => {
          const tag = child.tagName.toUpperCase();
          if (tag === 'TR') rows.push(child);
          else if (tag === 'THEAD' || tag === 'TBODY' || tag === 'TFOOT') collect(child);
        });
        collect(table);
        if (!rows.length) return '';
        const cellNodes = rows.map(row => Array.from(row.children).filter(cell => ['TD', 'TH'].includes(cell.tagName.toUpperCase())));
        const columns = Math.max(1, ...cellNodes.map(cells => cells.length));
        const grid = docxEvenGrid(columns);
        const rowsXml = cellNodes.map(cells => {
          let xml = '';
          for (let col = 0; col < columns; col += 1) {
            const cell = cells[col];
            const head = Boolean(cell && cell.tagName.toUpperCase() === 'TH');
            const parts = [];
            if (cell) docxWalkHtmlBlocks(cell, ctx, parts, { before: 0, after: 0 }, 0, Object.assign({}, fmt, head ? { bold: true } : {}));
            // Ragged rows are padded so every row has the same number of cells.
            xml += docxCell(parts.join(''), { width: grid[col], shd: head ? DOCX_COLOURS.shade : '' });
          }
          return docxRow(xml, { cantSplit: true });
        }).join('');
        return docxTable(rowsXml, grid);
      }

      /* ---- pictures --------------------------------------------------------------- */
      function docxRegisterMedia(ctx, bytes, mime) {
        const extension = mime === 'image/jpeg' ? 'jpg' : 'png';
        const name = `image${ctx.media.length + 1}.${extension}`;
        const relId = `rId${ctx.nextRel++}`;
        ctx.media.push({ name, bytes });
        ctx.rels.push({ id: relId, type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: `media/${name}` });
        return relId;
      }

      // Pixels at 96 dpi -> EMU, then shrunk (never grown) to the page, aspect kept.
      function docxFitExtent(width, height) {
        const w = Math.max(1, Number(width) || 1);
        const h = Math.max(1, Number(height) || 1);
        const scale = Math.min(1, DOCX_CONTENT_EMU / (w * 9525), DOCX_MAX_PICTURE_EMU / (h * 9525));
        return { cx: Math.max(1, Math.round(w * 9525 * scale)), cy: Math.max(1, Math.round(h * 9525 * scale)) };
      }

      function docxDrawingRun(relId, docPrId, name, cx, cy) {
        const label = docxXmlText(String(name || 'Picture').slice(0, 120));
        return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
          + `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>`
          + `<wp:docPr id="${docPrId}" name="${label}" descr="${label}"/>`
          + '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
          + '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
          + '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
          + `<pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${label}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr>`
          + `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
          + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
          + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
      }

      // Picture paragraph plus its caption line.
      function docxPictureParagraphs(ctx, relId, name, width, height, caption) {
        const extent = docxFitExtent(width, height);
        return docxParagraph(docxDrawingRun(relId, ctx.nextDocPr++, name, extent.cx, extent.cy), { before: 160, after: 60, keepNext: true })
          + docxParagraph(docxRun(caption, { italic: true, sz: 18, color: DOCX_COLOURS.muted }), { after: 200 });
      }

      function docxImageParagraphs(block, ctx, summary) {
        const caption = block.caption || block.fileName || 'Image evidence';
        const info = inspectWorkpaperImageDataUri(block.dataUri);
        const bytes = info.dataUri ? workpaperPptxImageBytes(info.dataUri) : null;
        if (!bytes) {
          return docxParagraph(docxRun('Image evidence not attached.', { italic: true, color: DOCX_COLOURS.muted }), { before: 120, after: 40 })
            + docxParagraph(docxRun(caption, { italic: true, sz: 18, color: DOCX_COLOURS.muted }), { after: 200 });
        }
        const size = workpaperPptxImageDimensions(bytes, info.mime);
        const relId = docxRegisterMedia(ctx, bytes, info.mime);
        summary.images += 1;
        return docxPictureParagraphs(ctx, relId, caption, size.width, size.height, caption);
      }

      // Mermaid writes width="100%" on most diagram types; svgToCanvas would read that
      // as 100 px and hand back a sliver. Numeric width/height from the viewBox first.
      function docxSvgWithNumericSize(svg) {
        const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const root = parsed.documentElement;
        if (!root || root.nodeName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) return svg;
        const numeric = value => /^\d+(\.\d+)?(px)?$/.test(String(value || '').trim());
        if (numeric(root.getAttribute('width')) && numeric(root.getAttribute('height'))) return svg;
        const box = getSvgViewBox(root);
        root.setAttribute('width', String(Math.max(1, Math.ceil(box.width))));
        root.setAttribute('height', String(Math.max(1, Math.ceil(box.height))));
        return new XMLSerializer().serializeToString(root);
      }

      // Every linked diagram rendered fresh (the .doc only drew the one the editor had
      // cached); a diagram that will not render becomes a readable line, never an abort.
      async function docxDiagramParagraphs(diagram, ctx, summary) {
        const title = diagram.diagramTitle || diagram.name || 'Diagram';
        summary.diagrams.requested += 1;
        let svg = '';
        try {
          svg = normalizeSvgStringForTitle(await renderDiagramForWorkspace(diagram, `docs-docx-${diagram.id}`, 0), title);
        } catch (error) {
          const cached = diagramPreviewCache.get(diagram.id);
          const fallback = (cached && cached.svg) || (diagram.id === state.activeDiagramId ? lastGoodSvg : '');
          try { svg = fallback ? normalizeSvgStringForTitle(fallback, title) : ''; } catch (inner) { svg = ''; }
        }
        if (svg) {
          try {
            // 'current' = the theme the owner sees; on plain white a dark theme's edge labels vanish.
            const shot = await svgToCanvas(docxSvgWithNumericSize(svg), 2, 'current');
            const blob = await canvasToBlobSafe(shot.canvas, 'image/png');
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const relId = docxRegisterMedia(ctx, bytes, 'image/png');
            summary.diagrams.rendered += 1;
            return docxPictureParagraphs(ctx, relId, title, shot.canvas.width / shot.scale, shot.canvas.height / shot.scale, title);
          } catch (error) { /* fall through to the readable line */ }
        }
        summary.fallbacks.push(`Diagram could not be rendered: ${title}`);
        return docxParagraph(docxRun(`Diagram could not be rendered: ${title}`, { italic: true, color: DOCX_COLOURS.muted }), { before: 120, after: 120 });
      }

      /* ---- block renderers: same content and order as the HTML export ------------- */
      function docxBlockXml(block, ctx, summary) {
        if (block.kind === 'heading') {
          const level = Math.min(3, Math.max(1, Number(block.level) || 1));
          return docxParagraph(docxRun(block.text), { style: 'Heading' + level });
        }
        if (block.kind === 'text') return docxBlocksFromHtml(block.html, ctx);
        if (block.kind === 'image') return docxImageParagraphs(block, ctx, summary);
        if (block.kind === 'table') {
          const rows = (block.rows || []).map(row => (row || []).map(cell => String(cell == null ? '' : cell)));
          if (!rows.length) return '';
          return docxGridTable(rows, null, { headerRow: Boolean(block.headerRow) });
        }
        if (block.kind === 'checklist') {
          return (block.items || []).map(item => docxParagraph(
            docxRun((item.done ? '☑' : '☐') + ' ' + String(item.text || '')), { indLeft: 360, before: 0, after: 60 })).join('');
        }
        if (block.kind === 'prompt') {
          let xml = docxKindTag('PROMPT');
          if (block.reasoningEffort) xml += docxParagraph(docxRun('Reasoning effort: ' + block.reasoningEffort, { italic: true }), { after: 60 });
          xml += docxParagraph(docxRun(block.label || '', { bold: true, sz: 20 }) + (block.model ? docxRun(' · ' + block.model, { sz: 20 }) : ''),
            { shd: DOCX_COLOURS.shade, leftBorder: DOCX_COLOURS.accent, before: 0, after: 0, keepNext: true });
          xml += docxCodeParagraphs(block.text, { leftBorder: DOCX_COLOURS.accent });
          return xml + docxParagraph('', { before: 0, after: 120, markSz: 8 });
        }
        if (block.kind === 'settings') {
          const rows = (block.rows || []).map(row => [{ text: row.key, head: true }, row.value]);
          if (!rows.length) return docxKindTag('SETTINGS');
          return docxKindTag('SETTINGS') + docxGridTable(rows, [2600, DOCX_CONTENT_TWIPS - 2600]);
        }
        if (block.kind === 'testruns') {
          let xml = docxParagraph(docxRun(block.label || 'Agent test runs'), { style: 'Heading3' });
          const runs = block.rows || [];
          if (!runs.length) return xml + docxParagraph(docxRun('No test runs recorded.', { italic: true }));
          const withCase = runs.some(row => row.testCaseId);
          const withVersion = runs.some(row => row.agentVersion);
          const header = ['When'].concat(withCase ? ['Test case'] : [], withVersion ? ['Version'] : [], ['Verdict', 'Input', 'Output', 'Notes']);
          const body = runs.map(row => {
            const verdict = String(row.verdict || '');
            return [row.at || '–'].concat(withCase ? [row.testCaseId || ''] : [], withVersion ? [row.agentVersion || ''] : [], [
              { runs: docxRun(verdict.replace('-', ' '), { bold: true, caps: true, sz: 17, color: DOCX_COLOURS[verdict] || DOCX_COLOURS.text }) },
              { paragraphs: docxCodeParagraphs(row.input || '', { sz: 17, shd: 'FFFFFF' }) },
              { paragraphs: docxCodeParagraphs(row.output || '', { sz: 17, shd: 'FFFFFF' }) },
              { runs: docxRun(row.notes || '', { sz: 20 }) + (row.by ? (row.notes ? DOCX_BREAK : '') + docxRun(row.by, { italic: true, sz: 20 }) : '') }
            ]);
          });
          const columns = header.length;
          const widths = docxEvenGrid(columns);
          widths[0] = 1500;   // "When" is narrow, like the HTML export
          const rest = Math.floor((DOCX_CONTENT_TWIPS - 1500) / (columns - 1));
          for (let col = 1; col < columns; col += 1) widths[col] = rest;
          return xml + docxGridTable([header].concat(body), widths, { headerRow: true });
        }
        if (block.kind === 'knowledge') {
          const rows = block.rows || [];
          const withRole = rows.some(row => row.role);
          const withOrigin = rows.some(row => row.sourceOrigin);
          const withConfirmed = rows.some(row => row.confirmedAt);
          let xml = docxKindTag('KNOWLEDGE');
          if (block.reasoningEffort) xml += docxParagraph(docxRun('Reasoning effort: ' + block.reasoningEffort, { italic: true }), { after: 60 });
          const header = ['Source', 'Type'].concat(withRole ? ['Role'] : [], ['Represents'], withOrigin ? ['Source origin'] : [], withConfirmed ? ['Confirmed current (UTC)'] : []);
          const body = rows.map(row => [row.name, row.fileType].concat(withRole ? [knowledgeRoleLabel(row.role)] : [], [row.notes],
            withOrigin ? [row.sourceOrigin || ''] : [], withConfirmed ? [row.confirmedAt || ''] : []));
          xml += docxGridTable([header].concat(body), null, { headerRow: true });
          rows.filter(row => String(row.content || '').trim()).forEach(row => {
            xml += docxParagraph(docxRun(row.name || 'Attachment', { bold: true, sz: 20 }) + docxRun(' · ' + (row.fileType || ''), { sz: 20 })
              + (row.role ? docxRun(' · ' + knowledgeRoleLabel(row.role), { sz: 20 }) : ''),
              { shd: DOCX_COLOURS.shade, leftBorder: DOCX_COLOURS.accent, before: 120, after: 0, keepNext: true });
            xml += docxCodeParagraphs(row.content, { leftBorder: DOCX_COLOURS.accent });
            xml += docxParagraph('', { before: 0, after: 120, markSz: 8 });
          });
          return xml;
        }
        return '';
      }

      // A comment under its block, the way the HTML export shows it: author line,
      // then the note on its own line; resolved ones go quiet.
      function docxCommentParagraph(comment) {
        const resolved = Boolean(comment.resolved);
        const colour = resolved ? DOCX_COLOURS.muted : DOCX_COLOURS.text;
        const when = comment.at ? new Date(comment.at).toLocaleString() : '';
        const head = docxRun('💬 ' + String(comment.author || ''), { bold: true, sz: 18, color: colour })
          + docxRun((when ? ' · ' + when : '') + (resolved ? ' · resolved' : ''), { sz: 18, color: colour });
        return docxParagraph(head + DOCX_BREAK + docxRun(comment.text || '', { sz: 18, color: colour }),
          { shd: resolved ? 'F3F4F6' : DOCX_COLOURS.comment, leftBorder: resolved ? DOCX_COLOURS.resolvedBar : DOCX_COLOURS.commentBar, before: 60, after: 120 });
      }

      function docxAgentSummaryXml(doc) {
        const meta = agentMeta(doc);
        if (!meta) return '';
        const clean = sanitizeAgentMeta(meta);
        const rows = [];
        const add = (label, value) => { if (value) rows.push([{ text: label, head: true }, value]); };
        add('Agent ID', clean.agentId);
        add('Agent version', clean.agentVersion);
        add('Platform', clean.platform);
        add('Environment', clean.environment);
        if (clean.oversight.mode !== 'unknown' || clean.oversight.how || clean.oversight.exceptions) {
          add('Human review of outputs', AGENT_OVERSIGHT_LABELS[clean.oversight.mode] || 'Unknown');
          add('How review happens', clean.oversight.how);
          add('What is not reviewed', clean.oversight.exceptions);
        }
        const dataAnswered = clean.data.types || clean.data.restrictions
          || ['confidential', 'personal', 'sensitive'].some(key => clean.data[key] !== 'unknown');
        if (dataAnswered) {
          add('Data the agent handles', clean.data.types);
          add('Confidential data', AGENT_DATA_FLAG_LABELS[clean.data.confidential]);
          add('Personal data', AGENT_DATA_FLAG_LABELS[clean.data.personal]);
          add('Otherwise sensitive data', AGENT_DATA_FLAG_LABELS[clean.data.sensitive]);
          add('Handling restrictions', clean.data.restrictions);
        }
        if (!rows.length) return '';
        return docxSectionHeading('Agent summary') + docxGridTable(rows, [2600, DOCX_CONTENT_TWIPS - 2600]);
      }

      function docxReleasesXml(doc) {
        if (doc.type !== 'agent-spec' || !Array.isArray(doc.releases) || !doc.releases.length) return '';
        const rows = doc.releases.filter(release => release && typeof release === 'object').map(release => {
          const snapshot = release.snapshot && typeof release.snapshot === 'object' ? release.snapshot : null;
          const items = snapshot ? ['prompts', 'settings', 'capabilities', 'boundaries', 'knowledge'].reduce((sum, key) => sum + (Array.isArray(snapshot[key]) ? snapshot[key].length : 0), 0) : 0;
          const chars = snapshot ? JSON.stringify(snapshot).length : 0;
          const fp = release.fingerprint && release.fingerprint.package ? String(release.fingerprint.package) : '';
          const approved = release.approvedBy ? `${release.approvedBy} · ${new Date(release.approvedAt).toLocaleString()}` : '—';
          let notes = docxRun(release.notes || '', { sz: 20 });
          if (release.testingRef) notes += (notes ? DOCX_BREAK : '') + docxRun('Testing: ' + release.testingRef, { italic: true, sz: 20 });
          if (snapshot) notes += (notes ? DOCX_BREAK : '') + docxRun(`Snapshot: ${items} item${items === 1 ? '' : 's'}, ${chars.toLocaleString('en-US')} characters`, { sz: 20, color: DOCX_COLOURS.muted });
          return ['R' + String(release.seq || ''), release.version || '—', release.status || '', approved, { text: fp || '—', mono: true }, { runs: notes }];
        });
        const header = ['R', 'Version', 'Status', 'Approved', 'Package fingerprint (SHA-256)', 'Notes'];
        return docxSectionHeading('Agent releases') + docxGridTable([header].concat(rows), [600, 1000, 1100, 2000, 2438, 2500], { headerRow: true });
      }

      function docxGovernanceXml(doc) {
        if (doc.type !== 'agent-spec') return '';
        const review = doc.governanceReview && typeof doc.governanceReview === 'object' ? doc.governanceReview : null;
        if (!review) return '';
        const answers = Array.isArray(review.answers) ? review.answers : [];
        const answerLabels = { yes: 'Yes', no: 'No', unclear: 'Unclear', '': 'Not answered' };
        const rows = GOVERNANCE_QUESTIONS.map((pair, index) => {
          const found = answers.find(entry => entry && entry.id === pair[0]) || {};
          return [String(index + 1), pair[1], answerLabels[found.answer || ''] || 'Not answered', found.rationale || ''];
        });
        const signature = review.reviewedBy
          ? `${review.reviewedBy}${review.reviewedAt ? ` · ${new Date(review.reviewedAt).toLocaleString()}` : ''}`
          : '—';
        return docxSectionHeading('Governance review (documentation aid — not a legal assessment)')
          + docxGridTable([['#', 'Question', 'Answer', 'Rationale']].concat(rows), [500, 4338, 1300, 3500], { headerRow: true })
          + docxParagraph(docxRun('Outcome: ', { bold: true }) + docxRun(GOVERNANCE_OUTCOME_LABELS[review.outcome || ''] || 'Not assessed')
            + DOCX_BREAK + docxRun('Recorded by: ', { bold: true }) + docxRun(signature), { before: 60 });
      }

      /* ---- the document ---------------------------------------------------------- */
      async function buildWorkpaperDocxBlob(sourceDoc) {
        const { doc, diagrams } = workpaperPptxSnapshot([sourceDoc])[0];
        const ctx = {
          media: [], numbering: [], nextRel: 4, nextDocPr: 1,
          rels: [
            { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', target: 'styles.xml' },
            { id: 'rId2', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering', target: 'numbering.xml' },
            { id: 'rId3', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer', target: 'footer1.xml' }
          ]
        };
        const summary = { blocks: (doc.blocks || []).length, images: 0, diagrams: { requested: 0, rendered: 0 }, fallbacks: [] };
        const statusLabels = { draft: 'Draft', 'in-review': 'In review', approved: 'Approved' };
        const typeLabels = { 'agent-spec': 'Agent specification', narrative: 'Narrative', control: 'Control documentation', note: 'Note' };
        const parts = [];
        // Header block, as the HTML export lays it out: title, meta line, references, diagrams.
        parts.push(docxParagraph(docxRun(doc.title || 'Document'), { style: 'Title' }));
        const metaOpts = { sz: 18, color: DOCX_COLOURS.muted };
        parts.push(docxParagraph(
          docxRun(doc.ref || '', Object.assign({ bold: true }, metaOpts))
          + docxRun(` · ${typeLabels[doc.type] || doc.type || ''} · Status: ${statusLabels[doc.status] || doc.status || ''}`, metaOpts)
          + (doc.owner ? docxRun(` · Owner: ${doc.owner}`, metaOpts) : '')
          + docxRun(` · Updated: ${new Date(doc.updatedAt || Date.now()).toLocaleString()}`, metaOpts),
          { after: 120 }));
        const links = doc.links || [];
        if (links.length) {
          parts.push(docxParagraph(docxRun('References:', metaOpts), { before: 60, after: 40, keepNext: true }));
          links.forEach(link => parts.push(docxParagraph(docxRun(workpaperLinkReadable(link), { sz: 18 }),
            { style: 'ListParagraph', numId: 1, ilvl: 0, before: 0, after: 20 })));
        }
        for (const diagram of diagrams) parts.push(await docxDiagramParagraphs(diagram, ctx, summary));
        parts.push(docxParagraph('', { before: 0, after: 120, topBorder: DOCX_COLOURS.text, markSz: 8 }));
        parts.push(docxAgentSummaryXml(doc));
        const commentsByBlock = new Map();
        (doc.comments || []).forEach(comment => {
          if (!commentsByBlock.has(comment.blockId)) commentsByBlock.set(comment.blockId, []);
          commentsByBlock.get(comment.blockId).push(comment);
        });
        (doc.blocks || []).forEach(block => {
          parts.push(docxBlockXml(block, ctx, summary));
          (commentsByBlock.get(block.id) || []).forEach(comment => parts.push(docxCommentParagraph(comment)));
        });
        parts.push(docxReleasesXml(doc));
        parts.push(docxGovernanceXml(doc));
        parts.push(docxParagraph(docxRun(`Generated by T-Industries SIREN v${APP_VERSION} · ${new Date().toLocaleString()}`, { sz: 16, color: DOCX_COLOURS.muted }),
          { before: 400, topBorder: DOCX_COLOURS.border }));
        const sectPr = '<w:sectPr><w:footerReference w:type="default" r:id="rId3"/>'
          + `<w:pgSz w:w="${DOCX_PAGE.width}" w:h="${DOCX_PAGE.height}"/>`
          + `<w:pgMar w:top="${DOCX_PAGE.margin}" w:right="${DOCX_PAGE.margin}" w:bottom="${DOCX_PAGE.margin}" w:left="${DOCX_PAGE.margin}" w:header="708" w:footer="708" w:gutter="0"/>`
          + '</w:sectPr>';
        const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
          + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
          + 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
          + 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
          + 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
          + `<w:body>${parts.join('')}${sectPr}</w:body></w:document>`;
        return { blob: new Blob([buildZip(docxPackageEntries(doc, ctx, documentXml))], { type: DOCX_MIME }), summary };
      }

      function docxFooterXml(doc) {
        const muted = { sz: 16, color: DOCX_COLOURS.muted };
        const field = instr => `<w:fldSimple w:instr=" ${instr} "><w:r>${docxRunProps(muted)}<w:t>1</w:t></w:r></w:fldSimple>`;
        const line = docxRun(`${doc.ref || ''} · ${doc.title || ''}`, muted) + '<w:r><w:tab/></w:r>'
          + docxRun('Page ', muted) + field('PAGE') + docxRun(' of ', muted) + field('NUMPAGES');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
          + docxParagraph(line, { style: 'Footer', tabRight: DOCX_CONTENT_TWIPS, before: 0, after: 0 }) + '</w:ftr>';
      }

      function docxPackageEntries(doc, ctx, documentXml) {
        const now = new Date().toISOString();
        const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          + '<Default Extension="xml" ContentType="application/xml"/>'
          + '<Default Extension="png" ContentType="image/png"/>'
          + '<Default Extension="jpg" ContentType="image/jpeg"/>'
          + '<Default Extension="jpeg" ContentType="image/jpeg"/>'
          + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
          + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
          + '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
          + '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
          + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
          + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
          + '</Types>';
        const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
          + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
          + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
          + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
          + '</Relationships>';
        const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
          + ctx.rels.map(rel => `<Relationship Id="${rel.id}" Type="${rel.type}" Target="${rel.target}"/>`).join('')
          + '</Relationships>';
        const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
          + 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
          + 'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
          + `<dc:title>${docxXmlText(doc.title || 'Document')}</dc:title><dc:creator>T-Industries SIREN</dc:creator>`
          + '<cp:lastModifiedBy>T-Industries SIREN</cp:lastModifiedBy>'
          + `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>`
          + `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
        const app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
          + 'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
          + `<Application>T-Industries SIREN</Application><Company>T-Industries</Company><AppVersion>${docxXmlText(APP_VERSION)}</AppVersion></Properties>`;
        const heading = (id, name, sz, colour, before) =>
          `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>`
          + `<w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="120"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${colour}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:style>`;
        const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
          + `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Segoe UI" w:eastAsia="Segoe UI"/><w:color w:val="${DOCX_COLOURS.text}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>`
          + '<w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
          + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
          + `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="80"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${DOCX_COLOURS.text}"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>`
          + heading('Heading1', 'heading 1', 32, DOCX_COLOURS.text, 360)
          + heading('Heading2', 'heading 2', 27, DOCX_COLOURS.text, 300)
          + heading('Heading3', 'heading 3', 24, DOCX_COLOURS.text, 240)
          + heading('Heading4', 'heading 4', 22, DOCX_COLOURS.text, 200)
          + '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>'
          + '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr></w:style>'
          + '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
          + '</w:styles>';
        // Three levels each: bullets as disc/circle/square (Word's own Symbol/Wingdings
        // glyphs - a plain U+2022 in Symbol draws as a box), numbers as 1. / a. / i.
        const level = (ilvl, fmt, text, font) =>
          `<w:lvl w:ilvl="${ilvl}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/>`
          + `<w:pPr><w:ind w:left="${720 + ilvl * 360}" w:hanging="360"/></w:pPr>${font ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:hint="default"/></w:rPr>` : ''}</w:lvl>`;
        const overrides = [0, 1, 2].map(ilvl => `<w:lvlOverride w:ilvl="${ilvl}"><w:startOverride w:val="1"/></w:lvlOverride>`).join('');
        const numbering = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
          + `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${level(0, 'bullet', '\uF0B7', 'Symbol')}${level(1, 'bullet', 'o', 'Courier New')}${level(2, 'bullet', '\uF0A7', 'Wingdings')}</w:abstractNum>`
          + `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${level(0, 'decimal', '%1.', '')}${level(1, 'lowerLetter', '%2.', '')}${level(2, 'lowerRoman', '%3.', '')}</w:abstractNum>`
          + '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>'
          + ctx.numbering.map(entry => `<w:num w:numId="${entry.numId}"><w:abstractNumId w:val="${entry.abstractId}"/>${overrides}</w:num>`).join('')
          + '</w:numbering>';
        const entries = [
          { name: '[Content_Types].xml', data: contentTypes },
          { name: '_rels/.rels', data: rootRels },
          { name: 'docProps/core.xml', data: core },
          { name: 'docProps/app.xml', data: app },
          { name: 'word/document.xml', data: documentXml },
          { name: 'word/styles.xml', data: styles },
          { name: 'word/numbering.xml', data: numbering },
          { name: 'word/footer1.xml', data: docxFooterXml(doc) },
          { name: 'word/_rels/document.xml.rels', data: docRels }
        ];
        ctx.media.forEach(asset => entries.push({ name: `word/media/${asset.name}`, data: asset.bytes }));
        return entries;
      }

      function docxSummaryMessage(summary) {
        const diagrams = summary.diagrams.requested
          ? `, ${summary.diagrams.rendered}/${summary.diagrams.requested} linked diagram${summary.diagrams.requested === 1 ? '' : 's'}`
          : '';
        const missing = summary.fallbacks.length ? ` ${summary.fallbacks.length} could not be drawn and ${summary.fallbacks.length === 1 ? 'is' : 'are'} named in the file.` : '';
        return `Word document created: ${summary.blocks} block${summary.blocks === 1 ? '' : 's'}, ${summary.images} image${summary.images === 1 ? '' : 's'}${diagrams}.${missing}`;
      }

      /* A workpaper printed for the file: the browser's own layout engine paginates'''

# Splice: everything from the old writer's head comment to its closing brace goes.
head_at = s.find(OLD_DOC_WRITER_HEAD)
tail_at = s.find(OLD_DOC_WRITER_TAIL)
assert head_at > 0 and tail_at > head_at, (head_at, tail_at)
assert s.count(OLD_DOC_WRITER_HEAD) == 1 and s.count(OLD_DOC_WRITER_TAIL) == 1
s = s[:head_at] + NEW_WRITER + s[tail_at + len(OLD_DOC_WRITER_TAIL):]

# ---------------------------------------------------------------------------
# 2. Export dialog route (exportActiveWorkpaperAs): the Word branch only.
# ---------------------------------------------------------------------------
rep("""        if (format === 'word') {
          const blob = new Blob([buildWorkpaperWordDocument(doc)], { type: 'application/msword' });
          await deliverExportBlob(blob, { format: 'doc', fileName: base + '.doc', mime: 'application/msword', description: 'Word document', extensions: ['.doc'] }, null);
          return;
        }""",
"""        if (format === 'word') {
          try {
            const result = await buildWorkpaperDocxBlob(doc);
            await deliverExportBlob(result.blob, { format: 'docx', fileName: base + '.docx', mime: DOCX_MIME, description: 'Word document', extensions: ['.docx'] }, null);
            showToast(docxSummaryMessage(result.summary), result.summary.fallbacks.length ? 'normal' : 'success');
          } catch (error) {
            showToast(error && error.message ? error.message : 'The Word export failed.', 'error');
          }
          return;
        }""")

# ---------------------------------------------------------------------------
# 3. Data export route (exportDocsWord): one .docx, or several in a ZIP.
# ---------------------------------------------------------------------------
rep("""      // Word opens plain HTML happily when the file says it is a .doc; the same
      // printable page the HTML export builds becomes an editable Word document.
      function exportDocsPdf() {""",
"""      // A real .docx per doc: Word opens it without repair, and it carries the
      // diagram pictures the old HTML-in-a-.doc lost.
      function exportDocsPdf() {""")

rep("""      async function exportDocsWord() {
        const docs = selectedScopeDocs();
        if (!docs.length) return;
        if (docs.length === 1) {
          const blob = new Blob([buildWorkpaperWordDocument(docs[0])], { type: 'application/msword' });
          await deliverExportBlob(blob, {
            format: 'doc',
            fileName: sanitizeFileName(docs[0].ref + '_' + docs[0].title) + '.doc',
            mime: 'application/msword',
            description: 'Word document',
            extensions: ['.doc']
          }, null);
        } else {
          const entries = docs.map((doc, index) => ({
            name: String(index + 1).padStart(2, '0') + '_' + sanitizeFileName(doc.ref + '_' + doc.title) + '.doc',
            data: buildWorkpaperWordDocument(doc)
          }));
          const blob = new Blob([buildZip(entries)], { type: 'application/zip' });
          await deliverExportBlob(blob, {
            format: 'zip',
            fileName: sanitizeFileName(el.fileBaseName.value) + '_docs_word.zip',
            mime: 'application/zip',
            description: 'Word documents archive',
            extensions: ['.zip']
          }, null);
        }
        showToast(docs.length + ' doc' + (docs.length === 1 ? '' : 's') + ' exported for Word.', 'success');
      }""",
"""      async function exportDocsWord() {
        const docs = selectedScopeDocs();
        if (!docs.length) return;
        docs.forEach(doc => commitWorkpaperSession(doc));
        try {
          setExportStatus('Building the Word document' + (docs.length === 1 ? '' : 's') + '\\u2026', 'working');
          const missing = [];
          if (docs.length === 1) {
            const result = await buildWorkpaperDocxBlob(docs[0]);
            missing.push(...result.summary.fallbacks);
            await deliverExportBlob(result.blob, {
              format: 'docx',
              fileName: sanitizeFileName(docs[0].ref + '_' + docs[0].title) + '.docx',
              mime: DOCX_MIME,
              description: 'Word document',
              extensions: ['.docx']
            }, null);
          } else {
            // One after the other: each build renders its own diagrams through the shared queue.
            const entries = [];
            for (let index = 0; index < docs.length; index += 1) {
              const result = await buildWorkpaperDocxBlob(docs[index]);
              missing.push(...result.summary.fallbacks);
              entries.push({
                name: String(index + 1).padStart(2, '0') + '_' + sanitizeFileName(docs[index].ref + '_' + docs[index].title) + '.docx',
                data: new Uint8Array(await result.blob.arrayBuffer())
              });
            }
            const blob = new Blob([buildZip(entries)], { type: 'application/zip' });
            await deliverExportBlob(blob, {
              format: 'zip',
              fileName: sanitizeFileName(el.fileBaseName.value) + '_docs_word.zip',
              mime: 'application/zip',
              description: 'Word documents archive',
              extensions: ['.zip']
            }, null);
          }
          const message = docs.length + ' doc' + (docs.length === 1 ? '' : 's') + ' exported for Word.'
            + (missing.length ? ' ' + missing.length + ' diagram' + (missing.length === 1 ? '' : 's') + ' could not be drawn and ' + (missing.length === 1 ? 'is' : 'are') + ' named in the file.' : '');
          setExportStatus(message, missing.length ? 'working' : 'good');
          showToast(message, missing.length ? 'normal' : 'success');
        } catch (error) {
          const message = error && error.message ? error.message : 'The Word export failed.';
          setExportStatus(message, 'bad');
          showToast(message, 'error');
        }
      }""")

# ---------------------------------------------------------------------------
# 4. UI strings: the two places that still said .doc.
# ---------------------------------------------------------------------------
rep('''title="The docs selected under Scope as Word files (.doc). Several arrive as one ZIP."''',
    '''title="The docs selected under Scope as Word files (.docx). Several arrive as one ZIP."''')
rep("""<button class="wp-export-choice" type="button" data-wp-export="word"><strong>Word</strong><span>A .doc file Word opens and edits, keeping headings and tables.</span></button>""",
    """<button class="wp-export-choice" type="button" data-wp-export="word"><strong>Word</strong><span>A real .docx: headings, tables, images and every linked diagram as a picture.</span></button>""")

assert 'buildWorkpaperWordDocument' not in s
assert 'application/msword' not in s
assert s.count('buildWorkpaperDocxBlob') >= 3
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
