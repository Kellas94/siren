/* JOB BE verification - the document marker must stop being the block.
 * Same script, driven against BASE and MERGED. Every gesture is real input.
 * Usage: node be_probe.js <appPath> <port> [mac] [outPngPrefix]
 */
const path = require('path');
const fs = require('fs');
const lib = require('./r7_lib.js');
const { openApp, setSource } = lib;

const APP = process.argv[2];
const PORT = Number(process.argv[3]);
const MAC = process.argv[4] === 'mac';
const PNG = process.argv[5] || '';

const FIXTURE = [
  'flowchart TD',
  '  A[Alpha step] --> B[Bravo step]',
  '  B --> C[Charlie step]',
  '  D[Delta step] --> A'
].join('\n');

const out = { app: APP, mac: MAC, tests: {}, errors: [] };

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const card = document.querySelector('.tour-card');
      if (!card) return true;
      const b = Array.from(card.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || card.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(180);
  }
}

async function ev(page, expr) { return JSON.parse(await page.evaluate(`JSON.stringify((() => { ${expr} })())`)); }

async function snapshot(page) {
  return ev(page, `
    const wp = document.getElementById('wpWorkspace');
    const insp = document.getElementById('nodeInspector');
    const menu = document.querySelector('.struct-menu');
    const dlg = document.querySelector('dialog[open]');
    const note = document.getElementById('selectionNote');
    const z = document.getElementById('zoomViewport');
    return {
      source: (document.getElementById('source')||{}).value || '',
      status: ((document.getElementById('status')||{}).textContent || '').trim(),
      docsOpen: !!(wp && !wp.hidden),
      inspectorOpen: !!(insp && !insp.hidden),
      inspectorHeading: ((document.getElementById('nodeInspectorHeading')||{}).textContent || '').trim(),
      docRows: document.querySelectorAll('#nodeDocList .node-doc-row').length,
      menuLabel: menu ? (menu.getAttribute('aria-label') || '') : null,
      menuRows: menu ? Array.from(menu.querySelectorAll('.struct-menu-heading, .struct-menu-item')).map(x => (x.textContent||'').replace(/[\\u0020\\t]+/g,' ').trim()).filter(Boolean).slice(0,24) : null,
      dialog: dlg ? { id: dlg.id, title: ((document.getElementById('renameDialogTitle')||{}).textContent||'').trim(), input: (document.getElementById('renameDialogInput')||{}).value || '' } : null,
      connectArmed: document.body.classList.contains('connect-mode'),
      multiSelected: document.querySelectorAll('#diagram .t-multi-selected').length,
      selectionNote: note && !note.hidden ? (note.textContent||'').trim() : '',
      markers: document.querySelectorAll('#diagram [data-t-workpaper-node]').length,
      scroll: z ? { l: Math.round(z.scrollLeft), t: Math.round(z.scrollTop), sw: z.scrollWidth, cw: z.clientWidth, sh: z.scrollHeight, ch: z.clientHeight } : null,
      ghost: document.querySelectorAll('.canvas-move-ghost').length,
      moving: document.body.classList.contains('is-canvas-moving'),
      wpTitle: ((document.querySelector('#wpWorkspace .wp-doc-title, #wpWorkspace h2, #wpWorkspace .wp-title')||{}).textContent||'').trim().slice(0,80)
    };
  `);
}

async function markerGeom(page, id) {
  return ev(page, `
    const m = document.querySelector('#diagram [data-t-workpaper-node="${id}"]');
    const rect = m ? m.querySelector('rect') : null;
    const glyph = m ? m.querySelector('text') : null;
    const r = rect ? rect.getBoundingClientRect() : null;
    const g = glyph ? glyph.getBoundingClientRect() : null;
    const groups = Array.from(document.querySelectorAll('#diagram g.node, #diagram [data-node-id]'));
    let nodeBox = null;
    for (const grp of groups) {
      const gid = grp.getAttribute('data-node-id') || grp.getAttribute('id') || '';
      if (gid === '${id}' || gid.indexOf('-${id}-') >= 0 || gid.slice(-2) === '-${id}') { nodeBox = grp.getBoundingClientRect(); break; }
    }
    const f = v => v === null ? null : +v.toFixed(3);
    const box = b => b ? { x: f(b.x), y: f(b.y), w: f(b.width), h: f(b.height), cx: f(b.x + b.width/2), cy: f(b.y + b.height/2) } : null;
    return { rect: box(r), glyph: box(g), node: box(nodeBox),
      glyphAttrs: glyph ? { x: glyph.getAttribute('x'), y: glyph.getAttribute('y'), anchor: glyph.getAttribute('text-anchor') } : null,
      rectAttrs: rect ? { x: rect.getAttribute('x'), y: rect.getAttribute('y'), w: rect.getAttribute('width'), h: rect.getAttribute('height') } : null };
  `);
}

async function nodeCenter(page, id) {
  const g = await markerGeom(page, id);
  return g && g.node ? { x: g.node.cx, y: g.node.cy } : null;
}

async function reset(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(140);
  await ev(page, `
    if (document.body.classList.contains('connect-mode')) { const cm = document.getElementById('connectModeButton'); if (cm) cm.click(); }
    const wp = document.getElementById('wpWorkspace');
    if (wp && !wp.hidden) { const c = document.getElementById('closeWpButton'); if (c) c.click(); }
    const insp = document.getElementById('nodeInspector');
    if (insp && !insp.hidden) { const d = document.getElementById('inspectorDoneButton'); if (d) d.click(); }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
    const menu = document.querySelector('.struct-menu'); if (menu) menu.remove();
    return 1;
  `);
  await page.waitForTimeout(250);
  const src = await page.evaluate(`document.getElementById('source').value`);
  if (src.trim() !== FIXTURE.trim()) await setSource(page, FIXTURE, 2400);
  await page.waitForTimeout(450);
}

/* Click a row of the app's own context menu by its visible label, with the real mouse. */
async function clickMenuRow(page, re) {
  const box = await ev(page, `
    const items = Array.from(document.querySelectorAll('.struct-menu .struct-menu-item'));
    const hit = items.find(x => ${re}.test((x.textContent||'').trim()));
    if (!hit) return null;
    const r = hit.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, label: (hit.textContent||'').trim(), disabled: hit.disabled };
  `);
  if (!box || box.w < 2) return null;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(500);
  return box;
}

/* Arm connect mode the way the app makes a person do it: right-click the source
   block and press "Connect from here". The toolbar chip is display:none above 900px. */
async function armConnectFrom(page, id) {
  const c = await nodeCenter(page, id);
  await page.mouse.click(c.x, c.y, { button: 'right' });
  await page.waitForTimeout(650);
  const row = await clickMenuRow(page, '/Connect from here/i');
  await page.waitForTimeout(400);
  const s = await snapshot(page);
  return { source: id, rowPressed: row ? row.label : null, armed: s.connectArmed, at: c };
}

(async () => {
  const viewport = { width: 1440, height: 900 };
  let page, errors, close;
  {
    const { createRequire } = require('module');
    const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
    const http = require('http');
    const root = path.dirname(APP), file = path.basename(APP);
    const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])), (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
    const browser = await chromium.launch();
    const ctxOpts = { viewport };
    if (MAC) ctxOpts.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
    const ctx = await browser.newContext(ctxOpts);
    page = await ctx.newPage();
    errors = [];
    page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 90000 });
    await page.evaluate(lib.SETTLE);
    close = async () => { await browser.close(); server.close(); };
  }
  out.isMac = await page.evaluate(`/Mac|iPhone|iPad|iPod/.test(navigator.platform||'') || /Mac OS X|Macintosh/.test(navigator.userAgent||'')`);
  try {
    await killTour(page);
    await setSource(page, FIXTURE, 3200);
    out.fixtureSource = await page.evaluate(`document.getElementById('source').value`);
    out.fixtureNodes = await ev(page, `return Array.from(document.querySelectorAll('#diagram g.node, #diagram [data-node-id]')).map(g => g.getAttribute('data-node-id') || g.getAttribute('id'));`);
    out.fixtureStatus = (await snapshot(page)).status;

    // ---- create document #1 on B through the app's own inspector ----
    const bc = await nodeCenter(page, 'B');
    out.bCenter = bc;
    await page.mouse.click(bc.x, bc.y);
    await page.waitForTimeout(800);
    out.tests.setup_inspector_opened = (await snapshot(page)).inspectorOpen;
    await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (d) { const det = d.closest('details'); if (det) det.open = true; d.scrollIntoView({ block: 'center' }); } return 1;`);
    await page.waitForTimeout(400);
    const docBtn = await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height, inView: r.top >= 0 && r.bottom <= innerHeight };`);
    out.docBtn = docBtn;
    if (docBtn && docBtn.w > 2) await page.mouse.click(docBtn.x, docBtn.y);
    await page.waitForTimeout(1400);
    out.tests.setup_docs_opened_after_create = (await snapshot(page)).docsOpen;
    await reset(page);
    await page.waitForTimeout(700);

    let geom = await markerGeom(page, 'B');
    out.geom_one_doc = geom;
    if (!geom || !geom.rect) { out.fatal = 'no marker on B after creating a document'; throw new Error(out.fatal); }
    const MK = () => ({ x: geom.rect.cx, y: geom.rect.cy });
    const CORNER = () => ({ x: geom.rect.x + 3, y: geom.rect.y + geom.rect.h - 3 });

    if (PNG) { await page.screenshot({ path: PNG + '_marker.png', clip: { x: Math.max(0, geom.node.x - 20), y: Math.max(0, geom.node.y - 20), width: Math.min(300, geom.node.w + 60), height: Math.min(200, geom.node.h + 60) } }); }

    // ---------- 1. POSITIVE CONTROL: connect mode at the marker pixel ----------
    async function connectTest(getPoint, label) {
      await reset(page);
      geom = await markerGeom(page, 'B');
      const arm = await armConnectFrom(page, 'D');
      const p = getPoint();
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(1100);
      const s = await snapshot(page);
      return {
        label, point: p, arm,
        edgeAdded: /D\s*-->\s*B/.test(s.source),
        source: s.source.replace(/\n/g, ' | '),
        docsOpen: s.docsOpen, connectStillArmed: s.connectArmed, status: s.status, inspectorOpen: s.inspectorOpen
      };
    }
    out.tests.connect_at_marker_center = await connectTest(MK, 'marker centre');
    out.tests.connect_at_marker_corner = await connectTest(CORNER, 'inside the rect, off the glyph');
    out.tests.connect_at_block_body = await (async () => {
      await reset(page);
      const arm = await armConnectFrom(page, 'D');
      const b = await nodeCenter(page, 'B');
      await page.mouse.click(b.x, b.y);
      await page.waitForTimeout(1100);
      const s = await snapshot(page);
      return { arm, edgeAdded: /D\s*-->\s*B/.test(s.source), docsOpen: s.docsOpen, status: s.status, connectStillArmed: s.connectArmed };
    })();

    // ---------- 2. modifier clicks at the marker ----------
    async function modClickTest(mods, name) {
      await reset(page);
      geom = await markerGeom(page, 'B');
      const p = MK();
      await page.mouse.move(p.x, p.y);
      await page.keyboard.down(mods);
      await page.mouse.down(); await page.mouse.up();
      await page.keyboard.up(mods);
      await page.waitForTimeout(1200);
      const s = await snapshot(page);
      return { name, point: p, multiSelected: s.multiSelected, selectionNote: s.selectionNote, docsOpen: s.docsOpen, inspectorOpen: s.inspectorOpen, menuLabel: s.menuLabel };
    }
    out.tests.ctrl_click_marker = await modClickTest('Control', 'Control');
    out.tests.meta_click_marker = await modClickTest('Meta', 'Meta');
    out.tests.shift_click_marker = await modClickTest('Shift', 'Shift');
    // control: the same modifier on the plain block body
    out.tests.ctrl_click_block_body = await (async () => {
      await reset(page);
      const b = await nodeCenter(page, 'B');
      await page.mouse.move(b.x, b.y);
      await page.keyboard.down('Control'); await page.mouse.down(); await page.mouse.up(); await page.keyboard.up('Control');
      await page.waitForTimeout(900);
      const s = await snapshot(page);
      return { multiSelected: s.multiSelected, selectionNote: s.selectionNote };
    })();

    // ---------- 3. double click = rename ----------
    await reset(page);
    geom = await markerGeom(page, 'B');
    {
      const p = MK();
      await page.mouse.dblclick(p.x, p.y);
      await page.waitForTimeout(1300);
      const s = await snapshot(page);
      out.tests.dblclick_marker = { point: p, dialog: s.dialog, docsOpen: s.docsOpen, inspectorOpen: s.inspectorOpen };
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
      out.tests.dblclick_marker.docsOpenedLate = (await snapshot(page)).docsOpen;
    }

    // ---------- 4. right click = block menu carrying the Documents row ----------
    await reset(page);
    geom = await markerGeom(page, 'B');
    {
      const p = MK();
      await page.mouse.click(p.x, p.y, { button: 'right' });
      await page.waitForTimeout(900);
      const s = await snapshot(page);
      out.tests.rightclick_marker = { point: p, menuLabel: s.menuLabel, menuRows: s.menuRows, docsOpen: s.docsOpen };
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);
      out.tests.rightclick_marker.docsOpenedLate = (await snapshot(page)).docsOpen;
    }

    // ---------- 5. a real drag from the marker ----------
    await reset(page);
    geom = await markerGeom(page, 'B');
    {
      const p = MK();
      const before = await snapshot(page);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) { await page.mouse.move(p.x - i * 12, p.y + i * 9); await page.waitForTimeout(40); }
      const mid = await snapshot(page);
      await page.mouse.up();
      await page.waitForTimeout(1000);
      const after = await snapshot(page);
      out.tests.drag_from_marker = {
        point: p, ghostDuringDrag: mid.ghost, movingClassDuringDrag: mid.moving,
        scrollBefore: before.scroll ? [before.scroll.l, before.scroll.t] : null,
        scrollDuring: mid.scroll ? [mid.scroll.l, mid.scroll.t] : null,
        docsOpenAfter: after.docsOpen, sourceChanged: after.source !== before.source
      };
      await page.waitForTimeout(800);
      out.tests.drag_from_marker.docsOpenedLate = (await snapshot(page)).docsOpen;
    }
    // control: the same drag from the block body
    await reset(page);
    {
      const b = await nodeCenter(page, 'B');
      await page.mouse.move(b.x, b.y); await page.mouse.down();
      for (let i = 1; i <= 8; i++) { await page.mouse.move(b.x - i * 12, b.y + i * 9); await page.waitForTimeout(40); }
      const mid = await snapshot(page);
      await page.mouse.up(); await page.waitForTimeout(800);
      out.tests.drag_from_block_body = { ghostDuringDrag: mid.ghost, movingClassDuringDrag: mid.moving };
    }

    // ---------- 6. the marker must still be the marker ----------
    await reset(page);
    geom = await markerGeom(page, 'B');
    {
      const p = MK();
      const t0 = Date.now();
      await page.mouse.click(p.x, p.y);
      let opened = false, ms = -1;
      for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(50);
        const s = await snapshot(page);
        if (s.docsOpen) { opened = true; ms = Date.now() - t0; break; }
      }
      const s = await snapshot(page);
      out.tests.plain_click_opens_doc = { point: p, docsOpen: opened, msToOpen: ms, inspectorOpen: s.inspectorOpen, wpTitle: s.wpTitle };
    }

    // ---------- 7. press on the marker, release off it, and the reverse ----------
    await reset(page);
    geom = await markerGeom(page, 'B');
    {
      const p = MK();
      const off = { x: geom.node.x + 14, y: geom.node.cy };
      await page.mouse.move(p.x, p.y); await page.mouse.down();
      await page.mouse.move(off.x, off.y, { steps: 6 }); await page.mouse.up();
      await page.waitForTimeout(1400);
      let s = await snapshot(page);
      out.tests.down_on_marker_up_off = { from: p, to: off, docsOpen: s.docsOpen, inspectorOpen: s.inspectorOpen, sourceChanged: s.source.trim() !== FIXTURE.trim() };
      await reset(page);
      geom = await markerGeom(page, 'B');
      const p2 = MK();
      const off2 = { x: geom.node.x + 14, y: geom.node.cy };
      await page.mouse.move(off2.x, off2.y); await page.mouse.down();
      await page.mouse.move(p2.x, p2.y, { steps: 6 }); await page.mouse.up();
      await page.waitForTimeout(1400);
      s = await snapshot(page);
      out.tests.down_off_marker_up_on = { from: off2, to: p2, docsOpen: s.docsOpen, inspectorOpen: s.inspectorOpen };
    }

    // ---------- 8. middle click ----------
    await reset(page);
    geom = await markerGeom(page, 'B');
    {
      const p = MK();
      await page.mouse.click(p.x, p.y, { button: 'middle' });
      await page.waitForTimeout(1300);
      const s = await snapshot(page);
      out.tests.middle_click_marker = { point: p, docsOpen: s.docsOpen, inspectorOpen: s.inspectorOpen };
    }

    // ---------- 9. panning, with the canvas actually overflowing ----------
    await reset(page);
    // The +/- zoom chips are display:none at this width, so zoom the way the app
    // leaves open on a desktop: Ctrl + wheel over the canvas. Overflow on both axes
    // is what makes a pan measurable at all.
    {
      const z = await ev(page, `const r = document.getElementById('zoomViewport').getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 };`);
      await page.mouse.move(z.x, z.y);
      await page.keyboard.down('Control');
      for (let i = 0; i < 9; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(160); }
      await page.keyboard.up('Control');
      await page.waitForTimeout(1200);
      await ev(page, `const v = document.getElementById('zoomViewport'); v.scrollLeft = Math.round((v.scrollWidth - v.clientWidth)/2); v.scrollTop = Math.round((v.scrollHeight - v.clientHeight)/2); return 1;`);
      await page.waitForTimeout(300);
      out.zoomPct = await page.evaluate(`(document.getElementById('zoomValue')||{}).textContent || (document.getElementById('zoomRange')||{}).value`);
    }
    let zs = (await snapshot(page)).scroll;
    out.zoomedScroll = zs;
    geom = await markerGeom(page, 'B');
    out.geom_zoomed = geom;
    async function panTest(getPoint, name) {
      const p = getPoint();
      if (!p) return { name, skipped: 'no point' };
      const before = await snapshot(page);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) { await page.mouse.move(p.x - i * 10, p.y - i * 6); await page.waitForTimeout(30); }
      const during = await snapshot(page);
      await page.mouse.up();
      await page.waitForTimeout(600);
      const after = await snapshot(page);
      // put the scroll back where it was so the next pan starts from the same place
      await ev(page, `const z = document.getElementById('zoomViewport'); z.scrollLeft = ${before.scroll.l}; z.scrollTop = ${before.scroll.t}; return 1;`);
      await page.waitForTimeout(250);
      return { name, point: p, before: [before.scroll.l, before.scroll.t], during: [during.scroll.l, during.scroll.t], after: [after.scroll.l, after.scroll.t],
        dx: after.scroll.l - before.scroll.l, dy: after.scroll.t - before.scroll.t,
        overflow: [before.scroll.sw - before.scroll.cw, before.scroll.sh - before.scroll.ch] };
    }
    const emptyPoint = await ev(page, `
      const z = document.getElementById('zoomViewport');
      const r = z.getBoundingClientRect();
      const sel = 'button, input, select, a, #diagram [data-handle-for], #diagram [data-t-workpaper-node], #diagram g.node, #diagram [data-node-id], #diagram [data-edge-key], #diagram path.t-edge-hitarea, #diagram path.flowchart-link, #diagram path[id*="L_"], #diagram path[id*="L-"], #diagram .edgePath, #diagram .edgeLabel';
      for (let gy = 0.8; gy > 0.15; gy -= 0.05) {
        for (let gx = 0.85; gx > 0.1; gx -= 0.05) {
          const x = r.x + r.width * gx, y = r.y + r.height * gy;
          const t = document.elementFromPoint(x, y);
          if (!t || !t.closest('#zoomViewport')) continue;
          if (t.closest(sel)) continue;
          if (t.closest('[id*="inimap"], [class*="inimap"], .canvas-move-ghost')) continue;
          return { x: +x.toFixed(1), y: +y.toFixed(1), tag: t.tagName, id: t.id, cls: String((t.className && t.className.baseVal !== undefined) ? t.className.baseVal : (t.className || '')) };
        }
      }
      return null;
    `);
    out.emptyPoint = emptyPoint;
    out.tests.pan_empty_canvas = await panTest(() => emptyPoint, 'empty canvas');
    out.tests.pan_from_marker = await panTest(() => (geom && geom.rect ? { x: geom.rect.cx, y: geom.rect.cy } : null), 'from the marker');
    out.tests.pan_beside_marker = await panTest(() => (geom && geom.rect ? { x: geom.rect.x - 26, y: geom.rect.cy } : null), 'beside the marker, on the block');
    await ev(page, `const a = document.getElementById('fitPageButton') || document.getElementById('actualSizeButton'); if (a) a.click(); return 1;`);
    await page.waitForTimeout(1200);

    // ---------- 10. the deferred open: click the marker, then move on ----------
    await reset(page);
    geom = await markerGeom(page, 'B');
    {
      const p = MK();
      const away = await ev(page, `
        const z = document.getElementById('zoomViewport'); const r = z.getBoundingClientRect();
        const sel = '#diagram g.node, #diagram [data-node-id], #diagram [data-t-workpaper-node], #diagram [data-edge-key], [id*="inimap"], [class*="inimap"], button, input, select, a';
        for (let gy = 0.85; gy > 0.15; gy -= 0.05) for (let gx = 0.2; gx < 0.9; gx += 0.05) {
          const x = r.x + r.width*gx, y = r.y + r.height*gy; const t = document.elementFromPoint(x,y);
          if (!t || !t.closest('#zoomViewport') || t.closest(sel)) continue;
          return { x: +x.toFixed(1), y: +y.toFixed(1), tag: t.tagName, id: t.id };
        } return null;
      `) || { x: geom.node.x + 320, y: geom.node.y + 240 };
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(120);
      await page.mouse.click(away.x, away.y);
      await page.waitForTimeout(1600);
      const s = await snapshot(page);
      out.tests.click_then_click_away = { marker: p, away, docsOpen: s.docsOpen };
    }
    // and: click the marker, then immediately press Escape
    await reset(page);
    geom = await markerGeom(page, 'B');
    {
      const p = MK();
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(100);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1600);
      const s = await snapshot(page);
      out.tests.click_then_escape = { marker: p, docsOpen: s.docsOpen };
    }

    // ---------- 11. TWO documents on the same block ----------
    await reset(page);
    {
      const bc2 = await nodeCenter(page, 'B');
      await page.mouse.click(bc2.x, bc2.y);
      await page.waitForTimeout(900);
      await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (d) { const det = d.closest('details'); if (det) det.open = true; d.scrollIntoView({ block: 'center' }); } return 1;`);
      await page.waitForTimeout(400);
      const b2 = await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, inView: r.top >= 0 && r.bottom <= innerHeight };`);
      out.docBtn2 = b2;
      if (b2 && b2.w > 2) await page.mouse.click(b2.x, b2.y);
      await page.waitForTimeout(1400);
      await reset(page);
      await page.waitForTimeout(700);
      geom = await markerGeom(page, 'B');
      out.geom_two_docs = geom;
      const p = MK();
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(1600);
      const s = await snapshot(page);
      out.tests.two_docs_plain_click = { point: p, docsOpen: s.docsOpen, inspectorOpen: s.inspectorOpen, docRows: s.docRows, heading: s.inspectorHeading };
      await reset(page);
      geom = await markerGeom(page, 'B');
      const p3 = MK();
      await page.mouse.click(p3.x, p3.y, { button: 'right' });
      await page.waitForTimeout(900);
      const s3 = await snapshot(page);
      out.tests.two_docs_rightclick = { menuLabel: s3.menuLabel, menuRows: s3.menuRows };
      await page.keyboard.press('Escape');
    }

    out.errors = errors.slice(0, 20);
  } catch (e) {
    out.crash = String((e && e.stack) || e).slice(0, 900);
    out.errors = errors.slice(0, 20);
  }
  fs.writeFileSync(path.join(__dirname, 'be_out_' + (MAC ? 'mac_' : '') + path.basename(path.dirname(APP)) + '.json'), JSON.stringify(out, null, 1));
  console.log('JSON_OUT ' + JSON.stringify(out));
  await close();
  process.exit(0);
})();
