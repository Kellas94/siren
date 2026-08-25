#!/usr/bin/env node
/* SKEPTIC probe 3 for job BJ - one step sideways from the flowchart the patch was written for.
 *
 *  E. A NON-flowchart diagram (sequenceDiagram): click empty canvas inside the viewport, press Tab.
 *     BASE's removed handler would reach parseVisualFlowchartSource, find it incompatible and
 *     raise an error toast on a navigation key. Record the toast and the source on both builds.
 *  F. The Visual builder editor mode, same gesture.
 *  G. Screenshot of the preview after the realistic gesture (empty click + 3 x Tab), on a flowchart.
 */
const { openApp, setSource } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round13/app.html');
const PORT = Number(arg('port', '9631'));
const TAG = arg('tag', 'merged');
const NL = String.fromCharCode(10);
const SMALL = ['flowchart TD', '  A[Start] --> B[Check invoice]', '  B --> C[Approve]'].join(NL);
const SEQ = ['sequenceDiagram', '  Alice->>Bob: Send the request', '  Bob-->>Alice: Approve'].join(NL);

const DESCRIBE = `(() => {
  const a = document.activeElement;
  if (!a) return JSON.stringify({ d: 'NULL' });
  let d = a.tagName;
  if (a.id) d += '#' + a.id;
  const cls = a.getAttribute && a.getAttribute('class');
  if (cls) d += '.' + String(cls).trim().split(/[ ]+/).join('.');
  const al = a.getAttribute && a.getAttribute('aria-label');
  if (al) d += ' [' + al + ']';
  return JSON.stringify({ d: d, isVp: a.id === 'zoomViewport' });
})()`;

const TOASTS = `(() => JSON.stringify(Array.from(document.querySelectorAll('.toast, #toast, [class*="toast"]')).map(t => (t.textContent||'').trim().slice(0,90)).filter(Boolean)))()`;

async function killTour(page) {
  for (let i = 0; i < 26; i++) {
    const gone = await page.evaluate(`(() => {
      const card = document.querySelector('.tour-card');
      if (!card) return true;
      const b = Array.from(card.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || card.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 8) return;
    await page.waitForTimeout(180);
  }
}
const src = page => page.evaluate(`document.getElementById('source').value`);

async function emptySpot(page) {
  return JSON.parse(await page.evaluate(`(() => {
    const vp = document.getElementById('zoomViewport');
    if (!vp) return JSON.stringify(null);
    const r = vp.getBoundingClientRect();
    for (let dy = 12; dy < r.height - 12; dy += 14) {
      for (let dx = 12; dx < r.width - 12; dx += 14) {
        const x = r.left + dx, y = r.top + dy;
        const e = document.elementFromPoint(x, y);
        if (!e) continue;
        if (e.closest('g.node') || e.closest('.t-handle') || e.closest('.t-edge-hitarea') || e.closest('button') || e.closest('[data-t-workpaper-node]')) continue;
        if (!e.closest('#zoomViewport')) continue;
        return JSON.stringify({ x: x, y: y, hit: e.tagName + (e.id ? '#' + e.id : '') });
      }
    }
    return JSON.stringify(null);
  })()`));
}

(async () => {
  const out = { app: APP };
  const { page, errors, close } = await openApp(APP, PORT);
  try {
    await killTour(page);

    /* ---------- E. sequenceDiagram ---------- */
    await setSource(page, SEQ, 3200);
    out.E = { fixture: await src(page) };
    out.E.fixtureOk = out.E.fixture.indexOf('sequenceDiagram') === 0;
    const spotE = await emptySpot(page);
    out.E.spot = spotE;
    if (spotE) {
      await page.mouse.click(spotE.x, spotE.y);
      await page.waitForTimeout(450);
      out.E.focusAfterClick = JSON.parse(await page.evaluate(DESCRIBE));
      await page.evaluate(`document.querySelectorAll('.toast').forEach(t => t.remove())`);
      const b = await src(page);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(700);
      const a = await src(page);
      out.E.tab = { changed: a !== b, focus: JSON.parse(await page.evaluate(DESCRIBE)).d, toasts: JSON.parse(await page.evaluate(TOASTS)) };
      await page.evaluate(`document.querySelectorAll('.toast').forEach(t => t.remove())`);
      await page.evaluate(`document.getElementById('zoomViewport').focus()`);
      await page.waitForTimeout(250);
      const b2 = await src(page);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(700);
      const a2 = await src(page);
      out.E.enter = { changed: a2 !== b2, toasts: JSON.parse(await page.evaluate(TOASTS)) };
    }

    /* ---------- F. Visual builder mode ---------- */
    await setSource(page, SMALL, 2600);
    const switched = await page.evaluate(`(() => { const b = document.getElementById('visualModeButton'); if (!b) return 'absent'; b.click(); return 'clicked'; })()`);
    await page.waitForTimeout(1400);
    out.F = { switch: switched, mode: await page.evaluate(`(document.getElementById('visualModeButton')||{}).getAttribute ? document.getElementById('visualModeButton').getAttribute('aria-selected') : null`) };
    const spotF = await emptySpot(page);
    out.F.spot = spotF;
    if (spotF) {
      await page.mouse.click(spotF.x, spotF.y);
      await page.waitForTimeout(450);
      out.F.focusAfterClick = JSON.parse(await page.evaluate(DESCRIBE));
      await page.evaluate(`document.querySelectorAll('.toast').forEach(t => t.remove())`);
      const b = await src(page);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(700);
      const a = await src(page);
      out.F.tab = { changed: a !== b, delta: a.length - b.length, focus: JSON.parse(await page.evaluate(DESCRIBE)).d, toasts: JSON.parse(await page.evaluate(TOASTS)) };
    }

    /* ---------- G. the picture ---------- */
    await page.evaluate(`(() => { const b = document.getElementById('codeModeButton'); if (b) b.click(); })()`);
    await page.waitForTimeout(900);
    await setSource(page, SMALL, 3000);
    const spotG = await emptySpot(page);
    if (spotG) {
      await page.mouse.click(spotG.x, spotG.y);
      await page.waitForTimeout(450);
      const b = await src(page);
      for (let i = 0; i < 3; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(400); }
      const a = await src(page);
      out.G = { changed: a !== b, source: a, nodes: await page.evaluate(`document.querySelectorAll('#diagram g.node').length`), toasts: JSON.parse(await page.evaluate(TOASTS)), focus: JSON.parse(await page.evaluate(DESCRIBE)).d };
      await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/bjx3_' + TAG + '.png' });
    }

    out.errors = errors;
  } catch (e) {
    out.crash = String(e && e.message).slice(0, 400);
  } finally {
    console.log('RESULT=' + JSON.stringify(out));
    await close();
  }
})();
