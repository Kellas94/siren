/* Recon: fresh first-run, no settle. Watch the tour arrive and sample focus over time. */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');

const appPath = process.argv[2];
const port = Number(process.argv[3]);
const tag = process.argv[4] || 'x';

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
  console.log('load at +' + (Date.now() - t0));

  const samples = [];
  for (let i = 0; i < 22; i++) {
    const s = await page.evaluate(`(() => {
      const ae = document.activeElement;
      const card = document.querySelector('.tour-card');
      const intro = document.getElementById('sirenIntroOverlay');
      const bodyKids = Array.from(document.body.children).slice(0, 4).map(n =>
        n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/ +/).join('.') : ''));
      return JSON.stringify({
        ae: ae ? (ae.tagName.toLowerCase() + (ae.id ? '#' + ae.id : '') + (ae.className && typeof ae.className === 'string' ? '.' + String(ae.className).trim().slice(0,40) : '')) : null,
        card: card ? { idx: Array.prototype.indexOf.call(document.body.children, card), rect: card.getBoundingClientRect().toJSON(), z: getComputedStyle(card).zIndex, pos: getComputedStyle(card).position, text: (card.textContent||'').slice(0,60) } : null,
        introHidden: intro ? intro.hidden : 'no-intro',
        bodyKids
      });
    })()`);
    samples.push({ t: Date.now() - t0, s: JSON.parse(s) });
    await page.waitForTimeout(250);
  }
  console.log(JSON.stringify(samples, null, 1));
  console.log('ERRORS ' + JSON.stringify(errors));
  await page.screenshot({ path: path.join('C:/Claude/SIREN/qa_exports', 'r15v_recon_' + tag + '.png') });
  await browser.close(); server.close();
})();
