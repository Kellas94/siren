#!/usr/bin/env node
/* SKEPTIC probe 4 - the FIRST-RUN tour, which r7_lib's settle would have dismissed.
 * Fresh context, empty storage, tour left ALIVE, no settle. Real keyboard only for measurement.
 *
 *   H. With the tour up, does Tab in the Mermaid code editor still indent, as the editor footer
 *      on screen promises ("Tab / Shift + Tab indent")?
 *   I. With the tour up, where does Tab go from BODY - can a keyboard user reach the app at all,
 *      and can they reach the tour's own Skip/Next?
 *   J. Does Escape end the tour?
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round13/app.html');
const PORT = Number(arg('port', '9641'));

const DESCRIBE = `(() => {
  const a = document.activeElement;
  if (!a) return JSON.stringify({ d: 'NULL', inTour: false });
  let d = a.tagName;
  if (a.id) d += '#' + a.id;
  const cls = a.getAttribute && a.getAttribute('class');
  if (cls) d += '.' + String(cls).trim().split(/[ ]+/).join('.');
  const t = (a.textContent || '').trim().slice(0, 22);
  if (t && a.tagName === 'BUTTON') d += ' {' + t + '}';
  return JSON.stringify({ d: d, inTour: !!(a.closest && a.closest('.tour-card')) });
})()`;

(async () => {
  const out = { app: APP };
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });
  try {
    await page.goto('http://127.0.0.1:' + PORT + '/' + file, { waitUntil: 'load', timeout: 90000 });
    // wait for the render and the brand intro, WITHOUT touching the tour
    await page.evaluate(`(async () => {
      for (let i = 0; i < 90; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
      for (let i = 0; i < 60; i++) { const o = document.getElementById('sirenIntroOverlay'); if (!o || o.hidden) break; await new Promise(r => setTimeout(r, 100)); }
      return 1;
    })()`);
    await page.waitForTimeout(4000);
    out.tourAlive = await page.evaluate(`!!document.querySelector('.tour-card')`);
    out.tourText = await page.evaluate(`((document.querySelector('.tour-card')||{}).textContent||'').trim().slice(0,90)`);
    out.footerPromise = await page.evaluate(`((document.querySelector('.editor-footer span')||{}).textContent||'').trim()`);

    /* ---------- H. Tab indents in the code editor? ---------- */
    await page.evaluate(`(() => { const b = document.getElementById('codeModeButton'); if (b) b.click(); })()`);
    await page.waitForTimeout(600);
    await page.evaluate(`(() => { const b = document.getElementById('textModeButton') || document.querySelector('[id*="textMode"]'); if (b) b.click(); })()`);
    await page.waitForTimeout(600);
    const prep = await page.evaluate(`(() => {
      const s = document.getElementById('source');
      if (!s) return JSON.stringify({ ok: false });
      s.focus();
      s.setSelectionRange(0, 0);
      return JSON.stringify({ ok: true, focused: document.activeElement === s, value: s.value.slice(0, 40), len: s.value.length });
    })()`);
    out.H = { prep: JSON.parse(prep) };
    const before = await page.evaluate(`document.getElementById('source').value`);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    const after = await page.evaluate(`document.getElementById('source').value`);
    out.H.indented = after !== before;
    out.H.delta = after.length - before.length;
    out.H.head = after.slice(0, 24);
    out.H.focusAfter = JSON.parse(await page.evaluate(DESCRIBE));
    out.H.tourStillUp = await page.evaluate(`!!document.querySelector('.tour-card')`);

    /* ---------- I. where Tab goes from BODY with the tour up ---------- */
    await page.evaluate(`(() => { const a = document.activeElement; if (a && a.blur) a.blur(); document.body.focus && document.body.focus(); })()`);
    await page.waitForTimeout(300);
    const stops = [];
    for (let i = 1; i <= 14; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(160);
      stops.push(JSON.parse(await page.evaluate(DESCRIBE)));
    }
    out.I = {
      stops: stops.map(s => s.d),
      distinct: Array.from(new Set(stops.map(s => s.d))).length,
      inTourCount: stops.filter(s => s.inTour).length,
      reachedTourButton: stops.some(s => s.inTour),
      appStops: Array.from(new Set(stops.filter(s => !s.inTour && s.d !== 'BODY').map(s => s.d))).length
    };

    /* ---------- J. Escape ---------- */
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    out.J = { tourAfterEscape: await page.evaluate(`!!document.querySelector('.tour-card')`) };

    out.errors = errors;
  } catch (e) {
    out.crash = String(e && e.message).slice(0, 400);
  } finally {
    console.log('RESULT=' + JSON.stringify(out));
    await browser.close(); server.close();
  }
})();
