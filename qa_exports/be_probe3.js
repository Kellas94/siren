/* JOB BE, one step sideways: the marker on a stateDiagram-v2 node.
 * Usage: node be_probe3.js <appPath> <port> <tag>
 */
const path = require('path'), fs = require('fs'), http = require('http');
const lib = require('./r7_lib.js');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4] || 'x';
const out = { app: APP, tag: TAG, tests: {}, errors: [] };
async function ev(page, expr) { return JSON.parse(await page.evaluate(`JSON.stringify((() => { ${expr} })())`)); }

async function snap(page) {
  return ev(page, `
    const wp = document.getElementById('wpWorkspace');
    const insp = document.getElementById('nodeInspector');
    const menu = document.querySelector('.struct-menu');
    const inp = document.getElementById('canvasInplace');
    return {
      source: (document.getElementById('source')||{}).value || '',
      docsOpen: !!(wp && !wp.hidden), inspectorOpen: !!(insp && !insp.hidden),
      menuLabel: menu ? (menu.getAttribute('aria-label')||'') : null,
      menuRows: menu ? Array.from(menu.querySelectorAll('.struct-menu-heading, .struct-menu-item')).map(x=>(x.textContent||'').trim()).filter(Boolean).slice(0,20) : null,
      inplaceOpen: !!(inp && !inp.hidden), multiSelected: document.querySelectorAll('#diagram .t-multi-selected').length,
      connectArmed: document.body.classList.contains('connect-mode'),
      markerIds: Array.from(document.querySelectorAll('#diagram [data-t-workpaper-node]')).map(m=>m.getAttribute('data-t-workpaper-node'))
    };
  `);
}
async function geomFor(page, id) {
  return ev(page, `
    const m = document.querySelector('#diagram [data-t-workpaper-node="${id}"]');
    const r = m && m.querySelector('rect') ? m.querySelector('rect').getBoundingClientRect() : null;
    const groups = Array.from(document.querySelectorAll('#diagram g.node, #diagram [data-node-id]'));
    let nb = null;
    for (const g of groups) { const gid = g.getAttribute('data-node-id') || g.getAttribute('id') || ''; if (gid === '${id}' || gid.indexOf('-${id}-') >= 0 || gid.endsWith('-${id}')) { nb = g.getBoundingClientRect(); break; } }
    const f = b => b ? { x:+b.x.toFixed(2), y:+b.y.toFixed(2), w:+b.width.toFixed(2), h:+b.height.toFixed(2), cx:+(b.x+b.width/2).toFixed(2), cy:+(b.y+b.height/2).toFixed(2) } : null;
    return { rect: f(r), node: f(nb) };
  `);
}
async function pressDialog(page, re) {
  let seen = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(200);
    seen = await ev(page, `const d = document.querySelector('dialog[open]'); return d ? { id: d.id, btns: Array.from(d.querySelectorAll('button')).map(b => (b.textContent||'').trim()) } : null;`);
    if (seen) break;
  }
  if (!seen) return { noDialog: true };
  const box = await ev(page, `
    const dlg = document.querySelector('dialog[open]'); if (!dlg) return null;
    const btns = Array.from(dlg.querySelectorAll('button'));
    const hit = btns.find(b => ${re}.test((b.textContent||'').trim()));
    if (!hit) return { none: btns.map(b=>(b.textContent||'').trim()) };
    const r = hit.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2, label: (hit.textContent||'').trim() };
  `);
  if (!box || box.none) return box;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(1400);
  return box.label;
}
async function clickMenuRow(page, re) {
  const box = await ev(page, `
    const items = Array.from(document.querySelectorAll('.struct-menu .struct-menu-item'));
    const hit = items.find(x => ${re}.test((x.textContent||'').trim()));
    if (!hit) return null; const r = hit.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, label: (hit.textContent||'').trim() };
  `);
  if (!box || box.w < 2) return null;
  await page.mouse.click(box.x, box.y); await page.waitForTimeout(500);
  return box.label;
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
async function makeDocOn(page, id) {
  const g = await geomFor(page, id);
  if (!g.node) return { err: 'no node box for ' + id };
  await page.mouse.click(g.node.cx, g.node.cy);
  await page.waitForTimeout(900);
  const insp = await page.evaluate(`!document.getElementById('nodeInspector').hidden`);
  await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (d) { const det = d.closest('details'); if (det) det.open = true; d.scrollIntoView({ block: 'center' }); } return 1;`);
  await page.waitForTimeout(400);
  const b = await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, inView: r.top >= 0 && r.bottom <= innerHeight };`);
  if (b && b.w > 2 && b.inView) await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1500);
  return { inspectorOpened: insp, btn: b };
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
    // Code mode first: the type picker and its New starter button live inside it.
    await ev(page, `document.getElementById('codeModeButton')?.click(); return 1;`);
    await page.waitForTimeout(700);
    await ev(page, `document.getElementById('textModeButton')?.click(); return 1;`);
    await page.waitForTimeout(700);
    const sel = await ev(page, `
      const s = document.getElementById('diagramTypeSelect');
      const values = Array.from(s.options).map(o => o.value);
      const want = values.find(v => /state/i.test(v)) || '';
      s.value = want; s.dispatchEvent(new Event('change', { bubbles: true }));
      return { values, want, now: s.value };
    `);
    out.typeSelect = sel;
    await page.waitForTimeout(500);
    const starter = await ev(page, `
      const b = document.getElementById('newDiagramTypeButton');
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height, vis: getComputedStyle(b).display, text: (b.textContent||'').trim(), inView: r.top >= 0 && r.bottom <= innerHeight };
    `);
    out.starterButton = starter;
    out.topAtStarter = await ev(page, `const t = document.elementFromPoint(${starter.x}, ${starter.y}); return t ? { id: t.id, tag: t.tagName, cls: String(t.className||'') } : null;`);
    if (starter.w > 2 && starter.inView && out.topAtStarter && out.topAtStarter.id === 'newDiagramTypeButton') await page.mouse.click(starter.x, starter.y);
    else await ev(page, `document.getElementById('newDiagramTypeButton').click(); return 1;`);
    out.dialogPressed = await pressDialog(page, '/Create starter/i');
    await page.waitForTimeout(2600);
    const FIX = await page.evaluate(`document.getElementById('source').value`);
    out.stateSource = FIX;
    out.isState = /stateDiagram/.test(FIX);
    if (!out.isState) throw new Error('fixture is not a stateDiagram: ' + FIX.slice(0, 120));
    out.styleTargets = await ev(page, `return Array.from((document.getElementById('nodeStyleTarget')||{options:[]}).options).map(o=>o.value).filter(Boolean);`);
    const ids = out.styleTargets;
    const targetId = ids[1] || ids[0];
    const otherId = ids.find(v => v !== targetId) || '';
    out.targetId = targetId; out.otherId = otherId;
    out.makeDoc = await makeDocOn(page, targetId);
    await reset(page, FIX);
    let g = await geomFor(page, targetId);
    out.geom = g;
    if (!g.rect) { out.tests.state_marker = 'NO MARKER on the state node'; }
    else {
      out.markerPctOfNode = { w: +(g.rect.w / g.node.w * 100).toFixed(1), h: +(g.rect.h / g.node.h * 100).toFixed(1), node: [g.node.w, g.node.h] };
      // right-click at the marker
      await page.mouse.click(g.rect.cx, g.rect.cy, { button: 'right' });
      await page.waitForTimeout(900);
      let s = await snap(page);
      out.tests.state_rightclick_marker = { menuLabel: s.menuLabel, menuRows: s.menuRows };
      await page.keyboard.press('Escape');
      await reset(page, FIX);
      // CONTROL: right-click the same state node's body, away from the marker
      g = await geomFor(page, targetId);
      await page.mouse.click(g.node.x + 8, g.node.cy, { button: 'right' });
      await page.waitForTimeout(900);
      s = await snap(page);
      out.tests.state_rightclick_body = { menuLabel: s.menuLabel, menuRows: s.menuRows, at: [g.node.x + 8, g.node.cy] };
      await page.keyboard.press('Escape');
      await reset(page, FIX);
      // plain click at the marker: the marker must still be the marker
      g = await geomFor(page, targetId);
      const t0 = Date.now();
      await page.mouse.click(g.rect.cx, g.rect.cy);
      let opened = false, ms = -1;
      for (let i = 0; i < 30; i++) { await page.waitForTimeout(50); const q = await snap(page); if (q.docsOpen) { opened = true; ms = Date.now() - t0; break; } }
      out.tests.state_plain_click = { docsOpen: opened, msToOpen: ms };
      await reset(page, FIX);
      // ctrl+click at the marker
      g = await geomFor(page, targetId);
      await page.mouse.move(g.rect.cx, g.rect.cy);
      await page.keyboard.down('Control'); await page.mouse.down(); await page.mouse.up(); await page.keyboard.up('Control');
      await page.waitForTimeout(1200);
      s = await snap(page);
      out.tests.state_ctrl_click = { multiSelected: s.multiSelected, docsOpen: s.docsOpen };
      await reset(page, FIX);
      // CONTROL: ctrl+click the same state node's body
      g = await geomFor(page, targetId);
      await page.mouse.move(g.node.x + 8, g.node.cy);
      await page.keyboard.down('Control'); await page.mouse.down(); await page.mouse.up(); await page.keyboard.up('Control');
      await page.waitForTimeout(1200);
      s = await snap(page);
      out.tests.state_ctrl_click_body = { multiSelected: s.multiSelected, docsOpen: s.docsOpen };
      await reset(page, FIX);
      // connect mode from the other node onto the marker
      if (otherId) {
        const go = await geomFor(page, otherId);
        out.otherGeom = go;
        if (go.node) {
          await page.mouse.click(go.node.cx, go.node.cy, { button: 'right' });
          await page.waitForTimeout(800);
          const row = await clickMenuRow(page, '/Connect from here/i');
          await page.waitForTimeout(400);
          const armed = await page.evaluate(`document.body.classList.contains('connect-mode')`);
          g = await geomFor(page, targetId);
          await page.mouse.click(g.rect.cx, g.rect.cy);
          await page.waitForTimeout(1400);
          s = await snap(page);
          const esc = v => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          out.tests.state_connect_at_marker = {
            rowPressed: row, armed,
            edgeAdded: new RegExp(esc(otherId) + '\\s*-->\\s*' + esc(targetId)).test(s.source),
            docsOpen: s.docsOpen, connectStillArmed: s.connectArmed,
            source: s.source.replace(/\n/g, ' | ').slice(0, 400)
          };
        }
      }
    }
    out.errors = errors.slice(0, 20);
  } catch (e) {
    out.crash = String((e && e.stack) || e).slice(0, 900);
    out.errors = errors.slice(0, 20);
  }
  fs.writeFileSync(path.join(__dirname, 'be3_' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('done ' + TAG);
  await browser.close(); server.close(); process.exit(0);
})();
