const path = require('path'), fs = require('fs'), http = require('http');
const lib = require('./r7_lib.js');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const APP = process.argv[2], PORT = Number(process.argv[3]);
const FIXTURE = ['flowchart TD','  A[Alpha step] --> B[Bravo step]','  B --> C[Charlie step]','  D[Delta step] --> A'].join('\n');
(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])), (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(lib.SETTLE);
  for (let i = 0; i < 20; i++) {
    const gone = await page.evaluate(`(() => { const c = document.querySelector('.tour-card'); if (!c) return true; const b = Array.from(c.querySelectorAll('button')).find(x=>/skip|done|got it|close|finish/i.test(x.textContent))||c.querySelector('button'); if (b) b.click(); return false; })()`);
    if (gone && i > 6) break; await page.waitForTimeout(180);
  }
  await lib.setSource(page, FIXTURE, 3000);
  const zb = JSON.parse(await page.evaluate(`JSON.stringify((() => { const z = document.getElementById('zoomInButton'); const r = z ? z.getBoundingClientRect() : null; return { has: !!z, x: r ? r.x + r.width/2 : 0, y: r ? r.y + r.height/2 : 0, w: r ? r.width : 0, before: (document.getElementById('zoomRange')||{}).value }; })())`));
  console.log('zoomBtn', JSON.stringify(zb));
  for (let i = 0; i < 8; i++) { await page.mouse.click(zb.x, zb.y); await page.waitForTimeout(180); }
  await page.waitForTimeout(1200);
  console.log('zoomAfter', await page.evaluate(`(document.getElementById('zoomRange')||{}).value`));
  const info = JSON.parse(await page.evaluate(`JSON.stringify((() => {
    const z = document.getElementById('zoomViewport');
    const r = z.getBoundingClientRect();
    return { rect: {x:r.x,y:r.y,w:r.width,h:r.height}, sw: z.scrollWidth, cw: z.clientWidth, sh: z.scrollHeight, ch: z.clientHeight,
      overflowStyle: getComputedStyle(z).overflow, zoom: (document.getElementById('zoomRange')||{}).value };
  })())`));
  console.log('viewport info', JSON.stringify(info));
  const pt = JSON.parse(await page.evaluate(`JSON.stringify((() => {
    const z = document.getElementById('zoomViewport'); const r = z.getBoundingClientRect();
    const sel = 'button, input, select, a, #diagram [data-handle-for], #diagram [data-t-workpaper-node], #diagram g.node, #diagram [data-node-id], #diagram [data-edge-key], #diagram path.t-edge-hitarea, #diagram path.flowchart-link, #diagram path[id*="L_"], #diagram path[id*="L-"], #diagram .edgePath, #diagram .edgeLabel';
    for (let gy = 0.85; gy > 0.1; gy -= 0.05) for (let gx = 0.9; gx > 0.05; gx -= 0.05) {
      const x = r.x + r.width*gx, y = r.y + r.height*gy; const t = document.elementFromPoint(x,y);
      if (!t || !t.closest('#zoomViewport')) continue; if (t.closest(sel)) continue;
      if (t.closest('[id*="inimap"], [class*="inimap"], .preview-overlay, .canvas-move-ghost')) continue;
      return { x: +x.toFixed(1), y: +y.toFixed(1), tag: t.tagName, id: t.id, cls: t.className && t.className.baseVal !== undefined ? t.className.baseVal : String(t.className||'') };
    } return null;
  })())`));
  console.log('point', JSON.stringify(pt));
  const read = () => page.evaluate(`JSON.stringify((() => { const z = document.getElementById('zoomViewport'); return { l: Math.round(z.scrollLeft), t: Math.round(z.scrollTop), panning: z.classList.contains('is-panning') }; })())`);
  console.log('before', await read());
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  console.log('afterDown', await read());
  for (let i = 1; i <= 12; i++) { await page.mouse.move(pt.x - i*12, pt.y - i*10); await page.waitForTimeout(30); }
  console.log('duringMove', await read());
  await page.mouse.up();
  await page.waitForTimeout(500);
  console.log('after', await read());
  await browser.close(); server.close(); process.exit(0);
})();
