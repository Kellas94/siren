/* Look at the glyph: the 18x18 hit rect outlined in red, the glyph as drawn, at 6x.
 * Usage: node be_shot.js <appPath> <port> <outPng>
 */
const path = require('path'), fs = require('fs'), http = require('http');
const lib = require('./r7_lib.js');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const APP = process.argv[2], PORT = Number(process.argv[3]), OUT = process.argv[4];
const FIXTURE = ['flowchart TD', '  A[Alpha step] --> B[Bravo step]', '  B --> C[Charlie step]', '  D[Delta step] --> A'].join('\n');
async function ev(page, expr) { return JSON.parse(await page.evaluate(`JSON.stringify((() => { ${expr} })())`)); }
(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])), (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 6 });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(lib.SETTLE);
  for (let i = 0; i < 20; i++) {
    const gone = await page.evaluate(`(() => { const c = document.querySelector('.tour-card'); if (!c) return true; const b = Array.from(c.querySelectorAll('button')).find(x=>/skip|done|got it|close|finish/i.test(x.textContent))||c.querySelector('button'); if (b) b.click(); return false; })()`);
    if (gone && i > 6) break; await page.waitForTimeout(180);
  }
  await lib.setSource(page, FIXTURE, 3200);
  // create a document on B through the inspector
  const nb = await ev(page, `
    const groups = Array.from(document.querySelectorAll('#diagram g.node, #diagram [data-node-id]'));
    for (const g of groups) { const id = g.getAttribute('data-node-id') || g.getAttribute('id') || ''; if (id === 'B' || id.indexOf('-B-') >= 0 || id.endsWith('-B')) { const r = g.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; } } return null;
  `);
  await page.mouse.click(nb.x, nb.y);
  await page.waitForTimeout(800);
  await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (d) { const det = d.closest('details'); if (det) det.open = true; d.scrollIntoView({ block: 'center' }); } return 1;`);
  await page.waitForTimeout(400);
  const b = await ev(page, `const d = document.getElementById('nodeDocNewButton'); const r = d.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 };`);
  await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1400);
  await ev(page, `const c = document.getElementById('closeWpButton'); if (c) c.click(); const i = document.getElementById('inspectorDoneButton'); if (i) i.click(); return 1;`);
  await page.waitForTimeout(900);
  const clip = await ev(page, `
    const m = document.querySelector('#diagram [data-t-workpaper-node="B"]');
    const rect = m.querySelector('rect');
    const r = rect.getBoundingClientRect();
    // outline the hit target so the glyph's place inside it is visible
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', '#ff0000');
    rect.setAttribute('stroke-width', '0.4');
    return { x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 };
  `);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT, clip });
  console.log('wrote ' + OUT + ' clip ' + JSON.stringify(clip));
  await browser.close(); server.close(); process.exit(0);
})();
