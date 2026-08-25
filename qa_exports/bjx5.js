#!/usr/bin/env node
/* SKEPTIC probe 5 - the documented promises that sit closest to the removed handler.
 *   K. "Enter on a handle does what a press does" (help line 20687). Tab to the "Add the next
 *      step" handle and press Enter. The removed BASE handler preventDefault()ed bare Enter
 *      inside #zoomViewport; if handles were not excluded, this promise was broken on BASE and
 *      must work on MERGED.
 *   L. "Esc puts the handles away" - after keyboard navigation.
 *   M. Ctrl+Enter with NOTHING selected (empty-canvas click first).
 */
const { openApp, setSource } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round13/app.html');
const PORT = Number(arg('port', '9651'));
const NL = String.fromCharCode(10);
const SMALL = ['flowchart TD', '  A[Start] --> B[Check invoice]', '  B --> C[Approve]'].join(NL);

const DESCRIBE = `(() => {
  const a = document.activeElement;
  if (!a) return JSON.stringify({ d: 'NULL' });
  let d = a.tagName;
  if (a.id) d += '#' + a.id;
  const cls = a.getAttribute && a.getAttribute('class');
  if (cls) d += '.' + String(cls).trim().split(/[ ]+/).join('.');
  const al = a.getAttribute && a.getAttribute('aria-label');
  if (al) d += ' [' + al + ']';
  return JSON.stringify({ d: d, role: a.getAttribute ? a.getAttribute('role') : null, isHandle: !!(a.closest && a.closest('.t-handle, [data-handle-for]')) });
})()`;

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

async function nodeBox(page, label) {
  return JSON.parse(await page.evaluate(`(() => {
    const gs = Array.from(document.querySelectorAll('#diagram g.node'));
    const g = gs.find(x => (x.textContent || '').indexOf(${JSON.stringify(label)}) >= 0);
    if (!g) return JSON.stringify(null);
    const r = g.getBoundingClientRect();
    return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  })()`));
}
async function emptySpot(page) {
  return JSON.parse(await page.evaluate(`(() => {
    const vp = document.getElementById('zoomViewport');
    const r = vp.getBoundingClientRect();
    for (let dy = 12; dy < r.height - 12; dy += 14) for (let dx = 12; dx < r.width - 12; dx += 14) {
      const x = r.left + dx, y = r.top + dy; const e = document.elementFromPoint(x, y);
      if (!e || !e.closest('#zoomViewport')) continue;
      if (e.closest('g.node') || e.closest('.t-handle') || e.closest('.t-edge-hitarea') || e.closest('button')) continue;
      return JSON.stringify({ x: x, y: y });
    }
    return JSON.stringify(null);
  })()`));
}

(async () => {
  const out = { app: APP };
  const { page, errors, close } = await openApp(APP, PORT);
  try {
    await killTour(page);

    /* ---------- K. Enter on a handle ---------- */
    await setSource(page, SMALL, 2600);
    const nb = await nodeBox(page, 'Check invoice');
    await page.mouse.click(nb.x, nb.y);
    await page.waitForTimeout(500);
    let handleFocus = null;
    for (let i = 1; i <= 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(260);
      const d = JSON.parse(await page.evaluate(DESCRIBE));
      if (d.isHandle && /Add the next step/.test(d.d)) { handleFocus = { press: i, d: d.d, role: d.role }; break; }
    }
    out.K = { handleFocus: handleFocus };
    if (handleFocus) {
      const b = await src(page);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
      out.K.popoverInputs = await page.evaluate(`document.querySelectorAll('.canvas-popover input').length`);
      out.K.focusAfterEnter = JSON.parse(await page.evaluate(DESCRIBE)).d;
      await page.keyboard.type('Recalc VAT');
      await page.waitForTimeout(200);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(900);
      const a = await src(page);
      out.K.changed = a !== b;
      out.K.source = a;
    }

    /* ---------- L. Esc puts the handles away ---------- */
    await setSource(page, SMALL, 2600);
    const nb2 = await nodeBox(page, 'Check invoice');
    await page.mouse.click(nb2.x, nb2.y);
    await page.waitForTimeout(450);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(350);
    out.L = { handlesAfterTab: await page.evaluate(`document.querySelectorAll('[data-handle-for]').length`) };
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    out.L.handlesAfterEsc = await page.evaluate(`document.querySelectorAll('[data-handle-for]').length`);

    /* ---------- M. Ctrl+Enter with nothing selected ---------- */
    await setSource(page, SMALL, 2600);
    const spot = await emptySpot(page);
    await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(450);
    out.M = { handles: await page.evaluate(`document.querySelectorAll('[data-handle-for]').length`) };
    const b3 = await src(page);
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(800);
    out.M.popoverInputs = await page.evaluate(`document.querySelectorAll('.canvas-popover input').length`);
    const a3 = await src(page);
    out.M.changed = a3 !== b3;
    out.M.toasts = await page.evaluate(`JSON.stringify(Array.from(document.querySelectorAll('.toast')).map(t => (t.textContent||'').trim().slice(0,80)))`);

    out.errors = errors;
  } catch (e) {
    out.crash = String(e && e.message).slice(0, 400);
  } finally {
    console.log('RESULT=' + JSON.stringify(out));
    await close();
  }
})();
