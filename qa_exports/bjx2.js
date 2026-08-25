#!/usr/bin/env node
/* SKEPTIC probe 2 for job BJ.
 *
 *  A. Reproduce the reported positive control EXACTLY: get focus onto DIV#zoomViewport by real
 *     Tab presses from BODY, then Tab, then Enter. Record presses-to-viewport and mutations.
 *  B. The realistic route to the same focus: a real click on EMPTY canvas inside the viewport.
 *     Does that focus #zoomViewport? Then Tab.
 *  C. Original capability: Ctrl+Enter creation from a clicked block, driven to completion.
 *  D. Keyboard-only hazard: Tab to a block, then press SPACE, then a LETTER. Does an editor open,
 *     does it commit on blur, does the label survive?
 */
const { openApp, setSource } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round13/app.html');
const PORT = Number(arg('port', '9621'));
const NL = String.fromCharCode(10);
const SMALL = ['flowchart TD', '  A[Start] --> B[Check invoice]', '  B --> C[Approve]'].join(NL);

const DESCRIBE = `(() => {
  const a = document.activeElement;
  if (!a) return JSON.stringify({ d: 'NULL', inVp: false, isVp: false, isNode: false });
  let d = a.tagName;
  if (a.id) d += '#' + a.id;
  const cls = a.getAttribute && a.getAttribute('class');
  if (cls) d += '.' + String(cls).trim().split(/[ ]+/).join('.');
  const al = a.getAttribute && a.getAttribute('aria-label');
  if (al) d += ' [' + al + ']';
  return JSON.stringify({
    d: d,
    inVp: !!(a.closest && a.closest('#zoomViewport')),
    isVp: a.id === 'zoomViewport',
    isNode: !!(a.matches && a.matches('g.node'))
  });
})()`;

const INPLACE = `(() => {
  const i = document.getElementById('canvasInplace');
  return JSON.stringify({ exists: !!i, hidden: i ? i.hidden : null, value: i ? i.value : null, focused: i ? document.activeElement === i : false });
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

/* An empty spot inside the viewport: the viewport rect's own top-left area, checked to be clear
   of every node and edge hitarea before it is pressed. */
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
    await setSource(page, SMALL, 2600);
    out.fixture = await src(page);

    /* ---------- A. their positive control: Tab from BODY until #zoomViewport ---------- */
    await page.evaluate(`document.body.click(); document.activeElement && document.activeElement.blur && document.activeElement.blur();`);
    await page.waitForTimeout(300);
    let pressesToVp = null;
    const beforeA = await src(page);
    let mutatedBeforeVp = null;
    for (let i = 1; i <= 110; i++) {
      await page.keyboard.press('Tab');
      const desc = JSON.parse(await page.evaluate(DESCRIBE));
      const s = await src(page);
      if (s !== beforeA && mutatedBeforeVp === null) mutatedBeforeVp = i;
      if (desc.isVp) { pressesToVp = i; break; }
    }
    out.A = { pressesToVp: pressesToVp, mutatedBeforeReachingVp: mutatedBeforeVp, sourceAtVp: (await src(page)).length };
    if (pressesToVp !== null) {
      const b1 = await src(page);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
      const a1 = await src(page);
      out.A.tabFromVp = { changed: a1 !== b1, focus: JSON.parse(await page.evaluate(DESCRIBE)).d, delta: a1.length - b1.length, after: a1.slice(-40) };
      // re-focus the viewport for the Enter test
      await page.evaluate(`document.getElementById('zoomViewport').focus()`);
      await page.waitForTimeout(250);
      const b2 = await src(page);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);
      const a2 = await src(page);
      out.A.enterFromVp = { changed: a2 !== b2, delta: a2.length - b2.length, after: a2.slice(-40) };
    }

    /* ---------- B. the realistic route: click empty canvas, then Tab ---------- */
    await setSource(page, SMALL, 2600);
    const spot = await emptySpot(page);
    out.B = { spot: spot };
    if (spot) {
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(500);
      out.B.focusAfterEmptyClick = JSON.parse(await page.evaluate(DESCRIBE));
      out.B.handles = await page.evaluate(`document.querySelectorAll('[data-handle-for]').length`);
      const b3 = await src(page);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
      const a3 = await src(page);
      out.B.tabAfterEmptyClick = { changed: a3 !== b3, delta: a3.length - b3.length, focus: JSON.parse(await page.evaluate(DESCRIBE)).d };
      const b4 = await src(page);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);
      const a4 = await src(page);
      out.B.enterAfterEmptyClick = { changed: a4 !== b4, delta: a4.length - b4.length };
    }

    /* ---------- C. original capability: Ctrl+Enter from a clicked block ---------- */
    await setSource(page, SMALL, 2600);
    const nb = await nodeBox(page, 'Check invoice');
    out.C = { clicked: !!nb };
    if (nb) {
      await page.mouse.click(nb.x, nb.y);
      await page.waitForTimeout(500);
      const b5 = await src(page);
      await page.keyboard.press('Control+Enter');
      await page.waitForTimeout(700);
      out.C.popoverInputs = await page.evaluate(`document.querySelectorAll('.canvas-popover input').length`);
      await page.keyboard.type('Vouch to invoice');
      await page.waitForTimeout(200);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(900);
      const a5 = await src(page);
      out.C.created = a5 !== b5;
      out.C.newSource = a5;
    }

    /* ---------- D. keyboard-only: Tab to a block, then SPACE, then a LETTER ---------- */
    await setSource(page, SMALL, 2600);
    const nb2 = await nodeBox(page, 'Check invoice');
    if (nb2) {
      await page.mouse.click(nb2.x, nb2.y);
      await page.waitForTimeout(450);
      // Tab once so focus is on a DIFFERENT block, reached purely by keyboard.
      await page.keyboard.press('Tab');
      await page.waitForTimeout(350);
      const d0 = JSON.parse(await page.evaluate(DESCRIBE));
      out.D = { focusAfterTab: d0.d, isNode: d0.isNode };
      const scrollBefore = await page.evaluate(`(document.getElementById('zoomViewport')||{}).scrollTop || window.scrollY`);
      const b6 = await src(page);
      await page.keyboard.press('Space');
      await page.waitForTimeout(600);
      out.D.afterSpace = JSON.parse(await page.evaluate(INPLACE));
      out.D.focusAfterSpace = JSON.parse(await page.evaluate(DESCRIBE)).d;
      out.D.scrolled = (await page.evaluate(`(document.getElementById('zoomViewport')||{}).scrollTop || window.scrollY`)) !== scrollBefore;
      // blur it the way a person would: click the page background outside the editor
      await page.mouse.click(6, 6);
      await page.waitForTimeout(700);
      const a6 = await src(page);
      out.D.sourceAfterSpaceThenBlur = { changed: a6 !== b6, value: a6 };

      // now a LETTER on a keyboard-reached block
      await setSource(page, SMALL, 2600);
      const nb3 = await nodeBox(page, 'Check invoice');
      await page.mouse.click(nb3.x, nb3.y);
      await page.waitForTimeout(450);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(350);
      const d1 = JSON.parse(await page.evaluate(DESCRIBE));
      const b7 = await src(page);
      await page.keyboard.press('n');
      await page.waitForTimeout(600);
      out.D.letter = { focusBefore: d1.d, inplace: JSON.parse(await page.evaluate(INPLACE)) };
      await page.mouse.click(6, 6);
      await page.waitForTimeout(800);
      const a7 = await src(page);
      out.D.letter.sourceAfterBlur = a7;
      out.D.letter.changed = a7 !== b7;
    }

    out.errors = errors;
  } catch (e) {
    out.crash = String(e && e.message).slice(0, 400);
  } finally {
    console.log('RESULT=' + JSON.stringify(out));
    await close();
  }
})();
