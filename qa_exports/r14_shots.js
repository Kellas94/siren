#!/usr/bin/env node
/* Pictures of the two states that matter, taken the same way on both builds:
 *   A. first-run tour card up, after three real Tab presses - where did the focus ring go?
 *   B. the inspector after ZZZTEST + Escape - what does the label field say?
 * Usage: node r14_shots.js --app <path> --port <n> --tag base|merged
 */
const fs = require('fs');
const { openSession, waitTour, setSourceChecked, clickNode, ACTIVE } = require('./r14_tourlib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round14/app.html');
const PORT = Number(arg('port', '9717'));
const TAG = arg('tag', 'x');
const DIR = 'C:/Claude/SIREN/qa_exports/';
const NL = String.fromCharCode(10);
const FIXTURE = ['flowchart TD', '  A[State] --> B[Second block]', '  B --> C[Third block]'].join(NL);

/* A loud ring so the screenshot shows focus rather than implying it. */
const RING = `(() => {
  const s = document.createElement('style');
  s.textContent = '*:focus, *:focus-visible { outline: 4px solid #ff2d55 !important; outline-offset: 2px !important; }';
  document.head.appendChild(s);
})()`;

(async () => {
  const session = await openSession(APP, PORT);

  // A: tour card + three Tab presses
  {
    const h = await session.freshPage();
    await waitTour(h.page, 12000);
    await h.page.evaluate(RING);
    await h.page.mouse.click(40, 120);
    await h.page.waitForTimeout(300);
    for (let i = 0; i < 3; i++) { await h.page.keyboard.press('Tab'); await h.page.waitForTimeout(120); }
    const who = await h.page.evaluate(ACTIVE);
    await h.page.screenshot({ path: DIR + 'r14_shot_tour_' + TAG + '.png' });
    console.log('A ' + TAG + ' focusAfter3Tabs=' + who);
    await h.dispose();
  }

  // B: inspector label after ZZZTEST + Escape
  {
    const h = await session.freshPage();
    await waitTour(h.page, 12000);
    await h.page.evaluate(RING);
    await setSourceChecked(h.page, FIXTURE, 2400);
    await clickNode(h.page, 'A');
    const box = await h.page.evaluate(`(() => { const r = document.getElementById('inspectorBlockLabel').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await h.page.mouse.click(box.x, box.y, { clickCount: 3 });
    await h.page.waitForTimeout(150);
    await h.page.keyboard.type('ZZZTEST', { delay: 55 });
    await h.page.keyboard.press('Escape');
    await h.page.waitForTimeout(700);
    const val = await h.page.evaluate("document.getElementById('inspectorBlockLabel').value");
    const clip = await h.page.evaluate(`(() => { const n = document.getElementById('nodeInspector');
      const r = n.getBoundingClientRect();
      return { x: Math.max(0, r.left - 12), y: Math.max(0, r.top - 12),
        width: Math.min(560, r.width + 24), height: Math.min(420, r.height + 24) }; })()`);
    await h.page.screenshot({ path: DIR + 'r14_shot_label_' + TAG + '.png', clip });
    console.log('B ' + TAG + ' labelAfterEscape="' + val + '"');
    await h.dispose();
  }

  await session.close();
})().catch(e => { console.error('FATAL ' + e.stack); process.exit(1); });
