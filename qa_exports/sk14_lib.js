/* Skeptic harness for round 14 "keys" group.
 * Opens the app on a FRESH context with empty storage and WAITS FOR THE TOUR
 * instead of dismissing it. r7_lib's SETTLE kills the tour, which is the whole
 * subject here, so none of it is reused except the Playwright resolution trick.
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

async function launch() {
  return chromium.launch();
}

/* One fresh, never-used profile. Nothing is clicked, so the first-run tour arrives. */
async function freshPage(browser, port, file, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });
  await page.goto(`http://127.0.0.1:${port}/${file}`, { waitUntil: 'load', timeout: 90000 });
  return { page, ctx, errors };
}

/* Wait for the brand intro to clear and the first-run tour card to be on screen. */
async function waitTour(page, ms = 25000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const st = await page.evaluate(`(() => {
      const intro = document.getElementById('sirenIntroOverlay');
      const card = document.querySelector('.tour-card');
      return JSON.stringify({ intro: intro ? !intro.hidden : false, card: !!card, svg: !!document.querySelector('#diagram svg') });
    })()`);
    const s = JSON.parse(st);
    if (s.card && !s.intro) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

async function waitNoIntro(page, ms = 20000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const hidden = await page.evaluate(`(() => { const i = document.getElementById('sirenIntroOverlay'); return !i || i.hidden; })()`);
    if (hidden) return true;
    await page.waitForTimeout(120);
  }
  return false;
}

async function describeFocus(page) {
  return JSON.parse(await page.evaluate(`(() => {
    const a = document.activeElement;
    if (!a) return JSON.stringify({ tag: 'none' });
    const card = document.querySelector('.tour-card');
    const inCard = !!(card && card.contains(a));
    return JSON.stringify({
      tag: a.tagName,
      id: a.id || '',
      cls: (a.className && a.className.baseVal !== undefined ? a.className.baseVal : String(a.className || '')).slice(0, 60),
      text: (a.textContent || '').replace(/[ ]+/g, ' ').trim().slice(0, 32),
      inCard
    });
  })()`));
}

async function tourUp(page) {
  return page.evaluate(`!!document.querySelector('.tour-card')`);
}

async function readSource(page) {
  return JSON.parse(await page.evaluate(`(() => {
    const s = document.getElementById('source');
    return JSON.stringify({ len: s ? s.value.length : -1, value: s ? s.value : null });
  })()`));
}

module.exports = { serve, launch, freshPage, waitTour, waitNoIntro, describeFocus, tourUp, readSource };
