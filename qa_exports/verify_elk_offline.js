#!/usr/bin/env node
/* Does ELK work with no network at all?
 *
 * Every external request is BLOCKED at the browser, so nothing can quietly succeed. Then ELK is
 * chosen the way a person chooses it, and the node positions are compared before and after: a
 * layout engine that loaded but did not run leaves the drawing exactly where it was, and that is
 * indistinguishable from success unless you measure the geometry.
 *
 * Usage: node verify_elk_offline.js --app <path> [--port 9879]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app'), PORT = Number(arg('port', '9879'));

let fail = 0;
const check = (id, ok, exp, act) => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} | expected=${exp} | actual=${act}`); };

// Positions in screen space, with the render timestamp stripped from the ids.
const GEOM = `(() => {
  const svg = document.querySelector('#diagram svg');
  if (!svg) return 'none';
  const o = svg.getBoundingClientRect();
  return Array.from(svg.querySelectorAll('g.node')).map(n => {
    const r = n.getBoundingClientRect();
    return (n.id || '').replace(/^t_[a-z]+_\\d+_\\d+-/, '') + '@' + Math.round(r.left - o.left) + ',' + Math.round(r.top - o.top);
  }).sort().join(' | ');
})()`;

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  const attempted = [];
  await page.route('**/*', route => {
    const u = route.request().url();
    if (!u.startsWith(`http://127.0.0.1:${PORT}`) && !u.startsWith('data:') && !u.startsWith('blob:')) {
      attempted.push(u.slice(0, 90));
      return route.abort();
    }
    return route.continue();
  });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 130)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 110)); });

  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(`(async () => {
    for (let i = 0; i < 90; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
    for (let p = 0; p < 12; p++) {
      const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
      if (!b) break; b.click(); await new Promise(r => setTimeout(r, 200));
    }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
    document.body.click();
    const s = document.querySelector('#source');
    s.value = 'flowchart TD\\n A[Start] --> B{Check}\\n B -->|yes| C[Done]\\n B -->|no| D[Retry]\\n D --> A\\n C --> E[Ship]\\n B --> F[Park]\\n F --> E';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 4500));
    return 1;
  })()`);

  const before = await page.evaluate(GEOM);

  // the labels must not promise a download any more
  const labels = JSON.parse(await page.evaluate(`(() => {
    const sel = document.querySelector('#layoutEngineSelect');
    const hint = document.querySelector('#layoutEngineHint');
    const elk = sel ? Array.from(sel.options).find(o => o.value === 'elk') : null;
    return JSON.stringify({
      option: elk ? elk.textContent.trim() : null,
      hint: hint ? hint.textContent.replace(/\\s+/g, ' ').trim() : null
    });
  })()`));
  check('label.noOnlineClaim', !!labels.option && !/online/i.test(labels.option),
    'the option no longer says "online"', JSON.stringify(labels.option));
  check('hint.noDownloadPromise', !!labels.hint && !/jsDelivr|500 KB|fetch/i.test(labels.hint),
    'the hint no longer promises a download', JSON.stringify((labels.hint || '').slice(0, 78) + '…'));

  // choose ELK, with the network dead
  const picked = await page.evaluate(`(async () => {
    const sel = document.querySelector('#layoutEngineSelect');
    let n = sel; while (n) { if (n.tagName === 'DETAILS') n.open = true; n = n.parentElement; }
    sel.value = 'elk';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 12000));
    return sel.value;
  })()`);
  const after = await page.evaluate(GEOM);

  check('elk.stayedSelected', picked === 'elk',
    'ELK is still the chosen engine, not silently reverted to Standard', picked);
  check('elk.actuallyRelaidOut', before !== after && after !== 'none',
    'the drawing moved, so ELK really ran',
    before === after ? 'IDENTICAL geometry — it loaded but did not lay out' : 'geometry changed');
  check('offline.noRequestsAttempted', attempted.length === 0,
    'no external request even attempted', attempted.length ? attempted.slice(0, 3).join(' // ') : 'none');
  check('offline.noErrors', errs.length === 0,
    'no page or console errors', errs.length ? errs.slice(0, 3).join(' // ') : 'none');

  console.log('\n  before: ' + before.slice(0, 92));
  console.log('  after : ' + after.slice(0, 92));
  await browser.close(); server.close();
  console.log(`\n${fail ? 'FAILED' : 'ALL PASS'} — ${fail} failing assertion(s)`);
  process.exit(fail ? 1 : 0);
})();
