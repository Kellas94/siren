/* Opener for tour work.
 *
 * r7_lib's openApp runs SETTLE, and SETTLE clicks every tour button it can find. Anything that
 * needs the first-run tour ON SCREEN has to bypass it. This opener waits for the render and for
 * the brand intro overlay to go away (real mouse clicks land on the overlay otherwise) and then
 * stops - it never touches the tour card.
 *
 * Storage: a brand new context every time, so state.tourDone is false and the tour really arms.
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');

async function openFresh(appPath, port, opts = {}) {
  const viewport = opts.viewport || { width: 1440, height: 900 };
  const root = path.dirname(appPath), file = path.basename(appPath);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(port);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto('http://127.0.0.1:' + port + '/' + file, { waitUntil: 'load', timeout: 90000 });
  // Render.
  for (let i = 0; i < 90; i++) {
    if (await page.evaluate("!!document.querySelector('#diagram svg')")) break;
    await page.waitForTimeout(300);
  }
  // Brand intro. Re-queried, never captured: a detached node reports hidden===false forever.
  for (let i = 0; i < 90; i++) {
    const done = await page.evaluate("(() => { const n = document.getElementById('sirenIntroOverlay'); return !n || n.hidden; })()");
    if (done) break;
    await page.waitForTimeout(100);
  }
  return { page, ctx, browser, errors, close: async () => { await browser.close(); server.close(); } };
}

/* One server + one browser, many INDEPENDENT contexts. Every scenario burns the tour (Escape ends
 * it and writes tourDone), so each one needs virgin storage. A fresh browser context is isolated
 * storage - a reload of the same context is not, and would measure the path where the tour never
 * appears. */
async function openSession(appPath, port, opts = {}) {
  const viewport = opts.viewport || { width: 1440, height: 900 };
  const root = path.dirname(appPath), file = path.basename(appPath);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(port);
  const browser = await chromium.launch();
  const url = 'http://127.0.0.1:' + port + '/' + file;
  async function freshPage() {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    for (let i = 0; i < 90; i++) {
      if (await page.evaluate("!!document.querySelector('#diagram svg')")) break;
      await page.waitForTimeout(300);
    }
    for (let i = 0; i < 90; i++) {
      const done = await page.evaluate("(() => { const n = document.getElementById('sirenIntroOverlay'); return !n || n.hidden; })()");
      if (done) break;
      await page.waitForTimeout(100);
    }
    return { page, ctx, errors, url, dispose: async () => { await ctx.close(); } };
  }
  return { freshPage, url, close: async () => { await browser.close(); server.close(); } };
}

/* Wait for the first-run tour card to actually exist. Returns ms waited, or -1. */
async function waitTour(page, ms = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate("!!document.querySelector('.tour-card')")) return Date.now() - t0;
    await page.waitForTimeout(120);
  }
  return -1;
}

/* Dismiss the tour by pressing its own Skip button with a real mouse click. */
async function skipTour(page) {
  for (let i = 0; i < 10; i++) {
    const box = await page.evaluate(`(() => {
      const card = document.querySelector('.tour-card');
      if (!card) return null;
      const b = Array.from(card.querySelectorAll('button')).find(x => /skip/i.test(x.textContent)) || card.querySelector('button');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!box) return true;
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(250);
  }
  return !(await page.evaluate("!!document.querySelector('.tour-card')"));
}

/* Set the editor source the way setSource does, then ASSERT it landed (trap 3). */
async function setSourceChecked(page, text, settleMs = 2600) {
  await page.evaluate(`(() => {
    const s = document.getElementById('source');
    s.value = ${JSON.stringify(text)};
    s.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await page.waitForTimeout(settleMs);
  const got = await page.evaluate("document.getElementById('source').value");
  return { ok: got === text, got };
}

/* Real mouse click on a rendered diagram node group, centred on its own box. */
async function clickNode(page, nodeId) {
  const box = await page.evaluate(`(() => {
    const root = document.getElementById('diagram');
    if (!root) return null;
    const hits = [];
    root.querySelectorAll('[data-node-id]').forEach(g => { if (g.getAttribute('data-node-id') === ${JSON.stringify(nodeId)}) hits.push(g); });
    root.querySelectorAll('g.node').forEach(g => {
      const d = g.getAttribute('data-id'); const id = g.getAttribute('id') || '';
      if (d === ${JSON.stringify(nodeId)} || id === ${JSON.stringify(nodeId)}
        || id.includes('-' + ${JSON.stringify(nodeId)} + '-') || id.endsWith('-' + ${JSON.stringify(nodeId)})) hits.push(g);
    });
    const g = hits[0];
    if (!g) return null;
    const r = g.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), h: Math.round(r.height) };
  })()`);
  if (!box) return null;
  // Refuse to report a click that actually landed on the tour card or any overlay.
  const topmost = await page.evaluate(`(() => {
    const e = document.elementFromPoint(${box.x}, ${box.y});
    if (!e) return 'none';
    return e.closest('.tour-card') ? 'TOUR-CARD' : (e.tagName + '#' + (e.id || ''));
  })()`);
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(500);
  return { box, topmost };
}

/* Type with real keys at a human cadence. */
async function typeSlow(page, text, perKey = 60) {
  for (const ch of text) {
    await page.keyboard.press(ch === ' ' ? 'Space' : ch);
    await page.waitForTimeout(perKey);
  }
}

/* Who has focus, described well enough to compare two builds. */
const ACTIVE = `(() => {
  const a = document.activeElement;
  if (!a) return 'null';
  if (a === document.body) return 'BODY';
  const card = a.closest && a.closest('.tour-card');
  const tag = a.tagName.toLowerCase();
  const id = a.id ? '#' + a.id : '';
  const txt = (a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 22);
  return (card ? 'TOURCARD:' : '') + tag + id + (id ? '' : '[' + (a.getAttribute('aria-label') || txt) + ']');
})()`;

module.exports = { openFresh, openSession, waitTour, skipTour, setSourceChecked, clickNode, typeSlow, ACTIVE };
