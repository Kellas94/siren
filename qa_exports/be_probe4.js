/* JOB BE round 4: the code-only double-click, and what the cursor promises in connect mode.
 * Usage: node be_probe4.js <appPath> <port> <tag>
 */
const path = require('path'), fs = require('fs'), http = require('http');
const lib = require('./r7_lib.js');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4] || 'x';
const FLOW = ['flowchart TD', '  A[Alpha step] --> B[Bravo step]', '  B --> C[Charlie step]', '  D[Delta step] --> A'].join('\n');
const out = { app: APP, tag: TAG, tests: {}, errors: [] };
async function ev(page, expr) { return JSON.parse(await page.evaluate(`JSON.stringify((() => { ${expr} })())`)); }
async function snap(page) {
  return ev(page, `
    const wp = document.getElementById('wpWorkspace'); const insp = document.getElementById('nodeInspector');
    const inp = document.getElementById('canvasInplace'); const dlg = document.querySelector('dialog[open]');
    const toasts = Array.from(document.querySelectorAll('.toast, #toastHost > *, [class*="toast"]')).map(t => (t.textContent||'').trim()).filter(Boolean).slice(0,5);
    return { source: (document.getElementById('source')||{}).value || '', docsOpen: !!(wp && !wp.hidden), inspectorOpen: !!(insp && !insp.hidden),
      inplaceOpen: !!(inp && !inp.hidden), dialogId: dlg ? dlg.id : null, toasts,
      connectArmed: document.body.classList.contains('connect-mode') };
  `);
}
async function geomFor(page, id) {
  return ev(page, `
    const m = document.querySelector('#diagram [data-t-workpaper-node="${id}"]');
    const rr = m && m.querySelector('rect') ? m.querySelector('rect') : null;
    const r = rr ? rr.getBoundingClientRect() : null;
    const groups = Array.from(document.querySelectorAll('#diagram g.node, #diagram [data-node-id]'));
    let nb = null, ng = null;
    for (const g of groups) { const gid = g.getAttribute('data-node-id') || g.getAttribute('id') || ''; if (gid === '${id}' || gid.indexOf('-${id}-') >= 0 || gid.endsWith('-${id}')) { nb = g.getBoundingClientRect(); ng = g; break; } }
    const f = b => b ? { x:+b.x.toFixed(2), y:+b.y.toFixed(2), w:+b.width.toFixed(2), h:+b.height.toFixed(2), cx:+(b.x+b.width/2).toFixed(2), cy:+(b.y+b.height/2).toFixed(2) } : null;
    return { rect: f(r), node: f(nb),
      markerCursor: rr ? getComputedStyle(rr).cursor : null,
      nodeCursor: ng ? getComputedStyle(ng).cursor : null };
  `);
}
async function reset(page, fixture) {
  await page.keyboard.press('Escape'); await page.waitForTimeout(140);
  await ev(page, `
    const inp = document.getElementById('canvasInplace'); if (inp && !inp.hidden) inp.hidden = true;
    if (document.body.classList.contains('connect-mode')) { const cm = document.getElementById('connectModeButton'); if (cm) cm.click(); }
    const wp = document.getElementById('wpWorkspace'); if (wp && !wp.hidden) { const c = document.getElementById('closeWpButton'); if (c) c.click(); }
    const insp = document.getElementById('nodeInspector'); if (insp && !insp.hidden) { const d = document.getElementById('inspectorDoneButton'); if (d) d.click(); }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
    const menu = document.querySelector('.struct-menu'); if (menu) menu.remove(); return 1;
  `);
  await page.waitForTimeout(250);
  const src = await page.evaluate(`document.getElementById('source').value`);
  if (src.trim() !== fixture.trim()) await lib.setSource(page, fixture, 2600);
  await page.waitForTimeout(500);
}
async function clickMenuRow(page, re) {
  const box = await ev(page, `
    const items = Array.from(document.querySelectorAll('.struct-menu .struct-menu-item'));
    const hit = items.find(x => ${re}.test((x.textContent||'').trim())); if (!hit) return null;
    const r = hit.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, label: (hit.textContent||'').trim() };
  `);
  if (!box || box.w < 2) return null;
  await page.mouse.click(box.x, box.y); await page.waitForTimeout(500); return box.label;
}
async function makeDocOn(page, id) {
  const g = await geomFor(page, id);
  await page.mouse.click(g.node.cx, g.node.cy); await page.waitForTimeout(900);
  await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (d) { const det = d.closest('details'); if (det) det.open = true; d.scrollIntoView({ block: 'center' }); } return 1;`);
  await page.waitForTimeout(400);
  const b = await ev(page, `const d = document.getElementById('nodeDocNewButton'); const r = d.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, inView: r.top >= 0 && r.bottom <= innerHeight };`);
  if (b && b.w > 2 && b.inView) await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1500);
  return b;
}
(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])), (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });
  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(lib.SETTLE);
  for (let i = 0; i < 20; i++) {
    const gone = await page.evaluate(`(() => { const c = document.querySelector('.tour-card'); if (!c) return true; const b = Array.from(c.querySelectorAll('button')).find(x=>/skip|done|got it|close|finish/i.test(x.textContent))||c.querySelector('button'); if (b) b.click(); return false; })()`);
    if (gone && i > 6) break; await page.waitForTimeout(180);
  }
  try {
    // ---------- A. flowchart: what the cursor promises while connect mode is armed ----------
    await lib.setSource(page, FLOW, 3200);
    await makeDocOn(page, 'B');
    await reset(page, FLOW);
    let g = await geomFor(page, 'B');
    out.tests.cursor_idle = { marker: g.markerCursor, node: g.nodeCursor };
    {
      const d = await geomFor(page, 'D');
      await page.mouse.click(d.node.cx, d.node.cy, { button: 'right' });
      await page.waitForTimeout(800);
      const row = await clickMenuRow(page, '/Connect from here/i');
      await page.waitForTimeout(400);
      g = await geomFor(page, 'B');
      const s = await snap(page);
      out.tests.cursor_in_connect_mode = { armed: s.connectArmed, rowPressed: row, marker: g.markerCursor, node: g.nodeCursor };
      await reset(page, FLOW);
    }

    // ---------- B. stateDiagram-v2: double-click the marker on a code-only source ----------
    await ev(page, `document.getElementById('codeModeButton')?.click(); return 1;`);
    await page.waitForTimeout(600);
    await ev(page, `document.getElementById('textModeButton')?.click(); return 1;`);
    await page.waitForTimeout(600);
    await ev(page, `const s = document.getElementById('diagramTypeSelect'); s.value = 'state'; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value;`);
    await page.waitForTimeout(400);
    await ev(page, `document.getElementById('newDiagramTypeButton').click(); return 1;`);
    for (let i = 0; i < 20; i++) { await page.waitForTimeout(200); const has = await page.evaluate(`!!document.querySelector('dialog[open]')`); if (has) break; }
    const btn = await ev(page, `
      const dlg = document.querySelector('dialog[open]'); if (!dlg) return null;
      const hit = Array.from(dlg.querySelectorAll('button')).find(b => /Create starter/i.test((b.textContent||'').trim()));
      if (!hit) return null; const r = hit.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, label: (hit.textContent||'').trim() };
    `);
    if (btn) await page.mouse.click(btn.x, btn.y);
    await page.waitForTimeout(2600);
    const STATE = await page.evaluate(`document.getElementById('source').value`);
    out.stateIsState = /stateDiagram/.test(STATE);
    if (out.stateIsState) {
      const ids = await ev(page, `return Array.from((document.getElementById('nodeStyleTarget')||{options:[]}).options).map(o=>o.value).filter(Boolean);`);
      const target = ids[1] || ids[0];
      out.stateTarget = target;
      await makeDocOn(page, target);
      await reset(page, STATE);
      let gs = await geomFor(page, target);
      out.stateGeom = gs;
      if (gs.rect) {
        // control first: double-click the state node's body
        await page.mouse.dblclick(gs.node.x + 8, gs.node.cy);
        await page.waitForTimeout(1300);
        let s = await snap(page);
        out.tests.state_dblclick_body = { inplaceOpen: s.inplaceOpen, dialogId: s.dialogId, docsOpen: s.docsOpen, toasts: s.toasts };
        await reset(page, STATE);
        gs = await geomFor(page, target);
        await page.mouse.dblclick(gs.rect.cx, gs.rect.cy);
        await page.waitForTimeout(1300);
        s = await snap(page);
        out.tests.state_dblclick_marker = { inplaceOpen: s.inplaceOpen, dialogId: s.dialogId, docsOpen: s.docsOpen, toasts: s.toasts };
        await page.waitForTimeout(900);
        out.tests.state_dblclick_marker.docsOpenedLate = (await snap(page)).docsOpen;
      }
    }
    out.errors = errors.slice(0, 20);
  } catch (e) {
    out.crash = String((e && e.stack) || e).slice(0, 900); out.errors = errors.slice(0, 20);
  }
  fs.writeFileSync(path.join(__dirname, 'be4_' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('done ' + TAG);
  await browser.close(); server.close(); process.exit(0);
})();
