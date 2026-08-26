/* Probe 6 - one honest attempt to build a three-press Escape ladder without a
 * native popup, and the tour's own step counter.
 */
const L = require('C:/Claude/SIREN/qa_exports/sk14_lib.js');
const BUILD = process.argv[2], PORT = Number(process.argv[3]), FILE = process.argv[4];

const NODE_BOX = `(() => {
  const g = Array.from(document.querySelectorAll('#diagram svg g.node'));
  return JSON.stringify(g.map(n => { const r = n.getBoundingClientRect();
    return { label: (n.textContent||'').trim().slice(0,24), x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height }; })
    .filter(n => n.w > 4 && n.h > 4));
})()`;

const READ = `(() => { const q = id => document.getElementById(id);
  const vis = e => { if (!e || e.hidden) return false; const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  return JSON.stringify({ tour: !!document.querySelector('.tour-card'),
    insp: vis(q('nodeInspector')), filter: vis(q('filterPanel')), find: vis(q('findReplacePanel')),
    active: document.activeElement ? document.activeElement.tagName + '#' + (document.activeElement.id||'') : 'none' }); })()`;

async function clickById(page, id) {
  const box = JSON.parse(await page.evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)});
    if (!e) return JSON.stringify(null); e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return JSON.stringify(null);
    return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2 }); })()`));
  if (!box) return false;
  await page.mouse.click(box.x, box.y); await page.waitForTimeout(250); return true;
}

const out = { build: BUILD, s: {} };
async function step(name, browser, fn) {
  const { page, ctx, errors } = await L.freshPage(browser, PORT, FILE);
  try { await L.waitTour(page); out.s[name] = await fn(page); out.s[name].errors = errors.slice(); }
  catch (e) { out.s[name] = { crashed: String(e.message).slice(0, 200), errors: errors.slice() }; }
  await ctx.close();
}

(async () => {
  const server = L.serve(BUILD, PORT);
  const browser = await L.launch();

  // filter panel + block inspector: two global Escape owners, checked in that order
  await step('V1_filterPlusInspector', browser, async (page) => {
    const openedFilter = await clickById(page, 'filterButton');
    await page.waitForTimeout(500);
    const nodes = JSON.parse(await page.evaluate(NODE_BOX));
    const n = nodes.find(x => /Beneficiaries/.test(x.label)) || nodes[0];
    // only click if the point really is a diagram node
    const hit = await page.evaluate(`(() => { const e = document.elementFromPoint(${n.x}, ${n.y});
      return e ? (e.closest('g.node') ? 'node' : e.tagName) : 'none'; })()`);
    if (hit === 'node') { await page.mouse.click(n.x, n.y); await page.waitForTimeout(600); }
    const before = JSON.parse(await page.evaluate(READ));
    const trail = []; let died = -1;
    for (let i = 1; i <= 6; i++) {
      await page.keyboard.press('Escape'); await page.waitForTimeout(320);
      const st = JSON.parse(await page.evaluate(READ));
      trail.push({ p: i, ...st });
      if (!st.tour) { died = i; break; }
    }
    return { openedFilter, nodeHit: hit, before, diedOnPress: died, trail };
  });

  // filter panel + find panel + inspector
  await step('V2_threeOwners', browser, async (page) => {
    await clickById(page, 'filterButton'); await page.waitForTimeout(400);
    await page.keyboard.press('Control+f'); await page.waitForTimeout(400);
    const nodes = JSON.parse(await page.evaluate(NODE_BOX));
    const n = nodes.find(x => /Beneficiaries/.test(x.label)) || nodes[0];
    const hit = await page.evaluate(`(() => { const e = document.elementFromPoint(${n.x}, ${n.y});
      return e ? (e.closest('g.node') ? 'node' : e.tagName) : 'none'; })()`);
    if (hit === 'node') { await page.mouse.click(n.x, n.y); await page.waitForTimeout(600); }
    const before = JSON.parse(await page.evaluate(READ));
    const trail = []; let died = -1;
    for (let i = 1; i <= 6; i++) {
      await page.keyboard.press('Escape'); await page.waitForTimeout(320);
      const st = JSON.parse(await page.evaluate(READ));
      trail.push({ p: i, ...st });
      if (!st.tour) { died = i; break; }
    }
    return { nodeHit: hit, before, diedOnPress: died, trail };
  });

  // the tour's own counter: which of the six advertised steps actually appear
  await step('V3_stepCounter', browser, async (page) => {
    const seen = [];
    for (let i = 0; i < 10; i++) {
      const st = JSON.parse(await page.evaluate(`(() => { const c = document.querySelector('.tour-card');
        if (!c) return JSON.stringify(null);
        const h = c.querySelector('strong');
        const nx = Array.from(c.querySelectorAll('button')).find(b => /next|done/i.test(b.textContent));
        const r = nx ? nx.getBoundingClientRect() : null;
        return JSON.stringify({ heading: h ? h.textContent : '', label: nx ? nx.textContent.trim() : null,
          x: r ? r.left + r.width/2 : null, y: r ? r.top + r.height/2 : null }); })()`));
      if (!st) break;
      seen.push({ heading: st.heading, button: st.label });
      if (st.x == null) break;
      await page.mouse.click(st.x, st.y);
      await page.waitForTimeout(300);
    }
    return { headingsSeen: seen, lastHeading: seen.length ? seen[seen.length-1].heading : null,
      cardGone: !(await L.tourUp(page)) };
  });

  console.log('SK14_P6 ' + JSON.stringify(out));
  await browser.close(); server.close();
})().catch(e => { console.error('FATAL', e); console.log('SK14_P6 ' + JSON.stringify(out)); process.exit(0); });
