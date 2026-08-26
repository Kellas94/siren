/* SKEPTIC probe 4 - deletion 2 (drag-suppress ordering) and deletion 3 (marker excluded
 * from the body press). Every gesture is real mouse input.
 * Usage: node sk_marker_probe4.js <appPath> <port> <tag>
 */
const path = require('path');
const fs = require('fs');
const lib = require('./r7_lib.js');

const APP = process.argv[2];
const PORT = Number(process.argv[3]);
const TAG = process.argv[4] || 'x';
const HERE = __dirname;

const FIXTURE = [
  'flowchart TD',
  '  A[Alpha step] --> B[Bravo step]',
  '  B --> C[Charlie step]',
  '  D[Delta step] --> A'
].join('\n');

const out = { app: APP, tag: TAG, t: {}, errors: [] };

async function ev(page, expr) {
  return JSON.parse(await page.evaluate('JSON.stringify((() => { ' + expr + ' })())'));
}

async function killTour(page) {
  for (let i = 0; i < 20; i++) {
    const gone = await ev(page, `
      const card = document.querySelector('.tour-card');
      if (!card) return true;
      const b = Array.from(card.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || card.querySelector('button');
      if (b) b.click();
      return false;`);
    if (gone && i > 4) return;
    await page.waitForTimeout(150);
  }
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
    const ip = document.getElementById('canvasInplace'); if (ip) { ip.blur(); }
    const z = document.getElementById('zoomViewport'); if (z) { z.scrollLeft = 0; z.scrollTop = 0; }
    return 1;`);
  await page.waitForTimeout(240);
  const src = await page.evaluate("document.getElementById('source').value");
  if (src.trim() !== FIXTURE.trim()) await lib.setSource(page, FIXTURE, 2600);
  await page.waitForTimeout(420);
}

async function geom(page, id) {
  return ev(page, `
    const m = document.querySelector('#diagram [data-t-workpaper-node="${id}"]');
    const rect = m ? m.querySelector('rect') : null;
    const groups = Array.from(document.querySelectorAll('#diagram g.node, #diagram [data-node-id]'));
    let nodeBox = null;
    for (const grp of groups) {
      const gid = grp.getAttribute('data-node-id') || grp.getAttribute('id') || '';
      if (gid === '${id}' || gid.indexOf('-${id}-') >= 0 || gid.slice(-2) === '-${id}') { nodeBox = grp.getBoundingClientRect(); break; }
    }
    const f = v => v === null ? null : +Number(v).toFixed(2);
    const box = b => b ? { x: f(b.x), y: f(b.y), w: f(b.width), h: f(b.height), cx: f(b.x + b.width/2), cy: f(b.y + b.height/2) } : null;
    return { rect: box(rect ? rect.getBoundingClientRect() : null), node: box(nodeBox) };`);
}

async function makeDoc(page, id) {
  await reset(page);
  const g = await geom(page, id);
  await page.mouse.click(g.node.cx, g.node.cy);
  await page.waitForTimeout(700);
  await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (d) { const det = d.closest('details'); if (det) det.open = true; d.scrollIntoView({block:'center'}); } return 1;`);
  await page.waitForTimeout(350);
  const b = await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width };`);
  if (b && b.w > 2) await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1400);
  await reset(page);
  await page.waitForTimeout(400);
}

async function edgeMid(page, from, to) {
  return ev(page, `
    let p = null;
    const keyed = Array.from(document.querySelectorAll('#diagram [data-edge-key]'));
    for (const g of keyed) {
      const parts = String(g.getAttribute('data-edge-key')||'').split('|');
      if (parts[0] === '${from}' && parts[2] === '${to}') { p = g.querySelector('path'); break; }
    }
    if (!p) {
      p = Array.from(document.querySelectorAll('#diagram path')).find(x => {
        const id = x.getAttribute('id') || '';
        return id.indexOf('${from}') >= 0 && id.indexOf('${to}') >= 0 && id.indexOf('L') === 0;
      }) || null;
    }
    if (!p || !p.getPointAtLength) return null;
    const pt = p.getPointAtLength(p.getTotalLength() / 2);
    const m = p.getScreenCTM();
    return { x: +(pt.x * m.a + pt.y * m.c + m.e).toFixed(2), y: +(pt.x * m.b + pt.y * m.d + m.f).toFixed(2), id: p.getAttribute('id') || '' };`);
}

async function docsOpen(page) {
  return page.evaluate("(() => { const w = document.getElementById('wpWorkspace'); return !!(w && !w.hidden); })()");
}

async function src(page) { return page.evaluate("document.getElementById('source').value"); }

async function drag(page, from, to, steps = 24, holdMs = 90) {
  await page.mouse.move(from.x, from.y);
  await page.waitForTimeout(40);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.move(from.x + (to.x - from.x) * 0.25, from.y + (to.y - from.y) * 0.25, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: steps });
  await page.waitForTimeout(160);
  await page.mouse.up();
  await page.waitForTimeout(900);
}

(async () => {
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  out.errors = errors;
  try {
    await killTour(page);
    await lib.setSource(page, FIXTURE, 3200);
    await makeDoc(page, 'B');
    out.fixtureSource = await src(page);

    // ---------- deletion 3: drag the block by its marker corner ----------
    async function spliceTest(name, pick) {
      await reset(page);
      const g = await geom(page, 'B');
      const e = await edgeMid(page, 'D', 'A');
      if (!g.rect || !e) { out.t[name] = { skipped: true, rect: !!g.rect, edge: !!e }; return; }
      const before = await src(page);
      const from = pick(g);
      await drag(page, from, e);
      const after = await src(page);
      out.t[name] = {
        from, edge: e, changed: before !== after, docsOpened: await docsOpen(page),
        after: after.replace(/\n/g, ' | ').slice(0, 160)
      };
      await reset(page);
    }
    await spliceTest('splice_from_marker', g => ({ x: g.rect.cx, y: g.rect.cy }));
    await spliceTest('splice_from_body', g => ({ x: g.node.x + 16, y: g.node.cy }));

    // ghost feedback while pressing on the marker
    {
      await reset(page);
      const g = await geom(page, 'B');
      await page.mouse.move(g.rect.cx, g.rect.cy);
      await page.mouse.down();
      await page.waitForTimeout(80);
      await page.mouse.move(g.rect.cx - 60, g.rect.cy + 60, { steps: 12 });
      await page.waitForTimeout(200);
      out.t.press_marker_feedback = await ev(page, `return {
        ghost: document.querySelectorAll('.canvas-move-ghost').length,
        moving: document.body.classList.contains('is-canvas-moving') };`);
      await page.mouse.up();
      await page.waitForTimeout(500);
      out.t.press_marker_feedback.docsAfterAwayRelease = await docsOpen(page);
      await reset(page);
    }

    // ---------- deletion 2: body drag then a deliberate marker click ----------
    {
      await reset(page);
      const gB = await geom(page, 'B'), gC = await geom(page, 'C');
      await page.mouse.move(gC.node.cx, gC.node.cy);
      await page.mouse.down();
      await page.mouse.move(gC.node.cx + 40, gC.node.cy + 60, { steps: 8 });
      await page.mouse.move(gC.node.cx + 120, gC.node.cy + 130, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(15);
      const t0 = Date.now();
      await page.mouse.click(gB.rect.cx, gB.rect.cy);
      let ms = -1;
      for (let i = 0; i < 200; i++) { if (await docsOpen(page)) { ms = Date.now() - t0; break; } await page.waitForTimeout(5); }
      out.t.drag_then_marker_click = { ms, opened: ms >= 0 };
      await reset(page);
    }

    // the case the deleted guard was written for: a body drag that RELEASES on a marker
    {
      await reset(page);
      const gB = await geom(page, 'B'), gC = await geom(page, 'C');
      await drag(page, { x: gC.node.cx, y: gC.node.cy }, { x: gB.rect.cx, y: gB.rect.cy });
      out.t.body_drag_release_on_marker = { docsOpen: await docsOpen(page), src: (await src(page)).replace(/\n/g, ' | ').slice(0, 120) };
      await reset(page);
    }
    // and one that releases on its OWN marker
    {
      await reset(page);
      const gB = await geom(page, 'B');
      await drag(page, { x: gB.node.x + 16, y: gB.node.cy }, { x: gB.rect.cx, y: gB.rect.cy });
      out.t.own_body_drag_release_on_own_marker = { docsOpen: await docsOpen(page) };
      await reset(page);
    }

    // wobble inside the marker
    {
      await reset(page);
      const gB = await geom(page, 'B');
      const t0 = Date.now();
      await page.mouse.move(gB.rect.cx, gB.rect.cy);
      await page.mouse.down();
      await page.waitForTimeout(60);
      await page.mouse.move(gB.rect.cx - 4, gB.rect.cy + 3);
      await page.mouse.move(gB.rect.cx - 7, gB.rect.cy + 6);
      await page.mouse.up();
      let ms = -1;
      for (let i = 0; i < 200; i++) { if (await docsOpen(page)) { ms = Date.now() - t0; break; } await page.waitForTimeout(5); }
      out.t.wobble_9px = { opened: ms >= 0, ms };
      await reset(page);
    }

    // press on the marker, wander, come back, release on the marker
    {
      await reset(page);
      const gB = await geom(page, 'B');
      await page.mouse.move(gB.rect.cx, gB.rect.cy);
      await page.mouse.down();
      await page.mouse.move(gB.rect.cx - 60, gB.rect.cy + 40, { steps: 10 });
      await page.mouse.move(gB.rect.cx, gB.rect.cy, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(700);
      out.t.wander_and_return = { docsOpen: await docsOpen(page) };
      await reset(page);
    }

    // ---------- round 11's feature underneath: the marker still delivers ----------
    {
      await reset(page);
      const gB = await geom(page, 'B');
      const t0 = Date.now();
      await page.mouse.click(gB.rect.cx, gB.rect.cy);
      let ms = -1;
      for (let i = 0; i < 300; i++) { if (await docsOpen(page)) { ms = Date.now() - t0; break; } await page.waitForTimeout(5); }
      out.t.plain_click = { ms, title: await page.evaluate("(document.getElementById('wpTitle')||{}).value || ''") };
      await reset(page);
    }

    // ctrl+click and right-click still reach the block through the marker
    {
      await reset(page);
      const gB = await geom(page, 'B');
      await page.keyboard.down('Control');
      await page.mouse.click(gB.rect.cx, gB.rect.cy);
      await page.keyboard.up('Control');
      await page.waitForTimeout(600);
      out.t.ctrl_click = await ev(page, `return {
        docsOpen: !!(document.getElementById('wpWorkspace') && !document.getElementById('wpWorkspace').hidden),
        ring: document.querySelectorAll('#diagram .t-multi-selected').length,
        styleTarget: (document.getElementById('nodeStyleTarget')||{}).value || '' };`);
      await reset(page);
      const g2 = await geom(page, 'B');
      await page.mouse.click(g2.rect.cx, g2.rect.cy, { button: 'right' });
      await page.waitForTimeout(700);
      out.t.right_click = await ev(page, `
        const m = document.querySelector('.struct-menu');
        return { rows: m ? Array.from(m.querySelectorAll('.struct-menu-item,.struct-menu-heading')).map(x=>(x.textContent||'').replace(/\\s+/g,' ').trim()).slice(0,12) : null,
                 docsOpen: !!(document.getElementById('wpWorkspace') && !document.getElementById('wpWorkspace').hidden) };`);
      await reset(page);
    }

    out.done = true;
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 900);
  }
  fs.writeFileSync(path.join(HERE, 'sk4_' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('WROTE sk4_' + TAG + '.json fatal=' + (out.fatal || 'none') + ' errors=' + out.errors.length);
  await close();
  process.exit(0);
})();
