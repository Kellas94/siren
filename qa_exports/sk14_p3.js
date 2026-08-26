/* Probe 3 - the Tab half, the occlusion question the report never asked,
 * and a three-layer Escape ladder. Same script on both builds.
 */
const L = require('C:/Claude/SIREN/qa_exports/sk14_lib.js');

const BUILD = process.argv[2];
const PORT = Number(process.argv[3]);
const FILE = process.argv[4];
const TAG = process.argv[5] || 'x';

const SHORT_SRC = 'flowchart TD\n    A[One] --> B[Two]\n    B --> C[Three]\n';

const NODE_BOX = `(() => {
  const g = Array.from(document.querySelectorAll('#diagram svg g.node'));
  return JSON.stringify(g.map(n => { const r = n.getBoundingClientRect();
    return { label: (n.textContent||'').trim().slice(0,24), x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height }; })
    .filter(n => n.w > 4 && n.h > 4));
})()`;

/* Where is focus, and is the focused control actually visible or hidden behind the tour card? */
const FOCUS_VIS = `(() => {
  const a = document.activeElement;
  const card = document.querySelector('.tour-card');
  if (!a || a === document.body) return JSON.stringify({ tag: a ? a.tagName : 'none', id: '', inCard: false, occluded: false, offscreen: false });
  const r = a.getBoundingClientRect();
  const inCard = !!(card && card.contains(a));
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const offscreen = r.width < 1 || r.height < 1 || cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight;
  let occluded = false, hitBy = '';
  if (!offscreen && !inCard) {
    const hit = document.elementFromPoint(cx, cy);
    if (hit && card && card.contains(hit)) { occluded = true; hitBy = 'tour-card'; }
    else if (hit && hit !== a && !a.contains(hit) && !hit.contains(a)) { hitBy = (hit.tagName + '.' + String(hit.className || '').slice(0, 24)); }
  }
  return JSON.stringify({
    tag: a.tagName, id: a.id || '',
    text: (a.textContent || a.value || '').replace(/[ ]+/g, ' ').trim().slice(0, 28),
    inCard, occluded, hitBy, offscreen,
    rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
  });
})()`;

const CARD_RECT = `(() => { const c = document.querySelector('.tour-card'); if (!c) return JSON.stringify(null);
  const r = c.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }); })()`;

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
async function step(name, browser, fn) {
  const { page, ctx, errors } = await L.freshPage(browser, PORT, FILE);
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

  // ===== T1: the occlusion question. Walk Tab with the tour up and ask, at every stop,
  // whether the control that now has focus is actually visible or is behind the card. =====
  await step('T1_occlusion', browser, async (page) => {
    await page.mouse.click(6, 460);
    const card = JSON.parse(await page.evaluate(CARD_RECT));
    const stops = [];
    let shot = null;
    for (let i = 0; i < 120; i++) {
      await page.keyboard.press('Tab');
      const f = JSON.parse(await page.evaluate(FOCUS_VIS));
      stops.push(f);
      if (f.occluded && !shot) {
        shot = `C:/Claude/SIREN/qa_exports/sk14_occluded_${TAG}.png`;
        await page.screenshot({ path: shot });
      }
      if (f.inCard) break;
    }
    return {
      cardRect: card, presses: stops.length,
      reachedCard: stops.length ? stops[stops.length - 1].inCard : false,
      occludedCount: stops.filter(s => s.occluded).length,
      occludedStops: stops.filter(s => s.occluded).map(s => ({ tag: s.tag, id: s.id, text: s.text, rect: s.rect })),
      offscreenCount: stops.filter(s => s.offscreen).length,
      shot, tourUp: await L.tourUp(page)
    };
  });

  // ===== T2: editor Tab, reproduced then stepped sideways (cursor at line start, and a selection) =====
  await step('T2_editorTab', browser, async (page) => {
    await clickById(page, 'codeModeButton');
    await page.waitForTimeout(400);
    await clickById(page, 'textModeButton');
    await page.waitForTimeout(400);
    await page.evaluate(`(() => { const s = document.getElementById('source');
      s.value = ${JSON.stringify(SHORT_SRC)}; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await page.waitForTimeout(1400);
    const tourStillUp = await L.tourUp(page);
    const ok = await clickById(page, 'source');
    const before = (await L.readSource(page)).len;
    // sideways: put the caret at the very start of line 2 and indent there
    await page.evaluate(`(() => { const s = document.getElementById('source'); s.focus(); s.setSelectionRange(13, 13); })()`);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250);
    const afterTab = (await L.readSource(page)).len;
    const focusAfterTab = JSON.parse(await page.evaluate(FOCUS_VIS));
    // and outdent the same line
    await page.evaluate(`(() => { const s = document.getElementById('source'); s.focus(); s.setSelectionRange(20, 20); })()`);
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(250);
    const afterShift = (await L.readSource(page)).len;
    const focusAfterShift = JSON.parse(await page.evaluate(FOCUS_VIS));
    // one more step sideways: a multi-line SELECTION indented as a block
    await page.evaluate(`(() => { const s = document.getElementById('source'); s.focus(); s.setSelectionRange(13, 45); })()`);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250);
    const afterBlock = (await L.readSource(page)).len;
    return { clickedSource: ok, tourStillUp, before, afterTab, afterShift, afterBlock,
      focusAfterTab, focusAfterShift, tourAtEnd: await L.tourUp(page) };
  });

  // ===== T3: Tab in the Visual builder - reach the Add block button and press Enter =====
  await step('T3_visualTab', browser, async (page) => {
    const ok = await clickById(page, 'visualNodeLabel');
    await page.keyboard.type('Review request', { delay: 25 });
    const typed = JSON.parse(await page.evaluate(`(() => { const i = document.getElementById('visualNodeLabel');
      return JSON.stringify({ v: i ? i.value : null, count: (document.getElementById('visualNodeCount')||{}).textContent || '' }); })()`));
    const trail = [];
    let landed = null;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const f = JSON.parse(await page.evaluate(FOCUS_VIS));
      trail.push({ tag: f.tag, id: f.id, text: f.text, inCard: f.inCard });
      if (f.id === 'addVisualNodeButton') { landed = i + 1; break; }
      if (f.inCard) break;
    }
    const beforeEnter = JSON.parse(await page.evaluate(`(() => JSON.stringify({ count: (document.getElementById('visualNodeCount')||{}).textContent||'', src: document.getElementById('source').value.length }))()`));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(900);
    const afterEnter = JSON.parse(await page.evaluate(`(() => JSON.stringify({ count: (document.getElementById('visualNodeCount')||{}).textContent||'', src: document.getElementById('source').value.length, hasLabel: document.getElementById('source').value.includes('Review request'), tour: !!document.querySelector('.tour-card') }))()`));
    return { clicked: ok, typed, tabsToAddButton: landed, trail, beforeEnter, afterEnter };
  });

  // ===== T4: three-layer Escape ladder - inspector plus a Ctrl+click multi-selection =====
  await step('T4_ladder3', browser, async (page) => {
    const nodes = JSON.parse(await page.evaluate(NODE_BOX));
    if (nodes.length < 3) return { note: 'not enough nodes' };
    await page.mouse.click(nodes[0].x, nodes[0].y);              // opens the inspector
    await page.waitForTimeout(500);
    await page.mouse.click(nodes[1].x, nodes[1].y, { modifiers: ['Control'] });
    await page.waitForTimeout(300);
    await page.mouse.click(nodes[2].x, nodes[2].y, { modifiers: ['Control'] });
    await page.waitForTimeout(300);
    const read = `(() => { const q = id => document.getElementById(id);
      const vis = e => { if (!e || e.hidden) return false; const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
      const sel = q('applyStyleToSelectionButton');
      return JSON.stringify({ tour: !!document.querySelector('.tour-card'), insp: vis(q('nodeInspector')),
        multiVisible: sel ? !sel.hidden : null }); })()`;
    const before = JSON.parse(await page.evaluate(read));
    const trail = [];
    let died = -1;
    for (let i = 1; i <= 6; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const st = JSON.parse(await page.evaluate(read));
      trail.push({ p: i, ...st });
      if (!st.tour) { died = i; break; }
    }
    return { before, diedOnPress: died, trail };
  });

  // ===== T5: the manually started tour - is its card focused, and is Tab from it sane? =====
  await step('T5_manualTour', browser, async (page) => {
    // end the first-run card the way a person would
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const gone = !(await L.tourUp(page));
    await clickById(page, 'guideButton');
    await page.waitForTimeout(700);
    const started = await clickById(page, 'startTourButton');
    await page.waitForTimeout(800);
    const f = JSON.parse(await page.evaluate(FOCUS_VIS));
    return { firstRunDismissed: gone, guideOpened: started, tourUp: await L.tourUp(page), focusAfterStart: f };
  });

  console.log('SK14_P3 ' + JSON.stringify(out));
  await browser.close();
  server.close();
})().catch(e => { console.error('FATAL', e); console.log('SK14_P3 ' + JSON.stringify(out)); process.exit(0); });
