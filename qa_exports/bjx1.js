#!/usr/bin/env node
/* SKEPTIC probe 1 for job BJ.
 *
 * Two questions the original report did not ask:
 *   Q1 (replicate) with a block clicked, does bare Tab mutate #source? BASE must fire.
 *   Q2 (sideways)  on a CLIENT-SIZED diagram, how many Tab stops now live inside the preview,
 *                  and can a keyboard user get OUT of it? BASE prevented Tab from entering the
 *                  SVG at all; MERGED lets it in. Count the stops on both.
 *
 * Emits one line beginning RESULT= with everything as JSON.
 */
const { openApp, setSource } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round13/app.html');
const PORT = Number(arg('port', '9611'));
const NL = String.fromCharCode(10);

const SMALL = ['flowchart TD',
  '  A[Start] --> B[Check invoice]',
  '  B --> C[Approve]'].join(NL);

function bigSource(n) {
  const lines = ['flowchart TD'];
  for (let i = 1; i < n; i++) lines.push('  N' + i + '[Step ' + i + '] --> N' + (i + 1) + '[Step ' + (i + 1) + ']');
  return lines.join(NL);
}

const DESCRIBE = `(() => {
  const a = document.activeElement;
  if (!a) return 'NULL';
  let d = a.tagName;
  if (a.id) d += '#' + a.id;
  const cls = a.getAttribute && a.getAttribute('class');
  if (cls) d += '.' + String(cls).trim().split(/[ ]+/).join('.');
  const al = a.getAttribute && a.getAttribute('aria-label');
  if (al) d += ' [' + al + ']';
  const inVp = !!(a.closest && a.closest('#zoomViewport'));
  const inDiag = !!(a.closest && a.closest('#diagram'));
  return JSON.stringify({ d: d, inVp: inVp, inDiag: inDiag });
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

async function clickNodeByLabel(page, label) {
  const box = JSON.parse(await page.evaluate(`(() => {
    const gs = Array.from(document.querySelectorAll('#diagram g.node'));
    const g = gs.find(x => (x.textContent || '').indexOf(${JSON.stringify(label)}) >= 0);
    if (!g) return JSON.stringify(null);
    const r = g.getBoundingClientRect();
    return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  })()`));
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(500);
  return true;
}

const STATE = `(() => JSON.stringify({
  handles: document.querySelectorAll('[data-handle-for]').length,
  selectedRing: Array.from(document.querySelectorAll('.t-selected-node')).map(n => (n.textContent||'').trim().slice(0,30)),
  inspectorOpen: !!document.querySelector('#nodeInspector:not([hidden])'),
  nodeStyleTarget: (document.getElementById('nodeStyleTarget')||{}).value || null,
  nodes: document.querySelectorAll('#diagram g.node').length
}))()`;

(async () => {
  const out = { app: APP };
  const { page, errors, close } = await openApp(APP, PORT);
  try {
    await killTour(page);

    /* ---------- Q1: replicate the core differential ---------- */
    await setSource(page, SMALL, 2600);
    out.fixture = await page.evaluate(`document.getElementById('source').value`);
    out.fixtureOk = out.fixture.indexOf('Check invoice') >= 0;
    out.clicked = await clickNodeByLabel(page, 'Check invoice');
    out.afterClick = JSON.parse(await page.evaluate(STATE));

    const before = await page.evaluate(`document.getElementById('source').value`);
    out.tabWalk = [];
    for (let i = 1; i <= 12; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(260);
      const desc = JSON.parse(await page.evaluate(DESCRIBE));
      const src = await page.evaluate(`document.getElementById('source').value`);
      out.tabWalk.push({ press: i, focus: desc.d, inVp: desc.inVp, changed: src !== before, len: src.length });
    }
    out.smallEndSource = await page.evaluate(`document.getElementById('source').value`);
    out.smallMutations = out.tabWalk.filter(r => r.changed).length;
    out.smallFirstMutation = (out.tabWalk.find(r => r.changed) || {}).press || null;

    /* ---------- Q2: sideways - a client-sized diagram ---------- */
    await page.evaluate(`document.body.click()`);
    await page.waitForTimeout(300);
    await setSource(page, bigSource(30), 5000);
    out.bigFixtureNodes = await page.evaluate(`document.querySelectorAll('#diagram g.node').length`);
    out.bigClicked = await clickNodeByLabel(page, 'Step 2');
    const bigBefore = await page.evaluate(`document.getElementById('source').value`);

    const stops = [];
    let insideCount = 0, leftAt = null, everInside = false;
    for (let i = 1; i <= 130; i++) {
      await page.keyboard.press('Tab');
      const desc = JSON.parse(await page.evaluate(DESCRIBE));
      stops.push(desc.d);
      if (desc.inVp) { insideCount++; everInside = true; }
      else if (everInside && leftAt === null) leftAt = i;
      if (leftAt !== null && i >= leftAt + 3) break;
    }
    const bigAfter = await page.evaluate(`document.getElementById('source').value`);
    out.big = {
      presses: stops.length,
      insideViewportStops: insideCount,
      leftViewportAtPress: leftAt,
      everInside: everInside,
      sourceChanged: bigAfter !== bigBefore,
      lenBefore: bigBefore.length,
      lenAfter: bigAfter.length,
      firstStops: stops.slice(0, 8),
      lastStops: stops.slice(-4),
      distinctStops: Array.from(new Set(stops)).length
    };

    out.errors = errors;
  } catch (e) {
    out.crash = String(e && e.message).slice(0, 300);
  } finally {
    console.log('RESULT=' + JSON.stringify(out));
    await close();
  }
})();
