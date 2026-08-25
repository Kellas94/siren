/* JOB BJ walk, round 2. The tour re-arms on a timer and (on MERGED) now traps Tab, so the
 * first walk was not apples to apples. This one kills the tour for real, PROVES it is dead,
 * and only then walks. Identical script on both builds.
 *
 * modes: plain (node clicked) | nosel (nothing clicked) | tourlive (tour deliberately alive)
 */
const path = require('path');
const fs = require('fs'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');

const APP = process.argv[2], PORT = Number(process.argv[3]), LABEL = process.argv[4];
const MODE = process.argv[5] || 'plain', PRESSES = Number(process.argv[6] || 140);
const KEY = process.argv[7] || 'Tab';

const FIXTURE = 'flowchart TD\n  A[Start] --> B[Check invoice]\n  B --> C[Approve]';

const WAIT_SVG = `(async () => {
  for (let i = 0; i < 90; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
  for (let i = 0; i < 60; i++) { const o = document.getElementById('sirenIntroOverlay'); if (!o || o.hidden) break; await new Promise(r => setTimeout(r, 100)); }
  return 1;
})()`;

async function killTour(page) {
  for (let i = 0; i < 40; i++) {
    const gone = await page.evaluate(`(() => {
      const card = document.querySelector('.tour-card');
      if (!card) return true;
      const b = Array.from(card.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || card.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 10) return true;
    await page.waitForTimeout(220);
  }
  return !(await page.evaluate(`!!document.querySelector('.tour-card')`));
}

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
  const out = { label: LABEL, mode: MODE, key: KEY, errors };
  try {
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 90000 });
    await page.evaluate(WAIT_SVG);
    await page.waitForTimeout(3000);
    if (MODE !== 'tourlive') {
      out.tourKilled = await killTour(page);
      await page.waitForTimeout(2500);          // let the timer re-arm fire, then kill again
      await killTour(page);
      await page.waitForTimeout(500);
    }
    out.tourAliveBeforeWalk = await page.evaluate(`!!document.querySelector('.tour-card')`);

    await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = ${JSON.stringify(FIXTURE)}; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await page.waitForTimeout(2800);

    if (MODE === 'plain') {
      const box = await page.evaluate(`(() => { const n = document.querySelector('#diagram g.node'); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
      if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(900); }
      out.clicked = box;
      out.selAfterClick = await page.evaluate(`({ handles: document.querySelectorAll('#diagram [data-handle-for]').length, inspector: (() => { const i = document.getElementById('nodeInspector'); return !!(i && !i.hidden); })() })`);
    }

    const start = await page.evaluate(`document.getElementById('source').value`);
    out.startSource = start;
    await page.evaluate(`(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); })()`);

    let prev = start;
    const presses = [];
    for (let i = 1; i <= PRESSES; i++) {
      await page.keyboard.press(KEY);
      await page.waitForTimeout(85);
      const st = await page.evaluate(`(() => {
        const a = document.activeElement;
        return { src: document.getElementById('source').value,
          tag: a ? a.tagName : 'none', id: a ? (a.id || '') : '',
          cls: a && a.getAttribute ? (a.getAttribute('class') || '').slice(0, 46) : '',
          inVP: !!(a && a.closest && a.closest('#zoomViewport')),
          tour: !!document.querySelector('.tour-card') };
      })()`);
      const mutated = st.src !== prev;
      presses.push({ n: i, tag: st.tag, id: st.id, cls: st.cls, inVP: st.inVP, mutated });
      if (mutated && !out.firstMutation) out.firstMutation = { n: i, focus: st, before: prev, after: st.src };
      prev = st.src;
    }
    out.endSource = prev;
    out.totalMutations = presses.filter(p => p.mutated).length;
    out.reachedViewport = presses.filter(p => p.inVP).map(p => p.n);
    out.reachedZoomViewportDiv = presses.filter(p => p.id === 'zoomViewport').map(p => ({ n: p.n, mutated: p.mutated }));
    out.distinctStops = [...new Set(presses.map(p => p.tag + '#' + p.id + '.' + p.cls))];
    out.stopCount = out.distinctStops.length;
    out.identical = out.endSource === out.startSource;
    out.presses = presses;
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 900);
  } finally {
    console.log('WALK2_JSON ' + JSON.stringify(out));
    await browser.close(); server.close();
  }
})();
