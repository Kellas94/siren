/* SKEPTIC probe 6 - is the wobble fix reliable? Repeat the same gesture in isolation.
 * Usage: node sk_marker_probe6.js <appPath> <port> <tag>
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

async function ev(page, expr) { return JSON.parse(await page.evaluate('JSON.stringify((() => { ' + expr + ' })())')); }
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
async function docsOpen(page) { return page.evaluate("(() => { const w = document.getElementById('wpWorkspace'); return !!(w && !w.hidden); })()"); }

(async () => {
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  out.errors = errors;
  try {
    await killTour(page);
    await lib.setSource(page, FIXTURE, 3200);
    await makeDoc(page, 'B');

    async function wobble(dx, dy, waitBeforeUp) {
      await reset(page);
      const g = await geom(page, 'B');
      await page.mouse.move(g.rect.cx, g.rect.cy);
      await page.mouse.down();
      await page.waitForTimeout(60);
      await page.mouse.move(g.rect.cx + dx / 2, g.rect.cy + dy / 2);
      await page.mouse.move(g.rect.cx + dx, g.rect.cy + dy);
      if (waitBeforeUp) await page.waitForTimeout(waitBeforeUp);
      await page.mouse.up();
      await page.waitForTimeout(650);
      const o = await docsOpen(page);
      await reset(page);
      return o;
    }
    out.t.wobble_7_6_wait40 = [];
    for (let i = 0; i < 5; i++) out.t.wobble_7_6_wait40.push(await wobble(-7, 6, 40));
    out.t.wobble_7_6_nowait = [];
    for (let i = 0; i < 5; i++) out.t.wobble_7_6_nowait.push(await wobble(-7, 6, 0));
    out.t.wobble_8_8 = [];
    for (let i = 0; i < 3; i++) out.t.wobble_8_8.push(await wobble(-8, 8, 40));

    // press on the marker, wander 60px, come back, release on the marker
    out.t.wander = [];
    for (let i = 0; i < 3; i++) {
      await reset(page);
      const g = await geom(page, 'B');
      await page.mouse.move(g.rect.cx, g.rect.cy);
      await page.mouse.down();
      await page.waitForTimeout(50);
      await page.mouse.move(g.rect.cx - 60, g.rect.cy + 40, { steps: 10 });
      await page.mouse.move(g.rect.cx, g.rect.cy, { steps: 10 });
      await page.waitForTimeout(40);
      await page.mouse.up();
      await page.waitForTimeout(700);
      out.t.wander.push(await docsOpen(page));
      await reset(page);
    }

    // a wobble that leaves the marker but stays on the block
    out.t.wobble_off_marker = [];
    for (let i = 0; i < 2; i++) out.t.wobble_off_marker.push(await wobble(-30, 10, 40));

    out.done = true;
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 900);
  }
  fs.writeFileSync(path.join(HERE, 'sk6_' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('WROTE sk6_' + TAG + '.json fatal=' + (out.fatal || 'none') + ' errors=' + out.errors.length);
  await close();
  process.exit(0);
})();
