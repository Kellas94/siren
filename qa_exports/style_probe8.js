/* Probe 8: does the welcome tour actually show a step pointing at the ⚙ Style button that is
   display:none, and where does its highlight land? */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(9875);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  await page.goto('http://127.0.0.1:9875/' + file, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(7000);   // let the tour arm itself; do NOT sweep it

  const steps = [];
  for (let i = 0; i < 12; i++) {
    const card = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card');
      if (!c || !c.getClientRects().length) return null;
      const r = c.getBoundingClientRect();
      const spot = document.querySelector('.tour-spot,.tour-highlight,.tour-ring');
      return { text: c.textContent.replace(/\\s+/g,' ').trim().slice(0, 130),
               card: [Math.round(r.x), Math.round(r.y)],
               spot: spot ? spot.getBoundingClientRect().toJSON() : null };
    })()`);
    if (!card) break;
    steps.push(card);
    const next = await page.evaluate(`(() => { const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /next|finish|done/i.test(x.textContent)); if (b) { b.click(); return b.textContent.trim(); } return null; })()`);
    if (!next) break;
    await page.waitForTimeout(700);
  }
  steps.forEach((s, i) => console.log(`STEP ${i + 1}: ${s.text}\n   card at ${JSON.stringify(s.card)} spot=${s.spot ? JSON.stringify({ x: Math.round(s.spot.x), y: Math.round(s.spot.y), w: Math.round(s.spot.width), h: Math.round(s.spot.height) }) : 'none'}`));
  await browser.close(); server.close();
})();
