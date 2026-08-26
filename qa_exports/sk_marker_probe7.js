/* SKEPTIC probe 7 - the marker on a diagram type that is NOT a flowchart.
 * Reach the type through #diagramTypeSelect + the "New starter" control found BY LABEL,
 * confirm the dialog, then ASSERT the fixture by reading #source before measuring.
 * Usage: node sk_marker_probe7.js <appPath> <port> <tag>
 */
const path = require('path');
const fs = require('fs');
const lib = require('./r7_lib.js');

const APP = process.argv[2];
const PORT = Number(process.argv[3]);
const TAG = process.argv[4] || 'x';
const HERE = __dirname;
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
async function softReset(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(140);
  await ev(page, `
    const wp = document.getElementById('wpWorkspace');
    if (wp && !wp.hidden) { const c = document.getElementById('closeWpButton'); if (c) c.click(); }
    const insp = document.getElementById('nodeInspector');
    if (insp && !insp.hidden) { const d = document.getElementById('inspectorDoneButton'); if (d) d.click(); }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
    const menu = document.querySelector('.struct-menu'); if (menu) menu.remove();
    const ip = document.getElementById('canvasInplace'); if (ip) ip.blur();
    return 1;`);
  await page.waitForTimeout(250);
}

async function switchType(page, value) {
  await softReset(page);
  await ev(page, `
    const s = document.getElementById('diagramTypeSelect');
    if (!s) return null;
    s.value = ${JSON.stringify(value)};
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return 1;`);
  await page.waitForTimeout(900);
  // the New starter control, BY LABEL
  const btn = await ev(page, `
    const all = Array.from(document.querySelectorAll('button'));
    const hit = all.find(b => /new starter/i.test((b.getAttribute('aria-label')||'') + ' ' + (b.title||'') + ' ' + (b.textContent||'')));
    if (!hit) return null;
    const r = hit.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height, label: (hit.textContent||'').replace(/\\s+/g,' ').trim() };`);
  if (btn && btn.w > 2) { await page.mouse.click(btn.x, btn.y); await page.waitForTimeout(500); }
  const pressed = await lib.confirmDialog(page, 1200);
  await page.waitForTimeout(2200);
  const src = await page.evaluate("document.getElementById('source').value");
  return { btn, pressed, firstLine: src.split('\n')[0].trim(), src: src.slice(0, 120) };
}

async function nodes(page) {
  return ev(page, `
    const f = v => +Number(v).toFixed(2);
    return Array.from(document.querySelectorAll('#diagram g.node, #diagram [data-node-id]')).map(g => {
      const b = g.getBoundingClientRect();
      return { id: g.getAttribute('data-node-id') || g.getAttribute('id') || '', cx: f(b.x + b.width/2), cy: f(b.y + b.height/2), w: f(b.width), h: f(b.height) };
    }).filter(n => n.w > 30 && n.h > 16);`);
}

async function markers(page) {
  return ev(page, `
    const f = v => +Number(v).toFixed(2);
    return Array.from(document.querySelectorAll('#diagram [data-t-workpaper-node]')).map(m => {
      const r = m.querySelector('rect').getBoundingClientRect();
      return { id: m.getAttribute('data-t-workpaper-node'), cx: f(r.x + r.width/2), cy: f(r.y + r.height/2), w: f(r.width) };
    });`);
}

async function docsOpen(page) { return page.evaluate("(() => { const w = document.getElementById('wpWorkspace'); return !!(w && !w.hidden); })()"); }

(async () => {
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  out.errors = errors;
  try {
    await killTour(page);
    out.t.types = await ev(page, `
      const s = document.getElementById('diagramTypeSelect');
      return s ? Array.from(s.options).map(o => o.value + '=' + o.textContent.trim()) : null;`);

    const SRC = {
      state: 'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review\n  Review --> Approved\n  Approved --> [*]',
      class: 'classDiagram\n  class Auditor {\n    +review()\n  }\n  class Engagement {\n    +plan()\n  }\n  Auditor --> Engagement',
      swimlane: 'flowchart LR\n  subgraph Field team\n    A[Collect evidence] --> B[Sample items]\n  end\n  subgraph Review\n    B --> C[Sign off]\n  end'
    };
    for (const type of ['state', 'class', 'swimlane']) {
      const key = 'type_' + type;
      await softReset(page);
      await lib.setSource(page, SRC[type], 3400);
      const realSrc = await page.evaluate("document.getElementById('source').value");
      const sw = { firstLine: realSrc.split('\n')[0].trim(), src: realSrc.slice(0, 90) };
      out.t[key] = { switched: sw, assertedFixture: realSrc.trim() === SRC[type].trim() };
      if (!out.t[key].assertedFixture) { out.t[key].note = 'fixture did not stick'; continue; }
      const ns = await nodes(page);
      out.t[key].nodes = ns.slice(0, 6);
      if (!ns.length) { out.t[key].note = 'no node boxes'; continue; }
      // create a document on the first node through the inspector
      await page.mouse.click(ns[0].cx, ns[0].cy);
      await page.waitForTimeout(900);
      out.t[key].inspectorOpen = await page.evaluate("(() => { const i = document.getElementById('nodeInspector'); return !!(i && !i.hidden); })()");
      await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (d) { const det = d.closest('details'); if (det) det.open = true; d.scrollIntoView({block:'center'}); } return 1;`);
      await page.waitForTimeout(350);
      const b = await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width };`);
      out.t[key].docButton = b;
      if (b && b.w > 2) { await page.mouse.click(b.x, b.y); await page.waitForTimeout(1500); }
      await softReset(page);
      await page.waitForTimeout(600);
      const mk = await markers(page);
      out.t[key].markers = mk;
      if (!mk.length) { out.t[key].note = 'no marker rendered on this type'; continue; }
      // plain click -> time to Docs
      const t0 = Date.now();
      await page.mouse.click(mk[0].cx, mk[0].cy);
      let ms = -1;
      for (let i = 0; i < 300; i++) { if (await docsOpen(page)) { ms = Date.now() - t0; break; } await page.waitForTimeout(5); }
      out.t[key].click_ms = ms;
      await softReset(page);
      await page.waitForTimeout(500);
      // real double-click
      const mk2 = await markers(page);
      await page.mouse.dblclick(mk2[0].cx, mk2[0].cy);
      await page.waitForTimeout(1000);
      out.t[key].dbl = await ev(page, `
        const a = document.activeElement;
        return { docsOpen: !!(document.getElementById('wpWorkspace') && !document.getElementById('wpWorkspace').hidden),
                 inplace: (document.getElementById('canvasInplace')||{}).value || null,
                 active: a ? ((a.tagName||'').toLowerCase() + (a.id ? '#'+a.id : '') + ' ' + (a.getAttribute('aria-label')||'')) : null,
                 inDoc: !!(a && a.closest && a.closest('#wpWorkspace')) };`);
      await page.screenshot({ path: path.join(HERE, 'sk7_' + TAG + '_' + type + '.png') });
      await softReset(page);
    }
    out.done = true;
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 900);
  }
  fs.writeFileSync(path.join(HERE, 'sk7_' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('WROTE sk7_' + TAG + '.json fatal=' + (out.fatal || 'none') + ' errors=' + out.errors.length);
  await close();
  process.exit(0);
})();
