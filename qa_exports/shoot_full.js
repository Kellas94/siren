#!/usr/bin/env node
/* No clip, no locator, no scale factor: photograph the whole viewport.
 *
 * Three framed attempts came back blank while the numbers said the buttons were inside the frame.
 * At that point the suspect is the instrument, not the app, so this removes every bit of framing
 * arithmetic and simply photographs what the browser is showing.
 *
 * Usage: node shoot_full.js --app <path> --tag <name> [--port 9866]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app'), PORT = Number(arg('port', '9866')), TAG = arg('tag', 'full');
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

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(SETTLE);
  await page.screenshot({ path: path.join(OUT, TAG + '_viewport.png') });
  console.log('wrote ' + TAG + '_viewport.png');
  await browser.close(); server.close();
})();
