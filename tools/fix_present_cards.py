# -*- coding: utf-8 -*-
"""
fix_present_cards.py — SIREN wave 2, CONTENT SLIDES (Builder B).

Installs into T_Industries_SIREN_v1.html (a COPY — never the live file):
  · richer card model: title | text | table | image | embed | doc | facts,
    one sanitised rich-text body on every kind (sanitizeWorkpaperHtml — the
    Docs sanitiser), one textScale per card, backward-compatible migration
    of the old plain `body` field;
  · a real card editor dialog (kind rail / per-kind pane / live render of
    the exported slide) replacing the two window.prompt calls;
  · an asset store outside `state` (sirenStore key, 1.5 MB/image after
    downscale, 40 MB budget) with .siren export/import hooks;
  · the honest video treatment: links are parsed, never fetched; the plane
    and the PDF show a drawn poster; "Open in browser" uses the OS browser;
  · a proper SVG slide layout engine for the deck PDF (wrapped text, ruled
    tables, data-URI images, drawn posters) replacing the bare-<text> one.

Usage:  python fix_present_cards.py <target.html>

Anchor-guarded: every replacement is bounded by unique anchors quoted from
the current build and checked for expected content; the script writes
atomically and ABORTS WITHOUT WRITING on any drift.
"""
import io
import os
import sys
import tempfile

def die(message):
    print('ABORT (nothing written): ' + message)
    sys.exit(2)

def find_unique(text, needle, label):
    index = text.find(needle)
    if index < 0:
        die('anchor not found: ' + label)
    if text.find(needle, index + 1) >= 0:
        die('anchor not unique: ' + label)
    return index

def replace_span(text, start_anchor, end_anchor, new_block, label, must_contain=(), max_len=200000):
    start = find_unique(text, start_anchor, label + ' [start]')
    end = find_unique(text, end_anchor, label + ' [end]')
    if end <= start:
        die('anchors out of order: ' + label)
    removed = text[start:end]
    if len(removed) > max_len:
        die('span suspiciously large (%d chars): %s' % (len(removed), label))
    for probe in must_contain:
        if probe not in removed:
            die('replaced span does not look like the expected code (missing %r): %s' % (probe[:60], label))
    return text[:start] + new_block + '\n\n' + text[end:]

def insert_after(text, anchor, addition, label):
    index = find_unique(text, anchor, label)
    return text[:index + len(anchor)] + addition + text[index + len(anchor):]

def swap_once(text, old, new, label):
    index = find_unique(text, old, label)
    return text[:index] + new + text[index + len(old):]

BLOCK_SANITIZER = r'''      /* =====================================================================
         CONTENT SLIDES (wave 2) — the card record.
         Every card, of every kind, carries eyebrow + title + ONE sanitised
         rich-text field (`html`, through sanitizeWorkpaperHtml — the exact
         sanitiser Docs uses) plus one `textScale`; `kind` only selects the
         extra payload that rides along: none | table | image | embed | doc |
         facts. `body` is DERIVED from `html` on every sanitise, so
         mapViewLabel, the notes export and every older reader keep working.
         A card written before this change has `body` and no `html`; its plain
         text is lifted into the rich field exactly once, idempotently.
         ===================================================================== */

      const MAP_CARD_KINDS = [
        ['title', 'Title', '❖', 'A section break: eyebrow, big heading, a line or two.'],
        ['text', 'Text', '¶', 'Headings, bullets and numbered lists — the workhorse.'],
        ['table', 'Table', '▦', 'A grid with a header row. Add or remove rows and columns.'],
        ['image', 'Picture', '🖼', 'A screenshot or photo from disk, stored inside the project.'],
        ['embed', 'Video link', '▶', 'A YouTube link or web address, shown as a poster. Opening it uses the system browser — the deck itself stays offline.'],
        ['doc', 'Document', '📄', 'Live text pulled from a written workpaper.'],
        ['facts', 'Facts', '⌗', 'Live risk, control, owner and evidence for blocks on a diagram.']
      ];
      const MAP_CARD_KIND_IDS = MAP_CARD_KINDS.map(entry => entry[0]);
      /* One size control per card, never per run: sanitizeWorkpaperHtml strips
         every attribute from every element, so per-run sizes are impossible by
         construction — and one scale per card keeps the deck one deck. */
      const MAP_TEXT_SCALES = [['S', 0.85], ['M', 1], ['L', 1.2], ['XL', 1.45]];
      const MAP_CARD_SCALES = [0.85, 1, 1.2, 1.45];

      /* The exact escaping the workpaper paste handler uses, so a card migrated
         from plain `body` produces the identical HTML the workpaper would have
         produced from the same text. */
      function mapCardHtmlFromPlainText(text) {
        return String(text == null ? '' : text)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/\n/g, '<br>');
      }

      /* The plain mirror, kept on `card.body` so mapViewLabel, the notes file in
         mapExportRoute and every existing caller keep working untouched. Parsed
         rather than regexed, because entities have to come back as characters and
         a list has to come back as lines. DOMParser never executes anything. */
      function mapCardPlainFromHtml(html) {
        const source = String(html == null ? '' : html);
        if (!source) return '';
        const doc = new DOMParser().parseFromString(`<div>${source}</div>`, 'text/html');
        const root = doc.body.firstElementChild;
        if (!root) return '';
        const out = [];
        const walk = (node, ordered) => {
          let ordinal = 0;
          Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === 3) { out.push(child.nodeValue || ''); return; }
            if (child.nodeType !== 1) return;
            const tag = String(child.tagName || '').toUpperCase();
            if (tag === 'BR') { out.push('\n'); return; }
            if (tag === 'UL' || tag === 'OL') {
              out.push('\n');
              walk(child, tag === 'OL');
              out.push('\n');
              return;
            }
            if (tag === 'LI') {
              ordinal += 1;
              out.push(`\n${ordered ? `${ordinal}. ` : '• '}`);
              walk(child, ordered);
              return;
            }
            if (['P', 'DIV', 'H1', 'H2', 'H3'].includes(tag)) {
              out.push('\n');
              walk(child, ordered);
              out.push('\n');
              return;
            }
            walk(child, ordered);
          });
        };
        walk(root, false);
        return out.join('')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }

      function mapSanitizeAssetId(value) {
        return String(value == null ? '' : value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
      }

      /* Straight reuse of sanitizeWorkpaperBlock's `table` branch: the same
         WP_LIMITS caps, the same rectangularisation, the same cut reporting. A
         card table is byte-for-byte a workpaper table. Rows survive a kind
         change: turn a table card into a text card and back and the grid is
         still there. */
      function mapSanitizeCardTable(card, kind, report) {
        const has = Array.isArray(card.rows) && card.rows.length > 0;
        if (!has && kind !== 'table') return { rows: [], headerRow: true };
        const block = sanitizeWorkpaperBlock({ kind: 'table', rows: card.rows, headerRow: card.headerRow }, report);
        return { rows: block.rows, headerRow: block.headerRow };
      }

      /* Per-kind defaults. A picture or a poster wants 16:9 room; a title card
         does not. */
      function mapCardDefaultSize(kind) {
        if (kind === 'image' || kind === 'embed') return { w: 1280, h: 900 };
        if (kind === 'table' || kind === 'doc' || kind === 'facts') return { w: 1200, h: 760 };
        return { w: MAP_CARD_W, h: MAP_CARD_H };
      }

      /* A strict superset of the old record: every field the old sanitizeMapCard
         produced is still produced, with the same name and the same meaning. */
      function sanitizeMapCard(raw, report) {
        const card = raw && typeof raw === 'object' ? raw : {};
        const kind = MAP_CARD_KIND_IDS.includes(card.kind) ? card.kind : 'title';
        let html = typeof card.html === 'string' ? card.html : '';
        if (!html && typeof card.body === 'string' && card.body.trim()) {
          html = mapCardHtmlFromPlainText(card.body);
        }
        html = sanitizeWorkpaperHtml(html, report);
        const table = mapSanitizeCardTable(card, kind, report);
        const embed = mapParseEmbed(card.url);
        const scale = Number(card.textScale);
        const size = mapCardDefaultSize(kind);
        return {
          id: typeof card.id === 'string' && card.id ? card.id.slice(0, 40) : `card-${Math.random().toString(36).slice(2, 9)}`,
          kind,
          x: Number.isFinite(Number(card.x)) ? Number(card.x) : 0,
          y: Number.isFinite(Number(card.y)) ? Number(card.y) : 0,
          w: clamp(Number(card.w) || size.w, 240, 4000),
          h: clamp(Number(card.h) || size.h, 180, 4000),
          eyebrow: String(card.eyebrow || '').slice(0, 80),
          title: String(card.title || '').slice(0, 200),
          html,
          // Derived, never authored: regenerated from `html` so it cannot drift.
          body: mapCardPlainFromHtml(html).slice(0, 8000),
          textScale: MAP_CARD_SCALES.includes(scale) ? scale : 1,
          align: card.align === 'centre' ? 'centre' : 'left',
          rows: table.rows,
          headerRow: table.headerRow,
          assetId: mapSanitizeAssetId(card.assetId),
          fit: card.fit === 'cover' ? 'cover' : 'contain',
          url: embed ? String(embed.url).slice(0, 600) : '',
          embedKind: embed ? embed.embedKind : 'link',
          embedId: embed ? embed.embedId : '',
          embedStart: embed ? embed.embedStart : 0,
          docId: String(card.docId || '').slice(0, 60),
          blockIds: (Array.isArray(card.blockIds) ? card.blockIds.slice(0, 40) : []).map(id => String(id).slice(0, 60)),
          diagramId: String(card.diagramId || '').slice(0, 60),
          nodeIds: (Array.isArray(card.nodeIds) ? card.nodeIds.slice(0, 40) : []).map(id => String(id).slice(0, 80))
        };
      }'''

BLOCK_RENDERER = r'''      /* =====================================================================
         CONTENT SLIDES (wave 2) — the plane renderer.
         One rich body on every kind, one shared table builder, and pictures
         that mount and unmount with the camera the way diagram tiles already
         do (mapSetTileDetail), so fifty screenshots never decode at once.
         ===================================================================== */

      /* Display caps, NOT data caps: a pasted 300-row table keeps all 300 rows
         in `card.rows`; the plane and the slide show the first slice and say
         how many are hidden. */
      const MAP_CARD_TABLE_SHOWN = 24;
      const MAP_CARD_DOC_BLOCKS = 6;
      const MAP_CARD_FACT_SHOWN = 24;
      /* A decoded 1920x1080 bitmap is ~8.3 MB of RAM; eight mounted at once is
         the same order as the three near-detail diagram tiles the plane keeps
         live (MAP_MAX_NEAR). */
      const MAP_CARD_MAX_IMAGES = 8;

      let mapCardMedia = new Map();
      let mapCardFitFrame = 0;

      function mapRenderCards() {
        if (!el.mapPlane) return;
        mapCardEls().forEach(node => node.remove());
        mapCardMedia = new Map();
        ((state.map && state.map.cards) || []).forEach(card => {
          el.mapPlane.appendChild(mapBuildCard(card));
        });
        // Grow-to-fit runs once, after layout, outside the render pass.
        cancelAnimationFrame(mapCardFitFrame);
        mapCardFitFrame = requestAnimationFrame(mapFitCardHeights);
        mapUpdateCardDetail();
      }

      function mapBuildCard(card) {
        const host = document.createElement('div');
        host.className = 'map-card';
        host.dataset.cardId = card.id;
        host.dataset.kind = card.kind;
        if (card.align === 'centre' && card.kind === 'title') host.dataset.align = 'centre';
        host.style.left = `${card.x}px`;
        host.style.top = `${card.y}px`;
        host.style.width = `${card.w}px`;
        host.style.height = `${card.h}px`;
        // One number per card drives every type size in the CSS. Set through
        // CSSOM, which the CSP does not police, exactly as style.left already is.
        host.style.setProperty('--card-scale', String(card.textScale || 1));
        if (card.kind === 'image') host.style.setProperty('--card-fit', card.fit === 'cover' ? 'cover' : 'contain');

        /* The Edit affordance was opacity:0 until :hover. On a projector, with
           no mouse over the plane, that is invisible — so it is always drawn
           and only brightens on hover (see the appended card CSS). */
        const pencil = document.createElement('div');
        pencil.className = 'map-card-edit';
        pencil.textContent = '✎ Edit';
        host.appendChild(pencil);

        host.title = 'Click to edit this card';
        host.tabIndex = 0;
        host.setAttribute('role', 'button');
        host.setAttribute('aria-label', `Card: ${card.title || card.eyebrow || card.kind}. Press Enter to edit it.`);
        host.addEventListener('click', event => {
          if (mapPointerState && mapPointerState.moved) return;
          event.stopPropagation();
          mapEditCard(card);
        });
        host.addEventListener('dblclick', event => {
          event.stopPropagation();
          mapEditCard(card);
        });
        // Enter and F2 on a focused card, so the editor is reachable without a mouse.
        host.addEventListener('keydown', event => {
          if (event.key !== 'Enter' && event.key !== 'F2') return;
          event.preventDefault();
          event.stopPropagation();
          mapEditCard(card);
        });

        if (card.eyebrow) {
          const eyebrow = document.createElement('div');
          eyebrow.className = 'map-card-eyebrow';
          eyebrow.textContent = card.eyebrow;
          host.appendChild(eyebrow);
        }
        if (card.title) {
          const title = document.createElement('h2');
          title.className = 'map-card-title';
          title.textContent = card.title;
          host.appendChild(title);
        }

        /* Body first or payload first, per kind: a picture wants its caption
           underneath, a table wants its lede above. */
        const bodyFirst = card.kind !== 'image' && card.kind !== 'embed';
        const body = mapBuildCardBody(card);
        const payload = mapBuildCardPayload(card);
        if (bodyFirst) {
          if (body) host.appendChild(body);
          if (payload) host.appendChild(payload);
        } else {
          if (payload) host.appendChild(payload);
          if (body) host.appendChild(body);
        }
        return host;
      }

      /* The one rich field, on every kind. Re-sanitised at render as well as at
         save: it costs nothing, and it means a hand-edited .siren file cannot
         put live markup on the plane. */
      function mapBuildCardBody(card) {
        const clean = sanitizeWorkpaperHtml(card.html || '');
        if (!clean.replace(/<[^>]*>/g, '').trim() && !/<(br|img|hr)\b/i.test(clean)) return null;
        const holder = document.createElement('div');
        holder.className = 'map-card-body';
        holder.innerHTML = clean;
        return holder;
      }

      function mapBuildCardPayload(card) {
        if (card.kind === 'table') return mapBuildCardTable(card.rows, card.headerRow, 'grid');
        if (card.kind === 'image') return mapBuildCardImage(card);
        if (card.kind === 'embed') return mapBuildCardEmbed(card);
        if (card.kind === 'facts') return mapBuildFactsTable(card);
        if (card.kind === 'doc') return mapBuildDocBody(card);
        return null;
      }

      /* One builder for the table card, the facts card and any table inside a
         doc card, so all three read identically on the plane and rasterise
         identically on the slide. `variant` only picks the column rhythm. */
      function mapBuildCardTable(rows, headerRow, variant) {
        const wrap = document.createElement('div');
        wrap.className = 'map-card-table';
        wrap.dataset.variant = variant || 'grid';
        const list = Array.isArray(rows) ? rows : [];
        if (!list.length) {
          const empty = document.createElement('div');
          empty.className = 'map-card-empty';
          empty.textContent = 'This table has no rows yet.';
          wrap.appendChild(empty);
          return wrap;
        }
        const table = document.createElement('table');
        const shown = list.slice(0, MAP_CARD_TABLE_SHOWN);
        shown.forEach((row, rowIndex) => {
          const tr = document.createElement('tr');
          const cells = Array.isArray(row) ? row : [];
          cells.forEach(cellText => {
            const isHead = headerRow !== false && rowIndex === 0;
            const cell = document.createElement(isHead ? 'th' : 'td');
            cell.textContent = String(cellText == null ? '' : cellText);
            tr.appendChild(cell);
          });
          if (headerRow !== false && rowIndex === 0) tr.className = 'is-head';
          table.appendChild(tr);
        });
        wrap.appendChild(table);
        if (list.length > shown.length) {
          const more = document.createElement('div');
          more.className = 'map-card-more';
          const hidden = list.length - shown.length;
          more.textContent = `+ ${hidden} more row${hidden === 1 ? '' : 's'} in this table`;
          wrap.appendChild(more);
        }
        return wrap;
      }

      /* The <img> is NOT mounted here. mapUpdateCardDetail mounts it when the
         camera is near, mirroring mapSetTileDetail. */
      function mapBuildCardImage(card) {
        const frame = document.createElement('div');
        frame.className = 'map-card-media';
        const asset = mapAssetGet(card.assetId);
        if (!asset) {
          frame.dataset.state = 'missing';
          const note = document.createElement('div');
          note.className = 'map-card-empty';
          note.textContent = card.assetId
            ? 'That image is no longer in this project. Open the card and add it again.'
            : 'No picture yet. Click the card to add one.';
          frame.appendChild(note);
          return frame;
        }
        frame.dataset.state = 'idle';
        const image = document.createElement('img');
        image.className = 'map-card-image';
        image.alt = card.title || asset.name || 'Card image';
        image.decoding = 'async';
        frame.appendChild(image);
        mapCardMedia.set(card.id, { card, frame, image, asset, mounted: false });
        return frame;
      }

      /* NEVER a live iframe on the plane: an iframe inside a CSS transform is a
         repaint per camera frame, and the plane must keep working with no
         network at all. The poster is the honest offline design — title, host,
         play mark, the still if the presenter attached one, and one control
         that opens the link in the system browser. */
      function mapBuildCardEmbed(card) {
        const poster = document.createElement('div');
        poster.className = 'map-card-poster';
        poster.dataset.embed = card.embedKind || 'link';

        const still = mapAssetGet(card.assetId);
        if (still) {
          const image = document.createElement('img');
          image.className = 'map-card-image';
          image.alt = card.title || 'Link preview';
          image.decoding = 'async';
          poster.appendChild(image);
          mapCardMedia.set(card.id, { card, frame: poster, image, asset: still, mounted: false });
        }

        const mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        mark.setAttribute('class', 'map-card-play');
        mark.setAttribute('viewBox', '0 0 64 64');
        mark.setAttribute('aria-hidden', 'true');
        const disc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        disc.setAttribute('cx', '32');
        disc.setAttribute('cy', '32');
        disc.setAttribute('r', '30');
        disc.setAttribute('class', 'map-card-play-disc');
        const tri = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tri.setAttribute('d', card.embedKind === 'youtube' ? 'M25 19.5 46 32 25 44.5z' : 'M23 32h18M34 24l8 8-8 8');
        tri.setAttribute('class', card.embedKind === 'youtube' ? 'map-card-play-tri' : 'map-card-play-arrow');
        mark.append(disc, tri);
        poster.appendChild(mark);

        const caption = document.createElement('div');
        caption.className = 'map-card-poster-caption';
        const host = document.createElement('div');
        host.className = 'map-card-poster-host';
        host.textContent = card.embedKind === 'youtube' ? `YouTube · ${mapEmbedHostLabel(card)}` : mapEmbedHostLabel(card);
        const link = document.createElement('div');
        link.className = 'map-card-poster-url';
        link.textContent = card.url || 'Click the card to paste a link.';
        caption.append(host, link);
        poster.appendChild(caption);

        if (card.url) {
          const open = document.createElement('button');
          open.type = 'button';
          open.className = 'map-card-open';
          open.textContent = '⧉ Open in browser';
          open.title = 'Opens the link in the system browser — the deck itself stays offline';
          /* stopPropagation is load-bearing: the card-wide click handler opens
             the editor, and without it this button never fires its own action. */
          open.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            mapOpenCardLink(card);
          });
          open.addEventListener('dblclick', event => event.stopPropagation());
          open.addEventListener('keydown', event => event.stopPropagation());
          poster.appendChild(open);
        }
        return poster;
      }

      /* The honest video treatment under this page's CSP: nothing is ever
         fetched — the OS browser plays the link. If the popup is blocked, the
         link is copied instead and the presenter is told. */
      function mapOpenCardLink(card) {
        const url = mapSafeUrl(card && card.url);
        if (!url) { showToast('This card has no link yet. Click the card to paste one.', 'error'); return; }
        let opened = null;
        try { opened = window.open(url, '_blank', 'noopener'); } catch (error) { opened = null; }
        if (!opened) copyTextRobust(url, 'Link copied — open it in your browser.');
      }

      /* Unchanged data path — the same node metadata, the same field order —
         drawn through the shared table builder so it matches a table card. */
      const MAP_FACT_FIELDS = [
        ['risk', 'Risk'], ['control', 'Control'], ['owner', 'Owner'], ['evidence', 'Evidence'],
        ['status', 'Status'], ['frequency', 'Frequency'], ['system', 'System'], ['reference', 'Reference']
      ];

      function mapCardFactRows(card) {
        const diagram = state.diagrams.find(entry => entry.id === card.diagramId);
        const metadata = (diagram && diagram.nodeMetadata) || {};
        const rows = [];
        (card.nodeIds || []).forEach(nodeId => {
          const facts = metadata[nodeId];
          if (!facts) return;
          MAP_FACT_FIELDS.forEach(([key, label]) => {
            const value = String(facts[key] || '').trim();
            if (value) rows.push([label, value]);
          });
        });
        return rows;
      }

      function mapBuildFactsTable(card) {
        const rows = mapCardFactRows(card);
        if (!rows.length) {
          const empty = document.createElement('div');
          empty.className = 'map-card-empty';
          empty.textContent = 'No block facts recorded yet.';
          return empty;
        }
        return mapBuildCardTable(rows.slice(0, MAP_CARD_FACT_SHOWN), false, 'facts');
      }

      /* The same document, the same block selection — but the blocks are now
         DRAWN rather than flattened into one grey paragraph. A heading is a
         heading, a table is a table, a checklist keeps its boxes. */
      function mapBuildDocBody(card) {
        const holder = document.createElement('div');
        holder.className = 'map-card-doc';
        const doc = (state.workpapers || []).find(entry => entry.id === card.docId);
        if (!doc) {
          holder.textContent = 'That document is no longer in the workspace.';
          holder.classList.add('map-card-empty');
          return holder;
        }
        const blocks = card.blockIds && card.blockIds.length
          ? doc.blocks.filter(block => card.blockIds.includes(block.id))
          : doc.blocks.slice(0, MAP_CARD_DOC_BLOCKS);
        const shown = blocks.slice(0, MAP_CARD_DOC_BLOCKS);
        if (!shown.length) {
          holder.textContent = 'That part of the document is empty.';
          holder.classList.add('map-card-empty');
          return holder;
        }
        shown.forEach(block => {
          const node = mapBuildDocBlock(block);
          if (node) holder.appendChild(node);
        });
        if (blocks.length > shown.length) {
          const more = document.createElement('div');
          more.className = 'map-card-more';
          const hidden = blocks.length - shown.length;
          more.textContent = `+ ${hidden} more block${hidden === 1 ? '' : 's'} in this document`;
          holder.appendChild(more);
        }
        return holder;
      }

      function mapBuildDocBlock(block) {
        if (!block || typeof block !== 'object') return null;
        if (block.kind === 'heading') {
          const heading = document.createElement('div');
          heading.className = 'map-card-h';
          heading.dataset.level = String(clamp(Number(block.level) || 2, 1, 3));
          heading.textContent = String(block.text || '');
          return heading;
        }
        if (block.kind === 'text') {
          const prose = document.createElement('div');
          prose.className = 'map-card-body';
          // Already sanitised in storage; sanitised again on the way to the plane.
          prose.innerHTML = sanitizeWorkpaperHtml(block.html || '');
          return prose;
        }
        if (block.kind === 'table') {
          return mapBuildCardTable(block.rows, block.headerRow, 'grid');
        }
        if (block.kind === 'checklist') {
          const list = document.createElement('ul');
          list.className = 'map-card-checks';
          (block.items || []).slice(0, 12).forEach(item => {
            const row = document.createElement('li');
            if (item && item.done) row.dataset.done = 'yes';
            row.textContent = `${item && item.done ? '☑' : '☐'}  ${(item && item.text) || ''}`;
            list.appendChild(row);
          });
          return list;
        }
        // Prompt, settings, knowledge and test runs have no slide form of their
        // own; workpaperBlockDigest is the app's own answer for those.
        const digest = workpaperBlockDigest(block);
        if (!digest) return null;
        const plain = document.createElement('div');
        plain.className = 'map-card-body map-card-digest';
        plain.textContent = digest.slice(0, 1200);
        return plain;
      }

      /* Near/far mounting for pictures — the same idea as mapSetTileDetail:
         what is not near the camera is not decoded. */
      function mapUpdateCardDetail() {
        if (!mapCardMedia.size) return;
        if (!mapMode || !el.mapPlane) {
          mapCardMedia.forEach(entry => mapSetCardMedia(entry, false));
          return;
        }
        const camera = mapCameraRect();
        const inflated = {
          x: camera.x - camera.w * 0.6,
          y: camera.y - camera.h * 0.6,
          w: camera.w * 2.2,
          h: camera.h * 2.2
        };
        const centreX = camera.x + camera.w / 2;
        const centreY = camera.y + camera.h / 2;
        const candidates = [];
        mapCardMedia.forEach(entry => {
          const card = entry.card;
          const rect = { x: card.x, y: card.y, w: card.w, h: card.h };
          if (!mapRectsIntersect(rect, inflated)) { mapSetCardMedia(entry, false); return; }
          const dx = (rect.x + rect.w / 2) - centreX;
          const dy = (rect.y + rect.h / 2) - centreY;
          candidates.push({ entry, distance: Math.sqrt(dx * dx + dy * dy) });
        });
        candidates.sort((a, b) => a.distance - b.distance);
        candidates.forEach((item, index) => mapSetCardMedia(item.entry, index < MAP_CARD_MAX_IMAGES));
      }

      function mapSetCardMedia(entry, wanted) {
        if (!entry || entry.mounted === wanted) return;
        entry.mounted = wanted;
        if (!wanted) {
          entry.image.removeAttribute('src');
          entry.frame.dataset.state = 'idle';
          return;
        }
        entry.frame.dataset.state = 'loading';
        entry.image.addEventListener('load', () => { entry.frame.dataset.state = 'ready'; }, { once: true });
        entry.image.addEventListener('error', () => { entry.frame.dataset.state = 'broken'; }, { once: true });
        entry.image.src = mapAssetDataUrl(entry.asset);
      }

      /* Grow-to-fit: a non-coder should never have to drag a card taller
         because their third bullet fell off the bottom. Cards only ever grow,
         never shrink, capped at the same 4000 the sanitiser uses; image and
         embed cards are skipped because their media flexes. A card that still
         cannot fit (a long document at the 4000 cap) keeps the wave-1
         `is-clipped` band so it never looks silently finished. */
      function mapFitCardHeights() {
        mapCardFitFrame = 0;
        if (!el.mapPlane || !state.map || !Array.isArray(state.map.cards)) return;
        let changed = false;
        mapCardEls().forEach(host => {
          const card = state.map.cards.find(entry => entry.id === host.dataset.cardId);
          if (!card) return;
          if (card.kind !== 'image' && card.kind !== 'embed') {
            const needed = host.scrollHeight;
            if (needed && needed > card.h + 8) {
              const next = clamp(Math.ceil(needed), 180, 4000);
              if (next !== card.h) {
                card.h = next;
                host.style.height = `${next}px`;
                changed = true;
              }
            }
          }
          host.classList.toggle('is-clipped', host.scrollHeight > host.clientHeight + 8);
        });
        if (changed) scheduleSave();
      }'''

BLOCK_EDITOR = r'''      /* =====================================================================
         CONTENT SLIDES (wave 2) — the asset store and the card editor.

         Pictures live under their OWN store key, never inside `state`. Two
         measured reasons: sirenStore falls back to localStorage (~5 MB total)
         whenever IndexedDB is unavailable, so anything inside the main state
         blob must stay small or autosave dies for those users; and saveState
         runs JSON.stringify(state) 160 ms after every edit, so tens of MB of
         base64 must stay out of that hot path. Cards hold only an `assetId`.
         Only the bytes a card actually points at travel in a .siren export.

         The editor replaces the two window.prompt calls with a real dialog:
         kind rail on the left, a per-kind pane in the middle, and a live
         render of the exported slide on the right. The rich-text pane and the
         table grid keep PRIVATE copies of the Docs editors (cardApply…,
         cardBuild…) — Docs itself is not touched this close to a demo.
         ===================================================================== */

      const MAP_ASSETS_KEY = 't-industries-siren-v23-map-assets';
      const MAP_IMAGE_SOURCE_MAX = 20 * 1024 * 1024;   // refused before it is even decoded
      const MAP_ASSET_IMAGE_MAX = 1.5 * 1024 * 1024;   // per stored picture, after downscaling
      const MAP_ASSET_BUDGET = 40 * 1024 * 1024;       // past this the .siren stops being portable
      const MAP_ASSET_WARN = 25 * 1024 * 1024;
      const MAP_IMAGE_EDGES = [1920, 1440, 1120, 880];
      const MAP_IMAGE_QUALITY = 0.82;

      let mapAssetsCache = null;

      function mapAssets() {
        if (mapAssetsCache) return mapAssetsCache;
        try {
          const raw = sirenStore.get(MAP_ASSETS_KEY);
          const parsed = raw ? JSON.parse(raw) : null;
          mapAssetsCache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (error) {
          // A corrupt asset blob must never stop the Map opening: the cards
          // still draw, they just draw their "missing" state.
          mapAssetsCache = {};
        }
        return mapAssetsCache;
      }

      function mapAssetsWrite() {
        try {
          sirenStore.set(MAP_ASSETS_KEY, JSON.stringify(mapAssets()));
        } catch (error) {
          showToast('This browser refused to store that picture. It stays on the card for now — export the project to keep it.', 'error');
        }
      }

      function mapAssetGet(id) {
        const record = mapAssets()[String(id || '')];
        return record && typeof record === 'object' && typeof record.data === 'string' ? record : null;
      }

      function mapAssetDataUrl(asset) {
        if (!asset || !asset.data) return '';
        return `data:${asset.mime || 'application/octet-stream'};base64,${asset.data}`;
      }

      function mapAssetsTotal() {
        const store = mapAssets();
        return Object.keys(store).reduce((sum, id) => sum + (Number(store[id] && store[id].size) || 0), 0);
      }

      function mapNewAssetId() {
        const store = mapAssets();
        let id = '';
        do {
          id = `as${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.slice(0, 16);
        } while (store[id]);
        return id;
      }

      function mapAssetPut(record) {
        const total = mapAssetsTotal();
        if (total + record.size > MAP_ASSET_BUDGET) {
          throw new Error(`This project already holds ${mapBytes(total)} of pictures, and the ceiling is ${mapBytes(MAP_ASSET_BUDGET)}. Delete a picture card you no longer present, then try again.`);
        }
        const id = mapNewAssetId();
        mapAssets()[id] = record;
        mapAssetsWrite();
        if (total + record.size > MAP_ASSET_WARN) {
          showToast(`${mapBytes(total + record.size)} of pictures stored. Past ${mapBytes(MAP_ASSET_BUDGET)} the .siren export stops being portable.`, 'error');
        }
        return id;
      }

      function mapAssetIdsInUse() {
        const used = new Set();
        ((state.map && state.map.cards) || []).forEach(card => {
          if (card && card.assetId) used.add(String(card.assetId));
        });
        return used;
      }

      /* An asset outlives the card that dropped it only until the next sweep:
         orphaned base64 in the store is invisible weight in every export. */
      function mapCollectAssets() {
        const store = mapAssets();
        const used = mapAssetIdsInUse();
        let removed = 0;
        Object.keys(store).forEach(id => {
          if (used.has(id)) return;
          delete store[id];
          removed += 1;
        });
        if (removed) mapAssetsWrite();
        return removed;
      }

      // Only the bytes a card actually points at travel in a .siren; the file
      // is the real archive, since the browser store is evictable under disk
      // pressure.
      function mapAssetsForExport() {
        const store = mapAssets();
        const used = mapAssetIdsInUse();
        const out = {};
        used.forEach(id => { if (store[id]) out[id] = store[id]; });
        return out;
      }

      function mapAssetsFromImport(incoming) {
        if (!incoming || typeof incoming !== 'object') return;
        const store = mapAssets();
        Object.keys(incoming).slice(0, 400).forEach(id => {
          const record = incoming[id];
          if (!record || typeof record !== 'object' || typeof record.data !== 'string') return;
          store[String(id).slice(0, 24)] = {
            mime: String(record.mime || 'application/octet-stream').slice(0, 120),
            name: String(record.name || 'picture').slice(0, 200),
            size: Number(record.size) || Math.round(String(record.data).length * 3 / 4),
            w: Number(record.w) || 0,
            h: Number(record.h) || 0,
            data: String(record.data)
          };
        });
        mapAssetsWrite();
      }

      function mapBytes(count) {
        const value = Number(count) || 0;
        if (value < 1024) return `${value} B`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
        return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
      }

      function mapBase64Bytes(base64) {
        const text = String(base64 || '');
        const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
        return Math.max(0, Math.round(text.length * 3 / 4) - padding);
      }

      function mapSplitDataUrl(dataUrl) {
        const text = String(dataUrl || '');
        const comma = text.indexOf(',');
        return comma < 0 ? '' : text.slice(comma + 1);
      }

      /* ---------------- pictures: decode, downscale, encode ---------------- */

      // createImageBitmap fails on SVG blobs in this browser (InvalidStateError),
      // so the <img> route is not a nicety — it is the only way an SVG logo
      // gets in.
      function mapDecodeImage(file) {
        return createImageBitmap(file).then(
          bitmap => ({ source: bitmap, w: bitmap.width, h: bitmap.height, done: () => { if (bitmap.close) bitmap.close(); } }),
          () => new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => resolve({
              source: image,
              w: image.naturalWidth || image.width || 1200,
              h: image.naturalHeight || image.height || 800,
              done: () => URL.revokeObjectURL(url)
            });
            image.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error(`"${file.name || 'That file'}" is not a picture this browser can open. PNG, JPEG, WebP, GIF and SVG all work.`));
            };
            image.src = url;
          })
        );
      }

      /* THE TRANSPARENCY TRAP: a logo with a transparent background encoded to
         JPEG comes back with a BLACK background. Every format that can carry
         alpha gets scanned for it, and keeps PNG when it has any. */
      function mapCanvasHasAlpha(context, width, height) {
        try {
          const data = context.getImageData(0, 0, width, height).data;
          for (let index = 3; index < data.length; index += 4) {
            if (data[index] < 250) return true;
          }
          return false;
        } catch (error) {
          return true;
        }
      }

      async function mapPrepareImageAsset(file) {
        if (!file) throw new Error('No picture was chosen.');
        if (!/^image\//i.test(file.type || '')) {
          throw new Error(`"${file.name || 'That file'}" is not a picture.`);
        }
        if (file.size > MAP_IMAGE_SOURCE_MAX) {
          throw new Error(`That picture is ${mapBytes(file.size)}, and ${mapBytes(MAP_IMAGE_SOURCE_MAX)} is the most this will open. Save a smaller copy and try again.`);
        }
        const decoded = await mapDecodeImage(file);
        let flattened = false;
        try {
          for (let step = 0; step < MAP_IMAGE_EDGES.length; step += 1) {
            const edge = MAP_IMAGE_EDGES[step];
            const scale = Math.min(1, edge / Math.max(decoded.w, decoded.h, 1));
            const width = Math.max(1, Math.round(decoded.w * scale));
            const height = Math.max(1, Math.round(decoded.h * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            context.drawImage(decoded.source, 0, 0, width, height);
            const mayCarryAlpha = !/^image\/jpe?g$/i.test(file.type || '');
            const transparent = mayCarryAlpha && mapCanvasHasAlpha(context, width, height);
            let mime = transparent ? 'image/png' : 'image/jpeg';
            let payload = mapSplitDataUrl(transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', MAP_IMAGE_QUALITY));
            // A transparent PNG over the cap is flattened onto white rather
            // than dropped, and the presenter is told — a JPEG would have made
            // the background black.
            if (transparent && mapBase64Bytes(payload) > MAP_ASSET_IMAGE_MAX) {
              const flat = document.createElement('canvas');
              flat.width = width;
              flat.height = height;
              const flatContext = flat.getContext('2d');
              flatContext.fillStyle = '#ffffff';
              flatContext.fillRect(0, 0, width, height);
              flatContext.drawImage(canvas, 0, 0);
              payload = mapSplitDataUrl(flat.toDataURL('image/jpeg', MAP_IMAGE_QUALITY));
              mime = 'image/jpeg';
              flattened = true;
            }
            const size = mapBase64Bytes(payload);
            if (size <= MAP_ASSET_IMAGE_MAX || step === MAP_IMAGE_EDGES.length - 1) {
              if (size > MAP_ASSET_IMAGE_MAX) {
                throw new Error(`Even shrunk to ${width}×${height} that picture is ${mapBytes(size)}, over the ${mapBytes(MAP_ASSET_IMAGE_MAX)} a single card may hold. Crop it to the part you actually present, then bring it back.`);
              }
              return {
                record: { mime, name: String(file.name || 'picture').slice(0, 200), size, w: width, h: height, data: payload },
                flattened,
                sourceSize: file.size,
                sourceW: decoded.w,
                sourceH: decoded.h
              };
            }
          }
          throw new Error('That picture could not be reduced to a size a slide can carry.');
        } finally {
          try { decoded.done(); } catch (error) { /* no-op */ }
        }
      }

      /* ---------------- links: parsed, never fetched ---------------- */

      const MAP_YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
      const MAP_YOUTUBE_HOSTS = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'];

      function mapParseTimecode(value) {
        const text = String(value || '').trim();
        if (!text) return 0;
        if (/^\d+$/.test(text)) return Math.min(86400, Number(text));
        const match = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
        if (!match || !(match[1] || match[2] || match[3])) return 0;
        return Math.min(86400, Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0));
      }

      /* Anything that is not plainly http or https is refused rather than
         stored: a card is a thing the presenter clicks in front of a client. */
      function mapParseEmbed(raw) {
        const text = String(raw || '').trim();
        if (!text) return null;
        let url = null;
        try {
          url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
        } catch (error) {
          return null;
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        const host = url.hostname.replace(/^www\./i, '').toLowerCase();
        let id = '';
        if (host === 'youtu.be') {
          id = url.pathname.split('/').filter(Boolean)[0] || '';
        } else if (MAP_YOUTUBE_HOSTS.includes(host)) {
          if (url.pathname === '/watch') {
            id = url.searchParams.get('v') || '';
          } else {
            const parts = url.pathname.split('/').filter(Boolean);
            if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) id = parts[1] || '';
          }
        }
        const start = mapParseTimecode(url.searchParams.get('t') || url.searchParams.get('start') || '');
        if (id && MAP_YOUTUBE_ID.test(id)) {
          return { embedKind: 'youtube', embedId: id, embedStart: start, url: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}` : ''}` };
        }
        return { embedKind: 'link', embedId: '', embedStart: 0, url: url.href };
      }

      function mapSafeUrl(value) {
        const url = String(value == null ? '' : value).trim().slice(0, 2000);
        return /^https?:\/\/\S+$/i.test(url) ? url : '';
      }

      function mapEmbedHostLabel(card) {
        const url = mapSafeUrl(card && card.url);
        if (!url) return 'No link yet';
        const match = url.match(/^https?:\/\/([^/?#]+)/i);
        return match ? match[1].replace(/^www\./i, '') : url;
      }

      /* ---------------- rich text: a PRIVATE copy of the Docs editor ----------------
         Same `.wp-text` contract, same execCommand verbs, same
         sanitizeWorkpaperHtml on blur — but its own functions, so Docs itself
         is untouched. */

      function cardApplyRichTextFormat(command, value) {
        const selection = document.getSelection();
        const anchor = selection && selection.anchorNode instanceof Element
          ? selection.anchorNode
          : selection && selection.anchorNode ? selection.anchorNode.parentElement : null;
        const editor = anchor ? anchor.closest('.card-body-editor') : null;
        if (!editor) {
          showToast('Click inside the text first, then apply formatting.');
          return;
        }
        if (command === 'heading') {
          document.execCommand('formatBlock', false, value || '<p>');
        } else if (command === 'clear') {
          document.execCommand('removeFormat', false, null);
          document.execCommand('formatBlock', false, '<p>');
        } else {
          document.execCommand(
            command === 'bullet' ? 'insertUnorderedList' : command === 'number' ? 'insertOrderedList' : command,
            false,
            null
          );
        }
        editor.dispatchEvent(new Event('input', { bubbles: false }));
      }

      function cardAttachRichTextEditor(node, options) {
        const settings = options || {};
        node.classList.add('wp-text');
        node.contentEditable = 'true';
        node.setAttribute('role', 'textbox');
        node.setAttribute('aria-multiline', 'true');
        if (settings.label) node.setAttribute('aria-label', settings.label);
        node.dataset.placeholder = settings.placeholder || 'Write here — headings, bold, bullets and numbers from the buttons above.';
        node.innerHTML = String(settings.get() || '');
        const limit = Number(settings.limit) || WP_LIMITS.html;
        const touch = () => {
          settings.set(node.innerHTML.slice(0, limit));
          if (settings.onInput) settings.onInput();
        };
        // Sanitising on every keystroke would rewrite innerHTML mid-typing and
        // throw the caret to the start of the field; blur is the right moment.
        node.addEventListener('input', touch);
        node.addEventListener('blur', () => {
          const clean = sanitizeWorkpaperHtml(node.innerHTML);
          if (clean !== node.innerHTML) node.innerHTML = clean;
          settings.set(clean);
          if (settings.onCommit) settings.onCommit();
        });
        const insert = payload => {
          document.execCommand('insertHTML', false, payload);
          touch();
        };
        const fromTransfer = (html, text) => (html
          ? sanitizeWorkpaperHtml(html)
          : String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>'));
        node.addEventListener('paste', event => {
          // A pasted screenshot is a file, not markup; the dialog's own paste
          // handler takes it, so this one must not swallow the event first.
          if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length) return;
          event.preventDefault();
          insert(fromTransfer(event.clipboardData.getData('text/html'), event.clipboardData.getData('text/plain')));
        });
        node.addEventListener('drop', event => {
          if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) return;
          event.preventDefault();
          node.focus();
          insert(fromTransfer(event.dataTransfer.getData('text/html'), event.dataTransfer.getData('text/plain')));
        });
        return node;
      }

      const CARD_RT_BUTTONS = [
        ['bold', 'B', 'Bold', 'is-bold'],
        ['italic', 'I', 'Italic', 'is-italic'],
        ['underline', 'U', 'Underline', 'is-underline'],
        ['bullet', '•', 'Bullet list', ''],
        ['number', '1.', 'Numbered list', ''],
        ['h1', 'H1', 'Big heading', ''],
        ['h2', 'H2', 'Heading', ''],
        ['body', '¶', 'Ordinary paragraph', ''],
        ['clear', '⌫', 'Remove formatting', '']
      ];

      function cardBuildRichTextToolbar(target) {
        const bar = document.createElement('div');
        bar.className = 'card-rt-toolbar';
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', 'Text formatting');
        CARD_RT_BUTTONS.forEach(([command, glyph, title, modifier]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `card-rt-button${modifier ? ` ${modifier}` : ''}`;
          button.textContent = glyph;
          button.title = title;
          button.setAttribute('aria-label', title);
          // Without this the click blurs the contenteditable, the blur handler
          // rewrites innerHTML, and execCommand then formats an empty selection.
          button.addEventListener('mousedown', event => {
            event.preventDefault();
            if (target && document.activeElement !== target) target.focus();
          });
          button.addEventListener('click', () => {
            if (command === 'h1') cardApplyRichTextFormat('heading', '<h1>');
            else if (command === 'h2') cardApplyRichTextFormat('heading', '<h2>');
            else if (command === 'body') cardApplyRichTextFormat('heading', '<p>');
            else cardApplyRichTextFormat(command);
          });
          bar.appendChild(button);
        });
        return bar;
      }

      /* ---------------- the table grid, same shape as a workpaper table ----------------
         The gutter of × buttons is the one thing added over the Docs grid: the
         workpaper could only ever drop the LAST row, which is no use to
         somebody who mistyped row two. */

      function cardGutterButton(label, run) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wp-table-gutter-button';
        button.textContent = '×';
        button.title = label;
        button.setAttribute('aria-label', label);
        button.addEventListener('click', run);
        return button;
      }

      function cardBuildEditableTable(block, onChange, rerender) {
        if (!Array.isArray(block.rows) || !block.rows.length) block.rows = [['', ''], ['', '']];
        const outer = document.createElement('div');
        outer.className = 'wp-table-wrap';
        const table = document.createElement('table');
        table.className = 'wp-table';
        const width = block.rows[0].length;

        if (width > 1) {
          const gutterRow = document.createElement('tr');
          gutterRow.className = 'wp-table-gutter-row';
          const corner = document.createElement('td');
          corner.className = 'wp-table-gutter';
          gutterRow.appendChild(corner);
          for (let column = 0; column < width; column += 1) {
            const cell = document.createElement('td');
            cell.className = 'wp-table-gutter';
            const index = column;
            cell.appendChild(cardGutterButton(`Remove column ${column + 1}`, () => {
              block.rows.forEach(row => row.splice(index, 1));
              onChange();
              rerender();
            }));
            gutterRow.appendChild(cell);
          }
          table.appendChild(gutterRow);
        }

        block.rows.forEach((row, rowIndex) => {
          const tr = document.createElement('tr');
          const gutter = document.createElement('td');
          gutter.className = 'wp-table-gutter';
          if (block.rows.length > 1) {
            gutter.appendChild(cardGutterButton(`Remove row ${rowIndex + 1}`, () => {
              block.rows.splice(rowIndex, 1);
              onChange();
              rerender();
            }));
          }
          tr.appendChild(gutter);
          row.forEach((cellText, columnIndex) => {
            const cell = document.createElement(block.headerRow && rowIndex === 0 ? 'th' : 'td');
            cell.contentEditable = 'true';
            cell.textContent = cellText;
            cell.addEventListener('input', () => {
              block.rows[rowIndex][columnIndex] = cell.textContent.slice(0, WP_LIMITS.tableCell);
              onChange();
            });
            cell.addEventListener('paste', event => {
              // A cell takes text, never markup: pasting a Word cell used to
              // drag a whole stylesheet into the grid.
              event.preventDefault();
              const text = event.clipboardData.getData('text/plain').replace(/\s+/g, ' ').trim();
              document.execCommand('insertText', false, text);
            });
            tr.appendChild(cell);
          });
          table.appendChild(tr);
        });

        const controls = document.createElement('div');
        controls.className = 'wp-insert-bar';
        [
          ['＋ Row', () => {
            if (block.rows.length >= 200) { showToast('This table is at its 200-row limit.', 'error'); return; }
            block.rows.push(Array.from({ length: block.rows[0].length }, () => ''));
          }],
          ['＋ Column', () => {
            if (block.rows[0].length >= 12) { showToast('This table is at its 12-column limit.', 'error'); return; }
            block.rows.forEach(row => row.push(''));
          }],
          ['− Row', () => { if (block.rows.length > 1) block.rows.pop(); }],
          ['− Column', () => { if (block.rows[0].length > 1) block.rows.forEach(row => row.pop()); }]
        ].forEach(([label, run]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn ghost compact';
          button.textContent = label;
          button.addEventListener('click', () => { run(); onChange(); rerender(); });
          controls.appendChild(button);
        });

        outer.append(table, controls);
        return outer;
      }

      /* ---------------- the editor panel ---------------- */

      let mapCardEditorEl = null;
      let mapCardEditorRefs = null;
      let mapCardEditorCard = null;
      let mapCardEditorFresh = false;
      let mapCardEditorPreviewFrame = 0;
      let mapCardRenderFrame = 0;

      function mapCardKindMeta(kind) {
        return MAP_CARD_KINDS.find(entry => entry[0] === kind) || MAP_CARD_KINDS[0];
      }

      // Switching kind never destroys anything: every card keeps eyebrow, title
      // and the one rich body, and `kind` only decides which payload rides
      // along.
      function mapEnsureCardPayload(card) {
        if (typeof card.html !== 'string') card.html = '';
        if (!card.html && card.body) card.html = mapCardHtmlFromPlainText(card.body);
        if (!MAP_TEXT_SCALES.some(entry => entry[1] === Number(card.textScale))) card.textScale = 1;
        if (card.align !== 'centre') card.align = card.align === 'left' ? 'left' : (card.kind === 'title' ? 'centre' : 'left');
        if (card.kind === 'table' && (!Array.isArray(card.rows) || !card.rows.length)) {
          card.rows = [['Column', 'Column'], ['', ''], ['', '']];
          card.headerRow = true;
        }
        if (card.kind === 'image' && card.fit !== 'cover') card.fit = 'contain';
        if (card.kind === 'embed') {
          if (typeof card.url !== 'string') card.url = '';
          if (card.embedKind !== 'youtube') card.embedKind = 'link';
          if (typeof card.embedId !== 'string') card.embedId = '';
          if (!Number.isFinite(Number(card.embedStart))) card.embedStart = 0;
        }
        return card;
      }

      function mapTouchCard(rerenderPane) {
        const card = mapCardEditorCard;
        if (!card) return;
        card.body = mapCardPlainFromHtml(card.html).slice(0, 8000);
        scheduleSave();
        if (!mapCardRenderFrame) {
          mapCardRenderFrame = requestAnimationFrame(() => {
            mapCardRenderFrame = 0;
            mapRenderCards();
            mapRenderRoute();
          });
        }
        mapCardEditorPreview();
        if (rerenderPane) mapRenderCardEditorPane();
      }

      function mapCardEditorPreview() {
        cancelAnimationFrame(mapCardEditorPreviewFrame);
        mapCardEditorPreviewFrame = requestAnimationFrame(() => {
          const holder = mapCardEditorRefs && mapCardEditorRefs.preview;
          if (!holder || !mapCardEditorCard) return;
          Promise.resolve()
            .then(() => mapCardSlideSvg(mapCardEditorCard, 1920, 1080))
            .then(svg => {
              if (!svg || holder !== (mapCardEditorRefs && mapCardEditorRefs.preview)) return;
              const image = document.createElement('img');
              image.alt = 'How this card lands in the exported deck';
              image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
              holder.replaceChildren(image);
            })
            .catch(() => { holder.replaceChildren(); });
        });
      }

      /* --- small field builders --- */

      function mapEditorField(label, hint, forControl) {
        const wrap = document.createElement('div');
        wrap.className = 'card-field';
        // A <label> with nothing to point at is a lie to a screen reader, so
        // only fields that actually own one control get one.
        const caption = document.createElement(forControl ? 'label' : 'span');
        caption.className = 'card-field-label';
        caption.textContent = label;
        wrap.appendChild(caption);
        const body = document.createElement('div');
        body.className = 'card-field-body';
        wrap.appendChild(body);
        if (hint) {
          const note = document.createElement('p');
          note.className = 'card-field-hint';
          note.textContent = hint;
          wrap.appendChild(note);
        }
        return { wrap, body, caption };
      }

      function mapEditorTextInput(label, placeholder, get, set, limit) {
        const field = mapEditorField(label, '', true);
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'card-input';
        input.placeholder = placeholder;
        input.value = String(get() || '');
        input.maxLength = limit || 200;
        input.id = `cardField${Math.random().toString(36).slice(2, 8)}`;
        field.caption.htmlFor = input.id;
        input.addEventListener('input', () => { set(input.value.slice(0, limit || 200)); mapTouchCard(false); });
        field.body.appendChild(input);
        return { wrap: field.wrap, input };
      }

      function mapEditorSegmented(label, options, get, set) {
        const field = mapEditorField(label);
        field.wrap.classList.add('card-field-inline');
        const group = document.createElement('div');
        group.className = 'card-seg';
        group.setAttribute('role', 'radiogroup');
        group.setAttribute('aria-label', label);
        const buttons = [];
        const sync = () => {
          const current = String(get());
          buttons.forEach(([value, button]) => {
            const on = String(value) === current;
            button.classList.toggle('is-on', on);
            button.setAttribute('aria-checked', String(on));
            button.tabIndex = on ? 0 : -1;
          });
        };
        options.forEach(([value, text, title]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'card-seg-button';
          button.textContent = text;
          button.setAttribute('role', 'radio');
          if (title) button.title = title;
          button.addEventListener('click', () => { set(value); sync(); mapTouchCard(false); });
          buttons.push([value, button]);
          group.appendChild(button);
        });
        sync();
        field.body.appendChild(group);
        return field.wrap;
      }

      function mapEditorCheckbox(label, get, set) {
        const row = document.createElement('div');
        row.className = 'check-row card-check';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.id = `cardCheck${Math.random().toString(36).slice(2, 8)}`;
        box.checked = Boolean(get());
        const caption = document.createElement('label');
        caption.htmlFor = box.id;
        caption.textContent = label;
        box.addEventListener('change', () => { set(box.checked); mapTouchCard(true); });
        row.append(box, caption);
        return row;
      }

      /* --- the drop well: choose, drag, or paste --- */

      function mapEditorWell(options) {
        const settings = options || {};
        const well = document.createElement('button');
        well.type = 'button';
        well.className = 'card-well';
        const glyph = document.createElement('span');
        glyph.className = 'card-well-glyph';
        glyph.textContent = settings.glyph || '⬆';
        const title = document.createElement('span');
        title.className = 'card-well-title';
        title.textContent = settings.title || 'Choose a file';
        const hint = document.createElement('span');
        hint.className = 'card-well-hint';
        hint.textContent = settings.hint || 'Drag one here, or paste from the clipboard.';
        well.append(glyph, title, hint);

        const input = document.createElement('input');
        input.type = 'file';
        input.className = 'card-well-input';
        input.hidden = true;
        if (settings.accept) input.accept = settings.accept;
        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          input.value = '';
          if (file) settings.onFile(file);
        });
        well.appendChild(input);

        well.addEventListener('click', () => input.click());
        well.addEventListener('dragover', event => {
          event.preventDefault();
          event.stopPropagation();
          well.classList.add('is-over');
        });
        well.addEventListener('dragleave', () => well.classList.remove('is-over'));
        well.addEventListener('drop', event => {
          event.preventDefault();
          event.stopPropagation();
          well.classList.remove('is-over');
          const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
          if (file) settings.onFile(file);
        });
        return well;
      }

      function mapEditorBusy(on, message) {
        if (!mapCardEditorRefs) return;
        mapCardEditorRefs.pane.classList.toggle('is-busy', Boolean(on));
        if (on && message) showToast(message);
      }

      /* An image card's height follows the picture, so the camera frames the
         photograph rather than a band of empty paper under it. */
      function mapFitCardToImage(card, asset) {
        if (!asset || !asset.w || !asset.h) return;
        const chrome = (card.title ? 320 : 190) + (card.html ? 200 : 0);
        const inner = Math.max(120, card.w - 120);
        card.h = clamp(Math.round(inner * (asset.h / asset.w)) + chrome, 180, 4000);
      }

      async function mapAcceptImage(file, options) {
        const settings = options || {};
        const card = mapCardEditorCard;
        if (!card) return;
        mapEditorBusy(true, 'Preparing the picture…');
        try {
          const prepared = await mapPrepareImageAsset(file);
          const previous = card.assetId;
          card.assetId = mapAssetPut(prepared.record);
          if (previous && previous !== card.assetId) {
            delete mapAssets()[previous];
            mapAssetsWrite();
          }
          if (settings.fitCard !== false) mapFitCardToImage(card, prepared.record);
          if (!card.title && prepared.record.name) {
            card.title = prepared.record.name.replace(/\.[A-Za-z0-9]+$/, '').slice(0, 200);
          }
          mapTouchCard(true);
          const shrunk = prepared.sourceSize > prepared.record.size * 1.15;
          showToast(prepared.flattened
            ? `Stored at ${prepared.record.w}×${prepared.record.h}. Its transparent background was filled with white — a JPEG would have made it black.`
            : shrunk
              ? `Stored at ${prepared.record.w}×${prepared.record.h}, ${mapBytes(prepared.record.size)} — down from ${mapBytes(prepared.sourceSize)}.`
              : `Stored at ${prepared.record.w}×${prepared.record.h}, ${mapBytes(prepared.record.size)}.`,
          'success');
        } catch (error) {
          showToast(error && error.message ? error.message : 'That picture could not be added.', 'error');
        } finally {
          mapEditorBusy(false);
        }
      }

      function mapClearCardAsset() {
        const card = mapCardEditorCard;
        if (!card || !card.assetId) return;
        delete mapAssets()[card.assetId];
        mapAssetsWrite();
        card.assetId = '';
        mapTouchCard(true);
      }

      /* --- per-kind panes --- */

      function mapPaneImage(card, into) {
        const asset = mapAssetGet(card.assetId);
        if (!asset) {
          into.appendChild(mapEditorWell({
            glyph: '🖼',
            title: 'Choose a picture',
            hint: 'Or drag one in, or press Ctrl+V with a screenshot on the clipboard. PNG, JPEG, WebP, GIF and SVG.',
            accept: 'image/*',
            onFile: file => mapAcceptImage(file)
          }));
          return;
        }
        const chip = document.createElement('div');
        chip.className = 'card-asset';
        const thumb = document.createElement('img');
        thumb.className = 'card-asset-thumb';
        thumb.alt = '';
        thumb.src = mapAssetDataUrl(asset);
        const facts = document.createElement('div');
        facts.className = 'card-asset-facts';
        const name = document.createElement('strong');
        name.textContent = asset.name || 'Picture';
        const meta = document.createElement('span');
        meta.textContent = `${asset.w}×${asset.h} · ${mapBytes(asset.size)} · ${String(asset.mime || '').replace('image/', '').toUpperCase()}`;
        facts.append(name, meta);
        const actions = document.createElement('div');
        actions.className = 'card-asset-actions';
        const replace = document.createElement('button');
        replace.type = 'button';
        replace.className = 'btn ghost compact';
        replace.textContent = 'Replace…';
        const picker = document.createElement('input');
        picker.type = 'file';
        picker.accept = 'image/*';
        picker.hidden = true;
        picker.addEventListener('change', () => {
          const file = picker.files && picker.files[0];
          picker.value = '';
          if (file) mapAcceptImage(file);
        });
        replace.addEventListener('click', () => picker.click());
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn ghost compact';
        remove.textContent = 'Remove';
        remove.addEventListener('click', mapClearCardAsset);
        actions.append(replace, remove, picker);
        chip.append(thumb, facts, actions);
        into.appendChild(chip);
        into.appendChild(mapEditorSegmented('Framing', [
          ['contain', 'Whole picture', 'Show all of it, letterboxed if the card is a different shape'],
          ['cover', 'Fill the card', 'Crop to fill the card edge to edge']
        ], () => card.fit, value => { card.fit = value; }));
        const refit = document.createElement('button');
        refit.type = 'button';
        refit.className = 'btn ghost compact card-inline-action';
        refit.textContent = 'Resize the card to this picture';
        refit.addEventListener('click', () => { mapFitCardToImage(card, asset); mapTouchCard(false); showToast('Card resized to the picture.', 'success'); });
        into.appendChild(refit);
      }

      function mapPaneEmbed(card, into) {
        const field = mapEditorTextInput(
          'Link',
          'Paste a YouTube link, or any web address',
          () => card.url,
          value => {
            const parsed = mapParseEmbed(value);
            card.url = String(value || '').trim().slice(0, 600);
            card.embedKind = parsed ? parsed.embedKind : 'link';
            card.embedId = parsed ? parsed.embedId : '';
            card.embedStart = parsed ? parsed.embedStart : 0;
          },
          600
        );
        into.appendChild(field.wrap);

        const status = document.createElement('p');
        status.className = 'card-field-hint card-embed-status';
        const paint = () => {
          if (!card.url) status.textContent = 'Nothing linked yet.';
          else if (card.embedKind === 'youtube') status.textContent = `Recognised as YouTube video ${card.embedId}${card.embedStart ? `, starting at ${card.embedStart}s` : ''}.`;
          else if (mapParseEmbed(card.url)) status.textContent = 'Stored as a plain link.';
          else status.textContent = 'That is not a web address this will open. Links have to start with http:// or https://.';
        };
        paint();
        field.input.addEventListener('input', paint);
        into.appendChild(status);

        const still = mapAssetGet(card.assetId);
        if (still) {
          const chip = document.createElement('div');
          chip.className = 'card-asset';
          const thumb = document.createElement('img');
          thumb.className = 'card-asset-thumb';
          thumb.alt = '';
          thumb.src = mapAssetDataUrl(still);
          const facts = document.createElement('div');
          facts.className = 'card-asset-facts';
          const name = document.createElement('strong');
          name.textContent = 'Poster still';
          const meta = document.createElement('span');
          meta.textContent = `${still.w}×${still.h} · ${mapBytes(still.size)}`;
          facts.append(name, meta);
          const actions = document.createElement('div');
          actions.className = 'card-asset-actions';
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'btn ghost compact';
          remove.textContent = 'Remove still';
          remove.addEventListener('click', mapClearCardAsset);
          actions.appendChild(remove);
          chip.append(thumb, facts, actions);
          into.appendChild(chip);
        } else {
          into.appendChild(mapEditorWell({
            glyph: '▶',
            title: 'Add a still for the poster',
            hint: 'A screenshot of the first frame. Without one the card shows the title and the address — which is also what a room with no network gets.',
            accept: 'image/*',
            onFile: file => mapAcceptImage(file, { fitCard: false })
          }));
        }

        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'btn ghost compact card-inline-action';
        open.textContent = '⧉ Open in the browser';
        open.addEventListener('click', () => mapOpenCardLink(card));
        into.appendChild(open);

        const honest = document.createElement('p');
        honest.className = 'card-field-hint';
        honest.textContent = 'No video ever plays inside the deck — this app works with no network by design. The plane and every exported slide show this poster; during a live demo, “Open in browser” plays the link in the system browser.';
        into.appendChild(honest);
      }

      function mapPaneTable(card, into) {
        into.appendChild(mapEditorCheckbox('First row is a header', () => card.headerRow !== false, value => { card.headerRow = value; }));
        into.appendChild(cardBuildEditableTable(
          card,
          () => mapTouchCard(false),
          () => mapRenderCardEditorPane()
        ));
      }

      function mapPaneDoc(card, into) {
        const docs = state.workpapers || [];
        if (!docs.length) {
          const empty = document.createElement('p');
          empty.className = 'card-field-hint';
          empty.textContent = 'There are no written documents in this workspace yet. Write one under Documentation, and it can become a slide from here.';
          into.appendChild(empty);
          return;
        }
        const field = mapEditorField('Document', '', true);
        const select = document.createElement('select');
        select.className = 'card-input';
        select.id = `cardDoc${Math.random().toString(36).slice(2, 8)}`;
        field.caption.htmlFor = select.id;
        docs.forEach(doc => {
          const option = document.createElement('option');
          option.value = doc.id;
          option.textContent = doc.title || 'Untitled document';
          if (doc.id === card.docId) option.selected = true;
          select.appendChild(option);
        });
        if (!card.docId) card.docId = docs[0].id;
        select.addEventListener('change', () => {
          card.docId = select.value;
          card.blockIds = [];
          mapTouchCard(true);
        });
        field.body.appendChild(select);
        into.appendChild(field.wrap);

        const doc = docs.find(entry => entry.id === card.docId);
        if (!doc) return;
        const list = mapEditorField('Which parts', 'Nothing ticked means the first blocks of the document.');
        const box = document.createElement('div');
        box.className = 'card-picklist';
        (doc.blocks || []).slice(0, 60).forEach(block => {
          const row = document.createElement('label');
          row.className = 'card-picklist-row';
          const check = document.createElement('input');
          check.type = 'checkbox';
          check.checked = (card.blockIds || []).includes(block.id);
          check.addEventListener('change', () => {
            const ids = new Set(card.blockIds || []);
            if (check.checked) ids.add(block.id); else ids.delete(block.id);
            card.blockIds = Array.from(ids).slice(0, 40);
            mapTouchCard(false);
          });
          const text = document.createElement('span');
          text.textContent = (workpaperBlockDigest(block) || `(${block.kind})`).replace(/\s+/g, ' ').slice(0, 110);
          row.append(check, text);
          box.appendChild(row);
        });
        list.body.appendChild(box);
        into.appendChild(list.wrap);
      }

      function mapPaneFacts(card, into) {
        const diagrams = state.diagrams || [];
        const field = mapEditorField('Diagram', '', true);
        const select = document.createElement('select');
        select.className = 'card-input';
        select.id = `cardDiagram${Math.random().toString(36).slice(2, 8)}`;
        field.caption.htmlFor = select.id;
        diagrams.forEach(diagram => {
          const option = document.createElement('option');
          option.value = diagram.id;
          option.textContent = diagram.name || 'Untitled diagram';
          if (diagram.id === card.diagramId) option.selected = true;
          select.appendChild(option);
        });
        if (!card.diagramId && diagrams.length) card.diagramId = diagrams[0].id;
        select.addEventListener('change', () => { card.diagramId = select.value; card.nodeIds = []; mapTouchCard(true); });
        field.body.appendChild(select);
        into.appendChild(field.wrap);

        const diagram = diagrams.find(entry => entry.id === card.diagramId);
        const metadata = (diagram && diagram.nodeMetadata) || {};
        const ids = Object.keys(metadata).slice(0, 80);
        const list = mapEditorField('Which blocks', 'Only blocks that already carry risk, control, owner or evidence appear here.');
        const box = document.createElement('div');
        box.className = 'card-picklist';
        if (!ids.length) {
          const empty = document.createElement('p');
          empty.className = 'card-field-hint';
          empty.textContent = 'No block on this diagram has facts recorded yet. Open a block on the canvas and fill in risk, control, owner or evidence first.';
          box.appendChild(empty);
        }
        ids.forEach(nodeId => {
          const facts = metadata[nodeId] || {};
          const first = MAP_FACT_FIELDS.map(([key, label]) => (facts[key] ? `${label}: ${facts[key]}` : '')).filter(Boolean)[0] || '';
          const row = document.createElement('label');
          row.className = 'card-picklist-row';
          const check = document.createElement('input');
          check.type = 'checkbox';
          check.checked = (card.nodeIds || []).includes(nodeId);
          check.addEventListener('change', () => {
            const chosen = new Set(card.nodeIds || []);
            if (check.checked) chosen.add(nodeId); else chosen.delete(nodeId);
            card.nodeIds = Array.from(chosen).slice(0, 40);
            mapTouchCard(false);
          });
          const text = document.createElement('span');
          text.textContent = first ? `${nodeId} — ${first}`.slice(0, 110) : nodeId;
          row.append(check, text);
          box.appendChild(row);
        });
        list.body.appendChild(box);
        into.appendChild(list.wrap);
      }

      /* --- the pane, rebuilt whenever the kind or a payload changes --- */

      function mapRenderCardEditorPane() {
        const card = mapCardEditorCard;
        const refs = mapCardEditorRefs;
        if (!card || !refs) return;
        mapEnsureCardPayload(card);

        refs.kindButtons.forEach(([kind, button]) => {
          const on = kind === card.kind;
          button.classList.toggle('is-on', on);
          button.setAttribute('aria-checked', String(on));
          button.tabIndex = on ? 0 : -1;
        });

        const meta = mapCardKindMeta(card.kind);
        refs.kindTitle.textContent = meta[1];
        refs.kindHint.textContent = meta[3];

        const pane = refs.pane;
        pane.replaceChildren();

        const eyebrow = mapEditorTextInput('Eyebrow', 'Small line above the heading — optional', () => card.eyebrow, value => { card.eyebrow = value; }, 80);
        pane.appendChild(eyebrow.wrap);
        const title = mapEditorTextInput('Heading', 'What this slide is called', () => card.title, value => { card.title = value; }, 200);
        pane.appendChild(title.wrap);
        refs.titleInput = title.input;

        const payload = document.createElement('div');
        payload.className = 'card-payload';
        pane.appendChild(payload);
        if (card.kind === 'table') mapPaneTable(card, payload);
        else if (card.kind === 'image') mapPaneImage(card, payload);
        else if (card.kind === 'embed') mapPaneEmbed(card, payload);
        else if (card.kind === 'doc') mapPaneDoc(card, payload);
        else if (card.kind === 'facts') mapPaneFacts(card, payload);

        const bodyField = mapEditorField(
          card.kind === 'text' || card.kind === 'title' ? 'Text' : 'Text underneath',
          card.kind === 'image' ? 'A caption, or the two or three points the screenshot is evidence for.' : ''
        );
        const editor = document.createElement('div');
        editor.className = 'card-body-editor';
        bodyField.body.appendChild(cardBuildRichTextToolbar(editor));
        bodyField.body.appendChild(editor);
        cardAttachRichTextEditor(editor, {
          label: 'Card text',
          placeholder: card.kind === 'title'
            ? 'One or two lines under the heading — optional.'
            : 'Write here. Headings, bullets and numbered lists from the buttons above.',
          get: () => card.html,
          set: value => { card.html = value; },
          onInput: () => mapTouchCard(false),
          onCommit: () => mapTouchCard(false)
        });
        refs.body = editor;
        pane.appendChild(bodyField.wrap);

        const controls = document.createElement('div');
        controls.className = 'card-control-row';
        controls.appendChild(mapEditorSegmented(
          'Text size',
          MAP_TEXT_SCALES.map(([label, value]) => [value, label, `${Math.round(value * 100)}% of the normal slide text`]),
          () => card.textScale,
          value => { card.textScale = Number(value); }
        ));
        if (card.kind === 'title') {
          controls.appendChild(mapEditorSegmented('Alignment', [['left', 'Left'], ['centre', 'Centred']], () => card.align, value => { card.align = value; }));
        }
        pane.appendChild(controls);

        mapCardEditorPreview();
      }

      /* --- the dialog itself --- */

      function mapEnsureCardEditor() {
        if (mapCardEditorEl) return mapCardEditorEl;
        const dialog = document.createElement('dialog');
        dialog.id = 'mapCardEditor';
        dialog.className = 'card-editor';
        dialog.setAttribute('aria-labelledby', 'mapCardEditorTitle');

        const header = document.createElement('div');
        header.className = 'dialog-header';
        const heading = document.createElement('h2');
        heading.id = 'mapCardEditorTitle';
        heading.textContent = 'Card';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn ghost icon';
        close.textContent = '×';
        close.setAttribute('aria-label', 'Close the card editor');
        close.addEventListener('click', () => mapCloseCardEditor());
        header.append(heading, close);

        const body = document.createElement('div');
        body.className = 'card-editor-body';

        const rail = document.createElement('div');
        rail.className = 'card-kind-rail';
        rail.setAttribute('role', 'radiogroup');
        rail.setAttribute('aria-label', 'What this card holds');
        const kindButtons = [];
        MAP_CARD_KINDS.forEach(([kind, label, glyph, hint]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'card-kind-tile';
          button.setAttribute('role', 'radio');
          button.title = hint;
          const mark = document.createElement('span');
          mark.className = 'card-kind-glyph';
          mark.textContent = glyph;
          const text = document.createElement('span');
          text.className = 'card-kind-label';
          text.textContent = label;
          button.append(mark, text);
          button.addEventListener('click', () => {
            if (!mapCardEditorCard || mapCardEditorCard.kind === kind) return;
            mapCardEditorCard.kind = kind;
            mapEnsureCardPayload(mapCardEditorCard);
            mapRenderCardEditorPane();
            mapTouchCard(false);
          });
          kindButtons.push([kind, button]);
          rail.appendChild(button);
        });

        const middle = document.createElement('div');
        middle.className = 'card-editor-middle';
        const kindHead = document.createElement('div');
        kindHead.className = 'card-kind-head';
        const kindTitle = document.createElement('h3');
        kindTitle.className = 'card-kind-title';
        const kindHint = document.createElement('p');
        kindHint.className = 'card-kind-hint';
        kindHead.append(kindTitle, kindHint);
        const pane = document.createElement('div');
        pane.className = 'card-editor-pane';
        middle.append(kindHead, pane);

        const side = document.createElement('div');
        side.className = 'card-editor-side';
        const previewLabel = document.createElement('div');
        previewLabel.className = 'card-preview-label';
        previewLabel.textContent = 'The exported slide';
        const preview = document.createElement('div');
        preview.className = 'card-preview';
        const previewNote = document.createElement('p');
        previewNote.className = 'card-field-hint';
        previewNote.textContent = 'This is the picture that lands in the PDF — not the version on the plane.';
        side.append(previewLabel, preview, previewNote);

        body.append(rail, middle, side);

        const footer = document.createElement('div');
        footer.className = 'dialog-footer card-editor-footer';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn danger';
        remove.textContent = 'Delete card';
        remove.addEventListener('click', () => mapDeleteCurrentCard());
        const spacer = document.createElement('div');
        spacer.className = 'card-footer-spacer';
        const done = document.createElement('button');
        done.type = 'button';
        done.className = 'btn';
        done.id = 'mapCardEditorDone';
        done.textContent = 'Done';
        done.addEventListener('click', () => mapCloseCardEditor());
        footer.append(remove, spacer, done);

        dialog.append(header, body, footer);

        // Escape fires `cancel`; the browser would close without committing.
        dialog.addEventListener('cancel', event => {
          event.preventDefault();
          mapCloseCardEditor();
        });
        dialog.addEventListener('close', () => {
          mapCardEditorCard = null;
          if (mapCardEditorRefs) mapCardEditorRefs.body = null;
        });
        // The dialog's own box fills its padding, so a click that lands on the
        // element itself came from the backdrop.
        dialog.addEventListener('click', event => {
          if (event.target === dialog) mapCloseCardEditor();
        });
        // An auditor's evidence is a Ctrl+PrtScn screenshot, not a file on disk.
        dialog.addEventListener('paste', event => {
          const files = event.clipboardData && event.clipboardData.files;
          const file = files && files.length ? files[0] : null;
          if (!file || !/^image\//i.test(file.type || '')) return;
          event.preventDefault();
          event.stopPropagation();
          const card = mapCardEditorCard;
          if (!card) return;
          if (card.kind !== 'image' && card.kind !== 'embed') {
            card.kind = 'image';
            mapEnsureCardPayload(card);
            showToast('Pasted a picture, so this became a Picture card. Its text is untouched.');
          }
          mapAcceptImage(file, { fitCard: card.kind === 'image' });
        });
        dialog.addEventListener('dragover', event => { event.preventDefault(); });
        dialog.addEventListener('drop', event => {
          const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
          if (!file) return;
          event.preventDefault();
          const card = mapCardEditorCard;
          if (!card) return;
          if (!/^image\//i.test(file.type || '')) {
            showToast('Only pictures can be dropped onto a card.', 'error');
            return;
          }
          if (card.kind !== 'image' && card.kind !== 'embed') { card.kind = 'image'; mapEnsureCardPayload(card); }
          mapAcceptImage(file, { fitCard: card.kind === 'image' });
        });

        document.body.appendChild(dialog);
        mapCardEditorEl = dialog;
        mapCardEditorRefs = { pane, preview, kindButtons, kindTitle, kindHint, heading, body: null, titleInput: null };
        return dialog;
      }

      /* REPLACES the two window.prompt calls: clicking any card opens this. */
      function mapEditCard(card, options) {
        if (!card || !state.map) return;
        if (readOnlyMode) {
          showToast('This is a read-only shared view. Cards cannot be changed here.', 'error');
          return;
        }
        const settings = options || {};
        const dialog = mapEnsureCardEditor();
        mapCardEditorCard = card;
        mapCardEditorFresh = Boolean(settings.fresh);
        mapEnsureCardPayload(card);
        mapCardEditorRefs.heading.textContent = settings.fresh ? 'New card' : 'Card';
        mapRenderCardEditorPane();
        showDialog(dialog);
        window.requestAnimationFrame(() => {
          const focusBody = settings.focus === 'body';
          const target = focusBody ? mapCardEditorRefs.body : mapCardEditorRefs.titleInput;
          if (!target) return;
          target.focus();
          if (!focusBody && target.select) target.select();
        });
      }

      function mapCloseCardEditor() {
        if (!mapCardEditorEl) return;
        mapCommitCardEditor();
        closeDialog(mapCardEditorEl);
      }

      function mapCommitCardEditor() {
        const card = mapCardEditorCard;
        if (!card || !state.map) return;
        // Done can be clicked with the caret still in the rich field, and that
        // field only sanitises on blur — so force the blur before reading back.
        const editor = mapCardEditorRefs && mapCardEditorRefs.body;
        if (editor && document.activeElement === editor) editor.blur();
        card.body = mapCardPlainFromHtml(card.html).slice(0, 8000);
        const index = state.map.cards.findIndex(entry => entry.id === card.id);
        if (index >= 0) state.map.cards[index] = sanitizeMapCard(card);
        mapCollectAssets();
        if (mapCardEditorFresh) scheduleUndoSnapshot();
        mapCardEditorFresh = false;
        scheduleSave();
        mapRenderCards();
        mapRenderRoute();
        mapRenderThread();
        mapUpdateChrome();
      }

      /* A card exists because a view points at it, so deleting the card means
         deleting every view that points at it — otherwise mapPruneCards would
         put it straight back, or the route would step onto nothing. */
      function mapDeleteCurrentCard() {
        const card = mapCardEditorCard;
        if (!card || !state.map) return;
        const label = card.title || card.eyebrow || 'this card';
        requestConfirmation({
          title: 'Delete this card?',
          message: `"${label}" and its place in the presentation both go. Anything attached to it goes with it.`,
          confirmText: 'Delete card',
          action: () => {
            state.map.cards = state.map.cards.filter(entry => entry.id !== card.id);
            state.map.route = state.map.route.filter(view => !(view.target && view.target.kind === 'card' && view.target.cardId === card.id));
            mapRouteIndex = clamp(mapRouteIndex, 0, Math.max(0, state.map.route.length - 1));
            mapCardEditorCard = null;
            mapCollectAssets();
            scheduleUndoSnapshot();
            scheduleSave();
            if (mapCardEditorEl && mapCardEditorEl.open) mapCardEditorEl.close();
            mapRenderCards();
            mapRenderRoute();
            mapRenderThread();
            mapUpdateChrome();
            if (mapMode && state.map.route.length) mapGoToView(mapRouteIndex);
            showToast('Card deleted.', 'success');
          }
        });
      }

      /* Per-kind starting content. A fresh card is never a "New section"
         fossil: mapAddCard opens the editor on it straight away. */
      const MAP_CARD_SEEDS = {
        title: { eyebrow: '', title: '', html: '', align: 'centre' },
        text: { title: 'Note', html: '' },
        table: { title: 'Table', html: '', headerRow: true, rows: [['Column', 'Column', 'Column'], ['', '', ''], ['', '', '']] },
        image: { title: '', html: '', fit: 'contain' },
        embed: { title: 'Video', html: '', url: '' },
        doc: { title: 'Document', html: '' },
        facts: { title: 'Block facts', html: '' }
      };'''

BLOCK_PRUNE = r'''      function mapPruneCards() {
        if (!state.map) return;
        const used = new Set((state.map.route || [])
          .filter(view => view.target && view.target.kind === 'card')
          .map(view => view.target.cardId));
        const before = state.map.cards.length;
        state.map.cards = state.map.cards.filter(card => used.has(card.id));
        if (state.map.cards.length !== before) {
          // A deleted screenshot must not live on in the store forever.
          mapCollectAssets();
          mapRenderCards();
        }
      }'''

BLOCK_ADD = r'''      /* A new card lands in the gutter beside whatever the camera is looking
         at, is added to the route where the presenter is standing, and opens
         its editor — there is no state in which a card exists and the auditor
         has not been shown how to fill it. */
      function mapAddCard(kind, extra) {
        if (!state.map) return null;
        const anchor = mapCardAnchor();
        const seed = MAP_CARD_SEEDS[kind] || MAP_CARD_SEEDS.text;
        const size = mapCardDefaultSize(kind);
        const card = sanitizeMapCard({
          kind,
          x: anchor.x,
          y: anchor.y,
          w: size.w,
          h: size.h,
          diagramId: anchor.diagramId,
          ...seed,
          ...(extra || {})
        });
        mapEnsureCardPayload(card);
        state.map.cards.push(card);
        const view = sanitizeRouteView({ target: { kind: 'card', cardId: card.id }, note: '' });
        state.map.route.splice(mapRouteIndex + 1, 0, view);
        mapRouteIndex += 1;
        // Build mode's curated flag, when that wave has landed: adding a slide
        // means the author has taken charge of the deck.
        if (typeof state.map.curated === 'boolean') state.map.curated = true;
        scheduleUndoSnapshot();
        scheduleSave();
        mapRenderCards();
        mapRenderRoute();
        mapRenderThread();
        mapGoToView(mapRouteIndex);
        mapEditCard(card, { fresh: true, focus: kind === 'text' ? 'body' : undefined });
        return card;
      }'''

BLOCK_MENU = r'''      /* One flat list a non-coder reads in a single glance; documents already
         linked to the diagram in view still come first, because that is the
         two-click path from a written workpaper to a slide. */
      function mapOpenCardMenu(anchorEl) {
        const camera = mapCameraRect();
        const covering = state.diagrams.filter(diagram => {
          const tile = mapTileRect(diagram.id);
          return tile && mapRectsIntersect(tile, camera);
        });
        const diagramId = covering.length === 1 ? covering[0].id : '';
        const options = [];
        (state.workpapers || []).forEach(doc => {
          if (!(doc.links || []).some(link => link.diagramId === diagramId)) return;
          options.push([`doc:${doc.id}`, `Document · ${doc.title}`]);
        });
        options.push(
          ['title', '❖  Title slide'],
          ['section', '❖  Section break'],
          ['text', '¶  Text — headings and bullets'],
          ['table', '▦  Table'],
          ['image', '🖼  Picture…'],
          ['embed', '▶  Video link…']
        );
        if (diagramId) options.push(['facts', '⌗  Facts about the blocks in view']);
        (state.workpapers || []).forEach(doc => {
          if ((doc.links || []).some(link => link.diagramId === diagramId)) return;
          options.push([`doc:${doc.id}`, `Document · ${doc.title}`]);
        });
        openStructureMenu(anchorEl, options.slice(0, 14), '', value => {
          if (value === 'title') {
            mapAddCard('title', { eyebrow: '', title: state.projectName || 'Presentation' });
          } else if (value === 'section') {
            mapAddCard('title', { eyebrow: 'Section', title: 'New section' });
          } else if (value === 'facts') {
            const tile = mapTileEls.get(diagramId);
            const svg = tile && tile.body.querySelector('svg');
            const ids = svg ? Array.from(svg.querySelectorAll('.node')).map(mapNodeIdFromElement).filter(Boolean).slice(0, 8) : [];
            mapAddCard('facts', { diagramId, nodeIds: mapSelectedNodeIds.length ? mapSelectedNodeIds : ids });
          } else if (value.startsWith('doc:')) {
            const doc = (state.workpapers || []).find(entry => entry.id === value.slice(4));
            if (doc) mapAddCard('doc', { title: doc.title, docId: doc.id });
          } else {
            mapAddCard(value);
          }
        });
      }'''

BLOCK_ENGINE = r'''      /* =====================================================================
         CONTENT SLIDES (wave 2) — cards become slides.
         sanitizeSvgForRaster destroys every <foreignObject> before
         svgToCanvas draws, so HTML-in-SVG is not available: every heading,
         bullet and table cell on an exported slide is measured, wrapped and
         positioned here in real SVG <text>/<tspan>. Images ride as
         <image href="data:…"> (kept by the sanitiser, does not taint the
         canvas); a video is always its drawn poster — an iframe cannot
         rasterise, and there is no network to ask anyway.
         ===================================================================== */
      const MAP_SLIDE = {
        w: 1920,
        h: 1080,
        padX: 120,
        padTop: 104,
        padBottom: 96,
        gap: 34,
        lineHeight: 1.34
      };

      /* One entry per flow item type. `size` is the size at textScale 1; the card's
         own scale multiplies it, so S/M/L/XL moves the whole body as one piece and
         the slide never ends up with nine different type sizes on it. */
      const MAP_SLIDE_TEXT = {
        h1:   { size: 62, weight: 800, gapBefore: 36, gapAfter: 14 },
        h2:   { size: 52, weight: 800, gapBefore: 32, gapAfter: 12 },
        h3:   { size: 44, weight: 700, gapBefore: 28, gapAfter: 10 },
        p:    { size: 40, weight: 400, gapBefore: 0,  gapAfter: 20 },
        li:   { size: 40, weight: 400, gapBefore: 0,  gapAfter: 12 },
        note: { size: 32, weight: 400, gapBefore: 0,  gapAfter: 14 }
      };

      let mapSlideMeasureCtx = null;
      let mapSlideClipSeq = 0;
      const mapSlideWidthCache = new Map();

      function mapSlideNum(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '0';
        return String(Math.round(number * 100) / 100);
      }

      function mapSlideScale(card) {
        const value = Number(card && card.textScale);
        return Number.isFinite(value) && value >= 0.6 && value <= 2 ? value : 1;
      }

      function mapSlidePalette() {
        let style = null;
        try { style = getComputedStyle(document.body); } catch (error) { style = null; }
        const read = (name, fallback) => {
          if (!style) return fallback;
          const value = String(style.getPropertyValue(name) || '').trim();
          return value || fallback;
        };
        return {
          bg: read('--panel-bg', '#ffffff'),
          fg: read('--text', '#111111'),
          muted: read('--muted', '#6b7280'),
          accent: read('--primary', '#2563eb'),
          border: read('--border', '#d5dae1'),
          family: fontStack((state && state.fontFamily) || 'Inter'),
          mono: 'Courier New, Courier, monospace'
        };
      }

      /* The asset store is a separate key, not part of `state`, so a 40 MB library of
         screenshots never lands in the 160 ms JSON.stringify(state) autosave. Read it
         through whichever accessor the storage part installed, and never throw. */
      function mapSlideAsset(assetId) {
        const id = String(assetId || '');
        if (!id) return null;
        try {
          if (typeof mapAssetGet === 'function') return mapAssetGet(id) || null;
        } catch (error) { /* fall through to the plain object */ }
        try {
          if (typeof mapAssets === 'object' && mapAssets) return mapAssets[id] || null;
        } catch (error) { /* no store in this build */ }
        return null;
      }

      function mapSlideAssetHref(asset) {
        const data = String((asset && asset.data) || '');
        if (!data) return '';
        if (/^data:/i.test(data)) return data;
        const mime = String((asset && asset.mime) || 'image/png').replace(/[^A-Za-z0-9.+/-]/g, '') || 'image/png';
        return `data:${mime};base64,${data}`;
      }

      function mapSlideBytes(size) {
        const bytes = Number(size);
        if (!Number.isFinite(bytes) || bytes <= 0) return '';
        if (bytes < 1024) return `${Math.round(bytes)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
      }

      function mapSlideFileLabel(asset, card) {
        const name = String((asset && asset.name) || (card && card.url) || 'attachment');
        const dot = name.lastIndexOf('.');
        const extension = dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toUpperCase().slice(0, 6) : 'FILE';
        const size = mapSlideBytes(asset && asset.size);
        return { name, meta: size ? `${extension} · ${size}` : extension };
      }

      /* ---------------- measurement and wrapping ---------------- */

      function mapSlideMeasureContext() {
        if (mapSlideMeasureCtx !== null) return mapSlideMeasureCtx;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 16;
          canvas.height = 16;
          mapSlideMeasureCtx = canvas.getContext('2d') || false;
        } catch (error) {
          mapSlideMeasureCtx = false;
        }
        return mapSlideMeasureCtx;
      }

      function mapSlideFont(size, weight, italic, family) {
        return { size: Math.max(1, Number(size) || 1), weight: Number(weight) || 400, italic: !!italic, family: family || 'Arial, sans-serif' };
      }

      function mapSlideFontCss(font) {
        return `${font.italic ? 'italic ' : ''}${font.weight} ${Math.max(1, Math.round(font.size))}px ${font.family}`;
      }

      /* Canvas measureText and the SVG renderer share one font engine, so a width
         measured here is the width that will be painted. The cache matters: a dense
         slide asks for a few thousand measurements and setting ctx.font is the
         expensive half of each one. */
      function mapSlideTextWidth(text, font) {
        const value = String(text == null ? '' : text);
        if (!value) return 0;
        const css = mapSlideFontCss(font);
        const key = `${css}\u0000${value}`;
        const cached = mapSlideWidthCache.get(key);
        if (cached !== undefined) return cached;
        const ctx = mapSlideMeasureContext();
        let width;
        if (ctx) {
          ctx.font = css;
          const metrics = ctx.measureText(value);
          width = metrics && Number.isFinite(metrics.width) ? metrics.width : value.length * font.size * 0.52;
        } else {
          width = value.length * font.size * 0.52;
        }
        if (mapSlideWidthCache.size > 8000) mapSlideWidthCache.clear();
        mapSlideWidthCache.set(key, width);
        return width;
      }

      function mapSlideRunStyleEquals(a, b) {
        return !!a && !!b && a.bold === b.bold && a.italic === b.italic && a.underline === b.underline;
      }

      function mapSlideMergeRuns(tokens) {
        const runs = [];
        tokens.forEach(token => {
          const last = runs[runs.length - 1];
          if (mapSlideRunStyleEquals(last, token)) last.text += token.text;
          else runs.push({ text: token.text, bold: !!token.bold, italic: !!token.italic, underline: !!token.underline });
        });
        return runs;
      }

      /* A single word longer than the column — a URL, a GUID, a German compound —
         is broken by character rather than allowed to run off the slide. */
      function mapSlideBreakWord(token, limit, font) {
        const pieces = [];
        let buffer = '';
        Array.from(String(token.text || '')).forEach(character => {
          const next = buffer + character;
          if (buffer && mapSlideTextWidth(next, font) > limit) {
            pieces.push({ text: buffer, space: false, bold: token.bold, italic: token.italic, underline: token.underline });
            buffer = character;
          } else {
            buffer = next;
          }
        });
        if (buffer) pieces.push({ text: buffer, space: false, bold: token.bold, italic: token.italic, underline: token.underline });
        return pieces.length ? pieces : [token];
      }

      /* THE WRAPPER. SVG has no line box: text does not wrap, it runs straight off
         the edge of the picture. Given styled runs it returns an array of lines,
         each line an array of runs, so a line that starts bold and ends roman comes
         back as two runs and paints as two <tspan>s. */
      function mapSlideWrapRuns(runs, maxWidth, size, family, baseWeight) {
        const limit = Math.max(48, Number(maxWidth) || 0);
        const tokens = [];
        (Array.isArray(runs) ? runs : []).forEach(run => {
          const text = String(run && run.text != null ? run.text : '');
          if (!text) return;
          text.split(/(\s+)/).forEach(part => {
            if (!part) return;
            const isSpace = /^\s+$/.test(part);
            tokens.push({
              text: isSpace ? ' ' : part,
              space: isSpace,
              bold: !!(run && run.bold),
              italic: !!(run && run.italic),
              underline: !!(run && run.underline)
            });
          });
        });
        if (!tokens.length) return [];
        const fontFor = token => mapSlideFont(size, token.bold ? 700 : baseWeight, token.italic, family);
        const lines = [];
        let line = [];
        let width = 0;
        const flush = () => {
          while (line.length && line[line.length - 1].space) line.pop();
          if (line.length) lines.push(mapSlideMergeRuns(line));
          line = [];
          width = 0;
        };
        tokens.forEach(token => {
          if (token.space) {
            if (!line.length) return;
            line.push(token);
            width += mapSlideTextWidth(' ', fontFor(token));
            return;
          }
          const font = fontFor(token);
          const pieces = mapSlideTextWidth(token.text, font) > limit ? mapSlideBreakWord(token, limit, font) : [token];
          pieces.forEach(piece => {
            const pieceWidth = mapSlideTextWidth(piece.text, fontFor(piece));
            if (line.length && width + pieceWidth > limit) flush();
            line.push(piece);
            width += pieceWidth;
          });
        });
        flush();
        return lines;
      }

      /* One wrapped line becomes one <text>. Mixed styling becomes <tspan>s inside
         it, and then xml:space="preserve" is mandatory: without it the SVG renderer
         collapses the trailing space of one span and words weld together. The single
         run case skips the spans entirely, which is most lines. */
      function mapSlideLineSvg(runs, x, y, size, family, baseWeight, fill, opacity, anchor) {
        const list = (Array.isArray(runs) ? runs : []).filter(run => run && String(run.text || '').length);
        if (!list.length) return '';
        let attrs = `x="${mapSlideNum(x)}" y="${mapSlideNum(y)}" fill="${mapEscapeXml(fill)}"`
          + ` font-family="${mapEscapeXml(family)}" font-size="${mapSlideNum(size)}"`;
        if (opacity != null && Number(opacity) < 1) attrs += ` opacity="${mapSlideNum(opacity)}"`;
        if (anchor) attrs += ` text-anchor="${mapEscapeXml(anchor)}"`;
        const decorate = run => (run.italic ? ' font-style="italic"' : '') + (run.underline ? ' text-decoration="underline"' : '');
        if (list.length === 1) {
          const run = list[0];
          return `<text ${attrs} font-weight="${run.bold ? 700 : baseWeight}"${decorate(run)}>${mapEscapeXml(run.text)}</text>`;
        }
        const spans = list.map(run =>
          `<tspan font-weight="${run.bold ? 700 : baseWeight}"${decorate(run)}>${mapEscapeXml(run.text)}</tspan>`).join('');
        return `<text ${attrs} font-weight="${baseWeight}" xml:space="preserve">${spans}</text>`;
      }

      function mapSlidePlainLineSvg(text, x, y, size, family, weight, fill, opacity, anchor) {
        return mapSlideLineSvg([{ text: String(text == null ? '' : text) }], x, y, size, family, weight, fill, opacity, anchor);
      }

      /* ---------------- sanitised HTML → flow items ---------------- */

      /* `card.html` has already been through sanitizeWorkpaperHtml, so the only tags
         that can be here are B I U EM STRONG BR P DIV UL OL LI SPAN H1 H2 H3, with
         every attribute stripped. This turns that into a flat list of laid-out-able
         items: {type:'h'|'p'|'li', level, ordered, index, depth, runs:[...]}. */
      function mapSlideFlowFromHtml(html) {
        const items = [];
        const source = String(html || '');
        if (!source.trim()) return items;
        let root = null;
        try {
          const parsed = new DOMParser().parseFromString(`<div>${source}</div>`, 'text/html');
          root = parsed && parsed.body ? parsed.body.firstElementChild : null;
        } catch (error) { root = null; }
        if (!root) return items;

        let current = null;
        const open = (type, extra) => {
          current = Object.assign({ type: type, level: 2, ordered: false, index: 0, depth: 0, runs: [] }, extra || {});
          items.push(current);
          return current;
        };
        const ensure = () => current || open('p');
        const addText = (value, style) => {
          const text = String(value == null ? '' : value).replace(/\s+/g, ' ');
          if (!text) return;
          const item = ensure();
          if (!item.runs.length && text === ' ') return;
          const last = item.runs[item.runs.length - 1];
          if (mapSlideRunStyleEquals(last, style)) last.text += text;
          else item.runs.push({ text: text, bold: !!style.bold, italic: !!style.italic, underline: !!style.underline });
        };
        const restyle = (style, patch) => Object.assign({ bold: false, italic: false, underline: false }, style, patch);

        const walk = (node, style, list) => {
          Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === 3) { addText(child.nodeValue, style); return; }
            if (child.nodeType !== 1) return;
            const tag = String(child.tagName || '').toUpperCase();
            if (tag === 'BR') { current = null; open('p', { tight: true }); return; }
            if (tag === 'B' || tag === 'STRONG') { walk(child, restyle(style, { bold: true }), list); return; }
            if (tag === 'I' || tag === 'EM') { walk(child, restyle(style, { italic: true }), list); return; }
            if (tag === 'U') { walk(child, restyle(style, { underline: true }), list); return; }
            if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
              current = null;
              open('h', { level: Number(tag.slice(1)) || 2 });
              walk(child, restyle(style, {}), null);
              current = null;
              return;
            }
            if (tag === 'UL' || tag === 'OL') {
              current = null;
              walk(child, style, { ordered: tag === 'OL', index: 0, depth: list ? Number(list.depth || 0) + 1 : 0 });
              current = null;
              return;
            }
            if (tag === 'LI') {
              const context = list || { ordered: false, index: 0, depth: 0 };
              context.index = Number(context.index || 0) + 1;
              current = null;
              open('li', { ordered: !!context.ordered, index: context.index, depth: Number(context.depth || 0) });
              walk(child, style, context);
              current = null;
              return;
            }
            if (tag === 'P' || tag === 'DIV') {
              current = null;
              walk(child, style, list);
              current = null;
              return;
            }
            walk(child, style, list);
          });
        };
        walk(root, { bold: false, italic: false, underline: false }, null);

        return items.filter(item => {
          item.runs = item.runs.filter(run => String(run.text || '').length);
          if (item.runs.length) {
            item.runs[0].text = item.runs[0].text.replace(/^\s+/, '');
            const last = item.runs[item.runs.length - 1];
            last.text = last.text.replace(/\s+$/, '');
          }
          return item.runs.some(run => String(run.text || '').trim().length);
        });
      }

      function mapSlideFlowFromPlain(text) {
        return String(text || '')
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const bullet = /^([-*•·])\s+(.*)$/.exec(line);
            if (bullet) return { type: 'li', ordered: false, index: 0, depth: 0, runs: [{ text: bullet[2] }] };
            const numbered = /^(\d{1,3})[.)]\s+(.*)$/.exec(line);
            if (numbered) return { type: 'li', ordered: true, index: Number(numbered[1]), depth: 0, runs: [{ text: numbered[2] }] };
            return { type: 'p', runs: [{ text: line }] };
          });
      }

      function mapSlideFactsRows(card) {
        const diagram = (state.diagrams || []).find(entry => entry.id === card.diagramId);
        const metadata = (diagram && diagram.nodeMetadata) || {};
        const rows = [['Fact', 'Value']];
        (card.nodeIds || []).forEach(nodeId => {
          const facts = metadata[nodeId];
          if (!facts) return;
          MAP_FACT_FIELDS.forEach(pair => {
            const value = String(facts[pair[0]] || '').trim();
            if (value) rows.push([pair[1], value]);
          });
        });
        if (rows.length === 1) rows.push(['—', 'No block facts recorded yet.']);
        return rows;
      }

      function mapSlideDocFlow(card) {
        const items = [];
        const doc = (state.workpapers || []).find(entry => entry.id === card.docId);
        if (!doc || !Array.isArray(doc.blocks)) return items;
        const blocks = card.blockIds && card.blockIds.length
          ? doc.blocks.filter(block => block && card.blockIds.includes(block.id))
          : doc.blocks.slice(0, 4);
        blocks.forEach(block => {
          if (!block) return;
          if (block.kind === 'heading') {
            items.push({ type: 'h', level: clamp(Number(block.level) || 2, 1, 3), runs: [{ text: String(block.text || '') }] });
            return;
          }
          if (block.kind === 'text') {
            mapSlideFlowFromHtml(block.html).forEach(item => items.push(item));
            return;
          }
          if (block.kind === 'table') {
            items.push({ type: 'table', rows: Array.isArray(block.rows) ? block.rows : [], headerRow: block.headerRow !== false });
            return;
          }
          mapSlideFlowFromPlain(workpaperBlockDigest(block)).forEach(item => items.push(item));
        });
        return items;
      }

      /* The body of EVERY kind is the one rich field, and then the kind adds its own
         flow payload after it (table, facts grid, workpaper extract) or its own box
         payload below it (image, file, embed — handled in mapCardSlideSvg). */
      function mapSlideCardFlow(card) {
        const items = String(card.html || '').trim()
          ? mapSlideFlowFromHtml(card.html)
          : mapSlideFlowFromPlain(card.body);
        if (card.kind === 'table') {
          const rows = Array.isArray(card.rows) ? card.rows : [];
          if (rows.length) items.push({ type: 'table', rows: rows, headerRow: card.headerRow !== false });
        } else if (card.kind === 'facts') {
          items.push({ type: 'table', rows: mapSlideFactsRows(card), headerRow: true });
        } else if (card.kind === 'doc') {
          mapSlideDocFlow(card).forEach(item => items.push(item));
        }
        return items;
      }

      /* ---------------- the table, drawn as ruled rows ---------------- */

      function mapSlideRenderTable(rows, headerRow, box, palette, scale) {
        const grid = (Array.isArray(rows) ? rows : [])
          .map(row => (Array.isArray(row) ? row : [row]).map(cell => String(cell == null ? '' : cell)));
        if (!grid.length || box.h < 60) return { svg: '', height: 0, cut: grid.length };
        const hasHeader = headerRow !== false;
        const columns = clamp(grid.reduce((max, row) => Math.max(max, row.length), 1), 1, 12);
        const size = Math.max(20, 32 * scale);
        const padX = 22 * scale;
        const padY = 16 * scale;
        const lineStep = size * 1.3;
        const bodyFont = mapSlideFont(size, 400, false, palette.family);
        const headFont = mapSlideFont(size, 700, false, palette.family);
        const minWidth = Math.min(150, box.w / columns);

        /* Column widths are proportional to the widest cell in the column, but a
           single essay column is capped at 62% so it cannot squeeze the rest to
           nothing. After the minimum is applied the set is renormalised, so the
           table always finishes exactly at the right margin. */
        const weights = [];
        for (let column = 0; column < columns; column += 1) {
          let widest = minWidth;
          grid.forEach((row, index) => {
            const font = hasHeader && index === 0 ? headFont : bodyFont;
            const natural = mapSlideTextWidth(row[column] || '', font) + padX * 2;
            widest = Math.max(widest, Math.min(natural, box.w * 0.62));
          });
          weights.push(widest);
        }
        const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
        let widths = weights.map(value => Math.max(minWidth, (value / weightTotal) * box.w));
        const widthTotal = widths.reduce((sum, value) => sum + value, 0) || 1;
        widths = widths.map(value => (value / widthTotal) * box.w);

        const parts = [];
        let y = box.y;
        let drawn = 0;
        const bottom = box.y + box.h;
        const reserve = size * 1.6;

        for (let index = 0; index < grid.length; index += 1) {
          const isHeader = hasHeader && index === 0;
          const font = isHeader ? headFont : bodyFont;
          const weight = isHeader ? 700 : 400;
          const cells = [];
          let tallest = 1;
          for (let column = 0; column < columns; column += 1) {
            const lines = mapSlideWrapRuns([{ text: grid[index][column] || '' }], widths[column] - padX * 2, size, palette.family, weight);
            const capped = lines.slice(0, 4);
            if (lines.length > capped.length && capped.length) {
              const last = capped[capped.length - 1];
              last[last.length - 1] = { text: `${last[last.length - 1].text}…`, bold: last[last.length - 1].bold, italic: last[last.length - 1].italic, underline: last[last.length - 1].underline };
            }
            cells.push(capped);
            tallest = Math.max(tallest, capped.length || 1);
          }
          const rowHeight = tallest * lineStep + padY * 2;
          const remaining = grid.length - index;
          if (y + rowHeight > bottom - (remaining > 1 ? reserve : 0)) break;

          if (isHeader) {
            parts.push(`<rect x="${mapSlideNum(box.x)}" y="${mapSlideNum(y)}" width="${mapSlideNum(box.w)}" height="${mapSlideNum(rowHeight)}" fill="${mapEscapeXml(palette.accent)}" opacity="0.08"/>`);
          } else if (index % 2 === (hasHeader ? 0 : 1)) {
            parts.push(`<rect x="${mapSlideNum(box.x)}" y="${mapSlideNum(y)}" width="${mapSlideNum(box.w)}" height="${mapSlideNum(rowHeight)}" fill="${mapEscapeXml(palette.border)}" opacity="0.14"/>`);
          }

          let cellX = box.x;
          for (let column = 0; column < columns; column += 1) {
            const lines = cells[column];
            const blockHeight = (lines.length || 1) * lineStep;
            let baseline = y + padY + (rowHeight - padY * 2 - blockHeight) / 2 + size * 0.82;
            lines.forEach(line => {
              parts.push(mapSlideLineSvg(line, cellX + padX, baseline, size, palette.family, weight,
                isHeader ? palette.muted : palette.fg, isHeader ? 1 : 0.94, null));
              baseline += lineStep;
            });
            cellX += widths[column];
          }

          y += rowHeight;
          if (isHeader) {
            parts.push(`<rect x="${mapSlideNum(box.x)}" y="${mapSlideNum(y - 1.5)}" width="${mapSlideNum(box.w)}" height="3" fill="${mapEscapeXml(palette.accent)}"/>`);
          } else if (index < grid.length - 1) {
            parts.push(`<rect x="${mapSlideNum(box.x)}" y="${mapSlideNum(y - 0.5)}" width="${mapSlideNum(box.w)}" height="1" fill="${mapEscapeXml(palette.border)}" opacity="0.7"/>`);
          }
          drawn += 1;
        }

        const cut = grid.length - drawn;
        if (cut > 0 && drawn > 0) {
          const label = `+${cut} more row${cut === 1 ? '' : 's'} — the full table is on the card`;
          parts.push(mapSlidePlainLineSvg(label, box.x, y + size * 1.1, size * 0.86, palette.family, 600, palette.muted, 0.9, null));
          y += size * 1.6;
        }
        return { svg: parts.join(''), height: drawn ? y - box.y : 0, cut: cut };
      }

      /* ---------------- the flow renderer ---------------- */

      function mapSlideRenderFlow(items, box, palette, scale, centred) {
        const parts = [];
        const list = Array.isArray(items) ? items : [];
        const bottom = box.y + box.h;
        let y = box.y;
        let stopped = false;
        let truncated = false;
        if (box.h < 40 || !list.length) return { svg: '', endY: box.y, truncated: !!list.length };

        for (let index = 0; index < list.length; index += 1) {
          const item = list[index];
          if (stopped) { truncated = true; break; }

          if (item.type === 'table') {
            const top = y + (index === 0 ? 0 : 18 * scale);
            const drawnTable = mapSlideRenderTable(item.rows, item.headerRow, { x: box.x, y: top, w: box.w, h: bottom - top }, palette, scale);
            if (!drawnTable.height) { truncated = true; stopped = true; break; }
            parts.push(drawnTable.svg);
            y = top + drawnTable.height + 26 * scale;
            continue;
          }

          const key = item.type === 'h' ? `h${clamp(Number(item.level) || 2, 1, 3)}` : (MAP_SLIDE_TEXT[item.type] ? item.type : 'p');
          const spec = MAP_SLIDE_TEXT[key];
          const size = spec.size * scale;
          const lineStep = size * MAP_SLIDE.lineHeight;
          const isItem = item.type === 'li';
          const depth = clamp(Number(item.depth) || 0, 0, 4);
          const indent = isItem ? (52 + depth * 48) * scale : 0;
          const lines = mapSlideWrapRuns(item.runs, box.w - indent, size, palette.family, spec.weight);
          if (!lines.length) continue;

          const gapBefore = index === 0 ? 0 : (item.tight ? 0 : spec.gapBefore * scale);
          let baseline = y + gapBefore + size * 0.82;
          if (baseline + (lineStep - size * 0.82) > bottom) { truncated = true; break; }

          if (isItem) {
            const marker = item.ordered ? `${Math.max(1, Number(item.index) || 1)}.` : '•';
            parts.push(mapSlidePlainLineSvg(marker, box.x + (depth * 48) * scale, baseline, size, palette.family,
              item.ordered ? 600 : 700, item.ordered ? palette.muted : palette.accent, 1, null));
          }

          for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
            if (baseline > bottom) { truncated = true; stopped = true; break; }
            const anchor = centred && !isItem ? 'middle' : null;
            const x = anchor ? box.x + box.w / 2 : box.x + indent;
            parts.push(mapSlideLineSvg(lines[lineIndex], x, baseline, size, palette.family, spec.weight,
              item.type === 'h' ? palette.fg : palette.fg, item.type === 'h' ? 1 : 0.92, anchor));
            baseline += lineStep;
          }

          y = baseline - lineStep + (lineStep - size * 0.82) + spec.gapAfter * scale;
          if (y > bottom) { stopped = true; }
        }

        if (truncated) {
          const size = 30 * scale;
          const noteY = Math.min(bottom, y + size * 1.2);
          parts.push(mapSlidePlainLineSvg('… more on this card than fits one slide', box.x, noteY, size, palette.family, 600, palette.muted, 0.85, null));
          y = noteY + size * 0.4;
        }
        return { svg: parts.join(''), endY: Math.min(y, bottom), truncated: truncated };
      }

      /* ---------------- box payloads: image, file, embed ---------------- */

      function mapSlideRoundRect(x, y, w, h, r, fill, opacity, stroke, strokeWidth) {
        let attrs = `x="${mapSlideNum(x)}" y="${mapSlideNum(y)}" width="${mapSlideNum(Math.max(0, w))}" height="${mapSlideNum(Math.max(0, h))}" rx="${mapSlideNum(r)}" ry="${mapSlideNum(r)}"`;
        attrs += ` fill="${fill ? mapEscapeXml(fill) : 'none'}"`;
        if (opacity != null && Number(opacity) < 1) attrs += ` opacity="${mapSlideNum(opacity)}"`;
        if (stroke) attrs += ` stroke="${mapEscapeXml(stroke)}" stroke-width="${mapSlideNum(strokeWidth || 1)}"`;
        return `<rect ${attrs}/>`;
      }

      /* When the bytes are gone — the asset was evicted, or the .siren was hand-edited
         — the slide still renders, and it says so instead of showing a hole. */
      function mapSlideMissingPlate(box, palette, headline, detail) {
        const parts = [];
        parts.push(mapSlideRoundRect(box.x, box.y, box.w, box.h, 20, palette.border, 0.22, palette.border, 2));
        const centreX = box.x + box.w / 2;
        const centreY = box.y + box.h / 2;
        parts.push(mapSlidePlainLineSvg(headline, centreX, centreY - 6, 42, palette.family, 700, palette.muted, 1, 'middle'));
        if (detail) parts.push(mapSlidePlainLineSvg(detail, centreX, centreY + 50, 32, palette.family, 400, palette.muted, 0.85, 'middle'));
        return parts.join('');
      }

      /* IMAGE. A data: href is exactly what sanitizeSvgForRaster keeps and exactly
         what leaves the export canvas untainted, so this is the one payload that
         rasterises as itself rather than as something drawn to stand in for it. */
      function mapSlideRenderImage(card, box, palette) {
        const asset = mapSlideAsset(card.assetId);
        const href = mapSlideAssetHref(asset);
        if (!href) {
          return mapSlideMissingPlate(box, palette, 'Picture not stored in this file',
            String((asset && asset.name) || card.url || 'Re-import the image on the card.'));
        }
        const naturalW = Number(asset && asset.w) || 0;
        const naturalH = Number(asset && asset.h) || 0;
        const parts = [];
        if (card.fit === 'cover' || !naturalW || !naturalH) {
          mapSlideClipSeq += 1;
          const clipId = `mapSlideClip${mapSlideClipSeq}`;
          parts.push(`<defs><clipPath id="${clipId}">`
            + mapSlideRoundRect(box.x, box.y, box.w, box.h, 18, '#000000', 1, null, 0)
            + `</clipPath></defs>`);
          parts.push(`<image x="${mapSlideNum(box.x)}" y="${mapSlideNum(box.y)}" width="${mapSlideNum(box.w)}" height="${mapSlideNum(box.h)}"`
            + ` preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" href="${mapEscapeXml(href)}"/>`);
          parts.push(mapSlideRoundRect(box.x, box.y, box.w, box.h, 18, null, 1, palette.border, 2));
          return parts.join('');
        }
        const ratio = Math.min(box.w / naturalW, box.h / naturalH);
        const width = naturalW * ratio;
        const height = naturalH * ratio;
        const x = box.x + (box.w - width) / 2;
        const y = box.y + (box.h - height) / 2;
        parts.push(`<image x="${mapSlideNum(x)}" y="${mapSlideNum(y)}" width="${mapSlideNum(width)}" height="${mapSlideNum(height)}"`
          + ` preserveAspectRatio="xMidYMid meet" href="${mapEscapeXml(href)}"/>`);
        parts.push(mapSlideRoundRect(x, y, width, height, 14, null, 1, palette.border, 2));
        return parts.join('');
      }

      /* FILE. There is no download button on a rasterised slide, so the plate says
         what the attachment is and where it actually lives. */
      function mapSlideRenderFile(card, box, palette) {
        const asset = mapSlideAsset(card.assetId);
        const label = mapSlideFileLabel(asset, card);
        const plateH = Math.min(box.h, 300);
        const plateY = box.y + (box.h - plateH) / 2;
        const parts = [];
        parts.push(mapSlideRoundRect(box.x, plateY, box.w, plateH, 22, palette.border, 0.24, palette.border, 2));

        const glyphSize = Math.min(132, plateH - 88);
        const glyphX = box.x + 56;
        const glyphY = plateY + (plateH - glyphSize) / 2;
        const fold = glyphSize * 0.32;
        parts.push(`<path d="M ${mapSlideNum(glyphX)} ${mapSlideNum(glyphY + 10)}`
          + ` a 10 10 0 0 1 10 -10 L ${mapSlideNum(glyphX + glyphSize * 0.72 - fold)} ${mapSlideNum(glyphY)}`
          + ` L ${mapSlideNum(glyphX + glyphSize * 0.72)} ${mapSlideNum(glyphY + fold)}`
          + ` L ${mapSlideNum(glyphX + glyphSize * 0.72)} ${mapSlideNum(glyphY + glyphSize - 10)}`
          + ` a 10 10 0 0 1 -10 10 L ${mapSlideNum(glyphX + 10)} ${mapSlideNum(glyphY + glyphSize)}`
          + ` a 10 10 0 0 1 -10 -10 Z" fill="${mapEscapeXml(palette.accent)}" opacity="0.9"/>`);
        parts.push(`<path d="M ${mapSlideNum(glyphX + glyphSize * 0.72 - fold)} ${mapSlideNum(glyphY)}`
          + ` L ${mapSlideNum(glyphX + glyphSize * 0.72 - fold)} ${mapSlideNum(glyphY + fold)}`
          + ` L ${mapSlideNum(glyphX + glyphSize * 0.72)} ${mapSlideNum(glyphY + fold)} Z"`
          + ` fill="${mapEscapeXml(palette.bg)}" opacity="0.85"/>`);

        const textX = glyphX + glyphSize * 0.72 + 52;
        const textWidth = box.x + box.w - 56 - textX;
        const nameLines = mapSlideWrapRuns([{ text: label.name }], textWidth, 46, palette.family, 700).slice(0, 2);
        let baseline = plateY + plateH / 2 - (nameLines.length > 1 ? 30 : 6);
        nameLines.forEach(line => {
          parts.push(mapSlideLineSvg(line, textX, baseline, 46, palette.family, 700, palette.fg, 1, null));
          baseline += 56;
        });
        parts.push(mapSlidePlainLineSvg(label.meta, textX, baseline + 6, 32, palette.family, 600, palette.accent, 1, null));
        parts.push(mapSlidePlainLineSvg('Attached inside the SIREN file — ask the presenter for a copy.',
          textX, baseline + 52, 28, palette.family, 400, palette.muted, 0.9, null));
        return parts.join('');
      }

      function mapSlideEmbedDisplayUrl(card) {
        const url = String(card.url || '').trim();
        if (url) return url.replace(/^https?:\/\//i, '').slice(0, 120);
        const id = String(card.embedId || '').trim();
        if (id) return `youtube.com/watch?v=${id}`;
        return 'no link set';
      }

      /* EMBED. An <iframe> cannot rasterise, and it would not be there anyway on a
         projector with no network. The slide is always the poster: the still if one
         was pasted, the play mark, and the link spelled out so anyone can type it. */
      function mapSlideRenderEmbed(card, box, palette) {
        const parts = [];
        const posterW = Math.min(box.w, box.h * (16 / 9));
        const posterH = posterW * 9 / 16;
        const x = box.x + (box.w - posterW) / 2;
        const y = box.y;
        const asset = mapSlideAsset(card.assetId);
        const href = mapSlideAssetHref(asset);

        mapSlideClipSeq += 1;
        const clipId = `mapSlideClip${mapSlideClipSeq}`;
        parts.push(`<defs><clipPath id="${clipId}">`
          + mapSlideRoundRect(x, y, posterW, posterH, 20, '#000000', 1, null, 0)
          + `</clipPath></defs>`);
        parts.push(mapSlideRoundRect(x, y, posterW, posterH, 20, '#101418', 1, null, 0));
        if (href) {
          parts.push(`<image x="${mapSlideNum(x)}" y="${mapSlideNum(y)}" width="${mapSlideNum(posterW)}" height="${mapSlideNum(posterH)}"`
            + ` preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" href="${mapEscapeXml(href)}"/>`);
          parts.push(`<rect x="${mapSlideNum(x)}" y="${mapSlideNum(y)}" width="${mapSlideNum(posterW)}" height="${mapSlideNum(posterH)}" rx="20" ry="20" fill="#000000" opacity="0.34"/>`);
        }
        parts.push(mapSlideRoundRect(x, y, posterW, posterH, 20, null, 1, palette.border, 2));

        const centreX = x + posterW / 2;
        const centreY = y + posterH / 2 - (href ? 0 : 18);
        const radius = Math.min(78, posterH * 0.18);
        parts.push(`<circle cx="${mapSlideNum(centreX)}" cy="${mapSlideNum(centreY)}" r="${mapSlideNum(radius)}" fill="#ffffff" opacity="0.94"/>`);
        const triangle = radius * 0.52;
        parts.push(`<path d="M ${mapSlideNum(centreX - triangle * 0.45)} ${mapSlideNum(centreY - triangle)}`
          + ` L ${mapSlideNum(centreX + triangle * 0.95)} ${mapSlideNum(centreY)}`
          + ` L ${mapSlideNum(centreX - triangle * 0.45)} ${mapSlideNum(centreY + triangle)} Z" fill="#101418"/>`);

        const kindLabel = card.embedKind === 'youtube' ? 'YouTube video' : 'Web link';
        parts.push(mapSlidePlainLineSvg(kindLabel, centreX, centreY + radius + 54, 34, palette.family, 700,
          href ? '#ffffff' : palette.muted, href ? 0.95 : 1, 'middle'));

        const urlSize = 30;
        const urlLines = mapSlideWrapRuns([{ text: mapSlideEmbedDisplayUrl(card) }], posterW - 80, urlSize, palette.mono, 400).slice(0, 2);
        let baseline = y + posterH + 46;
        urlLines.forEach(line => {
          parts.push(mapSlideLineSvg(line, centreX, baseline, urlSize, palette.mono, 400, palette.accent, 1, 'middle'));
          baseline += urlSize * 1.3;
        });
        if (baseline + 34 < box.y + box.h) {
          parts.push(mapSlidePlainLineSvg('Plays in the browser when there is a connection — the deck itself stays offline.',
            centreX, baseline + 18, 26, palette.family, 400, palette.muted, 0.85, 'middle'));
        }
        return parts.join('');
      }

      /* ---------------- the header ---------------- */

      /* Display type is shrunk to fit rather than clipped: a 3-word title stays huge,
         a 14-word title steps down until it lands inside its three lines. */
      function mapSlideFitTitle(text, maxWidth, baseSize, maxLines, family) {
        let size = baseSize;
        let lines = mapSlideWrapRuns([{ text: text }], maxWidth, size, family, 800);
        let guard = 0;
        while (lines.length > maxLines && size > baseSize * 0.52 && guard < 10) {
          size *= 0.88;
          lines = mapSlideWrapRuns([{ text: text }], maxWidth, size, family, 800);
          guard += 1;
        }
        if (lines.length > maxLines) {
          lines = lines.slice(0, maxLines);
          const last = lines[lines.length - 1];
          const tail = last[last.length - 1];
          last[last.length - 1] = { text: `${tail.text}…`, bold: tail.bold, italic: tail.italic, underline: tail.underline };
        }
        return { lines: lines, size: size };
      }

      /* ---------------- the slide ---------------- */

      function mapCardSlideSvg(card, width, height) {
        const safe = card && typeof card === 'object' ? card : {};
        const palette = mapSlidePalette();
        const scale = mapSlideScale(safe);
        const kind = ['title', 'text', 'doc', 'facts', 'image', 'file', 'embed', 'table'].includes(safe.kind) ? safe.kind : 'title';
        const W = MAP_SLIDE.w;
        const H = MAP_SLIDE.h;
        const boxX = MAP_SLIDE.padX;
        const boxW = W - MAP_SLIDE.padX * 2;
        const centred = kind === 'title' && safe.align === 'centre';
        const anchorX = centred ? W / 2 : boxX;
        const body = [];

        /* header */
        let y = MAP_SLIDE.padTop;
        const eyebrow = String(safe.eyebrow || '').trim();
        const titleText = String(safe.title || '').trim();
        if (eyebrow) {
          const size = 38;
          y += size * 0.82;
          body.push(mapSlidePlainLineSvg(eyebrow.toUpperCase().slice(0, 90), anchorX, y, size, palette.family, 700,
            palette.accent, 1, centred ? 'middle' : null));
          y += size * 0.5 + 26;
        }
        if (titleText) {
          const baseSize = clamp((kind === 'title' ? 96 : 74) * (0.72 + scale * 0.28), 44, 128);
          const fitted = mapSlideFitTitle(titleText, boxW, baseSize, kind === 'title' ? 3 : 2, palette.family);
          let baseline = y + fitted.size * 0.80;
          fitted.lines.forEach(line => {
            body.push(mapSlideLineSvg(line, anchorX, baseline, fitted.size, palette.family, 800, palette.fg, 1, centred ? 'middle' : null));
            baseline += fitted.size * 1.14;
          });
          y = baseline - fitted.size * 1.14 + fitted.size * 0.32;
        }
        if (eyebrow || titleText) {
          const ruleW = 116;
          body.push(mapSlideRoundRect(centred ? W / 2 - ruleW / 2 : boxX, y + 22, ruleW, 6, 3, palette.accent, 1, null, 0));
          y += 22 + 6 + 34;
        }

        /* body flow, then the box payload if this kind has one */
        const footerText = String((state && state.projectName) || '').trim();
        const footerH = footerText ? 44 : 0;
        const contentTop = y;
        const contentBottom = H - MAP_SLIDE.padBottom - footerH;
        const boxKind = kind === 'image' || kind === 'file' || kind === 'embed';
        const payloadMin = kind === 'image' ? 420 : kind === 'embed' ? 460 : 300;
        const flowHeight = boxKind
          ? Math.max(0, contentBottom - contentTop - payloadMin - MAP_SLIDE.gap)
          : Math.max(0, contentBottom - contentTop);

        const flow = mapSlideRenderFlow(mapSlideCardFlow(safe), { x: boxX, y: contentTop, w: boxW, h: flowHeight }, palette, scale, centred);
        if (flow.svg) body.push(flow.svg);
        let endY = Math.max(contentTop, flow.endY);

        if (boxKind) {
          const top = flow.svg ? endY + MAP_SLIDE.gap : contentTop;
          const payload = { x: boxX, y: top, w: boxW, h: Math.max(200, contentBottom - top) };
          if (kind === 'image') body.push(mapSlideRenderImage(safe, payload, palette));
          else if (kind === 'file') body.push(mapSlideRenderFile(safe, payload, palette));
          else body.push(mapSlideRenderEmbed(safe, payload, palette));
          endY = contentBottom;
        }

        /* A title card is a title card: centre the whole stack rather than pinning it
           to the top of an otherwise empty slide. */
        let content = body.join('');
        if (kind === 'title') {
          const used = endY - MAP_SLIDE.padTop;
          const shift = Math.round((H - used) / 2 - MAP_SLIDE.padTop);
          if (Number.isFinite(shift) && Math.abs(shift) > 4) content = `<g transform="translate(0,${mapSlideNum(shift)})">${content}</g>`;
        }

        const chrome = [];
        chrome.push(`<rect width="${W}" height="${H}" fill="${mapEscapeXml(palette.bg)}"/>`);
        chrome.push(`<rect x="0" y="0" width="${W}" height="10" fill="${mapEscapeXml(palette.accent)}"/>`);
        if (footerText) {
          chrome.push(mapSlidePlainLineSvg(footerText.slice(0, 90), boxX, H - 48, 26, palette.family, 600, palette.muted, 0.7, null));
        }

        const outW = Math.max(1, Math.round(Number(width) || W));
        const outH = Math.max(1, Math.round(Number(height) || H));
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${W} ${H}">`
          + chrome.join('') + content + '</svg>';
      }

      /* ---------------- the plain-text mirror ---------------- */

      function mapSlideHtmlToText(html) {
        const source = String(html || '');
        if (!source.trim()) return '';
        let root = null;
        try {
          const parsed = new DOMParser().parseFromString(`<div>${source}</div>`, 'text/html');
          root = parsed && parsed.body ? parsed.body.firstElementChild : null;
        } catch (error) { root = null; }
        if (!root) return '';
        const out = [];
        const walk = (node, list) => {
          Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === 3) { out.push(String(child.nodeValue || '').replace(/\s+/g, ' ')); return; }
            if (child.nodeType !== 1) return;
            const tag = String(child.tagName || '').toUpperCase();
            if (tag === 'BR') { out.push('\n'); return; }
            if (tag === 'UL') { out.push('\n'); walk(child, { ordered: false, index: 0 }); out.push('\n'); return; }
            if (tag === 'OL') { out.push('\n'); walk(child, { ordered: true, index: 0 }); out.push('\n'); return; }
            if (tag === 'LI') {
              const context = list || { ordered: false, index: 0 };
              context.index = Number(context.index || 0) + 1;
              out.push(`\n${context.ordered ? `${context.index}. ` : '• '}`);
              walk(child, context);
              return;
            }
            if (tag === 'P' || tag === 'DIV' || tag === 'H1' || tag === 'H2' || tag === 'H3') {
              out.push('\n');
              walk(child, list);
              out.push('\n');
              return;
            }
            walk(child, list);
          });
        };
        walk(root, null);
        return out.join('')
          .replace(/[ \t]+/g, ' ')
          .replace(/ *\n */g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }

      /* The plain mirror is what the notes file, the route labels and any future
         search read. Every kind answers, including the ones whose real content is a
         picture — an auditor's notes should still say which picture. */
      function mapCardPlainBody(card) {
        const safe = card && typeof card === 'object' ? card : {};
        const parts = [];
        const rich = mapSlideHtmlToText(safe.html);
        if (rich) parts.push(rich);
        else if (String(safe.body || '').trim()) parts.push(String(safe.body).trim());

        if (safe.kind === 'facts') {
          const rows = mapSlideFactsRows(safe).slice(1);
          if (rows.length) parts.push(rows.map(row => `${row[0]}: ${row[1]}`).join('\n'));
        } else if (safe.kind === 'doc') {
          const doc = (state.workpapers || []).find(entry => entry.id === safe.docId);
          if (doc && Array.isArray(doc.blocks)) {
            const blocks = safe.blockIds && safe.blockIds.length
              ? doc.blocks.filter(block => block && safe.blockIds.includes(block.id))
              : doc.blocks.slice(0, 4);
            const digest = blocks.map(workpaperBlockDigest).filter(Boolean).join('\n');
            if (digest) parts.push(digest);
          }
        } else if (safe.kind === 'table') {
          const rows = Array.isArray(safe.rows) ? safe.rows : [];
          if (rows.length) parts.push(rows.map(row => (Array.isArray(row) ? row : [row]).join(' │ ')).join('\n'));
        } else if (safe.kind === 'image') {
          const asset = mapSlideAsset(safe.assetId);
          const name = String((asset && asset.name) || '').trim();
          parts.push(`[Image]${name ? ` ${name}` : ''}${asset && asset.w && asset.h ? ` (${asset.w}×${asset.h})` : ''}`.trim());
        } else if (safe.kind === 'file') {
          const asset = mapSlideAsset(safe.assetId);
          const label = mapSlideFileLabel(asset, safe);
          parts.push(`[File] ${label.name}${label.meta ? ` — ${label.meta}` : ''}`);
        } else if (safe.kind === 'embed') {
          parts.push(`[${safe.embedKind === 'youtube' ? 'Video' : 'Link'}] ${String(safe.url || safe.embedId || '').trim()}`.trim());
        }

        return parts.filter(Boolean).join('\n').slice(0, 8000);
      }'''

BLOCK_CSS = r'''    /* =====================================================================
       MAP CARDS — PART 1: THE PLANE STYLES
       =====================================================================

       Paste this block into the <style> element IMMEDIATELY AFTER the existing
       `.map-card` rules, which today end at line 9207 with

           .map-card th { color: var(--muted); font-weight: 700; width: 34%; }

       Order matters. Four rules below deliberately restate a selector the file
       already has, at the same specificity, so the later declaration wins:

         .map-card                 grid -> flex column, so one payload can flex
         .map-card .map-card-body  pre-wrap -> normal, because the body is now HTML
                                   that carries its own line structure
         .map-card th              width:34% -> auto for a real grid, kept at 34%
                                   for the label/value facts table
         .map-card-edit            opacity:0 -> .5, because a hover-only affordance
                                   is invisible on a projector

       SIZING. These cards live on a CSS-transformed plane, so every length is a
       plane pixel, not a screen pixel: the existing title is 86px and the existing
       table text is 34px. Every type size here is `calc(<plane px> * var(--card-scale))`
       where --card-scale is the card's own S/M/L/XL setting (0.85 / 1 / 1.2 / 1.45),
       written onto the host by mapBuildCard. One number per card, because
       sanitizeWorkpaperHtml strips every attribute from every element and per-run
       sizes are therefore impossible by construction.
       ===================================================================== */

    .map-card {
      --card-scale: 1;
      --card-title-px: 86px;
      --card-fit: contain;
      display: flex;
      flex-direction: column;
      gap: 22px;
      overflow: hidden;
    }
    /* A title card leads with the title. Every other kind leads with its payload,
       so the title steps back and the content reads first. */
    .map-card:not([data-kind="title"]) { --card-title-px: 64px; }
    .map-card > * { flex: 0 0 auto; min-width: 0; }
    .map-card[data-align="centre"] { justify-content: center; text-align: center; }

    .map-card .map-card-eyebrow { font-size: calc(34px * var(--card-scale)); }
    .map-card .map-card-title { font-size: calc(var(--card-title-px) * var(--card-scale)); }
    /* Room for the always-visible Edit chip in the top-right corner. A centred
       title card keeps its symmetry and simply lets the chip float over air. */
    .map-card:not([data-align="centre"]) > .map-card-eyebrow,
    .map-card:not([data-align="centre"]) > .map-card-title { padding-right: 210px; }

    /* ---- the one rich body, on every kind ---- */
    .map-card .map-card-body {
      font-size: calc(40px * var(--card-scale));
      line-height: 1.42;
      color: var(--muted);
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .map-card .map-card-body > :first-child { margin-top: 0; }
    .map-card .map-card-body > :last-child { margin-bottom: 0; }
    .map-card .map-card-body p,
    .map-card .map-card-body div { margin: 0 0 .48em; }
    .map-card .map-card-body b,
    .map-card .map-card-body strong { color: var(--text); font-weight: 800; }
    .map-card .map-card-body i,
    .map-card .map-card-body em { font-style: italic; }
    .map-card .map-card-body u { text-decoration-thickness: .055em; text-underline-offset: .2em; }
    .map-card .map-card-body h1,
    .map-card .map-card-body h2,
    .map-card .map-card-body h3 {
      color: var(--text);
      font-weight: 800;
      line-height: 1.14;
      margin: .42em 0 .2em;
    }
    .map-card .map-card-body h1 { font-size: calc(58px * var(--card-scale)); }
    .map-card .map-card-body h2 { font-size: calc(48px * var(--card-scale)); }
    .map-card .map-card-body h3 { font-size: calc(42px * var(--card-scale)); letter-spacing: .01em; }
    .map-card .map-card-body ul,
    .map-card .map-card-body ol { margin: .3em 0; padding-left: 1.45em; }
    .map-card .map-card-body li { margin-bottom: .3em; }
    /* The bullet is the accent, so a list reads as a list from the back of the
       room without the text having to shout. */
    .map-card .map-card-body li::marker { color: var(--primary); font-weight: 800; }
    .map-card .map-card-body ul ul,
    .map-card .map-card-body ol ol,
    .map-card .map-card-body ul ol,
    .map-card .map-card-body ol ul { margin: .22em 0; }
    /* Digests of prompt / settings / knowledge / test-run blocks arrive as plain
       text with meaningful line breaks. */
    .map-card .map-card-digest { white-space: pre-wrap; }

    /* ---- payload: tables (the table card, the facts card, tables inside a doc) ---- */
    .map-card .map-card-table { min-width: 0; overflow: hidden; }
    .map-card .map-card-table table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: calc(34px * var(--card-scale));
    }
    .map-card .map-card-table th,
    .map-card .map-card-table td {
      text-align: left;
      vertical-align: top;
      padding: calc(14px * var(--card-scale)) calc(18px * var(--card-scale));
      border-bottom: 2px solid var(--border);
      color: var(--text);
      overflow-wrap: anywhere;
    }
    /* An even grid: no column is privileged. */
    .map-card .map-card-table[data-variant="grid"] th {
      width: auto;
      color: var(--muted);
      font-weight: 800;
      letter-spacing: .02em;
    }
    /* A facts table is a label column and a value column, which is what the
       existing 34% rule was for. */
    .map-card .map-card-table[data-variant="facts"] th {
      width: 34%;
      color: var(--muted);
      font-weight: 700;
    }
    .map-card .map-card-table tr.is-head th { border-bottom: 3px solid var(--primary); }
    .map-card .map-card-table tr:last-child th,
    .map-card .map-card-table tr:last-child td { border-bottom: none; }

    .map-card .map-card-more {
      font-size: calc(30px * var(--card-scale));
      font-weight: 700;
      letter-spacing: .03em;
      color: var(--subtle);
      padding-top: calc(8px * var(--card-scale));
    }
    .map-card .map-card-empty {
      font-size: calc(34px * var(--card-scale));
      line-height: 1.4;
      color: var(--subtle);
      font-style: italic;
    }

    /* ---- payload: image ---- */
    .map-card .map-card-media {
      flex: 1 1 auto;
      min-height: 0;
      position: relative;
      display: grid;
      place-items: center;
      border-radius: 14px;
      overflow: hidden;
      background: var(--panel-alt);
    }
    .map-card .map-card-media[data-state="missing"] { border: 3px dashed var(--border-strong); }
    .map-card .map-card-media .map-card-empty { padding: calc(40px * var(--card-scale)); text-align: center; }
    .map-card .map-card-image {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: var(--card-fit, contain);
      opacity: 0;
      transition: opacity .22s ease;
    }
    /* The <img> src is only attached when the camera is near (mapUpdateCardDetail),
       so the frame has to look deliberate while it is empty rather than broken. */
    .map-card .map-card-media[data-state="ready"] .map-card-image,
    .map-card .map-card-poster[data-state="ready"] .map-card-image { opacity: 1; }
    .map-card .map-card-media[data-state="broken"]::after {
      content: 'This picture could not be shown.';
      position: absolute;
      font-size: calc(32px * var(--card-scale));
      font-style: italic;
      color: var(--subtle);
    }

    /* ---- payload: file ---- */
    .map-card .map-card-file {
      display: flex;
      align-items: center;
      gap: calc(28px * var(--card-scale));
      padding: calc(30px * var(--card-scale)) calc(34px * var(--card-scale));
      border: 3px solid var(--border);
      border-radius: 18px;
      background: var(--panel-alt);
    }
    .map-card .map-card-file-glyph {
      flex: 0 0 auto;
      width: calc(96px * var(--card-scale));
      height: calc(96px * var(--card-scale));
      color: var(--primary);
    }
    .map-card .map-card-file-text { flex: 1 1 auto; min-width: 0; display: grid; gap: calc(8px * var(--card-scale)); }
    .map-card .map-card-file-name {
      font-size: calc(44px * var(--card-scale));
      font-weight: 800;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .map-card .map-card-file-meta {
      font-size: calc(32px * var(--card-scale));
      font-weight: 700;
      letter-spacing: .06em;
      color: var(--muted);
    }
    .map-card .map-card-action {
      flex: 0 0 auto;
      font: inherit;
      font-size: calc(34px * var(--card-scale));
      font-weight: 800;
      padding: calc(18px * var(--card-scale)) calc(36px * var(--card-scale));
      border: none;
      border-radius: 999px;
      background: var(--primary);
      color: var(--primary-text);
      cursor: pointer;
    }
    .map-card .map-card-action:hover { filter: brightness(1.08); }
    .map-card .map-card-action:focus-visible { outline: 5px solid var(--text); outline-offset: 4px; }

    /* ---- payload: embed ----
       A poster, never a live iframe: an iframe inside a transformed plane repaints
       on every camera frame, and the plane has to keep working with no network.
       The still, when there is one, is a stored asset — img-src on this page is
       `data: blob:` only, so a remote thumbnail would be blocked even online. */
    .map-card .map-card-poster {
      flex: 0 1 auto;
      width: 100%;
      max-height: 100%;
      aspect-ratio: 16 / 9;
      position: relative;
      display: grid;
      place-items: center;
      border-radius: 18px;
      overflow: hidden;
      background: linear-gradient(148deg, color-mix(in srgb, var(--primary) 26%, var(--panel-alt)) 0%, var(--panel-alt) 66%);
    }
    .map-card .map-card-poster .map-card-image { position: absolute; inset: 0; object-fit: cover; }
    .map-card .map-card-play {
      position: relative;
      width: calc(168px * var(--card-scale));
      height: calc(168px * var(--card-scale));
      filter: drop-shadow(0 10px 30px rgba(0, 0, 0, .35));
    }
    .map-card .map-card-play-disc { fill: color-mix(in srgb, var(--text) 74%, transparent); }
    .map-card .map-card-poster[data-embed="youtube"] .map-card-play-disc { fill: #e62117; }
    .map-card .map-card-play-tri { fill: #ffffff; }
    .map-card .map-card-play-arrow { fill: none; stroke: #ffffff; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
    .map-card .map-card-poster-caption {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: grid;
      gap: calc(8px * var(--card-scale));
      padding: calc(30px * var(--card-scale)) calc(34px * var(--card-scale));
      background: linear-gradient(to top, rgba(0, 0, 0, .78), rgba(0, 0, 0, .34) 58%, rgba(0, 0, 0, 0));
    }
    .map-card .map-card-poster-host {
      font-size: calc(30px * var(--card-scale));
      font-weight: 800;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, .88);
    }
    .map-card .map-card-poster-url {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: calc(28px * var(--card-scale));
      color: #ffffff;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ---- payload: doc ---- */
    .map-card .map-card-doc { display: flex; flex-direction: column; gap: calc(20px * var(--card-scale)); min-width: 0; }
    .map-card .map-card-h { color: var(--text); font-weight: 800; line-height: 1.14; }
    .map-card .map-card-h[data-level="1"] { font-size: calc(58px * var(--card-scale)); }
    .map-card .map-card-h[data-level="2"] { font-size: calc(48px * var(--card-scale)); }
    .map-card .map-card-h[data-level="3"] { font-size: calc(42px * var(--card-scale)); letter-spacing: .01em; }
    .map-card .map-card-checks {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: calc(10px * var(--card-scale));
      font-size: calc(36px * var(--card-scale));
      color: var(--text);
    }
    .map-card .map-card-checks li[data-done="yes"] { color: var(--muted); }

    /* ---- the way in ----
       Always drawn, brighter on hover. A card is also focusable, so Enter or F2
       opens the editor without a mouse. */
    .map-card-edit { opacity: .5; }
    .map-card:focus-visible {
      outline: 6px solid var(--primary);
      outline-offset: 5px;
    }
    .map-card:focus-visible .map-card-edit { opacity: 1; }

    /* ---- the card editor dialog (wave 2 content slides) ---- */
    .card-editor { width: min(1230px, calc(100vw - 32px)); max-height: min(92dvh, 900px); }
    .card-editor-body { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: 172px minmax(0, 1fr) 348px; }
    .card-kind-rail {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 14px 10px;
      border-right: 1px solid var(--ui-dialog-divider);
      background: var(--ui-dialog-section-bg);
      overflow-y: auto;
    }
    .card-kind-tile {
      display: grid;
      grid-template-columns: 26px 1fr;
      align-items: center;
      gap: 8px;
      padding: 9px 10px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: var(--text);
      font: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
    }
    .card-kind-tile:hover { background: var(--panel-alt); }
    .card-kind-tile.is-on { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 12%, transparent); font-weight: 700; }
    .card-kind-glyph { font-size: 15px; text-align: center; }
    .card-editor-middle { min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
    .card-kind-head { padding: 14px 18px 0; }
    .card-kind-title { margin: 0 0 2px; font-size: 15px; }
    .card-kind-hint { margin: 0; font-size: 12px; color: var(--muted); }
    .card-editor-pane {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      display: grid;
      gap: 14px;
      align-content: start;
      padding: 12px 18px 18px;
    }
    .card-editor-pane.is-busy { opacity: .55; pointer-events: none; }
    .card-payload { display: grid; gap: 12px; }
    .card-field { display: grid; gap: 6px; }
    .card-field-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
    .card-field-hint { margin: 0; font-size: 12px; color: var(--muted); }
    .card-input {
      width: 100%;
      font: inherit;
      font-size: 13.5px;
      color: var(--text);
      background: var(--panel-alt);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 10px;
    }
    .card-input:focus { outline: none; border-color: var(--primary); }
    .card-seg {
      display: inline-flex;
      gap: 4px;
      padding: 3px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--panel-alt);
      width: fit-content;
    }
    .card-seg-button {
      font: inherit;
      font-size: 12px;
      padding: 5px 12px;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
    }
    .card-seg-button.is-on { background: var(--primary); color: var(--primary-text); font-weight: 700; }
    .card-check { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .card-well {
      display: grid;
      justify-items: center;
      gap: 6px;
      padding: 26px 18px;
      border: 2px dashed var(--border-strong);
      border-radius: 12px;
      background: var(--panel-alt);
      color: var(--text);
      font: inherit;
      cursor: pointer;
    }
    .card-well:hover, .card-well.is-over { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, var(--panel-alt)); }
    .card-well-glyph { font-size: 22px; }
    .card-well-title { font-size: 13.5px; font-weight: 700; }
    .card-well-hint { font-size: 12px; color: var(--muted); max-width: 430px; text-align: center; }
    .card-asset {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--panel-alt);
    }
    .card-asset-thumb { width: 84px; height: 56px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); }
    .card-asset-facts { flex: 1 1 auto; min-width: 0; display: grid; gap: 2px; font-size: 12.5px; }
    .card-asset-facts strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-asset-facts span { color: var(--muted); font-size: 11.5px; }
    .card-asset-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .card-picklist {
      display: grid;
      gap: 2px;
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 6px;
      background: var(--panel-alt);
    }
    .card-picklist-row { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; padding: 4px 6px; border-radius: 6px; cursor: pointer; }
    .card-picklist-row:hover { background: color-mix(in srgb, var(--primary) 8%, transparent); }
    .card-rt-toolbar {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      padding: 4px;
      border: 1px solid var(--border);
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      background: var(--panel-alt);
    }
    .card-rt-button {
      min-width: 28px;
      padding: 4px 8px;
      font: inherit;
      font-size: 12px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      color: var(--text);
      cursor: pointer;
    }
    .card-rt-button:hover { background: color-mix(in srgb, var(--primary) 12%, transparent); }
    .card-rt-button.is-bold { font-weight: 800; }
    .card-rt-button.is-italic { font-style: italic; }
    .card-rt-button.is-underline { text-decoration: underline; }
    .card-body-editor { min-height: 130px; max-height: 260px; overflow-y: auto; border-radius: 0 0 8px 8px; }
    .card-body-editor.wp-text { border: 1px solid var(--border); background: var(--panel-bg); padding: 10px 12px; font-size: 13.5px; }
    .card-control-row { display: flex; gap: 18px; flex-wrap: wrap; }
    .card-inline-action { justify-self: start; width: fit-content; }
    .card-editor-side {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px 16px;
      border-left: 1px solid var(--ui-dialog-divider);
      background: var(--ui-dialog-section-bg);
      overflow-y: auto;
    }
    .card-preview-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
    .card-preview {
      aspect-ratio: 16 / 9;
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      background: var(--panel-alt);
      display: grid;
      place-items: center;
    }
    .card-preview img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .card-editor-footer .card-footer-spacer { flex: 1 1 auto; }
    .card-editor .wp-table-gutter { width: 26px; border: none; background: transparent; padding: 0 2px; vertical-align: middle; }
    .card-editor .wp-table-gutter-button {
      width: 20px;
      height: 20px;
      padding: 0;
      font: inherit;
      font-size: 12px;
      line-height: 1;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--panel-alt);
      color: var(--muted);
      cursor: pointer;
    }
    .card-editor .wp-table-gutter-button:hover { border-color: var(--primary); color: var(--primary); }
    .card-editor .wp-table-wrap { display: grid; gap: 8px; overflow-x: auto; }
    /* The preview column steps aside before the dialog ever crowds a laptop. */
    @media (max-width: 1100px) {
      .card-editor-body { grid-template-columns: 150px minmax(0, 1fr); }
      .card-editor-side { display: none; }
    }
    /* Plane: the open-in-browser affordance on a video card. */
    .map-card .map-card-open {
      position: absolute;
      right: 30px;
      top: 26px;
      font: inherit;
      font-size: calc(30px * var(--card-scale, 1));
      font-weight: 800;
      padding: calc(14px * var(--card-scale, 1)) calc(28px * var(--card-scale, 1));
      border: none;
      border-radius: 999px;
      background: var(--primary);
      color: var(--primary-text);
      cursor: pointer;
    }
    .map-card .map-card-open:hover { filter: brightness(1.08); }'''


def main():
    if len(sys.argv) != 2:
        die('usage: python fix_present_cards.py <target.html>')
    path = sys.argv[1]
    if not os.path.isfile(path):
        die('target does not exist: ' + path)
    if os.path.normcase(os.path.abspath(path)).endswith(os.path.normcase(os.path.join('downloads', 't_industries_siren_v1.html'))):
        die('refusing to patch the live file in Downloads — patch a copy')

    with io.open(path, 'r', encoding='utf-8') as handle:
        text = handle.read()

    # ---- preflight: right build, not already patched ----
    if 'function mapRenderThread' not in text:
        die('this build has no mapRenderThread — wave 1 is missing, wrong file?')
    for marker in ('MAP_ASSETS_KEY', 'mapCardEditor', 'MAP_CARD_KINDS', 'mapCardSlideEngine'):
        if marker in text:
            die('file already contains %r — already patched?' % marker)
    if "['title', 'text', 'doc', 'facts'].includes(card.kind)" not in text:
        die('sanitizeMapCard does not have its wave-1 shape')

    # ---- 1. the card record (sanitizeMapCard and helpers) ----
    text = replace_span(
        text,
        '      function sanitizeMapCard(raw) {',
        '      function sanitizeRouteView(raw) {',
        BLOCK_SANITIZER,
        'sanitizeMapCard',
        must_contain=("body: String(card.body || '').slice(0, 4000)",),
        max_len=4000)

    # ---- 2. the plane renderer (mapRenderCards … mapBuildDocBody) ----
    text = replace_span(
        text,
        '      function mapRenderCards() {',
        '      /* A new card is parked in the gutter',
        BLOCK_RENDERER,
        'mapRenderCards…mapBuildDocBody',
        must_contain=("host.classList.add('is-clipped')", 'MAP_FACT_FIELDS', 'function mapBuildDocBody'),
        max_len=12000)

    # ---- 3. the editor (replaces the window.prompt mapEditCard) ----
    text = replace_span(
        text,
        '      function mapEditCard(card) {',
        '      /* A card exists because a view points at it. When the last view referring to it',
        BLOCK_EDITOR,
        'mapEditCard',
        must_contain=("window.prompt('Card heading'",),
        max_len=3000)

    # ---- 4. pruning now sweeps the asset store ----
    text = replace_span(
        text,
        '      function mapPruneCards() {',
        '      function mapAddCard(kind, extra) {',
        BLOCK_PRUNE,
        'mapPruneCards',
        must_contain=('used.has(card.id)',),
        max_len=2500)

    # ---- 5. adding a card opens its editor ----
    text = replace_span(
        text,
        '      function mapAddCard(kind, extra) {',
        '      function mapOpenCardMenu(anchorEl) {',
        BLOCK_ADD,
        'mapAddCard',
        must_contain=('state.map.cards.push(card);',),
        max_len=3000)

    # ---- 6. the add menu grows the new kinds ----
    text = replace_span(
        text,
        '      function mapOpenCardMenu(anchorEl) {',
        '      /* ---------------- export: the deck falls out of the map ---------------- */',
        BLOCK_MENU,
        'mapOpenCardMenu',
        must_contain=("'Title card'",),
        max_len=4000)

    # ---- 7. the slide engine (replaces mapCardSlideSvg + mapCardPlainBody) ----
    text = replace_span(
        text,
        '      function mapCardSlideSvg(card, width, height) {',
        '      /* Each view becomes one slide image',
        BLOCK_ENGINE,
        'mapCardSlideSvg+mapCardPlainBody',
        must_contain=('card.title.slice(0, 46)', 'function mapCardPlainBody'),
        max_len=5000)

    # ---- 8. image cards mount/unmount with the camera ----
    text = swap_once(
        text,
        '          mapSetTileDetail(entry.diagram, tile, level);\n'
        '        });\n'
        '      }',
        '          mapSetTileDetail(entry.diagram, tile, level);\n'
        '        });\n'
        '        // Image cards mount and unmount with the camera, like tiles do.\n'
        '        mapUpdateCardDetail();\n'
        '      }',
        'mapUpdateTileDetail hook')

    # ---- 9. opening the Map sweeps orphaned assets ----
    text = swap_once(
        text,
        '        state.map = sanitizeMapState(state.map);\n'
        '        layoutMap(false);',
        '        state.map = sanitizeMapState(state.map);\n'
        '        mapCollectAssets();\n'
        '        layoutMap(false);',
        'mapOpen orphan sweep')

    # ---- 10. assets travel in the .siren export and come back on import ----
    text = swap_once(
        text,
        '            subflows: readSubflows()\n'
        '          }',
        '            subflows: readSubflows(),\n'
        '            // Only the bytes a card actually points at; see mapAssetsForExport.\n'
        '            mapAssets: mapAssetsForExport()\n'
        '          }',
        'buildPortableProjectPayload assets hook')
    text = insert_after(
        text,
        "        if (libraries.subflows && typeof libraries.subflows === 'object') writeSubflows(libraries.subflows);",
        "\n        if (libraries.mapAssets && typeof libraries.mapAssets === 'object') mapAssetsFromImport(libraries.mapAssets);",
        'applyPortableProject assets hook')

    # ---- 11. the card styles (append AFTER the existing .map-card rules:
    #          the later-declaration overrides are deliberate) ----
    text = insert_after(
        text,
        '    .map-card th { color: var(--muted); font-weight: 700; width: 34%; }',
        '\n' + BLOCK_CSS,
        'card CSS append')

    # ---- postflight sanity ----
    for probe in ('function mapEditCard(card, options)', 'mapAssetsForExport()',
                  'function mapCardSlideSvg(card, width, height)', 'card-editor-body',
                  'function mapCollectAssets', 'MAP_CARD_SEEDS'):
        if probe not in text:
            die('postflight: expected %r in the patched output' % probe)
    if 'window.prompt(' in text and "window.prompt('Card heading'" in text:
        die('postflight: the old prompt editor is still present')

    # ---- atomic write ----
    directory = os.path.dirname(os.path.abspath(path))
    fd, temp_path = tempfile.mkstemp(prefix='.siren_cards_', suffix='.html', dir=directory)
    try:
        with io.open(fd, 'w', encoding='utf-8', newline='') as handle:
            handle.write(text)
        os.replace(temp_path, path)
    except BaseException:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
        raise
    print('OK: content slides installed into %s (%d bytes)' % (path, len(text.encode('utf-8'))))


if __name__ == '__main__':
    main()
