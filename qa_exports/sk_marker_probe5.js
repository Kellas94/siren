/* SKEPTIC probe 5 - instrument the raw events during a wobble on the marker, and
 * find the real connector ids so the splice test is not aimed at the wrong edge.
 * Usage: node sk_marker_probe5.js <appPath> <port> <tag>
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
    const wp = document.getElementById('wpWorkspace');
    if (wp && !wp.hidden) { const c = document.getElementById('closeWpButton'); if (c) c.click(); }
    const insp = document.getElementById('nodeInspector');
    if (insp && !insp.hidden) { const d = document.getElementById('inspectorDoneButton'); if (d) d.click(); }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
    const menu = document.querySelector('.struct-menu'); if (menu) menu.remove();
    const z = document.getElementById('zoomViewport'); if (z) { z.scrollLeft = 0; z.scrollTop = 0; }
    return 1;`);
  await page.waitForTimeout(240);
  const s = await page.evaluate("document.getElementById('source').value");
  if (s.trim() !== FIXTURE.trim()) await lib.setSource(page, FIXTURE, 2600);
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

async function arm(page) {
  await page.evaluate(`(() => {
    window.__trace = [];
    const desc = n => {
      if (!n) return 'null';
      if (n.nodeType !== 1) return String(n.nodeName);
      const t = n.tagName.toLowerCase();
      const mk = n.closest && n.closest('[data-t-workpaper-node]');
      return t + (n.id ? '#' + n.id : '') + (mk ? ' [MARKER:' + mk.getAttribute('data-t-workpaper-node') + ']' : '') + (n.isConnected ? '' : ' DETACHED');
    };
    ['pointerdown','pointerup','mousedown','mouseup','click','dblclick'].forEach(type => {
      document.addEventListener(type, e => {
        window.__trace.push({ type: type, target: desc(e.target), detail: e.detail === undefined ? null : e.detail,
                              x: Math.round(e.clientX), y: Math.round(e.clientY), dp: e.defaultPrevented });
      }, true);
    });
    return 1;
  })()`);
}

(async () => {
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  out.errors = errors;
  try {
    await killTour(page);
    await lib.setSource(page, FIXTURE, 3200);
    await makeDoc(page, 'B');

    out.t.edges = await ev(page, `
      const keys = Array.from(document.querySelectorAll('#diagram [data-edge-key]')).map(g => g.getAttribute('data-edge-key'));
      const ids = Array.from(document.querySelectorAll('#diagram path')).map(p => p.getAttribute('id')).filter(Boolean);
      return { keys, ids };`);

    // ---- wobble, fully traced ----
    for (const px of [[0, 0], [-3, 2], [-7, 6]]) {
      await reset(page);
      const g = await geom(page, 'B');
      await arm(page);
      await page.mouse.move(g.rect.cx, g.rect.cy);
      await page.mouse.down();
      await page.waitForTimeout(60);
      if (px[0] || px[1]) {
        await page.mouse.move(g.rect.cx + px[0] / 2, g.rect.cy + px[1] / 2);
        await page.mouse.move(g.rect.cx + px[0], g.rect.cy + px[1]);
      }
      await page.waitForTimeout(40);
      await page.mouse.up();
      await page.waitForTimeout(800);
      out.t['wobble_' + px[0] + '_' + px[1]] = {
        markerRect: g.rect,
        docsOpen: await page.evaluate("(() => { const w = document.getElementById('wpWorkspace'); return !!(w && !w.hidden); })()"),
        trace: await page.evaluate("JSON.stringify(window.__trace || [])").then(JSON.parse)
      };
      await reset(page);
    }

    // ---- splice from the marker, aimed at a connector the block is NOT part of ----
    async function spliceTest(name, blockId, from, to, pick) {
      await reset(page);
      const g = await geom(page, blockId);
      const e = await ev(page, `
        let p = null;
        const keyed = Array.from(document.querySelectorAll('#diagram [data-edge-key]'));
        for (const gg of keyed) {
          const parts = String(gg.getAttribute('data-edge-key')||'').split('|');
          if (parts[0] === '${from}' && parts[parts.length-1] === '${to}') { p = gg.querySelector('path'); break; }
        }
        if (!p) p = Array.from(document.querySelectorAll('#diagram path')).find(x => /L_${from}_${to}_/.test(x.getAttribute('id')||'')) || null;
        if (!p || !p.getPointAtLength) return null;
        const pt = p.getPointAtLength(p.getTotalLength()/2);
        const m = p.getScreenCTM();
        return { x: +(pt.x*m.a + pt.y*m.c + m.e).toFixed(2), y: +(pt.x*m.b + pt.y*m.d + m.f).toFixed(2), id: p.getAttribute('id')||'' };`);
      if (!e || !g.rect) { out.t[name] = { skipped: true, e, hasMarker: !!g.rect }; return; }
      const before = await page.evaluate("document.getElementById('source').value");
      const start = pick(g);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.waitForTimeout(90);
      await page.mouse.move((start.x + e.x) / 2, (start.y + e.y) / 2, { steps: 8 });
      await page.mouse.move(e.x, e.y, { steps: 14 });
      await page.waitForTimeout(200);
      const mid = await ev(page, `return { ghost: document.querySelectorAll('.canvas-move-ghost').length, moving: document.body.classList.contains('is-canvas-moving'),
        ghostText: (document.querySelector('.canvas-move-ghost')||{}).textContent || '' };`);
      await page.mouse.up();
      await page.waitForTimeout(1000);
      const after = await page.evaluate("document.getElementById('source').value");
      out.t[name] = { start, edge: e, mid, changed: before !== after, after: after.replace(/\n/g, ' | ').slice(0, 170) };
      await reset(page);
    }
    await spliceTest('splice_D_marker_onto_BC', 'B', 'B', 'C', g => ({ x: g.rect.cx, y: g.rect.cy }));
    await spliceTest('splice_B_marker_onto_DA', 'B', 'D', 'A', g => ({ x: g.rect.cx, y: g.rect.cy }));
    await spliceTest('splice_B_body_onto_DA', 'B', 'D', 'A', g => ({ x: g.node.x + 16, y: g.node.cy }));

    out.done = true;
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 900);
  }
  fs.writeFileSync(path.join(HERE, 'sk5_' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('WROTE sk5_' + TAG + '.json fatal=' + (out.fatal || 'none') + ' errors=' + out.errors.length);
  await close();
  process.exit(0);
})();
