#!/usr/bin/env node
/* Third attempt, and this time no clip arithmetic at all: screenshot the toolbar ELEMENT.
 *
 * Two frames in a row came out empty while the numbers insisted the buttons were inside them. The
 * cause is that page.screenshot({clip}) takes PAGE coordinates while getBoundingClientRect returns
 * VIEWPORT coordinates - identical only when nothing is scrolled. locator.screenshot() sidesteps the
 * whole conversion by letting the browser frame its own element, so there is no arithmetic left to
 * get wrong. It also scrolls the element into view first, which is the behaviour we wanted anyway.
 *
 * Usage: node shoot_toolbar3.js --app <path> [--port 9864] [--tag base|patched]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app'), PORT = Number(arg('port', '9864')), TAG = arg('tag', 'patched');
const OUT = 'C:/Claude/SIREN/pending/toolbar';

const SETTLE = `(async () => {
  for (let i = 0; i < 90; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
  for (let p = 0; p < 12; p++) {
    const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
    if (!b) break; b.click(); await new Promise(r => setTimeout(r, 220));
  }
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
  // The 1.7s brand intro covers the entire app. Waiting for #diagram svg is NOT enough: the diagram
  // renders underneath while the overlay is still painted on top, so a screenshot taken then is a
  // photograph of the splash with a set of perfectly correct numbers underneath it.
  const intro = document.getElementById('sirenIntroOverlay');
  for (let i = 0; i < 60 && intro && !intro.hidden; i++) await new Promise(r => setTimeout(r, 100));
  document.body.click(); await new Promise(r => setTimeout(r, 900)); return 1;
})()`;

/* Count what a person can press, and how many lines it takes - the two numbers that decide whether
   this change did its job. Counting is by rendered box, not by markup, so a hidden control is not
   quietly counted as present. */
const CENSUS = `(() => {
  const bar = document.querySelector('.zoom-tools');
  if (!bar) return 'null';
  const seen = [];
  bar.querySelectorAll('button, select, [role="button"]').forEach(e => {
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || getComputedStyle(e).visibility === 'hidden') return;
    seen.push({ id: e.id || e.textContent.replace(/\\s+/g, ' ').trim().slice(0, 16), y: Math.round(r.top), w: Math.round(r.width) });
  });
  const rows = [...new Set(seen.map(s => s.y))].sort((a, b) => a - b);
  const br = bar.getBoundingClientRect();
  return JSON.stringify({ count: seen.length, rows: rows.length, height: Math.round(br.height),
                          items: seen.map(s => s.id) });
})()`;

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();

  for (const [w, h] of [[1440, 900], [1180, 860], [960, 820]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(SETTLE);

    const c = JSON.parse(await page.evaluate(CENSUS));
    console.log(`${TAG} ${String(w).padStart(4)}px : ${String(c.count).padStart(2)} controls on ${c.rows} line(s), bar ${c.height}px tall`);
    console.log(`             ${c.items.join(', ')}`);
    await page.locator('.zoom-tools').screenshot({ path: path.join(OUT, `${TAG}_${w}.png`) });

    if (w === 1440) {
      await page.evaluate(`document.getElementById('previewViewButton')?.click()`);
      await page.waitForTimeout(800);
      const menu = page.locator('.struct-menu').first();
      if (await menu.count()) await menu.screenshot({ path: path.join(OUT, `${TAG}_menu.png`) });
    }
    await ctx.close();
  }
  await browser.close(); server.close();
})();
