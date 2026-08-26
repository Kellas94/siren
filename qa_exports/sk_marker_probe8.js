/* SKEPTIC probe 8 - connect mode armed from the block's own right-click menu, then a
 * real click on another block's marker. Round 13's repair must survive round 14.
 * Usage: node sk_marker_probe8.js <appPath> <port> <tag>
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
  await page.waitForTimeout(150);
  await ev(page, `
    if (document.body.classList.contains('connect-mode')) { const cm = document.getElementById('connectModeButton'); if (cm) cm.click(); }
    const wp = document.getElementById('wpWorkspace');
    if (wp && !wp.hidden) { const c = document.getElementById('closeWpButton'); if (c) c.click(); }
    const insp = document.getElementById('nodeInspector');
    if (insp && !insp.hidden) { const d = document.getElementById('inspectorDoneButton'); if (d) d.click(); }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
    const menu = document.querySelector('.struct-menu'); if (menu) menu.remove();
    return 1;`);
  await page.waitForTimeout(250);
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

(async () => {
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  out.errors = errors;
  try {
    await killTour(page);
    await lib.setSource(page, FIXTURE, 3200);
    await makeDoc(page, 'B');
    await reset(page);

    const gD = await geom(page, 'D');
    await page.mouse.click(gD.node.cx, gD.node.cy, { button: 'right' });
    await page.waitForTimeout(700);
    const row = await ev(page, `
      const items = Array.from(document.querySelectorAll('.struct-menu .struct-menu-item'));
      const hit = items.find(x => /Connect from here/i.test((x.textContent||'').trim()));
      if (!hit) return null;
      const r = hit.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, label: (hit.textContent||'').trim() };`);
    out.t.menuRow = row;
    if (row && row.w > 2) { await page.mouse.click(row.x, row.y); await page.waitForTimeout(600); }
    out.t.armed = await page.evaluate("document.body.classList.contains('connect-mode')");

    const before = await page.evaluate("document.getElementById('source').value");
    const gB = await geom(page, 'B');
    await page.mouse.click(gB.rect.cx, gB.rect.cy);
    await page.waitForTimeout(1100);
    const after = await page.evaluate("document.getElementById('source').value");
    out.t.connect_click_marker = {
      docsOpen: await page.evaluate("(() => { const w = document.getElementById('wpWorkspace'); return !!(w && !w.hidden); })()"),
      changed: before !== after,
      newLines: after.split('\n').filter(l => before.split('\n').indexOf(l) < 0).map(l => l.trim()),
      status: await page.evaluate("((document.getElementById('status')||{}).textContent||'').trim().slice(0,80)")
    };
    await reset(page);
    out.done = true;
  } catch (e) { out.fatal = String(e && e.stack || e).slice(0, 900); }
  fs.writeFileSync(path.join(HERE, 'sk8_' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('WROTE sk8_' + TAG + '.json fatal=' + (out.fatal || 'none') + ' errors=' + out.errors.length);
  await close();
  process.exit(0);
})();
