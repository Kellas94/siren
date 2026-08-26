#!/usr/bin/env node
/* Does the embedded ELK actually work with the network cut off?
 *
 * The spike is only worth anything if it is proved rather than reasoned about. So every request
 * that is not the local file is ABORTED at the browser, not merely observed - if the build still
 * reaches for jsDelivr it fails here loudly instead of quietly succeeding on a cached copy.
 *
 * Three questions:
 *   1. with the network dead, does choosing ELK change the drawing?  (it must)
 *   2. did anything try to leave?                                    (nothing must)
 *   3. does the same build still render normally, export, and boot without errors?
 *
 * Usage: node verify_elk_embedded.js [--app <path>] [--port 9770] [--base <path>]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/elkbuild/app.html');
const PORT = Number(arg('port', '9770'));
const NL = String.fromCharCode(10);

const SRC = ['flowchart TD',
  '  A[Purchase request] --> B{Approved}',
  '  B -->|Yes| C[Raise order]',
  '  B -->|No| D[Return to requester]',
  '  C --> E[Goods received]',
  '  E --> F[Invoice matched]',
  '  D --> A'].join(NL);

const SIG = `(() => {
  const svg = document.querySelector('#diagram svg');
  if (!svg) return 'no svg';
  const pts = Array.from(svg.querySelectorAll('g.node')).map(n => {
    const b = n.getBBox(); return Math.round(b.x) + ',' + Math.round(b.y);
  }).sort().join('|');
  return (svg.getAttribute('viewBox') || '') + ' :: ' + pts;
})()`;

const ENGINE = which => `(async () => {
  const eng = document.getElementById('layoutEngineSelect') || document.getElementById('layoutEngine');
  if (!eng) return 'absent';
  const opt = Array.from(eng.options).find(o => ${which === 'elk' ? '/elk/i' : '/standard|dagre|default/i'}.test(o.textContent + o.value));
  if (!opt) return 'no option';
  eng.value = opt.value;
  eng.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 3000));
  return eng.value;
})()`;

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // The network is not observed. It is CUT.
  const attempted = [];
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(`http://127.0.0.1:${PORT}/`) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    attempted.push(route.request().method() + ' ' + u.slice(0, 90));
    return route.abort('failed');
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 110)); });

  console.log('\nMeasured on ' + APP);
  console.log('EVERY non-local request is aborted at the browser.\n');

  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 120000 });
  for (let i = 0; i < 90; i++) {
    if (await page.evaluate(`!!document.querySelector('#diagram svg')`)) break;
    await page.waitForTimeout(300);
  }
  for (let i = 0; i < 20; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card');
      if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click(); return false;
    })()`);
    if (gone && i > 5) break;
    await page.waitForTimeout(170);
  }
  console.log('  the app booted and drew a diagram with no network: '
    + (await page.evaluate(`!!document.querySelector('#diagram svg')`)));

  await page.evaluate(`(() => {
    const s = document.getElementById('source');
    s.value = ${JSON.stringify(SRC)};
    s.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await page.waitForTimeout(3500);

  console.log('  window.__SIREN_ELK present: '
    + await page.evaluate(`(() => { const e = window.__SIREN_ELK;
        return e ? 'yes, ' + (Array.isArray(e) ? e.length + ' layout entries' : typeof e) : 'NO'; })()`));

  await page.evaluate(ENGINE('standard'));
  await page.waitForTimeout(900);
  const before = await page.evaluate(SIG);
  const chose = await page.evaluate(ENGINE('elk'));
  await page.waitForTimeout(1200);
  const after = await page.evaluate(SIG);
  const state = await page.evaluate(`(() => {
    const eng = document.getElementById('layoutEngineSelect') || document.getElementById('layoutEngine');
    return JSON.stringify({ selector: eng ? eng.value : null });
  })()`);

  console.log('\n  chose the engine: ' + chose + '   ' + state);
  console.log('  geometry before : ' + String(before).slice(0, 92));
  console.log('  geometry after  : ' + String(after).slice(0, 92));
  const moved = before !== after && before !== 'no svg' && after !== 'no svg';
  console.log('  >> ' + (moved
    ? 'ELK RE-LAID THE DIAGRAM WITH THE NETWORK CUT'
    : 'the drawing did not change — the embedded engine did NOT run'));

  console.log('\n  requests the browser had to abort: ' + (attempted.length ? JSON.stringify(attempted) : 'NONE'));
  console.log('  page/console errors: ' + (errors.length ? errors.slice(0, 4).join(' // ') : 'none'));

  await page.screenshot({ path: 'C:/Claude/SIREN/pending/elkbuild/elk_offline.png' });
  await browser.close(); server.close();
})();
