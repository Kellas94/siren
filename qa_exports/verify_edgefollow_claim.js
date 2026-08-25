#!/usr/bin/env node
/* Independent check of Antigravity's edgefollow result.
 *
 * Their metric - for each edge id L_X_Y_n, does the start land on X's box and the end on Y's box -
 * is methodologically right, and it is the metric this project asked for. It reports 6 of 6.
 *
 * But a correct pair of endpoints does not make a correct picture, and their own screenshot shows
 * long sweeping arcs. So this measures the thing their metric CANNOT see, and which they listed as
 * unestablished: does a rewritten edge now travel THROUGH a node it has nothing to do with?
 *
 * Method: walk each path at intervals and ask which node boxes each sample point falls inside. A
 * sample inside a box that is neither of the edge's own endpoints is a line crossing over a block -
 * the visible defect that "12 of 12 attached" hid last time.
 *
 * Usage: node verify_edgefollow_claim.js [--port 9678]
 */
const { openApp, setSource, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/SIREN_edgefollow/app_to_test.html');
const PORT = Number(arg('port', '9678'));

const SRC = 'flowchart TD\n  A[Purchase request] --> B{Approved}\n  B -->|yes| C[Raise order]\n'
          + '  B -->|no| D[Return to requester]\n  C --> E[Goods received]\n  D --> A\n  E --> F[Invoice matched]';

/* Their approach, reimplemented from their report: identify edges by id, move the endpoint that
   belongs to the moved node to the box border, translate the adjacent control point with it. */
const MOVE_AND_MEASURE = `((dx, dy, targetLetter) => {
  const svg = document.querySelector('#diagram svg');
  const real = p => !p.classList.contains('t-edge-hitarea');
  const paths = Array.from(svg.querySelectorAll('g.edgePaths path, path.flowchart-link')).filter(real);

  const letterOf = el => {
    const m = /-flowchart-([A-Za-z0-9_]+)-\\d+$/.exec(el.id || '');
    return m ? m[1] : null;
  };
  const endsOf = p => {
    const m = /-L_([A-Za-z0-9_]+)_([A-Za-z0-9_]+)_\\d+$/.exec(p.id || '');
    return m ? [m[1], m[2]] : null;
  };

  const nodes = Array.from(svg.querySelectorAll('g.node'));
  const boxOf = el => {
    const b = el.getBBox(), m = el.getCTM();
    const pt = (x, y) => { const q = svg.createSVGPoint(); q.x = x; q.y = y; return q.matrixTransform(m); };
    const a = pt(b.x, b.y), c = pt(b.x + b.width, b.y + b.height);
    return { x: Math.min(a.x, c.x), y: Math.min(a.y, c.y), w: Math.abs(c.x - a.x), h: Math.abs(c.y - a.y) };
  };

  const target = nodes.find(n => letterOf(n) === targetLetter);
  if (!target) return JSON.stringify({ error: 'no node ' + targetLetter });

  target.setAttribute('transform', (target.getAttribute('transform') || '') + ' translate(' + dx + ',' + dy + ')');
  const boxes = {};
  nodes.forEach(n => { const L = letterOf(n); if (L) boxes[L] = boxOf(n); });

  const meetBorder = (from, box) => {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const vx = from.x - cx, vy = from.y - cy;
    if (!vx && !vy) return { x: cx, y: cy };
    const s = Math.min(vx ? (box.w / 2) / Math.abs(vx) : Infinity, vy ? (box.h / 2) / Math.abs(vy) : Infinity);
    return { x: cx + vx * s, y: cy + vy * s };
  };

  // rewrite only the endpoints belonging to the moved node, identified by ID not by distance
  paths.forEach(p => {
    const e = endsOf(p); if (!e) return;
    const [from, to] = e;
    if (from !== targetLetter && to !== targetLetter) return;
    const nums = (p.getAttribute('d') || '').match(/-?\\d+(?:\\.\\d+)?/g);
    if (!nums || nums.length < 4) return;
    let sx = +nums[0], sy = +nums[1];
    let tx = +nums[nums.length - 2], ty = +nums[nums.length - 1];
    if (from === targetLetter) { const q = meetBorder({ x: tx, y: ty }, boxes[from]); sx = q.x; sy = q.y; }
    if (to === targetLetter)   { const q = meetBorder({ x: sx, y: sy }, boxes[to]);   tx = q.x; ty = q.y; }
    p.setAttribute('d', 'M' + sx + ',' + sy + ' L' + tx + ',' + ty);
  });

  // ---- the measurement their metric cannot make -------------------------------------------
  const inside = (pt, b) => pt.x > b.x + 2 && pt.x < b.x + b.w - 2 && pt.y > b.y + 2 && pt.y < b.y + b.h - 2;
  const rows = [];
  paths.forEach(p => {
    const e = endsOf(p); if (!e) return;
    const [from, to] = e;
    let crossed = new Set();
    try {
      const L = p.getTotalLength();
      for (let i = 0; i <= 40; i++) {
        const q = p.getPointAtLength(L * i / 40);
        for (const k of Object.keys(boxes)) {
          if (k === from || k === to) continue;
          if (inside(q, boxes[k])) crossed.add(k);
        }
      }
    } catch (err) {}
    // and does it actually reach its own two boxes?
    let ok = { start: false, end: false };
    try {
      const L = p.getTotalLength();
      const a = p.getPointAtLength(0), b = p.getPointAtLength(L);
      const near = (q, box) => box && q.x >= box.x - 6 && q.x <= box.x + box.w + 6 && q.y >= box.y - 6 && q.y <= box.y + box.h + 6;
      ok = { start: near(a, boxes[from]), end: near(b, boxes[to]) };
    } catch (err) {}
    rows.push({ id: from + '->' + to, startOnFrom: ok.start, endOnTo: ok.end, crossesOver: Array.from(crossed) });
  });
  return JSON.stringify({ rows, edgeCount: rows.length });
})`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1600, height: 1000 });
  await setSource(page, SRC, 4500);

  const before = JSON.parse(await page.evaluate(`(${MOVE_AND_MEASURE})(0, 0, 'B')`));
  check('control.beforeMove.allAttached',
    before.rows.length === 6 && before.rows.every(r => r.startOnFrom && r.endOnTo),
    'all 6 edges attached to the right boxes before any move',
    before.rows.map(r => `${r.id}:${r.startOnFrom && r.endOnTo ? 'ok' : 'BAD'}`).join(' '));
  check('control.beforeMove.noCrossings',
    before.rows.every(r => r.crossesOver.length === 0),
    'no edge crosses an unrelated block before any move',
    before.rows.filter(r => r.crossesOver.length).map(r => `${r.id} over ${r.crossesOver}`).join(', ') || 'none');

  await page.reload({ waitUntil: 'load' });
  await page.evaluate(require('./r7_lib').SETTLE);
  await setSource(page, SRC, 4500);
  const after = JSON.parse(await page.evaluate(`(${MOVE_AND_MEASURE})(240, -80, 'B')`));

  console.log('\n  edge          start on from   end on to    crosses over');
  after.rows.forEach(r => console.log(`  ${r.id.padEnd(12)}  ${String(r.startOnFrom).padEnd(14)}  ${String(r.endOnTo).padEnd(11)}  ${r.crossesOver.join(',') || '-'}`));
  console.log();

  check('afterMove.rightBoxes',
    after.rows.length === 6 && after.rows.every(r => r.startOnFrom && r.endOnTo),
    'their claim: all 6 edges join the correct boxes after the move',
    after.rows.filter(r => !(r.startOnFrom && r.endOnTo)).map(r => r.id).join(', ') || 'all 6 correct');

  const crossing = after.rows.filter(r => r.crossesOver.length);
  check('afterMove.noCrossingOverBlocks', crossing.length === 0,
    'no rewritten edge travels through an unrelated block',
    crossing.length ? crossing.map(r => `${r.id} crosses ${r.crossesOver.join('+')}`).join(' | ') : 'none');

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await page.screenshot({ path: 'C:/Claude/SIREN/pending/round7/edgefollow_check.png', clip: { x: 600, y: 150, width: 1000, height: 800 } });
  await close();
  process.exit(report('edgefollow claim') ? 1 : 0);
})();
