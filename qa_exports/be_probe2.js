/* JOB BE round 2: the controls the first pass was missing, and one step sideways.
 * Usage: node be_probe2.js <appPath> <port> <tag>
 */
const path = require('path'), fs = require('fs'), http = require('http');
const lib = require('./r7_lib.js');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');

const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4] || 'x';
const FIXTURE = ['flowchart TD', '  A[Alpha step] --> B[Bravo step]', '  B --> C[Charlie step]', '  D[Delta step] --> A'].join('\n');
const out = { app: APP, tag: TAG, tests: {}, errors: [] };

async function ev(page, expr) { return JSON.parse(await page.evaluate(`JSON.stringify((() => { ${expr} })())`)); }

async function snap(page) {
  return ev(page, `
    const wp = document.getElementById('wpWorkspace');
    const insp = document.getElementById('nodeInspector');
    const menu = document.querySelector('.struct-menu');
    const dlg = document.querySelector('dialog[open]');
    const inp = document.getElementById('canvasInplace');
    const note = document.getElementById('selectionNote');
    return {
      source: (document.getElementById('source')||{}).value || '',
      docsOpen: !!(wp && !wp.hidden),
      inspectorOpen: !!(insp && !insp.hidden),
      menuLabel: menu ? (menu.getAttribute('aria-label')||'') : null,
      menuRows: menu ? Array.from(menu.querySelectorAll('.struct-menu-heading, .struct-menu-item')).map(x=>(x.textContent||'').trim()).filter(Boolean).slice(0,20) : null,
      dialogId: dlg ? dlg.id : null,
      renameTitle: dlg ? ((document.getElementById('renameDialogTitle')||{}).textContent||'').trim() : '',
      inplaceOpen: !!(inp && !inp.hidden),
      inplaceValue: inp ? inp.value : null,
      inplaceFocused: !!(inp && document.activeElement === inp),
      multiSelected: document.querySelectorAll('#diagram .t-multi-selected').length,
      selectionNote: note && !note.hidden ? (note.textContent||'').trim() : '',
      markers: document.querySelectorAll('#diagram [data-t-workpaper-node]').length,
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
    for (const g of groups) { const gid = g.getAttribute('data-node-id') || g.getAttribute('id') || ''; if (gid === '${id}' || gid.indexOf('-${id}-') >= 0 || gid.slice(-2) === '-${id}') { nb = g.getBoundingClientRect(); break; } }
    const f = b => b ? { x:+b.x.toFixed(2), y:+b.y.toFixed(2), w:+b.width.toFixed(2), h:+b.height.toFixed(2), cx:+(b.x+b.width/2).toFixed(2), cy:+(b.y+b.height/2).toFixed(2) } : null;
    return { rect: f(r), node: f(nb) };
  `);
}

async function reset(page, fixture) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(140);
  await ev(page, `
    const inp = document.getElementById('canvasInplace'); if (inp && !inp.hidden) { inp.hidden = true; }
    if (document.body.classList.contains('connect-mode')) { const cm = document.getElementById('connectModeButton'); if (cm) cm.click(); }
    const wp = document.getElementById('wpWorkspace'); if (wp && !wp.hidden) { const c = document.getElementById('closeWpButton'); if (c) c.click(); }
    const insp = document.getElementById('nodeInspector'); if (insp && !insp.hidden) { const d = document.getElementById('inspectorDoneButton'); if (d) d.click(); }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
    const menu = document.querySelector('.struct-menu'); if (menu) menu.remove();
    return 1;
  `);
  await page.waitForTimeout(250);
  const src = await page.evaluate(`document.getElementById('source').value`);
  if (src.trim() !== fixture.trim()) await lib.setSource(page, fixture, 2400);
  await page.waitForTimeout(400);
}

async function clickMenuRow(page, re) {
  const box = await ev(page, `
    const items = Array.from(document.querySelectorAll('.struct-menu .struct-menu-item'));
    const hit = items.find(x => ${re}.test((x.textContent||'').trim()));
    if (!hit) return null;
    const r = hit.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, label: (hit.textContent||'').trim() };
  `);
  if (!box || box.w < 2) return null;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(500);
  return box.label;
}

async function makeDocOn(page, id) {
  const g = await geomFor(page, id);
  await page.mouse.click(g.node.cx, g.node.cy);
  await page.waitForTimeout(800);
  await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (d) { const det = d.closest('details'); if (det) det.open = true; d.scrollIntoView({ block: 'center' }); } return 1;`);
  await page.waitForTimeout(400);
  const b = await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, inView: r.top >= 0 && r.bottom <= innerHeight };`);
  if (b && b.w > 2 && b.inView) await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1400);
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
    await lib.setSource(page, FIXTURE, 3200);
    out.fixture = await page.evaluate(`document.getElementById('source').value`);
    await makeDocOn(page, 'B');
    await reset(page, FIXTURE);
    let g = await geomFor(page, 'B');
    out.geom = g;
    if (!g.rect) throw new Error('no marker');

    // ---- CONTROL: double-click the plain block body ----
    await reset(page, FIXTURE);
    g = await geomFor(page, 'B');
    await page.mouse.dblclick(g.node.x + 20, g.node.cy);
    await page.waitForTimeout(1000);
    let s = await snap(page);
    out.tests.dblclick_block_body = { inplaceOpen: s.inplaceOpen, inplaceValue: s.inplaceValue, focused: s.inplaceFocused, dialogId: s.dialogId, docsOpen: s.docsOpen };
    await reset(page, FIXTURE);

    // ---- double-click the marker, and then actually finish the rename ----
    g = await geomFor(page, 'B');
    await page.mouse.dblclick(g.rect.cx, g.rect.cy);
    await page.waitForTimeout(1000);
    s = await snap(page);
    out.tests.dblclick_marker = { inplaceOpen: s.inplaceOpen, inplaceValue: s.inplaceValue, focused: s.inplaceFocused, dialogId: s.dialogId, docsOpen: s.docsOpen };
    if (s.inplaceOpen && s.inplaceFocused) {
      await page.keyboard.press('Control+A');
      await page.keyboard.type('Renamed by marker');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1400);
      const s2 = await snap(page);
      out.tests.dblclick_marker.renameLanded = /Renamed by marker/.test(s2.source);
      out.tests.dblclick_marker.sourceAfter = s2.source.replace(/\n/g, ' | ');
      out.tests.dblclick_marker.docsOpenAfterRename = s2.docsOpen;
    } else if (s.dialogId === 'renameDialog') {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(900);
    out.tests.dblclick_marker.docsOpenedLate = (await snap(page)).docsOpen;
    await reset(page, FIXTURE);

    // ---- CONTROL: shift-click the plain block body ----
    g = await geomFor(page, 'B');
    await page.mouse.move(g.node.x + 20, g.node.cy);
    await page.keyboard.down('Shift'); await page.mouse.down(); await page.mouse.up(); await page.keyboard.up('Shift');
    await page.waitForTimeout(1000);
    s = await snap(page);
    out.tests.shift_click_block_body = { inspectorOpen: s.inspectorOpen, multiSelected: s.multiSelected, docsOpen: s.docsOpen };
    await reset(page, FIXTURE);

    // ---- the deferred open vs a right-click that arrives inside the wait ----
    g = await geomFor(page, 'B');
    await page.mouse.click(g.rect.cx, g.rect.cy);
    await page.waitForTimeout(120);
    await page.mouse.click(g.node.x + 20, g.node.cy, { button: 'right' });
    await page.waitForTimeout(1500);
    s = await snap(page);
    out.tests.click_then_rightclick = { docsOpen: s.docsOpen, menuLabel: s.menuLabel, note: 'docsOpen true = Docs opened on top of the menu the user asked for' };
    await page.keyboard.press('Escape');
    await reset(page, FIXTURE);

    // ---- the deferred open vs typing straight after the click ----
    g = await geomFor(page, 'B');
    await page.mouse.click(g.rect.cx, g.rect.cy);
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1600);
    s = await snap(page);
    out.tests.click_then_escape = { docsOpen: s.docsOpen };
    await reset(page, FIXTURE);

    // ---- ONE STEP SIDEWAYS: stateDiagram-v2 ----
    {
      await ev(page, `const sel = document.getElementById('diagramTypeSelect'); sel.value = 'state'; sel.dispatchEvent(new Event('change', { bubbles: true })); return sel.value;`);
      await page.waitForTimeout(400);
      const starter = await ev(page, `
        const b = Array.from(document.querySelectorAll('button')).find(x => /New starter/i.test((x.textContent||'').trim()));
        if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width };
      `);
      out.starterButton = starter;
      if (starter && starter.w > 2) await page.mouse.click(starter.x, starter.y);
      await page.waitForTimeout(600);
      const pressed = await lib.confirmDialog(page, 1400);
      out.starterConfirm = pressed;
      await page.waitForTimeout(2200);
      const src = await page.evaluate(`document.getElementById('source').value`);
      out.stateSource = src;
      out.stateIsState = /stateDiagram/.test(src);
      const nodes = await ev(page, `return Array.from(document.querySelectorAll('#diagram g.node, #diagram [data-node-id]')).map(g => g.getAttribute('data-node-id') || g.getAttribute('id'));`);
      out.stateNodes = nodes;
      if (out.stateIsState && nodes.length) {
        // pick a node id the app itself offers in the style target list
        const targetId = await ev(page, `
          const opts = Array.from((document.getElementById('nodeStyleTarget')||{options:[]}).options).map(o=>o.value).filter(Boolean);
          return opts[opts.length > 1 ? 1 : 0] || '';
        `);
        out.stateTargetId = targetId;
        if (targetId) {
          await makeDocOn(page, targetId);
          await reset(page, src);
          const gs = await geomFor(page, targetId);
          out.stateGeom = gs;
          if (gs.rect) {
            out.stateMarkerPctOfNode = { w: +(gs.rect.w / gs.node.w * 100).toFixed(1), h: +(gs.rect.h / gs.node.h * 100).toFixed(1) };
            // right-click at the marker on a state node
            await page.mouse.click(gs.rect.cx, gs.rect.cy, { button: 'right' });
            await page.waitForTimeout(900);
            const s3 = await snap(page);
            out.tests.state_rightclick_marker = { menuLabel: s3.menuLabel, menuRows: s3.menuRows };
            await page.keyboard.press('Escape');
            await reset(page, src);
            // plain click at the marker on a state node
            const gs2 = await geomFor(page, targetId);
            await page.mouse.click(gs2.rect.cx, gs2.rect.cy);
            let opened = false, ms = -1; const t0 = Date.now();
            for (let i = 0; i < 30; i++) { await page.waitForTimeout(50); const q = await snap(page); if (q.docsOpen) { opened = true; ms = Date.now() - t0; break; } }
            out.tests.state_plain_click = { docsOpen: opened, msToOpen: ms };
            await reset(page, src);
            // connect mode at the marker on a state node
            const gs3 = await geomFor(page, targetId);
            const other = await ev(page, `
              const opts = Array.from((document.getElementById('nodeStyleTarget')||{options:[]}).options).map(o=>o.value).filter(Boolean);
              return opts.find(v => v !== '${targetId}') || '';
            `);
            out.stateOtherId = other;
            if (other) {
              const go = await geomFor(page, other);
              if (go.node) {
                await page.mouse.click(go.node.cx, go.node.cy, { button: 'right' });
                await page.waitForTimeout(700);
                const row = await clickMenuRow(page, '/Connect from here/i');
                await page.waitForTimeout(400);
                const armed = await page.evaluate(`document.body.classList.contains('connect-mode')`);
                await page.mouse.click(gs3.rect.cx, gs3.rect.cy);
                await page.waitForTimeout(1200);
                const s4 = await snap(page);
                out.tests.state_connect_at_marker = {
                  rowPressed: row, armed,
                  edgeAdded: new RegExp(other.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*-->\\s*' + targetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(s4.source),
                  docsOpen: s4.docsOpen, source: s4.source.replace(/\n/g, ' | ').slice(0, 300)
                };
              }
            }
          } else {
            out.tests.state_marker = 'no marker rendered on the state node';
          }
        }
      }
    }
    out.errors = errors.slice(0, 20);
  } catch (e) {
    out.crash = String((e && e.stack) || e).slice(0, 900);
    out.errors = errors.slice(0, 20);
  }
  fs.writeFileSync(path.join(__dirname, 'be2_' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('JSON_OUT ' + JSON.stringify(out).slice(0, 200));
  await browser.close(); server.close(); process.exit(0);
})();
