/* First-run typing test: does the tour card steal a first-time user's keystrokes?
 * FRESH CONTEXT, EMPTY STORAGE, NO SETTLE (settle would dismiss the tour we are testing).
 *
 * node r15v_type.js <appPath> <port> <visual|code|docs> <tag>
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');

const appPath = process.argv[2], port = Number(process.argv[3]), mode = process.argv[4], tag = process.argv[5] || mode;
const TEXT = 'Review request';
const KEYS = ['R', 'e', 'v', 'i', 'e', 'w', 'Space', 'r', 'e', 'q', 'u', 'e', 's', 't'];

const DESC = `(n => n ? (n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/ +/)[0] : '')) : 'null')`;

const SAMPLER = `(() => {
  window.__focusLog = [];
  window.__evLog = [];
  const d = ${DESC};
  window.__t0 = performance.now();
  window.__si = setInterval(() => {
    const a = d(document.activeElement);
    const L = window.__focusLog;
    if (!L.length || L[L.length - 1].a !== a) L.push({ t: Math.round(performance.now() - window.__t0), a });
  }, 20);
  ['focusin','focusout','blur','focus'].forEach(type =>
    document.addEventListener(type, e => window.__evLog.push({ t: Math.round(performance.now() - window.__t0), type, tgt: d(e.target) }), true));
  return 1;
})()`;

async function setup(page) {
  if (mode === 'code') {
    await page.evaluate(`document.getElementById('codeModeButton')?.click()`);
    await page.waitForTimeout(250);
    return '#source';
  }
  if (mode === 'docs') {
    await page.evaluate(`document.getElementById('workpapersButton')?.click()`);
    await page.waitForTimeout(300);
    await page.evaluate(`(document.getElementById('wpEmptyNewButton')||document.getElementById('wpNewButton'))?.click()`);
    await page.waitForTimeout(300);
    await page.evaluate(`(() => { const b = Array.from(document.querySelectorAll('button,[role=menuitem],li,a')).find(n => n.offsetParent && /^\\s*Narrative\\s*$/.test(n.textContent || '')); if (b) b.click(); })()`);
    await page.waitForTimeout(400);
    return '.wp-text[contenteditable="true"]';
  }
  return '#visualNodeLabel';
}

(async () => {
  const root = path.dirname(appPath), file = path.basename(appPath);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(port);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });

  const t0 = Date.now();
  await page.goto('http://127.0.0.1:' + port + '/' + file, { waitUntil: 'load', timeout: 90000 });
  const storageAtStart = await page.evaluate(`JSON.stringify({ keys: Object.keys(localStorage).length })`);

  const sel = await setup(page);
  await page.evaluate(SAMPLER);

  const wait = ms => page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
  await wait(1500);
  // The 1.7s brand intro overlays everything; a click at 1.5s lands on the splash, not the field,
  // on BOTH builds. Wait for the overlay to clear so the click is real, then type straight through
  // the tour's arrival - which is the moment that matters.
  for (let i = 0; i < 60; i++) {
    const clear = await page.evaluate(`(() => { const o = document.getElementById('sirenIntroOverlay'); return !o || o.hidden; })()`);
    if (clear) break;
    await page.waitForTimeout(50);
  }
  console.log('intro clear at +' + (Date.now() - t0) + 'ms');

  // A REAL click on the field, at its own coordinates.
  const box = JSON.parse(await page.evaluate(`(() => {
    const n = document.querySelector(${JSON.stringify(sel)});
    if (!n) return 'null';
    const r = n.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + Math.min(18, r.height / 2), w: r.width, h: r.height });
  })()`));
  if (!box) { console.log('TARGET_MISSING ' + sel); await browser.close(); server.close(); return; }
  const hit = await page.evaluate(`(${DESC})(document.elementFromPoint(${box.x}, ${box.y}))`);
  console.log('elementFromPoint at target centre = ' + hit);
  await page.mouse.click(box.x, box.y, { detail: 1 });
  await page.waitForTimeout(60);
  const afterClick = await page.evaluate(`(${DESC})(document.activeElement)`);
  console.log('clicked ' + sel + ' at +' + (Date.now() - t0) + 'ms -> activeElement=' + afterClick);

  const perKey = [];
  for (let i = 0; i < KEYS.length; i++) {
    const before = await page.evaluate(`(${DESC})(document.activeElement)`);
    await page.keyboard.press(KEYS[i]);
    const after = await page.evaluate(`JSON.stringify({ ae: (${DESC})(document.activeElement), v: (() => { const n = document.querySelector(${JSON.stringify(sel)}); return n ? (n.value !== undefined ? n.value : n.textContent) : null; })(), card: !!document.querySelector('.tour-card') })`);
    perKey.push({ i, key: KEYS[i], t: Date.now() - t0, before, after: JSON.parse(after) });
    await page.waitForTimeout(Math.max(0, 170 - 40));
  }

  await page.waitForTimeout(600);
  const final = JSON.parse(await page.evaluate(`(() => {
    const n = document.querySelector(${JSON.stringify(sel)});
    const v = n ? (n.value !== undefined ? n.value : n.textContent) : null;
    return JSON.stringify({
      value: v,
      focusLog: window.__focusLog,
      evLog: window.__evLog.slice(0, 60),
      cardPresent: !!document.querySelector('.tour-card'),
      cardIdx: document.querySelector('.tour-card') ? Array.prototype.indexOf.call(document.body.children, document.querySelector('.tour-card')) : -1
    });
  })()`));

  const kept = final.value === TEXT;
  console.log('MODE=' + mode + ' TAG=' + tag);
  console.log('storageAtStart ' + storageAtStart);
  console.log('FINAL_VALUE ' + JSON.stringify(final.value) + '  expected ' + JSON.stringify(TEXT) + '  ALL_14_KEPT=' + kept);
  console.log('cardPresent=' + final.cardPresent + ' cardIdx=' + final.cardIdx);
  console.log('focusLog ' + JSON.stringify(final.focusLog));
  console.log('perKey ' + JSON.stringify(perKey.map(k => [k.t, k.key, k.before, k.after.ae, k.after.card, k.after.v])));
  console.log('ERRORS ' + JSON.stringify(errors.slice(0, 10)));
  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/r15v_type_' + tag + '.png' });
  console.log('JSONOUT ' + JSON.stringify({ mode, tag, value: final.value, kept, cardPresent: final.cardPresent, cardIdx: final.cardIdx, focusLog: final.focusLog, errors: errors.slice(0, 6) }));
  await browser.close(); server.close();
})();
