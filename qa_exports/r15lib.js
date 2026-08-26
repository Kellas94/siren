/* Round 15 verification helpers (items BQ, BR).
 *
 * One http server per BUILD, many browser contexts on it, so a probe can open the same app at
 * several viewports without re-serving. Nothing here dismisses a tour card by itself except
 * killTour(), which is called explicitly - the r7 settle is deliberately NOT used, because it
 * would also swallow the first real click of any case that runs near the tour timer.
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');

function serve(appPath, port) {
  const root = path.dirname(appPath);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(port);
  return server;
}

async function openBuild(appPath, port) {
  const server = serve(appPath, port);
  const browser = await chromium.launch();
  const file = path.basename(appPath);
  return {
    async page(viewport = { width: 1440, height: 900 }) {
      const ctx = await browser.newContext({ viewport });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 180)));
      page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 180)); });
      await page.goto('http://127.0.0.1:' + port + '/' + file, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction("!!document.querySelector('#diagram svg')", null, { timeout: 60000 }).catch(() => {});
      await page.waitForFunction("(() => { const i = document.getElementById('sirenIntroOverlay'); return !i || i.hidden; })()", null, { timeout: 30000 }).catch(() => {});
      return { page, errors, close: async () => { await ctx.close(); } };
    },
    close: async () => { await browser.close(); server.close(); }
  };
}

/* The tour arms on a timer AFTER the app settles and swallows clicks elsewhere. */
async function killTour(page) {
  for (let i = 0; i < 30; i++) {
    const gone = await page.evaluate(`(() => {
      const card = document.querySelector('.tour-card');
      if (!card) return true;
      const b = Array.from(card.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent))
        || card.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 8) return;
    await page.waitForTimeout(200);
  }
}

async function setSource(page, text, settleMs = 2600) {
  await page.evaluate(`(() => {
    const s = document.getElementById('source');
    s.value = ${JSON.stringify(text)};
    s.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await page.waitForTimeout(settleMs);
}

/* Click the real element at its real centre with a real mouse. Returns false if it is not there
   or has no box, so a probe can never report "clicked" over nothing. */
async function clickSel(page, sel, opts = {}) {
  const box = await page.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) return false;
  await page.mouse.click(box.x, box.y, opts);
  await page.waitForTimeout(opts.settle || 260);
  return true;
}

async function clickText(page, sel, re) {
  const box = await page.evaluate(`(() => {
    const rx = new RegExp(${JSON.stringify(re)}, 'i');
    const e = Array.from(document.querySelectorAll(${JSON.stringify(sel)}))
      .find(n => rx.test((n.textContent || '').trim()));
    if (!e) return null;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(300);
  return true;
}

const CLEAR_TOAST = `(() => {
  const t = document.getElementById('toast');
  if (t) { t.textContent = ''; t.classList.remove('is-visible'); t.dataset.kind = ''; }
  return 1;
})()`;

const READ_TOAST = `(() => {
  const t = document.getElementById('toast');
  return t ? { text: t.textContent, visible: t.classList.contains('is-visible'), kind: t.dataset.kind || '' }
           : { text: null, visible: false, kind: '' };
})()`;

module.exports = { openBuild, killTour, setSource, clickSel, clickText, CLEAR_TOAST, READ_TOAST };
