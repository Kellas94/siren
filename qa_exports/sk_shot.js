const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
(async () => {
  const root = 'C:/Claude/SIREN/qa_exports';
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(9671);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 1100 } });
  await page.goto('http://127.0.0.1:9671/sk_visual.html', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/sk_visual.png', fullPage: true });
  await browser.close(); server.close();
  console.log('shot done');
})();
