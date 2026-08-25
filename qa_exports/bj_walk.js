/* JOB BJ - the keyboard walk that found the defect. Press Tab N times from the top of the
 * document and report the FIRST press that changes #source, plus what was focused at that moment.
 * Run identically on BASE and MERGED.
 *
 * mode=plain   : settle (tour dismissed), fixture set, node clicked, walk from body
 * mode=nosel   : same but nothing clicked
 * mode=tour    : FRESH context, EMPTY storage, tour left alive, no settle - walk from body
 */
const path = require('path');
const fs = require('fs'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');

const APP = process.argv[2];
const PORT = Number(process.argv[3]);
const LABEL = process.argv[4];
const MODE = process.argv[5] || 'plain';
const PRESSES = Number(process.argv[6] || 120);

const FIXTURE = [
  'flowchart TD',
  '  A[Start] --> B[Check invoice]',
  '  B --> C[Approve]'
].join('\n');

const SETTLE_NO_TOUR = `(async () => {
  for (let i = 0; i < 90; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
  for (let i = 0; i < 60; i++) { const o = document.getElementById('sirenIntroOverlay'); if (!o || o.hidden) break; await new Promise(r => setTimeout(r, 100)); }
  return 1;
})()`;

const SETTLE_KILL_TOUR = `(async () => {
  for (let i = 0; i < 90; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
  for (let p = 0; p < 12; p++) {
    const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
    if (!b) break; b.click(); await new Promise(r => setTimeout(r, 220));
  }
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
  for (let i = 0; i < 60; i++) { const o = document.getElementById('sirenIntroOverlay'); if (!o || o.hidden) break; await new Promise(r => setTimeout(r, 100)); }
  document.body.click(); await new Promise(r => setTimeout(r, 800));
  return 1;
})()`;

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });
  const out = { label: LABEL, mode: MODE, presses: [], firstMutation: null, errors };
  try {
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 90000 });
    await page.evaluate(MODE === 'tour' ? SETTLE_NO_TOUR : SETTLE_KILL_TOUR);
    await page.waitForTimeout(MODE === 'tour' ? 2500 : 500);

    out.tourAlive = await page.evaluate(`!!document.querySelector('.tour-card')`);

    if (MODE !== 'tour') {
      await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = ${JSON.stringify(FIXTURE)}; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await page.waitForTimeout(2600);
    }
    if (MODE === 'plain') {
      const box = await page.evaluate(`(() => { const n = document.querySelector('#diagram g.node'); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
      if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(800); }
      out.clicked = box;
    }

    const start = await page.evaluate(`document.getElementById('source').value`);
    out.startSource = start;
    out.startLen = start.length;
    await page.evaluate(`(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); document.body.focus && document.body.focus(); })()`);

    let prev = start;
    for (let i = 1; i <= PRESSES; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(90);
      const state = await page.evaluate(`(() => {
        const a = document.activeElement;
        return {
          src: document.getElementById('source').value,
          tag: a ? a.tagName : 'none',
          id: a ? (a.id || '') : '',
          cls: a && a.getAttribute ? (a.getAttribute('class') || '').slice(0, 60) : '',
          role: a && a.getAttribute ? (a.getAttribute('role') || '') : '',
          label: a ? ((a.getAttribute && a.getAttribute('aria-label')) || (a.textContent || '').trim().slice(0, 34)) : '',
          inVP: !!(a && a.closest && a.closest('#zoomViewport')),
          tour: !!document.querySelector('.tour-card'),
          inTour: !!(a && a.closest && a.closest('.tour-card'))
        };
      })()`);
      const mutated = state.src !== prev;
      out.presses.push({ n: i, tag: state.tag, id: state.id, cls: state.cls, role: state.role, label: state.label, inVP: state.inVP, tour: state.tour, inTour: state.inTour, mutated });
      if (mutated && !out.firstMutation) {
        out.firstMutation = { n: i, focus: state, before: prev, after: state.src };
        // keep walking a bit to see if it keeps mutating
      }
      prev = state.src;
    }
    out.endSource = prev;
    out.endLen = prev.length;
    out.totalMutations = out.presses.filter(p => p.mutated).length;
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 900);
  } finally {
    console.log('WALK_JSON ' + JSON.stringify(out));
    await browser.close(); server.close();
  }
})();
