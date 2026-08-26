/* Probe 5 - the Tab that round 14 hands back, measured against the standing rule,
 * plus a clean multi-layer Escape ladder that does not go through a native select.
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

const FOCUS_VIS = `(() => {
  const a = document.activeElement; const card = document.querySelector('.tour-card');
  if (!a || a === document.body) return JSON.stringify({ tag: a ? a.tagName : 'none', id: '', inCard: false, occluded: false });
  const r = a.getBoundingClientRect(); const inCard = !!(card && card.contains(a));
  const cx = r.left + r.width/2, cy = r.top + r.height/2;
  const off = r.width < 1 || r.height < 1 || cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight;
  let occ = false; if (!off && !inCard) { const h = document.elementFromPoint(cx, cy); if (h && card && card.contains(h)) occ = true; }
  return JSON.stringify({ tag: a.tagName, id: a.id || '', text: (a.textContent || a.value || '').replace(/[ ]+/g,' ').trim().slice(0,26), inCard, occluded: occ, off });
})()`;

async function clickById(page, id) {
  const box = JSON.parse(await page.evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)});
    if (!e) return JSON.stringify(null); e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return JSON.stringify(null);
    return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2 }); })()`));
  if (!box) return false;
  await page.mouse.click(box.x, box.y); await page.waitForTimeout(220); return true;
}

const out = { build: BUILD, s: {} };
async function step(name, browser, fn) {
  const { page, ctx, errors } = await L.freshPage(browser, PORT, FILE);
  try { await L.waitTour(page); out.s[name] = await fn(page); out.s[name].errors = errors.slice(); }
  catch (e) { out.s[name] = { crashed: String(e.message).slice(0, 220), errors: errors.slice() }; }
  await ctx.close();
}

async function toCodeText(page) {
  await clickById(page, 'codeModeButton'); await page.waitForTimeout(400);
  await clickById(page, 'textModeButton'); await page.waitForTimeout(400);
  await page.evaluate(`(() => { const s = document.getElementById('source');
    s.value = ${JSON.stringify(SHORT_SRC)}; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(1500);
}

(async () => {
  const server = L.serve(BUILD, PORT);
  const browser = await L.launch();

  // ===== U1: Tab over a two-line selection, with the tour DISMISSED. Is the text recoverable? =====
  await step('U1_tabSelectionUndo', browser, async (page) => {
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await toCodeText(page);
    await clickById(page, 'source');
    const before = await L.readSource(page);
    const undoBefore = await page.evaluate(`(() => { const b = document.getElementById('undoButton'); return b ? b.disabled : null; })()`);
    await page.evaluate(`(() => { const s = document.getElementById('source'); s.focus(); s.setSelectionRange(13, 45); })()`);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);
    const after = await L.readSource(page);
    const undoAfter = await page.evaluate(`(() => { const b = document.getElementById('undoButton'); return b ? b.disabled : null; })()`);
    const toast = await page.evaluate(`(() => { const t = document.getElementById('toast'); return t ? (t.textContent||'').trim().slice(0,120) : null; })()`);
    const tries = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(700);
      tries.push((await L.readSource(page)).len);
    }
    // and the app's own Undo button
    await clickById(page, 'undoButton');
    await page.waitForTimeout(800);
    const afterButton = await L.readSource(page);
    return { beforeLen: before.len, afterLen: after.len, afterValue: after.value,
      lostChars: before.len - after.len + 4, undoBefore, undoAfter, toast,
      ctrlZLens: tries, afterUndoButtonLen: afterButton.len,
      recovered: afterButton.value === before.value || tries.includes(before.len) };
  });

  // ===== U2: the same Tab WITH the first-run tour up - which build loses the text? =====
  await step('U2_tabSelectionTourUp', browser, async (page) => {
    await toCodeText(page);
    const tourUp = await L.tourUp(page);
    await clickById(page, 'source');
    const before = await L.readSource(page);
    await page.evaluate(`(() => { const s = document.getElementById('source'); s.focus(); s.setSelectionRange(13, 45); })()`);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);
    const after = await L.readSource(page);
    const focus = JSON.parse(await page.evaluate(FOCUS_VIS));
    await page.screenshot({ path: `C:/Claude/SIREN/qa_exports/sk14_tabsel_${TAG}.png` });
    return { tourUpAtPress: tourUp, beforeLen: before.len, afterLen: after.len,
      afterValue: after.value, focusAfter: focus, tourAfter: await L.tourUp(page) };
  });

  // ===== U3: a clean Escape ladder - inspector plus a real multi-selection, no native popup =====
  await step('U3_cleanLadder', browser, async (page) => {
    const nodes = JSON.parse(await page.evaluate(NODE_BOX));
    const pick = (name) => nodes.find(n => n.label.includes(name));
    const first = pick('Financial statements') || nodes[nodes.length - 1];
    const b = pick('State'), c = pick('Line Ministry');
    await page.mouse.click(first.x, first.y);
    await page.waitForTimeout(600);
    const hitCheck = [];
    for (const n of [b, c]) {
      const hit = await page.evaluate(`(() => { const e = document.elementFromPoint(${n.x}, ${n.y});
        return e ? (e.closest('g.node') ? 'node' : e.tagName + '.' + String(e.className.baseVal !== undefined ? e.className.baseVal : e.className).slice(0,20)) : 'none'; })()`);
      hitCheck.push({ label: n.label, hit });
      if (hit === 'node') { await page.mouse.click(n.x, n.y, { modifiers: ['Control'] }); await page.waitForTimeout(350); }
    }
    const read = `(() => { const q = id => document.getElementById(id);
      const vis = e => { if (!e || e.hidden) return false; const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
      const sel = q('applyStyleToSelectionButton');
      return JSON.stringify({ tour: !!document.querySelector('.tour-card'), insp: vis(q('nodeInspector')),
        multi: sel ? !sel.hidden : null,
        active: document.activeElement ? document.activeElement.tagName + '#' + (document.activeElement.id||'') : 'none' }); })()`;
    const before = JSON.parse(await page.evaluate(read));
    const trail = []; let died = -1;
    for (let i = 1; i <= 6; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(320);
      const st = JSON.parse(await page.evaluate(read));
      trail.push({ p: i, ...st });
      if (!st.tour) { died = i; break; }
    }
    return { hitCheck, before, diedOnPress: died, trail };
  });

  // ===== U4: the whole forward walk, named. How many stops sit inside the card? =====
  await step('U4_fullWalk', browser, async (page) => {
    await page.mouse.click(6, 460);
    const stops = [];
    for (let i = 0; i < 130; i++) {
      await page.keyboard.press('Tab');
      const f = JSON.parse(await page.evaluate(FOCUS_VIS));
      stops.push(f);
      if (f.inCard) break;
    }
    const named = stops.filter(s => s.id).map(s => s.id);
    return { presses: stops.length, inCardStops: stops.filter(s => s.inCard).length,
      namedControls: named.length, distinctNamed: Array.from(new Set(named)).length,
      sample: named.slice(0, 25), reachedCard: stops.length ? stops[stops.length-1].inCard : false };
  });

  console.log('SK14_P5 ' + JSON.stringify(out));
  await browser.close(); server.close();
})().catch(e => { console.error('FATAL', e); console.log('SK14_P5 ' + JSON.stringify(out)); process.exit(0); });
