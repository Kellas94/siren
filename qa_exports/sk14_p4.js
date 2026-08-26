/* Probe 4 - why the Escape ladder is longer than reported, whether the Tab the
 * deletion hands back can eat text, the manual tour, and a second viewport.
 */
const L = require('C:/Claude/SIREN/qa_exports/sk14_lib.js');

const BUILD = process.argv[2];
const PORT = Number(process.argv[3]);
const FILE = process.argv[4];
const TAG = process.argv[5] || 'x';

const SHORT_SRC = 'flowchart TD\n    A[One] --> B[Two]\n    B --> C[Three]\n';

const INSTALL_DIAG = `(() => {
  window.__diag = [];
  const rec = (where) => (e) => { if (e.key !== 'Escape') return;
    window.__diag.push({ where, dp: e.defaultPrevented, t: (e.target && e.target.id) || (e.target && e.target.tagName) || '?' }); };
  window.addEventListener('keydown', rec('window-capture'), true);
  document.addEventListener('keydown', rec('document-capture'), true);
  document.addEventListener('keydown', rec('document-bubble'), false);
  window.addEventListener('keydown', rec('window-bubble'), false);
  return 1;
})()`;

const NODE_BOX = `(() => {
  const g = Array.from(document.querySelectorAll('#diagram svg g.node'));
  return JSON.stringify(g.map(n => { const r = n.getBoundingClientRect();
    return { label: (n.textContent||'').trim().slice(0,24), x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height }; })
    .filter(n => n.w > 4 && n.h > 4));
})()`;

const FOCUS_VIS = `(() => {
  const a = document.activeElement;
  const card = document.querySelector('.tour-card');
  if (!a || a === document.body) return JSON.stringify({ tag: a ? a.tagName : 'none', id: '', inCard: false, occluded: false });
  const r = a.getBoundingClientRect();
  const inCard = !!(card && card.contains(a));
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const off = r.width < 1 || r.height < 1 || cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight;
  let occluded = false;
  if (!off && !inCard) { const hit = document.elementFromPoint(cx, cy); if (hit && card && card.contains(hit)) occluded = true; }
  return JSON.stringify({ tag: a.tagName, id: a.id || '',
    text: (a.textContent || a.value || '').replace(/[ ]+/g, ' ').trim().slice(0, 26), inCard, occluded, off });
})()`;

async function clickById(page, id) {
  const box = JSON.parse(await page.evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)});
    if (!e) return JSON.stringify(null); e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return JSON.stringify(null);
    return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2 }); })()`));
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(220);
  return true;
}

const out = { build: BUILD, s: {} };
async function step(name, browser, fn, viewport) {
  const { page, ctx, errors } = await L.freshPage(browser, PORT, FILE, viewport);
  try {
    await L.waitTour(page);
    out.s[name] = await fn(page);
    out.s[name].errors = errors.slice();
  } catch (e) { out.s[name] = { crashed: String(e.message).slice(0, 220), errors: errors.slice() }; }
  await ctx.close();
}

(async () => {
  const server = L.serve(BUILD, PORT);
  const browser = await L.launch();

  // ===== D1: the ladder, instrumented. Where does each Escape actually die? =====
  await step('D1_ladderDiag', browser, async (page) => {
    await page.evaluate(INSTALL_DIAG);
    const nodes = JSON.parse(await page.evaluate(NODE_BOX));
    await page.mouse.click(nodes[0].x, nodes[0].y);
    await page.waitForTimeout(500);
    await page.mouse.click(nodes[1].x, nodes[1].y, { modifiers: ['Control'] });
    await page.waitForTimeout(300);
    await page.mouse.click(nodes[2].x, nodes[2].y, { modifiers: ['Control'] });
    await page.waitForTimeout(300);
    const presses = [];
    for (let i = 1; i <= 5; i++) {
      await page.evaluate(`(() => { window.__diag = []; })()`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(320);
      const rec = JSON.parse(await page.evaluate(`JSON.stringify({
        diag: window.__diag,
        tour: !!document.querySelector('.tour-card'),
        insp: (() => { const e = document.getElementById('nodeInspector'); if (!e || e.hidden) return false;
          const r = e.getBoundingClientRect(); return r.width > 1; })(),
        selBtn: (() => { const b = document.getElementById('applyStyleToSelectionButton'); return b ? !b.hidden : null; })(),
        active: document.activeElement ? document.activeElement.tagName + '#' + (document.activeElement.id||'') : 'none'
      })`));
      presses.push({ press: i, ...rec });
      if (!rec.tour) break;
    }
    return { presses };
  });

  // ===== D2: does the Tab that the deletion hands back destroy a selection? =====
  //  measured with the tour DISMISSED, so it is a property of the editor, not of the tour.
  await step('D2_tabEatsSelection', browser, async (page) => {
    await page.keyboard.press('Escape');           // dismiss the first-run card
    await page.waitForTimeout(400);
    const tourGone = !(await L.tourUp(page));
    await clickById(page, 'codeModeButton');
    await page.waitForTimeout(400);
    await clickById(page, 'textModeButton');
    await page.waitForTimeout(400);
    await page.evaluate(`(() => { const s = document.getElementById('source');
      s.value = ${JSON.stringify(SHORT_SRC)}; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await page.waitForTimeout(1400);
    await clickById(page, 'source');
    const before = await L.readSource(page);
    await page.evaluate(`(() => { const s = document.getElementById('source'); s.focus(); s.setSelectionRange(13, 45); })()`);
    const selected = await page.evaluate(`(() => { const s = document.getElementById('source'); return s.value.slice(s.selectionStart, s.selectionEnd); })()`);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    const after = await L.readSource(page);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(700);
    const undone = await L.readSource(page);
    return { tourGone, beforeLen: before.len, selectedLen: selected.length, selected,
      afterLen: after.len, afterValue: after.value, undoneLen: undone.len,
      undoRestored: undone.value === before.value };
  });

  // ===== D3: the manual tour - does it focus its own card? =====
  await step('D3_manualTour', browser, async (page) => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const first = !(await L.tourUp(page));
    await clickById(page, 'guideButton');
    await page.waitForTimeout(900);
    const dialogOpen = await page.evaluate(`!!document.querySelector('dialog[open]')`);
    const pressed = await page.evaluate(`(() => { const b = document.getElementById('startTourButton');
      if (!b) return 'missing'; b.click(); return 'clicked'; })()`);
    await page.waitForTimeout(1200);
    const f = JSON.parse(await page.evaluate(FOCUS_VIS));
    let tabs = -1;
    if (await L.tourUp(page)) {
      // from a neutral click, how far is the manually started card?
      await page.mouse.click(6, 460);
      for (let i = 1; i <= 100; i++) {
        await page.keyboard.press('Tab');
        const g = JSON.parse(await page.evaluate(FOCUS_VIS));
        if (g.inCard) { tabs = i; break; }
      }
    }
    return { firstRunDismissed: first, guideDialogOpen: dialogOpen, startPressed: pressed,
      tourUp: await L.tourUp(page), focusAfterStart: f, tabsToCardAfterNeutralClick: tabs };
  });

  // ===== D4: a second viewport. Does the card cover more of the tab ring when it is smaller? =====
  await step('D4_smallViewport', browser, async (page) => {
    await page.mouse.click(6, 400);
    const card = JSON.parse(await page.evaluate(`(() => { const c = document.querySelector('.tour-card');
      if (!c) return JSON.stringify(null); const r = c.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }); })()`));
    const stops = [];
    for (let i = 0; i < 140; i++) {
      await page.keyboard.press('Tab');
      const f = JSON.parse(await page.evaluate(FOCUS_VIS));
      stops.push(f);
      if (f.inCard) break;
    }
    return { viewport: '900x700', cardRect: card, presses: stops.length,
      reachedCard: stops.length ? stops[stops.length-1].inCard : false,
      occluded: stops.filter(s => s.occluded).map(s => ({ tag: s.tag, id: s.id, text: s.text })),
      occludedCount: stops.filter(s => s.occluded).length,
      offCount: stops.filter(s => s.off).length };
  }, { width: 900, height: 700 });

  // ===== D5: round 11's own win - type across the tour's arrival, real keys =====
  {
    const { page, ctx, errors } = await L.freshPage(browser, PORT, FILE);
    let rec = { crashed: null };
    try {
      await L.waitNoIntro(page);
      // focus the block-label field before the card is armed and keep typing through it
      await clickById(page, 'visualNodeLabel');
      await page.evaluate(`(() => { window.__sample = []; window.__t = setInterval(() => {
        const a = document.activeElement; window.__sample.push((a && a.id) || (a && a.tagName) || 'none'); }, 25); })()`);
      const phrase = 'Review request';
      const t0 = Date.now();
      let cardAt = -1;
      for (const ch of phrase) {
        await page.keyboard.type(ch, { delay: 0 });
        await page.waitForTimeout(170);
        if (cardAt < 0 && await L.tourUp(page)) cardAt = Date.now() - t0;
      }
      const after = JSON.parse(await page.evaluate(`(() => { clearInterval(window.__t);
        const i = document.getElementById('visualNodeLabel');
        const s = window.__sample || [];
        const bad = s.filter(x => x !== 'visualNodeLabel');
        return JSON.stringify({ value: i ? i.value : null, samples: s.length, excursions: bad.length,
          firstExcursion: bad[0] || null, tour: !!document.querySelector('.tour-card') }); })()`));
      rec = { typed: phrase, kept: after.value, keptAll: after.value === phrase, cardArrivedMsIntoTyping: cardAt,
        samples: after.samples, focusExcursions: after.excursions, firstExcursion: after.firstExcursion, tourUp: after.tour };
    } catch (e) { rec = { crashed: String(e.message).slice(0, 200) }; }
    rec.errors = errors.slice();
    out.s.D5_typeThroughArrival = rec;
    await ctx.close();
  }

  console.log('SK14_P4 ' + JSON.stringify(out));
  await browser.close();
  server.close();
})().catch(e => { console.error('FATAL', e); console.log('SK14_P4 ' + JSON.stringify(out)); process.exit(0); });
